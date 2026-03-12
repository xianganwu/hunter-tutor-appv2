"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StreakDisplay } from "./StreakDisplay";
import { UserMenu } from "./UserMenu";
import { DailyPracticePlan } from "./DailyPracticePlan";
import { useDashboardData } from "./use-dashboard-data";
import { Mascot, getMascotTier, getMascotLabel, type MascotAnimal } from "@/components/shared/Mascot";
import { BadgeNotification } from "@/components/shared/BadgeNotification";
import { Confetti } from "@/components/shared/Confetti";
import { getStoredMascotType, getStoredAuthUser, setStoredAuthUser } from "@/lib/user-profile";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import { shouldTriggerConfetti, type BadgeDefinition } from "@/lib/achievements";
import { authUpdateMascot } from "@/lib/auth-client";
import { MascotPicker } from "@/components/shared/MascotPicker";

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
  const { skillStates, streakData, newlyEarnedBadges, loading } =
    useDashboardData();

  const [showBadgeNotification, setShowBadgeNotification] = useState(true);
  const [mascotType, setMascotType] = useState<MascotAnimal>(getStoredMascotType());
  const [showMascotPicker, setShowMascotPicker] = useState(false);

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

        {/* Header: Greeting + Streak */}
        <section className="animate-slide-up">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMascotPicker(true)}
              className="rounded-xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 dark:focus:ring-offset-surface-950"
              title="Change mascot"
            >
              <Mascot tier={mascotTier} size="lg" mascotType={mascotType} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 md:text-3xl">
                Welcome back!
              </h1>
              <p className="text-xs font-medium text-surface-400 dark:text-surface-500">
                Your {mascotType}: {getMascotLabel(mascotTier, mascotType)}{" "}
                <button
                  onClick={() => setShowMascotPicker(true)}
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  (change)
                </button>
              </p>
            </div>
          </div>
          {showMascotPicker && (
            <MascotPicker
              currentMascot={mascotType}
              onSelect={async (newType) => {
                const result = await authUpdateMascot(newType);
                if (result.user) {
                  setStoredAuthUser(result.user);
                  setMascotType(newType);
                }
                setShowMascotPicker(false);
              }}
              onClose={() => setShowMascotPicker(false)}
            />
          )}
          <p className="mt-1 text-sm font-medium text-brand-600 dark:text-brand-400">
            {TIER_MESSAGES[mascotTier]}
          </p>
          <div className="mt-4">
            <StreakDisplay data={streakData} />
          </div>
        </section>

        {/* Daily Practice Plan */}
        <section className="animate-fade-in">
          <DailyPracticePlan mascotTier={mascotTier} mascotType={mascotType} />
        </section>

        {/* Parent link */}
        <div className="flex justify-center">
          <a
            href="/parent"
            className="text-sm font-medium text-surface-400 transition-colors hover:text-brand-600 dark:text-surface-500 dark:hover:text-brand-400"
          >
            Parent Dashboard &rarr;
          </a>
        </div>
      </div>
    </main>
  );
}
