/**
 * Shared question validation utilities.
 *
 * Every AI-generated question must pass these checks before reaching a student.
 * A single wrong question erodes trust in the entire app, so we reject
 * anything ambiguous rather than guessing.
 */

import { parseWarn } from "./parse-logger";

// ─── Normalization ───────────────────────────────────────────────────

/**
 * Normalize a single answer choice for equivalence comparison.
 * Strips the leading letter prefix (e.g. "A) "), trims whitespace,
 * and normalizes common equivalent representations:
 *   - Currency symbols / commas: "$1,500" → "1500"
 *   - Leading zeros: ".40" → "0.40"
 *   - Trailing zeros: "0.40" → "0.4", "3.0" → "3"
 *   - Simple fractions: "1/2" → "0.5"
 *   - Percentages: "50%" → "0.5"
 *   - Whitespace collapse
 */
/** Map of Unicode fraction characters to their ASCII equivalents. */
const UNICODE_FRACTIONS: Record<string, string> = {
  "\u00BC": "1/4",  // ¼
  "\u00BD": "1/2",  // ½
  "\u00BE": "3/4",  // ¾
  "\u2153": "1/3",  // ⅓
  "\u2154": "2/3",  // ⅔
  "\u2155": "1/5",  // ⅕
  "\u2156": "2/5",  // ⅖
  "\u2157": "3/5",  // ⅗
  "\u2158": "4/5",  // ⅘
  "\u2159": "1/6",  // ⅙
  "\u215A": "5/6",  // ⅚
  "\u215B": "1/8",  // ⅛
  "\u215C": "3/8",  // ⅜
  "\u215D": "5/8",  // ⅝
  "\u215E": "7/8",  // ⅞
};

const UNICODE_FRACTION_RE = new RegExp(
  `[${Object.keys(UNICODE_FRACTIONS).join("")}]`,
  "g"
);

export function normalizeChoiceValue(choice: string): string {
  // Strip leading letter+paren prefix: "A) 30%" → "30%"
  let s = choice.replace(/^[A-Ea-e]\)\s*/, "").trim().toLowerCase();
  // Replace Unicode fraction characters with ASCII equivalents: "½" → "1/2"
  s = s.replace(UNICODE_FRACTION_RE, (ch) => UNICODE_FRACTIONS[ch] ?? ch);
  // Remove currency symbols and commas: "$1,500" → "1500"
  s = s.replace(/[$,]/g, "");
  // Add leading zero: ".40" → "0.40" (also handles "-.5" → "-0.5")
  s = s.replace(/^(-?)\.(\d)/, "$10.$2");
  // Remove trailing zeros after decimal: "0.40" → "0.4", "3.0" → "3"
  s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  // Normalize mixed numbers to decimals: "2 1/2" → "2.5", "-1 3/4" → "-1.75"
  const mixedMatch = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den !== 0) {
      const value = whole >= 0 ? whole + num / den : whole - num / den;
      s = String(value);
    }
  }
  // Normalize simple fractions to decimals: "1/2" → "0.5", "-3/4" → "-0.75"
  const fractionMatch = s.match(/^(-?\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    if (den !== 0) s = String(num / den);
  }
  // Normalize percentage to decimal: "50%" → "0.5"
  const pctMatch = s.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pctMatch) {
    s = String(parseFloat(pctMatch[1]) / 100);
  }
  // Collapse whitespace
  s = s.replace(/\s+/g, " ");
  return s;
}

// ─── Numeric equivalence ─────────────────────────────────────────────

/**
 * Epsilon for numeric equivalence.
 * Set to 1e-4 to catch cases where percentages are rounded approximations
 * of fractions (e.g., "33.33%" = 0.3333 vs "1/3" = 0.33333..., diff ≈ 3.3e-5).
 * Still well below meaningful answer differences (e.g., 0.33 vs 0.34 = 0.01).
 */
const NUMERIC_EPSILON = 1e-4;

