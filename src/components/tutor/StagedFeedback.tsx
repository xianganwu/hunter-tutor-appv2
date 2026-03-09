"use client";

import { useState, useCallback } from "react";
import type { EssayFeedback } from "@/lib/ai/tutor-agent";
import type { FeedbackStage, WritingApiResponse } from "./writing-types";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

interface StagedFeedbackProps {
  readonly feedback: EssayFeedback;
  readonly essayText: string;
  readonly onComplete: () => void;
}

function getFirstParagraph(text: string): string {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  return paragraphs[0]?.trim() ?? text.slice(0, 200);
}

export function StagedFeedback({
  feedback,
  essayText,
  onComplete,
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
    <div className="space-y-4">
      {/* Scores overview */}
      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ["Organization", feedback.scores.organization],
            ["Clarity", feedback.scores.clarity],
            ["Evidence", feedback.scores.evidence],
            ["Grammar", feedback.scores.grammar],
          ] as const
        ).map(([label, score]) => (
          <div
            key={label}
            className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center"
          >
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {score}/10
            </div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Stage 1: Praise */}
      <div className="rounded-xl border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
        <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
          What you did really well
        </h4>
        <ul className="space-y-1.5">
          {feedback.strengths.map((s, i) => (
            <li
              key={i}
              className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
            >
              <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Stage 2: Improvement (revealed after clicking Continue) */}
      {stage >= 2 && (
        <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
            One thing to strengthen
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {improvement}
          </p>
          {feedback.improvements.length > 1 && (
            <details className="mt-3">
              <summary className="text-xs text-amber-600 cursor-pointer">
                More suggestions
              </summary>
              <ul className="mt-2 space-y-1.5">
                {feedback.improvements.slice(1).map((s, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-600 dark:text-gray-400"
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
        <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">
            Rewrite challenge
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Try rewriting just your introduction with the suggestion above in
            mind.
          </p>

          <div className="rounded-lg bg-white dark:bg-gray-900 p-3 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-400 mb-1">
              Your original introduction:
            </div>
            {originalIntro}
          </div>

          {!rewriteFeedback && (
            <>
              {isLoading ? (
                <TypingIndicator />
              ) : (
                <ChatInput
                  onSend={handleRewriteSubmit}
                  disabled={isLoading}
                  placeholder="Rewrite your introduction here..."
                />
              )}
            </>
          )}

          {rewriteFeedback && (
            <div className="space-y-3">
              <div className="rounded-lg bg-white dark:bg-gray-900 p-3 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-blue-500 mb-1">
                  Your rewrite:
                </div>
                {rewrittenIntro}
              </div>
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/40 p-3 text-sm text-gray-700 dark:text-gray-300">
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
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {stage === 1 ? "See what to improve" : "Try the rewrite challenge"}
          </button>
        )}
        {(stage === 3 && rewriteFeedback) && (
          <button
            onClick={onComplete}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Finish
          </button>
        )}
        {stage === 3 && !rewriteFeedback && (
          <button
            onClick={onComplete}
            className="rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
