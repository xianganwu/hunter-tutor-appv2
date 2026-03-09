"use client";

import { useRef, useEffect, useState } from "react";

interface PassageReaderProps {
  readonly title: string;
  readonly preReadingContext: string;
  readonly passageText: string;
  readonly wordCount: number;
  readonly onFinishedReading: (readingTimeSeconds: number) => void;
}

export function PassageReader({
  title,
  preReadingContext,
  passageText,
  wordCount,
  onFinishedReading,
}: PassageReaderProps) {
  const startTimeRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Reset start time when passage changes
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [passageText]);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [passageText]);

  const handleDone = () => {
    const seconds = (Date.now() - startTimeRef.current) / 1000;
    onFinishedReading(seconds);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Pre-reading context */}
      <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-200 dark:border-brand-800 px-4 py-3">
        <p className="text-sm text-brand-700 dark:text-brand-300 italic">
          {preReadingContext}
        </p>
      </div>

      {/* Passage */}
      <article className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 sm:p-6 border border-surface-200 dark:border-surface-800">
        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
          {title}
        </h2>
        <div className="text-sm leading-relaxed text-surface-800 dark:text-surface-200 whitespace-pre-wrap">
          {passageText}
        </div>
        <div className="mt-3 text-xs text-surface-400">
          {wordCount} words
        </div>
      </article>

      {/* Reading timer + done button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-400">
          Reading time: {formatTime(elapsedSeconds)}
        </span>
        <button
          onClick={handleDone}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          I&apos;m ready to answer questions
        </button>
      </div>
    </div>
  );
}
