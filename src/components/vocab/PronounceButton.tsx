"use client";

import { usePronunciation } from "@/hooks/usePronunciation";

interface PronounceButtonProps {
  readonly word: string;
}

export function PronounceButton({ word }: PronounceButtonProps) {
  const { speak, isSpeaking, isSupported } = usePronunciation();

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={() => speak(word)}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-surface-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors ${
        isSpeaking ? "animate-pulse text-brand-500" : ""
      }`}
      aria-label={`Pronounce ${word}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {isSpeaking ? (
          <>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        ) : (
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        )}
      </svg>
    </button>
  );
}
