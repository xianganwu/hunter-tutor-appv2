interface ProgressIndicatorProps {
  readonly current: number;
  readonly estimated: number;
}

export function ProgressIndicator({ current, estimated }: ProgressIndicatorProps) {
  const pct = estimated > 0 ? Math.min(100, Math.round((current / estimated) * 100)) : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Question {current} of ~{estimated}
      </span>
      <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemax={estimated}
          aria-label={`${current} of approximately ${estimated} questions`}
        />
      </div>
    </div>
  );
}
