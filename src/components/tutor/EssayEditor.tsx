"use client";

import { useCallback, useRef } from "react";

interface EssayEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function countParagraphs(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
}

export function EssayEditor({ value, onChange, disabled }: EssayEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const words = countWords(value);
  const paragraphs = countParagraphs(value);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab inserts 2 spaces instead of moving focus
      if (e.key === "Tab") {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = value.slice(0, start) + "  " + value.slice(end);
        onChange(newValue);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          target.selectionStart = start + 2;
          target.selectionEnd = start + 2;
        });
      }
    },
    [value, onChange]
  );

  const wordCountColor =
    words >= 200
      ? "text-success-500 dark:text-success-400"
      : words >= 100
        ? "text-streak-500 dark:text-streak-400"
        : "text-surface-500 dark:text-surface-400";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 rounded-t-xl text-xs text-surface-500 dark:text-surface-400">
        <div className="flex items-center gap-4">
          <span className={wordCountColor}>
            <strong>{words}</strong> words
          </span>
          <span>{paragraphs} paragraph{paragraphs !== 1 ? "s" : ""}</span>
        </div>
        <div>
          {words < 200 && (
            <span className="text-surface-400 dark:text-surface-500">Aim for 200+ words</span>
          )}
          {words >= 200 && words < 400 && (
            <span className="text-success-500 dark:text-success-400">Good length!</span>
          )}
          {words >= 400 && (
            <span className="text-success-500 dark:text-success-400">Strong essay!</span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Start writing your essay here..."
          className="w-full h-full resize-none rounded-b-2xl border-0 bg-surface-0 dark:bg-surface-900 px-4 py-3 pb-8 text-base leading-loose text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-0 disabled:opacity-50 font-serif"
          style={{ minHeight: "320px" }}
          aria-label="Essay editor"
        />
        <div className="absolute bottom-2 right-3 text-xs text-surface-400 dark:text-surface-500">
          {words} words
        </div>
      </div>
    </div>
  );
}

export { countWords };
