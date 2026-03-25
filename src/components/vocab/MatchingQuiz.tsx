"use client";

import type { MatchingState } from "@/hooks/useVocabBuilder";
import { PronounceButton } from "@/components/vocab/PronounceButton";

interface MatchingQuizProps {
  readonly matching: MatchingState;
  readonly onSelectWord: (wordId: string) => void;
  readonly onSelectDefinition: (defWordId: string) => void;
}

export function MatchingQuiz({
  matching,
  onSelectWord,
  onSelectDefinition,
}: MatchingQuizProps) {
  const allMatched = matching.matchedPairs.length === matching.words.length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Round header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Match the Words
        </h2>
        <span className="text-xs text-surface-400">
          Round {matching.round} of {matching.totalRounds}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center">
        {matching.words.map((card) => (
          <div
            key={card.word.wordId}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              matching.matchedPairs.includes(card.word.wordId)
                ? "bg-success-500"
                : "bg-surface-200 dark:bg-surface-700"
            }`}
          />
        ))}
      </div>

      {/* Instruction */}
      <p className="text-xs text-surface-400 text-center">
        {matching.selectedWordId
          ? "Now tap the matching definition"
          : "Tap a word, then tap its definition"}
      </p>

      {/* Matching board */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Words column */}
        <div className="flex-1 space-y-2">
          <div className="text-xs font-medium text-surface-500 mb-1">
            Words
          </div>
          {matching.words.map((card) => {
            const isMatched = matching.matchedPairs.includes(card.word.wordId);
            const isSelected = matching.selectedWordId === card.word.wordId;

            return (
              <button
                key={card.word.wordId}
                onClick={() =>
                  !isMatched && onSelectWord(card.word.wordId)
                }
                disabled={isMatched}
                className={`w-full flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                  isMatched
                    ? "border-success-300 dark:border-success-600/30 bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400 opacity-60"
                    : isSelected
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-600/10 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/30"
                      : "border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 text-surface-900 dark:text-surface-100 hover:border-brand-300 dark:hover:border-brand-600/50"
                }`}
              >
                {isMatched && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="text-success-500 flex-shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 10l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span className="flex-1">{card.word.word}</span>
                {!isMatched && <PronounceButton word={card.word.word} />}
              </button>
            );
          })}
        </div>

        {/* Definitions column */}
        <div className="flex-1 space-y-2">
          <div className="text-xs font-medium text-surface-500 mb-1">
            Definitions
          </div>
          {matching.shuffledDefIds.map((defId) => {
            const card = matching.words.find(
              (c) => c.word.wordId === defId
            );
            if (!card) return null;
            const isMatched = matching.matchedPairs.includes(defId);
            const isWrong = matching.wrongDefId === defId;

            return (
              <button
                key={defId}
                onClick={() =>
                  !isMatched && onSelectDefinition(defId)
                }
                disabled={isMatched || !matching.selectedWordId}
                className={`w-full rounded-xl border px-4 py-3 text-left text-xs leading-relaxed transition-all ${
                  isMatched
                    ? "border-success-300 dark:border-success-600/30 bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400 opacity-60"
                    : isWrong
                      ? "border-red-300 dark:border-red-600/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 animate-shake"
                      : matching.selectedWordId
                        ? "border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:border-brand-300 dark:hover:border-brand-600/50 cursor-pointer"
                        : "border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 text-surface-700 dark:text-surface-300 opacity-70 cursor-default"
                }`}
              >
                {isMatched && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="text-success-500 inline mr-1.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 10l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {card.word.definition}
              </button>
            );
          })}
        </div>
      </div>

      {/* Round complete overlay */}
      {allMatched && (
        <div className="text-center py-4 animate-fade-in">
          <div className="text-3xl mb-2">
            {matching.round < matching.totalRounds ? "👏" : "🌟"}
          </div>
          <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
            {matching.round < matching.totalRounds
              ? `Round ${matching.round} complete! Next round loading...`
              : "All rounds complete!"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Matching Complete ────────────────────────────────────────────────

interface MatchingCompleteProps {
  readonly matching: MatchingState;
  readonly onBackToDashboard: () => void;
  readonly onPlayAgain: () => void;
}

export function MatchingComplete({
  matching,
  onBackToDashboard,
  onPlayAgain,
}: MatchingCompleteProps) {
  const accuracy =
    matching.totalAttempts > 0
      ? Math.round((matching.totalCorrect / (matching.totalRounds * 5)) * 100)
      : 0;

  return (
    <div className="max-w-md mx-auto py-8 space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="text-4xl mb-3">
          {accuracy >= 90 ? "🌟" : accuracy >= 70 ? "👏" : "💪"}
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
          Matching Complete!
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          {accuracy >= 90
            ? "You really know your words!"
            : accuracy >= 70
              ? "Great matching! Keep reviewing to lock these in."
              : "Good effort! Practice makes perfect."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
            {matching.totalRounds}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">Rounds</div>
        </div>
        <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div className="text-2xl font-bold text-success-500">
            {matching.totalCorrect}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">First Try</div>
        </div>
        <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div
            className={`text-2xl font-bold ${
              accuracy >= 80
                ? "text-success-500"
                : accuracy >= 60
                  ? "text-streak-500"
                  : "text-red-500"
            }`}
          >
            {accuracy}%
          </div>
          <div className="text-xs text-surface-500 mt-0.5">Accuracy</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onPlayAgain}
          className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Play Again
        </button>
        <button
          onClick={onBackToDashboard}
          className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          Back to Overview
        </button>
      </div>
    </div>
  );
}
