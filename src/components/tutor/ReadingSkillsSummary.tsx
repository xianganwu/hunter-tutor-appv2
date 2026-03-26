"use client";

import type { SkillResult } from "@/hooks/useReadingStamina";

interface ReadingSkillsSummaryProps {
  readonly skills: readonly SkillResult[];
}

function masteryColor(pct: number): string {
  if (pct === 0) return "bg-surface-200 dark:bg-surface-700";
  if (pct < 40) return "bg-red-400 dark:bg-red-500";
  if (pct < 70) return "bg-amber-400 dark:bg-amber-500";
  return "bg-emerald-400 dark:bg-emerald-500";
}

function deltaArrow(
  current: number,
  previous: number,
): { symbol: string; color: string } {
  const delta = current - previous;
  if (delta > 0.005) return { symbol: "\u2191", color: "text-emerald-500" };
  if (delta < -0.005) return { symbol: "\u2193", color: "text-red-400" };
  return { symbol: "\u2192", color: "text-surface-400" };
}

export function ReadingSkillsSummary({ skills }: ReadingSkillsSummaryProps) {
  if (skills.length === 0) return null;

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4 mt-4">
      <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-300 mb-3">
        Skills Practiced
      </h3>
      <div className="flex flex-col gap-2.5">
        {skills.map((skill, i) => {
          const pct = Math.round(skill.mastery * 100);
          const arrow = deltaArrow(skill.mastery, skill.previousMastery);

          return (
            <div key={`${skill.skillId}-${i}`} className="flex items-center gap-3">
              {/* Correct/incorrect indicator */}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  skill.isCorrect
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : "bg-red-100 dark:bg-red-900/30"
                }`}
              >
                {skill.isCorrect ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M3 6l2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-emerald-600 dark:text-emerald-400"
                    />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M4 4l4 4M8 4l-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      className="text-red-500 dark:text-red-400"
                    />
                  </svg>
                )}
              </div>

              {/* Skill name */}
              <span className="text-sm text-surface-700 dark:text-surface-200 flex-1 min-w-0 truncate">
                {skill.skillName}
              </span>

              {/* Mastery bar */}
              <div className="w-16 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full transition-all ${masteryColor(pct)}`}
                  style={{ width: `${Math.max(pct, 0)}%` }}
                />
              </div>

              {/* Percentage + delta */}
              <span className="text-xs font-medium text-surface-500 dark:text-surface-400 w-8 text-right tabular-nums">
                {pct > 0 ? `${pct}%` : "--"}
              </span>
              <span className={`text-xs font-medium w-3 ${arrow.color}`}>
                {arrow.symbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
