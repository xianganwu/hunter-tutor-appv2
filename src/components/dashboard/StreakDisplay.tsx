import type { StreakData } from "./types";

interface StreakDisplayProps {
  readonly data: StreakData;
}

type DayStatus = "practiced" | "frozen" | "rest";

export function StreakDisplay({ data }: StreakDisplayProps) {
  const today = new Date();
  const frozenSet = new Set(data.frozenDates);
  const last14Days: { date: string; status: DayStatus }[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    const practiced = data.practicedDates.includes(dateStr);
    const frozen = frozenSet.has(dateStr);
    last14Days.push({
      date: dateStr,
      status: practiced ? "practiced" : frozen ? "frozen" : "rest",
    });
  }

  const isActive = data.currentStreak > 0;

  const STATUS_STYLES: Record<DayStatus, string> = {
    practiced: "bg-streak-400",
    frozen: "bg-blue-400 dark:bg-blue-500",
    rest: "bg-surface-200 dark:bg-surface-700",
  };

  const STATUS_LABELS: Record<DayStatus, string> = {
    practiced: "Practiced",
    frozen: "Streak freeze",
    rest: "Rest day",
  };

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
          <div>Best: {data.longestStreak} days</div>
        </div>
      </div>
      <div
        className="flex gap-1.5"
        aria-label={`Practice streak: ${data.currentStreak} days in a row`}
      >
        {last14Days.map((day) => (
          <div
            key={day.date}
            className={`relative w-4 h-4 rounded-full transition-colors duration-300 ${STATUS_STYLES[day.status]}`}
            title={`${day.date}: ${STATUS_LABELS[day.status]}`}
            aria-label={`${day.date}: ${STATUS_LABELS[day.status]}`}
          >
            {day.status === "frozen" && (
              <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white" aria-hidden="true">
                *
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500">
        <span>2 weeks ago</span>
        <span>Today</span>
      </div>
      <div className="text-xs text-surface-400 dark:text-surface-500">
        {data.freezesRemaining} freeze{data.freezesRemaining !== 1 ? "s" : ""} remaining this week
      </div>
    </div>
  );
}
