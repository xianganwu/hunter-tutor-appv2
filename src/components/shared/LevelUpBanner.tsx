"use client";

import { useEffect, useState } from "react";
import type { LevelUpEvent } from "@/components/tutor/types";
import { Mascot, type MascotAnimal, getMascotTier } from "./Mascot";
import { getStoredMascotType } from "@/lib/user-profile";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";

interface LevelUpBannerProps {
  readonly event: LevelUpEvent;
  readonly onDismiss: () => void;
}

export function LevelUpBanner({ event, onDismiss }: LevelUpBannerProps) {
  const [visible, setVisible] = useState(false);

  const mascotType: MascotAnimal = getStoredMascotType();
  const storedMasteries = loadAllSkillMasteries();
  const overallMastery =
    storedMasteries.length > 0
      ? storedMasteries.reduce((sum, s) => sum + s.masteryLevel, 0) / storedMasteries.length
      : 0;
  const mascotTier = getMascotTier(overallMastery);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl bg-success-50 px-5 py-3 shadow-glow border border-success-200 dark:bg-success-500/10 dark:border-success-600/30">
        <div className="animate-bounce">
          <Mascot tier={mascotTier} size="sm" mascotType={mascotType} />
        </div>
        <div>
          <div className="text-xs font-medium text-success-600 dark:text-success-400 uppercase tracking-wide">
            Level Up!
          </div>
          <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            You reached <strong>{event.newTierLabel}</strong> on {event.skillName}!
          </div>
        </div>
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="ml-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
