"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { DrillQuestion, DrillAttempt, DrillResult } from "@/lib/drill";
import { computeDrillResult, saveDrillResult } from "@/lib/drill";
import { autoCompleteDailyTask } from "@/lib/daily-plan";
import { loadSkillMastery, saveSkillMastery, computeSkillReviewSchedule } from "@/lib/skill-mastery-store";
import type { StoredSkillMastery } from "@/lib/skill-mastery-store";
import { masteryToTier, calculateMasteryUpdate } from "@/lib/adaptive";
import type { DifficultyLevel } from "@/lib/types";
import {
  checkAndAwardBadges,
  buildBadgeContext,
  type BadgeDefinition,
} from "@/lib/achievements";

// ─── Helpers ──────────────────────────────────────────────────────────

/** Compare answers handling letter-prefixed, bare letter, and plain text formats. */
function answersMatchLocal(student: string, correct: string): boolean {
  // Direct match
  if (student.trim().toLowerCase() === correct.trim().toLowerCase()) return true;
  // Extract letter from "C) text" or bare "C"
  const extractLetter = (s: string): string | null => {
    const m = s.trim().match(/^([A-Ea-e])\)/);
    if (m) return m[1].toUpperCase();
    if (/^[A-Ea-e]$/i.test(s.trim())) return s.trim().toUpperCase();
    return null;
  };
  const sL = extractLetter(student);
  const cL = extractLetter(correct);
  if (sL && cL) return sL === cL;
  // Strip letter prefix and compare text
  const strip = (s: string) => s.replace(/^[A-Ea-e]\)\s*/, "").trim().toLowerCase();
  return strip(student) === strip(correct);
}

// ─── Adaptive Difficulty Helpers (exported for testing) ──────────────

/** Minimal attempt info needed from DrillAttempt for mastery computation. */
export interface DrillAttemptSummary {
  readonly isCorrect: boolean;
  readonly timeSpentMs: number;
}

/**
 * Compute the difficulty tier for a drill based on stored mastery.
 * Falls back to the skill's static difficulty_tier if no mastery data exists.
 */
export function computeDrillDifficultyTier(
  stored: StoredSkillMastery | null,
  skillDefaultTier: number,
): DifficultyLevel {
  if (!stored) {
    return Math.max(1, Math.min(5, skillDefaultTier)) as DifficultyLevel;
  }
  // Use mastery-derived tier even if attemptsCount is 0 (e.g. diagnostic set mastery)
  return masteryToTier(stored.masteryLevel);
}

/**
 * Compute and return updated mastery data after a drill session.
 * Creates a new entry if no prior mastery exists (fixes drill-only users).
 * Blends prior cumulative stats with session attempts for accurate mastery.
 *
 * Returns the full StoredSkillMastery object, or null if no attempts.
 */
export function persistDrillMastery(
  skillId: string,
  prior: StoredSkillMastery | null,
  attempts: readonly DrillAttemptSummary[],
  currentTier: DifficultyLevel,
): StoredSkillMastery | null {
  if (attempts.length === 0) return null;

  // Convert drill attempts to AttemptRecord format for calculateMasteryUpdate.
  // We synthesize prior history as a single aggregate record so the mastery formula
  // blends cumulative performance with session performance (not session-only).
  const sessionRecords = attempts.map((a) => ({
    isCorrect: a.isCorrect,
    timeSpentSeconds: Math.round(a.timeSpentMs / 1000),
    hintUsed: false, // drills never use hints
  }));

  // Reconstruct a simplified prior history to feed the mastery formula.
  // This ensures returning users don't have their mastery reset by a single session.
  const priorRecords: { isCorrect: boolean; timeSpentSeconds: number | null; hintUsed: boolean }[] = [];
  if (prior && prior.attemptsCount > 0) {
    const priorCorrect = prior.correctCount;
    const priorWrong = prior.attemptsCount - priorCorrect;
    // Add correct records
    for (let i = 0; i < priorCorrect; i++) {
      priorRecords.push({ isCorrect: true, timeSpentSeconds: null, hintUsed: false });
    }
    // Add wrong records
    for (let i = 0; i < priorWrong; i++) {
      priorRecords.push({ isCorrect: false, timeSpentSeconds: null, hintUsed: false });
    }
  }

  const allRecords = [...priorRecords, ...sessionRecords];
  const update = calculateMasteryUpdate(allRecords, currentTier);
  const correctCount = attempts.filter((a) => a.isCorrect).length;

  const base: StoredSkillMastery = {
    skillId,
    masteryLevel: update.newMasteryLevel,
    attemptsCount: (prior?.attemptsCount ?? 0) + attempts.length,
    correctCount: (prior?.correctCount ?? 0) + correctCount,
    lastPracticed: new Date().toISOString(),
    confidenceTrend: update.newConfidenceTrend,
    interval: prior?.interval,
    easeFactor: prior?.easeFactor,
    nextReviewDate: prior?.nextReviewDate,
    repetitions: prior?.repetitions,
  };

  const sessionAccuracy = correctCount / attempts.length;
  const schedule = computeSkillReviewSchedule(base, sessionAccuracy);

  return { ...base, ...schedule };
}

