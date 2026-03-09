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
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
      <h3 className="text-lg font-semibold">Session Complete</h3>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 p-3">
          <div className="text-2xl font-bold text-blue-600">{data.questionsAnswered}</div>
          <div className="text-xs text-gray-500 mt-1">Questions</div>
        </div>
        <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-3">
          <div className="text-2xl font-bold text-green-600">{data.accuracy}%</div>
          <div className="text-xs text-gray-500 mt-1">Accuracy</div>
        </div>
        <div className="rounded-lg bg-purple-50 dark:bg-purple-900/30 p-3">
          <div className="text-2xl font-bold text-purple-600">{data.elapsedMinutes}m</div>
          <div className="text-xs text-gray-500 mt-1">Duration</div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Skills Covered</h4>
        <div className="flex flex-wrap gap-2">
          {skillNames.map((name) => (
            <span
              key={name}
              className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">{data.tutorMessage}</p>

      <div className="flex gap-3">
        <a
          href="/dashboard"
          className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-2.5 text-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Back to Dashboard
        </a>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Practice More
        </button>
      </div>
    </div>
  );
}
