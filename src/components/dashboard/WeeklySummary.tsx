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
    <div className="rounded-2xl shadow-card p-6 bg-surface-0 dark:bg-surface-900 animate-fade-in">
      <h3 className="text-lg font-semibold mb-5 text-surface-800 dark:text-surface-100">
        This Week
      </h3>

      <div className="grid grid-cols-2 gap-px mb-6 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700">
        <div className="text-center p-4 bg-surface-50 dark:bg-surface-800">
          <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
            {formatMinutes(data.totalMinutesPracticed)}
          </div>
          <div className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Time practiced
          </div>
        </div>
        <div className="text-center p-4 bg-surface-50 dark:bg-surface-800">
          <div className="text-2xl font-bold text-success-500 dark:text-success-400">
            {data.sessionsCompleted}
          </div>
          <div className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Sessions
          </div>
        </div>
      </div>

      {data.skillsImproved.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-medium text-surface-500 dark:text-surface-400 mb-2">
            Skills Improved
          </h4>
          <ul className="space-y-1.5">
            {data.skillsImproved.map((s) => (
              <li key={s.skillId} className="flex justify-between text-sm">
                <span className="text-surface-700 dark:text-surface-300">
                  {s.skillName}
                </span>
                <span className="font-semibold text-success-600 dark:text-success-400">
                  +{Math.round(s.delta * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.areasToFocus.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-surface-500 dark:text-surface-400 mb-2">
            Focus Areas
          </h4>
          <ul className="space-y-1.5">
            {data.areasToFocus.map((a) => (
              <li key={a.skillId} className="text-sm">
                <span className="font-medium text-streak-600 dark:text-streak-400">
                  {a.skillName}
                </span>
                <span className="text-surface-500 dark:text-surface-400">
                  {" "}&mdash; {a.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
