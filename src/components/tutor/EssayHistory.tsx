"use client";

import { useState } from "react";
import type { StoredEssay } from "./writing-types";

interface EssayHistoryProps {
  readonly essays: readonly StoredEssay[];
  readonly onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function avgScore(essay: StoredEssay): number {
  const s = essay.feedback.scores;
  return Math.round((s.organization + s.clarity + s.evidence + s.grammar) / 4);
}

export function EssayHistory({ essays, onClose }: EssayHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (essays.length === 0) {
    return (
      <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-6 text-center">
        <p className="text-surface-500">No essays yet. Complete a writing session to see your history!</p>
        <button
          onClick={onClose}
          className="mt-4 rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-200 transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Essays</h3>
        <button
          onClick={onClose}
          className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
        >
          Back to workshop
        </button>
      </div>

      {/* Progress trend */}
      {essays.length >= 2 && (
        <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 p-3 text-sm text-brand-700 dark:text-brand-300">
          You&apos;ve written {essays.length} essays!{" "}
          {avgScore(essays[essays.length - 1]) > avgScore(essays[0])
            ? "Your scores are improving — great progress!"
            : "Keep writing — every essay makes you stronger!"}
        </div>
      )}

      {[...essays].reverse().map((essay) => {
        const expanded = expandedId === essay.id;
        const avg = avgScore(essay);

        return (
          <div
            key={essay.id}
            className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(expanded ? null : essay.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
            >
              <div>
                <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                  {essay.promptText.slice(0, 60)}...
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  {formatDate(essay.createdAt)} · {essay.wordCount} words
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold ${
                    avg >= 7
                      ? "text-success-500"
                      : avg >= 5
                        ? "text-streak-500"
                        : "text-red-500"
                  }`}
                >
                  {avg}/10
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  className={`text-surface-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            {expanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-surface-100 dark:border-surface-800 pt-3">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {(
                    [
                      ["Org", essay.feedback.scores.organization],
                      ["Clarity", essay.feedback.scores.clarity],
                      ["Evidence", essay.feedback.scores.evidence],
                      ["Grammar", essay.feedback.scores.grammar],
                    ] as const
                  ).map(([label, score]) => (
                    <div key={label}>
                      <span className="font-bold">{score}</span>
                      <span className="text-surface-400">/{10}</span>
                      <div className="text-surface-500">{label}</div>
                    </div>
                  ))}
                </div>

                <details>
                  <summary className="text-xs text-brand-600 cursor-pointer">
                    View essay
                  </summary>
                  <div className="mt-2 rounded-xl bg-surface-50 dark:bg-surface-800 p-3 text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap font-serif max-h-48 overflow-y-auto">
                    {essay.essayText}
                  </div>
                </details>

                <div className="text-sm text-surface-600 dark:text-surface-400">
                  <strong>Feedback:</strong> {essay.feedback.overallFeedback}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
