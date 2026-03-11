"use client";

import { useState, useCallback, useEffect } from "react";
import {
  loadMistakes,
  getDueForReview,
  recordReviewResult,
  CATEGORY_LABELS,
} from "@/lib/mistakes";
import type { MistakeEntry } from "@/lib/mistakes";
import { MathText } from "@/components/chat/MathText";

interface MistakeReviewProps {
  readonly onComplete: () => void;
}

export function MistakeReview({ onComplete }: MistakeReviewProps) {
  const [queue, setQueue] = useState<MistakeEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });

  useEffect(() => {
    const all = loadMistakes();
    const due = getDueForReview(all);
    // Shuffle the queue
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
  }, []);

  const current = queue[currentIndex];
  const isComplete = currentIndex >= queue.length;

  const handleSelect = useCallback(
    (answer: string) => {
      if (showResult || !current) return;
      setSelectedAnswer(answer);
      setShowResult(true);

      const isCorrect =
        answer.trim().toUpperCase() === current.correctAnswer.trim().toUpperCase();
      recordReviewResult(current.id, isCorrect);
      setResults((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
    },
    [showResult, current]
  );

  const handleNext = useCallback(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setCurrentIndex((i) => i + 1);
  }, []);

  if (queue.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold mb-2">No mistakes to review!</h3>
        <p className="text-sm text-surface-500 mb-4">
          All your mistakes are either reviewed or not yet due. Check back later!
        </p>
        <button
          onClick={onComplete}
          className="rounded-xl bg-surface-100 dark:bg-surface-800 px-6 py-2.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 transition-colors"
        >
          Back to Journal
        </button>
      </div>
    );
  }

  if (isComplete) {
    const accuracy =
      results.total > 0
        ? Math.round((results.correct / results.total) * 100)
        : 0;

    return (
      <div className="text-center py-12 space-y-6 animate-slide-up">
        <h3 className="text-xl font-semibold">Review Complete!</h3>
        <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
          <div className="rounded-2xl bg-brand-50 dark:bg-brand-600/10 p-3 shadow-card">
            <div className="text-2xl font-bold text-brand-600">
              {results.total}
            </div>
            <div className="text-xs text-surface-500">Reviewed</div>
          </div>
          <div className="rounded-2xl bg-success-50 dark:bg-success-500/10 p-3 shadow-card">
            <div className="text-2xl font-bold text-success-500">
              {results.correct}
            </div>
            <div className="text-xs text-surface-500">Correct</div>
          </div>
          <div className="rounded-2xl bg-brand-50 dark:bg-brand-600/10 p-3 shadow-card">
            <div className="text-2xl font-bold text-brand-500">
              {accuracy}%
            </div>
            <div className="text-xs text-surface-500">Accuracy</div>
          </div>
        </div>
        <p className="text-sm text-surface-600 dark:text-surface-400">
          {accuracy >= 80
            ? "Excellent! You're really learning from your mistakes!"
            : accuracy >= 50
              ? "Good effort! The ones you missed will come back for review soon."
              : "Keep at it! Reviewing mistakes is how we grow stronger."}
        </p>
        <button
          onClick={onComplete}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Back to Journal
        </button>
      </div>
    );
  }

  const isCorrect =
    selectedAnswer?.trim().toUpperCase() ===
    current.correctAnswer.trim().toUpperCase();

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-500">
          Question {currentIndex + 1} of {queue.length}
        </span>
        <div className="w-32 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / queue.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Skill badge */}
      <div className="text-xs text-surface-500">
        Skill: <span className="font-medium">{current.skillName}</span>
      </div>

      {/* Question */}
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4">
        <p className="text-sm text-surface-900 dark:text-surface-100 leading-relaxed">
          <MathText text={current.questionText} />
        </p>
      </div>

      {/* Choices */}
      <div className="space-y-2" role="group" aria-label="Answer choices">
        {current.answerChoices.map((choice) => {
          const letter = choice.charAt(0).toUpperCase();
          const isSelected = selectedAnswer === letter;
          const isCorrectChoice =
            letter === current.correctAnswer.trim().toUpperCase();

          let classes =
            "w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500";

          if (showResult) {
            if (isCorrectChoice) {
              classes +=
                " border-success-400 bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400";
            } else if (isSelected && !isCorrect) {
              classes +=
                " border-streak-400 bg-streak-50 dark:bg-streak-500/10 text-streak-600 dark:text-streak-400";
            } else {
              classes +=
                " border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-500 opacity-60";
            }
          } else {
            classes +=
              " border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 text-surface-900 dark:text-surface-100 hover:bg-brand-50 dark:hover:bg-surface-700 hover:border-brand-400";
          }

          return (
            <button
              key={choice}
              onClick={() => handleSelect(letter)}
              disabled={showResult}
              className={classes}
            >
              <MathText text={choice} />
            </button>
          );
        })}
      </div>

      {/* Result + diagnosis */}
      {showResult && (
        <div className="space-y-3 animate-slide-up">
          <div
            className={`rounded-2xl p-4 ${
              isCorrect
                ? "bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-600/30"
                : "bg-streak-50 dark:bg-streak-500/10 border border-streak-200 dark:border-streak-600/30"
            }`}
          >
            <div
              className={`text-sm font-semibold mb-1 ${
                isCorrect
                  ? "text-success-600 dark:text-success-400"
                  : "text-streak-600 dark:text-streak-400"
              }`}
            >
              {isCorrect ? "Correct! You've learned from this mistake." : "Not quite — let's review why."}
            </div>
            <p className="text-sm text-surface-700 dark:text-surface-300">
              {current.diagnosis.explanation}
            </p>
            <div className="mt-2 text-xs text-surface-500">
              Original mistake type:{" "}
              <span className="font-medium">
                {CATEGORY_LABELS[current.diagnosis.category]}
              </span>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            {currentIndex + 1 < queue.length ? "Next Question" : "See Results"}
          </button>
        </div>
      )}
    </div>
  );
}
