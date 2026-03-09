"use client";

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3" aria-label="Tutor is typing" role="status">
      <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-soft">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-surface-400 dark:bg-surface-500 rounded-full animate-bounce-dot [animation-delay:0s]" />
          <span className="w-2 h-2 bg-surface-400 dark:bg-surface-500 rounded-full animate-bounce-dot [animation-delay:0.16s]" />
          <span className="w-2 h-2 bg-surface-400 dark:bg-surface-500 rounded-full animate-bounce-dot [animation-delay:0.32s]" />
        </div>
      </div>
    </div>
  );
}
