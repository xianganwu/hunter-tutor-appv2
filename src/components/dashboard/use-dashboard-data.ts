"use client";

import { useState, useEffect } from "react";
import { getAllSkills, getSkillIdsForDomain } from "@/lib/exam/curriculum";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import { loadMistakes } from "@/lib/mistakes";
import { loadStaminaProgress } from "@/lib/reading-stamina";
import { loadTeachingMoments } from "@/lib/teaching-moments";
import { loadSimulationHistory } from "@/lib/simulation";
import type {
  SerializedSkillState,
  DomainProgress,
  StreakData,
  WeeklySummaryData,
} from "./types";

const DOMAIN_IDS = [
  "reading_comprehension",
  "math_quantitative_reasoning",
  "math_achievement",
] as const;

const DOMAIN_NAMES: Record<string, string> = {
  reading_comprehension: "Reading Comprehension",
  math_quantitative_reasoning: "Math: Quantitative Reasoning",
  math_achievement: "Math: Achievement",
};

const MS_PER_DAY = 86_400_000;

function collectActivityDates(
  stored: readonly { lastPracticed: string }[],
  mistakes: readonly { createdAt: string }[],
  staminaRecords: readonly { timestamp: number }[],
  teachingMoments: readonly { createdAt: string }[],
  simulations: readonly { completedAt: string }[],
): string[] {
  const dates = new Set<string>();

  for (const s of stored) {
    if (s.lastPracticed) dates.add(s.lastPracticed.split("T")[0]);
  }
  for (const m of mistakes) {
    dates.add(m.createdAt.split("T")[0]);
  }
  for (const r of staminaRecords) {
    dates.add(new Date(r.timestamp).toISOString().split("T")[0]);
  }
  for (const t of teachingMoments) {
    dates.add(t.createdAt.split("T")[0]);
  }
  for (const sim of simulations) {
    dates.add(sim.completedAt.split("T")[0]);
  }

  return [...dates].sort();
}

function computeStreaks(sortedDates: readonly string[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (sortedDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - MS_PER_DAY)
    .toISOString()
    .split("T")[0];
  const dateSet = new Set(sortedDates);

  // Current streak: consecutive days ending today or yesterday
  let currentStreak = 0;
  if (dateSet.has(today) || dateSet.has(yesterday)) {
    const start = dateSet.has(today) ? today : yesterday;
    let d = new Date(start + "T00:00:00");
    while (dateSet.has(d.toISOString().split("T")[0])) {
      currentStreak++;
      d = new Date(d.getTime() - MS_PER_DAY);
    }
  }

  // Longest streak
  let longest = 1;
  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + "T00:00:00").getTime();
    const curr = new Date(sortedDates[i] + "T00:00:00").getTime();
    if (curr - prev === MS_PER_DAY) {
      streak++;
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak, currentStreak);

  return { currentStreak, longestStreak: longest };
}

