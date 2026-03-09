"use client";

import type { ScoreReport as ScoreReportData, SectionScore } from "@/lib/simulation";

interface ScoreReportProps {
  readonly report: ScoreReportData;
}

export function ScoreReport({ report }: ScoreReportProps) {
  const { overall, reading, writing, qr, ma, timeAnalysis, recommendations } =
    report;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          Practice Exam Results
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
      </div>

      {/* Section Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard
          title="Reading Comprehension"
          score={reading}
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
        />
        <SectionCard
          title="Math Achievement"
          score={ma}
        />
      </div>

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

        <SkillTable title="Reading" skills={reading.bySkill} />
        <SkillTable title="Quantitative Reasoning" skills={qr.bySkill} />
        <SkillTable title="Math Achievement" skills={ma.bySkill} />
      </div>

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

      {/* Actions */}
      <div className="flex gap-3 justify-center">
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

// ─── Sub-components ───────────────────────────────────────────────────

function SectionCard({
  title,
  score,
}: {
  readonly title: string;
  readonly score: SectionScore;
}) {
  const pct = score.percentage;
  const textColor =
    pct >= 80
      ? "text-success-500"
      : pct >= 60
        ? "text-streak-500"
        : "text-red-500";

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
    readonly skillName: string;
    readonly correct: number;
    readonly total: number;
    readonly percentage: number;
  }[];
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
          </div>
        ))}
      </div>
    </div>
  );
}
