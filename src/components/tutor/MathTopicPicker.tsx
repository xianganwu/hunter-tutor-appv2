"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loadAllSkillMasteries, type StoredSkillMastery } from "@/lib/skill-mastery-store";

interface MathTopicPickerProps {
  readonly domains: readonly SerializedDomain[];
  readonly recommendedSkillId: string;
}

// Serializable domain structure passed from server component
export interface SerializedDomain {
  readonly domainId: string;
  readonly name: string;
  readonly categories: readonly {
    readonly categoryId: string;
    readonly name: string;
    readonly skills: readonly {
      readonly skillId: string;
      readonly name: string;
      readonly description: string;
      readonly level: string;
      readonly difficultyTier: number;
    }[];
  }[];
}

function masteryPercent(mastery: StoredSkillMastery | undefined): number {
  if (!mastery) return 0;
  return Math.round(mastery.masteryLevel * 100);
}

function masteryColor(pct: number): string {
  if (pct === 0) return "bg-surface-200 dark:bg-surface-700";
  if (pct < 40) return "bg-red-400 dark:bg-red-500";
  if (pct < 70) return "bg-amber-400 dark:bg-amber-500";
  return "bg-emerald-400 dark:bg-emerald-500";
}

function tierLabel(tier: number): string {
  if (tier <= 2) return "Foundations";
  if (tier <= 3) return "Intermediate";
  return "Advanced";
}

export function MathTopicPicker({ domains, recommendedSkillId }: MathTopicPickerProps) {
  const [masteries, setMasteries] = useState<Map<string, StoredSkillMastery>>(new Map());

  useEffect(() => {
    const all = loadAllSkillMasteries();
    const map = new Map<string, StoredSkillMastery>();
    for (const m of all) {
      map.set(m.skillId, m);
    }
    setMasteries(map);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Math Practice
        </h1>
        <p className="text-surface-500 dark:text-surface-400">
          Choose a topic to practice, or start with our recommendation.
        </p>
      </div>

      {/* Recommended skill CTA */}
      {recommendedSkillId && (
        <Link
          href={`/tutor/math?skill=${recommendedSkillId}`}
          className="mb-8 flex items-center gap-4 rounded-2xl border-2 border-brand-200 bg-brand-50 px-5 py-4 transition-all hover:border-brand-400 hover:shadow-card dark:border-brand-600/30 dark:bg-brand-600/10 dark:hover:border-brand-500/50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-lg dark:bg-brand-600/20">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 3l2.5 5 5.5.8-4 3.9 1 5.3L10 15.3 4.9 18l1-5.3-4-3.9 5.5-.8L10 3z" fill="currentColor" className="text-brand-500 dark:text-brand-400" />
            </svg>
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
              Recommended for you
            </p>
            <p className="text-xs text-brand-600/80 dark:text-brand-400/80">
              Start practicing where it matters most
            </p>
          </div>
          <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
            Start &rarr;
          </span>
        </Link>
      )}

      {/* Domain sections */}
      {domains.map((domain) => (
        <div key={domain.domainId} className="mb-8">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200 mb-4">
            {domain.name}
          </h2>

          {domain.categories.map((category) => (
            <div key={category.categoryId} className="mb-6">
              <h3 className="text-sm font-medium text-surface-500 dark:text-surface-400 mb-3 uppercase tracking-wide">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.skills.map((skill) => {
                  const mastery = masteries.get(skill.skillId);
                  const pct = masteryPercent(mastery);
                  const isRecommended = skill.skillId === recommendedSkillId;

                  return (
                    <Link
                      key={skill.skillId}
                      href={`/tutor/math?skill=${skill.skillId}`}
                      className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-all hover:shadow-soft ${
                        isRecommended
                          ? "border-brand-300 bg-brand-50/50 dark:border-brand-600/40 dark:bg-brand-600/5"
                          : "border-surface-200 bg-surface-0 dark:border-surface-700 dark:bg-surface-900"
                      } hover:border-brand-300 dark:hover:border-brand-500/40`}
                    >
                      {/* Mastery bar */}
                      <div className="flex flex-col items-center gap-1 w-10">
                        <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                          <span className="text-xs font-bold text-surface-600 dark:text-surface-300">
                            {pct > 0 ? `${pct}%` : "--"}
                          </span>
                        </div>
                      </div>

                      {/* Skill info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                          {skill.name}
                        </p>
                        <p className="text-xs text-surface-400 dark:text-surface-500">
                          {skill.level === "hunter_prep" ? "Hunter Prep" : "Foundations"} &middot; {tierLabel(skill.difficultyTier)}
                        </p>
                      </div>

                      {/* Mastery progress bar */}
                      <div className="w-20 h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${masteryColor(pct)}`}
                          style={{ width: `${Math.max(pct, 0)}%` }}
                        />
                      </div>

                      {/* Arrow */}
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-surface-400 dark:text-surface-500 shrink-0" aria-hidden="true">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
