"use client";

import { useState, useCallback, useRef } from "react";
import type { MixedDrillQuestion, MixedDrillAttempt, MixedDrillResult } from "@/lib/drill";
import { computeMixedDrillResult, saveMixedDrillResult, shuffleQuestionChoices } from "@/lib/drill";
import type { DifficultyLevel } from "@/lib/types";
import { getSkillById, getSkillIdsForDomain } from "@/lib/exam/curriculum";
import {
  loadAllSkillMasteries,
  loadSkillMastery,
  saveSkillMastery,
  computeSkillReviewSchedule,
} from "@/lib/skill-mastery-store";

// ─── Helpers ──────────────────────────────────────────────────────────

/** Compare answers handling letter-prefixed, bare letter, and plain text formats. */
function answersMatchLocal(student: string, correct: string): boolean {
  if (student.trim().toLowerCase() === correct.trim().toLowerCase()) return true;
  const extractLetter = (s: string): string | null => {
    const m = s.trim().match(/^([A-Ea-e])\)/);
    if (m) return m[1].toUpperCase();
    if (/^[A-Ea-e]$/i.test(s.trim())) return s.trim().toUpperCase();
    return null;
  };
  const sL = extractLetter(student);
  const cL = extractLetter(correct);
  if (sL && cL) return sL === cL;
  const strip = (s: string) => s.replace(/^[A-Ea-e]\)\s*/, "").trim().toLowerCase();
  return strip(student) === strip(correct);
}

// ─── Types ────────────────────────────────────────────────────────────

export type MixedDrillPhase = "setup" | "loading" | "active" | "complete";

interface MixedDrillState {
  phase: MixedDrillPhase;
  questions: MixedDrillQuestion[];
  currentQuestionIndex: number;
  attempts: MixedDrillAttempt[];
  startTime: number;
  lastAnswerCorrect: boolean | null;
  selectedSkills: Array<{ skillId: string; skillName: string; tier: DifficultyLevel }>;
}

const TOTAL_QUESTIONS = 15;
const MATH_DOMAINS = ["math_quantitative_reasoning", "math_achievement"] as const;

// ─── Skill Selection ──────────────────────────────────────────────────

