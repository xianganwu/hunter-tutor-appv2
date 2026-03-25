"use client";

import { ASSESSMENT_CONFIG } from "@/lib/assessment";

interface AssessmentLandingProps {
  readonly onStart: () => void;
  readonly cooldownInfo: {
    readonly allowed: boolean;
    readonly nextDate: string | null;
    readonly daysSinceLast: number | null;
  };
  readonly savedAssessment: {
    readonly phase: string;
    readonly answeredCount: number;
    readonly savedAt: number;
  } | null;
  readonly onResume: () => void;
  readonly onAbandon: () => void;
  readonly pastAssessments: number;
}

const SECTIONS = [
  {
    label: "ELA Reading",
    detail: `~${ASSESSMENT_CONFIG.readingQuestionTarget} questions`,
    time: `${ASSESSMENT_CONFIG.readingMinutes} min`,
  },
  { label: "Break", detail: "Stretch & rest", time: `${ASSESSMENT_CONFIG.breakMinutes} min` },
  {
    label: "Quantitative Reasoning",
    detail: `~${ASSESSMENT_CONFIG.qrQuestionTarget} questions`,
    time: `${ASSESSMENT_CONFIG.qrMinutes} min`,
  },
  {
    label: "Math Achievement",
    detail: `~${ASSESSMENT_CONFIG.maQuestionTarget} questions`,
    time: `${ASSESSMENT_CONFIG.maMinutes} min`,
  },
  { label: "Break", detail: "Stretch & rest", time: `${ASSESSMENT_CONFIG.breakMinutes} min` },
  {
    label: "Writing",
    detail: "1 essay prompt",
    time: `${ASSESSMENT_CONFIG.writingMinutes} min`,
  },
] as const;

const TOTAL_MINUTES =
  ASSESSMENT_CONFIG.readingMinutes +
  ASSESSMENT_CONFIG.qrMinutes +
  ASSESSMENT_CONFIG.maMinutes +
  ASSESSMENT_CONFIG.writingMinutes +
  ASSESSMENT_CONFIG.breakMinutes * 2;

export function AssessmentLanding({
  onStart,
  cooldownInfo,
  savedAssessment,
  onResume,
  onAbandon,
  pastAssessments,
}: AssessmentLandingProps) {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          Assessment Test
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">
          Half-length Hunter practice test with score prediction
        </p>
      </div>

      {/* Resume Card */}
      {savedAssessment && (
        <div className="rounded-2xl border-2 border-brand-300 dark:border-brand-600/40 bg-brand-50 dark:bg-brand-600/10 p-5 space-y-3 shadow-card">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            Resume In-Progress Assessment
          </h2>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            You have an unfinished assessment ({savedAssessment.phase} section,{" "}
            {savedAssessment.answeredCount} answers recorded). Last saved{" "}
            {new Date(savedAssessment.savedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </p>
          <div className="flex gap-3">
            <button
              onClick={onResume}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Resume Assessment
            </button>
            <button
              onClick={onAbandon}
              className="rounded-xl border border-surface-300 dark:border-surface-600 px-4 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Section Breakdown */}
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Test Sections
        </h2>
        <div className="space-y-2">
          {SECTIONS.map((section, i) => (
            <div
              key={i}
              className={`flex items-center justify-between text-sm ${
                section.label === "Break"
                  ? "text-surface-400 dark:text-surface-500 pl-3"
                  : "text-surface-600 dark:text-surface-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {section.label !== "Break" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                )}
                {section.label === "Break" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-300 dark:bg-surface-600 flex-shrink-0" />
                )}
                <span className="font-medium text-surface-900 dark:text-surface-100">
                  {section.label}
                </span>
                <span className="text-xs">{section.detail}</span>
              </div>
              <span className="text-xs font-mono text-surface-500 dark:text-surface-400">
                {section.time}
              </span>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-surface-100 dark:border-surface-700 flex justify-between text-sm">
          <span className="font-medium text-surface-900 dark:text-surface-100">
            Total
          </span>
          <span className="font-mono font-medium text-brand-600 dark:text-brand-400">
            ~{TOTAL_MINUTES} minutes
          </span>
        </div>
      </div>

      {/* Rules Callout */}
      <div className="rounded-xl bg-streak-50 dark:bg-streak-500/10 border border-streak-200 dark:border-streak-600/30 p-3 text-xs text-streak-600 dark:text-streak-400 space-y-1">
        <div className="font-medium">Assessment Rules</div>
        <ul className="space-y-0.5">
          <li>- This is a timed test. Each section has its own timer.</li>
          <li>- No hints or help available during the test.</li>
          <li>- Navigate freely within each section, but you cannot go back to previous sections.</li>
          <li>- There is no penalty for guessing — answer every question.</li>
        </ul>
      </div>

      {/* Cooldown or Start Button */}
      {!cooldownInfo.allowed ? (
        <div className="rounded-2xl border-2 border-streak-200 dark:border-streak-600/30 bg-streak-50 dark:bg-streak-500/10 p-5 space-y-2 text-center shadow-card">
          <p className="text-sm font-medium text-streak-600 dark:text-streak-400">
            Next assessment available {cooldownInfo.nextDate}
          </p>
          <p className="text-xs text-streak-500 dark:text-streak-500">
            Assessments are limited to once every {ASSESSMENT_CONFIG.cooldownDays}{" "}
            days to ensure meaningful progress between tests.
          </p>
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Start Assessment
        </button>
      )}

      {/* Past Assessment Count */}
      {pastAssessments > 0 && (
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 text-center">
          <p className="text-sm text-surface-500 dark:text-surface-400">
            You&apos;ve taken {pastAssessments} assessment
            {pastAssessments !== 1 && "s"}. Your results are available in your{" "}
            <a
              href="/parent"
              className="text-brand-600 dark:text-brand-400 hover:underline"
            >
              progress dashboard
            </a>
            .
          </p>
        </div>
      )}

      {/* Back to Dashboard */}
      <div className="text-center">
        <a
          href="/dashboard"
          className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
