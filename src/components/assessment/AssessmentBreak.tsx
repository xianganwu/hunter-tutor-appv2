"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface AssessmentBreakProps {
  readonly nextSection: string;
  readonly totalSeconds: number;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AssessmentBreak({
  nextSection,
  totalSeconds,
  onContinue,
  onSkip,
}: AssessmentBreakProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [timerDone, setTimerDone] = useState(false);
  const onContinueRef = useRef(onContinue);
  const calledRef = useRef(false);

  useEffect(() => {
    onContinueRef.current = onContinue;
  });

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // When timer finishes, show continue button (don't auto-advance)
  useEffect(() => {
    if (remaining <= 0 && !timerDone) {
      setTimerDone(true);
    }
  }, [remaining, timerDone]);

  const handleContinue = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onContinueRef.current();
  }, []);

  const handleSkip = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onSkip();
  }, [onSkip]);

  const progress = remaining / totalSeconds;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 animate-fade-in">
      <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
        Take a Break
      </h1>

      <p className="text-sm text-surface-500 dark:text-surface-400 text-center max-w-sm">
        Next up:{" "}
        <span className="font-medium text-surface-700 dark:text-surface-300">
          {nextSection}
        </span>
      </p>

      {/* Large circular countdown */}
      <div className="relative" aria-label={`${formatTime(remaining)} remaining`} role="timer">
        <svg width={120} height={120} viewBox="0 0 120 120" className="transform -rotate-90">
          {/* Track */}
          <circle
            cx={60}
            cy={60}
            r={54}
            fill="none"
            strokeWidth={6}
            className="stroke-surface-200 dark:stroke-surface-700"
          />
          {/* Progress */}
          <circle
            cx={60}
            cy={60}
            r={54}
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            className="stroke-brand-500 transition-all duration-1000"
            strokeDasharray={2 * Math.PI * 54}
            strokeDashoffset={2 * Math.PI * 54 * (1 - progress)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-mono font-bold text-surface-900 dark:text-surface-100">
            {formatTime(remaining)}
          </span>
        </div>
      </div>

      <p className="text-sm text-surface-500 dark:text-surface-400 text-center max-w-xs">
        Stretch, take a deep breath, and get ready.
      </p>

      <div className="flex gap-3">
        {!timerDone ? (
          <button
            onClick={handleSkip}
            className="rounded-xl border border-surface-300 dark:border-surface-600 px-6 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            Skip Break
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors animate-fade-in"
          >
            Continue to {nextSection}
          </button>
        )}
      </div>
    </div>
  );
}
