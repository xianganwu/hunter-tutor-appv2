"use client";

import { useState } from "react";
import type {
  ScoreReport as ScoreReportData,
  SectionScore,
  MissedQuestion,
  ImpactSkill,
} from "@/lib/simulation";
import {
  computeImpactAnalysis,
  formatShareableReport,
  getSkillPracticeRoute,
} from "@/lib/simulation";
import { MathText } from "@/components/chat/MathText";

interface ScoreReportProps {
  readonly report: ScoreReportData;
  readonly previousReport?: ScoreReportData;
}

export function ScoreReport({ report, previousReport }: ScoreReportProps) {
  const { overall, reading, writing, qr, ma, timeAnalysis, recommendations } =
    report;
  const isSample = report.mode === "sample";

  const impactSkills = computeImpactAnalysis(report);
  const weakestSkill = impactSkills[0];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          {report.formTitle ?? "Practice Exam"} Results
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Completed{" "}
          {new Date(report.completedAt).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Overall Score */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-center shadow-glow">
        <div className="text-5xl font-bold text-white">
          {overall.percentage}%
        </div>
        <div className="text-sm text-brand-200 mt-1">
          {overall.correct} of {overall.total} questions correct
        </div>
        <div className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1">
          <span className="text-sm font-medium text-white">
            Estimated {overall.estimatedPercentile}th Percentile
          </span>
        </div>
        {isSample && report.excludedCount ? (
          <div className="mt-2 text-xs text-brand-200">
            {report.excludedCount} questions excluded (image-dependent)
          </div>
        ) : null}
      </div>

      {/* Score Comparison Banner */}
      <ScoreComparison current={report} previous={previousReport} />

      {/* Section Breakdown */}
      {isSample ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard
            title="Verbal / Reading"
            score={reading}
            previousScore={previousReport?.reading}
          />
          {report.math && (
            <SectionCard
              title="Math"
              score={report.math}
              previousScore={previousReport?.math}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard
            title="Reading Comprehension"
            score={reading}
            previousScore={previousReport?.reading}
          />
          <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-2">
              Essay Writing
            </h3>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${writing.score >= 7 ? "text-success-500" : writing.score >= 5 ? "text-streak-500" : "text-red-500"}`}>
                {writing.score}
              </span>
              <span className="text-sm text-surface-400">/10</span>
            </div>
            <p className="text-xs text-surface-600 dark:text-surface-400 mt-2">
              {writing.feedback}
            </p>
            {writing.strengths.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-success-500 dark:text-success-400 font-medium">
                  Strengths
                </div>
                <ul className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">
                  {writing.strengths.map((s, i) => (
                    <li key={i}>+ {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {writing.improvements.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-streak-500 dark:text-streak-400 font-medium">
                  To Improve
                </div>
                <ul className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">
                  {writing.improvements.map((s, i) => (
                    <li key={i}>- {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <SectionCard
            title="Quantitative Reasoning"
            score={qr}
            previousScore={previousReport?.qr}
          />
          <SectionCard
            title="Math Achievement"
            score={ma}
            previousScore={previousReport?.ma}
          />
        </div>
      )}

      {/* Impact Analysis */}
      {impactSkills.length > 0 && (
        <ImpactAnalysisSection skills={impactSkills} />
      )}

      {/* Time Management */}
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Time Management
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <TimeBar
            label="ELA Booklet"
            used={timeAnalysis.elaUsedMinutes}
            allocated={timeAnalysis.elaAllocatedMinutes}
            verdict={timeAnalysis.elaVerdict}
          />
          <TimeBar
            label="Math Booklet"
            used={timeAnalysis.mathUsedMinutes}
            allocated={timeAnalysis.mathAllocatedMinutes}
            verdict={timeAnalysis.mathVerdict}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-surface-100 dark:border-surface-700">
          <div className="text-xs text-surface-500">
            <span className="font-medium">Est. reading time:</span>{" "}
            {timeAnalysis.readingTimeEstimate} min
          </div>
          <div className="text-xs text-surface-500">
            <span className="font-medium">Est. writing time:</span>{" "}
            {timeAnalysis.writingTimeEstimate} min
          </div>
        </div>

        <div className="text-xs text-surface-600 dark:text-surface-400">
          {timeAnalysis.elaVerdict === "rushed" &&
            "You used nearly all available ELA time. Practice reading passages more efficiently to leave time for review."}
          {timeAnalysis.elaVerdict === "surplus" &&
            "You finished ELA well under time. Use the extra minutes to double-check your reading answers and polish your essay."}
          {timeAnalysis.mathVerdict === "rushed" &&
            " Math timing was tight. Skip harder questions and come back to them if time allows."}
          {timeAnalysis.mathVerdict === "surplus" &&
            " You had plenty of math time. Use it to verify calculations."}
          {timeAnalysis.elaVerdict === "balanced" &&
            timeAnalysis.mathVerdict === "balanced" &&
            "Good pacing across both sections. Keep this rhythm on exam day."}
        </div>
      </div>

      {/* Skill Breakdown */}
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Skill-by-Skill Breakdown
        </h3>

        <SkillTable title={isSample ? "Verbal" : "Reading"} skills={reading.bySkill} sectionType="reading" />
        {isSample ? (
          report.math && <SkillTable title="Math" skills={report.math.bySkill} sectionType="math" />
        ) : (
          <>
            <SkillTable title="Quantitative Reasoning" skills={qr.bySkill} sectionType="math" />
            <SkillTable title="Math Achievement" skills={ma.bySkill} sectionType="math" />
          </>
        )}
      </div>

      {/* Question Review */}
      {report.missedQuestions && report.missedQuestions.length > 0 && (
        <QuestionReview missedQuestions={report.missedQuestions} />
      )}

      {/* Recommendations */}
      <div className="rounded-2xl border-2 border-success-200 dark:border-success-600/30 bg-success-50 dark:bg-success-500/10 p-5 space-y-3 shadow-card">
        <h3 className="text-sm font-semibold text-success-600 dark:text-success-400">
          Study Recommendations
        </h3>
        <ol className="space-y-2">
          {recommendations.map((rec, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300"
            >
              <span className="text-success-500 dark:text-success-400 font-bold flex-shrink-0">
                {i + 1}.
              </span>
              <span>{rec}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Shareable Summary */}
      <ShareableSummary report={report} />

      {/* Actions */}
      <div className="flex gap-3 justify-center flex-wrap">
        {weakestSkill && (
          <a
            href={weakestSkill.route}
            className="rounded-xl border-2 border-brand-600 px-6 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-600/10 transition-colors"
          >
            Practice Weakest Skill
          </a>
        )}
        <a
          href="/dashboard"
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

// ─── Score Comparison ────────────────────────────────────────────────

function ScoreComparison({
  current,
  previous,
}: {
  readonly current: ScoreReportData;
  readonly previous?: ScoreReportData;
}) {
  if (!previous) {
    return (
      <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4 text-center shadow-card">
        <p className="text-sm text-surface-500 dark:text-surface-400">
          First exam — take another to track your progress!
        </p>
      </div>
    );
  }

  const isSample = current.mode === "sample";
  const sections = isSample
    ? [
        { label: "Overall", prev: previous.overall.percentage, curr: current.overall.percentage },
        { label: "Verbal", prev: previous.reading.percentage, curr: current.reading.percentage },
        { label: "Math", prev: previous.math?.percentage ?? 0, curr: current.math?.percentage ?? 0 },
      ]
    : [
        { label: "Overall", prev: previous.overall.percentage, curr: current.overall.percentage },
        { label: "Reading", prev: previous.reading.percentage, curr: current.reading.percentage },
        { label: "QR", prev: previous.qr.percentage, curr: current.qr.percentage },
        { label: "Math", prev: previous.ma.percentage, curr: current.ma.percentage },
      ];

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">
        Compared to Last Exam
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sections.map((s) => {
          const delta = s.curr - s.prev;
          return (
            <div key={s.label} className="text-center">
              <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">
                {s.label}
              </div>
              <div className="text-sm text-surface-700 dark:text-surface-300">
                {s.prev}% <span className="text-surface-400 mx-0.5">&rarr;</span> {s.curr}%
              </div>
              <div
                className={`text-xs font-medium ${
                  delta > 0
                    ? "text-success-500"
                    : delta < 0
                      ? "text-red-500"
                      : "text-surface-400"
                }`}
              >
                {delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : "No change"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Impact Analysis ─────────────────────────────────────────────────

function ImpactAnalysisSection({
  skills,
}: {
  readonly skills: readonly ImpactSkill[];
}) {
  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
        Highest Impact Skills
      </h3>
      <p className="text-xs text-surface-500 dark:text-surface-400">
        Mastering these skills would raise your score the most.
      </p>
      <div className="space-y-2">
        {skills.map((skill) => (
          <div
            key={skill.skillId}
            className="flex items-center gap-3 rounded-xl bg-surface-50 dark:bg-surface-800/50 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-surface-900 dark:text-surface-100 truncate">
                {skill.skillName}
              </div>
              <div className="text-xs text-surface-500 dark:text-surface-400">
                {skill.missedCount} missed — Score: {skill.currentPercentage}% &rarr;{" "}
                {skill.projectedPercentage}% ({skill.currentPercentile}th &rarr;{" "}
                {skill.projectedPercentile}th pctl)
              </div>
            </div>
            <a
              href={skill.route}
              className="flex-shrink-0 rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Practice
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Question Review ─────────────────────────────────────────────────

function QuestionReview({
  missedQuestions,
}: {
  readonly missedQuestions: readonly MissedQuestion[];
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const sectionLabels: Record<string, string> = {
    reading: "Reading",
    qr: "Quantitative Reasoning",
    ma: "Math Achievement",
    math: "Math",
  };

  const sections = ["reading", "qr", "ma", "math"] as const;
  const grouped = sections
    .map((section) => ({
      section,
      label: sectionLabels[section],
      questions: missedQuestions.filter((q) => q.section === section),
    }))
    .filter((g) => g.questions.length > 0);

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
        Question Review ({missedQuestions.length} missed)
      </h3>
      <div className="space-y-2">
        {grouped.map((group) => (
          <div key={group.section}>
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === group.section ? null : group.section
                )
              }
              className="flex w-full items-center justify-between rounded-xl bg-surface-50 dark:bg-surface-800/50 px-3 py-2 text-xs font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <span>
                {group.label} ({group.questions.length} missed)
              </span>
              <span className="text-surface-400">
                {expandedSection === group.section ? "\u25B2" : "\u25BC"}
              </span>
            </button>
            {expandedSection === group.section && (
              <div className="mt-1 space-y-2 pl-1">
                {group.questions.map((q) => (
                  <div
                    key={q.questionId}
                    className="rounded-lg border border-surface-200 dark:border-surface-700 p-3 text-xs"
                  >
                    <p className="text-surface-900 dark:text-surface-100 mb-2 leading-relaxed">
                      <MathText text={q.questionText} />
                    </p>
                    <div className="flex flex-col gap-1">
                      <span className="text-red-500 dark:text-red-400">
                        Your answer: {q.studentAnswer}
                      </span>
                      <span className="text-success-500 dark:text-success-400">
                        Correct: {q.correctAnswer}
                      </span>
                    </div>
                    <span className="mt-1 inline-block rounded-full bg-surface-100 dark:bg-surface-700 px-2 py-0.5 text-xs text-surface-500">
                      {q.skillName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shareable Summary ───────────────────────────────────────────────

function ShareableSummary({
  report,
}: {
  readonly report: ScoreReportData;
}) {
  const [copied, setCopied] = useState(false);
  const text = formatShareableReport(report);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
        Share Results
      </h3>
      <pre className="rounded-xl bg-surface-50 dark:bg-surface-800/50 p-3 text-xs text-surface-600 dark:text-surface-400 whitespace-pre-wrap overflow-x-auto max-h-40">
        {text}
      </pre>
      <button
        onClick={handleCopy}
        className="rounded-lg bg-surface-100 dark:bg-surface-800 px-4 py-1.5 text-xs font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
      >
        {copied ? "Copied!" : "Copy Results"}
      </button>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function SectionCard({
  title,
  score,
  previousScore,
}: {
  readonly title: string;
  readonly score: SectionScore;
  readonly previousScore?: SectionScore;
}) {
  const pct = score.percentage;
  const textColor =
    pct >= 80
      ? "text-success-500"
      : pct >= 60
        ? "text-streak-500"
        : "text-red-500";

  const delta = previousScore ? pct - previousScore.percentage : null;

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-2">
        {title}
      </h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${textColor}`}>{pct}%</span>
        <span className="text-sm text-surface-400">
          ({score.correct}/{score.total})
        </span>
        {delta !== null && delta !== 0 && (
          <span
            className={`text-xs font-medium ${
              delta > 0 ? "text-success-500" : "text-red-500"
            }`}
          >
            {delta > 0 ? `+${delta}%` : `${delta}%`}
          </span>
        )}
      </div>
      {/* Mini bar */}
      <div className="mt-2 h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            pct >= 80
              ? "bg-success-500"
              : pct >= 60
                ? "bg-streak-500"
                : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TimeBar({
  label,
  used,
  allocated,
  verdict,
}: {
  readonly label: string;
  readonly used: number;
  readonly allocated: number;
  readonly verdict: "rushed" | "balanced" | "surplus";
}) {
  const pct = Math.min(100, Math.round((used / allocated) * 100));
  const verdictColors = {
    rushed: "text-red-500 dark:text-red-400",
    balanced: "text-success-500 dark:text-success-400",
    surplus: "text-brand-500 dark:text-brand-400",
  };
  const verdictLabels = {
    rushed: "Tight",
    balanced: "Good pace",
    surplus: "Time left",
  };

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-surface-600 dark:text-surface-400">{label}</span>
        <span className={verdictColors[verdict]}>
          {verdictLabels[verdict]}
        </span>
      </div>
      <div className="h-3 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            verdict === "rushed"
              ? "bg-red-500"
              : verdict === "balanced"
                ? "bg-success-500"
                : "bg-brand-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-surface-400 mt-0.5">
        {used} / {allocated} min
      </div>
    </div>
  );
}

function SkillTable({
  title,
  skills,
}: {
  readonly title: string;
  readonly skills: readonly {
    readonly skillId: string;
    readonly skillName: string;
    readonly correct: number;
    readonly total: number;
    readonly percentage: number;
  }[];
  readonly sectionType?: "reading" | "math";
}) {
  if (skills.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-medium text-surface-500 mb-1.5 uppercase tracking-wide">
        {title}
      </div>
      <div className="space-y-1">
        {skills.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
              i % 2 === 0
                ? "bg-surface-50 dark:bg-surface-800/50"
                : ""
            }`}
          >
            <div className="flex-1 text-surface-700 dark:text-surface-300 truncate">
              {s.skillName}
            </div>
            <div className="text-surface-400 flex-shrink-0">
              {s.correct}/{s.total}
            </div>
            <div
              className={`w-10 text-right font-medium flex-shrink-0 ${
                s.percentage >= 80
                  ? "text-success-500"
                  : s.percentage >= 60
                    ? "text-streak-500"
                    : "text-red-500"
              }`}
            >
              {s.percentage}%
            </div>
            {s.percentage < 80 && (
              <a
                href={getSkillPracticeRoute(s.skillId)}
                className="flex-shrink-0 text-brand-600 dark:text-brand-400 hover:underline"
              >
                Practice
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
