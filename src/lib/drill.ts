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

// ─── Mixed Drill Types ───────────────────────────────────────────────

export interface MixedDrillQuestion extends DrillQuestion {
  readonly skillId: string;
}

export interface MixedDrillAttempt extends DrillAttempt {
  readonly skillId: string;
}

export interface SkillDrillBreakdown {
  readonly skillId: string;
  readonly skillName: string;
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly needsWork: boolean;
}

export interface MixedDrillResult {
  readonly id: string;
  readonly durationSeconds: number;
  readonly attempts: readonly MixedDrillAttempt[];
  readonly totalCorrect: number;
  readonly totalQuestions: number;
  readonly accuracy: number;
  readonly skillBreakdown: readonly SkillDrillBreakdown[];
  readonly completedAt: string; // ISO
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
    notifyProgressChanged("drills");
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

// ─── Mixed Drill Storage ─────────────────────────────────────────────

const MIXED_STORAGE_KEY = "hunter-tutor-mixed-drills";

export function loadMixedDrillHistory(): MixedDrillResult[] {
  try {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(getStorageKey(MIXED_STORAGE_KEY));
    if (!data) return [];
    return JSON.parse(data) as MixedDrillResult[];
  } catch {
    return [];
  }
}

export function saveMixedDrillResult(result: MixedDrillResult): void {
  try {
    if (typeof window === "undefined") return;
    const history = loadMixedDrillHistory();
    history.push(result);
    localStorage.setItem(getStorageKey(MIXED_STORAGE_KEY), JSON.stringify(history));
    notifyProgressChanged("drills");
  } catch {
    // localStorage unavailable
  }
}

/**
 * Compute a mixed drill result with per-skill breakdowns.
 */
export function computeMixedDrillResult(
  attempts: readonly MixedDrillAttempt[],
  durationSeconds: number,
  skillNames: ReadonlyMap<string, string>,
): MixedDrillResult {
  const totalCorrect = attempts.filter((a) => a.isCorrect).length;
  const accuracy =
    attempts.length > 0
      ? Math.round((totalCorrect / attempts.length) * 100)
      : 0;

  // Group by skill
  const bySkill = new Map<string, MixedDrillAttempt[]>();
  for (const a of attempts) {
    const existing = bySkill.get(a.skillId) ?? [];
    existing.push(a);
    bySkill.set(a.skillId, existing);
  }

  const skillBreakdown: SkillDrillBreakdown[] = [];
  for (const [skillId, skillAttempts] of Array.from(bySkill.entries())) {
    const correct = skillAttempts.filter((a) => a.isCorrect).length;
    const skillAccuracy =
      skillAttempts.length > 0
        ? Math.round((correct / skillAttempts.length) * 100)
        : 0;
    skillBreakdown.push({
      skillId,
      skillName: skillNames.get(skillId) ?? skillId,
      total: skillAttempts.length,
      correct,
      accuracy: skillAccuracy,
      needsWork: skillAccuracy < 70,
    });
  }

  return {
    id: Math.random().toString(36).slice(2, 10),
    durationSeconds,
    attempts,
    totalCorrect,
    totalQuestions: attempts.length,
    accuracy,
    skillBreakdown,
    completedAt: new Date().toISOString(),
  };
}
