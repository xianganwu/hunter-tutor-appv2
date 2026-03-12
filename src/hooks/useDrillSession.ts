"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { DrillQuestion, DrillAttempt, DrillResult } from "@/lib/drill";
import { computeDrillResult, saveDrillResult } from "@/lib/drill";
import { autoCompleteDailyTask } from "@/lib/daily-plan";
import { loadSkillMastery, saveSkillMastery, computeSkillReviewSchedule } from "@/lib/skill-mastery-store";
import {
  checkAndAwardBadges,
  buildBadgeContext,
  type BadgeDefinition,
} from "@/lib/achievements";

// ─── Types ────────────────────────────────────────────────────────────

export type DrillPhase = "setup" | "loading" | "active" | "complete";

interface DrillState {
  phase: DrillPhase;
  skillId: string;
  skillName: string;
  durationMinutes: number;
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

  // Update SM-2 review schedule after a drill session
  const updateSkillReviewSchedule = useCallback((skillId: string, attempts: DrillAttempt[]) => {
    if (attempts.length === 0) return;
    const accuracy = attempts.filter((a) => a.isCorrect).length / attempts.length;
    const existing = loadSkillMastery(skillId);
    if (!existing) return;
    const schedule = computeSkillReviewSchedule(existing, accuracy);
    saveSkillMastery({ ...existing, ...schedule });
  }, []);

  const fetchQuestions = useCallback(
    async (skillId: string, count: number = 10): Promise<DrillQuestion[]> => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate_drill_batch",
          skillId,
          count,
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
        const questions = await fetchQuestions(skillId);

        if (questions.length === 0) {
          setState((s) => ({ ...s, phase: "setup" }));
          return;
        }

        const now = Date.now();
        questionShownAt.current = now;

        setState((s) => ({
          ...s,
          phase: "active",
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

      // Compare answers - extract letter
      const normalize = (a: string) =>
        a.trim().match(/^([A-Ea-e])\)/)?.[1]?.toUpperCase() ??
        a.trim().charAt(0).toUpperCase();
      const isCorrect = normalize(answer) === normalize(question.correctAnswer);

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
        // Fetch more in background
        try {
          const more = await fetchQuestions(s.skillId, 10);
          questionShownAt.current = Date.now();
          setState((prev) => ({
            ...prev,
            attempts: newAttempts,
            questions: [...prev.questions, ...more],
            currentQuestionIndex: nextIndex,
            lastAnswerCorrect: isCorrect,
          }));
          return;
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
        updateSkillReviewSchedule(s.skillId, newAttempts);

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
    [fetchQuestions, updateSkillReviewSchedule],
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
    updateSkillReviewSchedule(s.skillId, s.attempts);

    const ctx = buildBadgeContext({
      drillQuestionsPerMinute: drillResult.questionsPerMinute,
    });
    const earned = checkAndAwardBadges(ctx);
    setNewBadges(earned);

    setResult(drillResult);
    setState((prev) => ({ ...prev, phase: "complete" }));
  }, [updateSkillReviewSchedule]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResult(null);
    setNewBadges([]);
    setState({
      phase: "setup",
      skillId: "",
      skillName: "",
      durationMinutes: 3,
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
