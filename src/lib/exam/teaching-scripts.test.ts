import { describe, it, expect } from "vitest";
import {
  getAllTeachingScripts,
  getTeachingScript,
  getTeachingScriptIds,
} from "./teaching-scripts";
import { getAllSkills } from "./curriculum";
import type { TeachingScript } from "@/lib/types";

describe("teaching scripts", () => {
  const scripts = getAllTeachingScripts();
  const scriptEntries = Array.from(scripts.entries());

  it("every teaching script maps to a valid skill in the taxonomy", () => {
    const taxonomySkillIds = new Set(getAllSkills().keys());
    const scriptSkillIds = getTeachingScriptIds();
    for (const scriptId of scriptSkillIds) {
      expect(
        taxonomySkillIds.has(scriptId),
        `Teaching script "${scriptId}" references a skill not in the taxonomy`
      ).toBe(true);
    }
  });

  it("has at least 25 teaching scripts", () => {
    expect(scripts.size).toBeGreaterThanOrEqual(25);
  });

  it("getTeachingScript returns correct script", () => {
    const script = getTeachingScript("rc_main_idea");
    expect(script).toBeDefined();
    expect(script!.skill_id).toBe("rc_main_idea");
  });

  it("getTeachingScript returns undefined for unknown ID", () => {
    expect(getTeachingScript("nonexistent")).toBeUndefined();
  });

  describe("structural validation for every script", () => {
    it.each(scriptEntries)(
      "%s has required top-level fields",
      (_id: string, script: TeachingScript) => {
        expect(typeof script.skill_id).toBe("string");
        expect(typeof script.skill_name).toBe("string");
        expect(typeof script.concept_explanation).toBe("string");
        expect(script.concept_explanation.length).toBeGreaterThan(50);
        expect(typeof script.real_world_connection).toBe("string");
        expect(script.real_world_connection.length).toBeGreaterThan(20);
      }
    );

    it.each(scriptEntries)(
      "%s has exactly 3 worked examples",
      (_id: string, script: TeachingScript) => {
        expect(script.worked_examples).toHaveLength(3);
        for (const ex of script.worked_examples) {
          expect(typeof ex.problem).toBe("string");
          expect(ex.problem.length).toBeGreaterThan(10);
          expect(ex.thinking_out_loud.length).toBeGreaterThanOrEqual(3);
          expect(ex.thinking_out_loud.length).toBeLessThanOrEqual(6);
          for (const step of ex.thinking_out_loud) {
            expect(typeof step).toBe("string");
            expect(step.length).toBeGreaterThan(0);
          }
          expect(typeof ex.solution).toBe("string");
          expect(ex.solution.length).toBeGreaterThan(0);
        }
      }
    );

    it.each(scriptEntries)(
      "%s has 2-3 common misconceptions",
      (_id: string, script: TeachingScript) => {
        expect(script.common_misconceptions.length).toBeGreaterThanOrEqual(2);
        expect(script.common_misconceptions.length).toBeLessThanOrEqual(3);
        for (const m of script.common_misconceptions) {
          expect(typeof m.misconception).toBe("string");
          expect(typeof m.why_it_happens).toBe("string");
          expect(typeof m.how_to_address).toBe("string");
        }
      }
    );

    it.each(scriptEntries)(
      "%s has exactly 5 scaffolded practice questions in correct order",
      (_id: string, script: TeachingScript) => {
        expect(script.scaffolded_practice).toHaveLength(5);

        // Q1-Q2: guided with 2-3 hints
        for (let i = 0; i < 2; i++) {
          const q = script.scaffolded_practice[i];
          expect(q.question_number).toBe(i + 1);
          expect(q.type).toBe("guided");
          expect(q.hints.length).toBeGreaterThanOrEqual(2);
          expect(q.hints.length).toBeLessThanOrEqual(3);
        }

        // Q3: supported with 1 hint
        const q3 = script.scaffolded_practice[2];
        expect(q3.question_number).toBe(3);
        expect(q3.type).toBe("supported");
        expect(q3.hints).toHaveLength(1);

        // Q4-Q5: independent with 0 hints
        for (let i = 3; i < 5; i++) {
          const q = script.scaffolded_practice[i];
          expect(q.question_number).toBe(i + 1);
          expect(q.type).toBe("independent");
          expect(q.hints).toHaveLength(0);
        }

        // All questions have answer and explanation
        for (const q of script.scaffolded_practice) {
          expect(typeof q.question).toBe("string");
          expect(q.question.length).toBeGreaterThan(10);
          expect(typeof q.answer).toBe("string");
          expect(q.answer.length).toBeGreaterThan(0);
          expect(typeof q.explanation).toBe("string");
          expect(q.explanation.length).toBeGreaterThan(0);
        }
      }
    );

    it.each(scriptEntries)(
      "%s has 3-4 transition cues",
      (_id: string, script: TeachingScript) => {
        expect(script.transition_cues.length).toBeGreaterThanOrEqual(3);
        expect(script.transition_cues.length).toBeLessThanOrEqual(4);
        for (const cue of script.transition_cues) {
          expect(typeof cue).toBe("string");
          expect(cue.length).toBeGreaterThan(10);
        }
      }
    );
  });
});
