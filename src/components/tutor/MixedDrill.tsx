"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useMixedDrill } from "@/hooks/useMixedDrill";
import { MathText } from "@/components/chat/MathText";
import { ChoiceButtons } from "@/components/chat/ChoiceButtons";
import { SessionMascot, type MascotReaction } from "@/components/shared/SessionMascot";
import { getStoredMascotType } from "@/lib/user-profile";
import { getMascotTier } from "@/components/shared/Mascot";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import { getRandomQuestionPhrase } from "@/lib/loading-phrases";
import { getSkillById } from "@/lib/exam/curriculum";
import type { SkillDrillBreakdown } from "@/lib/drill";

export function MixedDrill() {
  const {
    state,
    result,
    currentQuestion,
    startDrill,
    submitAnswer,
    reset,
  } = useMixedDrill();

  // Mascot
  const mascotType = getStoredMascotType();
  const storedMasteries = loadAllSkillMasteries();
  const overallMastery = storedMasteries.length > 0
    ? storedMasteries.reduce((sum, s) => sum + s.masteryLevel, 0) / storedMasteries.length
    : 0;
  const mascotTier = getMascotTier(overallMastery);
  const [mascotReaction, setMascotReaction] = useState<MascotReaction>("idle");
  const [mascotReactionKey, setMascotReactionKey] = useState(0);
  const prevAttemptsRef = useRef(0);

  useEffect(() => {
    const count = state.attempts.length;
    if (count <= prevAttemptsRef.current) return;
    prevAttemptsRef.current = count;
    if (state.lastAnswerCorrect === true) {
      setMascotReaction("correct");
    } else {
      setMascotReaction("incorrect");
    }
    setMascotReactionKey((k) => k + 1);
  }, [state.attempts.length, state.lastAnswerCorrect]);

  // ─── Setup Phase ───────────────────────────────────────────────────
  if (state.phase === "setup") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 animate-fade-in">
        <div className="max-w-md w-full space-y-6 text-center">
          <div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              Mixed Math Drill
            </h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              15 questions across multiple skills — one tier harder than your level.
            </p>
          </div>

          <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-600/20 dark:text-brand-400">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 2L13 8L19 9L14.5 13.5L15.5 19.5L10 16.5L4.5 19.5L5.5 13.5L1 9L7 8L10 2Z" fill="currentColor" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                  Skills auto-selected
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Based on your weakest math areas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-600/20 dark:text-amber-400">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 3V10L14 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                  No time limit
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Focus on accuracy, not speed
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => void startDrill()}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Start Drill
          </button>

          <Link
            href="/dashboard"
            className="block text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─── Loading Phase ─────────────────────────────────────────────────
  if (state.phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            {getRandomQuestionPhrase()}
          </p>
        </div>
      </div>
    );
  }

  // ─── Active Phase ──────────────────────────────────────────────────
  if (state.phase === "active" && currentQuestion) {
    const total = state.questions.length;
    const current = state.currentQuestionIndex + 1;
    const progress = Math.round((state.currentQuestionIndex / total) * 100);
    const skillName = getSkillById(currentQuestion.skillId)?.name ?? currentQuestion.skillId;

    return (
      <div className="flex flex-1 flex-col animate-fade-in">
        {/* Top bar: progress */}
        <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Q {current}/{total}
            </span>
            <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
              {skillName}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-700">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Answer flash */}
        {state.lastAnswerCorrect !== null && (
          <div
            className={`px-4 py-1.5 text-center text-xs font-medium ${
              state.lastAnswerCorrect
                ? "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300"
                : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
            }`}
          >
            {state.lastAnswerCorrect ? "Correct!" : "Not quite"}
          </div>
        )}

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
          <div className="max-w-lg w-full text-center">
            <p className="text-base font-medium text-surface-900 dark:text-surface-100 leading-relaxed whitespace-pre-wrap">
              <MathText text={currentQuestion.questionText} />
            </p>
          </div>

          <div className="max-w-lg w-full">
            <ChoiceButtons
              choices={currentQuestion.answerChoices as string[]}
              onSelect={(choice) => submitAnswer(choice)}
              disabled={false}
            />
          </div>
        </div>

        <SessionMascot
          mascotType={mascotType}
          tier={mascotTier}
          reaction={mascotReaction}
          reactionKey={mascotReactionKey}
        />
      </div>
    );
  }

  // ─── Complete Phase ────────────────────────────────────────────────
  if (state.phase === "complete" && result) {
    const weakSkills = result.skillBreakdown.filter((s) => s.needsWork);
    const strongSkills = result.skillBreakdown.filter((s) => !s.needsWork);

    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 animate-fade-in">
        <div className="max-w-md w-full space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              Drill Complete!
            </h2>
            <p className="mt-1 text-3xl font-bold text-brand-600 dark:text-brand-400">
              {result.accuracy}%
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {result.totalCorrect} of {result.totalQuestions} correct
            </p>
          </div>

          {/* Skill Breakdown */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
              Skill Breakdown
            </h3>
            {result.skillBreakdown.map((skill) => (
              <SkillCard key={skill.skillId} skill={skill} />
            ))}
          </div>

          {/* Weak skills callout */}
          {weakSkills.length > 0 && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-600/10 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                These skills need more practice:
              </p>
              <div className="flex flex-col gap-2">
                {weakSkills.map((s) => (
                  <Link
                    key={s.skillId}
                    href={`/tutor/math?skill=${s.skillId}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2"
                  >
                    Practice {s.skillName}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Strong skills */}
          {strongSkills.length > 0 && (
            <div className="rounded-2xl bg-success-50 dark:bg-success-500/10 p-4">
              <p className="text-sm font-medium text-success-800 dark:text-success-300">
                Looking strong in: {strongSkills.map((s) => s.skillName).join(", ")}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                reset();
                void startDrill();
              }}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/dashboard"
              className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-center text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function SkillCard({ skill }: { readonly skill: SkillDrillBreakdown }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-soft p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
          {skill.skillName}
        </p>
        <p className="text-xs text-surface-500 dark:text-surface-400">
          {skill.correct}/{skill.total} correct
        </p>
      </div>
      <div
        className={`text-lg font-bold ${
          skill.needsWork
            ? "text-amber-500 dark:text-amber-400"
            : "text-success-500 dark:text-success-400"
        }`}
      >
        {skill.accuracy}%
      </div>
    </div>
  );
}