/**
 * Check whether two normalized values are equivalent.
 * First tries exact string match, then numeric match with epsilon tolerance.
 * This catches cases like "0.3333" (from "33.33%") vs
 * "0.3333333333333333" (from "1/3") that are semantically equivalent.
 */
function normalizedValuesEqual(a: string, b: string): boolean {
  if (a === b) return true;
  // If both values look like numbers, compare numerically with epsilon
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB) && a !== "" && b !== "") {
    return Math.abs(numA - numB) < NUMERIC_EPSILON;
  }
  return false;
}

// ─── Distinctness check ──────────────────────────────────────────────

/**
 * Check that all answer choices are distinct after normalizing.
 * Catches cases like "0.5" and "1/2" appearing as separate choices —
 * which would mean two choices are effectively "correct."
 * Uses epsilon comparison for numeric values to handle floating-point
 * imprecision (e.g., "33.33%" vs "1/3").
 */
export function hasDistinctChoices(choices: string[]): boolean {
  const normalized = choices.map((c) => normalizeChoiceValue(c));
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (normalizedValuesEqual(normalized[i], normalized[j])) return false;
    }
  }
  return true;
}

/**
 * Find which choices collide after normalization (for logging).
 * Returns pairs like [["A) 0.5", "C) 1/2"]] or [] if all distinct.
 */
export function findDuplicateChoices(choices: string[]): string[][] {
  const normalized = choices.map((c) => normalizeChoiceValue(c));
  // Build groups using numeric-aware equivalence
  const groups: { key: string; members: string[] }[] = [];
  for (let i = 0; i < normalized.length; i++) {
    let found = false;
    for (const group of groups) {
      if (normalizedValuesEqual(group.key, normalized[i])) {
        group.members.push(choices[i]);
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ key: normalized[i], members: [choices[i]] });
    }
  }
  return groups.filter((g) => g.members.length > 1).map((g) => g.members);
}

// ─── Full question validation ────────────────────────────────────────

/**
 * Validate a question with string[] answer choices (tutor-agent format).
 * Choices are in "A) text" format; correctAnswer is "A) text" or "A".
 *
 * Returns true if the question is safe to serve. Logs a warning and
 * returns false if any check fails — the question should be discarded.
 */
export function isValidQuestion(
  choices: string[],
  correctAnswer: string,
  parser: string,
): boolean {
  // 1. Must have at least 4 choices
  if (choices.length < 4) {
    parseWarn({
      parser,
      field: "answerChoices",
      fallback: "REJECTED",
      rawSnippet: `Only ${choices.length} choices`,
    });
    return false;
  }

  // 2. All choices must be distinct after normalization
  if (!hasDistinctChoices(choices)) {
    const dupes = findDuplicateChoices(choices);
    parseWarn({
      parser,
      field: "distinctChoices",
      fallback: "REJECTED",
      rawSnippet: `Equivalent choices: ${dupes.map((d) => d.join(" ≡ ")).join("; ")}`,
    });
    return false;
  }

  // 3. correctAnswer letter must map to an actual choice
  const letter = correctAnswer.trim().charAt(0).toUpperCase();
  if (!/^[A-E]$/.test(letter)) {
    parseWarn({
      parser,
      field: "correctAnswer",
      fallback: "REJECTED",
      rawSnippet: `Invalid letter: "${correctAnswer}"`,
    });
    return false;
  }

  const idx = letter.charCodeAt(0) - 65; // A=0, B=1, ...
  if (idx >= choices.length) {
    parseWarn({
      parser,
      field: "correctAnswer",
      fallback: "REJECTED",
      rawSnippet: `Letter ${letter} out of range for ${choices.length} choices`,
    });
    return false;
  }

  return true;
}

/**
 * Validate a question with {letter, text}[] answer choices (simulate format).
 * correctAnswer is a bare letter like "A".
 */
