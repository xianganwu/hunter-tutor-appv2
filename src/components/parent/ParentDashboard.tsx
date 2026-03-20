"use client";

import { useState, useEffect, useCallback } from "react";
import { MasteryChart } from "./MasteryChart";
import { WeeklyReport } from "./WeeklyReport";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { aggregateParentData } from "@/lib/parent-data";
import type { ParentData, DomainReadiness, SessionLogEntry } from "@/lib/parent-data";
import { MissedQuestionsByWeek } from "./MissedQuestionsByWeek";
import { computeWeeklyDigest, type WeeklyDigest } from "@/lib/weekly-digest";

// ─── Main Component ───────────────────────────────────────────────────

export function ParentDashboard() {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check session
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("parent-auth")) {
      setAuthenticated(true);
    }
  }, []);

  const verifyPin = useCallback(async () => {
    setLoading(true);
    setPinError(null);

    try {
      const res = await fetch("/api/parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "verify_pin", pin }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (data.success) {
        sessionStorage.setItem("parent-auth", "true");
        setAuthenticated(true);
      } else {
        setPinError(data.error ?? "Incorrect PIN");
      }
    } catch {
      setPinError("Could not verify PIN. Please try again.");
    }

    setLoading(false);
  }, [pin]);

  if (!authenticated) {
    return (
      <PinGate
        pin={pin}
        onPinChange={setPin}
        onSubmit={verifyPin}
        error={pinError}
        loading={loading}
      />
    );
  }

  return <Dashboard />;
}

// ─── PIN Gate ─────────────────────────────────────────────────────────

