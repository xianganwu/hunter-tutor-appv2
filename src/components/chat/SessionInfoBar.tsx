"use client";

import { useState, useEffect } from "react";
import type { DifficultyLevel } from "@/lib/types";
import { MASTERY_TIER_LABELS } from "@/lib/adaptive";

// ─── Types ────────────────────────────────────────────────────────────

interface SessionInfoBarProps {
  readonly mastery: number; // 0.0 – 1.0
  readonly difficultyTier: DifficultyLevel;
  readonly startTime: number; // epoch ms
  readonly stopped: boolean;
  readonly skillName: string;
}

// ─── Tier boundaries (matching masteryToTier in adaptive.ts) ─────────

const TIER_BOUNDARIES: readonly number[] = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

/** Compute fill fraction (0-1) within a specific tier segment. */
function segmentFill(mastery: number, tier: DifficultyLevel): number {
  const lo = TIER_BOUNDARIES[tier - 1];
  const hi = TIER_BOUNDARIES[tier];
  if (mastery >= hi) return 1;
  if (mastery <= lo) return 0;
  return (mastery - lo) / (hi - lo);
}

// ─── Segment colors per tier ─────────────────────────────────────────

const SEGMENT_COLORS: Record<DifficultyLevel, { bg: string; fill: string }> = {
  1: {
    bg: "bg-surface-200 dark:bg-surface-700",
    fill: "bg-brand-400 dark:bg-brand-500",
  },
  2: {
    bg: "bg-surface-200 dark:bg-surface-700",
    fill: "bg-brand-500 dark:bg-brand-400",
  },
  3: {
    bg: "bg-surface-200 dark:bg-surface-700",
    fill: "bg-streak-400 dark:bg-streak-500",
  },
  4: {
    bg: "bg-surface-200 dark:bg-surface-700",
    fill: "bg-success-400 dark:bg-success-500",
  },
  5: {
    bg: "bg-surface-200 dark:bg-surface-700",
    fill: "bg-success-500 dark:bg-success-400",
  },
};

// ─── Short labels for mobile ─────────────────────────────────────────

const TIER_SHORT_LABELS: Record<DifficultyLevel, string> = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
};

// ─── Elapsed Timer ───────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ElapsedTimer({ startTime, stopped }: { startTime: number; stopped: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (stopped) return;
    // Sync immediately on mount
    setElapsed(Math.floor((Date.now() - startTime) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, stopped]);

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400 tabular-nums shrink-0"
      aria-label={`Session time: ${formatTime(elapsed)}`}
      role="timer"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        className="text-surface-400 dark:text-surface-500"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-medium">{formatTime(elapsed)}</span>
    </div>
  );
}

// ─── Mastery Segments ────────────────────────────────────────────────

function MasterySegments({
  mastery,
  difficultyTier,
}: {
  mastery: number;
  difficultyTier: DifficultyLevel;
}) {
  const [prevTier, setPrevTier] = useState(difficultyTier);
  const [celebrating, setCelebrating] = useState<DifficultyLevel | null>(null);

  // Detect tier-up and trigger celebration
  useEffect(() => {
    if (difficultyTier > prevTier) {
      setCelebrating(prevTier);
      const timer = setTimeout(() => setCelebrating(null), 600);
      setPrevTier(difficultyTier);
      return () => clearTimeout(timer);
    }
    setPrevTier(difficultyTier);
  }, [difficultyTier, prevTier]);

  const currentLabel = MASTERY_TIER_LABELS[difficultyTier];

  return (
    <div className="flex flex-col gap-1 min-w-0 flex-1">
      {/* Tier label */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-surface-500 dark:text-surface-400 truncate">
          {currentLabel}
        </span>
        <span className="text-[10px] text-surface-400 dark:text-surface-500 tabular-nums ml-2 shrink-0">
          {Math.round(mastery * 100)}%
        </span>
      </div>

      {/* 5-segment bar */}
      <div
        className="flex gap-0.5"
        role="progressbar"
        aria-valuenow={Math.round(mastery * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Mastery: ${currentLabel}, ${Math.round(mastery * 100)}%`}
      >
        {([1, 2, 3, 4, 5] as DifficultyLevel[]).map((tier) => {
          const fill = segmentFill(mastery, tier);
          const colors = SEGMENT_COLORS[tier];
          const isCelebrating = celebrating === tier;

          return (
            <div
              key={tier}
              className={`relative h-2 flex-1 rounded-full overflow-hidden ${colors.bg}`}
              aria-label={`Tier ${tier}: ${MASTERY_TIER_LABELS[tier]}, ${Math.round(fill * 100)}%`}
            >
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${colors.fill} ${
                  isCelebrating ? "animate-pulse-soft" : ""
                }`}
                style={{ width: `${fill * 100}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Tier tick labels — hidden on very small screens */}
      <div className="hidden sm:flex gap-0.5">
        {([1, 2, 3, 4, 5] as DifficultyLevel[]).map((tier) => (
          <div key={tier} className="flex-1 text-center">
            <span
              className={`text-[9px] ${
                tier === difficultyTier
                  ? "text-surface-700 dark:text-surface-200 font-semibold"
                  : "text-surface-300 dark:text-surface-600"
              }`}
            >
              {TIER_SHORT_LABELS[tier]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function SessionInfoBar({
  mastery,
  difficultyTier,
  startTime,
  stopped,
  skillName,
}: SessionInfoBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-surface-200 dark:border-surface-800 bg-surface-0/80 dark:bg-surface-900/80 backdrop-blur-sm">
      {/* Timer */}
      <ElapsedTimer startTime={startTime} stopped={stopped} />

      {/* Divider */}
      <div className="w-px h-5 bg-surface-200 dark:bg-surface-700 shrink-0" />

      {/* Skill name */}
      <span className="text-xs font-medium text-surface-600 dark:text-surface-300 truncate shrink-0 max-w-[120px]">
        {skillName}
      </span>

      {/* Divider */}
      <div className="w-px h-5 bg-surface-200 dark:bg-surface-700 shrink-0" />

      {/* Mastery bar */}
      <MasterySegments mastery={mastery} difficultyTier={difficultyTier} />
    </div>
  );
}
