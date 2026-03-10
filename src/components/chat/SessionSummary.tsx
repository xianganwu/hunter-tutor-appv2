"use client";

import type { SessionSummaryData } from "@/components/tutor/types";
import { getSkillById } from "@/lib/exam/curriculum";

interface SessionSummaryProps {
  readonly data: SessionSummaryData;
  readonly onClose: () => void;
}

export function SessionSummary({ data, onClose }: SessionSummaryProps) {
  const skillNames = data.skillsCovered.map(
    (id) => getSkillById(id)?.name ?? id
  );

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-6 space-y-5 animate-scale-in">
      <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100">
        Great job! Session Complete
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

      {/* Next up recommendation */}
      {data.nextSkill && (
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

      <div className="flex gap-3">
        <a
          href="/dashboard"
          className="flex-1 rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-center text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          Back to Dashboard
        </a>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Practice More
        </button>
      </div>
    </div>
  );
}
