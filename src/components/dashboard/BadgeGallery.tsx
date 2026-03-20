"use client";

import { useState } from "react";
import {
  BADGE_DEFINITIONS,
  loadEarnedBadges,
  loadMascotCustomization,
  saveMascotCustomization,
  type MascotAccessory,
  type StoredBadge,
} from "@/lib/achievements";

const ACCESSORY_LABELS: Record<MascotAccessory, string> = {
  none: "None",
  party_hat: "Party Hat",
  graduation_cap: "Graduation Cap",
  star_badge: "Star Badge",
  cape: "Hero Cape",
};

export function BadgeGallery() {
  const [earned] = useState<StoredBadge[]>(() => loadEarnedBadges());
  const [customization, setCustomization] = useState(() =>
    loadMascotCustomization(),
  );
  const [showCustomizer, setShowCustomizer] = useState(false);

  const earnedIds = new Set(earned.map((b) => b.badgeId));

  const handleEquip = (accessory: MascotAccessory) => {
    const updated = { ...customization, equipped: accessory };
    setCustomization(updated);
    saveMascotCustomization(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
          Badges
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-500">
            {earned.length}/{BADGE_DEFINITIONS.length} earned
          </span>
          {customization.unlocked.length > 1 && (
            <button
              onClick={() => setShowCustomizer((v) => !v)}
              className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
            >
              {showCustomizer ? "Hide" : "Customize Mascot"}
            </button>
          )}
        </div>
      </div>

      {/* Mascot Customizer */}
      {showCustomizer && (
        <div className="rounded-2xl bg-brand-50 dark:bg-brand-600/10 p-4 space-y-2 animate-fade-in">
          <h3 className="text-xs font-semibold text-brand-700 dark:text-brand-400">
            Mascot Accessories
          </h3>
          <div className="flex flex-wrap gap-2">
            {customization.unlocked.map((acc) => (
              <button
                key={acc}
                onClick={() => handleEquip(acc)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  customization.equipped === acc
                    ? "bg-brand-600 text-white"
                    : "bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700"
                }`}
              >
                {ACCESSORY_LABELS[acc]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Badge Grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {BADGE_DEFINITIONS.map((badge) => {
          const isEarned = earnedIds.has(badge.id);
          const earnedBadge = earned.find((b) => b.badgeId === badge.id);

          return (
            <div
              key={badge.id}
              className={`group relative flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition-all ${
                isEarned
                  ? "bg-surface-0 dark:bg-surface-900 shadow-soft"
                  : "bg-surface-100 dark:bg-surface-800 opacity-40"
              }`}
              title={
                isEarned
                  ? `${badge.name}: ${badge.description}`
                  : `Locked: ${badge.description}`
              }
            >
              <span
                className={`text-2xl ${isEarned ? "" : "grayscale"}`}
                role="img"
                aria-label={badge.name}
              >
                {badge.icon}
              </span>
              <span className="text-[10px] font-medium text-surface-700 dark:text-surface-300 leading-tight">
                {badge.name}
              </span>
              {isEarned && earnedBadge && (
                <span className="text-[9px] text-surface-400">
                  {new Date(earnedBadge.earnedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
