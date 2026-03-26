"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { DifficultyLevel, PassageQuestion } from "@/lib/types";
import { getAllPassages } from "@/lib/exam/passages";
import {
  loadStaminaProgress,
  saveStaminaProgress,
  recordReading,
  computeWPM,
  detectSpeedDrop,
  getStaminaLevel,
  selectPassageForLevel,
  computeStaminaStats,
  staminaLevelToTier,
  RC_SKILL_NAMES,
} from "@/lib/reading-stamina";
import { autoCompleteDailyTask } from "@/lib/daily-plan";
import type { StaminaProgress, ReadingRecord } from "@/lib/reading-stamina";
import type { AttemptRecord, MasteryWeightConfig } from "@/lib/adaptive";
import { calculateMasteryUpdate } from "@/lib/adaptive";
import {
  loadSkillMastery,
  saveSkillMastery,
  loadReadingAttemptWindow,
  saveReadingAttemptWindow,
} from "@/lib/skill-mastery-store";

// ─── Types ────────────────────────────────────────────────────────────

export type ReadingPhase =
  | "loading"
  | "reading"
  | "answering"
  | "feedback"
  | "speed_check"
  | "level_up"
  | "summary";

interface ActivePassage {
  readonly id: string;
  readonly title: string;
  readonly preReadingContext: string;
  readonly passageText: string;
  readonly wordCount: number;
  readonly questions: readonly QuestionItem[];
  readonly isAiGenerated: boolean;
}

export interface QuestionItem {
  readonly questionText: string;
  readonly choices: readonly string[];
  readonly correctIndex: number;
  readonly explanation: string;
  readonly skillId: string;
}

export interface SkillResult {
  readonly skillId: string;
  readonly skillName: string;
  readonly isCorrect: boolean;
  readonly mastery: number;
  readonly previousMastery: number;
}

export interface ReadingStaminaState {
  readonly phase: ReadingPhase;
  readonly progress: StaminaProgress;
  readonly currentPassage: ActivePassage | null;
  readonly readingTimeSeconds: number;
  readonly currentWpm: number;
  readonly currentQuestionIndex: number;
  readonly questionsCorrect: number;
  readonly answers: readonly (number | null)[];
  readonly speedFeedback: string | null;
  readonly newLevel: number | null;
  readonly passagesThisSession: number;
  readonly startTime: number;
  readonly skillResults: readonly SkillResult[];
}

// ─── Constants ────────────────────────────────────────────────────────

const READING_MASTERY_WEIGHTS: MasteryWeightConfig = {
  weightRecent: 0.8,
  weightOverall: 0.2,
  weightTime: 0.0,
};

// ─── Helpers ──────────────────────────────────────────────────────────

function passageQuestionToItem(q: PassageQuestion): QuestionItem {
  return {
    questionText: q.question_text,
    choices: q.answer_choices.map((c) => `${c.letter}. ${c.text}`),
    correctIndex: q.answer_choices.findIndex(
      (c) => c.letter === q.correct_answer
    ),
    explanation: q.correct_answer_explanation,
    skillId: q.skill_tested ?? "rc_general",
  };
}

// ─── Skill Mastery Persistence ────────────────────────────────────────

