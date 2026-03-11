import type { VocabWord } from "@/lib/vocabulary";
import foundationsWords from "../../../content/vocabulary/foundations.json";
import hunterPrepWords from "../../../content/vocabulary/hunter_prep.json";

// ─── All words, typed ────────────────────────────────────────────────

const allWords: readonly VocabWord[] = [
  ...(foundationsWords as unknown as VocabWord[]),
  ...(hunterPrepWords as unknown as VocabWord[]),
];

const wordMap = new Map<string, VocabWord>(
  allWords.map((w) => [w.wordId, w])
);

// ─── Public API ──────────────────────────────────────────────────────

/** Returns every vocabulary word across both levels. */
export function getAllWords(): readonly VocabWord[] {
  return allWords;
}

/** Returns foundations-level words only (difficulty 1-3). */
export function getFoundationsWords(): readonly VocabWord[] {
  return foundationsWords as unknown as VocabWord[];
}

/** Returns hunter-prep-level words only (difficulty 3-5). */
export function getHunterPrepWords(): readonly VocabWord[] {
  return hunterPrepWords as unknown as VocabWord[];
}

/** Filters words by a specific difficulty level (1-5). */
export function getWordsByDifficulty(
  level: 1 | 2 | 3 | 4 | 5
): readonly VocabWord[] {
  return allWords.filter((w) => w.difficulty === level);
}

/** Filters words by part of speech (e.g. "noun", "verb", "adjective"). */
export function getWordsByPartOfSpeech(pos: string): readonly VocabWord[] {
  return allWords.filter(
    (w) => w.partOfSpeech.toLowerCase() === pos.toLowerCase()
  );
}

/** Returns `count` random words, optionally filtered by difficulty. */
export function getRandomWords(
  count: number,
  difficulty?: 1 | 2 | 3 | 4 | 5
): readonly VocabWord[] {
  const pool = difficulty
    ? allWords.filter((w) => w.difficulty === difficulty)
    : allWords;

  // Fisher-Yates shuffle on a copy, then take first `count`
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

/** Looks up a single word by its wordId. */
export function getWordById(wordId: string): VocabWord | undefined {
  return wordMap.get(wordId);
}

/** Returns the total count of available vocabulary words. */
export function getWordCount(): number {
  return allWords.length;
}
