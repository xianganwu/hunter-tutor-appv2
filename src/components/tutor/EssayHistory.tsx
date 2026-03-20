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

function getRevisionLabel(essay: StoredEssay): string | null {
  if (essay.revisionNumber === 0) return null;
  return `Revision ${essay.revisionNumber}`;
}

interface EssayGroup {
  original: StoredEssay;
  revisions: StoredEssay[];
}

function groupByRevisionChain(essays: readonly StoredEssay[]): EssayGroup[] {
  const groups: EssayGroup[] = [];
  const originals = essays.filter((e) => !e.revisionOf);
  const revisionMap = new Map<string, StoredEssay[]>();

  for (const e of essays) {
    if (e.revisionOf) {
      const list = revisionMap.get(e.revisionOf) ?? [];
      list.push(e);
      revisionMap.set(e.revisionOf, list);
    }
  }

  for (const orig of originals) {
    groups.push({
      original: orig,
      revisions: revisionMap.get(orig.id) ?? [],
    });
  }

  // Include orphan revisions (where original is not in the list)
  for (const e of essays) {
    if (e.revisionOf && !originals.some((o) => o.id === e.revisionOf)) {
      if (!groups.some((g) => g.revisions.includes(e))) {
        groups.push({ original: e, revisions: [] });
      }
    }
  }

  return groups;
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

      {groupByRevisionChain([...essays].reverse()).map((group) => {
        const allInChain = [group.original, ...group.revisions];
        const scoreTrend = allInChain.map((e) => avgScore(e));

        return (
          <div
            key={group.original.id}
            className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 overflow-hidden"
          >
            {allInChain.map((essay, idx) => {
              const expanded = expandedId === essay.id;
              const avg = avgScore(essay);
              const isRevision = idx > 0;

              return (
                <div key={essay.id} className={isRevision ? "border-t border-surface-100 dark:border-surface-800" : ""}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : essay.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors ${isRevision ? "pl-8" : ""}`}
                  >
                    <div>
                      <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                        {isRevision ? `Revision ${essay.revisionNumber}` : essay.promptText.slice(0, 60) + "..."}
                      </div>
                      <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-1.5">
                        <span>{formatDate(essay.createdAt)} · {essay.wordCount} words</span>
                        {!isRevision && group.revisions.length > 0 && (
                          <span className="rounded bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 text-[10px] font-medium text-surface-500">
                            Original
                          </span>
                        )}
                        {getRevisionLabel(essay) && (
                          <span className="rounded bg-brand-100 dark:bg-brand-600/20 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:text-brand-400">
                            {getRevisionLabel(essay)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          avg >= 7
                            ? "text-success-500 dark:text-success-400"
                            : avg >= 5
                              ? "text-streak-500 dark:text-streak-400"
                              : "text-red-500 dark:text-red-400"
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
                    <div className={`px-4 pb-4 space-y-3 border-t border-surface-100 dark:border-surface-800 pt-3 ${isRevision ? "pl-8" : ""}`}>
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
                        <summary className="text-xs text-brand-600 dark:text-brand-400 cursor-pointer">
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

            {/* Score trend for revision chains */}
            {scoreTrend.length > 1 && (
              <div className="px-4 py-2 border-t border-surface-100 dark:border-surface-800 text-xs text-surface-500 flex items-center gap-1">
                <span className="font-medium">Score trend:</span>
                {scoreTrend.map((s, i) => (
                  <span key={i}>
                    {i > 0 && <span className={s > scoreTrend[i - 1] ? "text-success-500 dark:text-success-400" : s < scoreTrend[i - 1] ? "text-red-500 dark:text-red-400" : ""}> → </span>}
                    <span className="font-medium">{s}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
