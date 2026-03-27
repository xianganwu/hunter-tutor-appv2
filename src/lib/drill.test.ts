import { describe, it, expect } from "vitest";
import { shuffleQuestionChoices } from "./drill";
import type { DrillQuestion, MixedDrillQuestion } from "./drill";

// ─── shuffleQuestionChoices ──────────────────────────────────────────

describe("shuffleQuestionChoices", () => {
  const baseQuestion: DrillQuestion = {
    questionText: "What is 2 + 2?",
    answerChoices: ["A) 3", "B) 4", "C) 5", "D) 6"],
    correctAnswer: "B) 4",
  };

  it("preserves all choice texts after shuffle", () => {
    const result = shuffleQuestionChoices(baseQuestion);
    const originalTexts = new Set(["3", "4", "5", "6"]);
    const resultTexts = new Set(
      result.answerChoices.map((c) => c.replace(/^[A-H]\)\s*/, ""))
    );
    expect(resultTexts).toEqual(originalTexts);
  });

  it("re-letters choices sequentially A, B, C, D", () => {
    const result = shuffleQuestionChoices(baseQuestion);
    for (let i = 0; i < result.answerChoices.length; i++) {
      const letter = String.fromCharCode(65 + i); // A, B, C, D
      expect(result.answerChoices[i]).toMatch(new RegExp(`^${letter}\\) `));
    }
  });

  it("correctAnswer always matches the choice containing the correct text", () => {
    // Run many times to catch randomness issues
    for (let trial = 0; trial < 50; trial++) {
      const result = shuffleQuestionChoices(baseQuestion);
      // The correct answer text is "4"
      expect(result.correctAnswer).toMatch(/^[A-D]\) 4$/);
      // And it should be present in answerChoices
      expect(result.answerChoices).toContain(result.correctAnswer);
    }
  });

  it("handles 5-choice questions", () => {
    const q: DrillQuestion = {
      questionText: "Pick one",
      answerChoices: ["A) 10", "B) 20", "C) 30", "D) 40", "E) 50"],
      correctAnswer: "D) 40",
    };
    for (let trial = 0; trial < 30; trial++) {
      const result = shuffleQuestionChoices(q);
      expect(result.answerChoices).toHaveLength(5);
      expect(result.correctAnswer).toMatch(/^[A-E]\) 40$/);
      expect(result.answerChoices).toContain(result.correctAnswer);
      // All letters A-E present
      for (let i = 0; i < 5; i++) {
        expect(result.answerChoices[i]).toMatch(
          new RegExp(`^${String.fromCharCode(65 + i)}\\) `)
        );
      }
    }
  });

  it("works with MixedDrillQuestion (preserves skillId)", () => {
    const q: MixedDrillQuestion = {
      questionText: "Mixed Q",
      answerChoices: ["A) X", "B) Y", "C) Z", "D) W"],
      correctAnswer: "C) Z",
      skillId: "ma_fractions",
    };
    const result = shuffleQuestionChoices(q);
    expect(result.skillId).toBe("ma_fractions");
    expect(result.correctAnswer).toMatch(/^[A-D]\) Z$/);
    expect(result.answerChoices).toContain(result.correctAnswer);
  });

  it("handles LaTeX content in choices", () => {
    const q: DrillQuestion = {
      questionText: "Simplify",
      answerChoices: [
        "A) $\\frac{1}{2}$",
        "B) $\\frac{3}{4}$",
        "C) $\\frac{2}{3}$",
        "D) $\\frac{1}{4}$",
      ],
      correctAnswer: "A) $\\frac{1}{2}$",
    };
    for (let trial = 0; trial < 30; trial++) {
      const result = shuffleQuestionChoices(q);
      expect(result.correctAnswer).toMatch(
        /^[A-D]\) \$\\frac\{1\}\{2\}\$$/
      );
      expect(result.answerChoices).toContain(result.correctAnswer);
    }
  });

  it("handles empty choices gracefully", () => {
    const q: DrillQuestion = {
      questionText: "Empty",
      answerChoices: [],
      correctAnswer: "",
    };
    const result = shuffleQuestionChoices(q);
    expect(result.answerChoices).toHaveLength(0);
  });

  it("distributes correct answer across positions over many runs", () => {
    // Statistical test: over 200 shuffles, correct answer should NOT always be A
    const positions: number[] = [];
    for (let i = 0; i < 200; i++) {
      const result = shuffleQuestionChoices(baseQuestion);
      const correctLetter = result.correctAnswer.charAt(0);
      positions.push(correctLetter.charCodeAt(0) - 65); // A=0, B=1, etc.
    }
    // Check that at least 2 different positions were used (extremely unlikely to fail by chance)
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBeGreaterThanOrEqual(2);
  });

  it("correctAnswer where AI returned answer as 'A' is always correct", () => {
    // Simulates the bug scenario: AI always puts correct answer at A
    const q: DrillQuestion = {
      questionText: "What is 3 x 7?",
      answerChoices: ["A) 21", "B) 24", "C) 18", "D) 27"],
      correctAnswer: "A) 21",
    };
    for (let trial = 0; trial < 50; trial++) {
      const result = shuffleQuestionChoices(q);
      // The text "21" must always be the correct answer regardless of letter
      const correctText = result.correctAnswer.replace(/^[A-D]\)\s*/, "");
      expect(correctText).toBe("21");
      expect(result.answerChoices).toContain(result.correctAnswer);
    }
  });
});
