import { describe, it, expect } from "vitest";
import {
  normalizeChoiceValue,
  hasDistinctChoices,
  findDuplicateChoices,
  isValidQuestion,
  isValidSimulateQuestion,
  verifyPlaceValueAnswer,
  verifyStatementQuestion,
  verifyPlaceValueChoiceClaims,
  verifyPersonQuestion,
  validateGeneratedQuestion,
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

// ─── verifyPlaceValueChoiceClaims ──────────────────────────────────

describe("verifyPlaceValueChoiceClaims", () => {
  it("returns undefined for questions without comma-formatted numbers", () => {
    expect(
      verifyPlaceValueChoiceClaims(
        "What is 3 + 4?",
        ["A) 5", "B) 6", "C) 7", "D) 8", "E) 9"],
        "C) 7"
      )
    ).toBeUndefined();
  });

  it("returns undefined when choices have no verifiable place value claims", () => {
    expect(
      verifyPlaceValueChoiceClaims(
        "Marcus scored 492,736 points. How many more to reach 500,000?",
        ["A) 7,264", "B) 8,264", "C) 6,264", "D) 9,264", "E) 5,264"],
        "A) 7,264"
      )
    ).toBeUndefined();
  });

  it("returns undefined when AI has the right answer (the screenshot bug scenario)", () => {
    const question = `Marcus is playing a video game where he needs to collect points. His current score is 492,736 points. His friend tells him "The digit 7 in your score is worth 700 points." Is his friend correct, and why?`;
    const choices = [
      'A) Yes, because the 7 is in the hundreds place, so it\'s worth 700',
      'B) No, because the 7 is in the thousands place, so it\'s worth 7,000',
      'C) No, because the 7 is in the tens place, so it\'s worth 70',
      'D) Yes, because the 7 is in the ones place, so it\'s worth 7',
      'E) No, because the 7 is in the ten-thousands place, so it\'s worth 70,000',
    ];
    // AI correctly marked A
    expect(verifyPlaceValueChoiceClaims(question, choices, choices[0])).toBeUndefined();
  });

  it("auto-corrects when AI marks the wrong choice (the screenshot bug)", () => {
    const question = `Marcus is playing a video game where he needs to collect points. His current score is 492,736 points. His friend tells him "The digit 7 in your score is worth 700 points." Is his friend correct, and why?`;
    const choices = [
      'A) Yes, because the 7 is in the hundreds place, so it\'s worth 700',
      'B) No, because the 7 is in the thousands place, so it\'s worth 7,000',
      'C) No, because the 7 is in the tens place, so it\'s worth 70',
      'D) Yes, because the 7 is in the ones place, so it\'s worth 7',
      'E) No, because the 7 is in the ten-thousands place, so it\'s worth 70,000',
    ];
    // AI incorrectly marked B — should auto-correct to A
    expect(verifyPlaceValueChoiceClaims(question, choices, choices[1])).toBe(choices[0]);
  });

  it("handles 'has a [digit] in the [place] place' pattern in choices", () => {
    const question = "Look at the number 358,142. Which statement is true?";
    const choices = [
      "A) The number has a 5 in the ten-thousands place",
      "B) The number has a 5 in the thousands place",
      "C) The number has a 5 in the hundreds place",
      "D) The number has a 5 in the tens place",
    ];
    // 358,142: digit 5 is at ten-thousands (position 4) → A is correct
    // AI incorrectly says C
    expect(verifyPlaceValueChoiceClaims(question, choices, choices[2])).toBe(choices[0]);
  });

  it("rejects when no choice has correct claims (digit not in number)", () => {
    const question = "What place is the digit 9 in the number 123,456?";
    const choices = [
      "A) The 9 is in the hundreds place",
      "B) The 9 is in the thousands place",
      "C) The 9 is in the tens place",
      "D) The 9 is in the ones place",
    ];
    // Digit 9 doesn't appear in 123,456 — all "9 is in X place" claims are
    // verifiably false (the actual digit at each place ≠ 9), so reject.
    expect(verifyPlaceValueChoiceClaims(question, choices, choices[0])).toBeNull();
  });

  it("handles value claims with 'worth' keyword", () => {
    const question = "In the number 847,392, the digit 4 is worth how much?";
    const choices = [
      "A) The 4 is worth 400",
      "B) The 4 is worth 4,000",
      "C) The 4 is worth 40,000",
      "D) The 4 is worth 40",
      "E) The 4 is worth 400,000",
    ];
    // 847,392: digit 4 is at ten-thousands (position 4), value = 40,000
    // AI says A, should be C
    expect(verifyPlaceValueChoiceClaims(question, choices, choices[0])).toBe(choices[2]);
  });

  it("picks the largest number as context when multiple numbers appear", () => {
    const question = "Emma's score is 365,218 points. Her friend says the 2 is worth 2,000.";
    const choices = [
      "A) Yes, the 2 is in the thousands place",
      "B) No, the 2 is in the hundreds place",
      "C) No, the 2 is in the tens place",
      "D) No, the 2 is in the ones place",
    ];
    // 365,218: digit 2 is at hundreds (position 2), value = 200
    // Friend's claim of 2,000 is wrong. B is the correct choice.
    // AI says A → should correct to B
    expect(verifyPlaceValueChoiceClaims(question, choices, choices[0])).toBe(choices[1]);
  });
});

// ─── validateGeneratedQuestion (gateway) ────────────────────────────

describe("validateGeneratedQuestion", () => {
  it("passes a normal non-place-value question through", () => {
    const result = validateGeneratedQuestion(
      "What is 3 + 4?",
      ["A) 5", "B) 6", "C) 7", "D) 8", "E) 9"],
      "C) 7",
      "test"
    );
    expect(result).toBe("C) 7");
  });

  it("rejects questions with fewer than 4 choices", () => {
    expect(
      validateGeneratedQuestion(
        "What is 3 + 4?",
        ["A) 5", "B) 6", "C) 7"],
        "C) 7",
        "test"
      )
    ).toBeNull();
  });

  it("auto-corrects direct place value questions via verifyPlaceValueAnswer", () => {
    // Digit 4 in 247,583 → 40,000 (ten-thousands)
    const result = validateGeneratedQuestion(
      "What is the value of the digit 4 in 247,583?",
      ["A) 4", "B) 400", "C) 4,000", "D) 400,000", "E) 40,000"],
      "B) 400",
      "test"
    );
    expect(result).toBe("E) 40,000");
  });

  it("auto-corrects word problem place value via choice-level claims", () => {
    const question = `Marcus is playing a video game. His score is 492,736. His friend says the digit 7 is worth 700. Is his friend correct?`;
    const choices = [
      'A) Yes, the 7 is in the hundreds place',
      'B) No, the 7 is in the thousands place',
      'C) No, the 7 is in the tens place',
      'D) No, the 7 is in the ten-thousands place',
    ];
    const result = validateGeneratedQuestion(question, choices, choices[1], "test");
    expect(result).toBe(choices[0]);
  });

  it("rejects 'which statement' questions with multiple true statements", () => {
    const question = "Which statement about the number 523,841 is correct?";
    const choices = [
      "A) 523,841 has a 2 in the ten-thousands place",  // true
      "B) 523,841 has a 4 in the tens place",            // true
      "C) 523,841 has a 5 in the thousands place",       // false
      "D) 523,841 has a 1 in the hundreds place",        // false
    ];
    expect(validateGeneratedQuestion(question, choices, choices[0], "test")).toBeNull();
  });
});

// ─── verifyPersonQuestion ─────────────────────────────────────────────

describe("verifyPersonQuestion", () => {
  it("returns undefined for non-person questions", () => {
    expect(
      verifyPersonQuestion(
        "What is 3 + 4?",
        ["A) 5", "B) 6", "C) 7", "D) 8"],
        "C) 7"
      )
    ).toBeUndefined();
  });

  it("auto-corrects the exact IMG_1719 bug scenario", () => {
    // The bug: AI designated wrong answer for "Which person is correct?"
    const question = `Jose is organizing his baseball card collection. He has 2,649 cards total. His friend Alex says "The digit 6 is in the hundreds place, so it's worth 600." His sister Emma says "Since 2,649 is odd, if you add 1 it will be even." His dad says "2,649 is bigger than 2,694." Which person is correct?`;
    const choices = [
      "A) Only Alex is correct",
      "B) Only Emma is correct",
      "C) Only Dad is correct",
      "D) Both Alex and Emma are correct",
      "E) All three are correct",
    ];
    // Alex: 6 in hundreds = 600 → TRUE. Emma: 2649 odd, +1 = even → TRUE. Dad: 2649 > 2694 → FALSE.
    // Correct answer: D. AI might say A or B.
    expect(verifyPersonQuestion(question, choices, "A) Only Alex is correct")).toBe("D) Both Alex and Emma are correct");
    expect(verifyPersonQuestion(question, choices, "B) Only Emma is correct")).toBe("D) Both Alex and Emma are correct");
  });

  it("returns undefined when AI already has the right answer", () => {
    const question = `Jose has 2,649 cards. Alex says "The digit 6 is in the hundreds place, so it's worth 600." Emma says "Since 2,649 is odd, if you add 1 it will be even." Dad says "2,649 is bigger than 2,694." Which person is correct?`;
    const choices = [
      "A) Only Alex is correct",
      "B) Only Emma is correct",
      "C) Only Dad is correct",
      "D) Both Alex and Emma are correct",
      "E) All three are correct",
    ];
    expect(verifyPersonQuestion(question, choices, "D) Both Alex and Emma are correct")).toBeUndefined();
  });

  it("handles 'who is correct' phrasing", () => {
    const question = `Maria scored 45,823 points. Tom says "The digit 5 is in the thousands place." Lisa says "The digit 8 is in the tens place." Who is correct?`;
    const choices = [
      "A) Only Tom",
      "B) Only Lisa",
      "C) Both Tom and Lisa",
      "D) Neither of them",
    ];
    // 45,823: 5 is at thousands (position 3) → TRUE. 8 is at hundreds (position 2), NOT tens → FALSE.
    // Only Tom is correct → A
    expect(verifyPersonQuestion(question, choices, "C) Both Tom and Lisa")).toBe("A) Only Tom");
  });

  it("handles case where only one person with a comparison claim is correct", () => {
    const question = `Sam says "7,432 is larger than 7,423." Mike says "7,432 is larger than 7,532." Which friend is correct?`;
    const choices = [
      "A) Only Sam",
      "B) Only Mike",
      "C) Both Sam and Mike",
      "D) Neither of them",
    ];
    // Sam: 7432 > 7423 → TRUE. Mike: 7432 > 7532 → FALSE.
    expect(verifyPersonQuestion(question, choices, "C) Both Sam and Mike")).toBe("A) Only Sam");
  });

  it("handles 'none' when all characters are wrong", () => {
    const question = `Ava says "5,312 is bigger than 5,321." Ben says "5,312 is bigger than 6,312." Which person is correct?`;
    const choices = [
      "A) Only Ava",
      "B) Only Ben",
      "C) Both Ava and Ben",
      "D) None of them",
    ];
    // Ava: 5312 > 5321 → FALSE. Ben: 5312 > 6312 → FALSE.
    expect(verifyPersonQuestion(question, choices, "A) Only Ava")).toBe("D) None of them");
  });

  it("returns undefined when claims are not parseable", () => {
    const question = `Jake says "I love math." Sarah says "Math is hard." Which person is correct?`;
    const choices = ["A) Jake", "B) Sarah", "C) Both", "D) Neither"];
    // These are opinion claims, not math — can't verify
    expect(verifyPersonQuestion(question, choices, "A) Jake")).toBeUndefined();
  });

  it("returns undefined when fewer than 2 characters are found", () => {
    const question = `Alex says "The digit 5 is in the hundreds place of 3,524." Which person is correct?`;
    const choices = ["A) Alex is correct", "B) Alex is wrong", "C) Not sure", "D) None"];
    // Only one character — not enough to verify
    expect(verifyPersonQuestion(question, choices, "A) Alex is correct")).toBeUndefined();
  });
});

// ─── validateGeneratedQuestion — "which person" integration ─────────

describe("validateGeneratedQuestion — which person questions", () => {
  it("auto-corrects the IMG_1719 bug through the full gateway", () => {
    const question = `Jose has 2,649 cards. His friend Alex says "The digit 6 is in the hundreds place, so it's worth 600." His sister Emma says "Since 2,649 is odd, if you add 1 it will be even." His dad says "2,649 is bigger than 2,694." Which person is correct?`;
    const choices = [
      "A) Only Alex is correct",
      "B) Only Emma is correct",
      "C) Only Dad is correct",
      "D) Both Alex and Emma are correct",
      "E) All three are correct",
    ];
    // AI says A, should auto-correct to D
    const result = validateGeneratedQuestion(question, choices, "A) Only Alex is correct", "test");
    expect(result).toBe("D) Both Alex and Emma are correct");
  });

  it("passes through when AI has correct person answer", () => {
    const question = `Jose has 2,649 cards. His friend Alex says "The digit 6 is in the hundreds place, so it's worth 600." His sister Emma says "Since 2,649 is odd, if you add 1 it will be even." His dad says "2,649 is bigger than 2,694." Which person is correct?`;
    const choices = [
      "A) Only Alex is correct",
      "B) Only Emma is correct",
      "C) Only Dad is correct",
      "D) Both Alex and Emma are correct",
      "E) All three are correct",
    ];
    const result = validateGeneratedQuestion(question, choices, "D) Both Alex and Emma are correct", "test");
    expect(result).toBe("D) Both Alex and Emma are correct");
  });
});

// ─── validateGeneratedQuestion — safety net for unverifiable PV ──────

describe("validateGeneratedQuestion — unverifiable place value safety net", () => {
  it("rejects place value questions that no verifier can evaluate", () => {
    // A place-value-like question with claims only a human could parse
    const question = `The number 456,789 is special. If you rearrange the hundreds digit and the tens digit, what happens?`;
    const choices = [
      "A) The number gets bigger",
      "B) The number gets smaller",
      "C) The number stays the same",
      "D) It depends on which digits",
    ];
    // Contains "hundreds digit", "tens digit", and a big number — looks like place value
    // But no verifier can evaluate the claim → safety net rejects
    expect(validateGeneratedQuestion(question, choices, "A) The number gets bigger", "test")).toBeNull();
  });

  it("does NOT reject non-place-value questions", () => {
    const result = validateGeneratedQuestion(
      "What is 15 + 27?",
      ["A) 40", "B) 41", "C) 42", "D) 43", "E) 44"],
      "C) 42",
      "test"
    );
    expect(result).toBe("C) 42");
  });

  it("does NOT reject place value questions that a verifier CAN evaluate", () => {
    // Direct format — verifyPlaceValueAnswer handles this
    const result = validateGeneratedQuestion(
      "What is the value of the digit 4 in 247,583?",
      ["A) 4", "B) 400", "C) 4,000", "D) 400,000", "E) 40,000"],
      "E) 40,000",
      "test"
    );
    expect(result).toBe("E) 40,000");
  });
});
