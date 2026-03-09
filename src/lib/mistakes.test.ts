import { describe, it, expect } from "vitest";
import {
  computeNextReviewDate,
  getDueForReview,
  analyzePatternsBySkill,
  analyzePatternsByCategory,
  createMistakeEntry,
  REVIEW_INTERVALS,
} from "./mistakes";
import type { MistakeEntry, MistakeDiagnosis } from "./mistakes";

function makeDiagnosis(
  category: MistakeDiagnosis["category"] = "conceptual_gap"
): MistakeDiagnosis {
  return {
    category,
    explanation: "Test explanation",
    relatedSkills: ["test_skill"],
  };
}

function makeMistake(
  overrides: Partial<MistakeEntry> = {}
): MistakeEntry {
  return {
    id: Math.random().toString(36).slice(2),
    skillId: "rc_main_idea",
    skillName: "Main Idea",
    questionText: "What is the main idea?",
    studentAnswer: "A",
    correctAnswer: "B",
    answerChoices: ["A) X", "B) Y", "C) Z"],
    diagnosis: makeDiagnosis(),
    createdAt: new Date().toISOString(),
    nextReviewAt: new Date().toISOString(),
    reviewCount: 0,
    lastReviewedAt: null,
    ...overrides,
  };
}

// ─── computeNextReviewDate ────────────────────────────────────────────

describe("computeNextReviewDate", () => {
  const baseDate = new Date("2026-01-01T12:00:00Z");

  it("schedules first review in 1 day", () => {
    const next = computeNextReviewDate(0, baseDate);
    expect(next.getDate()).toBe(baseDate.getDate() + 1);
  });

  it("schedules second review in 3 days", () => {
    const next = computeNextReviewDate(1, baseDate);
    const diff = (next.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(diff).toBe(3);
  });

  it("schedules third review in 7 days", () => {
    const next = computeNextReviewDate(2, baseDate);
    const diff = (next.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(diff).toBe(7);
  });

  it("schedules fourth review in 14 days", () => {
    const next = computeNextReviewDate(3, baseDate);
    const diff = (next.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(diff).toBe(14);
  });

  it("clamps to last interval for high review counts", () => {
    const next = computeNextReviewDate(10, baseDate);
    const diff = (next.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(diff).toBe(REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]);
  });
});

// ─── getDueForReview ──────────────────────────────────────────────────

describe("getDueForReview", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("returns mistakes with nextReviewAt <= now", () => {
    const due = makeMistake({
      nextReviewAt: "2026-01-09T00:00:00Z",
    });
    const notDue = makeMistake({
      nextReviewAt: "2026-01-15T00:00:00Z",
    });
    const result = getDueForReview([due, notDue], now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(due.id);
  });

  it("returns empty array when nothing is due", () => {
    const future = makeMistake({
      nextReviewAt: "2026-02-01T00:00:00Z",
    });
    expect(getDueForReview([future], now)).toHaveLength(0);
  });

  it("includes mistakes due exactly now", () => {
    const exact = makeMistake({
      nextReviewAt: now.toISOString(),
    });
    expect(getDueForReview([exact], now)).toHaveLength(1);
  });
});

// ─── analyzePatternsBySkill ───────────────────────────────────────────

describe("analyzePatternsBySkill", () => {
  it("groups mistakes by skill with count >= 2", () => {
    const mistakes = [
      makeMistake({ skillId: "rc_main_idea", skillName: "Main Idea" }),
      makeMistake({ skillId: "rc_main_idea", skillName: "Main Idea" }),
      makeMistake({ skillId: "rc_inference", skillName: "Inference" }),
    ];
    const patterns = analyzePatternsBySkill(mistakes);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].skillId).toBe("rc_main_idea");
    expect(patterns[0].count).toBe(2);
  });

  it("returns empty for all unique skills", () => {
    const mistakes = [
      makeMistake({ skillId: "a" }),
      makeMistake({ skillId: "b" }),
      makeMistake({ skillId: "c" }),
    ];
    expect(analyzePatternsBySkill(mistakes)).toHaveLength(0);
  });

  it("sorts by count descending", () => {
    const mistakes = [
      makeMistake({ skillId: "a" }),
      makeMistake({ skillId: "a" }),
      makeMistake({ skillId: "b" }),
      makeMistake({ skillId: "b" }),
      makeMistake({ skillId: "b" }),
    ];
    const patterns = analyzePatternsBySkill(mistakes);
    expect(patterns[0].skillId).toBe("b");
    expect(patterns[0].count).toBe(3);
  });
});

// ─── analyzePatternsByCategory ────────────────────────────────────────

describe("analyzePatternsByCategory", () => {
  it("counts categories correctly", () => {
    const mistakes = [
      makeMistake({ diagnosis: makeDiagnosis("conceptual_gap") }),
      makeMistake({ diagnosis: makeDiagnosis("conceptual_gap") }),
      makeMistake({ diagnosis: makeDiagnosis("careless_error") }),
    ];
    const result = analyzePatternsByCategory(mistakes);
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe("conceptual_gap");
    expect(result[0].count).toBe(2);
    expect(result[0].percentage).toBe(67);
    expect(result[1].category).toBe("careless_error");
    expect(result[1].count).toBe(1);
  });

  it("omits categories with zero count", () => {
    const mistakes = [
      makeMistake({ diagnosis: makeDiagnosis("careless_error") }),
    ];
    const result = analyzePatternsByCategory(mistakes);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("careless_error");
  });
});

// ─── createMistakeEntry ──────────────────────────────────────────────

describe("createMistakeEntry", () => {
  it("creates entry with correct fields", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const entry = createMistakeEntry(
      {
        skillId: "rc_main_idea",
        skillName: "Main Idea",
        questionText: "What?",
        studentAnswer: "A",
        correctAnswer: "B",
        answerChoices: ["A) X", "B) Y"],
        diagnosis: makeDiagnosis("careless_error"),
      },
      now
    );

    expect(entry.skillId).toBe("rc_main_idea");
    expect(entry.reviewCount).toBe(0);
    expect(entry.lastReviewedAt).toBeNull();
    expect(entry.createdAt).toBe(now.toISOString());
    expect(entry.diagnosis.category).toBe("careless_error");
  });

  it("sets nextReviewAt to 1 day from now", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const entry = createMistakeEntry(
      {
        skillId: "test",
        skillName: "Test",
        questionText: "Q",
        studentAnswer: "A",
        correctAnswer: "B",
        answerChoices: [],
        diagnosis: makeDiagnosis(),
      },
      now
    );

    const reviewDate = new Date(entry.nextReviewAt);
    const diffDays =
      (reviewDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(1);
  });

  it("generates unique IDs", () => {
    const params = {
      skillId: "test",
      skillName: "Test",
      questionText: "Q",
      studentAnswer: "A",
      correctAnswer: "B",
      answerChoices: [] as string[],
      diagnosis: makeDiagnosis(),
    };
    const a = createMistakeEntry(params);
    const b = createMistakeEntry(params);
    expect(a.id).not.toBe(b.id);
  });
});
