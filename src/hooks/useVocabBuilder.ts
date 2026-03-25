"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { VocabCard, VocabDeck, VocabWord } from "@/lib/vocabulary";
import {
  loadVocabDeck,
  saveVocabDeck,
  getDueCards,
  getNewCards,
  computeNextReview,
  addWordToDeck,
  removeWordFromDeck,
  unretireWord,
  computeVocabStats,
  MATCH_STREAK_TO_RETIRE,
} from "@/lib/vocabulary";
import { autoCompleteDailyTask } from "@/lib/daily-plan";
import { getRandomWords, getAllWords } from "@/lib/exam/vocabulary";

// ─── Types ────────────────────────────────────────────────────────────

export type VocabPhase =
  | "deck_overview"
  | "studying"
  | "card_front"
  | "card_back"
  | "use_word"
  | "session_complete"
  | "word_browser"
  | "matching_quiz"
  | "matching_complete";

interface SessionStats {
  readonly reviewed: number;
  readonly correct: number;
  readonly newLearned: number;
}

export interface MatchingState {
  readonly words: readonly VocabCard[];
  readonly shuffledDefIds: readonly string[];
  readonly matchedPairs: readonly string[];
  readonly selectedWordId: string | null;
  readonly wrongDefId: string | null;
  readonly round: number;
  readonly totalRounds: number;
  readonly totalCorrect: number;
  readonly totalAttempts: number;
  readonly firstTryIds: ReadonlySet<string>;
  readonly recentlyRetiredWord: string | null; // word text for celebration
}

