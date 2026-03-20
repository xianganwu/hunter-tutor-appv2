// ─── Types ────────────────────────────────────────────────────────────

export interface TeachingMomentEvaluation {
  readonly completeness: "complete" | "partial" | "missing_key_concepts";
  readonly accuracy: "accurate" | "minor_errors" | "misconception";
  readonly feedback: string;
  readonly missingConcepts: readonly string[];
}

export interface StoredTeachingMoment {
  readonly id: string;
  readonly skillId: string;
  readonly skillName: string;
  readonly studentExplanation: string;
  readonly evaluation: TeachingMomentEvaluation;
  readonly createdAt: string; // ISO
}

import { getStorageKey, notifyProgressChanged } from "./user-profile";

// ─── Constants ────────────────────────────────────────────────────────

const STORAGE_KEY = "hunter-tutor-teaching-moments";

/** Minimum session accuracy to trigger teach-it-back */
export const TEACH_BACK_MASTERY_THRESHOLD = 0.85;

/** Minimum questions answered before triggering */
export const TEACH_BACK_MIN_QUESTIONS = 4;

// ─── Storage ──────────────────────────────────────────────────────────

export function loadTeachingMoments(): StoredTeachingMoment[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
  if (!data) return [];
  try {
    return JSON.parse(data) as StoredTeachingMoment[];
  } catch {
    return [];
  }
}

export function saveTeachingMoment(moment: StoredTeachingMoment): void {
  const moments = loadTeachingMoments();
  moments.push(moment);
  localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(moments));
  notifyProgressChanged("teaching-moments");
}

export function getTeachingMomentsForSkill(
  skillId: string
): StoredTeachingMoment[] {
  return loadTeachingMoments().filter((m) => m.skillId === skillId);
}

// ─── Mastery Check ────────────────────────────────────────────────────

/**
 * Determine if a teach-it-back exercise should be triggered.
 * Conditions:
 *   - Student has answered >= TEACH_BACK_MIN_QUESTIONS questions
 *   - Session accuracy > TEACH_BACK_MASTERY_THRESHOLD
 *   - Haven't already done teach-it-back for this skill this session
 */
export function shouldTriggerTeachBack(
  questionCount: number,
  correctCount: number,
  skillId: string,
  alreadyTriggeredSkills: ReadonlySet<string>
): boolean {
  if (questionCount < TEACH_BACK_MIN_QUESTIONS) return false;
  if (alreadyTriggeredSkills.has(skillId)) return false;
  const accuracy = correctCount / questionCount;
  return accuracy > TEACH_BACK_MASTERY_THRESHOLD;
}

/**
 * Create a StoredTeachingMoment ready for persistence.
 */
export function createTeachingMoment(params: {
  skillId: string;
  skillName: string;
  studentExplanation: string;
  evaluation: TeachingMomentEvaluation;
}): StoredTeachingMoment {
  return {
    id: Math.random().toString(36).slice(2, 10),
    ...params,
    createdAt: new Date().toISOString(),
  };
}
