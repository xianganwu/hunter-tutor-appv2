"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getTodaysPlan,
  getTaskRoute,
  regeneratePlanWithBudget,
  loadTimeBudget,
  type DailyPlan,
} from "@/lib/daily-plan";
import { Confetti } from "@/components/shared/Confetti";
import { Mascot, type MascotAnimal } from "@/components/shared/Mascot";

interface DailyPracticePlanProps {
  readonly mascotTier?: 1 | 2 | 3 | 4 | 5;
  readonly mascotType?: MascotAnimal;
}

const TIME_OPTIONS = [15, 30, 45] as const;

export function DailyPracticePlan({ mascotTier = 1, mascotType = "penguin" }: DailyPracticePlanProps) {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const hasFiredConfetti = useRef(false);

  useEffect(() => {
    setPlan(getTodaysPlan());
  }, []);

  const allDone = plan ? plan.completedTaskIds.length >= plan.tasks.length : false;

  useEffect(() => {
    if (allDone && !hasFiredConfetti.current) {
      hasFiredConfetti.current = true;
      setShowConfetti(true);
    }
  }, [allDone]);

  const handleBudgetChange = useCallback((minutes: number) => {
    const newPlan = regeneratePlanWithBudget(minutes);
    setPlan(newPlan);
  }, []);

  if (!plan) return null;

  const completedCount = plan.completedTaskIds.length;
  const totalCount = plan.tasks.length;
  const totalMinutes = plan.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const completedMinutes = plan.tasks
    .filter((t) => plan.completedTaskIds.includes(t.id))
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const activeBudget = plan.timeBudget ?? loadTimeBudget();

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-4">
      <Confetti active={showConfetti} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            Today&apos;s Practice
          </h2>
          <p className="text-xs text-surface-400 mt-0.5">
            {allDone
              ? "All done!"
              : `${completedCount}/${totalCount} completed · ~${totalMinutes} min`}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            allDone
              ? "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300"
              : "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-400"
          }`}
        >
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Tasks */}
      {totalCount > 0 && (
        <div className="space-y-2">
          {plan.tasks.map((task) => {
            const isDone = plan.completedTaskIds.includes(task.id);
            const route = getTaskRoute(task);

            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                  isDone
                    ? "bg-success-50 dark:bg-success-500/10"
                    : "bg-surface-50 dark:bg-surface-800"
                }`}
              >
                {/* Checkbox */}
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                    isDone
                      ? "border-success-500 bg-success-500 text-white"
                      : "border-surface-300 dark:border-surface-600"
                  }`}
                >
                  {isDone && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      isDone
                        ? "text-success-700 dark:text-success-300 line-through"
                        : "text-surface-900 dark:text-surface-100"
                    }`}
                  >
                    {task.skillName}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-surface-400">
                    <span>{task.reason}</span>
                    <span>·</span>
                    <span>~{task.estimatedMinutes} min</span>
                  </div>
                </div>

                {/* Start button */}
                {!isDone && (
                  <a
                    href={route}
                    className="flex-shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                  >
                    Start
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* All done ceremony */}
      {allDone && totalCount > 0 && (
        <div className="flex flex-col items-center gap-3 pt-4 animate-fade-in">
          <Mascot tier={mascotTier} size="lg" mascotType={mascotType} />
          <p className="text-lg font-bold text-success-600 dark:text-success-400">
            Amazing work! See you tomorrow!
          </p>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            You practiced ~{completedMinutes} minutes today!
          </p>
        </div>
      )}

      {/* Time budget picker */}
      <div className="flex items-center justify-center gap-2 pt-1 border-t border-surface-100 dark:border-surface-800">
        <span className="text-xs text-surface-400 dark:text-surface-500">
          How much time?
        </span>
        {TIME_OPTIONS.map((mins) => (
          <button
            key={mins}
            onClick={() => handleBudgetChange(mins)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeBudget === mins
                ? "bg-brand-600 text-white"
                : "bg-surface-100 text-surface-500 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-400 dark:hover:bg-surface-700"
            }`}
          >
            {mins} min
          </button>
        ))}
      </div>
    </div>
  );
}
