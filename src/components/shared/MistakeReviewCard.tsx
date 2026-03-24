"use client";

import { useState } from "react";
import { MathText } from "@/components/chat/MathText";

// ─── Types ────────────────────────────────────────────────────────────

export interface ReviewableMistake {
  readonly questionText: string;
  readonly studentAnswer: string;
  readonly correctAnswer: string;
  readonly skillName?: string;
}

interface MistakeReviewListProps {
  readonly mistakes: readonly ReviewableMistake[];
}

// ─── Single Card ──────────────────────────────────────────────────────

function MistakeCard({ mistake, index }: { readonly mistake: ReviewableMistake; readonly index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
        aria-expanded={open}
      >
        <span className="shrink-0 w-6 h-6 rounded-full bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <span className="flex-1 text-sm text-surface-700 dark:text-surface-300 line-clamp-1">
          <MathText text={mistake.questionText} />
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`shrink-0 text-surface-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-surface-100 dark:border-surface-800 pt-3">
          {mistake.skillName && (
            <div className="text-[11px] font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">
              {mistake.skillName}
            </div>
          )}
          <div className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
            <MathText text={mistake.questionText} />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-error-500" />
                </svg>
              </span>
              <span className="text-sm text-error-600 dark:text-error-400">
                Your answer: <span className="font-medium"><MathText text={mistake.studentAnswer} /></span>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2.5 5.5l2 2 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-success-500" />
                </svg>
              </span>
              <span className="text-sm text-success-600 dark:text-success-400">
                Correct answer: <span className="font-medium"><MathText text={mistake.correctAnswer} /></span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List with collapsible header ─────────────────────────────────────

export function MistakeReviewList({ mistakes }: MistakeReviewListProps) {
  const [expanded, setExpanded] = useState(false);

  if (mistakes.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={expanded}
      >
        <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
          Review Mistakes
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 text-xs font-bold w-5 h-5">
            {mistakes.length}
          </span>
        </h4>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`text-surface-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-2 animate-fade-in">
          {mistakes.map((m, i) => (
            <MistakeCard key={`${m.questionText.slice(0, 30)}-${i}`} mistake={m} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
