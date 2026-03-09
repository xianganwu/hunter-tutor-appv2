import Link from "next/link";
import type { DomainProgress } from "./types";
import { ProgressBar } from "./ProgressBar";

interface DomainCardProps {
  readonly progress: DomainProgress;
}

function domainToRoute(domainId: string): string {
  if (domainId === "reading_comprehension") return "/tutor/reading";
  return "/tutor/math";
}

function domainIcon(domainId: string): string {
  if (domainId === "reading_comprehension") return "📖";
  if (domainId === "math_quantitative_reasoning") return "🧩";
  return "📐";
}

export function DomainCard({ progress }: DomainCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-4 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          {domainIcon(progress.domainId)}
        </span>
        <h3 className="text-lg font-semibold">{progress.domainName}</h3>
      </div>

      <ProgressBar value={progress.overallMastery} label="Overall Mastery" />

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" aria-hidden="true" />
          <span>{progress.masteredCount} mastered</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" aria-hidden="true" />
          <span>{progress.inProgressCount} in progress</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
          <span>{progress.needsWorkCount} needs work</span>
        </div>
      </div>

      <Link
        href={domainToRoute(progress.domainId)}
        className="mt-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Practice Now
      </Link>
    </div>
  );
}
