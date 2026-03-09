"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  readonly durationMinutes: number;
  readonly startTime: number; // epoch ms
  readonly onTimeUp: () => void;
  readonly stopped: boolean;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CountdownTimer({
  durationMinutes,
  startTime,
  onTimeUp,
  stopped,
}: CountdownTimerProps) {
  const totalMs = durationMinutes * 60 * 1000;
  const [remaining, setRemaining] = useState(durationMinutes * 60);

  useEffect(() => {
    if (stopped) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const left = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, totalMs, stopped, onTimeUp]);

  const isLow = remaining <= 300; // 5 minutes
  const isCritical = remaining <= 60; // 1 minute

  return (
    <div
      className={`font-mono text-sm tabular-nums font-medium ${
        isCritical
          ? "text-red-600 animate-pulse"
          : isLow
            ? "text-amber-600"
            : "text-gray-600 dark:text-gray-400"
      }`}
      aria-label={`${formatTime(remaining)} remaining`}
      role="timer"
    >
      {formatTime(remaining)}
    </div>
  );
}