export function isValidSimulateQuestion(
  choices: { letter: string; text: string }[],
  correctAnswer: string,
  parser: string,
): boolean {
  // Convert to flat strings for the common validation path
  const flat = choices.map((c) => `${c.letter}) ${c.text}`);
  return isValidQuestion(flat, correctAnswer, parser);
}

// ─── Place Value Verification ─────────────────────────────────────────

/**
 * Detect whether a question is asking about the VALUE of a specific digit
 * in a specific number — e.g. "What is the value of the digit 4 in 247,583?"
 *
 * Returns { digit, number } if detected, or null otherwise.
 */
function detectPlaceValueQuestion(questionText: string): { digit: number; numberStr: string } | null {
  // Match patterns like:
  //   "What is the value of the digit 4 in 247,583?"
  //   "What is the value of the digit 4 in the number 247,583?"
  //   "...value of digit 7 in 358,792..."
  const pattern = /value\s+of\s+(?:the\s+)?digit\s+(\d)\s+in\s+(?:the\s+number\s+)?([0-9,]+)/i;
  const match = questionText.match(pattern);
  if (!match) return null;
  const digit = parseInt(match[1], 10);
  const numberStr = match[2].replace(/,/g, "");
  if (isNaN(digit) || isNaN(parseInt(numberStr, 10))) return null;
  return { digit, numberStr };
}

/**
 * Given a number and a target digit, compute the place value of that digit.
 * For example, in 247583 the digit 4 has value 40000.
 *
 * If the digit appears multiple times, returns the value of the leftmost occurrence.
 * Returns null if the digit doesn't appear in the number.
 */
function computePlaceValue(numberStr: string, digit: number): number | null {
  const idx = numberStr.indexOf(String(digit));
  if (idx === -1) return null;
  // Position from the right (0-indexed): ones=0, tens=1, hundreds=2, ...
  const posFromRight = numberStr.length - 1 - idx;
  return digit * Math.pow(10, posFromRight);
}

/**
 * Verify a place value question's correct answer is mathematically correct.
 * If the AI marked the wrong choice as correct but the right answer exists
 * among the choices, returns the corrected choice. Otherwise returns null
 * to signal the question should be rejected.
 *
 * Returns undefined if the question is not a place value question (no opinion).
 */
export function verifyPlaceValueAnswer(
  questionText: string,
  choices: string[],
  correctAnswer: string,
): string | null | undefined {
  const detected = detectPlaceValueQuestion(questionText);
  if (!detected) return undefined; // not a place value question — no opinion

  const expected = computePlaceValue(detected.numberStr, detected.digit);
  if (expected === null) return undefined; // digit not found — can't verify

  // Check if the AI's marked answer matches the expected value
  const correctNorm = normalizeChoiceValue(correctAnswer);
  const correctNum = Number(correctNorm);
  if (!isNaN(correctNum) && Math.abs(correctNum - expected) < NUMERIC_EPSILON) {
    return undefined; // AI got it right — no correction needed
  }

  // AI got it wrong — look for the correct value among choices
  for (const choice of choices) {
    const choiceNorm = normalizeChoiceValue(choice);
    const choiceNum = Number(choiceNorm);
    if (!isNaN(choiceNum) && Math.abs(choiceNum - expected) < NUMERIC_EPSILON) {
      parseWarn({
        parser: "verifyPlaceValueAnswer",
        field: "correctAnswer",
        fallback: `AUTO-CORRECTED to "${choice}"`,
        rawSnippet: `AI said "${correctAnswer}" but digit ${detected.digit} in ${detected.numberStr} has value ${expected}`,
      });
      return choice; // return the corrected choice
    }
  }

  // The correct value isn't among the choices at all — reject
  parseWarn({
    parser: "verifyPlaceValueAnswer",
    field: "correctAnswer",
    fallback: "REJECTED",
    rawSnippet: `Expected value ${expected} for digit ${detected.digit} in ${detected.numberStr}, not found in choices`,
  });
  return null;
}

