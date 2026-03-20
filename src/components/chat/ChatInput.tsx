"use client";

import { useState, useCallback } from "react";

interface ChatInputProps {
  readonly onSend: (text: string) => void;
  readonly disabled: boolean;
  readonly placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (trimmed && !disabled) {
        onSend(trimmed);
        setText("");
      }
    },
    [text, disabled, onSend]
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? "Type your answer..."}
        className="flex-1 rounded-2xl border border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 px-4 py-2.5 text-body text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 transition-colors"
        aria-label="Type your message"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 transition-colors"
        aria-label="Send message"
      >
        Send
      </button>
    </form>
  );
}