/** Select 4-5 priority math skills, bump each tier by 1 for challenge. */
function selectNextSkills(): Array<{ skillId: string; skillName: string; tier: DifficultyLevel }> {
  const allMasteries = loadAllSkillMasteries();
  const masteryMap = new Map(allMasteries.map((m) => [m.skillId, m]));

  // Collect all math skill IDs
  const mathSkillIds = MATH_DOMAINS.flatMap((d) => getSkillIdsForDomain(d));

  // Score each skill: lower mastery = higher priority, never-practiced skills are also high priority
  const scored = mathSkillIds
    .map((id) => {
      const skill = getSkillById(id);
      if (!skill) return null;
      const mastery = masteryMap.get(id);
      const masteryLevel = mastery?.masteryLevel ?? 0;
      // Priority: low mastery first, untouched skills get 0.1 to rank just above total beginners
      const priority = mastery ? 1 - masteryLevel : 0.9;
      return { skillId: id, skillName: skill.name, baseTier: skill.difficulty_tier, priority };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.priority - a.priority);

  // Take top 5
  return scored.slice(0, 5).map((s) => ({
    skillId: s.skillId,
    skillName: s.skillName,
    tier: Math.min(5, s.baseTier + 1) as DifficultyLevel,
  }));
}

/** Round-robin shuffle: interleave skills so the student doesn't get 5 of the same in a row. */
function roundRobinShuffle(questions: MixedDrillQuestion[]): MixedDrillQuestion[] {
  const bySkill = new Map<string, MixedDrillQuestion[]>();
  for (const q of questions) {
    const list = bySkill.get(q.skillId) ?? [];
    list.push(q);
    bySkill.set(q.skillId, list);
  }

  const result: MixedDrillQuestion[] = [];
  const stacks = Array.from(bySkill.values());
  let round = 0;
  while (result.length < questions.length) {
    let added = false;
    for (const stack of stacks) {
      if (round < stack.length) {
        result.push(stack[round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  return result;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useMixedDrill() {
  const [state, setState] = useState<MixedDrillState>({
    phase: "setup",
    questions: [],
    currentQuestionIndex: 0,
    attempts: [],
    startTime: 0,
    lastAnswerCorrect: null,
    selectedSkills: [],
  });

  const [result, setResult] = useState<MixedDrillResult | null>(null);
  const questionShownAt = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const startDrill = useCallback(async () => {
    const skills = selectNextSkills();
    if (skills.length === 0) return;

    setState((s) => ({ ...s, phase: "loading", selectedSkills: skills }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate_mixed_drill_batch",
          skills: skills.map((s) => ({ skillId: s.skillId, tier: s.tier })),
          totalCount: TOTAL_QUESTIONS,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate drill questions");

      const data = (await res.json()) as { questions?: MixedDrillQuestion[] };
      const questions = data.questions ?? [];

      if (questions.length === 0) {
        setState((s) => ({ ...s, phase: "setup" }));
        return;
      }

      // Deduplicate: drop questions with identical questionText (rare AI edge case)
      const seen = new Set<string>();
      const deduped = questions.filter((q) => {
        if (seen.has(q.questionText)) return false;
        seen.add(q.questionText);
        return true;
      });

      const shuffled = roundRobinShuffle(deduped).map(shuffleQuestionChoices);
      const now = Date.now();
      questionShownAt.current = now;

      setState((s) => ({
        ...s,
        phase: "active",
        questions: shuffled,
        currentQuestionIndex: 0,
        attempts: [],
        startTime: now,
        lastAnswerCorrect: null,
      }));
    } catch {
      setState((s) => ({ ...s, phase: "setup" }));
    }
  }, []);

  const finalizeDrill = useCallback(
    (attempts: MixedDrillAttempt[], startTime: number, selectedSkills: MixedDrillState["selectedSkills"]) => {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const skillNames = new Map(selectedSkills.map((s) => [s.skillId, s.skillName]));
      const drillResult = computeMixedDrillResult(attempts, durationSeconds, skillNames);
      saveMixedDrillResult(drillResult);

      // Update mastery per skill
      const bySkill = new Map<string, MixedDrillAttempt[]>();
      for (const a of attempts) {
        const list = bySkill.get(a.skillId) ?? [];
        list.push(a);
        bySkill.set(a.skillId, list);
      }
      for (const [skillId, skillAttempts] of Array.from(bySkill.entries())) {
        const accuracy = skillAttempts.filter((a) => a.isCorrect).length / skillAttempts.length;
        const existing = loadSkillMastery(skillId);
        if (existing) {
          const schedule = computeSkillReviewSchedule(existing, accuracy);
          saveSkillMastery({ ...existing, ...schedule });
        }
      }

      setResult(drillResult);
      setState((prev) => ({ ...prev, phase: "complete", attempts }));
    },
    [],
  );

  const submitAnswer = useCallback(
    (answer: string) => {
      const s = stateRef.current;
      if (s.phase !== "active") return;

      const question = s.questions[s.currentQuestionIndex];
      if (!question) return;

      const timeSpentMs = Date.now() - questionShownAt.current;

      const isCorrect = answersMatchLocal(answer, question.correctAnswer);

      const attempt: MixedDrillAttempt = {
        skillId: question.skillId,
        questionText: question.questionText,
        studentAnswer: answer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        timeSpentMs,
      };

      const newAttempts = [...s.attempts, attempt];
      const nextIndex = s.currentQuestionIndex + 1;

      // All questions answered?
      if (nextIndex >= s.questions.length) {
        finalizeDrill(newAttempts, s.startTime, s.selectedSkills);
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
    [finalizeDrill],
  );

  const reset = useCallback(() => {
    setResult(null);
    setState({
      phase: "setup",
      questions: [],
      currentQuestionIndex: 0,
      attempts: [],
      startTime: 0,
      lastAnswerCorrect: null,
      selectedSkills: [],
    });
  }, []);

  const currentQuestion =
    state.phase === "active"
      ? state.questions[state.currentQuestionIndex] ?? null
      : null;

  return {
    state,
    result,
    currentQuestion,
    startDrill,
    submitAnswer,
    reset,
  };
}
