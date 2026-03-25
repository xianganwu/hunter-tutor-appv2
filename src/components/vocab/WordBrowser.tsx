"use client";

import { useState, useMemo } from "react";
import type { VocabCard, WordStatus } from "@/lib/vocabulary";
import { getWordStatus } from "@/lib/vocabulary";
import { PronounceButton } from "@/components/vocab/PronounceButton";

// ─── Types ────────────────────────────────────────────────────────────

type FilterOption = "all" | WordStatus;
type SortOption = "alpha" | "status" | "difficulty" | "next_review";

interface WordBrowserProps {
  readonly cards: readonly VocabCard[];
  readonly onRemoveWord: (wordId: string) => void;
  readonly onUnretireWord: (wordId: string) => void;
  readonly onBack: () => void;
}

// ─── Status Config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  WordStatus,
  { readonly label: string; readonly dotClass: string; readonly order: number }
> = {
  new: {
    label: "New",
    dotClass: "bg-brand-400",
    order: 0,
  },
  due: {
    label: "Due",
    dotClass: "bg-streak-500",
    order: 1,
  },
  learning: {
    label: "Learning",
    dotClass: "bg-brand-500",
    order: 2,
  },
  mastered: {
    label: "Mastered",
    dotClass: "bg-success-500",
    order: 3,
  },
  retired: {
    label: "Retired",
    dotClass: "bg-surface-400",
    order: 4,
  },
};

const FILTER_OPTIONS: readonly FilterOption[] = [
  "all",
  "new",
  "due",
  "learning",
  "mastered",
  "retired",
];

// ─── Helpers ──────────────────────────────────────────────────────────

function formatNextReview(card: VocabCard): string {
  if (card.retired) return "Retired";
  if (card.repetitions === 0) return "Not studied";
  const now = Date.now();
  const diff = card.nextReviewDate - now;
  if (diff <= 0) return "Due now";
  const days = Math.ceil(diff / 86_400_000);
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 30) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

function sortCards(
  cards: readonly VocabCard[],
  sort: SortOption
): readonly VocabCard[] {
  const sorted = [...cards];
  switch (sort) {
    case "alpha":
      return sorted.sort((a, b) =>
        a.word.word.localeCompare(b.word.word)
      );
    case "status":
      return sorted.sort(
        (a, b) =>
          STATUS_CONFIG[getWordStatus(a)].order -
          STATUS_CONFIG[getWordStatus(b)].order
      );
    case "difficulty":
      return sorted.sort(
        (a, b) => a.word.difficulty - b.word.difficulty
      );
    case "next_review":
      return sorted.sort(
        (a, b) => a.nextReviewDate - b.nextReviewDate
      );
  }
}

// ─── Component ────────────────────────────────────────────────────────

