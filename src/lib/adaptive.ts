import type { DifficultyLevel, Skill } from "@/lib/types";
import { getAllSkills } from "@/lib/exam/curriculum";

// ─── Types ────────────────────────────────────────────────────────────

export type ConfidenceTrend = "improving" | "stable" | "declining";

export type SessionMode = "teach" | "practice";

export interface StudentSkillState {
  readonly skillId: string;
  readonly masteryLevel: number; // 0.0 - 1.0
  readonly attemptsCount: number;
  readonly correctCount: number;
  readonly lastPracticed: Date | null;
  readonly confidenceTrend: ConfidenceTrend;
}

export interface AttemptRecord {
  readonly isCorrect: boolean;
  readonly timeSpentSeconds: number | null;
  readonly hintUsed: boolean;
}

export interface SkillPriority {
  readonly skillId: string;
  readonly score: number;
  readonly reason: SkillPriorityReason;
}

export type SkillPriorityReason =
  | "prerequisite_gap"
  | "declining_confidence"
  | "stale"
  | "near_mastery"
  | "low_mastery"
  | "new_skill";

export interface DifficultyDecision {
  readonly tier: DifficultyLevel;
  readonly mode: SessionMode;
}

export interface SessionPacingState {
  readonly questionsInCurrentRun: number;
  readonly totalQuestions: number;
  readonly sessionStartTime: Date;
  readonly lastTeachingMoment: number; // question index of last teaching moment
  readonly recentAnswerTimesSeconds: readonly number[];
}

export interface PacingAction {
  readonly action: "continue_practice" | "insert_teaching" | "end_session" | "slow_down";
  readonly reason: string;
}

export interface MasteryUpdate {
  readonly newMasteryLevel: number;
  readonly newConfidenceTrend: ConfidenceTrend;
}

// ─── Tier Labels ─────────────────────────────────────────────────────

export const MASTERY_TIER_LABELS: Record<DifficultyLevel, string> = {
  1: "Getting Started",
  2: "Building Up",
  3: "In Progress",
  4: "Almost There",
  5: "Mastered",
};

export function tierLabel(tier: DifficultyLevel): string {
  return MASTERY_TIER_LABELS[tier];
}

// ─── Constants ────────────────────────────────────────────────────────

const MASTERY_THRESHOLD_LOW = 0.6;
const MASTERY_NEAR_LOW = 0.7;
const MASTERY_NEAR_HIGH = 0.85;
const STALE_DAYS = 7;
const STREAK_TO_ADVANCE = 3;
const STREAK_TO_DROP = 2;
const MAX_QUESTIONS_BEFORE_TEACHING = 5;
const SESSION_MIN_MINUTES = 25;
const SESSION_MAX_MINUTES = 35;
const RECENT_WINDOW = 10;
const RUSHING_THRESHOLD_SECONDS = 5;
const RUSHING_STREAK = 3;

// Mastery formula weights
const WEIGHT_RECENT = 0.7;
const WEIGHT_OVERALL = 0.2;
const WEIGHT_TIME = 0.1;

// Priority scoring weights
const PRIORITY_PREREQUISITE_GAP = 100;
const PRIORITY_DECLINING = 70;
const PRIORITY_STALE = 50;
const PRIORITY_NEAR_MASTERY = 30;
const PRIORITY_LOW_MASTERY = 60;
const PRIORITY_NEW_SKILL = 40;

// ─── 1. Skill Selection ──────────────────────────────────────────────

/**
 * Build a reverse dependency map: for each skill, which skills depend on it?
 * A skill that is a prerequisite for many others is higher-value to fix.
 */
function buildDependentsMap(
  skills: Map<string, Skill>
): Map<string, string[]> {
  const dependents = new Map<string, string[]>();
  for (const [, skill] of Array.from(skills.entries())) {
    for (const prereqId of skill.prerequisite_skills) {
      const existing = dependents.get(prereqId) ?? [];
      existing.push(skill.skill_id);
      dependents.set(prereqId, existing);
    }
  }
  return dependents;
}

