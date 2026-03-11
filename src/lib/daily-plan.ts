import { getStorageKey } from "./user-profile";
import { selectNextSkills } from "./adaptive";
import type { StudentSkillState } from "./adaptive";
import { loadAllSkillMasteries } from "./skill-mastery-store";
import { getSkillIdsForDomain, getSkillById } from "./exam/curriculum";
import { getDueForReview, loadMistakes } from "./mistakes";

// ─── Types ────────────────────────────────────────────────────────────

export interface DailyTask {
  readonly id: string;
  readonly type: "skill_practice" | "mistake_review" | "writing" | "drill";
  readonly skillId?: string;
  readonly skillName: string;
  readonly domain?: string;
  readonly estimatedMinutes: number;
  readonly reason: string;
  readonly masteryLevel?: number;
}

export interface DailyPlan {
  date: string; // YYYY-MM-DD
  tasks: DailyTask[];
  completedTaskIds: string[];
}

// ─── Storage ─────────────────────────────────────────────────────────

const STORAGE_KEY = "hunter-tutor-daily-plan";

export function loadDailyPlan(): DailyPlan | null {
  try {
    if (typeof window === "undefined") return null;
    const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
    if (!data) return null;
    return JSON.parse(data) as DailyPlan;
  } catch {
    return null;
  }
}

export function saveDailyPlan(plan: DailyPlan): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(plan));
  } catch {
    // localStorage unavailable
  }
}

// ─── Plan Generation ─────────────────────────────────────────────────

const DOMAINS = [
  "reading_comprehension",
  "math_quantitative_reasoning",
  "math_achievement",
] as const;

const REASON_MAP: Record<string, string> = {
  prerequisite_gap: "Foundation skill — needed for harder topics",
  declining_confidence: "Confidence dropping — needs reinforcement",
  stale: "Not practiced recently — time for a refresh",
  near_mastery: "Almost mastered — just a bit more practice",
  low_mastery: "Needs more practice",
  new_skill: "New skill to explore",
};

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Generate a fresh daily plan with 3 tasks.
 */
export function generateDailyPlan(): DailyPlan {
  const today = new Date().toISOString().split("T")[0];
  const tasks: DailyTask[] = [];

  const stored = loadAllSkillMasteries();
  const stateMap = new Map<string, StudentSkillState>(
    stored.map((s) => [
      s.skillId,
      {
        ...s,
        lastPracticed: s.lastPracticed ? new Date(s.lastPracticed) : null,
      },
    ]),
  );

  // Task 1: Check for due mistake reviews
  const mistakes = loadMistakes();
  const dueMistakes = getDueForReview(mistakes);
  if (dueMistakes.length > 0) {
    tasks.push({
      id: makeId(),
      type: "mistake_review",
      skillName: "Review Past Mistakes",
      estimatedMinutes: 8,
      reason: `${dueMistakes.length} mistake${dueMistakes.length > 1 ? "s" : ""} due for review`,
    });
  }

  // Every 3rd day (based on day of year), include a writing task
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      86400000,
  );
  const isWritingDay = dayOfYear % 3 === 0;

  if (isWritingDay && tasks.length < 3) {
    tasks.push({
      id: makeId(),
      type: "writing",
      skillName: "Writing Workshop",
      estimatedMinutes: 25,
      reason: "Regular writing practice builds essay skills",
    });
  }

  // Fill remaining slots with skill practice from different domains
  const usedDomains = new Set<string>();
  for (const domain of DOMAINS) {
    if (tasks.length >= 3) break;

    const skillIds = getSkillIdsForDomain(domain);
    const priorities = selectNextSkills(skillIds, stateMap);

    if (priorities.length > 0 && !usedDomains.has(domain)) {
      const top = priorities[0];
      const skill = getSkillById(top.skillId);
      const mastery = stateMap.get(top.skillId)?.masteryLevel;

      tasks.push({
        id: makeId(),
        type: "skill_practice",
        skillId: top.skillId,
        skillName: skill?.name ?? top.skillId,
        domain,
        estimatedMinutes: 12,
        reason: REASON_MAP[top.reason] ?? "Recommended practice",
        masteryLevel: mastery,
      });
      usedDomains.add(domain);
    }
  }

  // If still under 3, add a drill task
  if (tasks.length < 3) {
    // Pick a skill with moderate mastery for drill practice
    const allPriorities = DOMAINS.flatMap((d) => {
      const ids = getSkillIdsForDomain(d);
      return selectNextSkills(ids, stateMap);
    }).sort((a, b) => b.score - a.score);

    const drillCandidate = allPriorities.find(
      (p) => !tasks.some((t) => t.skillId === p.skillId),
    );

    if (drillCandidate) {
      const skill = getSkillById(drillCandidate.skillId);
      tasks.push({
        id: makeId(),
        type: "drill",
        skillId: drillCandidate.skillId,
        skillName: skill?.name ?? drillCandidate.skillId,
        estimatedMinutes: 5,
        reason: "Speed practice — build exam pace",
      });
    }
  }

  const plan: DailyPlan = {
    date: today,
    tasks: tasks.slice(0, 3),
    completedTaskIds: [],
  };

  saveDailyPlan(plan);
  return plan;
}

/**
 * Get today's plan, generating a fresh one if needed.
 */
export function getTodaysPlan(): DailyPlan {
  const existing = loadDailyPlan();
  const today = new Date().toISOString().split("T")[0];

  if (existing && existing.date === today) {
    return existing;
  }

  return generateDailyPlan();
}

/**
 * Mark a task as completed by matching skillId and type.
 * Called from tutoring sessions, writing workshop, drill mode.
 */
export function autoCompleteDailyTask(
  skillId: string | undefined,
  type: DailyTask["type"],
): void {
  const plan = loadDailyPlan();
  if (!plan) return;

  const today = new Date().toISOString().split("T")[0];
  if (plan.date !== today) return;

  const match = plan.tasks.find((t) => {
    if (plan.completedTaskIds.includes(t.id)) return false;
    if (t.type !== type) return false;
    // For writing/mistake_review, match by type only
    if (type === "writing" || type === "mistake_review") return true;
    // For skill_practice/drill, match by skillId
    return t.skillId === skillId;
  });

  if (match) {
    plan.completedTaskIds.push(match.id);
    saveDailyPlan(plan);
  }
}

/**
 * Get the daily plan completion streak (consecutive days with all tasks done).
 */
export function getDailyPlanStreak(): number {
  // We only track today's plan in localStorage, so streak is 0 or 1
  // Extended tracking would need a separate history key
  const plan = loadDailyPlan();
  if (!plan) return 0;

  const today = new Date().toISOString().split("T")[0];
  if (plan.date !== today) return 0;
  if (plan.tasks.length === 0) return 0;
  if (plan.completedTaskIds.length >= plan.tasks.length) return 1;

  return 0;
}

/**
 * Get the route for a task type.
 */
export function getTaskRoute(task: DailyTask): string {
  switch (task.type) {
    case "skill_practice":
      if (task.skillId?.startsWith("rc_")) {
        return `/tutor/reading?skill=${task.skillId}`;
      }
      return `/tutor/math?skill=${task.skillId}`;
    case "mistake_review":
      return "/mistakes";
    case "writing":
      return "/tutor/writing";
    case "drill":
      return task.skillId ? `/drill?skill=${task.skillId}` : "/drill";
  }
}
