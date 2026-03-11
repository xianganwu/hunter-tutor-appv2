import type { ConfidenceTrend } from "@/lib/adaptive";

/** Serializable version of StudentSkillState for server→client prop passing */
export interface SerializedSkillState {
  readonly skillId: string;
  readonly masteryLevel: number;
  readonly attemptsCount: number;
  readonly correctCount: number;
  readonly lastPracticed: string | null; // ISO date string
  readonly confidenceTrend: ConfidenceTrend;
}

export interface DomainProgress {
  readonly domainId: string;
  readonly domainName: string;
  readonly overallMastery: number;
  readonly skillCount: number;
  readonly masteredCount: number; // mastery > 0.7
  readonly inProgressCount: number; // 0.4-0.7
  readonly needsWorkCount: number; // < 0.4
}

export interface StreakData {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly practicedDates: readonly string[]; // ISO date strings, last 14 days
  readonly frozenDates: readonly string[];    // YYYY-MM-DD dates where a streak freeze was used
  readonly freezesRemaining: number;          // freezes left this week (max freezesPerWeek)
  readonly freezesPerWeek: number;            // constant = 2
}

export interface WeeklySummaryData {
  readonly skillsImproved: readonly {
    readonly skillId: string;
    readonly skillName: string;
    readonly delta: number;
  }[];
  readonly totalMinutesPracticed: number;
  readonly sessionsCompleted: number;
  readonly areasToFocus: readonly {
    readonly skillId: string;
    readonly skillName: string;
    readonly reason: string;
  }[];
}

/** Computed layout position for a skill node in the SVG skill map */
export interface SkillNodeLayout {
  readonly skillId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly mastery: number;
  readonly attemptsCount: number;
  readonly confidenceTrend: ConfidenceTrend;
  readonly domainId: string;
}

export interface SkillEdgeLayout {
  readonly fromId: string;
  readonly toId: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}