/**
 * Score a single skill for priority selection.
 * Higher score = should be practiced sooner.
 */
function scoreSkill(
  skillId: string,
  state: StudentSkillState | undefined,
  dependents: Map<string, string[]>,
  now: Date
): SkillPriority {
  // Brand new skill never attempted
  if (!state || state.attemptsCount === 0) {
    return { skillId, score: PRIORITY_NEW_SKILL, reason: "new_skill" };
  }

  let bestScore = 0;
  let bestReason: SkillPriorityReason = "low_mastery";

  // Prerequisite gap: skill is below threshold AND has dependents
  const depCount = (dependents.get(skillId) ?? []).length;
  if (state.masteryLevel < MASTERY_THRESHOLD_LOW && depCount > 0) {
    const score = PRIORITY_PREREQUISITE_GAP + depCount * 5;
    if (score > bestScore) {
      bestScore = score;
      bestReason = "prerequisite_gap";
    }
  }

  // Declining confidence
  if (state.confidenceTrend === "declining") {
    const score = PRIORITY_DECLINING + (1 - state.masteryLevel) * 20;
    if (score > bestScore) {
      bestScore = score;
      bestReason = "declining_confidence";
    }
  }

  // Stale: not practiced in 7+ days
  if (state.lastPracticed) {
    const daysSince = Math.floor(
      (now.getTime() - state.lastPracticed.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince >= STALE_DAYS) {
      const staleness = Math.min(daysSince / STALE_DAYS, 3); // cap at 3x
      const score = PRIORITY_STALE * staleness;
      if (score > bestScore) {
        bestScore = score;
        bestReason = "stale";
      }
    }
  }

  // Near mastery: 0.7-0.85 — needs reinforcement
  if (
    state.masteryLevel >= MASTERY_NEAR_LOW &&
    state.masteryLevel <= MASTERY_NEAR_HIGH
  ) {
    const score =
      PRIORITY_NEAR_MASTERY + (MASTERY_NEAR_HIGH - state.masteryLevel) * 50;
    if (score > bestScore) {
      bestScore = score;
      bestReason = "near_mastery";
    }
  }

  // General low mastery (no dependents or doesn't qualify above)
  if (state.masteryLevel < MASTERY_THRESHOLD_LOW && bestScore === 0) {
    const score = PRIORITY_LOW_MASTERY + (1 - state.masteryLevel) * 30;
    if (score > bestScore) {
      bestScore = score;
      bestReason = "low_mastery";
    }
  }

  return {
    skillId,
    score: bestScore,
    reason: bestReason,
  };
}

/**
 * Select the next skill to practice from a domain.
 * Returns a priority-sorted list of skills (highest priority first).
 */
export function selectNextSkills(
  domainSkillIds: readonly string[],
  studentStates: ReadonlyMap<string, StudentSkillState>,
  now: Date = new Date()
): readonly SkillPriority[] {
  const allSkills = getAllSkills();
  const dependents = buildDependentsMap(allSkills);

  const priorities: SkillPriority[] = domainSkillIds.map((skillId) =>
    scoreSkill(skillId, studentStates.get(skillId), dependents, now)
  );

  return priorities.sort((a, b) => b.score - a.score);
}

// ─── 2. Difficulty Adjustment ────────────────────────────────────────

/**
 * Map mastery level (0.0-1.0) to a difficulty tier (1-5).
 */
export function masteryToTier(mastery: number): DifficultyLevel {
  if (mastery < 0.2) return 1;
  if (mastery < 0.4) return 2;
  if (mastery < 0.6) return 3;
  if (mastery < 0.8) return 4;
  return 5;
}

/**
 * Given recent attempts for a skill, decide the difficulty tier and mode.
 *
 * - 3 correct in a row → move up one tier
 * - 2 wrong in a row → drop one tier and switch to "teach" mode
 * - Otherwise stay at current tier in "practice" mode
 */
export function adjustDifficulty(
  currentMastery: number,
  recentAttempts: readonly AttemptRecord[]
): DifficultyDecision {
  const baseTier = masteryToTier(currentMastery);

  if (recentAttempts.length === 0) {
    return { tier: baseTier, mode: "practice" };
  }

  // For advancement: hint-assisted correct answers break the streak
  const independentAttempts = recentAttempts.map((a) => ({
    ...a,
    isCorrect: a.isCorrect && !a.hintUsed,
  }));
  const tailCorrectStreak = countTailStreak(independentAttempts, true);
  // For dropping: use original attempts (hints don't protect from wrong streak)
  const tailWrongStreak = countTailStreak(recentAttempts, false);

  if (tailWrongStreak >= STREAK_TO_DROP) {
    const droppedTier = Math.max(1, baseTier - 1) as DifficultyLevel;
    return { tier: droppedTier, mode: "teach" };
  }

  if (tailCorrectStreak >= STREAK_TO_ADVANCE) {
    const advancedTier = Math.min(5, baseTier + 1) as DifficultyLevel;
    return { tier: advancedTier, mode: "practice" };
  }

  return { tier: baseTier, mode: "practice" };
}

/**
 * Count consecutive matching results from the end of the array.
 */
function countTailStreak(
  attempts: readonly AttemptRecord[],
  matchCorrect: boolean
): number {
  let count = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i].isCorrect === matchCorrect) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ─── 3. Session Pacing ───────────────────────────────────────────────

