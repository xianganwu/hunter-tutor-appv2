"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { SerializedSkillState } from "./types";
import { getMasteryFill } from "./skill-map-layout";
import { curriculum } from "@/lib/exam/curriculum";

interface SkillMapProps {
  readonly states: readonly SerializedSkillState[];
}

const DOMAIN_IDS = [
  "reading_comprehension",
  "math_quantitative_reasoning",
  "math_achievement",
] as const;

const DOMAIN_META: Record<string, { label: string; accent: string; bg: string; border: string }> = {
  reading_comprehension: {
    label: "Reading",
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
  },
  math_quantitative_reasoning: {
    label: "Math Reasoning",
    accent: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
  },
  math_achievement: {
    label: "Math Skills",
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

interface SkillRow {
  readonly skillId: string;
  readonly name: string;
  readonly mastery: number;
  readonly attemptsCount: number;
  readonly confidenceTrend: string;
  readonly tier: number;
}

interface CategoryGroup {
  readonly categoryName: string;
  readonly skills: readonly SkillRow[];
}

interface DomainData {
  readonly domainId: string;
  readonly categories: readonly CategoryGroup[];
  readonly overallMastery: number;
  readonly totalSkills: number;
  readonly masteredCount: number;
}

export function SkillMap({ states }: SkillMapProps) {
  const router = useRouter();
  const [expandedDomain, setExpandedDomain] = useState<string | null>(
    DOMAIN_IDS[0]
  );

  const stateMap = useMemo(
    () => new Map(states.map((s) => [s.skillId, s])),
    [states]
  );

  const domains: DomainData[] = useMemo(() => {
    return DOMAIN_IDS.map((domainId) => {
      const domain = curriculum.domains.find((d) => d.domain_id === domainId);
      if (!domain) return { domainId, categories: [], overallMastery: 0, totalSkills: 0, masteredCount: 0 };

      let totalMastery = 0;
      let totalSkills = 0;
      let masteredCount = 0;

      const categories: CategoryGroup[] = domain.skill_categories.map((cat) => {
        const skills: SkillRow[] = cat.skills.map((s) => {
          const state = stateMap.get(s.skill_id);
          const mastery = state?.masteryLevel ?? 0;
          totalMastery += mastery;
          totalSkills++;
          if (mastery > 0.7) masteredCount++;

          return {
            skillId: s.skill_id,
            name: s.name,
            mastery,
            attemptsCount: state?.attemptsCount ?? 0,
            confidenceTrend: state?.confidenceTrend ?? "stable",
            tier: s.difficulty_tier,
          };
        });

        return { categoryName: cat.name, skills };
      });

      return {
        domainId,
        categories,
        overallMastery: totalSkills > 0 ? totalMastery / totalSkills : 0,
        totalSkills,
        masteredCount,
      };
    });
  }, [stateMap]);

  function handleSkillClick(skillId: string) {
    const route = skillId.startsWith("rc_")
      ? `/tutor/reading?skill=${skillId}`
      : `/tutor/math?skill=${skillId}`;
    router.push(route);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
          Skill Map
        </h3>
        <div className="flex items-center gap-3 text-xs text-surface-500 dark:text-surface-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Mastered
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
            In Progress
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Needs Work
          </span>
        </div>
      </div>

      {domains.map((domain) => {
        const meta = DOMAIN_META[domain.domainId];
        const isExpanded = expandedDomain === domain.domainId;
        const overallPct = Math.round(domain.overallMastery * 100);

        return (
          <div
            key={domain.domainId}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 overflow-hidden shadow-card"
          >
            {/* Domain header — always visible, clickable */}
            <button
              onClick={() =>
                setExpandedDomain(isExpanded ? null : domain.domainId)
              }
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${meta.bg}`}
                >
                  <span className={`text-sm font-bold ${meta.accent}`}>
                    {overallPct}%
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                    {meta.label}
                  </div>
                  <div className="text-xs text-surface-500 dark:text-surface-400">
                    {domain.masteredCount}/{domain.totalSkills} mastered
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Mini mastery bar */}
                <div className="hidden sm:block w-24 h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${overallPct}%`,
                      backgroundColor: getMasteryFill(domain.overallMastery),
                    }}
                  />
                </div>
                <svg
                  className={`h-4 w-4 text-surface-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </button>

            {/* Expanded skill list */}
            {isExpanded && (
              <div className="border-t border-surface-100 dark:border-surface-800 px-4 py-3 space-y-4 animate-fade-in">
                {domain.categories.map((cat) => (
                  <div key={cat.categoryName}>
                    <div className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide mb-2">
                      {cat.categoryName}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {cat.skills.map((skill) => (
                        <SkillTile
                          key={skill.skillId}
                          skill={skill}
                          onClick={() => handleSkillClick(skill.skillId)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Skill Tile ──────────────────────────────────────────────────────

function SkillTile({
  skill,
  onClick,
}: {
  readonly skill: SkillRow;
  readonly onClick: () => void;
}) {
  const pct = Math.round(skill.mastery * 100);
  const notStarted = skill.attemptsCount === 0;
  const fill = notStarted ? "#9CA3AF" : getMasteryFill(skill.mastery);

  const trendIcon =
    skill.confidenceTrend === "improving"
      ? "\u2191"
      : skill.confidenceTrend === "declining"
        ? "\u2193"
        : null;

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50"
      aria-label={`${skill.name} — ${notStarted ? "Not started" : `${pct}% mastery`}. Click to practice.`}
    >
      {/* Mastery dot */}
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: fill, opacity: notStarted ? 0.4 : 1 }}
      />

      {/* Name */}
      <span className="flex-1 min-w-0 text-xs text-surface-700 dark:text-surface-300 truncate group-hover:text-surface-900 dark:group-hover:text-surface-100 transition-colors">
        {skill.name}
      </span>

      {/* Trend arrow */}
      {trendIcon && !notStarted && (
        <span
          className={`text-xs flex-shrink-0 ${
            skill.confidenceTrend === "improving"
              ? "text-success-500"
              : "text-red-400"
          }`}
        >
          {trendIcon}
        </span>
      )}

      {/* Percentage or "New" badge */}
      {notStarted ? (
        <span className="flex-shrink-0 rounded bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 text-[10px] font-medium text-surface-400 dark:text-surface-500">
          New
        </span>
      ) : (
        <span
          className="flex-shrink-0 text-xs font-medium tabular-nums"
          style={{ color: fill }}
        >
          {pct}%
        </span>
      )}
    </button>
  );
}
