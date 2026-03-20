"use client";

import { useState, useEffect } from "react";
import { loadDailyPlan } from "@/lib/daily-plan";

/**
 * Small persistent indicator showing daily plan progress (e.g. "2/4").
 * Renders as a compact pill in session headers.
 * Returns null if no daily plan exists for today.
 */
export function DailyPlanProgress() {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const plan = loadDailyPlan();
    if (!plan) return;

    const today = new Date().toISOString().split("T")[0];
    if (plan.date !== today) return;
    if (plan.tasks.length === 0) return;

    setProgress({
      done: plan.completedTaskIds.length,
      total: plan.tasks.length,
    });
  }, []);

  if (!progress) return null;

  const allDone = progress.done >= progress.total;
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="flex items-center gap-1.5" title={`Daily plan: ${progress.done}/${progress.total} tasks done`}>
      <div className="w-12 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            allDone ? "bg-success-500" : "bg-brand-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-[10px] font-semibold tabular-nums ${
          allDone
            ? "text-success-600 dark:text-success-400"
            : "text-surface-500 dark:text-surface-400"
        }`}
      >
        {progress.done}/{progress.total}
      </span>
    </div>
  );
}
