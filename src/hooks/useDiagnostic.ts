"use client";

import { useState, useCallback, useRef } from "react";
import {
  DIAGNOSTIC_SKILLS,
  DIAGNOSTIC_DOMAINS,
  computeDiagnosticResults,
  buildInitialMasteries,
  type DiagnosticDomain,
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
      // Fetch questions for all 3 domains in parallel, with per-domain retry
      async function fetchDomain(domain: DiagnosticDomain): Promise<DiagnosticQuestion[]> {
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
          questions: { skillId: string; questionText: string; answerChoices: (string | { letter: string; text: string })[]; correctAnswer: string }[];
        };
        return data.questions.map((q) => ({
          skillId: q.skillId,
          domain,
          questionText: q.questionText,
          correctAnswer: q.correctAnswer,
          answerChoices: q.answerChoices.map((c) => {
            if (typeof c === "object" && "letter" in c) return c;
            // Parse "A) some text" → { letter: "A", text: "some text" }
            const match = String(c).match(/^([A-E])\)\s*(.*)/);
            return match
              ? { letter: match[1], text: match[2] }
              : { letter: "?", text: String(c) };
          }),
        })) as DiagnosticQuestion[];
      }

      const settled = await Promise.allSettled(
        DIAGNOSTIC_DOMAINS.map((domain) => fetchDomain(domain)),
      );

      // Retry any failed domains once (sequential to avoid overloading during outage)
      const domainQuestions: DiagnosticQuestion[][] = [];
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        if (r.status === "fulfilled") {
          domainQuestions.push(r.value);
        } else {
          const retried = await fetchDomain(DIAGNOSTIC_DOMAINS[i]);
          domainQuestions.push(retried);
        }
      }

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

    // Normalize correctAnswer to just the letter (e.g. "A) text" → "A")
    const correctLetter = question.correctAnswer.match(/^([A-E])/)?.[1] ?? question.correctAnswer;
    const answer: DiagnosticAnswer = {
      skillId: question.skillId,
      domain: question.domain,
      selectedAnswer,
      correctAnswer: correctLetter,
      isCorrect: selectedAnswer === correctLetter,
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
