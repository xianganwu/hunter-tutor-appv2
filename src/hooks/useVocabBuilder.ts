"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { VocabCard, VocabDeck } from "@/lib/vocabulary";
import {
  loadVocabDeck,
  saveVocabDeck,
  getDueCards,
  getNewCards,
  computeNextReview,
  addWordToDeck,
  removeWordFromDeck,
  computeVocabStats,
} from "@/lib/vocabulary";
import { getRandomWords, getAllWords } from "@/lib/exam/vocabulary";
import type { VocabWord } from "@/lib/vocabulary";

// ─── Types ────────────────────────────────────────────────────────────

export type VocabPhase =
  | "deck_overview"
  | "studying"
  | "card_front"
  | "card_back"
  | "use_word"
  | "session_complete";

interface SessionStats {
  readonly reviewed: number;
  readonly correct: number;
  readonly newLearned: number;
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
}

// ─── Constants ────────────────────────────────────────────────────────

const MAX_NEW_CARDS_PER_SESSION = 10;
const SUGGESTED_WORDS_COUNT = 6;

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

  const rateCard = useCallback((quality: 1 | 2 | 4 | 5) => {
    const s = stateRef.current;
    if (!s.currentCard) return;

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
      }));
    } else {
      setState((prev) => ({
        ...prev,
        phase: "session_complete",
        deck: newDeck,
        currentCard: null,
        sessionStats: newStats,
        useWordInput: "",
        useWordFeedback: null,
        useWordCorrect: null,
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
    }));
  }, []);

  // ─── Computed values ─────────────────────────────────────────────

  const stats = computeVocabStats(state.deck);
  const dueCount = stats.dueNow;
  const newCount = state.deck.cards.filter((c) => c.repetitions === 0).length;
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
    addRandomWords,
    backToOverview,
  };
}
