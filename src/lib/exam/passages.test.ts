import { describe, it, expect } from "vitest";
import {
  getAllPassages,
  getPassageById,
  getPassageIds,
  getPassagesByGenre,
  getPassagesByDifficulty,
  getPassagesBySkill,
  queryPassages,
} from "./passages";
import { getSkillIdsForDomain } from "./curriculum";
import type { Passage, PassageGenre } from "@/lib/types";

const VALID_GENRES: PassageGenre[] = [
  "fiction",
  "nonfiction",
  "poetry",
  "historical_document",
  "science_article",
];
const VALID_LETTERS = ["A", "B", "C", "D", "E"] as const;
const RC_SKILL_IDS = getSkillIdsForDomain("reading_comprehension");

const passages = getAllPassages();
const passageEntries = Array.from(passages.entries());

// ─── Collection-Level Tests ──────────────────────────────────────────

describe("passage collection", () => {
  it("has exactly 25 passages", () => {
    expect(passages.size).toBe(25);
  });

  it("has exactly 5 passages per genre", () => {
    for (const genre of VALID_GENRES) {
      const genrePassages = getPassagesByGenre(genre);
      expect(genrePassages).toHaveLength(5);
      for (const p of genrePassages) {
        expect(p.metadata.genre).toBe(genre);
      }
    }
  });

  it("each genre has one passage per difficulty level (1-5)", () => {
    for (const genre of VALID_GENRES) {
      const levels = getPassagesByGenre(genre).map(
        (p) => p.metadata.difficulty_level
      );
      expect(levels.sort()).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("every reading comprehension skill appears in at least 5 passages", () => {
    for (const skillId of RC_SKILL_IDS) {
      const count = getPassagesBySkill(skillId).length;
      expect(
        count,
        `Skill "${skillId}" only appears in ${count} passages (need at least 5)`
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it("all passage IDs are unique", () => {
    const ids = getPassageIds();
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Structural Validation Per Passage ────────────────────────────────

describe("passage structural validation", () => {
  it.each(passageEntries)(
    "%s has valid metadata",
    (_id: string, passage: Passage) => {
      const m = passage.metadata;
      expect(typeof m.passage_id).toBe("string");
      expect(m.passage_id.length).toBeGreaterThan(0);
      expect(typeof m.title).toBe("string");
      expect(m.title.length).toBeGreaterThan(0);
      expect(VALID_GENRES).toContain(m.genre);
      expect([1, 2, 3, 4, 5]).toContain(m.difficulty_level);
      expect(m.word_count).toBeGreaterThan(0);
      expect(typeof m.source_description).toBe("string");
    }
  );

  it.each(passageEntries)(
    "%s has passage_id matching naming convention",
    (_id: string, passage: Passage) => {
      const m = passage.metadata;
      const pattern = new RegExp(`^${m.genre}_\\d{2}$`);
      expect(m.passage_id).toMatch(pattern);
    }
  );

  it.each(passageEntries)(
    "%s has non-empty pre_reading_context and passage_text",
    (_id: string, passage: Passage) => {
      expect(passage.pre_reading_context.length).toBeGreaterThan(20);
      expect(passage.passage_text.length).toBeGreaterThan(100);
    }
  );

  it.each(passageEntries)(
    "%s word_count roughly matches actual passage length",
    (_id: string, passage: Passage) => {
      const actualWords = passage.passage_text
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
      const declared = passage.metadata.word_count;
      const tolerance = declared * 0.15; // 15% tolerance
      expect(actualWords).toBeGreaterThanOrEqual(declared - tolerance);
      expect(actualWords).toBeLessThanOrEqual(declared + tolerance);
    }
  );

  it.each(passageEntries)(
    "%s tagged_skills are all valid rc_ skill IDs",
    (_id: string, passage: Passage) => {
      expect(passage.metadata.tagged_skills.length).toBeGreaterThanOrEqual(4);
      for (const skill of passage.metadata.tagged_skills) {
        expect(
          RC_SKILL_IDS,
          `Unknown skill "${skill}" in passage "${passage.metadata.passage_id}"`
        ).toContain(skill);
      }
    }
  );

  it.each(passageEntries)(
    "%s tagged_skills matches unique skill_tested values in questions",
    (_id: string, passage: Passage) => {
      const skillsFromQuestions = Array.from(
        new Set(passage.questions.map((q) => q.skill_tested))
      ).sort();
      const taggedSkills = [...passage.metadata.tagged_skills].sort();
      expect(taggedSkills).toEqual(skillsFromQuestions);
    }
  );
});

// ─── Question Validation Per Passage ──────────────────────────────────

describe("passage question validation", () => {
  it.each(passageEntries)(
    "%s has 8-10 questions",
    (_id: string, passage: Passage) => {
      expect(passage.questions.length).toBeGreaterThanOrEqual(8);
      expect(passage.questions.length).toBeLessThanOrEqual(10);
    }
  );

  it.each(passageEntries)(
    "%s has sequential question numbers starting from 1",
    (_id: string, passage: Passage) => {
      const nums = passage.questions.map((q) => q.question_number);
      const expected = Array.from(
        { length: passage.questions.length },
        (_, i) => i + 1
      );
      expect(nums).toEqual(expected);
    }
  );

  it.each(passageEntries)(
    "%s every question has exactly 5 answer choices (A-E)",
    (_id: string, passage: Passage) => {
      for (const q of passage.questions) {
        expect(q.answer_choices).toHaveLength(5);
        const letters = q.answer_choices.map((c) => c.letter);
        expect(letters).toEqual(["A", "B", "C", "D", "E"]);
        for (const c of q.answer_choices) {
          expect(typeof c.text).toBe("string");
          expect(c.text.length).toBeGreaterThan(0);
        }
      }
    }
  );

  it.each(passageEntries)(
    "%s every correct_answer is a valid letter matching a choice",
    (_id: string, passage: Passage) => {
      for (const q of passage.questions) {
        expect(VALID_LETTERS).toContain(q.correct_answer);
        const choiceLetters = q.answer_choices.map((c) => c.letter);
        expect(choiceLetters).toContain(q.correct_answer);
      }
    }
  );

  it.each(passageEntries)(
    "%s every question has exactly 4 distractor explanations for wrong answers",
    (_id: string, passage: Passage) => {
      for (const q of passage.questions) {
        expect(q.distractor_explanations).toHaveLength(4);
        const distractorLetters = q.distractor_explanations
          .map((d) => d.letter)
          .sort();
        const expectedDistractors = VALID_LETTERS.filter(
          (l) => l !== q.correct_answer
        ).sort();
        expect(distractorLetters).toEqual(expectedDistractors);
        for (const d of q.distractor_explanations) {
          expect(typeof d.explanation).toBe("string");
          expect(d.explanation.length).toBeGreaterThan(10);
        }
      }
    }
  );

  it.each(passageEntries)(
    "%s every question has non-empty text and explanations",
    (_id: string, passage: Passage) => {
      for (const q of passage.questions) {
        expect(q.question_text.length).toBeGreaterThan(10);
        expect(q.correct_answer_explanation.length).toBeGreaterThan(20);
      }
    }
  );

  it.each(passageEntries)(
    "%s every skill_tested is a valid rc_ skill ID",
    (_id: string, passage: Passage) => {
      for (const q of passage.questions) {
        expect(
          RC_SKILL_IDS,
          `Q${q.question_number}: unknown skill "${q.skill_tested}"`
        ).toContain(q.skill_tested);
      }
    }
  );
});

// ─── Query Function Tests ─────────────────────────────────────────────

describe("passage query functions", () => {
  it("getPassageById returns correct passage", () => {
    const p = getPassageById("fiction_01");
    expect(p).toBeDefined();
    expect(p!.metadata.passage_id).toBe("fiction_01");
    expect(p!.metadata.genre).toBe("fiction");
  });

  it("getPassageById returns undefined for unknown ID", () => {
    expect(getPassageById("nonexistent")).toBeUndefined();
  });

  it("getPassagesByDifficulty returns 5 passages (one per genre)", () => {
    const level3 = getPassagesByDifficulty(3);
    expect(level3).toHaveLength(5);
    const genres = level3.map((p) => p.metadata.genre).sort();
    expect(genres).toEqual([...VALID_GENRES].sort());
  });

  it("getPassagesBySkill returns passages testing that skill", () => {
    const mainIdeaPassages = getPassagesBySkill("rc_main_idea");
    expect(mainIdeaPassages.length).toBeGreaterThanOrEqual(5);
    for (const p of mainIdeaPassages) {
      expect(p.metadata.tagged_skills).toContain("rc_main_idea");
    }
  });

  it("queryPassages with genre and difficulty returns exactly 1", () => {
    const result = queryPassages({ genre: "poetry", difficulty: 2 });
    expect(result).toHaveLength(1);
    expect(result[0].metadata.genre).toBe("poetry");
    expect(result[0].metadata.difficulty_level).toBe(2);
  });

  it("queryPassages with empty query returns all 25", () => {
    const result = queryPassages({});
    expect(result).toHaveLength(25);
  });

  it("queryPassages with nonexistent skill returns empty", () => {
    const result = queryPassages({ skill: "nonexistent_skill" });
    expect(result).toHaveLength(0);
  });

  it("queryPassages combines all filters", () => {
    const result = queryPassages({
      genre: "fiction",
      difficulty: 1,
      skill: "rc_main_idea",
    });
    expect(result.length).toBeLessThanOrEqual(1);
    for (const p of result) {
      expect(p.metadata.genre).toBe("fiction");
      expect(p.metadata.difficulty_level).toBe(1);
      expect(p.metadata.tagged_skills).toContain("rc_main_idea");
    }
  });
});
