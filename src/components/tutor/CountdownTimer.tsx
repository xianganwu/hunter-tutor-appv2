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

const CIRCLE_SIZE = 40;
const STROKE_WIDTH = 3;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CountdownTimer({
  durationMinutes,
  startTime,
  onTimeUp,
  stopped,
}: CountdownTimerProps) {
  const totalMs = durationMinutes * 60 * 1000;
  const totalSeconds = durationMinutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);

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

  const progress = remaining / totalSeconds;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const strokeColor = isCritical
    ? "stroke-red-500"
    : isLow
      ? "stroke-streak-500"
      : "stroke-brand-500";

  const textColor = isCritical
    ? "fill-red-500"
    : isLow
      ? "fill-streak-500"
      : "fill-surface-600 dark:fill-surface-300";

  return (
    <div
      className="relative"
      aria-label={`${formatTime(remaining)} remaining`}
      role="timer"
    >
      <svg
        width={CIRCLE_SIZE}
        height={CIRCLE_SIZE}
        viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="stroke-surface-200 dark:stroke-surface-700"
        />
        {/* Progress */}
        <circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className={`${strokeColor} transition-all duration-1000`}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      {/* Time text centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          width={CIRCLE_SIZE}
          height={CIRCLE_SIZE}
          viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
        >
          <text
            x="50%"
            y="50%"
            dominantBaseline="central"
            textAnchor="middle"
            className={`text-[9px] font-mono font-medium tabular-nums ${textColor}`}
          >
            {formatTime(remaining)}
          </text>
        </svg>
      </div>
    </div>
  );
}
