import { getStorageKey, notifyProgressChanged } from "./user-profile";
import { loadAllSkillMasteries } from "./skill-mastery-store";
import { getSkillIdsForDomain } from "./exam/curriculum";

// ─── Types ────────────────────────────────────────────────────────────

export type BadgeCategory =
  | "practice"
  | "mastery"
  | "streak"
  | "writing"
  | "speed"
  | "milestone";

export type BadgeCondition =
  | { type: "streak_days"; days: number }
  | { type: "total_questions"; count: number }
  | { type: "perfect_session" }
  | { type: "skill_mastered"; domain?: string }
  | { type: "essay_score_min"; minAverage: number }
  | { type: "essays_written"; count: number }
  | { type: "drill_speed"; questionsPerMinute: number }
  | { type: "domain_mastered"; domainId: string }
  | { type: "tier_reached"; tier: number }
  | { type: "revision_improved" }
  | { type: "daily_plan_streak"; days: number }
  | { type: "first_assessment" }
  | { type: "vocab_mastered"; count: number }
  | { type: "all_reading_categories" }
  | { type: "first_simulation" }
  | { type: "all_math_tier3" };

export interface BadgeDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly category: BadgeCategory;
  readonly condition: BadgeCondition;
}

export interface StoredBadge {
  readonly badgeId: string;
  readonly earnedAt: string; // ISO
}

export type MascotAccessory =
  | "none"
  | "party_hat"
  | "graduation_cap"
  | "star_badge"
  | "cape"
  | "backpack"
  | "book"
  | "telescope"
  | "quill"
  | "medal"
  | "wand";

export interface MascotCustomization {
  equipped: MascotAccessory;
  unlocked: MascotAccessory[];
}

export interface BadgeCheckContext {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly totalQuestions: number;
  readonly totalCorrect: number;
  readonly sessionQuestions?: number;
  readonly sessionCorrect?: number;
  readonly essaysWritten: number;
  readonly essayAvgScore?: number;
  readonly revisionImproved?: boolean;
  readonly drillQuestionsPerMinute?: number;
  readonly overallMastery: number;
  readonly dailyPlanStreak?: number;
  readonly assessmentCount?: number;
  readonly vocabMastered?: number;
  readonly readingCategoriesPracticed?: number;
  readonly simulationCount?: number;
}

// ─── Badge Definitions (15) ──────────────────────────────────────────

export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    id: "perfect_session",
    name: "Perfect Session",
    description: "Answer every question correctly in one session",
    icon: "💯",
    category: "practice",
    condition: { type: "perfect_session" },
  },
  {
    id: "streak_3",
    name: "3-Day Streak",
    description: "Practice 3 days in a row",
    icon: "🔥",
    category: "streak",
    condition: { type: "streak_days", days: 3 },
  },
  {
    id: "streak_10",
    name: "10-Day Streak",
    description: "Practice 10 days in a row",
    icon: "🌟",
    category: "streak",
    condition: { type: "streak_days", days: 10 },
  },
  {
    id: "century_club",
    name: "Century Club",
    description: "Answer 100 questions total",
    icon: "💪",
    category: "milestone",
    condition: { type: "total_questions", count: 100 },
  },
  {
    id: "club_500",
    name: "500 Club",
    description: "Answer 500 questions total",
    icon: "🏆",
    category: "milestone",
    condition: { type: "total_questions", count: 500 },
  },
  {
    id: "fraction_master",
    name: "Fraction Master",
    description: "Master all fraction skills",
    icon: "🧮",
    category: "mastery",
    condition: { type: "skill_mastered", domain: "math_achievement" },
  },
  {
    id: "reading_whiz",
    name: "Reading Whiz",
    description: "Master 5 or more reading skills",
    icon: "📖",
    category: "mastery",
    condition: { type: "domain_mastered", domainId: "reading_comprehension" },
  },
  {
    id: "math_champion",
    name: "Math Champion",
    description: "Master all math quantitative reasoning skills",
    icon: "🧠",
    category: "mastery",
    condition: { type: "domain_mastered", domainId: "math_quantitative_reasoning" },
  },
  {
    id: "wordsmith",
    name: "Wordsmith",
    description: "Write 5 essays",
    icon: "✍️",
    category: "writing",
    condition: { type: "essays_written", count: 5 },
  },
  {
    id: "essay_star",
    name: "Essay Star",
    description: "Average essay score of 9 or higher",
    icon: "⭐",
    category: "writing",
    condition: { type: "essay_score_min", minAverage: 9 },
  },
  {
    id: "revision_pro",
    name: "Revision Pro",
    description: "Improve your score through essay revision",
    icon: "📝",
    category: "writing",
    condition: { type: "revision_improved" },
  },
  {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Answer 3+ questions per minute in a timed drill",
    icon: "⚡",
    category: "speed",
    condition: { type: "drill_speed", questionsPerMinute: 3 },
  },
  {
    id: "daily_planner",
    name: "Daily Planner",
    description: "Complete all daily tasks 3 days in a row",
    icon: "📋",
    category: "practice",
    condition: { type: "daily_plan_streak", days: 3 },
  },
  {
    id: "scholar",
    name: "Scholar",
    description: "Reach tier 4 with your mascot",
    icon: "🎓",
    category: "milestone",
    condition: { type: "tier_reached", tier: 4 },
  },
  {
    id: "champion",
    name: "Champion",
    description: "Reach tier 5 — the highest level!",
    icon: "👑",
    category: "milestone",
    condition: { type: "tier_reached", tier: 5 },
  },
  {
    id: "first_assessment",
    name: "Test Taker",
    description: "Complete your first assessment test",
    icon: "📋",
    category: "milestone",
    condition: { type: "first_assessment" },
  },
  {
    id: "vocab_collector",
    name: "Word Collector",
    description: "Master 10 vocabulary words",
    icon: "📚",
    category: "mastery",
    condition: { type: "vocab_mastered", count: 10 },
  },
  {
    id: "reading_explorer",
    name: "Reading Explorer",
    description: "Practice all reading skill categories",
    icon: "🔭",
    category: "mastery",
    condition: { type: "all_reading_categories" },
  },
  {
    id: "first_essay",
    name: "First Draft",
    description: "Write your first essay",
    icon: "🪶",
    category: "writing",
    condition: { type: "essays_written", count: 1 },
  },
  {
    id: "first_simulation",
    name: "Exam Ready",
    description: "Complete your first full practice exam",
    icon: "🏅",
    category: "milestone",
    condition: { type: "first_simulation" },
  },
  {
    id: "math_builder",
    name: "Math Builder",
    description: "Get all math skills to tier 3 or above",
    icon: "🪄",
    category: "mastery",
    condition: { type: "all_math_tier3" },
  },
];

