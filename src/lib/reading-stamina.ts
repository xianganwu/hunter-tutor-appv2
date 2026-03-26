import type { DifficultyLevel, Passage } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────

export interface StaminaLevel {
  readonly level: number;
  readonly label: string;
  readonly minWords: number;
  readonly maxWords: number;
}

export interface ReadingRecord {
  readonly passageId: string;
  readonly passageTitle: string;
  readonly wordCount: number;
  readonly readingTimeSeconds: number;
  readonly wpm: number;
  readonly staminaLevel: number;
  readonly questionsCorrect: number;
  readonly questionsTotal: number;
  readonly timestamp: number; // epoch ms
}

export interface StaminaProgress {
  readonly currentLevel: number;
  readonly records: readonly ReadingRecord[];
  readonly completedPassageIds: readonly string[];
}

// ─── Constants ────────────────────────────────────────────────────────

import { getStorageKey, notifyProgressChanged } from "./user-profile";

const STORAGE_KEY = "hunter-tutor-reading-stamina";

export const STAMINA_LEVELS: readonly StaminaLevel[] = [
  { level: 1, label: "Warm-Up", minWords: 200, maxWords: 300 },
  { level: 2, label: "Building", minWords: 300, maxWords: 400 },
  { level: 3, label: "Steady", minWords: 400, maxWords: 500 },
  { level: 4, label: "Strong", minWords: 500, maxWords: 600 },
  { level: 5, label: "Advanced", minWords: 600, maxWords: 750 },
  { level: 6, label: "Marathon", minWords: 750, maxWords: 850 },
];

/** Minimum WPM to count as a "good" reading at current level */
export const MIN_ACCEPTABLE_WPM = 120;

/** Number of solid readings needed to advance to next level */
const PASSAGES_TO_ADVANCE = 2;

/** WPM drop percentage threshold that triggers intervention */
export const SPEED_DROP_THRESHOLD = 0.20;

/** Minimum passages needed to detect a meaningful speed drop */
const MIN_RECORDS_FOR_DROP = 3;

// ─── Core Functions ───────────────────────────────────────────────────

export function computeWPM(wordCount: number, readingTimeSeconds: number): number {
  if (readingTimeSeconds <= 0) return 0;
  return Math.round(wordCount / (readingTimeSeconds / 60));
}

/**
 * Check if the student's speed has dropped compared to their recent average.
 * Returns the drop ratio (e.g., 0.25 means 25% slower) or null if no drop.
 */
export function detectSpeedDrop(records: readonly ReadingRecord[]): number | null {
  if (records.length < MIN_RECORDS_FOR_DROP) return null;

  const latest = records[records.length - 1];
  // Average WPM of the previous readings (excluding the latest)
  const previous = records.slice(-6, -1); // last 5 before current
  if (previous.length < 2) return null;

  const avgWpm = previous.reduce((sum, r) => sum + r.wpm, 0) / previous.length;
  if (avgWpm <= 0) return null;

  const dropRatio = (avgWpm - latest.wpm) / avgWpm;
  return dropRatio >= SPEED_DROP_THRESHOLD ? dropRatio : null;
}

/**
 * Determine if the student should advance to the next stamina level.
 * Requires PASSAGES_TO_ADVANCE readings at current level with acceptable WPM.
 */
export function shouldAdvanceLevel(
  currentLevel: number,
  records: readonly ReadingRecord[]
): boolean {
  if (currentLevel >= STAMINA_LEVELS.length) return false;

  const atLevel = records.filter((r) => r.staminaLevel === currentLevel);
  const goodReadings = atLevel.filter((r) => r.wpm >= MIN_ACCEPTABLE_WPM);
  return goodReadings.length >= PASSAGES_TO_ADVANCE;
}

/**
 * Get the StaminaLevel config for a given level number.
 */
export function getStaminaLevel(level: number): StaminaLevel {
  const idx = Math.max(0, Math.min(level - 1, STAMINA_LEVELS.length - 1));
  return STAMINA_LEVELS[idx];
}

/**
 * Select a passage from the library that fits the current stamina level.
 * Prefers genre diversity — avoids repeating the same genre as recent readings.
 * Returns null if no suitable passage is available (AI generation needed).
 */
