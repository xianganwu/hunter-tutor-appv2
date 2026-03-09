import Link from "next/link";
import type { DomainProgress } from "./types";

interface DomainCardProps {
  readonly progress: DomainProgress;
}

function domainToRoute(domainId: string): string {
  if (domainId === "reading_comprehension") return "/tutor/reading";
  return "/tutor/math";
}

function domainIcon(domainId: string): string {
  if (domainId === "reading_comprehension") return "\u{1F4D6}";
  if (domainId === "math_quantitative_reasoning") return "\u{1F9E9}";
  return "\u{1F4D0}";
}

interface ProgressRingProps {
  readonly value: number; // 0.0 - 1.0
  readonly size?: number;
  readonly strokeWidth?: number;
}

function ProgressRing({ value, size = 80, strokeWidth = 7 }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - value * circumference;
  const percent = Math.round(value * 100);

  const fillColor =
    value > 0.7
      ? "stroke-success-500"
      : value >= 0.4
        ? "stroke-streak-500"
        : "stroke-red-500";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-200 dark:stroke-surface-700"
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={`${fillColor} transition-all duration-700`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% mastery`}
        />
      </svg>
      <span className="absolute text-lg font-bold text-surface-800 dark:text-surface-100">
        {percent}%
      </span>
    </div>
  );
}

export function DomainCard({ progress }: DomainCardProps) {
  return (
    <div className="rounded-2xl shadow-card p-5 flex flex-col gap-4 bg-surface-0 dark:bg-surface-900 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          {domainIcon(progress.domainId)}
        </span>
        <h3 className="text-lg font-semibold text-surface-800 dark:text-surface-100">
          {progress.domainName}
        </h3>
      </div>

      <div className="flex items-center gap-5">
        <ProgressRing value={progress.overallMastery} />
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success-500" aria-hidden="true" />
            <span className="text-surface-600 dark:text-surface-400">
              {progress.masteredCount} mastered
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-streak-500" aria-hidden="true" />
            <span className="text-surface-600 dark:text-surface-400">
              {progress.inProgressCount} in progress
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
            <span className="text-surface-600 dark:text-surface-400">
              {progress.needsWorkCount} needs work
            </span>
          </div>
        </div>
      </div>

      <Link
        href={domainToRoute(progress.domainId)}
        className="mt-auto inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 shadow-soft hover:shadow-glow"
      >
        Practice Now
      </Link>
    </div>
  );
}
