import { notFound } from "next/navigation";
import { TutoringSession } from "@/components/tutor/TutoringSession";
import { getSkillById, getSkillIdsForDomain } from "@/lib/exam/curriculum";
import { selectNextSkills } from "@/lib/adaptive";

const SUBJECT_TO_DOMAINS: Record<string, readonly string[]> = {
  reading: ["reading_comprehension"],
  math: ["math_quantitative_reasoning", "math_achievement"],
};

const VALID_SUBJECTS = ["math", "reading"] as const;

interface TutorPageProps {
  params: { subject: string };
  searchParams: { skill?: string };
}

function pickDefaultSkill(subject: string): string {
  const domains = SUBJECT_TO_DOMAINS[subject];
  if (!domains) return "";

  const emptyStates = new Map();
  for (const domainId of domains) {
    const skillIds = getSkillIdsForDomain(domainId);
    const priorities = selectNextSkills(skillIds, emptyStates);
    if (priorities.length > 0) {
      return priorities[0].skillId;
    }
  }
  return "";
}

export default function TutorPage({ params, searchParams }: TutorPageProps) {
  const { subject } = params;

  if (!VALID_SUBJECTS.includes(subject as (typeof VALID_SUBJECTS)[number])) {
    notFound();
  }

  const skillId = searchParams.skill ?? pickDefaultSkill(subject);
  const skill = getSkillById(skillId);

  if (!skill) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <TutoringSession skillId={skillId} subject={subject} />
    </main>
  );
}
