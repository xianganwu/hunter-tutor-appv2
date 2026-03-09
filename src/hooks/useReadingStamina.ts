"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { PassageQuestion } from "@/lib/types";
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
} from "@/lib/reading-stamina";
import type { StaminaProgress, ReadingRecord } from "@/lib/reading-stamina";

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

interface QuestionItem {
  readonly questionText: string;
  readonly choices: readonly string[];
  readonly correctIndex: number;
  readonly explanation: string;
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
}

// ─── Helpers ──────────────────────────────────────────────────────────

function passageQuestionToItem(q: PassageQuestion): QuestionItem {
  return {
    questionText: q.question_text,
    choices: q.answer_choices.map((c) => `${c.letter}. ${c.text}`),
    correctIndex: q.answer_choices.findIndex(
      (c) => c.letter === q.correct_answer
    ),
    explanation: q.correct_answer_explanation,
  };
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
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const initialized = useRef(false);

  // Load a passage for the current stamina level
  const loadPassage = useCallback(async () => {
    const s = stateRef.current;
    setState((prev) => ({ ...prev, phase: "loading" }));

    const levelConfig = getStaminaLevel(s.progress.currentLevel);
    const allPassages = Array.from(getAllPassages().values());

    // Try to find a library passage first
    const libraryPassage = selectPassageForLevel(
      s.progress.currentLevel,
      s.progress.completedPassageIds,
      allPassages
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
          questions: data.passage!.questions,
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

      // Check speed drop
      const drop = detectSpeedDrop(updated.records);

      setState((prev) => ({
        ...prev,
        progress: updated,
        phase: "feedback",
        passagesThisSession: prev.passagesThisSession + 1,
        newLevel: advanced ? updated.currentLevel : null,
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
