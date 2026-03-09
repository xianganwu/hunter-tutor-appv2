"use client";

import { useState, useEffect } from "react";

interface SessionTimerProps {
  readonly startTime: number; // epoch ms
  readonly stopped: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionTimer({ startTime, stopped }: SessionTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (stopped) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, stopped]);

  return (
    <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums" aria-label={`Session time: ${formatTime(elapsed)}`}>
      {formatTime(elapsed)}
    </div>
  );
}