// ─── "Which statement is correct" Verification ───────────────────────

/** Map place name strings to 0-indexed position from right. */
const PLACE_NAME_TO_POS: Record<string, number> = {
  "ones": 0, "one": 0, "units": 0,
  "tens": 1, "ten": 1,
  "hundreds": 2, "hundred": 2,
  "thousands": 3, "thousand": 3,
  "ten-thousands": 4, "ten thousands": 4, "ten-thousand": 4, "ten thousand": 4,
  "hundred-thousands": 5, "hundred thousands": 5, "hundred-thousand": 5, "hundred thousand": 5,
  "millions": 6, "million": 6,
};

/**
 * Get the digit at a named place position in a number string.
 * Returns the digit (0-9) or null if the number doesn't have that position.
 */
function getDigitAtPlace(numberStr: string, placeName: string): number | null {
  const pos = PLACE_NAME_TO_POS[placeName.toLowerCase().trim()];
  if (pos === undefined) return null;
  const digits = numberStr.replace(/,/g, "");
  const idx = digits.length - 1 - pos;
  if (idx < 0 || idx >= digits.length) return null;
  return parseInt(digits[idx], 10);
}

/**
 * Try to verify a single statement about numbers.
 * Returns true/false if the statement can be verified, or null if not parseable.
 */
function verifyNumberStatement(statement: string, contextNumbers: string[]): boolean | null {
  const stmt = statement.replace(/^[A-Ea-e]\)\s*/, "").trim();

  // Pattern 1: "[number] has a [digit] in the [place] place"
  const hasDigitPattern = /(?:number\s+)?([0-9,]+)\s+has\s+(?:a|an)\s+(\d)\s+in\s+the\s+([\w\s-]+?)\s*place/i;
  const hasDigitMatch = stmt.match(hasDigitPattern);
  if (hasDigitMatch) {
    const actual = getDigitAtPlace(hasDigitMatch[1], hasDigitMatch[3]);
    if (actual === null) return null;
    return actual === parseInt(hasDigitMatch[2], 10);
  }

  // Pattern 2: "In [number], the digit [d] represents [value]" or "...represents [d] [place]s"
  const representsValuePattern = /in\s+([0-9,]+),?\s+the\s+digit\s+(\d)\s+represents\s+(\d[\d,]*)\b/i;
  const representsMatch = stmt.match(representsValuePattern);
  if (representsMatch) {
    const numStr = representsMatch[1].replace(/,/g, "");
    const digit = parseInt(representsMatch[2], 10);
    const claimed = parseInt(representsMatch[3].replace(/,/g, ""), 10);
    const actual = computePlaceValue(numStr, digit);
    if (actual === null) return null;
    return actual === claimed;
  }

  // Pattern 2b: "In [number], the digit [d] represents [d] [place]"
  const representsPlacePattern = /in\s+([0-9,]+),?\s+the\s+digit\s+(\d)\s+represents\s+\d+\s+([\w\s-]+?)s?$/i;
  const representsPlaceMatch = stmt.match(representsPlacePattern);
  if (representsPlaceMatch) {
    const digit = parseInt(representsPlaceMatch[2], 10);
    const placeName = representsPlaceMatch[3].trim();
    const actual = getDigitAtPlace(representsPlaceMatch[1], placeName);
    if (actual === null) return null;
    // Check that the digit is actually at that place
    if (actual !== digit) return false;
    // Also verify the count matches: "6 hundreds" means digit 6 at hundreds place
    const countMatch = stmt.match(/represents\s+(\d+)\s+/i);
    if (countMatch) {
      return parseInt(countMatch[1], 10) === digit && actual === digit;
    }
    return actual === digit;
  }

  // Pattern 3: "In [number], the digit [d] is in the [place] place"
  const digitInPlacePattern = /in\s+([0-9,]+),?\s+the\s+digit\s+(\d)\s+is\s+in\s+the\s+([\w\s-]+?)\s*place/i;
  const digitInPlaceMatch = stmt.match(digitInPlacePattern);
  if (digitInPlaceMatch) {
    const actual = getDigitAtPlace(digitInPlaceMatch[1], digitInPlaceMatch[3]);
    if (actual === null) return null;
    return actual === parseInt(digitInPlaceMatch[2], 10);
  }

  // Pattern 4: "The largest/smallest number ... was in [year]" or "... is [number]"
  const largestPattern = /the\s+(largest|smallest|greatest|biggest|least)\s+(?:number\s+(?:of\s+\w+\s+)?)?(?:was\s+(?:in\s+)?(\d{4})|is\s+([0-9,]+))/i;
  const largestMatch = stmt.match(largestPattern);
  if (largestMatch && contextNumbers.length > 0) {
    const isLargest = ["largest", "greatest", "biggest"].includes(largestMatch[1].toLowerCase());
    const nums = contextNumbers.map(n => parseInt(n.replace(/,/g, ""), 10));

    if (largestMatch[2]) {
      // "was in [year]" — can't verify year-based claims without year-to-number mapping
      return null;
    }
    if (largestMatch[3]) {
      const claimed = parseInt(largestMatch[3].replace(/,/g, ""), 10);
      const target = isLargest ? Math.max(...nums) : Math.min(...nums);
      return claimed === target;
    }
  }

  // Pattern 5: "[number1] and [number2] have the same value/digit in the [place] place"
  const sameValuePattern = /([0-9,]+)\s+and\s+([0-9,]+)\s+have\s+the\s+same\s+(?:value|digit)\s+in\s+the\s+([\w\s-]+?)\s*place/i;
  const sameValueMatch = stmt.match(sameValuePattern);
  if (sameValueMatch) {
    const d1 = getDigitAtPlace(sameValueMatch[1], sameValueMatch[3]);
    const d2 = getDigitAtPlace(sameValueMatch[2], sameValueMatch[3]);
    if (d1 === null || d2 === null) return null;
    return d1 === d2;
  }

  return null; // couldn't parse this statement
}