export interface VocabBuilderState {
  readonly phase: VocabPhase;
  readonly deck: VocabDeck;
  readonly studyQueue: readonly VocabCard[];
  readonly currentCardIndex: number;
  readonly currentCard: VocabCard | null;
  readonly sessionStats: SessionStats;
  readonly useWordInput: string;
  readonly useWordFeedback: string | null;
  readonly useWordCorrect: boolean | null;
  readonly useWordLoading: boolean;
  readonly suggestedWords: readonly VocabWord[];
  readonly pendingRating: (1 | 2 | 4 | 5) | null;
  readonly matching: MatchingState | null;
  readonly contextSentences: readonly string[] | null;
  readonly contextLoading: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────

const MAX_NEW_CARDS_PER_SESSION = 10;
const SUGGESTED_WORDS_COUNT = 6;

// ─── Helpers ─────────────────────────────────────────────────────────

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Select cards for a matching round, prioritizing struggling words. Excludes retired. */
function buildMatchingRound(
  allCards: readonly VocabCard[],
  excludeIds: readonly string[],
  count: number
): { words: VocabCard[]; shuffledDefIds: string[] } | null {
  const excluded = new Set(excludeIds);
  // Always exclude retired cards
  const eligible = allCards.filter((c) => !c.retired);
  const candidates = eligible.filter((c) => !excluded.has(c.word.wordId));
  if (candidates.length < count) {
    // If not enough unused cards, allow reuse from eligible (non-retired)
    const fallback = eligible.length >= count ? eligible : null;
    if (!fallback) return null;
    const picked = shuffle(fallback as VocabCard[]).slice(0, count);
    return {
      words: picked,
      shuffledDefIds: shuffle(picked.map((c) => c.word.wordId)),
    };
  }
  // Prioritize: cards with lastResult < 3 (struggling), then low repetitions
  const sorted = [...candidates].sort((a, b) => {
    if (a.lastResult < 3 && b.lastResult >= 3) return -1;
    if (b.lastResult < 3 && a.lastResult >= 3) return 1;
    return a.repetitions - b.repetitions;
  });
  const picked = sorted.slice(0, count);
  return {
    words: picked,
    shuffledDefIds: shuffle(picked.map((c) => c.word.wordId)),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useVocabBuilder() {
  const [state, setState] = useState<VocabBuilderState>({
    phase: "deck_overview",
    deck: loadVocabDeck(),
    studyQueue: [],
    currentCardIndex: 0,
    currentCard: null,
    sessionStats: { reviewed: 0, correct: 0, newLearned: 0 },
    useWordInput: "",
    useWordFeedback: null,
    useWordCorrect: null,
    useWordLoading: false,
    suggestedWords: [],
    pendingRating: null,
    matching: null,
    contextSentences: null,
    contextLoading: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const initialized = useRef(false);

  // Load deck and suggested words on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const deck = loadVocabDeck();
    const existingIds = new Set(deck.cards.map((c) => c.word.wordId));

    // Get words not yet in the deck for suggestions
    const available = getAllWords().filter((w) => !existingIds.has(w.wordId));
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const suggested = shuffled.slice(0, SUGGESTED_WORDS_COUNT);

    setState((prev) => ({
      ...prev,
      deck,
      suggestedWords: suggested,
    }));
  }, []);

  // ─── Start Study Session ─────────────────────────────────────────

  const startStudy = useCallback(() => {
    const s = stateRef.current;
    const dueCards = [...getDueCards(s.deck)];
    const newCards = [...getNewCards(s.deck, MAX_NEW_CARDS_PER_SESSION)];

    // Due cards first, then new cards
    const queue = [...dueCards, ...newCards];

    if (queue.length === 0) return;

    setState((prev) => ({
      ...prev,
      phase: "card_front",
      studyQueue: queue,
      currentCardIndex: 0,
      currentCard: queue[0],
      sessionStats: { reviewed: 0, correct: 0, newLearned: 0 },
    }));
  }, []);

  // ─── Show Card Back (Flip) ───────────────────────────────────────

  const showDefinition = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phase: "card_back",
    }));
  }, []);

  // ─── "I Know This" — auto-rate as Good (4) ──────────────────────

  const markKnown = useCallback(() => {
    const s = stateRef.current;
    if (!s.currentCard) return;

    const updated = computeNextReview(s.currentCard, 4);
    const isNew = s.currentCard.repetitions === 0;
    advanceCard(updated, true, isNew);
  }, []);

  // ─── Rate Card (SM-2 quality) ────────────────────────────────────
  // For struggling words (Again/Hard), auto-prompt sentence writing

  const rateCard = useCallback((quality: 1 | 2 | 4 | 5) => {
    const s = stateRef.current;
    if (!s.currentCard) return;

    if (quality <= 2) {
      // Auto-prompt: store pending rating, show sentence exercise
      setState((prev) => ({
        ...prev,
        phase: "use_word",
        pendingRating: quality,
        useWordInput: "",
        useWordFeedback: null,
        useWordCorrect: null,
      }));
      return;
    }

    const updated = computeNextReview(s.currentCard, quality);
    const isCorrect = quality >= 3;
    const isNew = s.currentCard.repetitions === 0 && quality >= 3;
    advanceCard(updated, isCorrect, isNew);
  }, []);

  // ─── Helper: Advance to next card ────────────────────────────────

  function advanceCard(
    updatedCard: VocabCard,
    isCorrect: boolean,
    isNewlyLearned: boolean
  ) {
    const s = stateRef.current;
    const newDeck = {
      ...s.deck,
      cards: s.deck.cards.map((c) =>
        c.word.wordId === updatedCard.word.wordId ? updatedCard : c
      ),
      totalReviews: s.deck.totalReviews + 1,
      wordsLearned: s.deck.wordsLearned + (isNewlyLearned ? 1 : 0),
      lastStudied: Date.now(),
    };

    saveVocabDeck(newDeck);

    const newStats = {
      reviewed: s.sessionStats.reviewed + 1,
      correct: s.sessionStats.correct + (isCorrect ? 1 : 0),
      newLearned: s.sessionStats.newLearned + (isNewlyLearned ? 1 : 0),
    };

    const nextIndex = s.currentCardIndex + 1;
    const hasMore = nextIndex < s.studyQueue.length;

    if (hasMore) {
      setState((prev) => ({
        ...prev,
        phase: "card_front",
        deck: newDeck,
        currentCardIndex: nextIndex,
        currentCard: prev.studyQueue[nextIndex],
        sessionStats: newStats,
        useWordInput: "",
        useWordFeedback: null,
        useWordCorrect: null,
        pendingRating: null,
        contextSentences: null,
        contextLoading: false,
      }));
    } else {
      autoCompleteDailyTask(undefined, "vocab_review");
      setState((prev) => ({
        ...prev,
        phase: "session_complete",
        deck: newDeck,
        currentCard: null,
        sessionStats: newStats,
        useWordInput: "",
        useWordFeedback: null,
        useWordCorrect: null,
        pendingRating: null,
        contextSentences: null,
        contextLoading: false,
      }));
    }
  }

  // ─── Use Word (write a sentence) ─────────────────────────────────

  const startUseWord = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phase: "use_word",
      useWordInput: "",
      useWordFeedback: null,
      useWordCorrect: null,
    }));
  }, []);

  const setUseWordInput = useCallback((input: string) => {
    setState((prev) => ({
      ...prev,
      useWordInput: input,
    }));
  }, []);

  const submitSentence = useCallback(async () => {
    const s = stateRef.current;
    if (!s.currentCard || !s.useWordInput.trim()) return;

    setState((prev) => ({ ...prev, useWordLoading: true }));

    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "evaluate_usage",
          word: s.currentCard.word.word,
          definition: s.currentCard.word.definition,
          studentSentence: s.useWordInput.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to evaluate");

      const data = (await res.json()) as {
        correct: boolean;
        feedback: string;
      };

      setState((prev) => ({
        ...prev,
        useWordLoading: false,
        useWordFeedback: data.feedback,
        useWordCorrect: data.correct,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        useWordLoading: false,
        useWordFeedback:
          "Great effort writing that sentence! Keep practicing using this word.",
        useWordCorrect: null,
      }));
    }
  }, []);

  const skipUseWord = useCallback(() => {
    const s = stateRef.current;
    // If we got here from auto-prompt (pendingRating set), advance with that rating
    if (s.pendingRating !== null && s.currentCard) {
      const updated = computeNextReview(s.currentCard, s.pendingRating);
      const isCorrect = s.pendingRating >= 3;
      const isNew = s.currentCard.repetitions === 0 && s.pendingRating >= 3;
      setState((prev) => ({ ...prev, pendingRating: null }));
      advanceCard(updated, isCorrect, isNew);
      return;
    }
    setState((prev) => ({
      ...prev,
      phase: "card_back",
      useWordInput: "",
      useWordFeedback: null,
      useWordCorrect: null,
    }));
  }, []);

  // ─── Add Word to Deck ────────────────────────────────────────────

  const addWord = useCallback((word: VocabWord) => {
    const s = stateRef.current;
    const updatedDeck = addWordToDeck(s.deck, word);
    saveVocabDeck(updatedDeck);

    // Remove from suggestions and add a new one
    const existingIds = new Set(updatedDeck.cards.map((c) => c.word.wordId));
    const available = getAllWords().filter((w) => !existingIds.has(w.wordId));
    const randomExtra =
      available.length > 0
        ? [available[Math.floor(Math.random() * available.length)]]
        : [];

    setState((prev) => ({
      ...prev,
      deck: updatedDeck,
      suggestedWords: [
        ...prev.suggestedWords.filter((w) => w.wordId !== word.wordId),
        ...randomExtra,
      ],
    }));
  }, []);

  // ─── Remove Word from Deck ───────────────────────────────────────

  const removeWord = useCallback((wordId: string) => {
    const s = stateRef.current;
    const updatedDeck = removeWordFromDeck(s.deck, wordId);
    saveVocabDeck(updatedDeck);

    setState((prev) => ({
      ...prev,
      deck: updatedDeck,
    }));
  }, []);

  // ─── Un-retire Word ────────────────────────────────────────────

  const handleUnretire = useCallback((wordId: string) => {
    const s = stateRef.current;
    const updatedDeck = unretireWord(s.deck, wordId);
    saveVocabDeck(updatedDeck);

    setState((prev) => ({
      ...prev,
      deck: updatedDeck,
    }));
  }, []);

  // ─── Add Random Words ────────────────────────────────────────────

  const addRandomWords = useCallback((count: number) => {
    const s = stateRef.current;
    const existingIds = new Set(s.deck.cards.map((c) => c.word.wordId));
    const newWords = getRandomWords(count).filter(
      (w) => !existingIds.has(w.wordId)
    );

    let updatedDeck = s.deck;
    for (const word of newWords) {
      updatedDeck = addWordToDeck(updatedDeck, word);
    }
    saveVocabDeck(updatedDeck);

    // Refresh suggestions
    const allIds = new Set(updatedDeck.cards.map((c) => c.word.wordId));
    const available = getAllWords().filter((w) => !allIds.has(w.wordId));
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setState((prev) => ({
      ...prev,
      deck: updatedDeck,
      suggestedWords: shuffled.slice(0, SUGGESTED_WORDS_COUNT),
    }));
  }, []);

  // ─── Word Browser ───────────────────────────────────────────────

  const openWordBrowser = useCallback(() => {
    setState((prev) => ({ ...prev, phase: "word_browser" }));
  }, []);

  // ─── Matching Quiz ─────────────────────────────────────────────

  const MATCHING_WORDS_PER_ROUND = 5;
  const MATCHING_TOTAL_ROUNDS = 3;

  const startMatchingQuiz = useCallback(() => {
    const s = stateRef.current;
    const eligibleCount = s.deck.cards.filter((c) => !c.retired).length;
    if (eligibleCount < MATCHING_WORDS_PER_ROUND) return;
    const round = buildMatchingRound(s.deck.cards, [], MATCHING_WORDS_PER_ROUND);
    if (!round) return;
    setState((prev) => ({
      ...prev,
      phase: "matching_quiz",
      matching: {
        words: round.words,
        shuffledDefIds: round.shuffledDefIds,
        matchedPairs: [],
        selectedWordId: null,
        wrongDefId: null,
        round: 1,
        totalRounds: Math.min(
          MATCHING_TOTAL_ROUNDS,
          Math.floor(eligibleCount / MATCHING_WORDS_PER_ROUND)
        ),
        totalCorrect: 0,
        totalAttempts: 0,
        firstTryIds: new Set(),
        recentlyRetiredWord: null,
      },
    }));
  }, []);

  const selectMatchWord = useCallback((wordId: string) => {
    setState((prev) => {
      if (!prev.matching) return prev;
      return {
        ...prev,
        matching: {
          ...prev.matching,
          selectedWordId:
            prev.matching.selectedWordId === wordId ? null : wordId,
          wrongDefId: null,
        },
      };
    });
  }, []);

  const selectMatchDefinition = useCallback((defWordId: string) => {
    const s = stateRef.current;
    if (!s.matching || !s.matching.selectedWordId) return;
    if (s.matching.matchedPairs.includes(defWordId)) return;

    const isCorrect = s.matching.selectedWordId === defWordId;
    const wordId = s.matching.selectedWordId;
    const isFirstTry = !s.matching.firstTryIds.has(wordId);

    if (isCorrect) {
      const newMatched = [...s.matching.matchedPairs, defWordId];
      const allMatched = newMatched.length === s.matching.words.length;

      // Update matchCorrectStreak on the card in the deck
      let updatedDeck = s.deck;
      let justRetiredWord: string | null = null;
      if (isFirstTry) {
        const card = s.deck.cards.find((c) => c.word.wordId === wordId);
        if (card) {
          const newStreak = (card.matchCorrectStreak ?? 0) + 1;
          const shouldRetire = newStreak >= MATCH_STREAK_TO_RETIRE;
          updatedDeck = {
            ...s.deck,
            cards: s.deck.cards.map((c) =>
              c.word.wordId === wordId
                ? {
                    ...c,
                    matchCorrectStreak: newStreak,
                    retired: shouldRetire ? true : c.retired,
                  }
                : c
            ),
          };
          if (shouldRetire) {
            justRetiredWord = card.word.word;
          }
          saveVocabDeck(updatedDeck);
        }
      }

      setState((prev) => {
        if (!prev.matching) return prev;
        const newFirstTryIds = new Set(prev.matching.firstTryIds);
        return {
          ...prev,
          deck: updatedDeck,
          matching: {
            ...prev.matching,
            matchedPairs: newMatched,
            selectedWordId: null,
            wrongDefId: null,
            totalAttempts: prev.matching.totalAttempts + 1,
            totalCorrect:
              prev.matching.totalCorrect + (isFirstTry ? 1 : 0),
            firstTryIds: newFirstTryIds,
            recentlyRetiredWord: justRetiredWord,
          },
        };
      });

      // Clear retirement celebration after a delay
      if (justRetiredWord) {
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            matching: prev.matching
              ? { ...prev.matching, recentlyRetiredWord: null }
              : prev.matching,
          }));
        }, 2000);
      }

      // After short delay, check if round is complete
      if (allMatched) {
        setTimeout(() => {
          const current = stateRef.current;
          if (!current.matching) return;
          if (current.matching.round < current.matching.totalRounds) {
            // Next round
            const usedIds = current.matching.words.map((w) => w.word.wordId);
            const round = buildMatchingRound(
              current.deck.cards,
              usedIds,
              MATCHING_WORDS_PER_ROUND
            );
            if (round) {
              setState((prev) => ({
                ...prev,
                matching: prev.matching
                  ? {
                      ...prev.matching,
                      words: round.words,
                      shuffledDefIds: round.shuffledDefIds,
                      matchedPairs: [],
                      selectedWordId: null,
                      wrongDefId: null,
                      round: prev.matching.round + 1,
                      recentlyRetiredWord: null,
                    }
                  : prev.matching,
              }));
            } else {
              finishMatchingQuiz();
            }
          } else {
            finishMatchingQuiz();
          }
        }, 1200);
      }
    } else {
      // Wrong — flash red briefly AND reset matchCorrectStreak for the selected word
      let updatedDeck = s.deck;
      const card = s.deck.cards.find((c) => c.word.wordId === wordId);
      if (card && (card.matchCorrectStreak ?? 0) > 0) {
        updatedDeck = {
          ...s.deck,
          cards: s.deck.cards.map((c) =>
            c.word.wordId === wordId
              ? { ...c, matchCorrectStreak: 0 }
              : c
          ),
        };
        saveVocabDeck(updatedDeck);
      }

      setState((prev) => {
        if (!prev.matching) return prev;
        const newFirstTryIds = new Set(prev.matching.firstTryIds);
        newFirstTryIds.add(wordId);
        return {
          ...prev,
          deck: updatedDeck,
          matching: {
            ...prev.matching,
            wrongDefId: defWordId,
            selectedWordId: null,
            totalAttempts: prev.matching.totalAttempts + 1,
            firstTryIds: newFirstTryIds,
          },
        };
      });
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          matching: prev.matching
            ? { ...prev.matching, wrongDefId: null }
            : prev.matching,
        }));
      }, 600);
    }
  }, []);

  function finishMatchingQuiz() {
    const s = stateRef.current;
    // Update lastStudied
    const newDeck = { ...s.deck, lastStudied: Date.now() };
    saveVocabDeck(newDeck);
    setState((prev) => ({
      ...prev,
      phase: "matching_complete",
      deck: newDeck,
    }));
  }

  // ─── Context Sentences ─────────────────────────────────────────

  const fetchContextSentences = useCallback(async () => {
    const s = stateRef.current;
    if (!s.currentCard || s.contextSentences || s.contextLoading) return;
    setState((prev) => ({ ...prev, contextLoading: true }));
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate_context",
          word: s.currentCard.word.word,
          definition: s.currentCard.word.definition,
          partOfSpeech: s.currentCard.word.partOfSpeech,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { sentences: string[] };
      setState((prev) => ({
        ...prev,
        contextLoading: false,
        contextSentences: data.sentences,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        contextLoading: false,
        contextSentences: [],
      }));
    }
  }, []);

  // ─── Back to Overview ────────────────────────────────────────────

  const backToOverview = useCallback(() => {
    const deck = loadVocabDeck();
    const existingIds = new Set(deck.cards.map((c) => c.word.wordId));
    const available = getAllWords().filter((w) => !existingIds.has(w.wordId));
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setState((prev) => ({
      ...prev,
      phase: "deck_overview",
      deck,
      studyQueue: [],
      currentCardIndex: 0,
      currentCard: null,
      useWordInput: "",
      useWordFeedback: null,
      useWordCorrect: null,
      suggestedWords: shuffled.slice(0, SUGGESTED_WORDS_COUNT),
      pendingRating: null,
      matching: null,
      contextSentences: null,
      contextLoading: false,
    }));
  }, []);

  // ─── Computed values ─────────────────────────────────────────────

  const stats = computeVocabStats(state.deck);
  const dueCount = stats.dueNow;
  const newCount = state.deck.cards.filter((c) => !c.retired && c.repetitions === 0).length;
  const studyAvailable = dueCount + newCount > 0;
  const progress =
    state.studyQueue.length > 0
      ? state.currentCardIndex / state.studyQueue.length
      : 0;

  return {
    state,
    stats,
    dueCount,
    newCount,
    studyAvailable,
    progress,
    startStudy,
    showDefinition,
    markKnown,
    rateCard,
    startUseWord,
    setUseWordInput,
    submitSentence,
    skipUseWord,
    addWord,
    removeWord,
    handleUnretire,
    addRandomWords,
    backToOverview,
    openWordBrowser,
    startMatchingQuiz,
    selectMatchWord,
    selectMatchDefinition,
    fetchContextSentences,
  };
}
