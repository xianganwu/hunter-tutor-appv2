"use client";

import { useState, useCallback, useEffect } from "react";
import {
  loadMistakes,
  getDueForReview,
  recordReviewResult,
  CATEGORY_LABELS,
} from "@/lib/mistakes";
import type { MistakeEntry } from "@/lib/mistakes";

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
        <p className="text-sm text-gray-500 mb-4">
          All your mistakes are either reviewed or not yet due. Check back later!
        </p>
        <button
          onClick={onComplete}
          className="rounded-xl bg-gray-100 dark:bg-gray-800 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
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
      <div className="text-center py-12 space-y-6">
        <h3 className="text-xl font-semibold">Review Complete!</h3>
        <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 p-3">
            <div className="text-2xl font-bold text-blue-600">
              {results.total}
            </div>
            <div className="text-xs text-gray-500">Reviewed</div>
          </div>
          <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-3">
            <div className="text-2xl font-bold text-green-600">
              {results.correct}
            </div>
            <div className="text-xs text-gray-500">Correct</div>
          </div>
          <div className="rounded-lg bg-purple-50 dark:bg-purple-900/30 p-3">
            <div className="text-2xl font-bold text-purple-600">
              {accuracy}%
            </div>
            <div className="text-xs text-gray-500">Accuracy</div>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {accuracy >= 80
            ? "Excellent! You're really learning from your mistakes!"
            : accuracy >= 50
              ? "Good effort! The ones you missed will come back for review soon."
              : "Keep at it! Reviewing mistakes is how we grow stronger."}
        </p>
        <button
          onClick={onComplete}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
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
        <span className="text-xs text-gray-500">
          Question {currentIndex + 1} of {queue.length}
        </span>
        <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / queue.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Skill badge */}
      <div className="text-xs text-gray-500">
        Skill: <span className="font-medium">{current.skillName}</span>
      </div>

      {/* Question */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
          {current.questionText}
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
            "w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500";

          if (showResult) {
            if (isCorrectChoice) {
              classes +=
                " border-green-400 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300";
            } else if (isSelected && !isCorrect) {
              classes +=
                " border-red-400 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300";
            } else {
              classes +=
                " border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 opacity-60";
            }
          } else {
            classes +=
              " border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-700 hover:border-blue-400";
          }

          return (
            <button
              key={choice}
              onClick={() => handleSelect(letter)}
              disabled={showResult}
              className={classes}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {/* Result + diagnosis */}
      {showResult && (
        <div className="space-y-3">
          <div
            className={`rounded-xl p-4 ${
              isCorrect
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            }`}
          >
            <div
              className={`text-sm font-semibold mb-1 ${
                isCorrect
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {isCorrect ? "Correct! You've learned from this mistake." : "Not quite — let's review why."}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {current.diagnosis.explanation}
            </p>
            <div className="mt-2 text-xs text-gray-500">
              Original mistake type:{" "}
              <span className="font-medium">
                {CATEGORY_LABELS[current.diagnosis.category]}
              </span>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {currentIndex + 1 < queue.length ? "Next Question" : "See Results"}
          </button>
        </div>
      )}
    </div>
  );
}
