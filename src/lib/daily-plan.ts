import { getStorageKey, notifyProgressChanged } from "./user-profile";
import { selectNextSkills } from "./adaptive";
import type { StudentSkillState } from "./adaptive";
import { loadAllSkillMasteries } from "./skill-mastery-store";
import { getSkillIdsForDomain, getSkillById } from "./exam/curriculum";
import { getDueForReview, loadMistakes } from "./mistakes";
import { loadVocabDeck, getDueCards } from "./vocabulary";

// ─── Types ────────────────────────────────────────────────────────────

export interface DailyTask {
  readonly id: string;
  readonly type:
    | "skill_practice"
    | "mistake_review"
    | "writing"
    | "drill"
    | "vocab_review";
  readonly skillId?: string;
  readonly skillName: string;
  readonly domain?: string;
  readonly estimatedMinutes: number;
  readonly reason: string;
  readonly masteryLevel?: number;
}

export interface DailyPlan {
  date: string; // YYYY-MM-DD
  timeBudget: number; // 15, 30, or 45
  tasks: DailyTask[];
  completedTaskIds: string[];
}

// ─── Storage ─────────────────────────────────────────────────────────

const STORAGE_KEY = "hunter-tutor-daily-plan";
const TIME_BUDGET_KEY = "hunter-tutor-time-budget";

export function loadDailyPlan(): DailyPlan | null {
  try {
    if (typeof window === "undefined") return null;
    const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
    if (!data) return null;
    const plan = JSON.parse(data) as DailyPlan;
    // Backward compat: plans saved before time-budget feature
    if (!plan.timeBudget) plan.timeBudget = 30;
    return plan;
  } catch {
    return null;
  }
}

export function saveDailyPlan(plan: DailyPlan): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(plan));
    notifyProgressChanged("daily-plan");
  } catch {
    // localStorage unavailable
  }
}

export function loadTimeBudget(): number {
  try {
    if (typeof window === "undefined") return 30;
    const val = localStorage.getItem(getStorageKey(TIME_BUDGET_KEY));
    if (val) {
      const n = parseInt(val, 10);
      if (n === 15 || n === 30 || n === 45) return n;
    }
    return 30;
  } catch {
    return 30;
  }
}

function saveTimeBudget(minutes: number): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(getStorageKey(TIME_BUDGET_KEY), String(minutes));
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
 * Build a prioritized list of tasks that fit within the given time budget.
 * Priority: mistake review → vocab review → skill practice → writing → speed rounds
 */
function buildTaskList(timeBudgetMinutes: number): DailyTask[] {
  const tasks: DailyTask[] = [];
  let remaining = timeBudgetMinutes;

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

  // 1. Mistake review (8 min) — highest priority, spaced repetition
  const mistakes = loadMistakes();
  const dueMistakes = getDueForReview(mistakes);
  if (dueMistakes.length > 0 && remaining >= 8) {
    tasks.push({
      id: makeId(),
      type: "mistake_review",
      skillName: "Review Past Mistakes",
      estimatedMinutes: 8,
      reason: `${dueMistakes.length} mistake${dueMistakes.length > 1 ? "s" : ""} due for review`,
    });
    remaining -= 8;
  }

  // 2. Vocab review (5 min) — if cards are due
  const deck = loadVocabDeck();
  const dueCards = getDueCards(deck);
  if (dueCards.length > 0 && remaining >= 5) {
    tasks.push({
      id: makeId(),
      type: "vocab_review",
      skillName: "Vocab Review",
      estimatedMinutes: 5,
      reason: `${dueCards.length} word${dueCards.length > 1 ? "s" : ""} due for review`,
    });
    remaining -= 5;
  }

  // 3. Skill practice from different domains (12 min each)
  const usedDomains = new Set<string>();
  for (const domain of DOMAINS) {
    if (remaining < 12) break;

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
      remaining -= 12;
    }
  }

  // 4. Writing (25 min) — every 3rd day, only if budget allows
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      86400000,
  );
  const isWritingDay = dayOfYear % 3 === 0;

  if (isWritingDay && remaining >= 25) {
    tasks.push({
      id: makeId(),
      type: "writing",
      skillName: "Writing Workshop",
      estimatedMinutes: 25,
      reason: "Regular writing practice builds essay skills",
    });
    remaining -= 25;
  }

  // 5. Speed rounds (5 min each) — fill remaining time
  if (remaining >= 5) {
    const allPriorities = DOMAINS.flatMap((d) => {
      const ids = getSkillIdsForDomain(d);
      return selectNextSkills(ids, stateMap);
    }).sort((a, b) => b.score - a.score);

    for (const candidate of allPriorities) {
      if (remaining < 5) break;
      if (tasks.some((t) => t.skillId === candidate.skillId)) continue;

      const skill = getSkillById(candidate.skillId);
      const name = skill?.name ?? candidate.skillId;
      tasks.push({
        id: makeId(),
        type: "drill",
        skillId: candidate.skillId,
        skillName: `Speed Round: ${name}`,
        estimatedMinutes: 5,
        reason: "Speed practice — build exam pace",
      });
      remaining -= 5;
    }
  }

  return tasks;
}

/**
 * Generate a fresh daily plan that fits within the given time budget.
 */
export function generateDailyPlan(
  timeBudgetMinutes: number = 30,
): DailyPlan {
  const today = new Date().toISOString().split("T")[0];
  const tasks = buildTaskList(timeBudgetMinutes);

  const plan: DailyPlan = {
    date: today,
    timeBudget: timeBudgetMinutes,
    tasks,
    completedTaskIds: [],
  };

  saveDailyPlan(plan);
  return plan;
}

/**
 * Regenerate today's plan with a new time budget, preserving completed tasks.
 */
export function regeneratePlanWithBudget(
  timeBudgetMinutes: number,
): DailyPlan {
  saveTimeBudget(timeBudgetMinutes);

  const existing = loadDailyPlan();
  const today = new Date().toISOString().split("T")[0];

  // Collect completed tasks from today's existing plan
  const completedOldTasks =
    existing?.date === today
      ? existing.tasks.filter((t) =>
          existing.completedTaskIds.includes(t.id),
        )
      : [];

  const tasks = buildTaskList(timeBudgetMinutes);

  // Carry over completion state by matching type + skillId
  const completedTaskIds: string[] = [];
  for (const oldTask of completedOldTasks) {
    const match = tasks.find(
      (t) => t.type === oldTask.type && t.skillId === oldTask.skillId,
    );
    if (match) {
      completedTaskIds.push(match.id);
    }
  }

  const plan: DailyPlan = {
    date: today,
    timeBudget: timeBudgetMinutes,
    tasks,
    completedTaskIds,
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

  return generateDailyPlan(loadTimeBudget());
}

/**
 * Mark a task as completed by matching skillId and type.
 * Called from tutoring sessions, writing workshop, drill mode, vocab, reading.
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
    // For type-only tasks, match by type alone
    if (
      type === "writing" ||
      type === "mistake_review" ||
      type === "vocab_review"
    )
      return true;
    // For skill_practice/drill: if skillId provided, match exactly;
    // otherwise match first uncompleted task of this type
    if (!skillId) return true;
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
    case "vocab_review":
      return "/vocab";
  }
}
