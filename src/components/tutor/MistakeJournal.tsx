"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadMistakes,
  getDueForReview,
  analyzePatternsBySkill,
  analyzePatternsByCategory,
  CATEGORY_LABELS,
} from "@/lib/mistakes";
import type { MistakeEntry, MistakeCategory } from "@/lib/mistakes";

interface MistakeJournalProps {
  readonly onStartReview: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysUntilReview(nextReview: string): number {
  const diff = new Date(nextReview).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

const CATEGORY_COLORS: Record<MistakeCategory, string> = {
  conceptual_gap: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  careless_error: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  misread_question: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export function MistakeJournal({ onStartReview }: MistakeJournalProps) {
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<MistakeCategory | "all">("all");

  useEffect(() => {
    setMistakes(loadMistakes());
  }, []);

  const dueCount = getDueForReview(mistakes).length;
  const skillPatterns = analyzePatternsBySkill(mistakes);
  const categoryBreakdown = analyzePatternsByCategory(mistakes);

  const filtered =
    filterCategory === "all"
      ? mistakes
      : mistakes.filter((m) => m.diagnosis.category === filterCategory);

  const requestAnalysis = useCallback(async () => {
    if (mistakes.length < 3 || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "analyze_patterns",
          mistakes: mistakes.map((m) => ({
            skillName: m.skillName,
            questionText: m.questionText.slice(0, 100),
            diagnosis: {
              category: m.diagnosis.category,
              explanation: m.diagnosis.explanation,
            },
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.analysis ?? null);
      }
    } catch {
      /* ignore */
    }
    setIsAnalyzing(false);
  }, [mistakes, isAnalyzing]);

  if (mistakes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">&#128214;</div>
        <h3 className="text-lg font-semibold mb-1">No mistakes yet</h3>
        <p className="text-sm text-gray-500">
          Start a tutoring session — any wrong answers will appear here with
          analysis of what went wrong.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Review CTA */}
      {dueCount > 0 && (
        <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {dueCount} mistake{dueCount !== 1 ? "s" : ""} ready for review
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Reviewing past mistakes is one of the best ways to improve!
            </div>
          </div>
          <button
            onClick={onStartReview}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mistake Types
          </h4>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterCategory("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterCategory === "all"
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              All ({mistakes.length})
            </button>
            {categoryBreakdown.map((cat) => (
              <button
                key={cat.category}
                onClick={() =>
                  setFilterCategory(
                    filterCategory === cat.category ? "all" : cat.category
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterCategory === cat.category
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : CATEGORY_COLORS[cat.category]
                }`}
              >
                {cat.label} ({cat.count} · {cat.percentage}%)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skill patterns */}
      {skillPatterns.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Patterns by Skill
          </h4>
          <div className="space-y-1.5">
            {skillPatterns.slice(0, 5).map((pattern) => (
              <div
                key={pattern.skillId}
                className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {pattern.description}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                  {pattern.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI analysis */}
      {mistakes.length >= 3 && (
        <div>
          {aiAnalysis ? (
            <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4">
              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-2">
                AI Pattern Analysis
              </h4>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {aiAnalysis}
              </div>
            </div>
          ) : (
            <button
              onClick={() => void requestAnalysis()}
              disabled={isAnalyzing}
              className="w-full rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-50 transition-colors"
            >
              {isAnalyzing ? "Analyzing..." : "Get AI Pattern Analysis"}
            </button>
          )}
        </div>
      )}

      {/* Mistake list */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          All Mistakes ({filtered.length})
        </h4>
        <div className="space-y-2">
          {[...filtered].reverse().map((mistake) => {
            const expanded = expandedId === mistake.id;
            const reviewDays = daysUntilReview(mistake.nextReviewAt);

            return (
              <div
                key={mistake.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId(expanded ? null : mistake.id)
                  }
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {mistake.questionText.slice(0, 80)}
                      {mistake.questionText.length > 80 ? "..." : ""}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {mistake.skillName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(mistake.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[mistake.diagnosis.category]}`}
                    >
                      {CATEGORY_LABELS[mistake.diagnosis.category]}
                    </span>
                    {reviewDays === 0 && (
                      <span className="w-2 h-2 rounded-full bg-blue-500" title="Due for review" />
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3 text-sm">
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">
                        Question
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">
                        {mistake.questionText}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-medium text-red-500 mb-1">
                          Your answer
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">
                          {mistake.studentAnswer}
                        </p>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-green-500 mb-1">
                          Correct answer
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">
                          {mistake.correctAnswer}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                      <div className="text-xs font-medium text-gray-400 mb-1">
                        Why you got it wrong
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">
                        {mistake.diagnosis.explanation}
                      </p>
                    </div>

                    <div className="text-xs text-gray-500">
                      {reviewDays === 0
                        ? "Due for review now"
                        : `Next review in ${reviewDays} day${reviewDays !== 1 ? "s" : ""}`}
                      {" · "}
                      Reviewed {mistake.reviewCount} time
                      {mistake.reviewCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
