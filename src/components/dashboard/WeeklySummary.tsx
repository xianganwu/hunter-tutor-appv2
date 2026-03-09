import type { WeeklySummaryData } from "./types";

interface WeeklySummaryProps {
  readonly data: WeeklySummaryData;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function WeeklySummary({ data }: WeeklySummaryProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-900">
      <h3 className="text-lg font-semibold mb-4">This Week</h3>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="text-2xl font-bold">{formatMinutes(data.totalMinutesPracticed)}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Time practiced</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="text-2xl font-bold">{data.sessionsCompleted}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Sessions</div>
        </div>
      </div>

      {data.skillsImproved.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Skills Improved
          </h4>
          <ul className="space-y-1">
            {data.skillsImproved.map((s) => (
              <li key={s.skillId} className="flex justify-between text-sm">
                <span>{s.skillName}</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  +{Math.round(s.delta * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.areasToFocus.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Focus Areas
          </h4>
          <ul className="space-y-1">
            {data.areasToFocus.map((a) => (
              <li key={a.skillId} className="text-sm">
                <span className="font-medium">{a.skillName}</span>
                <span className="text-gray-500 dark:text-gray-400"> — {a.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