function persistReadingSkillMastery(
  results: readonly { skillId: string; isCorrect: boolean }[],
  tier: DifficultyLevel,
): SkillResult[] {
  const skillResults: SkillResult[] = [];

  try {
    for (const { skillId, isCorrect } of results) {
      if (skillId === "rc_general") continue;

      const previousMastery = loadSkillMastery(skillId)?.masteryLevel ?? 0;
      const window = loadReadingAttemptWindow(skillId);
      const attempt: AttemptRecord = {
        isCorrect,
        timeSpentSeconds: null,
        hintUsed: false,
        tier,
      };
      const updatedWindow = [...window, attempt].slice(-10);

      const update = calculateMasteryUpdate(
        updatedWindow,
        tier,
        READING_MASTERY_WEIGHTS,
      );

      const stored = loadSkillMastery(skillId);
      saveSkillMastery({
        skillId,
        masteryLevel: update.newMasteryLevel,
        attemptsCount: (stored?.attemptsCount ?? 0) + 1,
        correctCount: (stored?.correctCount ?? 0) + (isCorrect ? 1 : 0),
        lastPracticed: new Date().toISOString(),
        confidenceTrend: update.newConfidenceTrend,
        interval: stored?.interval,
        easeFactor: stored?.easeFactor,
        nextReviewDate: stored?.nextReviewDate,
        repetitions: stored?.repetitions,
      });

      saveReadingAttemptWindow(skillId, updatedWindow);

      skillResults.push({
        skillId,
        skillName: RC_SKILL_NAMES[skillId] ?? skillId,
        isCorrect,
        mastery: update.newMasteryLevel,
        previousMastery,
      });
    }
  } catch (err) {
    console.error("[reading] skill mastery persist error:", err);
  }

  return skillResults;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useReadingStamina() {
  const [state, setState] = useState<ReadingStaminaState>({
    phase: "loading",
    progress: loadStaminaProgress(),
    currentPassage: null,
    readingTimeSeconds: 0,
    currentWpm: 0,
    currentQuestionIndex: 0,
    questionsCorrect: 0,
    answers: [],
    speedFeedback: null,
    newLevel: null,
    passagesThisSession: 0,
    startTime: Date.now(),
    skillResults: [],
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const initialized = useRef(false);
  const questionResults = useRef<{ skillId: string; isCorrect: boolean }[]>([]);

  // Load a passage for the current stamina level
  const loadPassage = useCallback(async () => {
    const s = stateRef.current;
    questionResults.current = [];
    setState((prev) => ({ ...prev, phase: "loading", skillResults: [] }));

    const levelConfig = getStaminaLevel(s.progress.currentLevel);
    const allPassages = Array.from(getAllPassages().values());

    // Try to find a library passage first (pass recent records for genre diversity)
    const libraryPassage = selectPassageForLevel(
      s.progress.currentLevel,
      s.progress.completedPassageIds,
      allPassages,
      s.progress.records
    );

    if (libraryPassage) {
      // Use a subset of questions (up to 5)
      const questions = libraryPassage.questions
        .slice(0, 5)
        .map(passageQuestionToItem);

      setState((prev) => ({
        ...prev,
        phase: "reading",
        currentPassage: {
          id: libraryPassage.metadata.passage_id,
          title: libraryPassage.metadata.title,
          preReadingContext: libraryPassage.pre_reading_context,
          passageText: libraryPassage.passage_text,
          wordCount: libraryPassage.metadata.word_count,
          questions,
          isAiGenerated: false,
        },
        currentQuestionIndex: 0,
        questionsCorrect: 0,
        answers: new Array(questions.length).fill(null),
        readingTimeSeconds: 0,
        currentWpm: 0,
        speedFeedback: null,
        newLevel: null,
      }));
      return;
    }

    // No library passage available — generate one via AI
    try {
      const genres = [
        "nonfiction",
        "fiction",
        "science article",
        "historical narrative",
      ];
      const genre = genres[Math.floor(Math.random() * genres.length)];
      const targetWords = Math.round(
        (levelConfig.minWords + levelConfig.maxWords) / 2
      );

      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate_passage",
          targetWordCount: targetWords,
          genre,
          difficulty: Math.min(s.progress.currentLevel, 5),
        }),
      });

      if (!res.ok) throw new Error("Failed to generate passage");

      const data = (await res.json()) as {
        passage?: {
          title: string;
          preReadingContext: string;
          passageText: string;
          wordCount: number;
          questions: readonly {
            questionText: string;
            choices: readonly string[];
            correctIndex: number;
            explanation: string;
            skillTested?: string;
          }[];
        };
      };

      if (!data.passage) throw new Error("No passage returned");

      const genId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      setState((prev) => ({
        ...prev,
        phase: "reading",
        currentPassage: {
          id: genId,
          title: data.passage!.title,
          preReadingContext: data.passage!.preReadingContext,
          passageText: data.passage!.passageText,
          wordCount: data.passage!.wordCount,
          questions: data.passage!.questions.map((q) => ({
            ...q,
            skillId: q.skillTested ?? "rc_general",
          })),
          isAiGenerated: true,
        },
        currentQuestionIndex: 0,
        questionsCorrect: 0,
        answers: new Array(data.passage!.questions.length).fill(null),
        readingTimeSeconds: 0,
        currentWpm: 0,
        speedFeedback: null,
        newLevel: null,
      }));
    } catch {
      // Fallback: retry with a lower level library passage
      const fallback = selectPassageForLevel(
        Math.max(1, s.progress.currentLevel - 1),
        s.progress.completedPassageIds,
        allPassages
      );

      if (fallback) {
        const questions = fallback.questions
          .slice(0, 5)
          .map(passageQuestionToItem);

        setState((prev) => ({
          ...prev,
          phase: "reading",
          currentPassage: {
            id: fallback.metadata.passage_id,
            title: fallback.metadata.title,
            preReadingContext: fallback.pre_reading_context,
            passageText: fallback.passage_text,
            wordCount: fallback.metadata.word_count,
            questions,
            isAiGenerated: false,
          },
          currentQuestionIndex: 0,
          questionsCorrect: 0,
          answers: new Array(questions.length).fill(null),
          readingTimeSeconds: 0,
          currentWpm: 0,
          speedFeedback: null,
          newLevel: null,
        }));
      }
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void loadPassage();
    }
  }, [loadPassage]);

  // Called when student finishes reading
  const finishReading = useCallback((readingTimeSeconds: number) => {
    const s = stateRef.current;
    if (!s.currentPassage) return;

    const wpm = computeWPM(s.currentPassage.wordCount, readingTimeSeconds);

    setState((prev) => ({
      ...prev,
      phase: "answering",
      readingTimeSeconds,
      currentWpm: wpm,
    }));
  }, []);

  // Answer a question
  const answerQuestion = useCallback((choiceIndex: number) => {
    const s = stateRef.current;
    if (!s.currentPassage) return;

    const question = s.currentPassage.questions[s.currentQuestionIndex];
    const isCorrect = choiceIndex === question.correctIndex;
    const newAnswers = [...s.answers];
    newAnswers[s.currentQuestionIndex] = choiceIndex;

    // Collect skill result for mastery tracking
    questionResults.current.push({ skillId: question.skillId, isCorrect });

    const newCorrect = s.questionsCorrect + (isCorrect ? 1 : 0);
    const nextIndex = s.currentQuestionIndex + 1;
    const isLastQuestion = nextIndex >= s.currentPassage.questions.length;

    setState((prev) => ({
      ...prev,
      answers: newAnswers,
      questionsCorrect: newCorrect,
      currentQuestionIndex: isLastQuestion ? prev.currentQuestionIndex : nextIndex,
      phase: isLastQuestion ? "feedback" : "answering",
    }));

    // If last question, record the reading and check for speed drop
    if (isLastQuestion) {
      const record: ReadingRecord = {
        passageId: s.currentPassage.id,
        passageTitle: s.currentPassage.title,
        wordCount: s.currentPassage.wordCount,
        readingTimeSeconds: s.readingTimeSeconds,
        wpm: s.currentWpm,
        staminaLevel: s.progress.currentLevel,
        questionsCorrect: newCorrect,
        questionsTotal: s.currentPassage.questions.length,
        timestamp: Date.now(),
      };

      const { progress: updated, advanced } = recordReading(
        s.progress,
        record
      );
      saveStaminaProgress(updated);
      autoCompleteDailyTask(undefined, "skill_practice");

      // Persist per-skill mastery using rolling window
      const skillResults = persistReadingSkillMastery(
        questionResults.current,
        staminaLevelToTier(s.progress.currentLevel),
      );

      // Check speed drop
      const drop = detectSpeedDrop(updated.records);

      setState((prev) => ({
        ...prev,
        progress: updated,
        phase: "feedback",
        passagesThisSession: prev.passagesThisSession + 1,
        newLevel: advanced ? updated.currentLevel : null,
        skillResults,
      }));

      // Fetch speed feedback if there's a drop
      if (drop !== null) {
        const stats = computeStaminaStats(
          updated.records.slice(0, -1)
        );
        void fetchSpeedFeedback(
          s.currentWpm,
          stats.averageWpm,
          Math.round(drop * 100),
          s.currentPassage.wordCount,
          s.currentPassage.title
        );
      }
    }
  }, []);

  // Fetch AI speed feedback
  const fetchSpeedFeedback = async (
    currentWpm: number,
    averageWpm: number,
    dropPercent: number,
    wordCount: number,
    title: string
  ) => {
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "speed_feedback",
          currentWpm,
          averageWpm,
          dropPercent,
          passageWordCount: wordCount,
          passageTitle: title,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { text: string };
        setState((prev) => ({
          ...prev,
          speedFeedback: data.text,
        }));
      }
    } catch {
      // Use default message
      setState((prev) => ({
        ...prev,
        speedFeedback:
          "I notice this longer passage took more time. Let's talk about strategies for staying focused on longer readings. What part did you find hardest to get through?",
      }));
    }
  };

  // Move to speed check phase (after viewing feedback)
  const proceedFromFeedback = useCallback(() => {
    const s = stateRef.current;

    if (s.newLevel !== null) {
      setState((prev) => ({ ...prev, phase: "level_up" }));
    } else if (s.speedFeedback) {
      setState((prev) => ({ ...prev, phase: "speed_check" }));
    } else {
      void loadPassage();
    }
  }, [loadPassage]);

  // Continue after speed check or level up
  const continueSession = useCallback(() => {
    void loadPassage();
  }, [loadPassage]);

  // End session
  const endSession = useCallback(() => {
    setState((prev) => ({ ...prev, phase: "summary" }));
  }, []);

  return {
    state,
    finishReading,
    answerQuestion,
    proceedFromFeedback,
    continueSession,
    endSession,
  };
}
