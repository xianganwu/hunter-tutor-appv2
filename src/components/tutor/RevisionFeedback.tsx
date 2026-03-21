"use client";

import type { EssayFeedback } from "@/lib/ai/tutor-agent";

interface ScoreComparison {
  readonly category: string;
  readonly before: number;
  readonly after: number;
}

interface RevisionFeedbackProps {
  readonly originalFeedback: EssayFeedback;
  readonly revisedFeedback: EssayFeedback;
  readonly narrative: string;
}

function ScoreArrow({ before, after }: { readonly before: number; readonly after: number }) {
  const diff = after - before;
  if (diff > 0) {
    return (
      <span className="text-success-500 dark:text-success-400 font-bold">
        +{diff}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="text-red-500 dark:text-red-400 font-bold">
        {diff}
      </span>
    );
  }
  return (
    <span className="text-surface-400 font-medium">
      =
    </span>
  );
}

export function RevisionFeedback({
  originalFeedback,
  revisedFeedback,
  narrative,
}: RevisionFeedbackProps) {
  const comparisons: ScoreComparison[] = [
    {
      category: "Organization",
      before: originalFeedback.scores.organization,
      after: revisedFeedback.scores.organization,
    },
    {
      category: "Ideas",
      before: originalFeedback.scores.developmentOfIdeas,
      after: revisedFeedback.scores.developmentOfIdeas,
    },
    {
      category: "Word Choice",
      before: originalFeedback.scores.wordChoice,
      after: revisedFeedback.scores.wordChoice,
    },
    {
      category: "Sentences",
      before: originalFeedback.scores.sentenceStructure,
      after: revisedFeedback.scores.sentenceStructure,
    },
    {
      category: "Mechanics",
      before: originalFeedback.scores.mechanics,
      after: revisedFeedback.scores.mechanics,
    },
  ];

  // Use comparisons array for averages so both sides use the same denominator
  const avgBefore = comparisons.reduce((a, c) => a + c.before, 0) / comparisons.length;
  const avgAfter = comparisons.reduce((a, c) => a + c.after, 0) / comparisons.length;

  const improved = avgAfter > avgBefore;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Overall improvement banner */}
      <div
        className={`rounded-2xl p-4 text-center ${
          improved
            ? "bg-success-50 dark:bg-success-500/10 border-2 border-success-200 dark:border-success-600/30"
            : "bg-brand-50 dark:bg-brand-600/10 border-2 border-brand-200 dark:border-brand-800"
        }`}
      >
        <div
          className={`text-lg font-bold ${
            improved
              ? "text-success-600 dark:text-success-400"
              : "text-brand-600 dark:text-brand-400"
          }`}
        >
          {improved ? "Score Improved!" : "Keep Revising!"}
        </div>
        <div className="text-sm text-surface-600 dark:text-surface-400 mt-1">
          Average: {avgBefore.toFixed(1)} → {avgAfter.toFixed(1)}
        </div>
      </div>

      {/* Score comparison grid */}
      <div className="grid gap-2 grid-cols-3 sm:grid-cols-5">
        {comparisons.map((c) => (
          <div
            key={c.category}
            className="rounded-2xl bg-surface-50 dark:bg-surface-800 p-3 text-center space-y-1"
          >
            <div className="text-xs text-surface-500">{c.category}</div>
            <div className="flex items-center justify-center gap-1.5 text-sm">
              <span className="text-surface-400">{c.before}</span>
              <span className="text-surface-300">→</span>
              <span className="font-bold text-surface-900 dark:text-surface-100">
                {c.after}
              </span>
            </div>
            <ScoreArrow before={c.before} after={c.after} />
          </div>
        ))}
      </div>

      {/* AI narrative */}
      {narrative && (
        <div className="rounded-2xl bg-brand-50 dark:bg-brand-600/10 p-4">
          <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
            {narrative}
          </p>
        </div>
      )}

      {/* Revised feedback details */}
      <div className="rounded-2xl border-2 border-success-200 dark:border-success-600/30 bg-success-50 dark:bg-success-500/10 p-4">
        <h4 className="text-sm font-semibold text-success-600 dark:text-success-400 mb-2">
          Strengths in your revision
        </h4>
        <ul className="space-y-1.5">
          {revisedFeedback.strengths.map((s, i) => (
            <li
              key={i}
              className="text-sm text-surface-700 dark:text-surface-300 flex items-start gap-2"
            >
              <span className="text-success-500 mt-0.5 flex-shrink-0">+</span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      {revisedFeedback.improvements.length > 0 && (
        <div className="rounded-2xl border-2 border-streak-200 dark:border-streak-600/30 bg-streak-50 dark:bg-streak-500/10 p-4">
          <h4 className="text-sm font-semibold text-streak-600 dark:text-streak-400 mb-2">
            Next time, try...
          </h4>
          <ul className="space-y-1.5">
            {revisedFeedback.improvements.map((s, i) => (
              <li
                key={i}
                className="text-sm text-surface-600 dark:text-surface-400"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