/**
 * Create initial pacing state for a new session.
 */
export function createPacingState(startTime: Date = new Date()): SessionPacingState {
  return {
    questionsInCurrentRun: 0,
    totalQuestions: 0,
    sessionStartTime: startTime,
    lastTeachingMoment: 0,
    recentAnswerTimesSeconds: [],
  };
}

/**
 * Determine whether to continue practice, insert a teaching moment,
 * or end the session.
 */
export function getNextPacingAction(
  state: SessionPacingState,
  now: Date = new Date()
): PacingAction {
  const elapsedMinutes =
    (now.getTime() - state.sessionStartTime.getTime()) / (1000 * 60);

  // Detect rushing: last N answers all under threshold
  const recentTimes = state.recentAnswerTimesSeconds.slice(-RUSHING_STREAK);
  if (
    recentTimes.length >= RUSHING_STREAK &&
    recentTimes.every((t) => t < RUSHING_THRESHOLD_SECONDS)
  ) {
    return {
      action: "slow_down",
      reason:
        "You're moving really fast! Take a moment to read each question carefully before answering — accuracy matters more than speed.",
    };
  }

  // Hard stop at max session time
  if (elapsedMinutes >= SESSION_MAX_MINUTES) {
    return {
      action: "end_session",
      reason: `Session reached ${SESSION_MAX_MINUTES} minutes — time for a break.`,
    };
  }

  // Suggest ending if past minimum and at a natural break
  if (
    elapsedMinutes >= SESSION_MIN_MINUTES &&
    state.questionsInCurrentRun >= 3
  ) {
    return {
      action: "end_session",
      reason:
        "Great work! We've been at it for a while — let's wrap up with a summary.",
    };
  }

  // Insert teaching after max consecutive questions
  if (state.questionsInCurrentRun >= MAX_QUESTIONS_BEFORE_TEACHING) {
    return {
      action: "insert_teaching",
      reason:
        "Time for a quick review! Let's make sure we understand the concepts before more practice.",
    };
  }

  return { action: "continue_practice", reason: "" };
}

/**
 * Advance pacing state after a practice question.
 */
export function advancePacingAfterQuestion(
  state: SessionPacingState,
  answerTimeSeconds?: number
): SessionPacingState {
  return {
    ...state,
    questionsInCurrentRun: state.questionsInCurrentRun + 1,
    totalQuestions: state.totalQuestions + 1,
    recentAnswerTimesSeconds:
      answerTimeSeconds !== undefined
        ? [...state.recentAnswerTimesSeconds, answerTimeSeconds]
        : state.recentAnswerTimesSeconds,
  };
}

