"use client";

import { useState, useEffect } from "react";
import { getTodaysPlan, getTaskRoute, type DailyPlan } from "@/lib/daily-plan";
import { Confetti } from "@/components/shared/Confetti";

export function DailyPracticePlan() {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const p = getTodaysPlan();
    setPlan(p);
  }, []);

  if (!plan || plan.tasks.length === 0) return null;

  const completedCount = plan.completedTaskIds.length;
  const totalCount = plan.tasks.length;
  const allDone = completedCount >= totalCount;

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-4">
      <Confetti active={showConfetti} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            Today&apos;s Practice
          </h2>
          <p className="text-xs text-surface-400 mt-0.5">
            {allDone ? "All done!" : `${completedCount}/${totalCount} completed`}
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

      {/* All done state */}
      {allDone && (
        <div className="text-center pt-2 animate-fade-in">
          <p className="text-sm font-medium text-success-600 dark:text-success-400">
            Amazing work! You completed all of today&apos;s tasks!
          </p>
          <button
            onClick={() => setShowConfetti(true)}
            className="mt-2 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors"
          >
            Celebrate!
          </button>
        </div>
      )}
    </div>
  );
}
