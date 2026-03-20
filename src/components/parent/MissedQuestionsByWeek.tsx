"use client";

import { useState } from "react";
import { MathText } from "@/components/chat/MathText";
import type {
  MissedQuestionWeekGroup,
  NormalizedMissedQuestion,
} from "@/lib/parent-data";

// ─── Source Badge Styles ──────────────────────────────────────────────

const SOURCE_STYLES = {
  tutoring: {
    label: "Tutoring",
    bg: "bg-brand-100 dark:bg-brand-900/30",
    text: "text-brand-700 dark:text-brand-300",
  },
  drill: {
    label: "Drill",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  "practice-exam": {
    label: "Practice Exam",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
  },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  conceptual_gap: "Conceptual Gap",
  careless_error: "Careless Error",
  misread_question: "Misread Question",
};

// ─── QuestionCard ─────────────────────────────────────────────────────

function QuestionCard({
  question,
}: {
  readonly question: NormalizedMissedQuestion;
}) {
  const style = SOURCE_STYLES[question.source];

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-surface-800 dark:text-surface-200 flex-1">
          <MathText text={question.questionText} />
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
      </div>

      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-surface-400 text-xs">Student:</span>{" "}
          <span className="text-red-600 dark:text-red-400 font-medium">
            {question.studentAnswer}
          </span>
        </div>
        <div>
          <span className="text-surface-400 text-xs">Correct:</span>{" "}
          <span className="text-success-600 dark:text-success-400 font-medium">
            {question.correctAnswer}
          </span>
        </div>
      </div>

      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
        {question.skillName}
      </span>

      {question.diagnosis && (
        <div className="text-xs bg-surface-50 dark:bg-surface-800/50 rounded-xl p-3 space-y-1">
          <span className="font-medium text-surface-600 dark:text-surface-300">
            {CATEGORY_LABELS[question.diagnosis.category] ??
              question.diagnosis.category}
          </span>
          <p className="text-surface-500 dark:text-surface-400">
            {question.diagnosis.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── WeekAccordion ────────────────────────────────────────────────────

function WeekAccordion({
  week,
  expanded,
  onToggle,
}: {
  readonly week: MissedQuestionWeekGroup;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            {week.weekLabel}
          </span>
          <span className="text-xs text-surface-400">
            {week.questions.length} question
            {week.questions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span
          className={`text-surface-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          &#x25BE;
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {week.questions.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MissedQuestionsByWeek ────────────────────────────────────────────

export function MissedQuestionsByWeek({
  weeks,
}: {
  readonly weeks: readonly MissedQuestionWeekGroup[];
}) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(
    weeks.length > 0 ? weeks[0].weekStartISO : null
  );

  return (
    <section>
      <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">
        Missed Questions by Week
      </h2>
      <div className="space-y-3">
        {weeks.map((week) => (
          <WeekAccordion
            key={week.weekStartISO}
            week={week}
            expanded={expandedWeek === week.weekStartISO}
            onToggle={() =>
              setExpandedWeek(
                expandedWeek === week.weekStartISO
                  ? null
                  : week.weekStartISO
              )
            }
          />
        ))}
      </div>
    </section>
  );
}
