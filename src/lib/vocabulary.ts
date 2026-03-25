import { getStorageKey, notifyProgressChanged } from "./user-profile";

// ─── Types ────────────────────────────────────────────────────────────

export interface VocabWord {
  readonly wordId: string;
  readonly word: string;
  readonly definition: string;
  readonly partOfSpeech: string;
  readonly exampleSentence: string;
  readonly contextPassageId?: string;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface VocabCard {
  readonly word: VocabWord;
  interval: number; // days until next review
  easeFactor: number; // SM-2 ease factor (min 1.3)
  nextReviewDate: number; // epoch ms
  repetitions: number; // successful consecutive reviews
  lastResult: 0 | 1 | 2 | 3 | 4 | 5; // SM-2 quality rating
  matchCorrectStreak?: number; // consecutive first-try correct matches in quiz
  retired?: boolean; // true = excluded from all study modes
}

export interface VocabDeck {
  readonly cards: VocabCard[];
  readonly wordsLearned: number;
  readonly totalReviews: number;
  readonly lastStudied: number | null; // epoch ms
}

export interface VocabStats {
  readonly totalCards: number;
  readonly dueNow: number;
  readonly learned: number; // interval >= 21 days
  readonly streakDays: number;
}

export type WordStatus = "new" | "due" | "learning" | "mastered" | "retired";

// ─── Constants ────────────────────────────────────────────────────────

const STORAGE_KEY = "hunter-tutor-vocab-deck";
const MIN_EASE_FACTOR = 1.3;
const MS_PER_DAY = 86_400_000;
const LEARNED_INTERVAL_THRESHOLD = 21; // days
export const MATCH_STREAK_TO_RETIRE = 3;

/** Derives the review status of a card from its SM-2 fields. */
export function getWordStatus(card: VocabCard): WordStatus {
  if (card.retired) return "retired";
  if (card.repetitions === 0) return "new";
  if (card.interval >= LEARNED_INTERVAL_THRESHOLD) return "mastered";
  if (card.nextReviewDate <= Date.now()) return "due";
  return "learning";
}

// ─── SM-2 Algorithm ──────────────────────────────────────────────────

/**
 * Computes the next review schedule for a card based on SM-2 algorithm.
 * Quality ratings: 0 = complete blackout, 1 = wrong, 2 = wrong but remembered after seeing answer,
 * 3 = correct but difficult, 4 = correct with some hesitation, 5 = perfect recall.
 */
export function computeNextReview(
  card: VocabCard,
  quality: 0 | 1 | 2 | 3 | 4 | 5
): VocabCard {
  let { interval, easeFactor, repetitions } = card;

  // Update ease factor using SM-2 formula
  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < MIN_EASE_FACTOR) {
    easeFactor = MIN_EASE_FACTOR;
  }