export function selectPassageForLevel(
  level: number,
  completedIds: readonly string[],
  passages: readonly Passage[],
  recentRecords?: readonly ReadingRecord[]
): Passage | null {
  const config = getStaminaLevel(level);
  const completedSet = new Set(completedIds);

  // Find passages in the right word count range that haven't been completed
  const candidates = passages.filter((p) => {
    if (completedSet.has(p.metadata.passage_id)) return false;
    const wc = p.metadata.word_count;
    // Allow some flexibility: accept passages within ±50 words of the range
    return wc >= config.minWords - 50 && wc <= config.maxWords + 50;
  });

  if (candidates.length === 0) return null;

  // Build a set of recently seen genres (last 3 readings) to prefer diversity
  const recentGenres = new Set<string>();
  if (recentRecords && recentRecords.length > 0) {
    const recent = recentRecords.slice(-3);
    for (const r of recent) {
      const p = passages.find((p) => p.metadata.passage_id === r.passageId);
      if (p) recentGenres.add(p.metadata.genre);
    }
  }

  // Prefer passages closer to the target range midpoint
  const targetMid = (config.minWords + config.maxWords) / 2;

  // Sort: first by genre diversity (unseen genres first), then by word count proximity
  candidates.sort((a, b) => {
    const aSeenGenre = recentGenres.has(a.metadata.genre) ? 1 : 0;
    const bSeenGenre = recentGenres.has(b.metadata.genre) ? 1 : 0;
    if (aSeenGenre !== bSeenGenre) return aSeenGenre - bSeenGenre;
    return (
      Math.abs(a.metadata.word_count - targetMid) -
      Math.abs(b.metadata.word_count - targetMid)
    );
  });

  return candidates[0];
}

/**
 * Compute a summary of the student's reading stamina progress.
 */
export function computeStaminaStats(records: readonly ReadingRecord[]) {
  if (records.length === 0) {
    return { averageWpm: 0, bestWpm: 0, totalPassages: 0, totalWordsRead: 0 };
  }

  const totalWpm = records.reduce((sum, r) => sum + r.wpm, 0);
  return {
    averageWpm: Math.round(totalWpm / records.length),
    bestWpm: Math.max(...records.map((r) => r.wpm)),
    totalPassages: records.length,
    totalWordsRead: records.reduce((sum, r) => sum + r.wordCount, 0),
  };
}

// ─── Storage ──────────────────────────────────────────────────────────

export function loadStaminaProgress(): StaminaProgress {
  if (typeof window === "undefined") {
    return { currentLevel: 1, records: [], completedPassageIds: [] };
  }
  const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
  if (!data) {
    return { currentLevel: 1, records: [], completedPassageIds: [] };
  }
  try {
    return JSON.parse(data) as StaminaProgress;
  } catch {
    return { currentLevel: 1, records: [], completedPassageIds: [] };
  }
}

export function saveStaminaProgress(progress: StaminaProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(progress));
  notifyProgressChanged("reading-stamina");
}

/**
 * Compute updated stamina progress after a reading (pure function).
 * Returns the updated progress and whether level advanced.
 * Caller is responsible for persisting via saveStaminaProgress().
 */
export function recordReading(
  progress: StaminaProgress,
  record: ReadingRecord
): { progress: StaminaProgress; advanced: boolean } {
  const newRecords = [...progress.records, record];
  const newCompleted = [...progress.completedPassageIds, record.passageId];

  let newLevel = progress.currentLevel;
  let advanced = false;

  if (shouldAdvanceLevel(progress.currentLevel, newRecords)) {
    newLevel = Math.min(progress.currentLevel + 1, STAMINA_LEVELS.length);
    advanced = true;
  }

  const updated: StaminaProgress = {
    currentLevel: newLevel,
    records: newRecords,
    completedPassageIds: newCompleted,
  };

  return { progress: updated, advanced };
}

// ─── Skill Mastery Helpers ───────────────────────────────────────────

/**
 * Map stamina level (1-6) to a DifficultyLevel (1-5) for mastery calculation.
 */
export function staminaLevelToTier(staminaLevel: number): DifficultyLevel {
  if (staminaLevel <= 1) return 1;
  if (staminaLevel <= 2) return 2;
  if (staminaLevel <= 3) return 3;
  if (staminaLevel <= 5) return 4;
  return 5; // level 6+
}

/** Human-readable names for reading comprehension skill IDs. */
export const RC_SKILL_NAMES: Readonly<Record<string, string>> = {
  rc_main_idea: "Main Idea",
  rc_supporting_details: "Supporting Details",
  rc_evidence_reasoning: "Evidence & Reasoning",
  rc_inference: "Inference",
  rc_vocab_context: "Vocabulary in Context",
  rc_drawing_conclusions: "Drawing Conclusions",
  rc_author_purpose: "Author's Purpose",
  rc_tone_mood: "Tone & Mood",
  rc_figurative_language: "Figurative Language",
  rc_passage_structure: "Passage Structure",
  rc_advanced_inference: "Advanced Inference",
  rc_advanced_structure: "Advanced Structure",
  rc_comparing_viewpoints: "Comparing Viewpoints",
  rc_advanced_vocab: "Advanced Vocabulary",
  rc_general: "Reading Comprehension",
};
