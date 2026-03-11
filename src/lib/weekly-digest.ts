import { getStorageKey } from "./user-profile";
import { loadAllSkillMasteries } from "./skill-mastery-store";
import { loadEarnedBadges, BADGE_DEFINITIONS } from "./achievements";
import { loadDrillHistory } from "./drill";

// ─── Types ────────────────────────────────────────────────────────────

export interface WeeklyDigest {
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly practiceDays: number;
  readonly totalMinutes: number;
  readonly skillsImproved: readonly {
    name: string;
    before: number;
    after: number;
  }[];
  readonly areasNeedingAttention: readonly {
    name: string;
    mastery: number;
  }[];
  readonly streakStatus: { current: number; longest: number };
  readonly essaysWritten: number;
  readonly drillsCompleted: number;
  readonly badgesEarned: readonly string[];
  readonly aiNarrative: string;
}

export interface MasterySnapshot {
  readonly date: string; // YYYY-MM-DD
  readonly skills: readonly { skillId: string; mastery: number }[];
}

// ─── Storage ─────────────────────────────────────────────────────────

const SNAPSHOTS_KEY = "hunter-tutor-weekly-snapshots";

export function loadWeeklySnapshots(): MasterySnapshot[] {
  try {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(getStorageKey(SNAPSHOTS_KEY));
    if (!data) return [];
    return JSON.parse(data) as MasterySnapshot[];
  } catch {
    return [];
  }
}

function saveWeeklySnapshots(snapshots: readonly MasterySnapshot[]): void {
  try {
    if (typeof window === "undefined") return;
    // Keep only last 4 weeks
    const trimmed = snapshots.slice(-4);
    localStorage.setItem(
      getStorageKey(SNAPSHOTS_KEY),
      JSON.stringify(trimmed),
    );
  } catch {
    // localStorage unavailable
  }
}

/**
 * Take a mastery snapshot if it's Monday and we don't have one for this week yet.
 */
export function maybeSnapshotMastery(): void {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  if (day !== 1) return; // Only on Monday

  const today = now.toISOString().split("T")[0];
  const snapshots = loadWeeklySnapshots();
  if (snapshots.some((s) => s.date === today)) return;

  const stored = loadAllSkillMasteries();
  const skills = stored.map((s) => ({
    skillId: s.skillId,
    mastery: s.masteryLevel,
  }));

  snapshots.push({ date: today, skills });
  saveWeeklySnapshots(snapshots);
}

// ─── Digest Computation ──────────────────────────────────────────────

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day;
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start.toISOString().split("T")[0];
}

function getWeekEnd(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() + (6 - day);
  const end = new Date(now);
  end.setDate(diff);
  return end.toISOString().split("T")[0];
}

/**
 * Compute the weekly digest from available data.
 * The AI narrative is set to empty — caller should fetch it from the API.
 */
export function computeWeeklyDigest(
  practiceDays: number,
  totalMinutes: number,
  streakData: { current: number; longest: number },
  essaysWritten: number,
): WeeklyDigest {
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();

  // Skills improved: compare current mastery to start-of-week snapshot
  const snapshots = loadWeeklySnapshots();
  const currentSkills = loadAllSkillMasteries();
  const skillsImproved: { name: string; before: number; after: number }[] = [];
  const areasNeedingAttention: { name: string; mastery: number }[] = [];

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  for (const skill of currentSkills) {
    const before = latestSnapshot?.skills.find(
      (s) => s.skillId === skill.skillId,
    )?.mastery;

    if (before !== undefined && skill.masteryLevel > before + 0.05) {
      skillsImproved.push({
        name: skill.skillId,
        before: Math.round(before * 100),
        after: Math.round(skill.masteryLevel * 100),
      });
    }

    if (skill.masteryLevel < 0.4 && skill.attemptsCount > 0) {
      areasNeedingAttention.push({
        name: skill.skillId,
        mastery: Math.round(skill.masteryLevel * 100),
      });
    }
  }

  // Drills this week
  const drills = loadDrillHistory();
  const weekStartDate = new Date(weekStart + "T00:00:00").getTime();
  const drillsThisWeek = drills.filter(
    (d) => new Date(d.completedAt).getTime() >= weekStartDate,
  ).length;

  // Badges earned this week
  const badges = loadEarnedBadges();
  const badgesThisWeek = badges
    .filter((b) => new Date(b.earnedAt).getTime() >= weekStartDate)
    .map((b) => {
      const def = BADGE_DEFINITIONS.find((d) => d.id === b.badgeId);
      return def ? `${def.icon} ${def.name}` : b.badgeId;
    });

  return {
    weekStart,
    weekEnd,
    practiceDays,
    totalMinutes,
    skillsImproved: skillsImproved.slice(0, 5),
    areasNeedingAttention: areasNeedingAttention.slice(0, 5),
    streakStatus: streakData,
    essaysWritten,
    drillsCompleted: drillsThisWeek,
    badgesEarned: badgesThisWeek,
    aiNarrative: "",
  };
}

// ─── Plain Text Formatter ────────────────────────────────────────────

export function formatDigestAsText(digest: WeeklyDigest): string {
  const lines: string[] = [];

  lines.push("--- WEEKLY PROGRESS REPORT ---");
  lines.push(`Week: ${digest.weekStart} to ${digest.weekEnd}`);
  lines.push("");

  if (digest.aiNarrative) {
    lines.push(digest.aiNarrative);
    lines.push("");
  }

  lines.push("PRACTICE SUMMARY");
  lines.push(`  Days active: ${digest.practiceDays}`);
  lines.push(`  Total minutes: ${digest.totalMinutes}`);
  lines.push(
    `  Current streak: ${digest.streakStatus.current} day${digest.streakStatus.current !== 1 ? "s" : ""}`,
  );
  lines.push(`  Essays written: ${digest.essaysWritten}`);
  lines.push(`  Drills completed: ${digest.drillsCompleted}`);
  lines.push("");

  if (digest.skillsImproved.length > 0) {
    lines.push("SKILLS IMPROVED");
    for (const s of digest.skillsImproved) {
      lines.push(`  ${s.name}: ${s.before}% -> ${s.after}%`);
    }
    lines.push("");
  }

  if (digest.areasNeedingAttention.length > 0) {
    lines.push("AREAS NEEDING ATTENTION");
    for (const a of digest.areasNeedingAttention) {
      lines.push(`  ${a.name}: ${a.mastery}% mastery`);
    }
    lines.push("");
  }

  if (digest.badgesEarned.length > 0) {
    lines.push("BADGES EARNED THIS WEEK");
    for (const b of digest.badgesEarned) {
      lines.push(`  ${b}`);
    }
    lines.push("");
  }

  lines.push("--- Generated by Hunter Tutor ---");

  return lines.join("\n");
}
