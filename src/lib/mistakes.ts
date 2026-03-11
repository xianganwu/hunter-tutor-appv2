// ─── Types ────────────────────────────────────────────────────────────

export type MistakeCategory =
  | "conceptual_gap"
  | "careless_error"
  | "misread_question";

export interface MistakeDiagnosis {
  readonly category: MistakeCategory;
  readonly explanation: string;
  readonly relatedSkills: readonly string[];
}

export interface MistakeEntry {
  readonly id: string;
  readonly skillId: string;
  readonly skillName: string;
  readonly questionText: string;
  readonly studentAnswer: string;
  readonly correctAnswer: string;
  readonly answerChoices: readonly string[];
  readonly diagnosis: MistakeDiagnosis;
  readonly createdAt: string; // ISO
  // Spaced repetition
  nextReviewAt: string; // ISO
  reviewCount: number;
  lastReviewedAt: string | null;
}

export interface MistakePattern {
  readonly description: string;
  readonly count: number;
  readonly mistakeIds: readonly string[];
  readonly skillId: string;
}

// ─── Constants ────────────────────────────────────────────────────────

import { getStorageKey, notifyProgressChanged } from "./user-profile";

const STORAGE_KEY = "hunter-tutor-mistakes";

/** Spaced repetition intervals in days: 1, 3, 7, 14, 30 */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

const CATEGORY_LABELS: Record<MistakeCategory, string> = {
  conceptual_gap: "Conceptual Gap",
  careless_error: "Careless Error",
  misread_question: "Misread Question",
};

// ─── Storage ──────────────────────────────────────────────────────────

export function loadMistakes(): MistakeEntry[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
  if (!data) return [];
  try {
    return JSON.parse(data) as MistakeEntry[];
  } catch {
    return [];
  }
}

export function saveMistakes(mistakes: readonly MistakeEntry[]): void {
  localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(mistakes));
  notifyProgressChanged("mistakes");
}

export function addMistake(entry: MistakeEntry): void {
  const mistakes = loadMistakes();
  mistakes.push(entry);
  saveMistakes(mistakes);
}

export function updateMistake(
  id: string,
  updates: Partial<Pick<MistakeEntry, "nextReviewAt" | "reviewCount" | "lastReviewedAt">>
): void {
  const mistakes = loadMistakes();
  const index = mistakes.findIndex((m) => m.id === id);
  if (index >= 0) {
    mistakes[index] = { ...mistakes[index], ...updates };
    saveMistakes(mistakes);
  }
}

// ─── Spaced Repetition ────────────────────────────────────────────────

/**
 * Compute the next review date based on review count.
 */
export function computeNextReviewDate(
  reviewCount: number,
  fromDate: Date = new Date()
): Date {
  const intervalIndex = Math.min(reviewCount, REVIEW_INTERVALS.length - 1);
  const days = REVIEW_INTERVALS[intervalIndex];
  const next = new Date(fromDate);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Get all mistakes due for review (nextReviewAt <= now).
 */
export function getDueForReview(
  mistakes: readonly MistakeEntry[],
  now: Date = new Date()
): MistakeEntry[] {
  return mistakes.filter((m) => new Date(m.nextReviewAt) <= now);
}

/**
 * Record a review result. If correct, advance interval. If wrong, reset to interval 0.
 */
export function recordReviewResult(
  id: string,
  correct: boolean,
  now: Date = new Date()
): void {
  const mistakes = loadMistakes();
  const entry = mistakes.find((m) => m.id === id);
  if (!entry) return;

  if (correct) {
    const newCount = entry.reviewCount + 1;
    // If past all intervals, remove from review queue (set far future)
    if (newCount >= REVIEW_INTERVALS.length) {
      updateMistake(id, {
        reviewCount: newCount,
        lastReviewedAt: now.toISOString(),
        nextReviewAt: new Date(
          now.getTime() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    } else {
      updateMistake(id, {
        reviewCount: newCount,
        lastReviewedAt: now.toISOString(),
        nextReviewAt: computeNextReviewDate(newCount, now).toISOString(),
      });
    }
  } else {
    // Reset to interval 0
    updateMistake(id, {
      reviewCount: 0,
      lastReviewedAt: now.toISOString(),
      nextReviewAt: computeNextReviewDate(0, now).toISOString(),
    });
  }
}

// ─── Pattern Analysis (Pure) ──────────────────────────────────────────

/**
 * Group mistakes by skill and return patterns with counts >= 2.
 */
export function analyzePatternsBySkill(
  mistakes: readonly MistakeEntry[]
): MistakePattern[] {
  const bySkill = new Map<string, MistakeEntry[]>();
  for (const m of mistakes) {
    const existing = bySkill.get(m.skillId) ?? [];
    existing.push(m);
    bySkill.set(m.skillId, existing);
  }

  const patterns: MistakePattern[] = [];
  for (const [skillId, entries] of Array.from(bySkill.entries())) {
    if (entries.length >= 2) {
      patterns.push({
        description: `You've missed ${entries.length} questions on "${entries[0].skillName}"`,
        count: entries.length,
        mistakeIds: entries.map((e) => e.id),
        skillId,
      });
    }
  }

  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * Group mistakes by category.
 */
export function analyzePatternsByCategory(
  mistakes: readonly MistakeEntry[]
): { category: MistakeCategory; label: string; count: number; percentage: number }[] {
  const counts: Record<MistakeCategory, number> = {
    conceptual_gap: 0,
    careless_error: 0,
    misread_question: 0,
  };

  for (const m of mistakes) {
    counts[m.diagnosis.category]++;
  }

  const total = mistakes.length || 1;
  return (Object.entries(counts) as [MistakeCategory, number][])
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABELS[category],
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Create a MistakeEntry ready for storage.
 */
export function createMistakeEntry(
  params: {
    skillId: string;
    skillName: string;
    questionText: string;
    studentAnswer: string;
    correctAnswer: string;
    answerChoices: readonly string[];
    diagnosis: MistakeDiagnosis;
  },
  now: Date = new Date()
): MistakeEntry {
  return {
    id: Math.random().toString(36).slice(2, 10),
    ...params,
    createdAt: now.toISOString(),
    nextReviewAt: computeNextReviewDate(0, now).toISOString(),
    reviewCount: 0,
    lastReviewedAt: null,
  };
}

export { CATEGORY_LABELS };
