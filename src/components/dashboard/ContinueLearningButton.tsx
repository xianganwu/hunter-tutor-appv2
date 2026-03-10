"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { SerializedSkillState } from "./types";
import type { StudentSkillState } from "@/lib/adaptive";
import { selectNextSkills } from "@/lib/adaptive";
import { getSkillIdsForDomain, getSkillById } from "@/lib/exam/curriculum";

interface ContinueLearningButtonProps {
  readonly states: readonly SerializedSkillState[];
}

const DOMAINS = [
  "reading_comprehension",
  "math_quantitative_reasoning",
  "math_achievement",
] as const;

function deserializeStates(
  states: readonly SerializedSkillState[]
): Map<string, StudentSkillState> {
  return new Map(
    states.map((s) => [
      s.skillId,
      {
        ...s,
        lastPracticed: s.lastPracticed ? new Date(s.lastPracticed) : null,
      },
    ])
  );
}

function skillIdToRoute(skillId: string): string {
  if (skillId.startsWith("rc_")) return `/tutor/reading?skill=${skillId}`;
  return `/tutor/math?skill=${skillId}`;
}

function pickBestSkill(states: readonly SerializedSkillState[]): string | null {
  const stateMap = deserializeStates(states);
  let bestSkillId: string | null = null;
  let bestScore = -1;

  for (const domain of DOMAINS) {
    const skillIds = getSkillIdsForDomain(domain);
    const priorities = selectNextSkills(skillIds, stateMap);
    if (priorities.length > 0 && priorities[0].score > bestScore) {
      bestScore = priorities[0].score;
      bestSkillId = priorities[0].skillId;
    }
  }

  return bestSkillId;
}

export function ContinueLearningButton({
  states,
}: ContinueLearningButtonProps) {
  const router = useRouter();

  const recommended = useMemo(() => {
    const skillId = pickBestSkill(states);
    if (!skillId) return null;
    const skill = getSkillById(skillId);
    return { skillId, skillName: skill?.name ?? skillId };
  }, [states]);

  if (!recommended) return null;

  return (
    <button
      onClick={() => router.push(skillIdToRoute(recommended.skillId))}
      className="group flex flex-col items-start gap-1 rounded-2xl bg-brand-600 px-6 py-4 shadow-glow hover:bg-brand-700 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:scale-[0.98]"
    >
      <div className="flex items-center gap-2 text-white/80 text-xs font-medium uppercase tracking-wide">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
        </svg>
        Today&apos;s Practice
      </div>
      <div className="flex items-center gap-2 text-white font-semibold text-base">
        {recommended.skillName}
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="group-hover:translate-x-0.5 transition-transform">
          <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}
