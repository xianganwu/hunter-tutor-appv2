"use client";

import { useState } from "react";
import type {
  AssessmentReport,
  SkillAssessment,
  SectionAssessmentScore,
} from "@/lib/assessment-scoring";
import { getSkillPracticeRoute } from "@/lib/simulation";
import { MathText } from "@/components/chat/MathText";

interface AssessmentResultsProps {
  readonly report: AssessmentReport;
  readonly previousReport?: AssessmentReport;
}

export function AssessmentResults({
  report,
  previousReport,
}: AssessmentResultsProps) {
  const { overall, reading, qr, ma, writing, strongSkills, weakSkills, recommendations, missedQuestions } =
    report;

  const weakestSkill = weakSkills[0];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          Assessment Results
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

      {/* Score Projection Hero */}
      <ScoreProjectionCard
        estimatedScore={overall.estimatedScore}
        rangeLow={overall.rangeLow}
        rangeHigh={overall.rangeHigh}
        percentile={overall.estimatedPercentile}
        confidence={overall.confidence}
      />

      {/* Comparison */}
      {previousReport ? (
        <ComparisonCard current={report} previous={previousReport} />
      ) : (
        <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4 text-center shadow-card">
          <p className="text-sm text-surface-500 dark:text-surface-400">
            First assessment — take another to track your progress!
          </p>
        </div>
      )}

      {/* Section Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard
          title="Reading Comprehension"
          score={reading}
          previousScore={previousReport?.reading}
        />
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
        <WritingCard
          writing={writing}
          previousWriting={previousReport?.writing}
        />
      </div>

      {/* Strengths & Weaknesses */}
      <StrengthsWeaknessesSection
        strengths={strongSkills}
        weaknesses={weakSkills}
      />

      {/* Recommendations */}
      {recommendations.length > 0 && (
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
      )}

      {/* Missed Questions (Expandable) */}
      {missedQuestions.length > 0 && <MissedQuestionsSection questions={missedQuestions} />}

      {/* Actions */}
      <div className="flex gap-3 justify-center flex-wrap">
        {weakestSkill && (
          <a
            href={getSkillPracticeRoute(weakestSkill.skillId)}
            className="rounded-xl border-2 border-brand-600 px-6 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-600/10 transition-colors"
          >
            Practice Weak Areas
          </a>
        )}
        <a
          href="/dashboard"
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Back to Dashboard
        </a>
      </div>

      {/* Disclaimer */}
      <div className="text-center">
        <p className="text-xs text-surface-400 max-w-md mx-auto">
          This is an estimated score range based on a half-length test. Actual
          Hunter exam performance may vary based on full-length test conditions,
          test-day factors, and question variability.
        </p>
      </div>
    </div>
  );
}

// ─── Score Projection Card ────────────────────────────────────────────

