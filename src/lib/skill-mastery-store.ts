import type { AttemptRecord, ConfidenceTrend } from "./adaptive";
import { getStorageKey, notifyProgressChanged } from "./user-profile";

// ─── Types ────────────────────────────────────────────────────────────

export interface StoredSkillMastery {
  readonly skillId: string;
  readonly masteryLevel: number; // 0.0 - 1.0
  readonly attemptsCount: number;
  readonly correctCount: number;
  readonly lastPracticed: string; // ISO
  readonly confidenceTrend: ConfidenceTrend;
  // SM-2 spaced repetition fields (optional for backward compat)
  readonly interval?: number; // days until next review
  readonly easeFactor?: number; // SM-2 ease factor (min 1.3, default 2.5)
  readonly nextReviewDate?: number; // epoch ms — when this skill is due for retention check
  readonly repetitions?: number; // consecutive successful reviews
}

// ─── Storage ──────────────────────────────────────────────────────────

const STORAGE_KEY = "hunter-tutor-skill-mastery";

export function loadAllSkillMasteries(): StoredSkillMastery[] {
  try {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
    if (!data) return [];
    return JSON.parse(data) as StoredSkillMastery[];
  } catch {
    return [];
  }
}

function saveAll(entries: readonly StoredSkillMastery[]): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(entries));
    notifyProgressChanged("skill-mastery");
  } catch {
    // localStorage unavailable
  }
}

export function loadSkillMastery(skillId: string): StoredSkillMastery | null {
  return loadAllSkillMasteries().find((e) => e.skillId === skillId) ?? null;
}

// ─── SM-2 Spaced Repetition ──────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Map session accuracy (0-1) to SM-2 quality rating (0-5).
 */
function accuracyToQuality(accuracy: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (accuracy >= 0.9) return 5;
  if (accuracy >= 0.75) return 4;
  if (accuracy >= 0.6) return 3;
  if (accuracy >= 0.4) return 2;
  if (accuracy >= 0.2) return 1;
  return 0;
}

/**
 * Compute updated SM-2 scheduling fields after a practice session.
 * Uses the same algorithm as the vocab system (vocabulary.ts).
 */
export function computeSkillReviewSchedule(
  existing: StoredSkillMastery,
  sessionAccuracy: number,
): Pick<StoredSkillMastery, "interval" | "easeFactor" | "nextReviewDate" | "repetitions"> {
  const quality = accuracyToQuality(sessionAccuracy);
  let ef = existing.easeFactor ?? DEFAULT_EASE_FACTOR;
  let interval = existing.interval ?? 0;
  let reps = existing.repetitions ?? 0;

  // SM-2 ease factor update
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(MIN_EASE_FACTOR, ef);

  if (quality < 3) {
    // Failed — reset repetitions, review again tomorrow
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) {
      interval = 1;
    } else if (reps === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
  }

  return {
    interval,
    easeFactor: Math.round(ef * 100) / 100,
    nextReviewDate: Date.now() + interval * MS_PER_DAY,
    repetitions: reps,
  };
}

/**
 * Get skills that are due for a retention check.
 * Only returns skills the student has actually learned (mastery >= 0.5)
 * and that have a scheduled review date in the past.
 */
export function getSkillsDueForReview(): StoredSkillMastery[] {
  const all = loadAllSkillMasteries();
  const now = Date.now();

  return all
    .filter((s) =>
      s.masteryLevel >= 0.5 &&
      s.nextReviewDate !== undefined &&
      s.nextReviewDate > 0 &&
      s.nextReviewDate <= now
    )
    .sort((a, b) => (a.nextReviewDate ?? 0) - (b.nextReviewDate ?? 0));
}

export function saveSkillMastery(data: StoredSkillMastery): void {
  const all = loadAllSkillMasteries();
  const idx = all.findIndex((e) => e.skillId === data.skillId);
  if (idx >= 0) {
    all[idx] = data;
  } else {
    all.push(data);
  }
  saveAll(all);
}

// ─── Reading Attempt Rolling Window ──────────────────────────────────
//
// Reading passages produce 1 attempt per skill per passage (unlike math
// which produces 5-15 per session). We store the last 10 attempts per
// skill so calculateMasteryUpdate has enough data to produce meaningful
// mastery levels.

const READING_ATTEMPTS_KEY = "hunter-tutor-reading-attempts";
const MAX_READING_WINDOW = 10;

type ReadingAttemptStore = Record<string, AttemptRecord[]>;

export function loadReadingAttemptWindow(skillId: string): AttemptRecord[] {
  try {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(getStorageKey(READING_ATTEMPTS_KEY));
    if (!data) return [];
    const store = JSON.parse(data) as ReadingAttemptStore;
    return store[skillId] ?? [];
  } catch {
    return [];
  }
}

export function saveReadingAttemptWindow(
  skillId: string,
  attempts: readonly AttemptRecord[],
): void {
  try {
    if (typeof window === "undefined") return;
    const key = getStorageKey(READING_ATTEMPTS_KEY);
    const raw = localStorage.getItem(key);
    const store: ReadingAttemptStore = raw ? (JSON.parse(raw) as ReadingAttemptStore) : {};
    store[skillId] = attempts.slice(-MAX_READING_WINDOW) as AttemptRecord[];
    localStorage.setItem(key, JSON.stringify(store));
    notifyProgressChanged("reading-attempts");
  } catch {
    // localStorage unavailable
  }
}
