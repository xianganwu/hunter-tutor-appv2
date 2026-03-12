"use client";

import { useState, useEffect, useRef } from "react";
import { useDrillSession } from "@/hooks/useDrillSession";
import { MathText } from "@/components/chat/MathText";
import { ChoiceButtons } from "@/components/chat/ChoiceButtons";
import { getBestDrillForSkill } from "@/lib/drill";
import { NextTaskPrompt } from "@/components/shared/NextTaskPrompt";
import { getSkillById, getSkillIdsForDomain } from "@/lib/exam/curriculum";
import { SessionMascot, type MascotReaction } from "@/components/shared/SessionMascot";
import { getStoredMascotType } from "@/lib/user-profile";
import { getMascotTier } from "@/components/shared/Mascot";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import { getRandomQuestionPhrase } from "@/lib/loading-phrases";
import { DailyPlanProgress } from "@/components/shared/DailyPlanProgress";

const DOMAINS = [
  { id: "reading_comprehension", label: "Reading" },
  { id: "math_quantitative_reasoning", label: "Math QR" },
  { id: "math_achievement", label: "Math Achievement" },
] as const;

const DURATIONS = [2, 3, 5] as const;

interface DrillModeProps {
  readonly initialSkillId?: string;
}

export function DrillMode({ initialSkillId }: DrillModeProps) {
  const {
    state,
    result,
    currentQuestion,
    startDrill,
    submitAnswer,
    endDrill,
    reset,
    setDuration,
  } = useDrillSession();

  const [selectedSkillId, setSelectedSkillId] = useState(initialSkillId ?? "");
  // Mascot reactions
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

  // Set initial skill
  useEffect(() => {
    if (initialSkillId) {
      setSelectedSkillId(initialSkillId);
    }
  }, [initialSkillId]);

  // Available skills for the picker
  const allSkills = DOMAINS.flatMap((d) =>
    getSkillIdsForDomain(d.id).map((id) => ({
      id,
      name: getSkillById(id)?.name ?? id,
      domain: d.label,
    })),
  );

  const selectedSkill = getSkillById(selectedSkillId);
  const bestDrill = selectedSkillId ? getBestDrillForSkill(selectedSkillId) : null;

  // ─── Setup Phase ───────────────────────────────────────────────────
  if (state.phase === "setup") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 animate-fade-in">
        <div className="max-w-md w-full space-y-6 text-center">
          <div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              Timed Drill
            </h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Rapid-fire practice. Build your exam pace.
            </p>
          </div>

          {/* Skill Picker */}
          <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 text-left space-y-3">
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
              Choose a skill
            </label>
            <select
              value={selectedSkillId}
              onChange={(e) => setSelectedSkillId(e.target.value)}
              className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a skill...</option>
              {DOMAINS.map((d) => (
                <optgroup key={d.id} label={d.label}>
                  {allSkills
                    .filter((s) => s.domain === d.label)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Duration Selector */}
          <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 text-left space-y-3">
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
              Duration
            </label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                    state.durationMinutes === d
                      ? "bg-brand-600 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Best Stats */}
          {bestDrill && (
            <div className="rounded-2xl bg-brand-50 dark:bg-brand-600/10 p-3 text-sm text-brand-700 dark:text-brand-300">
              Best: {bestDrill.accuracy}% accuracy, {bestDrill.questionsPerMinute} q/min
            </div>
          )}

          <button
            onClick={() => {
              if (selectedSkillId && selectedSkill) {
                void startDrill(selectedSkillId, selectedSkill.name, state.durationMinutes);
              }
            }}
            disabled={!selectedSkillId}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
          >
            Start Drill
          </button>

          <a
            href="/dashboard"
            className="block text-sm text-surface-500 hover:text-surface-700 transition-colors"
          >
            Back to Dashboard
          </a>
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
    const minutes = Math.floor(state.remainingSeconds / 60);
    const seconds = state.remainingSeconds % 60;
    const score = state.attempts.filter((a) => a.isCorrect).length;
    const total = state.attempts.length;

    return (
      <div className="flex flex-1 flex-col animate-fade-in">
        {/* Top bar: timer + score */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-3">
            <span
              className={`text-lg font-mono font-bold ${
                state.remainingSeconds <= 30
                  ? "text-red-500 animate-pulse"
                  : "text-surface-900 dark:text-surface-100"
              }`}
            >
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
            <span className="text-xs text-surface-400">remaining</span>
          </div>
          <div className="flex items-center gap-3">
            <DailyPlanProgress />
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              {score}/{total}
            </span>
            <button
              onClick={() => void endDrill()}
              className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
            >
              End Early
            </button>
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
              onSelect={(choice) => void submitAnswer(choice)}
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
    const prevBest = getBestDrillForSkill(state.skillId);
    const improved =
      prevBest && result.id !== prevBest.id && result.accuracy > prevBest.accuracy;

    return (
      <div className="flex flex-1 items-center justify-center px-4 animate-fade-in">
        <div className="max-w-md w-full space-y-6 text-center">
          <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
            Drill Complete!
          </h2>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Questions"
              value={String(result.totalQuestions)}
            />
            <StatCard
              label="Accuracy"
              value={`${result.accuracy}%`}
              highlight={result.accuracy >= 80}
            />
            <StatCard
              label="Speed"
              value={`${result.questionsPerMinute}`}
              sub="q/min"
              highlight={result.questionsPerMinute >= 3}
            />
            <StatCard
              label="Time"
              value={`${Math.round(result.durationSeconds / 60)}`}
              sub="min"
            />
          </div>

          {/* Exam pace comparison */}
          <div className="rounded-2xl bg-brand-50 dark:bg-brand-600/10 p-3 text-sm text-brand-700 dark:text-brand-300">
            {result.questionsPerMinute >= 3
              ? "Great pace! You're at exam speed."
              : result.questionsPerMinute >= 2
                ? "Good pace! A bit more practice to hit exam speed."
                : "Keep practicing to build your speed."}
          </div>

          {/* Improvement delta */}
          {improved && (
            <div className="rounded-2xl bg-success-50 dark:bg-success-500/10 p-3 text-sm text-success-700 dark:text-success-300">
              New personal best! Previous: {prevBest?.accuracy}%
            </div>
          )}

          <div className="flex flex-col gap-3">
            <NextTaskPrompt />
            <button
              onClick={() => {
                reset();
                if (selectedSkill) {
                  void startDrill(state.skillId, state.skillName, state.durationMinutes);
                }
              }}
              className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-center text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-4">
      <div className="text-xs text-surface-400 mb-1">{label}</div>
      <div
        className={`text-2xl font-bold ${
          highlight
            ? "text-success-500"
            : "text-surface-900 dark:text-surface-100"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-surface-400">{sub}</div>}
    </div>
  );
}