export interface DashboardData {
  readonly skillStates: readonly SerializedSkillState[];
  readonly domainProgress: readonly DomainProgress[];
  readonly streakData: StreakData;
  readonly weeklySummary: WeeklySummaryData;
  readonly loading: boolean;
}

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    skillStates: [],
    domainProgress: [],
    streakData: { currentStreak: 0, longestStreak: 0, practicedDates: [] },
    weeklySummary: {
      skillsImproved: [],
      totalMinutesPracticed: 0,
      sessionsCompleted: 0,
      areasToFocus: [],
    },
    loading: true,
  });

  useEffect(() => {
    const allSkills = getAllSkills();
    const stored = loadAllSkillMasteries();
    const mistakes = loadMistakes();
    const stamina = loadStaminaProgress();
    const teachingMoments = loadTeachingMoments();
    const simulations = loadSimulationHistory();

    // Build skill states for every skill in the catalog
    const storedMap = new Map(stored.map((s) => [s.skillId, s]));
    const states: SerializedSkillState[] = [];
    for (const [skillId] of allSkills) {
      const s = storedMap.get(skillId);
      states.push({
        skillId,
        masteryLevel: s?.masteryLevel ?? 0,
        attemptsCount: s?.attemptsCount ?? 0,
        correctCount: s?.correctCount ?? 0,
        lastPracticed: s?.lastPracticed ?? null,
        confidenceTrend: s?.confidenceTrend ?? "stable",
      });
    }

    // Domain progress
    const domains: DomainProgress[] = DOMAIN_IDS.map((domainId) => {
      const skillIds = getSkillIdsForDomain(domainId);
      const masteries = skillIds.map(
        (id) => states.find((s) => s.skillId === id)?.masteryLevel ?? 0,
      );
      const avg =
        masteries.length > 0
          ? masteries.reduce((a, b) => a + b, 0) / masteries.length
          : 0;

      return {
        domainId,
        domainName: DOMAIN_NAMES[domainId] ?? domainId,
        overallMastery: avg,
        skillCount: skillIds.length,
        masteredCount: masteries.filter((m) => m > 0.7).length,
        inProgressCount: masteries.filter((m) => m >= 0.4 && m <= 0.7).length,
        needsWorkCount: masteries.filter((m) => m < 0.4).length,
      };
    });

    // Streak data
    const sortedDates = collectActivityDates(
      stored,
      mistakes,
      stamina.records,
      teachingMoments,
      simulations,
    );
    const { currentStreak, longestStreak } = computeStreaks(sortedDates);
    const fourteenDaysAgo = new Date(Date.now() - 14 * MS_PER_DAY)
      .toISOString()
      .split("T")[0];
    const recentDates = sortedDates.filter((d) => d >= fourteenDaysAgo);

    // Weekly summary
    const oneWeekAgo = new Date(Date.now() - 7 * MS_PER_DAY)
      .toISOString()
      .split("T")[0];

    let minutesThisWeek = 0;
    for (const r of stamina.records) {
      if (new Date(r.timestamp).toISOString().split("T")[0] >= oneWeekAgo) {
        minutesThisWeek += r.readingTimeSeconds / 60;
      }
    }
    for (const sim of simulations) {
      if (sim.completedAt.split("T")[0] >= oneWeekAgo) {
        const t = sim.report.timeAnalysis;
        minutesThisWeek += t.elaUsedMinutes + t.mathUsedMinutes;
      }
    }

    const weekDates = sortedDates.filter((d) => d >= oneWeekAgo);

    // Focus areas: low mastery or stale skills
    const now = Date.now();
    const areasToFocus: { skillId: string; skillName: string; reason: string }[] = [];
    for (const s of states) {
      const skillInfo = allSkills.get(s.skillId);
      const name = skillInfo?.name ?? s.skillId;

      if (s.attemptsCount > 0 && s.masteryLevel < 0.4) {
        areasToFocus.push({
          skillId: s.skillId,
          skillName: name,
          reason: `Mastery at ${Math.round(s.masteryLevel * 100)}%`,
        });
      } else if (s.lastPracticed && s.masteryLevel < 0.8) {
        const daysSince = Math.floor(
          (now - new Date(s.lastPracticed).getTime()) / MS_PER_DAY,
        );
        if (daysSince >= 7) {
          areasToFocus.push({
            skillId: s.skillId,
            skillName: name,
            reason: `Not practiced in ${daysSince} days`,
          });
        }
      }
    }

    setData({
      skillStates: states,
      domainProgress: domains,
      streakData: {
        currentStreak,
        longestStreak,
        practicedDates: recentDates,
      },
      weeklySummary: {
        skillsImproved: [],
        totalMinutesPracticed: Math.round(minutesThisWeek),
        sessionsCompleted: weekDates.length,
        areasToFocus: areasToFocus.slice(0, 5),
      },
      loading: false,
    });
  }, []);

  return data;
}
