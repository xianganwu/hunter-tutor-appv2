import { describe, it, expect } from "vitest";
import {
  shouldTriggerTeachBack,
  createTeachingMoment,
  TEACH_BACK_MASTERY_THRESHOLD,
  TEACH_BACK_MIN_QUESTIONS,
} from "./teaching-moments";

describe("shouldTriggerTeachBack", () => {
  it("returns false when below minimum question count", () => {
    expect(
      shouldTriggerTeachBack(3, 3, "skill-1", new Set())
    ).toBe(false);
  });

  it("returns false when accuracy is below threshold", () => {
    // 4 questions, 3 correct = 0.75 < 0.85
    expect(
      shouldTriggerTeachBack(4, 3, "skill-1", new Set())
    ).toBe(false);
  });

  it("returns false when skill already triggered", () => {
    const triggered = new Set(["skill-1"]);
    expect(
      shouldTriggerTeachBack(5, 5, "skill-1", triggered)
    ).toBe(false);
  });

  it("returns true when all conditions met", () => {
    // 5 questions, 5 correct = 1.0 > 0.85
    expect(
      shouldTriggerTeachBack(5, 5, "skill-1", new Set())
    ).toBe(true);
  });

  it("returns true at exact threshold boundary (just above)", () => {
    // Need accuracy > 0.85 (strict inequality)
    // 7 questions, 6 correct = 0.857... > 0.85
    expect(
      shouldTriggerTeachBack(7, 6, "skill-1", new Set())
    ).toBe(true);
  });

  it("returns false at exact threshold (not strictly above)", () => {
    // 20 questions, 17 correct = 0.85 — not > 0.85
    expect(
      shouldTriggerTeachBack(20, 17, "skill-1", new Set())
    ).toBe(false);
  });

  it("allows different skills independently", () => {
    const triggered = new Set(["skill-1"]);
    expect(
      shouldTriggerTeachBack(5, 5, "skill-2", triggered)
    ).toBe(true);
  });
});

describe("createTeachingMoment", () => {
  it("creates a teaching moment with all fields", () => {
    const moment = createTeachingMoment({
      skillId: "math.fractions",
      skillName: "Fractions",
      studentExplanation: "A fraction is a part of a whole...",
      evaluation: {
        completeness: "complete",
        accuracy: "accurate",
        feedback: "Great job!",
        missingConcepts: [],
      },
    });

    expect(moment.id).toBeTruthy();
    expect(moment.skillId).toBe("math.fractions");
    expect(moment.skillName).toBe("Fractions");
    expect(moment.studentExplanation).toBe("A fraction is a part of a whole...");
    expect(moment.evaluation.completeness).toBe("complete");
    expect(moment.evaluation.accuracy).toBe("accurate");
    expect(moment.createdAt).toBeTruthy();
  });

  it("generates unique IDs for each moment", () => {
    const params = {
      skillId: "math.fractions",
      skillName: "Fractions",
      studentExplanation: "test",
      evaluation: {
        completeness: "complete" as const,
        accuracy: "accurate" as const,
        feedback: "Good",
        missingConcepts: [],
      },
    };

    const a = createTeachingMoment(params);
    const b = createTeachingMoment(params);
    expect(a.id).not.toBe(b.id);
  });

  it("sets createdAt to a valid ISO date string", () => {
    const moment = createTeachingMoment({
      skillId: "reading.inference",
      skillName: "Inference",
      studentExplanation: "Inference means reading between the lines",
      evaluation: {
        completeness: "partial",
        accuracy: "minor_errors",
        feedback: "Good start!",
        missingConcepts: ["textual evidence"],
      },
    });

    const parsed = new Date(moment.createdAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

describe("constants", () => {
  it("has a mastery threshold of 0.85", () => {
    expect(TEACH_BACK_MASTERY_THRESHOLD).toBe(0.85);
  });

  it("requires at least 4 questions", () => {
    expect(TEACH_BACK_MIN_QUESTIONS).toBe(4);
  });
});
