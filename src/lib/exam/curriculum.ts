import type { CurriculumTaxonomy, Skill } from "@/lib/types";
import taxonomyData from "../../../content/curriculum-taxonomy.json";

export const curriculum = taxonomyData as unknown as CurriculumTaxonomy;

/** Flat map of all skills keyed by skill_id */
export function getAllSkills(): Map<string, Skill> {
  const skills = new Map<string, Skill>();
  for (const domain of curriculum.domains) {
    for (const category of domain.skill_categories) {
      for (const skill of category.skills) {
        skills.set(skill.skill_id, skill);
      }
    }
  }
  return skills;
}

/** Get a single skill by ID, or undefined if not found */
export function getSkillById(skillId: string): Skill | undefined {
  return getAllSkills().get(skillId);
}

/** Get all skill IDs for a given domain */
export function getSkillIdsForDomain(domainId: string): string[] {
  const domain = curriculum.domains.find((d) => d.domain_id === domainId);
  if (!domain) return [];
  return domain.skill_categories.flatMap((cat) =>
    cat.skills.map((s) => s.skill_id)
  );
}

/** Validate that all prerequisite references point to real skill IDs */
export function validatePrerequisites(): { valid: boolean; errors: string[] } {
  const allSkills = getAllSkills();
  const errors: string[] = [];

  for (const [skillId, skill] of Array.from(allSkills.entries())) {
    for (const prereqId of skill.prerequisite_skills) {
      if (!allSkills.has(prereqId)) {
        errors.push(
          `Skill "${skillId}" references unknown prerequisite "${prereqId}"`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