function ScoreProjectionCard({
  estimatedScore,
  rangeLow,
  rangeHigh,
  percentile,
  confidence,
}: {
  readonly estimatedScore: number;
  readonly rangeLow: number;
  readonly rangeHigh: number;
  readonly percentile: number;
  readonly confidence: "high" | "medium" | "low";
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-center shadow-glow">
      {/* Large Score */}
      <div className="text-5xl font-bold text-white">{estimatedScore}</div>
      <div className="text-sm text-brand-200 mt-1">Estimated Score</div>

      {/* Range Gauge */}
      <div className="mt-4 mx-auto max-w-xs">
        <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
          <div
            className="absolute top-0 h-full bg-white/50 rounded-full"
            style={{
              left: `${rangeLow}%`,
              width: `${rangeHigh - rangeLow}%`,
            }}
          />
          <div
            className="absolute top-0 w-2 h-full bg-white rounded-full -translate-x-1/2"
            style={{ left: `${estimatedScore}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-brand-300 mt-1">
          <span>{rangeLow}</span>
          <span>{rangeHigh}</span>
        </div>
      </div>

      {/* Percentile Badge */}
      <div className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1">
        <span className="text-sm font-medium text-white">
          Est. {percentile}th Percentile
        </span>
      </div>

      {/* Confidence */}
      <div className="mt-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            confidence === "high"
              ? "bg-success-500/30 text-success-200"
              : confidence === "medium"
                ? "bg-streak-500/30 text-streak-200"
                : "bg-red-500/30 text-red-200"
          }`}
        >
          {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
        </span>
      </div>
    </div>
  );
}

// ─── Section Score Card ──────────────────────────────────────────────

function SectionCard({
  title,
  score,
  previousScore,
}: {
  readonly title: string;
  readonly score: SectionAssessmentScore;
  readonly previousScore?: SectionAssessmentScore;
}) {
  const color =
    score.rawPercentage >= 80
      ? "text-success-500 dark:text-success-400"
      : score.rawPercentage >= 50
        ? "text-streak-500 dark:text-streak-400"
        : "text-red-500 dark:text-red-400";

  const delta = previousScore
    ? score.rawPercentage - previousScore.rawPercentage
    : null;

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-2">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
        {title}
      </h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${color}`}>
          {score.rawPercentage}%
        </span>
        <span className="text-xs text-surface-400">
          {score.correct}/{score.total} correct
        </span>
      </div>
      {score.weightedPercentage !== score.rawPercentage && (
        <div className="text-xs text-surface-500 dark:text-surface-400">
          Weighted: {score.weightedPercentage}%
        </div>
      )}
      {delta !== null && (
        <div
          className={`text-xs font-medium ${
            delta > 0
              ? "text-success-500 dark:text-success-400"
              : delta < 0
                ? "text-red-500 dark:text-red-400"
                : "text-surface-400"
          }`}
        >
          {delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : "No change"} vs. last
        </div>
      )}
    </div>
  );
}

// ─── Writing Card ────────────────────────────────────────────────────

function WritingCard({
  writing,
  previousWriting,
}: {
  readonly writing: AssessmentReport["writing"];
  readonly previousWriting?: AssessmentReport["writing"];
}) {
  const color =
    writing.overall >= 7
      ? "text-success-500 dark:text-success-400"
      : writing.overall >= 5
        ? "text-streak-500 dark:text-streak-400"
        : "text-red-500 dark:text-red-400";

  const delta = previousWriting
    ? writing.overall - previousWriting.overall
    : null;

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
        Essay Writing
      </h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${color}`}>
          {writing.overall}
        </span>
        <span className="text-sm text-surface-400">/10</span>
      </div>
      {delta !== null && (
        <div
          className={`text-xs font-medium ${
            delta > 0
              ? "text-success-500 dark:text-success-400"
              : delta < 0
                ? "text-red-500 dark:text-red-400"
                : "text-surface-400"
          }`}
        >
          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "No change"} vs.
          last
        </div>
      )}

      {/* Mini rubric bars */}
      <div className="space-y-1.5">
        {(
          [
            ["Organization", writing.rubric.organization],
            ["Development", writing.rubric.developmentOfIdeas],
            ["Word Choice", writing.rubric.wordChoice],
            ["Sentences", writing.rubric.sentenceStructure],
            ["Mechanics", writing.rubric.mechanics],
          ] as const
        ).map(([label, score]) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-surface-500 dark:text-surface-400 flex-shrink-0">
              {label}
            </span>
            <div className="flex-1 h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  score >= 7
                    ? "bg-success-500"
                    : score >= 5
                      ? "bg-streak-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${score * 10}%` }}
              />
            </div>
            <span className="text-surface-400 w-4 text-right">{score}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-surface-600 dark:text-surface-400">
        {writing.feedback}
      </p>

      {writing.strengths.length > 0 && (
        <div>
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
        <div>
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
  );
}

// ─── Comparison Card ─────────────────────────────────────────────────

function ComparisonCard({
  current,
  previous,
}: {
  readonly current: AssessmentReport;
  readonly previous: AssessmentReport;
}) {
  const sections = [
    {
      label: "Overall",
      prev: previous.overall.estimatedScore,
      curr: current.overall.estimatedScore,
    },
    {
      label: "Reading",
      prev: previous.reading.rawPercentage,
      curr: current.reading.rawPercentage,
    },
    {
      label: "QR",
      prev: previous.qr.rawPercentage,
      curr: current.qr.rawPercentage,
    },
    {
      label: "Math",
      prev: previous.ma.rawPercentage,
      curr: current.ma.rawPercentage,
    },
  ];

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">
        Compared to Last Assessment
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
                {s.prev}%{" "}
                <span className="text-surface-400 mx-0.5">&rarr;</span>{" "}
                {s.curr}%
              </div>
              <div
                className={`text-xs font-medium ${
                  delta > 0
                    ? "text-success-500 dark:text-success-400"
                    : delta < 0
                      ? "text-red-500 dark:text-red-400"
                      : "text-surface-400"
                }`}
              >
                {delta > 0
                  ? `+${delta}%`
                  : delta < 0
                    ? `${delta}%`
                    : "No change"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Strengths & Weaknesses ──────────────────────────────────────────

function StrengthsWeaknessesSection({
  strengths,
  weaknesses,
}: {
  readonly strengths: readonly SkillAssessment[];
  readonly weaknesses: readonly SkillAssessment[];
}) {
  if (strengths.length === 0 && weaknesses.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Strong Areas */}
      {strengths.length > 0 && (
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-success-600 dark:text-success-400">
            Strong Areas
          </h3>
          <div className="space-y-2">
            {strengths.slice(0, 6).map((skill) => (
              <SkillBar
                key={skill.skillId}
                skill={skill}
                colorClass="bg-success-500"
              />
            ))}
          </div>
        </div>
      )}

      {/* Needs Work */}
      {weaknesses.length > 0 && (
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-red-500 dark:text-red-400">
            Needs Work
          </h3>
          <div className="space-y-2">
            {weaknesses.slice(0, 6).map((skill) => (
              <SkillBar
                key={skill.skillId}
                skill={skill}
                colorClass="bg-red-500"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillBar({
  skill,
  colorClass,
}: {
  readonly skill: SkillAssessment;
  readonly colorClass: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-surface-700 dark:text-surface-300 truncate mr-2">
          {skill.skillName}
        </span>
        <span className="text-surface-500 dark:text-surface-400 flex-shrink-0">
          {skill.percentage}% ({skill.correct}/{skill.total})
        </span>
      </div>
      <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${skill.percentage}%` }}
        />
      </div>
    </div>
  );
}

// ─── Missed Questions (Expandable) ──────────────────────────────────

function MissedQuestionsSection({
  questions,
}: {
  readonly questions: AssessmentReport["missedQuestions"];
}) {
  const [expanded, setExpanded] = useState(false);

  const sectionLabels: Record<string, string> = {
    reading: "Reading",
    qr: "Quantitative Reasoning",
    ma: "Math Achievement",
  };

  const sections = (["reading", "qr", "ma"] as const)
    .map((section) => ({
      section,
      label: sectionLabels[section],
      questions: questions.filter((q) => q.section === section),
    }))
    .filter((g) => g.questions.length > 0);

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Missed Questions ({questions.length})
        </h3>
        <span className="text-xs text-surface-400">
          {expanded ? "Hide" : "View Full Details"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 animate-slide-up">
          {sections.map((s) => (
            <div key={s.section}>
              <h4 className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-2">
                {s.label} ({s.questions.length})
              </h4>
              <div className="space-y-3">
                {s.questions.map((mq) => (
                  <div
                    key={mq.questionId}
                    className="rounded-xl bg-surface-50 dark:bg-surface-800/50 p-3 text-sm space-y-1"
                  >
                    <div className="text-surface-900 dark:text-surface-100">
                      <MathText text={mq.questionText} />
                    </div>
                    <div className="text-xs text-red-500 dark:text-red-400">
                      Your answer: {mq.studentAnswer}
                    </div>
                    <div className="text-xs text-success-500 dark:text-success-400">
                      Correct: {mq.correctAnswer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
