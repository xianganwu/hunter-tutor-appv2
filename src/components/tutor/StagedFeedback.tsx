"use client";

import { useState, useCallback } from "react";
import type { EssayFeedback } from "@/lib/ai/tutor-agent";
import type { FeedbackStage, WritingApiResponse } from "./writing-types";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

interface StagedFeedbackProps {
  readonly feedback: EssayFeedback;
  readonly essayText: string;
  readonly onComplete: () => void;
  readonly onRevise?: () => void;
}

function getFirstParagraph(text: string): string {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  return paragraphs[0]?.trim() ?? text.slice(0, 200);
}

export function StagedFeedback({
  feedback,
  essayText,
  onComplete,
  onRevise,
}: StagedFeedbackProps) {
  const [stage, setStage] = useState<FeedbackStage>(1);
  const [rewrittenIntro, setRewrittenIntro] = useState("");
  const [rewriteFeedback, setRewriteFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const improvement =
    feedback.improvements.length > 0
      ? feedback.improvements[0]
      : "Try adding more specific details to strengthen your writing.";

  const originalIntro = getFirstParagraph(essayText);

  const handleRewriteSubmit = useCallback(
    async (text: string) => {
      setRewrittenIntro(text);
      setIsLoading(true);
      try {
        const res = await fetch("/api/writing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "rewrite_feedback",
            originalIntro,
            rewrittenIntro: text,
            suggestion: improvement,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as WritingApiResponse;
          setRewriteFeedback(data.text);
        } else {
          setRewriteFeedback(
            "Great effort on your rewrite! Every revision makes your writing stronger."
          );
        }
      } catch {
        setRewriteFeedback(
          "Great effort on your rewrite! Every revision makes your writing stronger."
        );
      }
      setIsLoading(false);
    },
    [originalIntro, improvement]
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Scores overview */}
      {(() => {
        const scoreEntries: [string, number][] = [
          ["Organization", feedback.scores.organization],
          ["Clarity", feedback.scores.clarity],
          ["Evidence", feedback.scores.evidence],
          ["Grammar", feedback.scores.grammar],
          ["Voice", feedback.scores.voice ?? 5],
          ["Ideas", feedback.scores.ideas ?? 5],
        ];
        const hasExtended = true;
        return (
      <div className={`grid gap-2 ${hasExtended ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
        {scoreEntries.map(([label, score]) => (
          <div
            key={label}
            className="rounded-2xl bg-surface-50 dark:bg-surface-800 p-3 text-center shadow-soft"
          >
            <div className="text-lg font-bold text-surface-900 dark:text-surface-100">
              {score}/10
            </div>
            <div className="text-xs text-surface-500">{label}</div>
          </div>
        ))}
      </div>
        );
      })()}

      {/* Stage 1: Praise */}
      <div className="rounded-2xl border-2 border-success-200 dark:border-success-600/30 bg-success-50 dark:bg-success-500/10 p-4">
        <h4 className="text-sm font-semibold text-success-600 dark:text-success-400 mb-2">
          What you did really well
        </h4>
        <ul className="space-y-1.5">
          {feedback.strengths.map((s, i) => (
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

      {/* Stage 2: Improvement (revealed after clicking Continue) */}
      {stage >= 2 && (
        <div className="rounded-2xl border-2 border-streak-200 dark:border-streak-600/30 bg-streak-50 dark:bg-streak-500/10 p-4 animate-slide-up">
          <h4 className="text-sm font-semibold text-streak-600 dark:text-streak-400 mb-2">
            One thing to strengthen
          </h4>
          <p className="text-sm text-surface-700 dark:text-surface-300">
            {improvement}
          </p>
          {feedback.improvements.length > 1 && (
            <details className="mt-3">
              <summary className="text-xs text-streak-600 cursor-pointer">
                More suggestions
              </summary>
              <ul className="mt-2 space-y-1.5">
                {feedback.improvements.slice(1).map((s, i) => (
                  <li
                    key={i}
                    className="text-sm text-surface-600 dark:text-surface-400"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Stage 3: Rewrite exercise */}
      {stage >= 3 && (
        <div className="rounded-2xl border-2 border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-600/10 p-4 space-y-3 animate-slide-up">
          <h4 className="text-sm font-semibold text-brand-700 dark:text-brand-400">
            Rewrite challenge
          </h4>
          <p className="text-sm text-surface-700 dark:text-surface-300">
            Try rewriting just your introduction with the suggestion above in
            mind.
          </p>

          <div className="rounded-xl bg-surface-0 dark:bg-surface-900 p-3 text-sm text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700">
            <div className="text-xs font-medium text-surface-400 mb-1">
              Your original introduction:
            </div>
            {originalIntro}
          </div>

          {!rewriteFeedback && (
            <>
              {isLoading ? (
                <TypingIndicator />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = rewrittenIntro.trim();
                    if (trimmed) handleRewriteSubmit(trimmed);
                  }}
                  className="space-y-2"
                >
                  <textarea
                    value={rewrittenIntro}
                    onChange={(e) => setRewrittenIntro(e.target.value)}
                    disabled={isLoading}
                    placeholder="Rewrite your introduction here..."
                    rows={12}
                    className="w-full rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 px-5 py-4 text-base leading-relaxed text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 transition-colors resize-y min-h-[280px]"
                    aria-label="Rewrite your introduction"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isLoading || !rewrittenIntro.trim()}
                      className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 transition-colors"
                    >
                      Submit Rewrite
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {rewriteFeedback && (
            <div className="space-y-3">
              <div className="rounded-xl bg-surface-0 dark:bg-surface-900 p-3 text-sm text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700">
                <div className="text-xs font-medium text-brand-500 mb-1">
                  Your rewrite:
                </div>
                {rewrittenIntro}
              </div>
              <div className="rounded-xl bg-brand-100 dark:bg-brand-600/20 p-3 text-sm text-surface-700 dark:text-surface-300">
                {rewriteFeedback}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3">
        {stage < 3 && (
          <button
            onClick={() => setStage((s) => (s + 1) as FeedbackStage)}
            className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            {stage === 1 ? "See what to improve" : "Try the rewrite challenge"}
          </button>
        )}
        {(stage === 3 && rewriteFeedback) && (
          <>
            {onRevise && (
              <button
                onClick={onRevise}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Revise Full Essay
              </button>
            )}
            <button
              onClick={onComplete}
              className={`${onRevise ? "" : "flex-1 "}rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors`}
            >
              Finish
            </button>
          </>
        )}
        {stage === 3 && !rewriteFeedback && (
          <button
            onClick={onComplete}
            className="rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
