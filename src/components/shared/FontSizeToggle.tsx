"use client";

import { useState, useEffect } from "react";

/**
 * Three text size levels for reading passages.
 * "medium" (16px) is the default — recommended minimum for ages 9-12.
 */
export type FontSizeLevel = "small" | "medium" | "large";

const STORAGE_KEY = "hunter-tutor-font-size";

const SIZES: Record<FontSizeLevel, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

const LABELS: Record<FontSizeLevel, string> = {
  small: "A",
  medium: "A",
  large: "A",
};

const CYCLE: FontSizeLevel[] = ["small", "medium", "large"];

function applySize(level: FontSizeLevel): void {
  document.documentElement.style.setProperty("--passage-font-size", SIZES[level]);
}

export function FontSizeToggle() {
  const [level, setLevel] = useState<FontSizeLevel>("medium");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as FontSizeLevel | null;
    if (stored && stored in SIZES) {
      setLevel(stored);
      applySize(stored);
    } else {
      applySize("medium");
    }
  }, []);

  function cycle() {
    const idx = CYCLE.indexOf(level);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setLevel(next);
    applySize(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <button
      onClick={cycle}
      aria-label={`Text size: ${level}. Click to change.`}
      title={`Text size: ${level}`}
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-100 text-surface-500 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-400 dark:hover:bg-surface-700"
    >
      <span
        className={`font-semibold leading-none ${
          level === "small"
            ? "text-xs"
            : level === "large"
              ? "text-base"
              : "text-sm"
        }`}
      >
        {LABELS[level]}
        <span className="sr-only"> ({level})</span>
      </span>
    </button>
  );
}
