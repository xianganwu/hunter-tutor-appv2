import type { CurriculumTaxonomy, Skill, SkillLevel } from "@/lib/types";
import taxonomyData from "../../../content/curriculum-taxonomy.json";

export const curriculum = taxonomyData as unknown as CurriculumTaxonomy;

/** Flat map of all skills keyed by skill_id */
export function getAllSkills(): Map<string, Skill> {
  const skills = new Map<string, Skill>();
  for (const domain of curriculum.domains) {
    for (const category of domain.skill_categories) {
      for (const skill of category.skills) {
        // Default to "foundations" for any skill missing the level field
        const enrichedSkill = skill.level ? skill : { ...skill, level: "foundations" as SkillLevel };
        skills.set(skill.skill_id, enrichedSkill);
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

/** Get skill IDs for a domain, filtered by level */
export function getSkillIdsForDomainByLevel(
  domainId: string,
  level: SkillLevel
): string[] {
  const domain = curriculum.domains.find((d) => d.domain_id === domainId);
  if (!domain) return [];
  return domain.skill_categories.flatMap((cat) =>
    cat.skills
      .filter((s) => (s as Skill).level === level || (!('level' in s) && level === "foundations"))
      .map((s) => s.skill_id)
  );
}

/** Get all skills filtered by level */
export function getSkillsByLevel(level: SkillLevel): Map<string, Skill> {
  const allSkills = getAllSkills();
  const filtered = new Map<string, Skill>();
  for (const [id, skill] of Array.from(allSkills.entries())) {
    if (skill.level === level) {
      filtered.set(id, skill);
    }
  }
  return filtered;
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
