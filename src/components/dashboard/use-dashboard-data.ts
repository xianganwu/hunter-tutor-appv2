"use client";

import { useState, useEffect } from "react";
import { getAllSkills, getSkillIdsForDomain } from "@/lib/exam/curriculum";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import { getStorageKey, notifyProgressChanged } from "@/lib/user-profile";
import { loadMistakes } from "@/lib/mistakes";
import { loadStaminaProgress } from "@/lib/reading-stamina";
import { loadTeachingMoments } from "@/lib/teaching-moments";
import { loadSimulationHistory } from "@/lib/simulation";
import { loadDrillHistory } from "@/lib/drill";
import {
  checkAndAwardBadges,
  buildBadgeContext,
  type BadgeDefinition,
} from "@/lib/achievements";
import { maybeSnapshotMastery } from "@/lib/weekly-digest";
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
const FREEZE_STORAGE_KEY = "hunter-tutor-streak-freezes";
const FREEZES_PER_WEEK = 2;

interface StreakFreezeData {
  frozenDates: string[];
  weekStart: string;
  freezesUsedThisWeek: number;
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function loadStreakFreezes(): StreakFreezeData {
  const empty: StreakFreezeData = {
    frozenDates: [],
    weekStart: getMonday(new Date()),
    freezesUsedThisWeek: 0,
  };
  try {
    if (typeof window === "undefined") return empty;
    const key = getStorageKey(FREEZE_STORAGE_KEY);
    const raw = localStorage.getItem(key);
    if (!raw) return empty;
    const data = JSON.parse(raw) as StreakFreezeData;
    const currentMonday = getMonday(new Date());
    if (data.weekStart !== currentMonday) {
      return { frozenDates: data.frozenDates, weekStart: currentMonday, freezesUsedThisWeek: 0 };
    }
    return data;
  } catch {
    return empty;
  }
}

function saveStreakFreezes(data: StreakFreezeData): void {
  try {
    if (typeof window === "undefined") return;
    const key = getStorageKey(FREEZE_STORAGE_KEY);
    localStorage.setItem(key, JSON.stringify(data));
    notifyProgressChanged("streak-freezes");
  } catch {
    // localStorage unavailable
  }
}

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

function computeStreaks(
  sortedDates: readonly string[],
  frozenDates: readonly string[],
): {
  currentStreak: number;
  longestStreak: number;
} {
  // Combine practiced and frozen dates for streak counting
  const activeSet = new Set([...sortedDates, ...frozenDates]);
  const allSorted = [...activeSet].sort();

  if (allSorted.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - MS_PER_DAY)
    .toISOString()
    .split("T")[0];

  // Current streak: consecutive days ending today or yesterday
  let currentStreak = 0;
  if (activeSet.has(today) || activeSet.has(yesterday)) {
    const start = activeSet.has(today) ? today : yesterday;
    let d = new Date(start + "T00:00:00");
    while (activeSet.has(d.toISOString().split("T")[0])) {
      currentStreak++;
      d = new Date(d.getTime() - MS_PER_DAY);
    }
  }

  // Longest streak
  let longest = 1;
  let streak = 1;
  for (let i = 1; i < allSorted.length; i++) {
    const prev = new Date(allSorted[i - 1] + "T00:00:00").getTime();
    const curr = new Date(allSorted[i] + "T00:00:00").getTime();
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
  readonly newlyEarnedBadges: readonly BadgeDefinition[];
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
    newlyEarnedBadges: [],
    loading: true,
  });

  useEffect(() => {
    const allSkills = getAllSkills();
    const stored = loadAllSkillMasteries();
    const mistakes = loadMistakes();
    const stamina = loadStaminaProgress();
    const teachingMoments = loadTeachingMoments();
    const simulations = loadSimulationHistory();
    const drills = loadDrillHistory();

    // Trigger weekly mastery snapshot if applicable
    maybeSnapshotMastery();

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

    // Streak data — include drill dates
    const drillDates = drills.map((d) => ({
      completedAt: d.completedAt,
    }));
    const sortedDates = collectActivityDates(
      stored,
      mistakes,
      stamina.records,
      teachingMoments,
      [...simulations, ...drillDates.map((d) => ({ completedAt: d.completedAt }))],
    );

    // Auto-freeze: if yesterday was not practiced but today was, apply a freeze
    const freezeData = loadStreakFreezes();
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterdayStr = new Date(Date.now() - MS_PER_DAY)
      .toISOString()
      .split("T")[0];
    const practicedSet = new Set(sortedDates);
    const frozenSet = new Set(freezeData.frozenDates);

    if (
      practicedSet.has(todayStr) &&
      !practicedSet.has(yesterdayStr) &&
      !frozenSet.has(yesterdayStr) &&
      freezeData.freezesUsedThisWeek < FREEZES_PER_WEEK
    ) {
      freezeData.frozenDates.push(yesterdayStr);
      freezeData.freezesUsedThisWeek++;
      saveStreakFreezes(freezeData);
    }

    const { currentStreak, longestStreak } = computeStreaks(sortedDates, freezeData.frozenDates);
    const fourteenDaysAgo = new Date(Date.now() - 14 * MS_PER_DAY)
      .toISOString()
      .split("T")[0];
    // Merge frozen dates into practiced dates so they display as normal practice days
    const recentFrozen = freezeData.frozenDates.filter((d) => d >= fourteenDaysAgo);
    const recentDates = [...new Set([...sortedDates.filter((d) => d >= fourteenDaysAgo), ...recentFrozen])].sort();

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

    // Check and award badges
    const overallMastery =
      states.length > 0
        ? states.reduce((sum, s) => sum + s.masteryLevel, 0) / states.length
        : 0;
    const totalQuestions = states.reduce((sum, s) => sum + s.attemptsCount, 0);
    const totalCorrect = states.reduce((sum, s) => sum + s.correctCount, 0);
    const badgeCtx = buildBadgeContext({
      currentStreak,
      longestStreak,
      totalQuestions,
      totalCorrect,
      overallMastery,
    });
    const newlyEarned = checkAndAwardBadges(badgeCtx);

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
      newlyEarnedBadges: newlyEarned,
      loading: false,
    });
  }, []);

  return data;
}
