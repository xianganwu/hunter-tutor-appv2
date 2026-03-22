import { describe, it, expect } from "vitest";
import {
  normalizeChoiceValue,
  hasDistinctChoices,
  findDuplicateChoices,
  isValidQuestion,
  isValidSimulateQuestion,
  verifyPlaceValueAnswer,
  verifyStatementQuestion,
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

// ─── verifyPlaceValueAnswer ─────────────────────────────────────────

describe("verifyPlaceValueAnswer", () => {
  const choices = [
    "A) 4",
    "B) 400",
    "C) 4,000",
    "D) 400,000",
    "E) 40,000",
  ];

  it("returns undefined for non-place-value questions", () => {
    expect(
      verifyPlaceValueAnswer(
        "What is 3 + 4?",
        ["A) 5", "B) 6", "C) 7", "D) 8", "E) 9"],
        "C) 7"
      )
    ).toBeUndefined();
  });

  it("returns undefined when AI has the right answer (247,583, digit 4 → 40,000)", () => {
    expect(
      verifyPlaceValueAnswer(
        "What is the value of the digit 4 in 247,583?",
        choices,
        "E) 40,000"
      )
    ).toBeUndefined();
  });

  it("corrects wrong answer: AI says 400 but correct is 40,000 for digit 4 in 247,583", () => {
    const result = verifyPlaceValueAnswer(
      "What is the value of the digit 4 in 247,583?",
      choices,
      "B) 400"
    );
    expect(result).toBe("E) 40,000");
  });

  it("corrects wrong answer: AI says 4,000 but correct is 40,000 for digit 4 in 247,583", () => {
    const result = verifyPlaceValueAnswer(
      "What is the value of the digit 4 in 247,583?",
      choices,
      "C) 4,000"
    );
    expect(result).toBe("E) 40,000");
  });

  it("handles 'the number' phrasing", () => {
    const result = verifyPlaceValueAnswer(
      "What is the value of the digit 4 in the number 247,836?",
      choices,
      "B) 400"
    );
    expect(result).toBe("E) 40,000");
  });

  it("handles ones digit", () => {
    const result = verifyPlaceValueAnswer(
      "What is the value of the digit 3 in 247,583?",
      ["A) 3", "B) 30", "C) 300", "D) 3,000", "E) 30,000"],
      "C) 300"
    );
    expect(result).toBe("A) 3");
  });

  it("handles hundreds digit", () => {
    const result = verifyPlaceValueAnswer(
      "What is the value of the digit 5 in 247,583?",
      ["A) 5", "B) 50", "C) 500", "D) 5,000", "E) 50,000"],
      "A) 5"
    );
    expect(result).toBe("C) 500");
  });

  it("returns null when correct value is not among choices", () => {
    // Digit 2 in 247,583 → 200,000, which is not in choices
    const result = verifyPlaceValueAnswer(
      "What is the value of the digit 2 in 247,583?",
      ["A) 2", "B) 20", "C) 200", "D) 2,000", "E) 20,000"],
      "A) 2"
    );
    expect(result).toBeNull();
  });

  it("handles digit that appears multiple times (uses leftmost)", () => {
    // In 343,521: first 3 is at position 5 (hundred-thousands) → 300,000
    const result = verifyPlaceValueAnswer(
      "What is the value of the digit 3 in 343,521?",
      ["A) 3", "B) 30", "C) 300", "D) 3,000", "E) 300,000"],
      "D) 3,000"
    );
    expect(result).toBe("E) 300,000");
  });
});

// ─── verifyStatementQuestion ────────────────────────────────────────

describe("verifyStatementQuestion", () => {
  it("returns undefined for non-statement questions", () => {
    expect(
      verifyStatementQuestion(
        "What is 3 + 4?",
        ["A) 5", "B) 6", "C) 7", "D) 8", "E) 9"]
      )
    ).toBeUndefined();
  });

  it("rejects when all place value statements are true (the zoo visitor bug)", () => {
    const question = `The local zoo is celebrating its anniversary! Here are the visitor counts from different years:
2019: 847,392 visitors
2020: 478,629 visitors
2021: 847,932 visitors
2022: 478,926 visitors

Which statement about these numbers is correct?`;
    const choices = [
      "A) The number 847,392 has a 9 in the tens place",
      "B) In 478,629, the digit 6 represents 6 hundreds",
      "C) The largest number of visitors was in 2021",
      "D) In 847,932, the digit 4 is in the ten-thousands place",
      "E) The numbers 478,629 and 478,926 have the same value in the thousands place",
    ];
    expect(verifyStatementQuestion(question, choices)).toBeNull();
  });

  it("accepts when exactly one statement is true", () => {
    const question = "Which statement about the number 523,841 is correct?";
    const choices = [
      "A) 523,841 has a 3 in the tens place",        // false: tens digit is 4
      "B) 523,841 has a 2 in the ten-thousands place", // true: 2 is at ten-thousands
      "C) 523,841 has a 5 in the thousands place",     // false: thousands digit is 3
      "D) 523,841 has a 1 in the hundreds place",      // false: hundreds digit is 8
      "E) 523,841 has a 4 in the ones place",          // false: ones digit is 1
    ];
    expect(verifyStatementQuestion(question, choices)).toBeUndefined();
  });

  it("rejects when zero statements are true", () => {
    const question = "Which statement about the number 523,841 is correct?";
    const choices = [
      "A) 523,841 has a 3 in the tens place",        // false
      "B) 523,841 has a 9 in the ten-thousands place", // false
      "C) 523,841 has a 5 in the thousands place",     // false
      "D) 523,841 has a 1 in the hundreds place",      // false
      "E) 523,841 has a 4 in the ones place",          // false
    ];
    expect(verifyStatementQuestion(question, choices)).toBeNull();
  });

  it("handles 'digit X is in the Y place' pattern", () => {
    const question = "Which statement is correct?";
    const choices = [
      "A) In 847,392, the digit 4 is in the hundreds place",       // false: 4 is ten-thousands
      "B) In 847,392, the digit 4 is in the ten-thousands place",  // true
      "C) In 847,392, the digit 4 is in the thousands place",      // false
      "D) In 847,392, the digit 4 is in the tens place",           // false
    ];
    expect(verifyStatementQuestion(question, choices)).toBeUndefined();
  });

  it("handles 'same value in the X place' pattern", () => {
    const question = "Which statement is correct?";
    const choices = [
      "A) 123,456 and 789,456 have the same value in the thousands place",   // false: 3 vs 9
      "B) 123,456 and 789,456 have the same value in the hundreds place",    // true: both 4
      "C) 123,456 and 789,456 have the same value in the ten-thousands place", // false: 2 vs 8
      "D) 123,456 and 789,456 have the same value in the ones place",        // true: both 6
    ];
    // Two are true → reject
    expect(verifyStatementQuestion(question, choices)).toBeNull();
  });
});
