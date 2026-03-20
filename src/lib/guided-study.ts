import type { StudentSkillState } from "@/lib/adaptive";
import { selectNextSkills } from "@/lib/adaptive";
import type { SkillPriority } from "@/lib/adaptive";
import { getSkillIdsForDomain, getSkillById } from "@/lib/exam/curriculum";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";

// ─── Types ────────────────────────────────────────────────────────────

export type GuidedStudyPhase =
  | "planning" // Initial skill selection
  | "teaching" // Streaming teaching for current skill
  | "practicing" // Question-answer loop
  | "transitioning" // Brief interstitial between skills
  | "complete"; // Session done

export interface SkillSlot {
  readonly skillId: string;
  readonly skillName: string;
  readonly domain: string;
  readonly startMastery: number;
  endMastery: number;
  questionsAnswered: number;
  correctCount: number;
  completed: boolean;
}

export interface GuidedStudySummary {
  readonly totalMinutes: number;
  readonly totalQuestions: number;
  readonly totalCorrect: number;
  readonly accuracy: number;
  readonly skillsCompleted: readonly SkillSlot[];
  readonly overallMasteryChange: number;
}

// ─── Constants ────────────────────────────────────────────────────────

export const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const MIN_QUESTIONS_PER_SKILL = 3;
export const MAX_QUESTIONS_PER_SKILL = 7;
export const ADVANCE_STREAK = 3; // 3 consecutive correct → move on
export const TRANSITION_DELAY_MS = 2500;
export const SKILLS_PER_SESSION = 5;

// ─── Domains ──────────────────────────────────────────────────────────

const GUIDED_STUDY_DOMAINS = [
  "reading_comprehension",
  "math_quantitative_reasoning",
  "math_achievement",
] as const;

// ─── buildStudyPlan ───────────────────────────────────────────────────

/**
 * Load current masteries, prioritise skills across all domains,
 * and return the top SKILLS_PER_SESSION as SkillSlots.
 */
export function buildStudyPlan(): SkillSlot[] {
  const storedMasteries = loadAllSkillMasteries();

  // Convert StoredSkillMastery[] → Map<skillId, StudentSkillState>
  const stateMap = new Map<string, StudentSkillState>();
  for (const m of storedMasteries) {
    stateMap.set(m.skillId, {
      skillId: m.skillId,
      masteryLevel: m.masteryLevel,
      attemptsCount: m.attemptsCount,
      correctCount: m.correctCount,
      lastPracticed: m.lastPracticed ? new Date(m.lastPracticed) : null,
      confidenceTrend: m.confidenceTrend,
    });
  }

  // Gather priorities from each domain
  const allPriorities: SkillPriority[] = [];
  for (const domain of GUIDED_STUDY_DOMAINS) {
    const skillIds = getSkillIdsForDomain(domain);
    const priorities = selectNextSkills(skillIds, stateMap);
    allPriorities.push(...priorities);
  }

  // Sort by score descending, take top N
  allPriorities.sort((a, b) => b.score - a.score);
  const topPriorities = allPriorities.slice(0, SKILLS_PER_SESSION);

  // Map to SkillSlot objects
  return topPriorities.map((p): SkillSlot => {
    const skill = getSkillById(p.skillId);
    const existing = stateMap.get(p.skillId);
    const domainForSkill = findDomainForPriority(p.skillId);

    return {
      skillId: p.skillId,
      skillName: skill?.name ?? p.skillId,
      domain: domainForSkill,
      startMastery: existing?.masteryLevel ?? 0,
      endMastery: existing?.masteryLevel ?? 0,
      questionsAnswered: 0,
      correctCount: 0,
      completed: false,
    };
  });
}

/** Determine which domain a skill belongs to by checking each domain's skill list. */
function findDomainForPriority(skillId: string): string {
  for (const domain of GUIDED_STUDY_DOMAINS) {
    const ids = getSkillIdsForDomain(domain);
    if (ids.includes(skillId)) return domain;
  }
  return "unknown";
}

// ─── shouldAdvanceSkill ───────────────────────────────────────────────

/**
 * Decide whether the student should move on from the current skill.
 */
export function shouldAdvanceSkill(
  questionsAnswered: number,
  correctStreak: number,
  elapsedMs: number,
): boolean {
  // Mandatory minimum
  if (questionsAnswered < MIN_QUESTIONS_PER_SKILL) return false;
  // Streak-based early exit
  if (correctStreak >= ADVANCE_STREAK) return true;
  // Hard max
  if (questionsAnswered >= MAX_QUESTIONS_PER_SKILL) return true;
  // Time pressure: if session is >75% done, advance sooner
  if (
    elapsedMs > SESSION_DURATION_MS * 0.75 &&
    questionsAnswered >= MIN_QUESTIONS_PER_SKILL
  )
    return true;
  return false;
}

// ─── computeSessionSummary ────────────────────────────────────────────

/**
 * Produce a summary object from the completed (or partially completed) slots.
 */
export function computeSessionSummary(
  slots: readonly SkillSlot[],
  startTime: number,
): GuidedStudySummary {
  const totalMinutes = Math.round((Date.now() - startTime) / 60000);
  const totalQuestions = slots.reduce((s, slot) => s + slot.questionsAnswered, 0);
  const totalCorrect = slots.reduce((s, slot) => s + slot.correctCount, 0);
  const accuracy =
    totalQuestions > 0
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0;

  const completedSlots = slots.filter((s) => s.questionsAnswered > 0);
  const masteryChanges = completedSlots.map((s) => s.endMastery - s.startMastery);
  const overallMasteryChange =
    masteryChanges.length > 0
      ? masteryChanges.reduce((a, b) => a + b, 0) / masteryChanges.length
      : 0;

  return {
    totalMinutes,
    totalQuestions,
    totalCorrect,
    accuracy,
    skillsCompleted: completedSlots,
    overallMasteryChange: Math.round(overallMasteryChange * 1000) / 1000,
  };
}

// ─── formatTimeRemaining ──────────────────────────────────────────────

/**
 * Format remaining milliseconds as "mm:ss" for the timer display.
 */
export function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
