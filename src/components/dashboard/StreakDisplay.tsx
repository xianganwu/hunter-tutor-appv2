import type { StreakData } from "./types";

interface StreakDisplayProps {
  readonly data: StreakData;
}

export function StreakDisplay({ data }: StreakDisplayProps) {
  const today = new Date();
  const last14Days: { date: string; practiced: boolean }[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    last14Days.push({
      date: dateStr,
      practiced: data.practicedDates.includes(dateStr),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold">{data.currentStreak}</span>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <div>day streak</div>
          <div>Best: {data.longestStreak} days</div>
        </div>
      </div>
      <div className="flex gap-1" aria-label={`Practice streak: ${data.currentStreak} days in a row`}>
        {last14Days.map((day) => (
          <div
            key={day.date}
            className={`w-4 h-4 rounded-full ${
              day.practiced
                ? "bg-green-500"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
            title={`${day.date}: ${day.practiced ? "Practiced" : "Rest day"}`}
            aria-label={`${day.date}: ${day.practiced ? "Practiced" : "Rest day"}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>2 weeks ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}