/**
 * Reset the question run counter after a teaching moment.
 */
export function advancePacingAfterTeaching(
  state: SessionPacingState
): SessionPacingState {
  return {
    ...state,
    questionsInCurrentRun: 0,
    lastTeachingMoment: state.totalQuestions,
  };
}

// ─── 4. Mastery Update ───────────────────────────────────────────────

/**
 * Expected seconds per question by difficulty tier.
 * Used to compute time efficiency: finishing faster (but correctly) = higher score.
 */
const EXPECTED_SECONDS_BY_TIER: Record<DifficultyLevel, number> = {
  1: 30,
  2: 45,
  3: 60,
  4: 90,
  5: 120,
};

/**
 * Compute time efficiency score (0.0-1.0).
 * 1.0 = completed in expected time or less (while correct).
 * Scales down for slower attempts. Incorrect attempts score 0.
 */
function computeTimeEfficiency(
  attempts: readonly AttemptRecord[],
  tier: DifficultyLevel
): number {
  const expected = EXPECTED_SECONDS_BY_TIER[tier];
  const validAttempts = attempts.filter(
    (a) => a.timeSpentSeconds !== null && a.isCorrect
  );

  if (validAttempts.length === 0) return 0.5; // neutral default

  let totalScore = 0;
  for (const a of validAttempts) {
    const ratio = expected / Math.max(a.timeSpentSeconds!, 1);
    totalScore += Math.min(ratio, 1.0); // cap at 1.0, don't reward impossibly fast
  }

  return totalScore / validAttempts.length;
}

/**
 * Compute rolling accuracy over the last N attempts.
 */
function rollingAccuracy(
  attempts: readonly AttemptRecord[],
  window: number
): number {
  if (attempts.length === 0) return 0;
  const recent = attempts.slice(-window);
  let score = 0;
  for (const a of recent) {
    if (a.isCorrect) {
      score += a.hintUsed ? 0.5 : 1.0; // scaffolded success discounted
    }
  }
  return score / recent.length;
}

/**
 * Determine the new confidence trend based on two accuracy snapshots.
 */
function computeTrend(
  recentAccuracy: number,
  overallAccuracy: number
): ConfidenceTrend {
  const delta = recentAccuracy - overallAccuracy;
  if (delta > 0.1) return "improving";
  if (delta < -0.1) return "declining";
  return "stable";
}

/**
 * Calculate updated mastery level and confidence trend after new attempts.
 *
 * Formula:
 *   new_mastery = 0.7 * rolling_accuracy_last_10
 *               + 0.2 * overall_accuracy
 *               + 0.1 * time_efficiency_score
 */
export function calculateMasteryUpdate(
  allAttempts: readonly AttemptRecord[],
  currentTier: DifficultyLevel
): MasteryUpdate {
  if (allAttempts.length === 0) {
    return { newMasteryLevel: 0, newConfidenceTrend: "stable" };
  }

  const recentAcc = rollingAccuracy(allAttempts, RECENT_WINDOW);
  const overallAcc = rollingAccuracy(allAttempts, allAttempts.length);
  const timeEff = computeTimeEfficiency(
    allAttempts.slice(-RECENT_WINDOW),
    currentTier
  );

  const rawMastery =
    WEIGHT_RECENT * recentAcc +
    WEIGHT_OVERALL * overallAcc +
    WEIGHT_TIME * timeEff;

  const newMasteryLevel = Math.max(0, Math.min(1, rawMastery));
  const newConfidenceTrend = computeTrend(recentAcc, overallAcc);

  return {
    newMasteryLevel: Math.round(newMasteryLevel * 1000) / 1000, // 3 decimal places
    newConfidenceTrend,
  };
}
