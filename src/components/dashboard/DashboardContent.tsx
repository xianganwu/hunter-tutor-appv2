"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SkillMap } from "./SkillMap";
import { DomainCard } from "./DomainCard";
import { WeeklySummary } from "./WeeklySummary";
import { StreakDisplay } from "./StreakDisplay";
import { ContinueLearningButton } from "./ContinueLearningButton";
import { UserMenu } from "./UserMenu";
import { DailyPracticePlan } from "./DailyPracticePlan";
import { BadgeGallery } from "./BadgeGallery";
import { useDashboardData } from "./use-dashboard-data";
import { Mascot, getMascotTier, getMascotLabel, type MascotAnimal } from "@/components/shared/Mascot";
import { BadgeNotification } from "@/components/shared/BadgeNotification";
import { Confetti } from "@/components/shared/Confetti";
import { getStoredMascotType, getStoredAuthUser } from "@/lib/user-profile";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import { shouldTriggerConfetti, type BadgeDefinition } from "@/lib/achievements";

export function DashboardContent() {
  const router = useRouter();

  useEffect(() => {
    const authUser = getStoredAuthUser();
    // Only redirect to onboarding if the user hasn't completed it AND has no existing practice data
    // (existing users who were active before onboarding was added will have mastery data)
    if (authUser && authUser.onboardingComplete === false) {
      const hasExistingData = loadAllSkillMasteries().length > 0;
      if (!hasExistingData) {
        router.replace("/onboarding");
      }
    }
  }, [router]);
  const { skillStates, domainProgress, streakData, weeklySummary, newlyEarnedBadges, loading } =
    useDashboardData();

  const [showBadgeNotification, setShowBadgeNotification] = useState(true);

  const handleBadgeDismiss = useCallback(() => {
    setShowBadgeNotification(false);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        </div>
      </main>
    );
  }

  const mascotType: MascotAnimal = getStoredMascotType();
  const hasActivity = skillStates.some((s) => s.attemptsCount > 0);
  const overallMastery =
    skillStates.length > 0
      ? skillStates.reduce((sum, s) => sum + s.masteryLevel, 0) /
        skillStates.length
      : 0;
  const mascotTier = getMascotTier(overallMastery);

  const TIER_MESSAGES: Record<number, string> = {
    1: "Every expert was once a beginner. Let's get started!",
    2: "You're exploring new territory. Keep going!",
    3: "You crushed it last time. Ready to level up?",
    4: "You're becoming a real scholar. Almost there!",
    5: "Champion status! Keep that crown shining!",
  };

  const badgesToShow: readonly BadgeDefinition[] = showBadgeNotification ? newlyEarnedBadges : [];

  return (
    <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <Confetti active={shouldTriggerConfetti(badgesToShow)} />
      <BadgeNotification badges={badgesToShow} onDismiss={handleBadgeDismiss} />

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* User Menu */}
        <section className="flex animate-fade-in justify-end">
          <UserMenu />
        </section>

        {/* Header: Greeting + Streak + Continue Learning */}
        <section className="flex animate-slide-up flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Mascot tier={mascotTier} size="lg" mascotType={mascotType} />
              <div>
                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 md:text-3xl">
                  Welcome back!
                </h1>
                <p className="text-xs font-medium text-surface-400 dark:text-surface-500">
                  Your {mascotType === "monkey" ? "monkey" : "penguin"}: {getMascotLabel(mascotTier, mascotType)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-surface-500 dark:text-surface-400">
              {hasActivity
                ? "Keep up the great work. Every practice session builds your skills for the future!"
                : "Ready to start building your skills? Pick a subject below to begin!"}
            </p>
            <p className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
              {TIER_MESSAGES[mascotTier]}
            </p>
            <div className="mt-4">
              <StreakDisplay data={streakData} />
            </div>
          </div>
          <div className="flex-shrink-0">
            <ContinueLearningButton states={skillStates} />
          </div>
        </section>

        {/* Daily Practice Plan */}
        <section className="animate-fade-in">
          <DailyPracticePlan />
        </section>

        {/* Skill Map */}
        <section className="animate-fade-in">
          <SkillMap states={skillStates} />
        </section>

        {/* Domain Cards */}
        <section className="animate-fade-in">
          <h2 className="mb-4 text-xl font-semibold text-surface-800 dark:text-surface-100">
            Practice by Subject
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {domainProgress.map((dp) => (
              <DomainCard key={dp.domainId} progress={dp} />
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section className="animate-fade-in">
          <h2 className="mb-4 text-xl font-semibold text-surface-800 dark:text-surface-100">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <a
              href="/mistakes"
              className="flex flex-col items-center gap-2 rounded-2xl bg-surface-0 px-4 py-5 text-sm font-medium text-surface-700 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow dark:bg-surface-900 dark:text-surface-300"
            >
              <span className="text-2xl" aria-hidden="true">
                📝
              </span>
              <span>Mistake Journal</span>
            </a>
            <a
              href="/tutor/writing"
              className="flex flex-col items-center gap-2 rounded-2xl bg-surface-0 px-4 py-5 text-sm font-medium text-surface-700 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow dark:bg-surface-900 dark:text-surface-300"
            >
              <span className="text-2xl" aria-hidden="true">
                ✍️
              </span>
              <span>Writing Workshop</span>
            </a>
            <a
              href="/tutor/reading"
              className="flex flex-col items-center gap-2 rounded-2xl bg-surface-0 px-4 py-5 text-sm font-medium text-surface-700 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow dark:bg-surface-900 dark:text-surface-300"
            >
              <span className="text-2xl" aria-hidden="true">
                📚
              </span>
              <span>Reading Stamina</span>
            </a>
            <a
              href="/drill"
              className="flex flex-col items-center gap-2 rounded-2xl border border-streak-200 bg-streak-50 px-4 py-5 text-sm font-medium text-streak-600 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-streak dark:border-streak-600/30 dark:bg-streak-600/10 dark:text-streak-400"
            >
              <span className="text-2xl" aria-hidden="true">
                ⚡
              </span>
              <span>Timed Drill</span>
            </a>
            <a
              href="/vocab"
              className="flex flex-col items-center gap-2 rounded-2xl bg-surface-0 px-4 py-5 text-sm font-medium text-surface-700 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow dark:bg-surface-900 dark:text-surface-300"
            >
              <span className="text-2xl" aria-hidden="true">
                📖
              </span>
              <span>Vocab Builder</span>
            </a>
            <a
              href="/simulate"
              className="flex flex-col items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-5 text-sm font-medium text-brand-700 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-300"
            >
              <span className="text-2xl" aria-hidden="true">
                🎯
              </span>
              <span>Practice Exam</span>
            </a>
            <a
              href="/parent"
              className="flex flex-col items-center gap-2 rounded-2xl border border-streak-200 bg-streak-50 px-4 py-5 text-sm font-medium text-streak-600 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-streak dark:border-streak-600/30 dark:bg-streak-600/10 dark:text-streak-400"
            >
              <span className="text-2xl" aria-hidden="true">
                👨‍👩‍👧
              </span>
              <span>Parent Dashboard</span>
            </a>
          </div>
        </section>

        {/* Badge Gallery */}
        <section className="animate-fade-in">
          <BadgeGallery />
        </section>

        {/* Weekly Summary */}
        <section className="animate-fade-in">
          <WeeklySummary data={weeklySummary} />
        </section>
      </div>
    </main>
  );
}
