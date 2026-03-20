"use client";

import { useState, useCallback } from "react";
import type { WeeklyDigest } from "@/lib/weekly-digest";
import { formatDigestAsText } from "@/lib/weekly-digest";

interface WeeklyReportProps {
  readonly digest: WeeklyDigest;
  readonly onClose: () => void;
}

export function WeeklyReport({ digest, onClose }: WeeklyReportProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      const text = formatDigestAsText(digest);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [digest]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">
            Weekly Report
          </h2>
          <p className="text-xs text-surface-400 mt-0.5">
            {digest.weekStart} — {digest.weekEnd}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleCopy()}
            className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            Back
          </button>
        </div>
      </div>

      {/* AI Narrative */}
      {digest.aiNarrative && (
        <div className="rounded-2xl bg-brand-50 dark:bg-brand-600/10 p-5 shadow-card">
          <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
            {digest.aiNarrative}
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Practice Days" value={String(digest.practiceDays)} />
        <StatCard label="Total Minutes" value={String(digest.totalMinutes)} />
        <StatCard
          label="Current Streak"
          value={`${digest.streakStatus.current}`}
          sub={`Longest: ${digest.streakStatus.longest}`}
        />
        <StatCard
          label="Questions"
          value={String(digest.drillsCompleted)}
          sub="Drills completed"
        />
      </div>

      {/* Skills Improved */}
      {digest.skillsImproved.length > 0 && (
        <Section title="Skills Improved">
          <div className="space-y-2">
            {digest.skillsImproved.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-surface-50 dark:bg-surface-800 px-3 py-2"
              >
                <span className="text-sm text-surface-700 dark:text-surface-300 truncate">
                  {s.name}
                </span>
                <span className="text-sm font-medium text-success-600 dark:text-success-400 flex-shrink-0 ml-2">
                  {s.before}% → {s.after}%
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Areas Needing Attention */}
      {digest.areasNeedingAttention.length > 0 && (
        <Section title="Areas Needing Attention">
          <div className="space-y-2">
            {digest.areasNeedingAttention.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-surface-50 dark:bg-surface-800 px-3 py-2"
              >
                <span className="text-sm text-surface-700 dark:text-surface-300 truncate">
                  {a.name}
                </span>
                <span className="text-sm font-medium text-streak-600 dark:text-streak-400 flex-shrink-0 ml-2">
                  {a.mastery}% mastery
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Essays & Writing */}
      {(digest.essaysWritten > 0 || digest.drillsCompleted > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Essays Written" value={String(digest.essaysWritten)} />
          <StatCard label="Drills" value={String(digest.drillsCompleted)} />
        </div>
      )}

      {/* Badges Earned */}
      {digest.badgesEarned.length > 0 && (
        <Section title="Badges Earned This Week">
          <div className="flex flex-wrap gap-2">
            {digest.badgesEarned.map((b, i) => (
              <span
                key={i}
                className="rounded-xl bg-brand-100 dark:bg-brand-600/20 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-400"
              >
                {b}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
        {title}
      </h3>
      {children}
    </section>
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
      <div className="text-lg font-bold text-surface-900 dark:text-surface-100">
        {value}
      </div>
      {sub && <div className="text-xs text-surface-400">{sub}</div>}
    </div>
  );
}
