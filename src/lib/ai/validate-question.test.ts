import { describe, it, expect } from "vitest";
import {
  normalizeChoiceValue,
  hasDistinctChoices,
  findDuplicateChoices,
  isValidQuestion,
  isValidSimulateQuestion,
} from "./validate-question";

// ─── normalizeChoiceValue ────────────────────────────────────────────

describe("normalizeChoiceValue", () => {
  it("strips letter prefix", () => {
    expect(normalizeChoiceValue("A) 42")).toBe("42");
    expect(normalizeChoiceValue("E) hello")).toBe("hello");
  });

  it("handles bare values (no prefix)", () => {
    expect(normalizeChoiceValue("42")).toBe("42");
    expect(normalizeChoiceValue("hello")).toBe("hello");
  });

  it("normalizes currency and commas", () => {
    expect(normalizeChoiceValue("$1,500")).toBe("1500");
    expect(normalizeChoiceValue("A) $2,000.50")).toBe("2000.5");
  });

  it("adds leading zero to bare decimals", () => {
    expect(normalizeChoiceValue(".5")).toBe("0.5");
    expect(normalizeChoiceValue("A) .75")).toBe("0.75");
  });

  it("removes trailing zeros", () => {
    expect(normalizeChoiceValue("0.40")).toBe("0.4");
    expect(normalizeChoiceValue("3.0")).toBe("3");
    expect(normalizeChoiceValue("3.00")).toBe("3");
    expect(normalizeChoiceValue("1.10")).toBe("1.1");
  });

  it("converts simple fractions to decimals", () => {
    expect(normalizeChoiceValue("1/2")).toBe("0.5");
    expect(normalizeChoiceValue("A) 3/4")).toBe("0.75");
    expect(normalizeChoiceValue("1/4")).toBe("0.25");
    expect(normalizeChoiceValue("1/3")).toBe(String(1 / 3));
  });

  it("converts percentages to decimals", () => {
    expect(normalizeChoiceValue("50%")).toBe("0.5");
    expect(normalizeChoiceValue("A) 75%")).toBe("0.75");
    expect(normalizeChoiceValue("100%")).toBe("1");
    expect(normalizeChoiceValue("12.5%")).toBe("0.125");
  });

  it("collapses whitespace", () => {
    expect(normalizeChoiceValue("A)   hello   world")).toBe("hello world");
  });

  it("lowercases text", () => {
    expect(normalizeChoiceValue("A) Hello World")).toBe("hello world");
  });

  it("does not convert division-in-text as fraction", () => {
    // "3/4 of a pizza" should not be treated as the fraction 0.75
    expect(normalizeChoiceValue("3/4 of a pizza")).toBe("3/4 of a pizza");
  });
});

// ─── hasDistinctChoices ──────────────────────────────────────────────

describe("hasDistinctChoices", () => {
  it("returns true for clearly distinct choices", () => {
    expect(
      hasDistinctChoices(["A) 10", "B) 20", "C) 30", "D) 40", "E) 50"])
    ).toBe(true);
  });

  it("returns true for distinct text choices", () => {
    expect(
      hasDistinctChoices([
        "A) George Washington",
        "B) Abraham Lincoln",
        "C) Thomas Jefferson",
        "D) John Adams",
        "E) James Madison",
      ])
    ).toBe(true);
  });

  it("catches 0.5 vs 1/2", () => {
    expect(
      hasDistinctChoices(["A) 0.5", "B) 1/2", "C) 0.75", "D) 0.25", "E) 0.1"])
    ).toBe(false);
  });

  it("catches 50% vs 0.5", () => {
    expect(
      hasDistinctChoices(["A) 50%", "B) 0.5", "C) 0.75", "D) 0.25", "E) 0.1"])
    ).toBe(false);
  });

  it("catches 50% vs 1/2", () => {
    expect(
      hasDistinctChoices([
        "A) 50%",
        "B) 1/2",
        "C) 0.75",
        "D) 0.25",
        "E) 0.1",
      ])
    ).toBe(false);
  });

  it("catches $1,500 vs 1500", () => {
    expect(
      hasDistinctChoices([
        "A) $1,500",
        "B) 1500",
        "C) 2000",
        "D) 1000",
        "E) 500",
      ])
    ).toBe(false);
  });

  it("catches 3.0 vs 3", () => {
    expect(
      hasDistinctChoices(["A) 3.0", "B) 3", "C) 4", "D) 5", "E) 6"])
    ).toBe(false);
  });

  it("catches .5 vs 0.5", () => {
    expect(
      hasDistinctChoices(["A) .5", "B) 0.5", "C) 0.75", "D) 1", "E) 0.25"])
    ).toBe(false);
  });

  it("works with 4 choices", () => {
    expect(hasDistinctChoices(["A) 1", "B) 2", "C) 3", "D) 4"])).toBe(true);
  });
});

