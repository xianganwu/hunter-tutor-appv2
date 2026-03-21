"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatAction, ChatApiResponse } from "@/components/tutor/types";
import type { GeneratedQuestion } from "@/lib/ai/tutor-agent";
import type { AttemptRecord } from "@/lib/adaptive";
import { masteryToTier, calculateMasteryUpdate } from "@/lib/adaptive";
import { loadSkillMastery, saveSkillMastery } from "@/lib/skill-mastery-store";
import {
  buildStudyPlan,
  shouldAdvanceSkill,
  computeSessionSummary,
  formatTimeRemaining,
  SESSION_DURATION_MS,
  TRANSITION_DELAY_MS,
} from "@/lib/guided-study";
import type {
  GuidedStudyPhase,
  SkillSlot,
  GuidedStudySummary,
} from "@/lib/guided-study";
import { autoCompleteDailyTask } from "@/lib/daily-plan";
import { checkAndAwardBadges, buildBadgeContext } from "@/lib/achievements";

// ─── State ───────────────────────────────────────────────────────────

export interface GuidedStudyState {
  readonly phase: GuidedStudyPhase;
  readonly skillSlots: readonly SkillSlot[];
  readonly currentSlotIndex: number;
  readonly currentSkillId: string | null;
  readonly currentSkillName: string | null;

  // Teaching
  readonly teachingText: string;
  readonly isStreaming: boolean;

  // Practice
  readonly activeQuestion: GeneratedQuestion | null;
  readonly feedbackText: string;
  readonly lastAnswerCorrect: boolean | null;
  readonly showingFeedback: boolean;

  // Per-skill tracking
  readonly skillQuestionCount: number;
  readonly skillCorrectCount: number;
  readonly skillCorrectStreak: number;

  // Global
  readonly startTime: number;
  readonly totalQuestions: number;
  readonly totalCorrect: number;

  // Timer
  readonly timeRemainingMs: number;

  // Summary
  readonly summary: GuidedStudySummary | null;

  // Error
  readonly error: string | null;
}

// Re-export types that consumers may need
export type { GuidedStudyPhase, SkillSlot, GuidedStudySummary };
export { formatTimeRemaining };

// ─── API Helpers ─────────────────────────────────────────────────────

async function callApi(action: ChatAction): Promise<ChatApiResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as { error: string }).error);
  }
  return res.json() as Promise<ChatApiResponse>;
}

async function callApiStream(
  action: ChatAction,
  onDelta: (text: string) => void,
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, stream: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as { error: string }).error);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let meta: Record<string, unknown> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) throw new Error(data.error);
        if (data.delta) onDelta(data.delta);
        if (data.done) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { done: _done, ...rest } = data;
          meta = rest;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Stream error") throw e;
      }
    }
  }

  return meta;
}

// ─── Initial State ───────────────────────────────────────────────────

