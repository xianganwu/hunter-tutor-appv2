"use client";

import type { SessionSummaryData, SkillProgressDiff } from "@/components/tutor/types";
import { getSkillById } from "@/lib/exam/curriculum";
import { MASTERY_TIER_LABELS } from "@/lib/adaptive";
import { NextTaskPrompt } from "@/components/shared/NextTaskPrompt";
import { MistakeReviewList, type ReviewableMistake } from "@/components/shared/MistakeReviewCard";

interface SessionSummaryProps {
  readonly data: SessionSummaryData;
  readonly mistakes?: readonly ReviewableMistake[];
  readonly onClose: () => void;
  readonly isFirstSession?: boolean;
  readonly onStartDrill?: () => void;
}

function ProgressDiffSection({ diff }: { readonly diff: SkillProgressDiff }) {
  const beforePct = Math.round(diff.masteryBefore * 100);
  const afterPct = Math.round(diff.masteryAfter * 100);
  const delta = afterPct - beforePct;
  const tierChanged = diff.tierAfter > diff.tierBefore;

  let framing: string;
  if (delta > 0) {
    framing = `+${delta}%`;
  } else if (delta === 0) {
    framing = "Solid practice!";
  } else {
    framing = "Tough session, but every attempt builds strength!";
  }

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-4 space-y-3">
      <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
        Your Progress on {diff.skillName}
      </h4>

      {/* Layered progress bar */}
      <div className="relative h-4 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        {/* Before mastery (gray underlay) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-surface-300 dark:bg-surface-600"
          style={{ width: `${beforePct}%` }}
        />
        {/* After mastery (green overlay) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-success-500 dark:bg-success-400 transition-all duration-700"
          style={{ width: `${afterPct}%` }}
        />
      </div>

      {/* Percentage text */}
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-surface-600 dark:text-surface-400">
          {beforePct}% &rarr; {afterPct}%
        </span>
        <span
          className={
            delta > 0
              ? "font-semibold text-success-600 dark:text-success-400"
              : "text-surface-500 dark:text-surface-400"
          }
        >
          {framing}
        </span>
      </div>

      {/* Tier transition label */}
      {tierChanged && (
        <div className="text-xs font-medium text-brand-600 dark:text-brand-400">
          {MASTERY_TIER_LABELS[diff.tierBefore]} &rarr; {MASTERY_TIER_LABELS[diff.tierAfter]}
        </div>
      )}
    </div>
  );
}

export function SessionSummary({ data, mistakes, onClose, isFirstSession = false, onStartDrill }: SessionSummaryProps) {
  const skillNames = data.skillsCovered.map(
    (id) => getSkillById(id)?.name ?? id
  );

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-6 space-y-5 animate-scale-in">
      <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100">
        {isFirstSession ? "Your First Lesson — Complete!" : "Great job! Session Complete"}
      </h3>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 p-3">
          <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">{data.questionsAnswered}</div>
          <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">Questions</div>
        </div>
        <div className="rounded-xl bg-success-50 dark:bg-success-500/10 p-3">
          <div className="text-2xl font-bold text-success-600 dark:text-success-400">{data.accuracy}%</div>
          <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">Accuracy</div>
        </div>
        <div className="rounded-xl bg-streak-50 dark:bg-streak-500/10 p-3">
          <div className="text-2xl font-bold text-streak-600 dark:text-streak-400">{data.elapsedMinutes}m</div>
          <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">Duration</div>
        </div>
      </div>

      {data.progressDiff && <ProgressDiffSection diff={data.progressDiff} />}

      <div>
        <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Skills Covered</h4>
        <div className="flex flex-wrap gap-2">
          {skillNames.map((name) => (
            <span
              key={name}
              className="inline-block rounded-full bg-surface-100 dark:bg-surface-800 px-3 py-1 text-xs font-medium text-surface-700 dark:text-surface-300"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{data.tutorMessage}</p>

      {mistakes && mistakes.length > 0 && <MistakeReviewList mistakes={mistakes} />}

      {/* Next up recommendation — hidden for first session */}
      {!isFirstSession && data.nextSkill && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/20 p-4">
          <p className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-1.5">
            Up Next
          </p>
          <a
            href={data.nextSkill.route}
            className="flex items-center justify-between text-sm font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 transition-colors"
          >
            {data.nextSkill.skillName}
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      )}

      {!isFirstSession && <NextTaskPrompt />}

      {!isFirstSession && onStartDrill && (
        <button
          onClick={onStartDrill}
          className="w-full rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-4 py-2.5 text-center transition-colors hover:bg-brand-100 dark:hover:bg-brand-900/30"
        >
          <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">Speed Round</span>
          <span className="block text-xs text-brand-600/70 dark:text-brand-400/70 mt-0.5">2-min rapid-fire practice</span>
        </button>
      )}

      <button
        onClick={onClose}
        className={isFirstSession
          ? "w-full rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          : "w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-center text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        }
      >
        {isFirstSession ? "Go to Dashboard" : "Practice More"}
      </button>
    </div>
  );
}
