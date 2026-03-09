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
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
        >
          <span aria-hidden="true">?</span>
          I&apos;m stuck
        </button>
      )}
      {showExplain && (
        <button
          onClick={onExplainMore}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
        >
          <span aria-hidden="true">+</span>
          Explain more
        </button>
      )}
    </div>
  );
}
