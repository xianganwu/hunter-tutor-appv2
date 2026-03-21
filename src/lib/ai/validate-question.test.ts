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

  it("handles negative numbers", () => {
    expect(normalizeChoiceValue("-3")).toBe("-3");
    expect(normalizeChoiceValue("A) -0.5")).toBe("-0.5");
    expect(normalizeChoiceValue("-.5")).toBe("-0.5");
  });

  it("handles negative fractions", () => {
    expect(normalizeChoiceValue("-1/2")).toBe("-0.5");
    expect(normalizeChoiceValue("A) -3/4")).toBe("-0.75");
  });

  it("handles mixed numbers", () => {
    expect(normalizeChoiceValue("2 1/2")).toBe("2.5");
    expect(normalizeChoiceValue("A) 1 3/4")).toBe("1.75");
    expect(normalizeChoiceValue("4 1/6")).toBe(String(4 + 1 / 6));
  });

  it("handles negative mixed numbers", () => {
    expect(normalizeChoiceValue("-1 1/2")).toBe("-1.5");
    expect(normalizeChoiceValue("-2 3/4")).toBe("-2.75");
  });

  it("handles negative percentages", () => {
    expect(normalizeChoiceValue("-25%")).toBe("-0.25");
  });

  it("normalizes Unicode fraction ½ to 0.5", () => {
    expect(normalizeChoiceValue("½")).toBe("0.5");
    expect(normalizeChoiceValue("A) ½")).toBe("0.5");
  });

  it("normalizes Unicode fraction ¼ to 0.25", () => {
    expect(normalizeChoiceValue("¼")).toBe("0.25");
  });

  it("normalizes Unicode fraction ¾ to 0.75", () => {
    expect(normalizeChoiceValue("¾")).toBe("0.75");
  });

  it("normalizes Unicode fraction ⅓ to 1/3 decimal", () => {
    expect(normalizeChoiceValue("⅓")).toBe(String(1 / 3));
  });

  it("normalizes Unicode fraction ⅔ to 2/3 decimal", () => {
    expect(normalizeChoiceValue("⅔")).toBe(String(2 / 3));
  });

  it("normalizes Unicode fraction ⅛ to 0.125", () => {
    expect(normalizeChoiceValue("⅛")).toBe("0.125");
  });
});

describe("hasDistinctChoices with Unicode fractions", () => {
  it("catches ½ vs 0.5", () => {
    expect(
      hasDistinctChoices(["A) ½", "B) 0.5", "C) 0.75", "D) 1", "E) 0.25"])
    ).toBe(false);
  });

  it("catches ¾ vs 75%", () => {
    expect(
      hasDistinctChoices(["A) ¾", "B) 75%", "C) 0.5", "D) 0.25", "E) 0.1"])
    ).toBe(false);
  });

  it("catches ¼ vs 1/4", () => {
    expect(
      hasDistinctChoices(["A) ¼", "B) 1/4", "C) 0.5", "D) 0.75", "E) 1"])
    ).toBe(false);
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

  it("catches 33.33% vs 1/3 (floating-point epsilon)", () => {
    expect(
      hasDistinctChoices(["A) 33.33%", "B) 1/3", "C) 0.5", "D) 0.75", "E) 0.1"])
    ).toBe(false);
  });

  it("does NOT false-positive on close but distinct numeric values", () => {
    expect(
      hasDistinctChoices(["A) 0.33", "B) 0.34", "C) 0.35", "D) 0.36", "E) 0.37"])
    ).toBe(true);
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
