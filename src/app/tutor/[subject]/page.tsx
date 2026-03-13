import { notFound } from "next/navigation";
import { TutoringSession } from "@/components/tutor/TutoringSession";
import { DrillMode } from "@/components/tutor/DrillMode";
import { getSkillById, getSkillIdsForDomain, curriculum } from "@/lib/exam/curriculum";
import { selectNextSkills } from "@/lib/adaptive";
import { MathTopicPicker, type SerializedDomain } from "@/components/tutor/MathTopicPicker";

const SUBJECT_TO_DOMAINS: Record<string, readonly string[]> = {
  reading: ["reading_comprehension"],
  math: ["math_quantitative_reasoning", "math_achievement"],
};

const VALID_SUBJECTS = ["math", "reading"] as const;

interface TutorPageProps {
  params: { subject: string };
  searchParams: { skill?: string; retention?: string; firstSession?: string; mode?: string };
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

function getDomainsForSubject(subject: string): SerializedDomain[] {
  const domainIds = SUBJECT_TO_DOMAINS[subject];
  if (!domainIds) return [];

  const result: SerializedDomain[] = [];
  for (const domainId of domainIds) {
    const domain = curriculum.domains.find((d) => d.domain_id === domainId);
    if (!domain) continue;
    result.push({
      domainId: domain.domain_id,
      name: domain.name,
      categories: domain.skill_categories.map((cat) => ({
        categoryId: cat.category_id,
        name: cat.name,
        skills: cat.skills.map((s) => ({
          skillId: s.skill_id,
          name: s.name,
          description: s.description,
          level: (s.level ?? "foundations") as string,
          difficultyTier: s.difficulty_tier as number,
        })),
      })),
    });
  }
  return result;
}

export default function TutorPage({ params, searchParams }: TutorPageProps) {
  const { subject } = params;

  if (!VALID_SUBJECTS.includes(subject as (typeof VALID_SUBJECTS)[number])) {
    notFound();
  }

  // If no skill specified, show topic picker (math only — reading redirects to its dedicated page)
  if (!searchParams.skill && subject === "math") {
    const domains = getDomainsForSubject(subject);
    const recommended = pickDefaultSkill(subject);
    return (
      <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
        <MathTopicPicker domains={domains} recommendedSkillId={recommended} />
      </main>
    );
  }

  const skillId = searchParams.skill ?? pickDefaultSkill(subject);
  const skill = getSkillById(skillId);

  if (!skill) {
    notFound();
  }

  if (searchParams.mode === "drill") {
    return (
      <main className="flex flex-col min-h-screen bg-surface-50 dark:bg-surface-950">
        <DrillMode initialSkillId={skillId} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <TutoringSession skillId={skillId} subject={subject} isRetentionCheck={searchParams.retention === "1"} isFirstSession={searchParams.firstSession === "1"} />
    </main>
  );
}