/**
 * Verify "which statement is correct" type questions.
 * Checks each choice to see if it makes a verifiable claim about numbers,
 * and rejects the question if more than one statement is true.
 *
 * Returns undefined if not a statement-selection question or can't verify.
 * Returns null if the question should be rejected (multiple true statements).
 */
export function verifyStatementQuestion(
  questionText: string,
  choices: string[],
): null | undefined {
  // Only apply to "which statement is correct/true" type questions
  if (!/which\s+statement/i.test(questionText)) return undefined;

  // Extract all numbers from the question text for context
  const contextNumbers = questionText.match(/\b\d{2,}(?:,\d{3})*\b/g) ?? [];

  let trueCount = 0;
  let verifiedCount = 0;
  const trueStatements: string[] = [];

  for (const choice of choices) {
    const result = verifyNumberStatement(choice, contextNumbers);
    if (result !== null) {
      verifiedCount++;
      if (result) {
        trueCount++;
        trueStatements.push(choice);
      }
    }
  }

  // Only reject if we could verify enough statements and found multiple true ones
  if (verifiedCount >= 3 && trueCount > 1) {
    parseWarn({
      parser: "verifyStatementQuestion",
      field: "multipleCorrect",
      fallback: "REJECTED",
      rawSnippet: `${trueCount} statements are true (need exactly 1): ${trueStatements.join(" | ")}`,
    });
    return null;
  }

  // If we verified statements and found exactly 0 true, that's also bad
  if (verifiedCount >= 3 && trueCount === 0) {
    parseWarn({
      parser: "verifyStatementQuestion",
      field: "noCorrectAnswer",
      fallback: "REJECTED",
      rawSnippet: `All ${verifiedCount} verifiable statements are false — no correct answer`,
    });
    return null;
  }

  return undefined; // looks fine or can't verify
}
