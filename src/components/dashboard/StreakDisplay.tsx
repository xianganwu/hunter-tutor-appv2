import type { StreakData } from "./types";

interface StreakDisplayProps {
  readonly data: StreakData;
}

type DayStatus = "practiced" | "rest";

export function StreakDisplay({ data }: StreakDisplayProps) {
  const today = new Date();
  const last14Days: { date: string; status: DayStatus }[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    const practiced = data.practicedDates.includes(dateStr);
    last14Days.push({
      date: dateStr,
      status: practiced ? "practiced" : "rest",
    });
  }

  const isActive = data.currentStreak > 0;

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
            className={`w-4 h-4 rounded-full transition-colors duration-300 ${
              day.status === "practiced"
                ? "bg-streak-400"
                : "bg-surface-200 dark:bg-surface-700"
            }`}
            title={`${day.date}: ${day.status === "practiced" ? "Practiced" : "Rest day"}`}
            aria-label={`${day.date}: ${day.status === "practiced" ? "Practiced" : "Rest day"}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500">
        <span>2 weeks ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}
