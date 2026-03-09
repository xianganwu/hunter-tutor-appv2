import { describe, it, expect } from "vitest";
import {
  assembleReadingSection,
  scoreSection,
  estimatePercentile,
  analyzeTime,
  generateLocalRecommendations,
  checkCooldown,
  READING_QUESTION_TARGET,
  ELA_DURATION_MINUTES,
  MATH_DURATION_MINUTES,
  COOLDOWN_DAYS,
} from "./simulation";
import type {
  ExamQuestion,
  SectionTiming,
  SectionScore,
} from "./simulation";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<ExamQuestion> = {}): ExamQuestion {
  return {
    id: `q_${Math.random().toString(36).slice(2, 6)}`,
    questionText: "Test question?",
    answerChoices: [
      { letter: "A", text: "Choice A" },
      { letter: "B", text: "Choice B" },
      { letter: "C", text: "Choice C" },
      { letter: "D", text: "Choice D" },
      { letter: "E", text: "Choice E" },
    ],
    correctAnswer: "B",
    skillId: "rc_main_idea",
    ...overrides,
  };
}

// ─── assembleReadingSection ───────────────────────────────────────────

describe("assembleReadingSection", () => {
  it("returns passage blocks", () => {
    const blocks = assembleReadingSection();
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(blocks.length).toBeLessThanOrEqual(8);
  });

  it("produces exactly the target number of questions", () => {
    const blocks = assembleReadingSection();
    const totalQuestions = blocks.reduce(
      (sum, b) => sum + b.questions.length,
      0
    );
    expect(totalQuestions).toBe(READING_QUESTION_TARGET);
  });

  it("includes multiple genres", () => {
    // Run a few times to account for randomness
    for (let i = 0; i < 3; i++) {
      const blocks = assembleReadingSection();
      const passageIds = blocks.map((b) => b.passageId);
      // Should have passages from at least 3 different prefixes
      const prefixes = new Set(passageIds.map((id) => id.split("_")[0]));
      expect(prefixes.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("assigns unique question IDs", () => {
    const blocks = assembleReadingSection();
    const allIds = blocks.flatMap((b) => b.questions.map((q) => q.id));
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it("each block has passage content", () => {
    const blocks = assembleReadingSection();
    for (const block of blocks) {
      expect(block.title).toBeTruthy();
      expect(block.passageText).toBeTruthy();
      expect(block.wordCount).toBeGreaterThan(0);
      expect(block.questions.length).toBeGreaterThan(0);
    }
  });
});

// ─── scoreSection ─────────────────────────────────────────────────────

describe("scoreSection", () => {
  it("scores all correct", () => {
    const questions = [
      makeQuestion({ id: "q1", correctAnswer: "A" }),
      makeQuestion({ id: "q2", correctAnswer: "B" }),
      makeQuestion({ id: "q3", correctAnswer: "C" }),
    ];
    const answers = { q1: "A", q2: "B", q3: "C" };
    const result = scoreSection(questions, answers);

    expect(result.correct).toBe(3);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it("scores partial correctness", () => {
    const questions = [
      makeQuestion({ id: "q1", correctAnswer: "A" }),
      makeQuestion({ id: "q2", correctAnswer: "B" }),
      makeQuestion({ id: "q3", correctAnswer: "C" }),
      makeQuestion({ id: "q4", correctAnswer: "D" }),
    ];
    const answers = { q1: "A", q2: "B", q3: "A", q4: "A" };
    const result = scoreSection(questions, answers);

    expect(result.correct).toBe(2);
    expect(result.total).toBe(4);
    expect(result.percentage).toBe(50);
  });

  it("handles unanswered questions as incorrect", () => {
    const questions = [
      makeQuestion({ id: "q1", correctAnswer: "A" }),
      makeQuestion({ id: "q2", correctAnswer: "B" }),
    ];
    const answers = { q1: "A" }; // q2 not answered
    const result = scoreSection(questions, answers);

    expect(result.correct).toBe(1);
    expect(result.total).toBe(2);
    expect(result.percentage).toBe(50);
  });

  it("groups by skill", () => {
    const questions = [
      makeQuestion({ id: "q1", correctAnswer: "A", skillId: "rc_main_idea" }),
      makeQuestion({ id: "q2", correctAnswer: "A", skillId: "rc_main_idea" }),
      makeQuestion({ id: "q3", correctAnswer: "A", skillId: "rc_inference" }),
    ];
    const answers = { q1: "A", q2: "B", q3: "A" };
    const result = scoreSection(questions, answers);

    expect(result.bySkill.length).toBe(2);
    const mainIdea = result.bySkill.find((s) => s.skillId === "rc_main_idea");
    const inference = result.bySkill.find((s) => s.skillId === "rc_inference");
    expect(mainIdea?.correct).toBe(1);
    expect(mainIdea?.total).toBe(2);
    expect(inference?.correct).toBe(1);
    expect(inference?.total).toBe(1);
  });

  it("sorts skills by percentage ascending (weakest first)", () => {
    const questions = [
      makeQuestion({ id: "q1", correctAnswer: "A", skillId: "skill_good" }),
      makeQuestion({ id: "q2", correctAnswer: "A", skillId: "skill_good" }),
      makeQuestion({ id: "q3", correctAnswer: "A", skillId: "skill_bad" }),
      makeQuestion({ id: "q4", correctAnswer: "A", skillId: "skill_bad" }),
    ];
    const answers = { q1: "A", q2: "A", q3: "B", q4: "B" };
    const result = scoreSection(questions, answers);

    expect(result.bySkill[0].skillId).toBe("skill_bad");
    expect(result.bySkill[1].skillId).toBe("skill_good");
  });

  it("handles empty questions", () => {
    const result = scoreSection([], {});
    expect(result.correct).toBe(0);
    expect(result.total).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.bySkill).toHaveLength(0);
  });
});

// ─── estimatePercentile ───────────────────────────────────────────────

describe("estimatePercentile", () => {
  it("returns 99 for 95%+", () => {
    expect(estimatePercentile(95)).toBe(99);
    expect(estimatePercentile(100)).toBe(99);
  });

  it("returns 95 for 90-94%", () => {
    expect(estimatePercentile(90)).toBe(95);
    expect(estimatePercentile(94)).toBe(95);
  });

  it("returns lower percentiles for lower scores", () => {
    expect(estimatePercentile(70)).toBe(58);
    expect(estimatePercentile(50)).toBe(15);
    expect(estimatePercentile(30)).toBe(8);
  });

  it("is monotonically non-decreasing", () => {
    let prev = 0;
    for (let pct = 0; pct <= 100; pct += 5) {
      const result = estimatePercentile(pct);
      expect(result).toBeGreaterThanOrEqual(prev);
      prev = result;
    }
  });
});

// ─── analyzeTime ──────────────────────────────────────────────────────

describe("analyzeTime", () => {
  it("classifies rushed sections", () => {
    const timings: SectionTiming[] = [
      {
        sectionId: "ela",
        startedAt: 0,
        endedAt: 1,
        allocatedMinutes: ELA_DURATION_MINUTES,
        usedMinutes: 108, // 98% of 110
      },
      {
        sectionId: "math",
        startedAt: 0,
        endedAt: 1,
        allocatedMinutes: MATH_DURATION_MINUTES,
        usedMinutes: 74, // 99% of 75
      },
    ];

    const analysis = analyzeTime(timings);
    expect(analysis.elaVerdict).toBe("rushed");
    expect(analysis.mathVerdict).toBe("rushed");
  });

  it("classifies balanced sections", () => {
    const timings: SectionTiming[] = [
      {
        sectionId: "ela",
        startedAt: 0,
        endedAt: 1,
        allocatedMinutes: ELA_DURATION_MINUTES,
        usedMinutes: 88, // 80% of 110
      },
      {
        sectionId: "math",
        startedAt: 0,
        endedAt: 1,
        allocatedMinutes: MATH_DURATION_MINUTES,
        usedMinutes: 60, // 80% of 75
      },
    ];

    const analysis = analyzeTime(timings);
    expect(analysis.elaVerdict).toBe("balanced");
    expect(analysis.mathVerdict).toBe("balanced");
  });

  it("classifies surplus sections", () => {
    const timings: SectionTiming[] = [
      {
        sectionId: "ela",
        startedAt: 0,
        endedAt: 1,
        allocatedMinutes: ELA_DURATION_MINUTES,
        usedMinutes: 55, // 50% of 110
      },
      {
        sectionId: "math",
        startedAt: 0,
        endedAt: 1,
        allocatedMinutes: MATH_DURATION_MINUTES,
        usedMinutes: 40, // 53% of 75
      },
    ];

    const analysis = analyzeTime(timings);
    expect(analysis.elaVerdict).toBe("surplus");
    expect(analysis.mathVerdict).toBe("surplus");
  });
});

// ─── generateLocalRecommendations ─────────────────────────────────────

describe("generateLocalRecommendations", () => {
  const makeScore = (
    correct: number,
    total: number,
    bySkill: SectionScore["bySkill"] = []
  ): SectionScore => ({
    correct,
    total,
    percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    bySkill,
  });

  it("returns recommendations array", () => {
    const reading = makeScore(35, 50);
    const qr = makeScore(25, 37);
    const ma = makeScore(30, 47);
    const time = analyzeTime([
      { sectionId: "ela", startedAt: 0, endedAt: 1, allocatedMinutes: 110, usedMinutes: 90 },
      { sectionId: "math", startedAt: 0, endedAt: 1, allocatedMinutes: 75, usedMinutes: 60 },
    ]);

    const recs = generateLocalRecommendations(reading, qr, ma, time);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => typeof r === "string")).toBe(true);
  });

  it("includes weak skill recommendations", () => {
    const weakSkills = [
      { skillId: "rc_inference", skillName: "Inference", correct: 1, total: 5, percentage: 20 },
    ];
    const reading = makeScore(30, 50, weakSkills);
    const qr = makeScore(20, 37);
    const ma = makeScore(25, 47);
    const time = analyzeTime([
      { sectionId: "ela", startedAt: 0, endedAt: 1, allocatedMinutes: 110, usedMinutes: 90 },
      { sectionId: "math", startedAt: 0, endedAt: 1, allocatedMinutes: 75, usedMinutes: 60 },
    ]);

    const recs = generateLocalRecommendations(reading, qr, ma, time);
    expect(recs.some((r) => r.includes("Inference"))).toBe(true);
  });
});

// ─── checkCooldown ────────────────────────────────────────────────────

describe("checkCooldown", () => {
  it("allows when no history (localStorage unavailable in test)", () => {
    const result = checkCooldown();
    expect(result.allowed).toBe(true);
    expect(result.nextDate).toBeNull();
  });
});

// ─── Constants ────────────────────────────────────────────────────────

describe("constants", () => {
  it("has correct exam structure", () => {
    expect(READING_QUESTION_TARGET).toBe(50);
    expect(ELA_DURATION_MINUTES).toBe(110);
    expect(MATH_DURATION_MINUTES).toBe(75);
    expect(COOLDOWN_DAYS).toBe(14);
  });
});