  if (quality < 3) {
    // Failed recall — reset
    repetitions = 0;
    interval = 1;
  } else {
    // Successful recall
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  const nextReviewDate = Date.now() + interval * MS_PER_DAY;

  return {
    ...card,
    interval,
    easeFactor,
    repetitions,
    nextReviewDate,
    lastResult: quality,
  };
}

// ─── Deck Operations ─────────────────────────────────────────────────

/** Returns cards that are due for review (nextReviewDate <= now). Excludes retired. */
export function getDueCards(deck: VocabDeck): readonly VocabCard[] {
  const now = Date.now();
  return deck.cards
    .filter((c) => !c.retired && c.repetitions > 0 && c.nextReviewDate <= now)
    .sort((a, b) => a.nextReviewDate - b.nextReviewDate);
}

/** Returns cards with 0 repetitions (never studied), up to `count`. Excludes retired. */
export function getNewCards(
  deck: VocabDeck,
  count: number
): readonly VocabCard[] {
  return deck.cards.filter((c) => !c.retired && c.repetitions === 0).slice(0, count);
}

/** Adds a VocabWord to the deck as a new card. Returns updated deck. */
export function addWordToDeck(deck: VocabDeck, word: VocabWord): VocabDeck {
  // Don't add duplicates
  if (deck.cards.some((c) => c.word.wordId === word.wordId)) {
    return deck;
  }

  const newCard: VocabCard = {
    word,
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: 0,
    repetitions: 0,
    lastResult: 0,
  };

  return {
    ...deck,
    cards: [...deck.cards, newCard],
  };
}

/** Removes a word from the deck by wordId. Returns updated deck. */
export function removeWordFromDeck(
  deck: VocabDeck,
  wordId: string
): VocabDeck {
  return {
    ...deck,
    cards: deck.cards.filter((c) => c.word.wordId !== wordId),
  };
}

/** Marks a word as retired. Keeps it in the deck but excludes from all study modes. */
export function retireWord(deck: VocabDeck, wordId: string): VocabDeck {
  return {
    ...deck,
    cards: deck.cards.map((c) =>
      c.word.wordId === wordId ? { ...c, retired: true } : c
    ),
  };
}

/** Un-retires a word, resetting its match streak so it can be studied again. */
export function unretireWord(deck: VocabDeck, wordId: string): VocabDeck {
  return {
    ...deck,
    cards: deck.cards.map((c) =>
      c.word.wordId === wordId
        ? { ...c, retired: false, matchCorrectStreak: 0 }
        : c
    ),
  };
}

// ─── Persistence ─────────────────────────────────────────────────────

/** Creates an empty deck. */
function createEmptyDeck(): VocabDeck {
  return {
    cards: [],
    wordsLearned: 0,
    totalReviews: 0,
    lastStudied: null,
  };
}

/** Loads the vocab deck from localStorage. */
export function loadVocabDeck(): VocabDeck {
  try {
    const key = getStorageKey(STORAGE_KEY);
    const data = localStorage.getItem(key);
    if (!data) return createEmptyDeck();
    return JSON.parse(data) as VocabDeck;
  } catch {
    return createEmptyDeck();
  }
}

/** Saves the vocab deck to localStorage and notifies progress changed. */
export function saveVocabDeck(deck: VocabDeck): void {
  try {
    const key = getStorageKey(STORAGE_KEY);
    localStorage.setItem(key, JSON.stringify(deck));
    notifyProgressChanged("vocab-deck");
  } catch {
    // localStorage unavailable
  }
}

// ─── Stats ───────────────────────────────────────────────────────────

/** Computes vocabulary study statistics from the deck. */
export function computeVocabStats(deck: VocabDeck): VocabStats {
  const now = Date.now();

  const totalCards = deck.cards.length;

  const dueNow = deck.cards.filter(
    (c) => !c.retired && c.repetitions > 0 && c.nextReviewDate <= now
  ).length;

  const learned = deck.cards.filter(
    (c) => !c.retired && c.interval >= LEARNED_INTERVAL_THRESHOLD
  ).length;

  // Streak: count consecutive days ending today (or yesterday) that have reviews
  const streakDays = computeStreakDays(deck);

  return { totalCards, dueNow, learned, streakDays };
}

/**
 * Computes the current study streak in days.
 * A streak is maintained if the student studied today or yesterday,
 * counting backwards through consecutive days.
 */
function computeStreakDays(deck: VocabDeck): number {
  if (!deck.lastStudied) return 0;

  const now = Date.now();
  const todayStart = startOfDay(now);
  const lastStudiedDay = startOfDay(deck.lastStudied);

  // If last studied is more than 1 day ago, streak is broken
  if (todayStart - lastStudiedDay > MS_PER_DAY) {
    return 0;
  }

  // Build a set of days the student studied by looking at card review dates
  // We approximate by checking if lastStudied lands on consecutive days
  // For a proper streak, we'd need a study log — but we can infer from card data
  // Simple approach: count from lastStudied backwards using deck totalReviews
  // as a proxy. For now, return 1 if studied today, or build from lastStudied.

  // Collect all review dates from cards that have been reviewed
  const reviewDays = new Set<number>();
  for (const card of deck.cards) {
    if (card.repetitions > 0 && card.nextReviewDate > 0) {
      // The card was last reviewed approximately (nextReviewDate - interval * MS_PER_DAY) ago
      const lastReviewApprox = card.nextReviewDate - card.interval * MS_PER_DAY;
      if (lastReviewApprox > 0) {
        reviewDays.add(startOfDay(lastReviewApprox));
      }
    }
  }

  // Also add the lastStudied date
  if (deck.lastStudied) {
    reviewDays.add(startOfDay(deck.lastStudied));
  }

  // Count consecutive days backwards from today
  let streak = 0;
  let checkDay = todayStart;

  // Allow starting from today or yesterday
  if (!reviewDays.has(checkDay)) {
    checkDay -= MS_PER_DAY;
    if (!reviewDays.has(checkDay)) {
      return 0;
    }
  }

  while (reviewDays.has(checkDay)) {
    streak++;
    checkDay -= MS_PER_DAY;
  }

  return streak;
}

/** Returns the epoch ms of the start of the day (midnight) for a given timestamp. */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