const DRILL_STREAK_TO_ADVANCE = 3;
const DRILL_STREAK_TO_DROP = 2;

/**
 * Compute a difficulty tier adjustment based on the in-session streak.
 * Simplified version of adjustDifficulty for drill mode (no hints, no teach mode).
 */
export function computeDrillStreakTier(
  baseTier: DifficultyLevel,
  attempts: readonly { readonly isCorrect: boolean }[],
): DifficultyLevel {
  if (attempts.length === 0) return baseTier;

  // Count trailing streak from end of array
  let streak = 0;
  const lastResult = attempts[attempts.length - 1].isCorrect;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i].isCorrect === lastResult) streak++;
    else break;
  }

  // Drop tier on wrong streak
  if (!lastResult && streak >= DRILL_STREAK_TO_DROP) {
    return Math.max(1, baseTier - 1) as DifficultyLevel;
  }

  // Advance tier on correct streak
  if (lastResult && streak >= DRILL_STREAK_TO_ADVANCE) {
    return Math.min(5, baseTier + 1) as DifficultyLevel;
  }

  return baseTier;
}

// ─── Types ────────────────────────────────────────────────────────────

export type DrillPhase = "setup" | "loading" | "active" | "complete";

interface DrillState {
  phase: DrillPhase;
  skillId: string;
  skillName: string;
  durationMinutes: number;
  currentTier: DifficultyLevel;
  questions: DrillQuestion[];
  currentQuestionIndex: number;
  attempts: DrillAttempt[];
  startTime: number;
  remainingSeconds: number;
  lastAnswerCorrect: boolean | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useDrillSession() {
  const [state, setState] = useState<DrillState>({
    phase: "setup",
    skillId: "",
    skillName: "",
    durationMinutes: 3,
    currentTier: 3 as DifficultyLevel,
    questions: [],
    currentQuestionIndex: 0,
    attempts: [],
    startTime: 0,
    remainingSeconds: 0,
    lastAnswerCorrect: null,
  });

  const [result, setResult] = useState<DrillResult | null>(null);
  const [newBadges, setNewBadges] = useState<readonly BadgeDefinition[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionShownAt = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Timer tick
  useEffect(() => {
    if (state.phase !== "active") return;

    timerRef.current = setInterval(() => {
      setState((s) => {
        const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
        const remaining = s.durationMinutes * 60 - elapsed;
        if (remaining <= 0) {
          return { ...s, remainingSeconds: 0 };
        }
        return { ...s, remainingSeconds: remaining };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase, state.durationMinutes, state.startTime]);

  // Auto-end when time runs out
  useEffect(() => {
    if (state.phase === "active" && state.remainingSeconds <= 0 && state.startTime > 0) {
      void endDrill();
    }
  }, [state.remainingSeconds, state.phase, state.startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist mastery after drill — creates entry if none exists, updates if it does
  const persistMastery = useCallback((skillId: string, attempts: DrillAttempt[], tier: DifficultyLevel) => {
    if (attempts.length === 0) return;
    const prior = loadSkillMastery(skillId);
    const summaries: DrillAttemptSummary[] = attempts.map((a) => ({
      isCorrect: a.isCorrect,
      timeSpentMs: a.timeSpentMs,
    }));
    const updated = persistDrillMastery(skillId, prior, summaries, tier);
    if (updated) {
      saveSkillMastery(updated);
    }
  }, []);

  const fetchQuestions = useCallback(
    async (skillId: string, count: number = 10, difficultyTier?: DifficultyLevel, recentQuestions?: string[]): Promise<DrillQuestion[]> => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate_drill_batch",
          skillId,
          count,
          ...(difficultyTier !== undefined && { difficultyTier }),
          ...(recentQuestions && recentQuestions.length > 0 && { recentQuestions }),
        }),
      });

      if (!res.ok) throw new Error("Failed to generate drill questions");

      const data = (await res.json()) as { questions?: DrillQuestion[] };
      return data.questions ?? [];
    },
    [],
  );

  const startDrill = useCallback(
    async (skillId: string, skillName: string, durationMinutes: number) => {
      setState((s) => ({ ...s, phase: "loading", skillId, skillName, durationMinutes }));

      try {
        // Load stored mastery to determine initial difficulty tier
        const stored = loadSkillMastery(skillId);
        const { getSkillById } = await import("@/lib/exam/curriculum");
        const skill = getSkillById(skillId);
        const initialTier = computeDrillDifficultyTier(
          stored,
          skill?.difficulty_tier ?? 3,
        );

        const questions = await fetchQuestions(skillId, 10, initialTier);

        if (questions.length === 0) {
          setState((s) => ({ ...s, phase: "setup" }));
          return;
        }

        const now = Date.now();
        questionShownAt.current = now;

        setState((s) => ({
          ...s,
          phase: "active",
          currentTier: initialTier,
          questions,
          currentQuestionIndex: 0,
          attempts: [],
          startTime: now,
          remainingSeconds: durationMinutes * 60,
          lastAnswerCorrect: null,
        }));
      } catch {
        setState((s) => ({ ...s, phase: "setup" }));
      }
    },
    [fetchQuestions],
  );

  const submitAnswer = useCallback(
    async (answer: string) => {
      const s = stateRef.current;
      if (s.phase !== "active") return;

      const question = s.questions[s.currentQuestionIndex];
      if (!question) return;

      const timeSpentMs = Date.now() - questionShownAt.current;

      // Compare answers — handle multiple formats:
      // - "C) text" vs "C) text" (letter-prefixed)
      // - "C" vs "C) text" (bare letter)
      // - "text" vs "text" (plain text from drill batch JSON)
      const isCorrect = answersMatchLocal(answer, question.correctAnswer);

      const attempt: DrillAttempt = {
        questionText: question.questionText,
        studentAnswer: answer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        timeSpentMs,
      };

      const newAttempts = [...s.attempts, attempt];
      const nextIndex = s.currentQuestionIndex + 1;

      // Need more questions?
      if (nextIndex >= s.questions.length && s.remainingSeconds > 5) {
        // Fetch more in background — use streak-adjusted tier for next batch
        try {
          const streakTier = computeDrillStreakTier(s.currentTier, newAttempts);
          const recentTexts = s.questions.slice(-10).map((q) => q.questionText);
          const more = await fetchQuestions(s.skillId, 10, streakTier, recentTexts);
          // Deduplicate: skip questions whose text already appeared in this session
          const existingTexts = new Set(s.questions.map((q) => q.questionText));
          const unique = more.filter((q) => !existingTexts.has(q.questionText));
          if (unique.length === 0) {
            // All fetched questions were duplicates — fall through to end-drill check
          } else {
            questionShownAt.current = Date.now();
            setState((prev) => ({
              ...prev,
              attempts: newAttempts,
              questions: [...prev.questions, ...unique],
              currentQuestionIndex: nextIndex,
              currentTier: streakTier,
              lastAnswerCorrect: isCorrect,
            }));
            return;
          }
        } catch {
          // If fetch fails, end the drill
        }
      }

      if (nextIndex >= s.questions.length || s.remainingSeconds <= 0) {
        // End drill
        const durationSeconds = Math.floor((Date.now() - s.startTime) / 1000);
        const drillResult = computeDrillResult(
          s.skillId,
          s.skillName,
          newAttempts,
          durationSeconds,
        );
        saveDrillResult(drillResult);
        autoCompleteDailyTask(s.skillId, "drill");
        persistMastery(s.skillId, newAttempts, s.currentTier);

        // Check badges
        const ctx = buildBadgeContext({
          drillQuestionsPerMinute: drillResult.questionsPerMinute,
        });
        const earned = checkAndAwardBadges(ctx);
        setNewBadges(earned);

        setResult(drillResult);
        setState((prev) => ({
          ...prev,
          phase: "complete",
          attempts: newAttempts,
          lastAnswerCorrect: isCorrect,
        }));
        return;
      }

      questionShownAt.current = Date.now();
      setState((prev) => ({
        ...prev,
        attempts: newAttempts,
        currentQuestionIndex: nextIndex,
        lastAnswerCorrect: isCorrect,
      }));
    },
    [fetchQuestions, persistMastery],
  );

  const endDrill = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase !== "active") return;

    if (timerRef.current) clearInterval(timerRef.current);

    const durationSeconds = Math.floor((Date.now() - s.startTime) / 1000);
    const drillResult = computeDrillResult(
      s.skillId,
      s.skillName,
      s.attempts,
      durationSeconds,
    );
    saveDrillResult(drillResult);
    autoCompleteDailyTask(s.skillId, "drill");
    persistMastery(s.skillId, s.attempts, s.currentTier);

    const ctx = buildBadgeContext({
      drillQuestionsPerMinute: drillResult.questionsPerMinute,
    });
    const earned = checkAndAwardBadges(ctx);
    setNewBadges(earned);

    setResult(drillResult);
    setState((prev) => ({ ...prev, phase: "complete" }));
  }, [persistMastery]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResult(null);
    setNewBadges([]);
    setState({
      phase: "setup",
      skillId: "",
      skillName: "",
      durationMinutes: 3,
      currentTier: 3 as DifficultyLevel,
      questions: [],
      currentQuestionIndex: 0,
      attempts: [],
      startTime: 0,
      remainingSeconds: 0,
      lastAnswerCorrect: null,
    });
  }, []);

  const currentQuestion =
    state.phase === "active"
      ? state.questions[state.currentQuestionIndex] ?? null
      : null;

  return {
    state,
    result,
    newBadges,
    currentQuestion,
    startDrill,
    submitAnswer,
    endDrill,
    reset,
    setDuration: (min: number) =>
      setState((s) => ({ ...s, durationMinutes: min })),
  };
}
