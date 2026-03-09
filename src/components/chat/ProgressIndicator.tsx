interface ProgressIndicatorProps {
  readonly current: number;
  readonly estimated: number;
}

export function ProgressIndicator({ current, estimated }: ProgressIndicatorProps) {
  const pct = estimated > 0 ? Math.min(100, Math.round((current / estimated) * 100)) : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-surface-500 dark:text-surface-400">
        Question {current} of ~{estimated}
      </span>
      <div className="w-20 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
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
