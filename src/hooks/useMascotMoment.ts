"use client";

import { useState, useCallback } from "react";
import { getMascotTier, type MascotAnimal } from "@/components/shared/Mascot";
import { getStoredMascotType, getStoredMascotName } from "@/lib/user-profile";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import type { MascotMomentType } from "@/components/shared/mascot-moments";

/**
 * Shared hook that provides mascot identity (type + tier) and
 * a trigger API for firing mascot moments.
 *
 * Eliminates the ~10 lines of boilerplate previously copy-pasted
 * across TutoringSession, DrillMode, and MixedDrill.
 */
export function useMascotMoment() {
  const mascotType: MascotAnimal = (getStoredMascotType() as MascotAnimal) ?? "penguin";
  const mascotName = getStoredMascotName();

  const storedMasteries = loadAllSkillMasteries();
  const overallMastery =
    storedMasteries.length > 0
      ? storedMasteries.reduce((sum, s) => sum + s.masteryLevel, 0) /
        storedMasteries.length
      : 0;
  const mascotTier = getMascotTier(overallMastery);

  const [moment, setMoment] = useState<MascotMomentType | null>(null);
  const [momentKey, setMomentKey] = useState(0);

  const triggerMoment = useCallback((m: MascotMomentType) => {
    setMoment(m);
    setMomentKey((k) => k + 1);
  }, []);

  const clearMoment = useCallback(() => {
    setMoment(null);
  }, []);

  return { mascotType, mascotTier, mascotName, moment, momentKey, triggerMoment, clearMoment };
}