// ─── Accessory Unlock Mapping ────────────────────────────────────────

const ACCESSORY_UNLOCKS: Record<string, MascotAccessory> = {
  streak_3: "party_hat",
  century_club: "star_badge",
  scholar: "graduation_cap",
  champion: "cape",
  first_assessment: "backpack",
  vocab_collector: "book",
  reading_explorer: "telescope",
  first_essay: "quill",
  first_simulation: "medal",
  math_builder: "wand",
};

// ─── Storage ─────────────────────────────────────────────────────────

const BADGES_KEY = "hunter-tutor-badges";
const MASCOT_CUSTOM_KEY = "hunter-tutor-mascot-customization";

export function loadEarnedBadges(): StoredBadge[] {
  try {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(getStorageKey(BADGES_KEY));
    if (!data) return [];
    return JSON.parse(data) as StoredBadge[];
  } catch {
    return [];
  }
}

function saveBadges(badges: readonly StoredBadge[]): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(getStorageKey(BADGES_KEY), JSON.stringify(badges));
    notifyProgressChanged("badges");
  } catch {
    // localStorage unavailable
  }
}

export function loadMascotCustomization(): MascotCustomization {
  try {
    if (typeof window === "undefined") {
      return { equipped: "none", unlocked: ["none"] };
    }
    const data = localStorage.getItem(getStorageKey(MASCOT_CUSTOM_KEY));
    if (!data) return { equipped: "none", unlocked: ["none"] };
    return JSON.parse(data) as MascotCustomization;
  } catch {
    return { equipped: "none", unlocked: ["none"] };
  }
}

export function saveMascotCustomization(custom: MascotCustomization): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      getStorageKey(MASCOT_CUSTOM_KEY),
      JSON.stringify(custom),
    );
    notifyProgressChanged("mascot-customization");
  } catch {
    // localStorage unavailable
  }
}

// ─── Mascot Tier Helper ──────────────────────────────────────────────

function getMascotTierFromMastery(mastery: number): number {
  if (mastery >= 0.8) return 5;
  if (mastery >= 0.6) return 4;
  if (mastery >= 0.4) return 3;
  if (mastery >= 0.2) return 2;
  return 1;
}

// ─── Condition Checker ───────────────────────────────────────────────

