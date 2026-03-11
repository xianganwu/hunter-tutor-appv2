import { getStorageKey, notifyProgressChanged } from "./user-profile";

// ─── Types ────────────────────────────────────────────────────────────

export interface DrillAttempt {
  readonly questionText: string;
  readonly studentAnswer: string;
  readonly correctAnswer: string;
  readonly isCorrect: boolean;
  readonly timeSpentMs: number;
}

export interface DrillResult {
  readonly id: string;
  readonly skillId: string;
  readonly skillName: string;
  readonly durationSeconds: number;
  readonly attempts: readonly DrillAttempt[];
  readonly totalCorrect: number;
  readonly totalQuestions: number;
  readonly accuracy: number;
  readonly questionsPerMinute: number;
  readonly completedAt: string; // ISO
}

export interface DrillQuestion {
  readonly questionText: string;
  readonly correctAnswer: string;
  readonly answerChoices: readonly string[];
}

// ─── Storage ─────────────────────────────────────────────────────────

const STORAGE_KEY = "hunter-tutor-drills";

export function loadDrillHistory(): DrillResult[] {
  try {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
    if (!data) return [];
    return JSON.parse(data) as DrillResult[];
  } catch {
    return [];
  }
}

export function saveDrillResult(result: DrillResult): void {
  try {
    if (typeof window === "undefined") return;
    const history = loadDrillHistory();
    history.push(result);
    localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(history));
    notifyProgressChanged();
  } catch {
    // localStorage unavailable
  }
}

/**
 * Get the best drill result for a specific skill.
 */
export function getBestDrillForSkill(
  skillId: string,
): DrillResult | null {
  const history = loadDrillHistory();
  const skillDrills = history.filter((d) => d.skillId === skillId);
  if (skillDrills.length === 0) return null;

  return skillDrills.reduce((best, d) =>
    d.accuracy > best.accuracy ||
    (d.accuracy === best.accuracy && d.questionsPerMinute > best.questionsPerMinute)
      ? d
      : best,
  );
}

/**
 * Compute a drill result from attempts.
 */
export function computeDrillResult(
  skillId: string,
  skillName: string,
  attempts: readonly DrillAttempt[],
  durationSeconds: number,
): DrillResult {
  const totalCorrect = attempts.filter((a) => a.isCorrect).length;
  const accuracy =
    attempts.length > 0
      ? Math.round((totalCorrect / attempts.length) * 100)
      : 0;
  const questionsPerMinute =
    durationSeconds > 0
      ? Math.round((attempts.length / (durationSeconds / 60)) * 10) / 10
      : 0;

  return {
    id: Math.random().toString(36).slice(2, 10),
    skillId,
    skillName,
    durationSeconds,
    attempts,
    totalCorrect,
    totalQuestions: attempts.length,
    accuracy,
    questionsPerMinute,
    completedAt: new Date().toISOString(),
  };
}
