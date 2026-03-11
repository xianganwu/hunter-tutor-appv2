"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loadAllSkillMasteries,
  type StoredSkillMastery,
} from "@/lib/skill-mastery-store";
import { loadMistakes, getDueForReview } from "@/lib/mistakes";
import { getAllSkills, getSkillIdsForDomain } from "@/lib/exam/curriculum";
import { SkillMap } from "@/components/dashboard/SkillMap";
import { DomainCard } from "@/components/dashboard/DomainCard";
import type { SerializedSkillState, DomainProgress } from "@/components/dashboard/types";

interface SessionSummary {
  id: string;
  domain: string;
  startedAt: string;
  endedAt: string | null;
  skillsCovered: string[];
  sessionSummary: string | null;
  questionCount: number;
}

export default function ProgressPage() {
  const [masteries, setMasteries] = useState<StoredSkillMastery[]>([]);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load local data
    const m = loadAllSkillMasteries();
    setMasteries(m);

    const mistakes = loadMistakes();
    setMistakeCount(mistakes.length);
    setDueReviewCount(getDueForReview(mistakes).length);

    // Fetch recent sessions from server
    async function fetchSessions() {
      try {
        const res = await fetch("/api/session?limit=10");
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions ?? []);
        }
      } catch {
        // Silently fail — sessions are supplementary
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  const allSkills = getAllSkills();

  const practicedSkills = masteries.filter((m) => m.attemptsCount > 0);
  const totalAttempts = practicedSkills.reduce(
    (sum, m) => sum + m.attemptsCount,
    0
  );
  const totalCorrect = practicedSkills.reduce(
    (sum, m) => sum + m.correctCount,
    0
  );
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const avgMastery =
    practicedSkills.length > 0
      ? Math.round(
          (practicedSkills.reduce((sum, m) => sum + m.masteryLevel, 0) /
            practicedSkills.length) *
            100
        )
      : 0;

  // Build data for SkillMap and DomainCards
  const storedMap = new Map(masteries.map((s) => [s.skillId, s]));
  const skillStates: SerializedSkillState[] = [];
  for (const [skillId] of allSkills) {
    const s = storedMap.get(skillId);
    skillStates.push({
      skillId,
      masteryLevel: s?.masteryLevel ?? 0,
      attemptsCount: s?.attemptsCount ?? 0,
      correctCount: s?.correctCount ?? 0,
      lastPracticed: s?.lastPracticed ?? null,
      confidenceTrend: s?.confidenceTrend ?? "stable",
    });
  }

  const DOMAIN_IDS = ["reading_comprehension", "math_quantitative_reasoning", "math_achievement"] as const;
  const DOMAIN_NAMES: Record<string, string> = {
    reading_comprehension: "Reading Comprehension",
    math_quantitative_reasoning: "Math: Quantitative Reasoning",
    math_achievement: "Math: Achievement",
  };
  const domainProgress: DomainProgress[] = DOMAIN_IDS.map((domainId) => {
    const domainSkillIds = getSkillIdsForDomain(domainId);
    const domainMasteries = domainSkillIds.map(
      (id) => skillStates.find((s) => s.skillId === id)?.masteryLevel ?? 0,
    );
    const avg = domainMasteries.length > 0
      ? domainMasteries.reduce((a, b) => a + b, 0) / domainMasteries.length
      : 0;
    return {
      domainId,
      domainName: DOMAIN_NAMES[domainId] ?? domainId,
      overallMastery: avg,
      skillCount: domainSkillIds.length,
      masteredCount: domainMasteries.filter((m) => m > 0.7).length,
      inProgressCount: domainMasteries.filter((m) => m >= 0.4 && m <= 0.7).length,
      needsWorkCount: domainMasteries.filter((m) => m < 0.4).length,
    };
  });

  const trendIcon = (trend: string) => {
    if (trend === "improving") return "\u2191";
    if (trend === "declining") return "\u2193";
    return "\u2192";
  };

  const trendColor = (trend: string) => {
    if (trend === "improving")
      return "text-green-600 dark:text-green-400";
    if (trend === "declining")
      return "text-red-500 dark:text-red-400";
    return "text-surface-400";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="flex items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
              Progress Dashboard
            </h1>
            <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
              Track your learning journey
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-surface-200 px-4 py-2 text-sm font-medium text-surface-700 transition hover:bg-surface-300 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-card dark:bg-surface-900">
            <p className="text-xs font-medium uppercase text-surface-400">
              Skills Practiced
            </p>
            <p className="mt-1 text-2xl font-bold text-surface-900 dark:text-surface-50">
              {practicedSkills.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-card dark:bg-surface-900">
            <p className="text-xs font-medium uppercase text-surface-400">
              Overall Mastery
            </p>
            <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">
              {avgMastery}%
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-card dark:bg-surface-900">
            <p className="text-xs font-medium uppercase text-surface-400">
              Accuracy
            </p>
            <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
              {overallAccuracy}%
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-card dark:bg-surface-900">
            <p className="text-xs font-medium uppercase text-surface-400">
              Mistakes to Review
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {dueReviewCount}
              <span className="ml-1 text-sm font-normal text-surface-400">
                / {mistakeCount}
              </span>
            </p>
          </div>
        </div>

        {/* Skill Map */}
        <SkillMap states={skillStates} />

        {/* Practice by Subject */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-surface-900 dark:text-surface-50">
            Practice by Subject
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {domainProgress.map((dp) => (
              <DomainCard key={dp.domainId} progress={dp} />
            ))}
          </div>
        </div>

        {/* Skill Mastery Table */}
        {practicedSkills.length > 0 ? (
          <div className="rounded-2xl bg-white shadow-card dark:bg-surface-900">
            <div className="border-b border-surface-100 px-6 py-4 dark:border-surface-800">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                Skill Mastery
              </h2>
            </div>
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {practicedSkills
                .sort((a, b) => b.masteryLevel - a.masteryLevel)
                .map((m) => {
                  const skill = allSkills.get(m.skillId);
                  const pct = Math.round(m.masteryLevel * 100);
                  return (
                    <div
                      key={m.skillId}
                      className="flex items-center gap-4 px-6 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">
                          {skill?.name ?? m.skillId}
                        </p>
                        <p className="text-xs text-surface-400">
                          {m.correctCount}/{m.attemptsCount} correct
                        </p>
                      </div>
                      <div className="flex w-32 items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                          <div
                            className="h-full rounded-full bg-brand-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-medium text-surface-600 dark:text-surface-400">
                          {pct}%
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold ${trendColor(m.confidenceTrend)}`}
                        title={m.confidenceTrend}
                      >
                        {trendIcon(m.confidenceTrend)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-12 text-center shadow-card dark:bg-surface-900">
            <p className="text-lg font-medium text-surface-600 dark:text-surface-400">
              No skills practiced yet
            </p>
            <p className="mt-2 text-sm text-surface-400">
              Start a tutoring session to see your progress here.
            </p>
            <Link
              href="/tutor/math"
              className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Start Practicing
            </Link>
          </div>
        )}

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <div className="rounded-2xl bg-white shadow-card dark:bg-surface-900">
            <div className="border-b border-surface-100 px-6 py-4 dark:border-surface-800">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                Recent Sessions
              </h2>
            </div>
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {sessions.map((s) => (
                <div key={s.id} className="px-6 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium capitalize text-surface-800 dark:text-surface-200">
                      {s.domain}
                    </p>
                    <p className="text-xs text-surface-400">
                      {new Date(s.startedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-surface-500">
                    {s.questionCount} question{s.questionCount !== 1 ? "s" : ""}
                    {s.sessionSummary ? ` — ${s.sessionSummary}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
