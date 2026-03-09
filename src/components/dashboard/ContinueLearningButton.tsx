"use client";

import { useRouter } from "next/navigation";
import type { SerializedSkillState } from "./types";
import type { StudentSkillState } from "@/lib/adaptive";
import { selectNextSkills } from "@/lib/adaptive";
import { getSkillIdsForDomain } from "@/lib/exam/curriculum";

interface ContinueLearningButtonProps {
  readonly states: readonly SerializedSkillState[];
}

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

export function ContinueLearningButton({
  states,
}: ContinueLearningButtonProps) {
  const router = useRouter();

  function handleClick() {
    const stateMap = deserializeStates(states);
    const domains = [
      "reading_comprehension",
      "math_quantitative_reasoning",
      "math_achievement",
    ] as const;

    let bestSkillId = "";
    let bestScore = -1;

    for (const domain of domains) {
      const skillIds = getSkillIdsForDomain(domain);
      const priorities = selectNextSkills(skillIds, stateMap);
      if (priorities.length > 0 && priorities[0].score > bestScore) {
        bestScore = priorities[0].score;
        bestSkillId = priorities[0].skillId;
      }
    }

    if (bestSkillId) {
      router.push(skillIdToRoute(bestSkillId));
    }
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      Continue Learning
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M7 4l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
