"use client";

import { useState, useEffect } from "react";
import { loadDailyPlan, getTaskRoute, type DailyTask } from "@/lib/daily-plan";

/**
 * Shown after completing a daily plan task.
 * Displays the next uncompleted task with a "Start Now" CTA,
 * or a celebration message if all tasks are done.
 */
export function NextTaskPrompt() {
  const [nextTask, setNextTask] = useState<DailyTask | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const plan = loadDailyPlan();
    if (!plan) {
      setLoaded(true);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    if (plan.date !== today) {
      setLoaded(true);
      return;
    }

    const remaining = plan.tasks.filter(
      (t) => !plan.completedTaskIds.includes(t.id),
    );

    if (remaining.length === 0) {
      setAllDone(true);
    } else {
      setNextTask(remaining[0]);
    }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  // All daily tasks done
  if (allDone) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-center dark:border-success-600/30 dark:bg-success-500/10">
          <p className="text-sm font-semibold text-success-700 dark:text-success-300">
            All done for today! Amazing work!
          </p>
        </div>
        <a
          href="/dashboard"
          className="block w-full rounded-xl bg-surface-100 px-4 py-2.5 text-center text-sm font-medium text-surface-700 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  // No daily plan or not today — just show dashboard link
  if (!nextTask) {
    return (
      <a
        href="/dashboard"
        className="block w-full rounded-xl bg-surface-100 px-4 py-2.5 text-center text-sm font-medium text-surface-700 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
      >
        Back to Dashboard
      </a>
    );
  }

  // Next task available
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 space-y-3 dark:border-brand-800 dark:bg-brand-900/20">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
        Next up
      </p>
      <div>
        <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
          {nextTask.skillName}
        </p>
        <p className="mt-0.5 text-xs text-brand-600 dark:text-brand-400">
          ~{nextTask.estimatedMinutes} min
        </p>
      </div>
      <div className="flex gap-2">
        <a
          href={getTaskRoute(nextTask)}
          className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Start Now
        </a>
        <a
          href="/dashboard"
          className="flex-1 rounded-xl bg-surface-100 px-4 py-2.5 text-center text-sm font-medium text-surface-700 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
        >
          Back to Plan
        </a>
      </div>
    </div>
  );
}
