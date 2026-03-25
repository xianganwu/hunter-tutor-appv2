import { describe, it, expect } from "vitest";
import type { VocabCard, VocabDeck } from "./vocabulary";
import {
  getWordStatus,
  getDueCards,
  getNewCards,
  retireWord,
  unretireWord,
  MATCH_STREAK_TO_RETIRE,
} from "./vocabulary";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeCard(overrides: Partial<VocabCard> = {}): VocabCard {
  return {
    word: {
      wordId: "test-word",
      word: "abundant",
      definition: "existing in large amounts",
      partOfSpeech: "adjective",
      exampleSentence: "The garden had abundant flowers.",
      difficulty: 2,
    },
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: 0,
    repetitions: 0,
    lastResult: 0,
    ...overrides,
  };
}

function makeDeck(cards: VocabCard[]): VocabDeck {
  return {
    cards,
    wordsLearned: 0,
    totalReviews: 0,
    lastStudied: null,
  };
}

// ─── getWordStatus ────────────────────────────────────────────────────

describe("getWordStatus", () => {
  it("returns 'new' for never-studied cards", () => {
    expect(getWordStatus(makeCard({ repetitions: 0 }))).toBe("new");
  });

  it("returns 'retired' when card is retired, regardless of other fields", () => {
    expect(
      getWordStatus(
        makeCard({ retired: true, repetitions: 5, interval: 30 })
      )
    ).toBe("retired");
  });

  it("returns 'mastered' when interval >= 21", () => {
    expect(
      getWordStatus(
        makeCard({
          repetitions: 5,
          interval: 21,
          nextReviewDate: Date.now() + 86_400_000 * 21,
        })
      )
    ).toBe("mastered");
  });

  it("returns 'due' when review date has passed", () => {
    expect(
      getWordStatus(
        makeCard({
          repetitions: 2,
          interval: 6,
          nextReviewDate: Date.now() - 1000,
        })
      )
    ).toBe("due");
  });

  it("returns 'learning' when studied but not yet due and not mastered", () => {
    expect(
      getWordStatus(
        makeCard({
          repetitions: 1,
          interval: 1,
          nextReviewDate: Date.now() + 86_400_000,
        })
      )
    ).toBe("learning");
  });

  it("retired takes precedence over new", () => {
    expect(
      getWordStatus(makeCard({ retired: true, repetitions: 0 }))
    ).toBe("retired");
  });
});

// ─── getDueCards ──────────────────────────────────────────────────────

describe("getDueCards", () => {
  it("excludes retired cards", () => {
    const deck = makeDeck([
      makeCard({
        word: { ...makeCard().word, wordId: "a" },
        repetitions: 2,
        nextReviewDate: Date.now() - 1000,
      }),
      makeCard({
        word: { ...makeCard().word, wordId: "b" },
        repetitions: 2,
        nextReviewDate: Date.now() - 1000,
        retired: true,
      }),
    ]);
    const due = getDueCards(deck);
    expect(due).toHaveLength(1);
    expect(due[0].word.wordId).toBe("a");
  });

  it("returns empty for all-retired deck", () => {
    const deck = makeDeck([
      makeCard({
        repetitions: 2,
        nextReviewDate: Date.now() - 1000,
        retired: true,
      }),
    ]);
    expect(getDueCards(deck)).toHaveLength(0);
  });
});

// ─── getNewCards ──────────────────────────────────────────────────────

describe("getNewCards", () => {
  it("excludes retired cards", () => {
    const deck = makeDeck([
      makeCard({
        word: { ...makeCard().word, wordId: "a" },
        repetitions: 0,
      }),
      makeCard({
        word: { ...makeCard().word, wordId: "b" },
        repetitions: 0,
        retired: true,
      }),
    ]);
    const newCards = getNewCards(deck, 10);
    expect(newCards).toHaveLength(1);
    expect(newCards[0].word.wordId).toBe("a");
  });
});

// ─── retireWord ───────────────────────────────────────────────────────

describe("retireWord", () => {
  it("sets retired flag on the specified card", () => {
    const deck = makeDeck([
      makeCard({ word: { ...makeCard().word, wordId: "a" } }),
      makeCard({ word: { ...makeCard().word, wordId: "b" } }),
    ]);
    const updated = retireWord(deck, "a");
    expect(updated.cards[0].retired).toBe(true);
    expect(updated.cards[1].retired).toBeUndefined();
  });

  it("does not modify other cards", () => {
    const deck = makeDeck([
      makeCard({ word: { ...makeCard().word, wordId: "a" }, matchCorrectStreak: 3 }),
      makeCard({ word: { ...makeCard().word, wordId: "b" }, matchCorrectStreak: 1 }),
    ]);
    const updated = retireWord(deck, "a");
    expect(updated.cards[1].matchCorrectStreak).toBe(1);
  });
});

// ─── unretireWord ─────────────────────────────────────────────────────

describe("unretireWord", () => {
  it("clears retired flag and resets matchCorrectStreak", () => {
    const deck = makeDeck([
      makeCard({
        word: { ...makeCard().word, wordId: "a" },
        retired: true,
        matchCorrectStreak: 3,
      }),
    ]);
    const updated = unretireWord(deck, "a");
    expect(updated.cards[0].retired).toBe(false);
    expect(updated.cards[0].matchCorrectStreak).toBe(0);
  });

  it("does not modify other cards", () => {
    const deck = makeDeck([
      makeCard({
        word: { ...makeCard().word, wordId: "a" },
        retired: true,
      }),
      makeCard({
        word: { ...makeCard().word, wordId: "b" },
        retired: true,
      }),
    ]);
    const updated = unretireWord(deck, "a");
    expect(updated.cards[0].retired).toBe(false);
    expect(updated.cards[1].retired).toBe(true);
  });
});

// ─── MATCH_STREAK_TO_RETIRE constant ─────────────────────────────────

describe("MATCH_STREAK_TO_RETIRE", () => {
  it("is 3", () => {
    expect(MATCH_STREAK_TO_RETIRE).toBe(3);
  });
});