// ─── findDuplicateChoices ────────────────────────────────────────────

describe("findDuplicateChoices", () => {
  it("returns empty for distinct choices", () => {
    expect(
      findDuplicateChoices(["A) 10", "B) 20", "C) 30", "D) 40", "E) 50"])
    ).toEqual([]);
  });

  it("returns the colliding pair for 0.5 vs 1/2", () => {
    const dupes = findDuplicateChoices([
      "A) 0.5",
      "B) 1/2",
      "C) 0.75",
      "D) 0.25",
      "E) 0.1",
    ]);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toContain("A) 0.5");
    expect(dupes[0]).toContain("B) 1/2");
  });

  it("returns multiple groups if multiple collisions", () => {
    const dupes = findDuplicateChoices([
      "A) 0.5",
      "B) 1/2",
      "C) 75%",
      "D) 3/4",
      "E) 0.1",
    ]);
    expect(dupes).toHaveLength(2);
  });
});

// ─── isValidQuestion (string[] format) ───────────────────────────────

describe("isValidQuestion", () => {
  it("accepts a valid 5-choice question", () => {
    expect(
      isValidQuestion(
        ["A) 10", "B) 20", "C) 30", "D) 40", "E) 50"],
        "C) 30",
        "test"
      )
    ).toBe(true);
  });

  it("accepts a valid question with bare letter correctAnswer", () => {
    expect(
      isValidQuestion(
        ["A) 10", "B) 20", "C) 30", "D) 40", "E) 50"],
        "C",
        "test"
      )
    ).toBe(true);
  });

  it("accepts a valid 4-choice question", () => {
    expect(
      isValidQuestion(["A) 10", "B) 20", "C) 30", "D) 40"], "A", "test")
    ).toBe(true);
  });

  it("rejects fewer than 4 choices", () => {
    expect(
      isValidQuestion(["A) 10", "B) 20", "C) 30"], "A", "test")
    ).toBe(false);
  });

  it("rejects equivalent choices", () => {
    expect(
      isValidQuestion(
        ["A) 0.5", "B) 1/2", "C) 0.75", "D) 0.25", "E) 0.1"],
        "A",
        "test"
      )
    ).toBe(false);
  });

  it("rejects invalid correct answer letter", () => {
    expect(
      isValidQuestion(
        ["A) 10", "B) 20", "C) 30", "D) 40", "E) 50"],
        "F",
        "test"
      )
    ).toBe(false);
  });

  it("rejects correct answer out of range", () => {
    expect(
      isValidQuestion(["A) 10", "B) 20", "C) 30", "D) 40"], "E", "test")
    ).toBe(false);
  });

  it("rejects empty correct answer", () => {
    expect(
      isValidQuestion(
        ["A) 10", "B) 20", "C) 30", "D) 40", "E) 50"],
        "",
        "test"
      )
    ).toBe(false);
  });
});

// ─── isValidSimulateQuestion ({letter, text}[] format) ───────────────

describe("isValidSimulateQuestion", () => {
  it("accepts a valid simulate question", () => {
    expect(
      isValidSimulateQuestion(
        [
          { letter: "A", text: "10" },
          { letter: "B", text: "20" },
          { letter: "C", text: "30" },
          { letter: "D", text: "40" },
          { letter: "E", text: "50" },
        ],
        "B",
        "test"
      )
    ).toBe(true);
  });

  it("rejects simulate question with equivalent choices", () => {
    expect(
      isValidSimulateQuestion(
        [
          { letter: "A", text: "0.5" },
          { letter: "B", text: "1/2" },
          { letter: "C", text: "0.75" },
          { letter: "D", text: "0.25" },
          { letter: "E", text: "0.1" },
        ],
        "A",
        "test"
      )
    ).toBe(false);
  });

  it("rejects simulate question with percentage/decimal equivalence", () => {
    expect(
      isValidSimulateQuestion(
        [
          { letter: "A", text: "25%" },
          { letter: "B", text: "0.25" },
          { letter: "C", text: "0.5" },
          { letter: "D", text: "0.75" },
          { letter: "E", text: "1" },
        ],
        "A",
        "test"
      )
    ).toBe(false);
  });

  it("rejects invalid correct answer letter", () => {
    expect(
      isValidSimulateQuestion(
        [
          { letter: "A", text: "10" },
          { letter: "B", text: "20" },
          { letter: "C", text: "30" },
          { letter: "D", text: "40" },
          { letter: "E", text: "50" },
        ],
        "F",
        "test"
      )
    ).toBe(false);
  });
});
