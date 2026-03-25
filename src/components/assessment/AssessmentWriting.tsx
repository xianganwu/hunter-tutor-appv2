"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CountdownTimer } from "@/components/tutor/CountdownTimer";
import { countWords } from "@/utils/count-words";

interface AssessmentWritingProps {
  readonly prompt: string;
  readonly totalSeconds: number;
  readonly timerStartTime: number; // epoch ms — when this section's timer started
  readonly onSubmit: (essay: string) => void;
  readonly onTimeUp: (essay: string) => void;
}

export function AssessmentWriting({
  prompt,
  totalSeconds,
  timerStartTime,
  onSubmit,
  onTimeUp,
}: AssessmentWritingProps) {
  const [essay, setEssay] = useState("");
  const essayRef = useRef(essay);
  const submittedRef = useRef(false);

  // Keep ref in sync so the timeUp callback has the latest text
  useEffect(() => {
    essayRef.current = essay;
  }, [essay]);

  const handleTimeUp = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onTimeUp(essayRef.current);
  }, [onTimeUp]);

  const handleSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(essayRef.current);
  }, [onSubmit]);

  const wordCount = countWords(essay);
  const durationMinutes = totalSeconds / 60;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-3xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Test-mode header with amber accent */}
      <header className="flex items-center justify-between px-4 py-2 border-b-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
        <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Writing Section
        </div>
        <CountdownTimer
          durationMinutes={durationMinutes}
          startTime={timerStartTime}
          onTimeUp={handleTimeUp}
          stopped={false}
        />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Prompt Card */}
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
          <div className="text-xs font-medium text-surface-400 uppercase tracking-wide mb-2">
            Essay Prompt
          </div>
          <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed">
            {prompt}
          </p>
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <textarea
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            placeholder="Write your essay here..."
            className="w-full rounded-2xl border border-surface-200 dark:border-surface-600 bg-surface-0 dark:bg-surface-900 px-4 py-3 text-sm leading-relaxed text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[300px] resize-y"
            aria-label="Essay response"
          />
          <div
            className={`text-xs text-right ${
              wordCount < 50
                ? "text-red-500 dark:text-red-400"
                : wordCount < 150
                  ? "text-streak-500 dark:text-streak-400"
                  : "text-surface-400"
            }`}
          >
            {wordCount} word{wordCount !== 1 && "s"}
            {wordCount > 0 && wordCount < 50 && " — aim for at least 150 words"}
            {wordCount >= 50 && wordCount < 150 && " — keep going! Aim for 150+ words"}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900">
        <button
          onClick={handleSubmit}
          className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Submit Essay
        </button>
      </div>
    </div>
  );
}
