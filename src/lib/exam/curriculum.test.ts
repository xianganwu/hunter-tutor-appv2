import { describe, it, expect } from "vitest";
import {
  curriculum,
  getAllSkills,
  getSkillById,
  getSkillIdsForDomain,
  validatePrerequisites,
} from "./curriculum";

describe("curriculum taxonomy", () => {
  it("has three domains", () => {
    expect(curriculum.domains).toHaveLength(3);
    const domainIds = curriculum.domains.map((d) => d.domain_id);
    expect(domainIds).toContain("reading_comprehension");
    expect(domainIds).toContain("math_quantitative_reasoning");
    expect(domainIds).toContain("math_achievement");
  });

  it("has 45 total skills (foundations + hunter_prep)", () => {
    const skills = getAllSkills();
    expect(skills.size).toBe(45);
  });

  it("has 14 reading comprehension skills", () => {
    const ids = getSkillIdsForDomain("reading_comprehension");
    expect(ids).toHaveLength(14);
  });

  it("has 9 quantitative reasoning skills", () => {
    const ids = getSkillIdsForDomain("math_quantitative_reasoning");
    expect(ids).toHaveLength(9);
  });

  it("has 22 math achievement skills", () => {
    const ids = getSkillIdsForDomain("math_achievement");
    expect(ids).toHaveLength(22);
  });

  it("all skill IDs are unique", () => {
    const skills = getAllSkills();
    const ids = Array.from(skills.keys());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all prerequisite references are valid", () => {
    const result = validatePrerequisites();
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("every skill has at least one teaching prompt", () => {
    const skills = getAllSkills();
    for (const [id, skill] of Array.from(skills.entries())) {
      expect(
        skill.example_teaching_prompts.length,
        `Skill "${id}" has no teaching prompts`
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("difficulty tiers are between 1 and 5", () => {
    const skills = getAllSkills();
    for (const [id, skill] of Array.from(skills.entries())) {
      expect(
        skill.difficulty_tier,
        `Skill "${id}" has invalid difficulty tier ${skill.difficulty_tier}`
      ).toBeGreaterThanOrEqual(1);
      expect(skill.difficulty_tier).toBeLessThanOrEqual(5);
    }
  });

  it("prerequisite DAG has no cycles", () => {
    const skills = getAllSkills();
    const visited = new Set<string>();
    const inStack = new Set<string>();

    function hasCycle(skillId: string): boolean {
      if (inStack.has(skillId)) return true;
      if (visited.has(skillId)) return false;
      visited.add(skillId);
      inStack.add(skillId);
      const skill = skills.get(skillId);
      if (skill) {
        for (const prereq of skill.prerequisite_skills) {
          if (hasCycle(prereq)) return true;
        }
      }
      inStack.delete(skillId);
      return false;
    }

    for (const id of Array.from(skills.keys())) {
      expect(hasCycle(id), `Cycle detected involving skill "${id}"`).toBe(
        false
      );
    }
  });

  it("getSkillById returns correct skill", () => {
    const skill = getSkillById("rc_main_idea");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("Main Idea Identification");
  });

  it("getSkillById returns undefined for unknown ID", () => {
    expect(getSkillById("nonexistent")).toBeUndefined();
  });
});