export function WordBrowser({ cards, onRemoveWord, onUnretireWord, onBack }: WordBrowserProps) {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sort, setSort] = useState<SortOption>("alpha");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Compute status counts
  const statusCounts = useMemo(() => {
    const counts: Record<FilterOption, number> = {
      all: cards.length,
      new: 0,
      due: 0,
      learning: 0,
      mastered: 0,
      retired: 0,
    };
    for (const card of cards) {
      counts[getWordStatus(card)]++;
    }
    return counts;
  }, [cards]);

  // Filter, search, sort
  const displayedCards = useMemo(() => {
    let result = cards;

    // Filter by status
    if (filter !== "all") {
      result = result.filter((c) => getWordStatus(c) === filter);
    }

    // Search by word text
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.word.word.toLowerCase().includes(q) ||
          c.word.definition.toLowerCase().includes(q)
      );
    }

    return sortCards(result, sort);
  }, [cards, filter, search, sort]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M13 16l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          My Words ({cards.length})
        </h2>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search words..."
        className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-4 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = filter === opt;
          const label = opt === "all" ? "All" : STATUS_CONFIG[opt].label;
          const count = statusCounts[opt];
          return (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex justify-end">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-2 py-1 text-xs text-surface-600 dark:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="alpha">A-Z</option>
          <option value="status">Status</option>
          <option value="difficulty">Difficulty</option>
          <option value="next_review">Next Review</option>
        </select>
      </div>

      {/* Word list */}
      {displayedCards.length === 0 ? (
        <div className="py-8 text-center text-sm text-surface-400">
          {search.trim() ? "No words match your search." : "No words in this category."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayedCards.map((card) => {
            const status = getWordStatus(card);
            const config = STATUS_CONFIG[status];
            const isExpanded = expandedId === card.word.wordId;

            return (
              <div
                key={card.word.wordId}
                className={`rounded-xl border bg-surface-0 dark:bg-surface-900 shadow-soft overflow-hidden transition-colors ${
                  status === "retired"
                    ? "border-l-2 border-l-surface-400 border-surface-200 dark:border-surface-700 opacity-70"
                    : status === "mastered"
                      ? "border-l-2 border-l-success-400 border-surface-200 dark:border-surface-700"
                      : "border-surface-200 dark:border-surface-700"
                }`}
              >
                {/* Row */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : card.word.wordId)
                  }
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                >
                  {/* Status dot */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotClass}`}
                    title={config.label}
                  />

                  {/* Word + POS */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {card.word.word}
                    </span>
                    <span className="ml-1.5 text-xs text-surface-400 italic">
                      {card.word.partOfSpeech}
                    </span>
                  </div>

                  {/* Difficulty + Next review */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <DifficultyDots difficulty={card.word.difficulty} />
                    <span className="text-xs text-surface-400 hidden sm:inline">
                      {formatNextReview(card)}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="none"
                      className={`text-surface-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    >
                      <path
                        d="M6 8l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-surface-100 dark:border-surface-800 animate-fade-in space-y-3">
                    <div className="flex items-center gap-2">
                      <PronounceButton word={card.word.word} />
                      <span
                        className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                          status === "new"
                            ? "bg-brand-100 dark:bg-brand-600/20 text-brand-600 dark:text-brand-400"
                            : status === "due"
                              ? "bg-streak-100 dark:bg-streak-600/20 text-streak-600 dark:text-streak-400"
                              : status === "mastered"
                                ? "bg-success-100 dark:bg-success-600/20 text-success-600 dark:text-success-400"
                                : status === "retired"
                                  ? "bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400"
                                  : "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                        }`}
                      >
                        {config.label}
                      </span>
                      <span className="text-xs text-surface-400 sm:hidden">
                        {formatNextReview(card)}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
                        {card.word.definition}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400 italic mt-2 leading-relaxed">
                        &ldquo;{card.word.exampleSentence}&rdquo;
                      </p>
                    </div>

                    {/* SM-2 stats */}
                    {card.repetitions > 0 && (
                      <div className="grid grid-cols-3 gap-2 text-xs text-surface-400">
                        <div>
                          <span className="block font-medium text-surface-600 dark:text-surface-300">
                            {card.repetitions}
                          </span>
                          Reviews
                        </div>
                        <div>
                          <span className="block font-medium text-surface-600 dark:text-surface-300">
                            {card.interval}d
                          </span>
                          Interval
                        </div>
                        <div>
                          <span className="block font-medium text-surface-600 dark:text-surface-300">
                            {card.easeFactor.toFixed(1)}
                          </span>
                          Ease
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {status === "retired" ? (
                      <button
                        onClick={() => onUnretireWord(card.word.wordId)}
                        className="text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
                      >
                        Bring back for study
                      </button>
                    ) : confirmRemoveId === card.word.wordId ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-500">
                          Remove this word?
                        </span>
                        <button
                          onClick={() => {
                            onRemoveWord(card.word.wordId);
                            setConfirmRemoveId(null);
                            setExpandedId(null);
                          }}
                          className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded-lg bg-surface-200 dark:bg-surface-700 px-3 py-1 text-xs font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setConfirmRemoveId(card.word.wordId)
                        }
                        className="text-xs text-red-400 hover:text-red-500 transition-colors"
                      >
                        Remove from deck
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────

function DifficultyDots({ difficulty }: { readonly difficulty: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Difficulty ${difficulty} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < difficulty
              ? difficulty <= 2
                ? "bg-success-400"
                : difficulty <= 3
                  ? "bg-streak-400"
                  : "bg-red-400"
              : "bg-surface-200 dark:bg-surface-600"
          }`}
        />
      ))}
    </div>
  );
}