function checkCondition(
  condition: BadgeCondition,
  ctx: BadgeCheckContext,
): boolean {
  switch (condition.type) {
    case "streak_days":
      return ctx.currentStreak >= condition.days;

    case "total_questions":
      return ctx.totalQuestions >= condition.count;

    case "perfect_session":
      return (
        ctx.sessionQuestions !== undefined &&
        ctx.sessionQuestions > 0 &&
        ctx.sessionCorrect === ctx.sessionQuestions
      );

    case "skill_mastered": {
      // For "comeback_kid" — check if any skill went from declining to improving
      if (!condition.domain) {
        const stored = loadAllSkillMasteries();
        return stored.some(
          (s) => s.confidenceTrend === "improving" && s.masteryLevel > 0.6,
        );
      }
      // Check if multiple skills in a domain are mastered
      const skillIds = getSkillIdsForDomain(condition.domain);
      const stored = loadAllSkillMasteries();
      const masteredCount = skillIds.filter((id) => {
        const s = stored.find((m) => m.skillId === id);
        return s && s.masteryLevel >= 0.7;
      }).length;
      return masteredCount >= 5;
    }

    case "essay_score_min":
      return (
        ctx.essayAvgScore !== undefined &&
        ctx.essaysWritten >= 3 &&
        ctx.essayAvgScore >= condition.minAverage
      );

    case "essays_written":
      return ctx.essaysWritten >= condition.count;

    case "drill_speed":
      return (
        ctx.drillQuestionsPerMinute !== undefined &&
        ctx.drillQuestionsPerMinute >= condition.questionsPerMinute
      );

    case "domain_mastered": {
      const domainSkillIds = getSkillIdsForDomain(condition.domainId);
      const allMasteries = loadAllSkillMasteries();
      const masteredInDomain = domainSkillIds.filter((id) => {
        const s = allMasteries.find((m) => m.skillId === id);
        return s && s.masteryLevel >= 0.7;
      }).length;
      return masteredInDomain >= 5;
    }

    case "tier_reached": {
      const tier = getMascotTierFromMastery(ctx.overallMastery);
      return tier >= condition.tier;
    }

    case "revision_improved":
      return ctx.revisionImproved === true;

    case "daily_plan_streak":
      return (
        ctx.dailyPlanStreak !== undefined &&
        ctx.dailyPlanStreak >= condition.days
      );

    case "first_assessment":
      return ctx.assessmentCount !== undefined && ctx.assessmentCount >= 1;

    case "vocab_mastered":
      return ctx.vocabMastered !== undefined && ctx.vocabMastered >= condition.count;

    case "all_reading_categories":
      return ctx.readingCategoriesPracticed !== undefined && ctx.readingCategoriesPracticed >= 4;

    case "first_simulation":
      return ctx.simulationCount !== undefined && ctx.simulationCount >= 1;

    case "all_math_tier3": {
      const allSkillMasteries = loadAllSkillMasteries();
      const qrSkillIds = getSkillIdsForDomain("math_quantitative_reasoning");
      const maSkillIds = getSkillIdsForDomain("math_achievement");
      const allMathSkillIds = [...qrSkillIds, ...maSkillIds];
      if (allMathSkillIds.length === 0) return false;
      return allMathSkillIds.every((id) => {
        const s = allSkillMasteries.find((m) => m.skillId === id);
        return s && s.masteryLevel >= 0.4;
      });
    }
  }
}

// ─── Badge Check Engine ──────────────────────────────────────────────

/**
 * Check all badge conditions against current context.
 * Returns only newly earned badges (not previously awarded).
 * Also unlocks mascot accessories for relevant badges.
 */
export function checkAndAwardBadges(
  ctx: BadgeCheckContext,
): readonly BadgeDefinition[] {
  const earned = loadEarnedBadges();
  const earnedIds = new Set(earned.map((b) => b.badgeId));
  const newlyEarned: BadgeDefinition[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (earnedIds.has(badge.id)) continue;
    if (checkCondition(badge.condition, ctx)) {
      newlyEarned.push(badge);
    }
  }

  if (newlyEarned.length > 0) {
    const now = new Date().toISOString();
    const updated = [
      ...earned,
      ...newlyEarned.map((b) => ({ badgeId: b.id, earnedAt: now })),
    ];
    saveBadges(updated);

    // Unlock mascot accessories
    const custom = loadMascotCustomization();
    let changed = false;
    for (const badge of newlyEarned) {
      const accessory = ACCESSORY_UNLOCKS[badge.id];
      if (accessory && !custom.unlocked.includes(accessory)) {
        custom.unlocked.push(accessory);
        changed = true;
      }
    }
    if (changed) {
      saveMascotCustomization(custom);
    }
  }

  return newlyEarned;
}

/**
 * Build a badge check context from current state.
 * Can be extended with optional session-specific fields.
 */
export function buildBadgeContext(
  overrides?: Partial<BadgeCheckContext>,
): BadgeCheckContext {
  const stored = loadAllSkillMasteries();
  const totalQuestions = stored.reduce((s, m) => s + m.attemptsCount, 0);
  const totalCorrect = stored.reduce((s, m) => s + m.correctCount, 0);
  const overallMastery =
    stored.length > 0
      ? stored.reduce((s, m) => s + m.masteryLevel, 0) / stored.length
      : 0;

  return {
    currentStreak: 0,
    longestStreak: 0,
    totalQuestions,
    totalCorrect,
    essaysWritten: 0,
    overallMastery,
    ...overrides,
  };
}

/**
 * Check whether a badge should trigger confetti (special badges).
 */
export function shouldTriggerConfetti(badges: readonly BadgeDefinition[]): boolean {
  const specialIds = new Set([
    "champion",
    "scholar",
    "math_champion",
    "reading_whiz",
    "fraction_master",
  ]);
  return badges.some((b) => specialIds.has(b.id));
}

/**
 * Check whether the student has earned any badge — unlocks mascot naming.
 */
export function canNameMascot(): boolean {
  return loadEarnedBadges().length > 0;
}
