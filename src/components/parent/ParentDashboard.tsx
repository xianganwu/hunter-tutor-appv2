"use client";

import { useState, useEffect, useCallback } from "react";
import { MasteryChart } from "./MasteryChart";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { aggregateParentData } from "@/lib/parent-data";
import type { ParentData, DomainReadiness, SessionLogEntry } from "@/lib/parent-data";

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
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-sm w-full px-4 space-y-6 text-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Parent Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
            className="w-full text-center text-2xl tracking-[0.5em] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Parent PIN"
            autoFocus
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            onClick={onSubmit}
            disabled={pin.length < 4 || loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying..." : "View Dashboard"}
          </button>
        </div>

        <p className="text-xs text-gray-400">
          Default PIN is 1234. Set PARENT_PIN in .env to change.
        </p>
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

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <TypingIndicator />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Parent Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Hunter exam prep progress overview
          </p>
        </div>
        <a
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Student View
        </a>
      </div>

      {/* Weekly Practice */}
      <WeeklyPracticeCard
        minutes={data.weeklyMinutes}
        target={data.weeklyTarget}
        activeDays={data.activeDaysThisWeek}
      />

      {/* Mastery Over Time */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Mastery Progress Over Time
        </h2>
        <MasteryChart data={data.masteryTimeline} />
      </section>

      {/* AI Assessment */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Readiness Assessment
        </h2>

        {loadingAi && !assessment ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <TypingIndicator />
          </div>
        ) : assessment ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
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
        <section className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Recommended Focus This Week
          </h2>
          <ol className="space-y-2">
            {focusAreas.map((area, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <span className="text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">
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
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Recent Sessions
        </h2>
        <SessionLog entries={data.sessionLog} />
      </section>

      {/* Privacy note */}
      <p className="text-xs text-gray-400 text-center pb-4">
        Individual questions and answers are not shown to preserve your
        child&apos;s sense of safety with the tutor.
      </p>
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          This Week&apos;s Practice
        </h2>
        <span className="text-xs text-gray-400">
          {activeDays} day{activeDays !== 1 ? "s" : ""} active
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-3xl font-bold ${onTrack ? "text-green-600" : "text-amber-600"}`}>
          {minutes}
        </span>
        <span className="text-sm text-gray-400">/ {target} min target</span>
      </div>

      <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 80
              ? "bg-green-500"
              : pct >= 40
                ? "bg-amber-500"
                : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-gray-500 mt-2">
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
    improving: "text-green-600 dark:text-green-400",
    stable: "text-gray-400",
    declining: "text-red-500 dark:text-red-400",
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate pr-2">
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
              ? "text-green-600"
              : domain.mastery >= 50
                ? "text-amber-600"
                : "text-red-500"
          }`}
        >
          {domain.mastery}%
        </span>
      </div>

      {domain.strongSkills.length > 0 && (
        <div className="text-xs">
          <span className="text-green-600 dark:text-green-400 font-medium">
            Strong:
          </span>{" "}
          <span className="text-gray-600 dark:text-gray-400">
            {domain.strongSkills.join(", ")}
          </span>
        </div>
      )}

      {domain.weakSkills.length > 0 && (
        <div className="text-xs">
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            Needs work:
          </span>{" "}
          <span className="text-gray-600 dark:text-gray-400">
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400 truncate">{sub}</div>}
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
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-center text-sm text-gray-400">
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
      {entries.map((entry, i) => (
        <div key={i} className="px-4 py-3 flex items-start gap-3">
          <span className="text-base flex-shrink-0 mt-0.5">
            {typeIcons[entry.type]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
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
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {entry.summary}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