function createInitialState(): GuidedStudyState {
  return {
    phase: "planning",
    skillSlots: [],
    currentSlotIndex: 0,
    currentSkillId: null,
    currentSkillName: null,

    teachingText: "",
    isStreaming: false,

    activeQuestion: null,
    feedbackText: "",
    lastAnswerCorrect: null,
    showingFeedback: false,

    skillQuestionCount: 0,
    skillCorrectCount: 0,
    skillCorrectStreak: 0,

    startTime: 0,
    totalQuestions: 0,
    totalCorrect: 0,

    timeRemainingMs: SESSION_DURATION_MS,

    summary: null,
    error: null,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useGuidedStudy() {
  const [state, setState] = useState<GuidedStudyState>(createInitialState);

  // Refs to avoid stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  const recentAttempts = useRef<AttemptRecord[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether timer has expired so we end after current question
  const timerExpiredRef = useRef(false);

  // ─── Timer ───────────────────────────────────────────────────────

  useEffect(() => {
    const { phase, startTime } = state;
    const isActive =
      phase === "teaching" ||
      phase === "practicing" ||
      phase === "transitioning";

    if (!isActive || startTime === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - stateRef.current.startTime;
      const remaining = Math.max(0, SESSION_DURATION_MS - elapsed);

      setState((s) => ({ ...s, timeRemainingMs: remaining }));

      if (remaining <= 0) {
        timerExpiredRef.current = true;

        // If not mid-question (showing feedback or between questions), end now
        const s = stateRef.current;
        if (s.showingFeedback || s.phase === "teaching" || s.phase === "transitioning") {
          // Will be picked up by nextQuestion or transition completion
        }
        // If in practicing phase with no active question, end immediately
        if (s.phase === "practicing" && !s.activeQuestion && !s.showingFeedback) {
          completeSession();
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.startTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  // ─── Persist Mastery for Current Skill ───────────────────────────

  const persistCurrentSkillMastery = useCallback(() => {
    const s = stateRef.current;
    if (!s.currentSkillId) return;

    const prior = loadSkillMastery(s.currentSkillId);
    const difficultyTier = masteryToTier(
      s.skillSlots[s.currentSlotIndex]?.startMastery ?? 0.5,
    );
    const update = calculateMasteryUpdate(recentAttempts.current, difficultyTier);

    saveSkillMastery({
      skillId: s.currentSkillId,
      masteryLevel: update.newMasteryLevel,
      attemptsCount: (prior?.attemptsCount ?? 0) + s.skillQuestionCount,
      correctCount: (prior?.correctCount ?? 0) + s.skillCorrectCount,
      lastPracticed: new Date().toISOString(),
      confidenceTrend: update.newConfidenceTrend,
    });

    return update.newMasteryLevel;
  }, []);

  // ─── Complete Session ────────────────────────────────────────────

  const completeSession = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "complete") return;

    // Persist mastery for current skill if we were working on one
    const endMastery = persistCurrentSkillMastery();

    // Update the current slot with final stats
    const updatedSlots = s.skillSlots.map((slot, idx) => {
      if (idx === s.currentSlotIndex && s.currentSkillId) {
        return {
          ...slot,
          questionsAnswered: s.skillQuestionCount,
          correctCount: s.skillCorrectCount,
          endMastery: endMastery ?? slot.endMastery,
          completed: true,
        };
      }
      return slot;
    });

    const summary = computeSessionSummary(updatedSlots, s.startTime);

    // Auto-complete daily tasks for all practiced skills
    for (const slot of updatedSlots) {
      if (slot.questionsAnswered > 0) {
        autoCompleteDailyTask(slot.skillId, "skill_practice");
      }
    }

    // Award badges
    const ctx = buildBadgeContext({
      sessionQuestions: summary.totalQuestions,
      sessionCorrect: summary.totalCorrect,
    });
    checkAndAwardBadges(ctx);

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      phase: "complete",
      skillSlots: updatedSlots,
      activeQuestion: null,
      isStreaming: false,
      showingFeedback: false,
      summary,
    }));
  }, [persistCurrentSkillMastery]);

  // ─── Start Teaching for a Skill ──────────────────────────────────

  const startTeachingForSlot = useCallback(
    async (slotIndex: number) => {
      const s = stateRef.current;
      const slot = s.skillSlots[slotIndex];
      if (!slot) return;

      setState((prev) => ({
        ...prev,
        phase: "teaching",
        currentSlotIndex: slotIndex,
        currentSkillId: slot.skillId,
        currentSkillName: slot.skillName,
        teachingText: "",
        isStreaming: true,
        activeQuestion: null,
        feedbackText: "",
        lastAnswerCorrect: null,
        showingFeedback: false,
        skillQuestionCount: 0,
        skillCorrectCount: 0,
        skillCorrectStreak: 0,
      }));

      // Reset per-skill attempt tracking
      recentAttempts.current = [];

      try {
        await callApiStream(
          {
            type: "teach",
            skillId: slot.skillId,
            mastery: slot.startMastery,
          },
          (delta) => {
            setState((prev) => ({
              ...prev,
              teachingText: prev.teachingText + delta,
            }));
          },
        );

        setState((prev) => ({ ...prev, isStreaming: false }));
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Something went wrong";
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: `Failed to load teaching for ${slot.skillName}: ${errMsg}`,
        }));
      }
    },
    [],
  );

  // ─── Start Session ───────────────────────────────────────────────

  const startSession = useCallback(async () => {
    const slots = buildStudyPlan();

    if (slots.length === 0) {
      setState((prev) => ({
        ...prev,
        error: "No skills available to practice",
      }));
      return;
    }

    const now = Date.now();
    timerExpiredRef.current = false;

    setState((prev) => ({
      ...prev,
      skillSlots: slots,
      startTime: now,
      timeRemainingMs: SESSION_DURATION_MS,
      error: null,
    }));

    // Need to update stateRef manually because setState is async
    stateRef.current = {
      ...stateRef.current,
      skillSlots: slots,
      startTime: now,
      timeRemainingMs: SESSION_DURATION_MS,
      error: null,
    };

    await startTeachingForSlot(0);
  }, [startTeachingForSlot]);

  // ─── Proceed to Practice ─────────────────────────────────────────

  const proceedToPractice = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase !== "teaching") return;

    setState((prev) => ({
      ...prev,
      phase: "practicing",
      isStreaming: true,
      activeQuestion: null,
    }));

    try {
      const slot = s.skillSlots[s.currentSlotIndex];
      const tier = masteryToTier(slot?.startMastery ?? 0.5);

      const res = await callApi({
        type: "generate_question",
        skillId: s.currentSkillId!,
        difficultyTier: tier,
      });

      if (res.question) {
        setState((prev) => ({
          ...prev,
          activeQuestion: res.question ?? null,
          isStreaming: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: "Failed to generate a question",
        }));
      }
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Something went wrong";
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: `Failed to generate question: ${errMsg}`,
      }));
    }
  }, []);

  // ─── Advance to Next Skill ───────────────────────────────────────

  const advanceToNextSkill = useCallback(
    async (nextSlotIndex: number) => {
      const s = stateRef.current;
      const nextSlot = s.skillSlots[nextSlotIndex];

      if (!nextSlot) {
        completeSession();
        return;
      }

      setState((prev) => ({
        ...prev,
        phase: "transitioning",
      }));

      // Wait for transition delay, then start teaching next skill
      transitionTimeoutRef.current = setTimeout(() => {
        transitionTimeoutRef.current = null;

        // Check if timer expired during transition
        if (timerExpiredRef.current) {
          completeSession();
          return;
        }

        void startTeachingForSlot(nextSlotIndex);
      }, TRANSITION_DELAY_MS);
    },
    [completeSession, startTeachingForSlot],
  );

  // ─── Submit Answer ───────────────────────────────────────────────

  const submitAnswer = useCallback(
    async (answer: string) => {
      const s = stateRef.current;
      if (s.phase !== "practicing" || !s.activeQuestion || s.isStreaming)
        return;

      // Resolve bare letter answers ("C") to full choice text
      let resolvedAnswer = answer;
      const bare = answer.trim();
      if (/^[A-Ea-e]$/i.test(bare) && s.activeQuestion.answerChoices.length > 0) {
        const idx = bare.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < s.activeQuestion.answerChoices.length) {
          resolvedAnswer = s.activeQuestion.answerChoices[idx];
        }
      }

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        feedbackText: "",
        showingFeedback: false,
      }));

      try {
        const evalMeta = await callApiStream(
          {
            type: "evaluate_answer",
            questionText: s.activeQuestion.questionText,
            studentAnswer: resolvedAnswer,
            correctAnswer: s.activeQuestion.correctAnswer,
            skillId: s.currentSkillId ?? undefined,
          },
          (delta) => {
            setState((prev) => ({
              ...prev,
              feedbackText: prev.feedbackText + delta,
            }));
          },
        );

        const isCorrect = (evalMeta.isCorrect as boolean) ?? false;

        // Record attempt
        const attempt: AttemptRecord = {
          isCorrect,
          timeSpentSeconds: null,
          hintUsed: false,
        };
        recentAttempts.current.push(attempt);

        // Update per-skill stats
        const newSkillQCount = s.skillQuestionCount + 1;
        const newSkillCCount = s.skillCorrectCount + (isCorrect ? 1 : 0);
        const newSkillStreak = isCorrect ? s.skillCorrectStreak + 1 : 0;

        // Update global stats
        const newTotalQ = s.totalQuestions + 1;
        const newTotalC = s.totalCorrect + (isCorrect ? 1 : 0);

        // Update the current slot's stats
        const updatedSlots = s.skillSlots.map((slot, idx) => {
          if (idx === s.currentSlotIndex) {
            return {
              ...slot,
              questionsAnswered: newSkillQCount,
              correctCount: newSkillCCount,
            };
          }
          return slot;
        });

        setState((prev) => ({
          ...prev,
          isStreaming: false,
          showingFeedback: true,
          lastAnswerCorrect: isCorrect,
          skillQuestionCount: newSkillQCount,
          skillCorrectCount: newSkillCCount,
          skillCorrectStreak: newSkillStreak,
          totalQuestions: newTotalQ,
          totalCorrect: newTotalC,
          skillSlots: updatedSlots,
        }));
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Something went wrong";
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: `Failed to evaluate answer: ${errMsg}`,
        }));
      }
    },
    [],
  );

  // ─── Next Question ───────────────────────────────────────────────

  const nextQuestion = useCallback(async () => {
    const s = stateRef.current;
    if (!s.showingFeedback) return;

    const elapsed = Date.now() - s.startTime;

    // Check if we should advance to the next skill
    const shouldAdvance = shouldAdvanceSkill(
      s.skillQuestionCount,
      s.skillCorrectStreak,
      elapsed,
    );

    if (shouldAdvance) {
      // Persist mastery for current skill
      const endMastery = persistCurrentSkillMastery();

      // Update the current slot
      const updatedSlots = s.skillSlots.map((slot, idx) => {
        if (idx === s.currentSlotIndex) {
          return {
            ...slot,
            questionsAnswered: s.skillQuestionCount,
            correctCount: s.skillCorrectCount,
            endMastery: endMastery ?? slot.endMastery,
            completed: true,
          };
        }
        return slot;
      });

      setState((prev) => ({
        ...prev,
        skillSlots: updatedSlots,
        showingFeedback: false,
        activeQuestion: null,
        feedbackText: "",
      }));

      // Update stateRef with new slots so advanceToNextSkill sees them
      stateRef.current = {
        ...stateRef.current,
        skillSlots: updatedSlots,
        showingFeedback: false,
        activeQuestion: null,
        feedbackText: "",
      };

      const nextSlotIndex = s.currentSlotIndex + 1;

      if (nextSlotIndex >= s.skillSlots.length) {
        // No more skills — complete session
        completeSession();
        return;
      }

      // Transition to next skill
      await advanceToNextSkill(nextSlotIndex);
      return;
    }

    // Check timer — if expired, complete session
    if (timerExpiredRef.current || s.timeRemainingMs <= 0) {
      completeSession();
      return;
    }

    // Otherwise, generate next question for current skill
    setState((prev) => ({
      ...prev,
      showingFeedback: false,
      activeQuestion: null,
      feedbackText: "",
      isStreaming: true,
    }));

    try {
      const currentMastery =
        s.skillSlots[s.currentSlotIndex]?.startMastery ?? 0.5;
      const tier = masteryToTier(currentMastery);

      const res = await callApi({
        type: "generate_question",
        skillId: s.currentSkillId!,
        difficultyTier: tier,
      });

      if (res.question) {
        setState((prev) => ({
          ...prev,
          activeQuestion: res.question ?? null,
          isStreaming: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: "Failed to generate next question",
        }));
      }
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Something went wrong";
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: `Failed to generate question: ${errMsg}`,
      }));
    }
  }, [persistCurrentSkillMastery, completeSession, advanceToNextSkill]);

  // ─── End Session (manual) ────────────────────────────────────────

  const endSession = useCallback(() => {
    completeSession();
  }, [completeSession]);

  // ─── Return ──────────────────────────────────────────────────────

  return {
    state,
    startSession,
    proceedToPractice,
    submitAnswer,
    nextQuestion,
    endSession,
  };
}
