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
      ? "text-green-600"
      : words >= 100
        ? "text-amber-600"
        : "text-gray-500";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-xl text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span className={wordCountColor}>
            <strong>{words}</strong> words
          </span>
          <span>{paragraphs} paragraph{paragraphs !== 1 ? "s" : ""}</span>
        </div>
        <div>
          {words < 200 && (
            <span className="text-gray-400">Aim for 200+ words</span>
          )}
          {words >= 200 && words < 400 && (
            <span className="text-green-600">Good length!</span>
          )}
          {words >= 400 && (
            <span className="text-green-600">Strong essay!</span>
          )}
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Start writing your essay here..."
        className="flex-1 w-full resize-none rounded-b-xl border-0 bg-white dark:bg-gray-900 px-4 py-3 text-base leading-relaxed text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-0 disabled:opacity-50 font-serif"
        style={{ minHeight: "320px" }}
        aria-label="Essay editor"
      />
    </div>
  );
}

export { countWords };
