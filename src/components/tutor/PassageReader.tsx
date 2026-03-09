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
    <div className="space-y-4">
      {/* Pre-reading context */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
        <p className="text-sm text-blue-800 dark:text-blue-300 italic">
          {preReadingContext}
        </p>
      </div>

      {/* Passage */}
      <article className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {title}
        </h2>
        <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {passageText}
        </div>
        <div className="mt-3 text-xs text-gray-400">
          {wordCount} words
        </div>
      </article>

      {/* Reading timer + done button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Reading time: {formatTime(elapsedSeconds)}
        </span>
        <button
          onClick={handleDone}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          I&apos;m ready to answer questions
        </button>
      </div>
    </div>
  );
}
