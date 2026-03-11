"use client";

import { useState, useCallback, useRef } from "react";
import {
  DIAGNOSTIC_SKILLS,
  DIAGNOSTIC_DOMAINS,
  computeDiagnosticResults,
  buildInitialMasteries,
  type DiagnosticQuestion,
  type DiagnosticAnswer,
  type DiagnosticResult,
} from "@/lib/diagnostic";
import { saveSkillMastery } from "@/lib/skill-mastery-store";
import { authCompleteOnboarding } from "@/lib/auth-client";
import { getStoredAuthUser, setStoredAuthUser } from "@/lib/user-profile";

// ─── Types ───────────────────────────────────────────────────────────

export type DiagnosticPhase =
  | "intro"
  | "loading"
  | "active"
  | "computing"
  | "results";

export interface DiagnosticState {
  readonly phase: DiagnosticPhase;
  readonly questions: readonly DiagnosticQuestion[];
  readonly currentIndex: number;
  readonly answers: readonly DiagnosticAnswer[];
  readonly results: readonly DiagnosticResult[];
  readonly error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useDiagnostic() {
  const [state, setState] = useState<DiagnosticState>({
    phase: "intro",
    questions: [],
    currentIndex: 0,
    answers: [],
    results: [],
    error: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const startDiagnostic = useCallback(async () => {
    setState((s) => ({ ...s, phase: "loading", error: null }));

    try {
      // Fetch questions for all 3 domains in parallel
      const fetches = DIAGNOSTIC_DOMAINS.map(async (domain) => {
        const skillIds = DIAGNOSTIC_SKILLS[domain];
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "generate_diagnostic",
            domain,
            skillIds,
          }),
        });
        if (!res.ok) throw new Error(`Failed to generate ${domain} questions`);
        const data = (await res.json()) as {
          questions: { skillId: string; questionText: string; answerChoices: { letter: string; text: string }[]; correctAnswer: string }[];
        };
        return data.questions.map((q) => ({
          ...q,
          domain,
        })) as DiagnosticQuestion[];
      });

      const domainQuestions = await Promise.all(fetches);

      // Interleave: take one from each domain in round-robin order
      const interleaved: DiagnosticQuestion[] = [];
      const maxLen = Math.max(...domainQuestions.map((dq) => dq.length));
      for (let i = 0; i < maxLen; i++) {
        for (const dq of domainQuestions) {
          if (i < dq.length) {
            interleaved.push(dq[i]);
          }
        }
      }

      setState((s) => ({
        ...s,
        phase: "active",
        questions: interleaved,
        currentIndex: 0,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load questions";
      setState((s) => ({ ...s, phase: "intro", error: msg }));
    }
  }, []);

  const submitAnswer = useCallback(async (selectedAnswer: string) => {
    const s = stateRef.current;
    const question = s.questions[s.currentIndex];
    if (!question) return;

    const answer: DiagnosticAnswer = {
      skillId: question.skillId,
      domain: question.domain,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect: selectedAnswer === question.correctAnswer,
    };

    const newAnswers = [...s.answers, answer];
    const nextIndex = s.currentIndex + 1;

    if (nextIndex >= s.questions.length) {
      // All questions answered — compute results
      setState((prev) => ({
        ...prev,
        answers: newAnswers,
        phase: "computing",
      }));

      const results = computeDiagnosticResults(newAnswers);
      const masteries = buildInitialMasteries(results);

      // Save each mastery
      for (const { skillId, mastery } of masteries) {
        saveSkillMastery({
          skillId,
          masteryLevel: mastery,
          attemptsCount: 0,
          correctCount: 0,
          lastPracticed: new Date().toISOString(),
          confidenceTrend: "stable",
        });
      }

      // Mark onboarding complete on server
      await authCompleteOnboarding();

      // Update localStorage auth user
      const authUser = getStoredAuthUser();
      if (authUser) {
        setStoredAuthUser({ ...authUser, onboardingComplete: true });
      }

      setState((prev) => ({
        ...prev,
        results,
        phase: "results",
      }));
    } else {
      setState((prev) => ({
        ...prev,
        answers: newAnswers,
        currentIndex: nextIndex,
      }));
    }
  }, []);

  return { state, startDiagnostic, submitAnswer };
}
