import type { StreakData } from "./types";

interface StreakDisplayProps {
  readonly data: StreakData;
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  // If same year as now, omit year; otherwise include it
  const startYear = new Date(start + "T00:00:00").getFullYear();
  const currentYear = new Date().getFullYear();
  if (startYear !== currentYear) {
    const fmtWithYear = (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    return `${fmtWithYear(start)} – ${fmtWithYear(end)}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

export function StreakDisplay({ data }: StreakDisplayProps) {
  const isActive = data.currentStreak > 0;
  const bestRange = formatDateRange(data.longestStreakStart, data.longestStreakEnd);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 ${isActive ? "shadow-glow-streak" : ""} rounded-2xl px-4 py-2 bg-streak-50 dark:bg-streak-600/10`}>
          <span
            className={`text-2xl ${isActive ? "animate-pulse-soft" : ""}`}
            aria-hidden="true"
          >
            🔥
          </span>
          <span className="text-3xl font-extrabold text-streak-500">
            {data.currentStreak}
          </span>
        </div>
        <div className="text-sm text-surface-500 dark:text-surface-400">
          <div className="font-medium">day streak</div>
          <div>
            Best: {data.longestStreak} days
            {bestRange && (
              <span className="text-xs text-surface-400 dark:text-surface-500 ml-1">
                ({bestRange})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
