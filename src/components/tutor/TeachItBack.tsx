"use client";

import { useState, useCallback } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import type { ChatApiResponse } from "./types";
import type { TeachingMomentEvaluation } from "@/lib/teaching-moments";

interface TeachItBackProps {
  readonly skillId: string;
  readonly skillName: string;
  readonly onComplete: (
    explanation: string,
    evaluation: TeachingMomentEvaluation
  ) => void;
  readonly onSkip: () => void;
}

export function TeachItBack({
  skillId,
  skillName,
  onComplete,
  onSkip,
}: TeachItBackProps) {
  const [explanation, setExplanation] = useState("");
  const [evaluation, setEvaluation] = useState<TeachingMomentEvaluation | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [useTextarea, setUseTextarea] = useState(false);

  const handleSubmit = useCallback(
    async (text: string) => {
      setExplanation(text);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "evaluate_teach_back",
            skillId,
            skillName,
            studentExplanation: text,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as ChatApiResponse;
          if (data.teachBackEvaluation) {
            setEvaluation(data.teachBackEvaluation);
          } else {
            setEvaluation({
              completeness: "partial",
              accuracy: "accurate",
              feedback: data.text || "Great explanation! You clearly understand this concept.",
              missingConcepts: [],
            });
          }
        } else {
          setEvaluation({
            completeness: "partial",
            accuracy: "accurate",
            feedback:
              "Nice work explaining that! Teaching others is one of the best ways to learn.",
            missingConcepts: [],
          });
        }
      } catch {
        setEvaluation({
          completeness: "partial",
          accuracy: "accurate",
          feedback:
            "Nice work explaining that! Teaching others is one of the best ways to learn.",
          missingConcepts: [],
        });
      }

      setIsLoading(false);
    },
    [skillId, skillName]
  );

  const handleTextareaSubmit = useCallback(() => {
    if (explanation.trim()) {
      void handleSubmit(explanation.trim());
    }
  }, [explanation, handleSubmit]);

  const completenessColors = {
    complete:
      "bg-success-100 text-success-600 dark:bg-success-500/20 dark:text-success-400",
    partial:
      "bg-streak-100 text-streak-600 dark:bg-streak-500/20 dark:text-streak-400",
    missing_key_concepts:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const completenessLabels = {
    complete: "Complete",
    partial: "Partial",
    missing_key_concepts: "Needs More",
  };

  const accuracyColors = {
    accurate:
      "bg-success-100 text-success-600 dark:bg-success-500/20 dark:text-success-400",
    minor_errors:
      "bg-streak-100 text-streak-600 dark:bg-streak-500/20 dark:text-streak-400",
    misconception:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const accuracyLabels = {
    accurate: "Accurate",
    minor_errors: "Minor Errors",
    misconception: "Needs Review",
  };

  return (
    <div className="rounded-2xl border-2 border-brand-200 dark:border-brand-800 shadow-card bg-brand-50 dark:bg-brand-600/10 p-4 space-y-4 my-3">
      {/* Prompt */}
      <div>
        <div className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-2">
          Teach It Back
        </div>
        <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed">
          You&apos;re really good at <strong>{skillName}</strong> now! Can you
          explain it in your own words, as if you were teaching a friend?
        </p>
      </div>

      {/* Input */}
      {!evaluation && !isLoading && (
        <div className="space-y-2">
          {useTextarea ? (
            <div className="space-y-2">
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder={`Explain "${skillName}" as if teaching a friend...`}
                className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-4 py-3 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[120px] resize-y"
                aria-label="Your explanation"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleTextareaSubmit}
                  disabled={!explanation.trim()}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  Submit Explanation
                </button>
                <button
                  onClick={() => setUseTextarea(false)}
                  className="text-xs text-surface-500 hover:text-surface-700 transition-colors px-2"
                >
                  Use quick input
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <ChatInput
                onSend={handleSubmit}
                disabled={false}
                placeholder={`Explain "${skillName}" in your own words...`}
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setUseTextarea(true)}
                  className="text-xs text-brand-600 hover:text-brand-700 transition-colors"
                >
                  Need more space? Use full editor
                </button>
                <button
                  onClick={onSkip}
                  className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading && <TypingIndicator />}

      {/* Evaluation result */}
      {evaluation && (
        <div className="space-y-3">
          {/* Badges */}
          <div className="flex gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${completenessColors[evaluation.completeness]}`}
            >
              {completenessLabels[evaluation.completeness]}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${accuracyColors[evaluation.accuracy]}`}
            >
              {accuracyLabels[evaluation.accuracy]}
            </span>
          </div>

          {/* Feedback */}
          <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
            {evaluation.feedback}
          </p>

          {/* Missing concepts */}
          {evaluation.missingConcepts.length > 0 && (
            <div className="rounded-xl bg-surface-0 dark:bg-surface-900 p-3 border border-surface-200 dark:border-surface-700">
              <div className="text-xs font-medium text-surface-400 mb-1">
                To make your explanation even stronger, try adding:
              </div>
              <ul className="text-sm text-surface-600 dark:text-surface-400 space-y-0.5">
                {evaluation.missingConcepts.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-brand-500 mt-0.5">+</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => onComplete(explanation, evaluation)}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            {evaluation.completeness === "complete" && evaluation.accuracy === "accurate"
              ? "Awesome! Continue"
              : "Got it! Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
