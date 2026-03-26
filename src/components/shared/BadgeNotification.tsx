"use client";

import { useEffect, useState } from "react";
import { ACCESSORY_UNLOCKS, type BadgeDefinition } from "@/lib/achievements";

interface BadgeNotificationProps {
  readonly badges: readonly BadgeDefinition[];
  readonly onDismiss: () => void;
}

export function BadgeNotification({ badges, onDismiss }: BadgeNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (badges.length === 0) return;
    setVisible(true);
    setCurrentIndex(0);
  }, [badges]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (currentIndex < badges.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setVisible(false);
        onDismiss();
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [visible, currentIndex, badges.length, onDismiss]);

  if (!visible || badges.length === 0) return null;

  const badge = badges[currentIndex];

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl bg-surface-0 px-5 py-3 shadow-glow border border-brand-200 dark:bg-surface-900 dark:border-brand-700">
        <span className="text-3xl" role="img" aria-label={badge.name}>
          {badge.icon}
        </span>
        <div>
          <div className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide">
            Badge Earned!
          </div>
          <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            {badge.name}
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-400">
            {badge.description}
          </div>
          {ACCESSORY_UNLOCKS[badge.id] && (
            <div className="text-xs font-medium text-success-600 dark:text-success-400 mt-0.5">
              New accessory unlocked!
            </div>
          )}
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