function PinGate({
  pin,
  onPinChange,
  onSubmit,
  error,
  loading,
}: {
  readonly pin: string;
  readonly onPinChange: (pin: string) => void;
  readonly onSubmit: () => void;
  readonly error: string | null;
  readonly loading: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pin.length >= 4) {
      onSubmit();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-surface-50 dark:bg-surface-950">
      <div className="max-w-sm w-full px-4 space-y-6 text-center">
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              Parent Dashboard
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Enter your PIN to view progress
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => onPinChange(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleKeyDown}
              placeholder="Enter PIN"
              className="w-full text-center text-2xl tracking-[0.5em] rounded-2xl border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-4 py-3 text-surface-900 dark:text-surface-100 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Parent PIN"
              autoFocus
            />

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              onClick={onSubmit}
              disabled={pin.length < 4 || loading}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Verifying..." : "View Dashboard"}
            </button>
          </div>

          <p className="text-xs text-surface-400">
            Default PIN is 1234. Set PARENT_PIN in .env to change.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Content ────────────────────────────────────────────────

function Dashboard() {
  const [data, setData] = useState<ParentData | null>(null);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [focusAreas, setFocusAreas] = useState<readonly string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyDigest | null>(null);
  const [loadingDigest, setLoadingDigest] = useState(false);

  // Load data on mount
  useEffect(() => {
    const d = aggregateParentData();
    setData(d);
  }, []);

  // Fetch AI assessment
  const fetchAssessment = useCallback(async () => {
    if (!data) return;
    setLoadingAi(true);

    try {
      const res = await fetch("/api/parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "get_assessment",
          domains: data.domainReadiness,
          weeklyMinutes: data.weeklyMinutes,
          weeklyTarget: data.weeklyTarget,
          latestSimPercentile: data.latestSimPercentile,
          readingLevel: data.readingLevel,
          readingWpm: data.readingWpm,
          mistakePatterns: data.mistakePatterns,
        }),
      });

      if (res.ok) {
        const result = (await res.json()) as {
          assessment?: string;
          focusAreas?: readonly string[];
        };
        setAssessment(result.assessment ?? null);
        setFocusAreas(result.focusAreas ?? []);
      }
    } catch {
      setAssessment(
        "Unable to generate assessment right now. Check the data below for details."
      );
    }

    setLoadingAi(false);
  }, [data]);

  useEffect(() => {
    if (data) {
      void fetchAssessment();
    }
  }, [data, fetchAssessment]);

  const generateWeeklyReport = useCallback(async () => {
    if (!data) return;
    setLoadingDigest(true);

    // Compute digest locally
    const digest = computeWeeklyDigest(
      data.activeDaysThisWeek,
      data.weeklyMinutes,
      { current: 0, longest: 0 }, // Streak data not available directly, but non-critical
      0, // Essays count not tracked in parent data directly
    );

    // Fetch AI narrative
    try {
      const res = await fetch("/api/parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate_weekly_digest",
          practiceDays: digest.practiceDays,
          totalMinutes: digest.totalMinutes,
          skillsImproved: digest.skillsImproved,
          areasNeedingAttention: digest.areasNeedingAttention,
          essaysWritten: digest.essaysWritten,
          drillsCompleted: digest.drillsCompleted,
          badgesEarned: digest.badgesEarned,
          streakCurrent: digest.streakStatus.current,
          streakLongest: digest.streakStatus.longest,
        }),
      });

      if (res.ok) {
        const result = (await res.json()) as { narrative?: string };
        setWeeklyDigest({
          ...digest,
          aiNarrative: result.narrative ?? "",
        });
      } else {
        setWeeklyDigest(digest);
      }
    } catch {
      setWeeklyDigest(digest);
    }

    setLoadingDigest(false);
    setShowWeeklyReport(true);
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <TypingIndicator />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 bg-surface-50 dark:bg-surface-950 min-h-screen">
      {/* Weekly Report overlay */}
      {showWeeklyReport && weeklyDigest && (
        <WeeklyReport
          digest={weeklyDigest}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}

      {/* Header */}
      {!showWeeklyReport && (
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Parent Dashboard
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Hunter exam prep progress overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void generateWeeklyReport()}
            disabled={loadingDigest}
            className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loadingDigest ? "Generating..." : "Weekly Report"}
          </button>
          <a
            href="/dashboard"
            className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            Student View
          </a>
        </div>
      </div>
      )}

      {!showWeeklyReport && <>
      {/* Weekly Practice */}
      <WeeklyPracticeCard
        minutes={data.weeklyMinutes}
        target={data.weeklyTarget}
        activeDays={data.activeDaysThisWeek}
      />

      {/* Mastery Over Time */}
      <section>
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">
          Mastery Progress Over Time
        </h2>
        <MasteryChart data={data.masteryTimeline} />
      </section>

      {/* AI Assessment */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Readiness Assessment
        </h2>

        {loadingAi && !assessment ? (
          <div className="rounded-2xl shadow-card bg-brand-50 dark:bg-brand-600/10 p-5">
            <TypingIndicator />
          </div>
        ) : assessment ? (
          <div className="rounded-2xl shadow-card bg-brand-50 dark:bg-brand-600/10 p-5">
            <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
              {assessment}
            </p>
          </div>
        ) : null}

        {/* Domain Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.domainReadiness.map((d) => (
            <DomainCard key={d.domainName} domain={d} />
          ))}
        </div>
      </section>

      {/* Focus Areas */}
      {focusAreas.length > 0 && (
        <section className="rounded-2xl border-2 border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-600/10 p-5 space-y-3 shadow-card">
          <h2 className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Recommended Focus This Week
          </h2>
          <ol className="space-y-2">
            {focusAreas.map((area, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300"
              >
                <span className="text-brand-600 dark:text-brand-400 font-bold flex-shrink-0">
                  {i + 1}.
                </span>
                <span>{area}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.readingLevel !== null && (
          <StatCard
            label="Reading Level"
            value={`${data.readingLevel}/6`}
            sub={data.readingWpm ? `${data.readingWpm} WPM` : undefined}
          />
        )}
        {data.latestSimPercentile !== null && (
          <StatCard
            label="Est. Percentile"
            value={`${data.latestSimPercentile}th`}
            sub="Latest practice exam"
          />
        )}
        <StatCard
          label="Total Sessions"
          value={String(data.totalSessions)}
        />
        {data.mistakePatterns.length > 0 && (
          <StatCard
            label="Top Mistake Area"
            value={data.mistakePatterns[0].skillName}
            sub={`${data.mistakePatterns[0].count} occurrences`}
          />
        )}
      </div>

      {/* Session Log */}
      <section>
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">
          Recent Sessions
        </h2>
        <SessionLog entries={data.sessionLog} />
      </section>

      {/* Missed Questions by Week */}
      {data.missedQuestionsByWeek.length > 0 && (
        <MissedQuestionsByWeek weeks={data.missedQuestionsByWeek} />
      )}

      {/* Privacy note */}
      <p className="text-xs text-surface-400 text-center pb-4">
        Missed questions are shown to help you support your child&apos;s
        learning. We recommend using these to encourage and guide, not to test.
      </p>
      </>}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function WeeklyPracticeCard({
  minutes,
  target,
  activeDays,
}: {
  readonly minutes: number;
  readonly target: number;
  readonly activeDays: number;
}) {
  const pct = Math.min(100, Math.round((minutes / target) * 100));
  const onTrack = pct >= 60;

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          This Week&apos;s Practice
        </h2>
        <span className="text-xs text-surface-400">
          {activeDays} day{activeDays !== 1 ? "s" : ""} active
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-3xl font-bold ${onTrack ? "text-success-500 dark:text-success-400" : "text-streak-500 dark:text-streak-400"}`}>
          {minutes}
        </span>
        <span className="text-sm text-surface-400">/ {target} min target</span>
      </div>

      <div className="h-3 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 80
              ? "bg-success-500"
              : pct >= 40
                ? "bg-streak-500"
                : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-surface-500 mt-2">
        {pct >= 100
          ? "Target met! Great consistency this week."
          : pct >= 60
            ? `${target - minutes} more minutes to hit the weekly target.`
            : `Behind target. Encourage ${Math.ceil((target - minutes) / 25)} more practice sessions.`}
      </p>
    </div>
  );
}

function DomainCard({
  domain,
}: {
  readonly domain: DomainReadiness;
}) {
  const trendIcons = { improving: "\u2191", stable: "\u2192", declining: "\u2193" };
  const trendColors = {
    improving: "text-success-500 dark:text-success-400",
    stable: "text-surface-400",
    declining: "text-red-500 dark:text-red-400",
  };

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-surface-700 dark:text-surface-300 truncate pr-2">
          {domain.domainName}
        </h3>
        <span className={`text-xs font-medium ${trendColors[domain.trend]}`}>
          {trendIcons[domain.trend]} {domain.trend}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span
          className={`text-2xl font-bold ${
            domain.mastery >= 70
              ? "text-success-500 dark:text-success-400"
              : domain.mastery >= 50
                ? "text-streak-500 dark:text-streak-400"
                : "text-red-500 dark:text-red-400"
          }`}
        >
          {domain.mastery}%
        </span>
      </div>

      {domain.strongSkills.length > 0 && (
        <div className="text-xs">
          <span className="text-success-500 dark:text-success-400 font-medium">
            Strong:
          </span>{" "}
          <span className="text-surface-600 dark:text-surface-400">
            {domain.strongSkills.join(", ")}
          </span>
        </div>
      )}

      {domain.weakSkills.length > 0 && (
        <div className="text-xs">
          <span className="text-streak-500 dark:text-streak-400 font-medium">
            Needs work:
          </span>{" "}
          <span className="text-surface-600 dark:text-surface-400">
            {domain.weakSkills.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
}) {
  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-3">
      <div className="text-xs text-surface-400 mb-0.5">{label}</div>
      <div className="text-lg font-bold text-surface-900 dark:text-surface-100 truncate">
        {value}
      </div>
      {sub && <div className="text-xs text-surface-400 truncate">{sub}</div>}
    </div>
  );
}

function SessionLog({
  entries,
}: {
  readonly entries: readonly SessionLogEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 text-center text-sm text-surface-400">
        No sessions recorded yet. Sessions will appear here after practice.
      </div>
    );
  }

  const typeIcons = {
    tutoring: "\ud83d\udcdd",
    reading: "\ud83d\udcd6",
    writing: "\u270f\ufe0f",
    simulation: "\ud83c\udfaf",
  };

  const typeLabels = {
    tutoring: "Tutoring",
    reading: "Reading",
    writing: "Writing",
    simulation: "Practice Exam",
  };

  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 divide-y divide-surface-100 dark:divide-surface-800">
      {entries.map((entry, i) => (
        <div key={i} className="px-4 py-3 flex items-start gap-3">
          <span className="text-base flex-shrink-0 mt-0.5">
            {typeIcons[entry.type]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-surface-400 mb-0.5">
              <span>{typeLabels[entry.type]}</span>
              <span>
                {new Date(entry.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {entry.durationMinutes !== null && (
                <span>{entry.durationMinutes} min</span>
              )}
            </div>
            <p className="text-sm text-surface-700 dark:text-surface-300 truncate">
              {entry.summary}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
