"use client";

interface QuickActionsProps {
  readonly onHint: () => void;
  readonly onExplainMore: () => void;
  readonly disabled: boolean;
  readonly showHint: boolean;
  readonly showExplain: boolean;
}

export function QuickActions({
  onHint,
  onExplainMore,
  disabled,
  showHint,
  showExplain,
}: QuickActionsProps) {
  if (!showHint && !showExplain) return null;

  return (
    <div className="flex gap-2 my-2">
      {showHint && (
        <button
          onClick={onHint}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-streak-300 dark:border-streak-600 bg-streak-50 dark:bg-streak-500/10 px-3.5 py-2 text-xs font-medium text-streak-700 dark:text-streak-400 hover:bg-streak-100 dark:hover:bg-streak-500/20 disabled:opacity-50 transition-colors"
        >
          <span aria-hidden="true">?</span>
          I&apos;m stuck
        </button>
      )}
      {showExplain && (
        <button
          onClick={onExplainMore}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-brand-300 dark:border-brand-600 bg-brand-50 dark:bg-brand-600/10 px-3.5 py-2 text-xs font-medium text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-600/20 disabled:opacity-50 transition-colors"
        >
          <span aria-hidden="true">+</span>
          Explain more
        </button>
      )}
    </div>
  );
}
