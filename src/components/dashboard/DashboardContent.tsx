"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StreakDisplay } from "./StreakDisplay";
import { UserMenu } from "./UserMenu";
import { DailyPracticePlan } from "./DailyPracticePlan";
import { useDashboardData } from "./use-dashboard-data";
import { getMascotTier, getMascotLabel, type MascotAnimal } from "@/components/shared/Mascot";
import { MascotWithAccessory } from "@/components/shared/MascotWithAccessory";
import { EvolutionModal } from "@/components/shared/EvolutionModal";
import { BadgeNotification } from "@/components/shared/BadgeNotification";
import { Confetti } from "@/components/shared/Confetti";
import { getStoredMascotType, getStoredMascotName, setStoredMascotName, getStoredAuthUser, setStoredAuthUser } from "@/lib/user-profile";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import { shouldTriggerConfetti, canNameMascot, loadMascotCustomization, type BadgeDefinition } from "@/lib/achievements";
import { authUpdateMascot, authUpdateMascotName } from "@/lib/auth-client";

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
  const [mascotName, setMascotName] = useState<string | null>(getStoredMascotName());
  const [showEvolutionModal, setShowEvolutionModal] = useState(false);

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

  const tierThresholds = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const tierStart = tierThresholds[mascotTier - 1];
  const tierEnd = tierThresholds[mascotTier] ?? 1.0;
  const tierProgress = mascotTier >= 5
    ? 1
    : Math.min(1, Math.max(0, (overallMastery - tierStart) / (tierEnd - tierStart)));
  const nextTierLabel = mascotTier < 5
    ? getMascotLabel((mascotTier + 1) as 1 | 2 | 3 | 4 | 5, mascotType)
    : null;
  const progressTitle = nextTierLabel
    ? `${Math.round(tierProgress * 100)}% to ${nextTierLabel}`
    : "Max evolution!";

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
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setShowEvolutionModal(true)}
                className="rounded-xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 dark:focus:ring-offset-surface-950"
                title="View evolution & accessories"
              >
                <MascotWithAccessory
                  tier={mascotTier}
                  size="lg"
                  mascotType={mascotType}
                  accessory={loadMascotCustomization().equipped}
                />
              </button>
              <div
                className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700"
                title={progressTitle}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
                  style={{ width: `${Math.round(tierProgress * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 md:text-3xl">
                Welcome back{mascotName ? `, ${mascotName}` : ""}!
              </h1>
              <p className="text-xs font-medium text-surface-400 dark:text-surface-500">
                {mascotName ? `${mascotName} the ` : "Your "}{getMascotLabel(mascotTier, mascotType)}{" "}
                <button
                  onClick={() => setShowEvolutionModal(true)}
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  (customize)
                </button>
              </p>
            </div>
          </div>
          <EvolutionModal
            isOpen={showEvolutionModal}
            onClose={() => setShowEvolutionModal(false)}
            mascotType={mascotType}
            currentTier={mascotTier}
            overallMastery={overallMastery}
            mascotName={mascotName}
            canName={canNameMascot()}
            onNameSave={async (name) => {
              setStoredMascotName(name);
              setMascotName(name);
              await authUpdateMascotName(name);
            }}
            onMascotChange={async (newType) => {
              const result = await authUpdateMascot(newType);
              if (result.user) {
                setStoredAuthUser(result.user);
                setMascotType(newType);
              }
            }}
          />
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
