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

/**
 * Full validation gateway for simulate-format questions ({letter, text}[] choices,
 * bare letter correctAnswer like "A").
 *
 * Returns the (possibly corrected) bare-letter correctAnswer, or null to reject.
 */
export function validateSimulateQuestion(
  questionText: string,
  choices: { letter: string; text: string }[],
  correctAnswer: string,
  parser: string,
): string | null {
  const flat = choices.map((c) => `${c.letter}) ${c.text}`);
  // Build the full "A) text" answer for the gateway
  const correctChoice = choices.find((c) => c.letter === correctAnswer);
  if (!correctChoice) return null;
  const fullCorrectAnswer = `${correctChoice.letter}) ${correctChoice.text}`;

  const verified = validateGeneratedQuestion(questionText, flat, fullCorrectAnswer, parser);
  if (verified === null) return null;

  // Extract the letter back from the (possibly corrected) full answer
  const letter = verified.trim().charAt(0).toUpperCase();
  return /^[A-E]$/.test(letter) ? letter : null;
}

// ─── Place Value Verification ─────────────────────────────────────────

/**
 * Detect whether a question is asking about the VALUE of a specific digit
 * in a specific number — e.g. "What is the value of the digit 4 in 247,583?"
 *
 * Supports multiple phrasings the AI may use:
 *   - "value of digit X in N"
 *   - "place value of digit X in N"
 *   - "digit X worth in N" / "how much is digit X worth in N"
 *   - "digit X represent(s) in N" / "digit X contribute(s) in N"
 *   - "In N, ... digit X ... value/worth/represent"
 *
 * Returns { digit, number } if detected, or null otherwise.
 */
function detectPlaceValueQuestion(questionText: string): { digit: number; numberStr: string } | null {
  // Patterns where digit appears BEFORE the number: "digit X ... in N"
  const digitThenNumber: RegExp[] = [
    // "value of (the) digit X in (the number) N"
    /(?:place\s+)?value\s+of\s+(?:the\s+)?digit\s+(\d)\s+in\s+(?:the\s+number\s+)?([0-9,]+)/i,
    // "digit X is worth in N" / "digit X worth in N" (requires "in" to avoid matching claimed values)
    /digit\s+(\d)\s+(?:is\s+)?worth\s+in\s+(?:the\s+number\s+)?([0-9,]+)/i,
    // "how much ... digit X ... in/of N"
    /how\s+much[\s\S]{0,30}?digit\s+(\d)[\s\S]{0,30}?(?:in|of)\s+(?:the\s+number\s+)?([0-9,]+)/i,
    // "digit X represent(s)/contribute(s) ... in/to N"
    /digit\s+(\d)[\s\S]{0,30}?(?:represents?|contributes?)[\s\S]{0,15}?(?:in|to)\s+(?:the\s+(?:number|total|value)\s+(?:of\s+)?)?([0-9,]+)/i,
  ];

  for (const pattern of digitThenNumber) {
    const match = questionText.match(pattern);
    if (match) {
      const digit = parseInt(match[1], 10);
      const numberStr = match[2].replace(/,/g, "");
      if (!isNaN(digit) && numberStr.length >= 3 && !isNaN(parseInt(numberStr, 10))) {
        return { digit, numberStr };
      }
    }
  }

  // Patterns where number appears BEFORE the digit: "In N, ... digit X ..."
  const numberThenDigit: RegExp[] = [
    // "In (the number) N, ... (value|worth|represent) ... digit X"
    /in\s+(?:the\s+number\s+)?([0-9,]+)[\s\S]{0,60}?(?:value|worth|represents?|contributes?)[\s\S]{0,30}?(?:the\s+)?digit\s+(\d)/i,
    // "In (the number) N, ... digit X ... (value|worth|represent)"
    /in\s+(?:the\s+number\s+)?([0-9,]+)[\s\S]{0,60}?(?:the\s+)?digit\s+(\d)[\s\S]{0,30}?(?:value|worth|represents?|contributes?)/i,
  ];

  for (const pattern of numberThenDigit) {
    const match = questionText.match(pattern);
    if (match) {
      const numberStr = match[1].replace(/,/g, "");
      const digit = parseInt(match[2], 10);
      if (!isNaN(digit) && numberStr.length >= 3 && !isNaN(parseInt(numberStr, 10))) {
        return { digit, numberStr };
      }
    }
  }

  return null;
}

/**
 * Given a number and a target digit, compute ALL possible place values for
 * every occurrence of that digit. For example, in "424583" the digit 4 appears
 * at positions 0 and 2, giving values [400000, 400].
 *
 * Returns an empty array if the digit doesn't appear in the number.
 */
function computeAllPlaceValues(numberStr: string, digit: number): number[] {
  const values: number[] = [];
  const d = String(digit);
  for (let i = 0; i < numberStr.length; i++) {
    if (numberStr[i] === d) {
      const posFromRight = numberStr.length - 1 - i;
      values.push(digit * Math.pow(10, posFromRight));
    }
  }
  return values;
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

  const expectedValues = computeAllPlaceValues(detected.numberStr, detected.digit);
  if (expectedValues.length === 0) return undefined; // digit not found — can't verify

  // Check if the AI's marked answer matches ANY valid occurrence of the digit
  const correctNorm = normalizeChoiceValue(correctAnswer);
  const correctNum = Number(correctNorm);
  if (!isNaN(correctNum) && expectedValues.some(v => Math.abs(correctNum - v) < NUMERIC_EPSILON)) {
    return undefined; // AI got it right — no correction needed
  }

  // AI's answer doesn't match any valid place value for this digit.
  // Look for a valid value among the choices for auto-correction.
  const validChoices = choices.filter(choice => {
    const num = Number(normalizeChoiceValue(choice));
    return !isNaN(num) && expectedValues.some(v => Math.abs(num - v) < NUMERIC_EPSILON);
  });

  if (validChoices.length === 1) {
    parseWarn({
      parser: "verifyPlaceValueAnswer",
      field: "correctAnswer",
      fallback: `AUTO-CORRECTED to "${validChoices[0]}"`,
      rawSnippet: `AI said "${correctAnswer}" but digit ${detected.digit} in ${detected.numberStr} has valid values ${expectedValues.join(", ")}`,
    });
    return validChoices[0];
  }

  if (validChoices.length > 1) {
    // Multiple choices are valid place values (ambiguous digit) — can't auto-correct reliably
    return undefined;
  }

  // No valid place value among choices — reject
  parseWarn({
    parser: "verifyPlaceValueAnswer",
    field: "correctAnswer",
    fallback: "REJECTED",
    rawSnippet: `Expected one of ${expectedValues.join(", ")} for digit ${detected.digit} in ${detected.numberStr}, not found in choices`,
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
    const actuals = computeAllPlaceValues(numStr, digit);
    if (actuals.length === 0) return null;
    return actuals.includes(claimed);
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

// ─── Choice-Level Place Value Claim Verification ─────────────────────

/**
 * Verify a single choice for embedded place value claims against a known number.
 *
 * Checks two families of claim:
 *   (a) Place-name claims: "the 7 is in the hundreds place"
 *   (b) Value claims:      "worth 700", "represents 7,000", "value of 70"
 *
 * Returns true if ALL verifiable claims in the choice are correct,
 * false if ANY verifiable claim is wrong, or null if no claims were parseable.
 */
function verifyChoicePlaceValueClaims(
  choiceText: string,
  contextNumberStr: string,
): boolean | null {
  const stripped = choiceText.replace(/^[A-Ea-e]\)\s*/, "").trim();
  let verified = 0;
  let allCorrect = true;

  // (a) "[digit] is in the [place] place" / "has a [digit] in the [place] place"
  const placePatterns = [
    /\b(\d)\s+is\s+in\s+the\s+([\w\s-]+?)\s*place/gi,
    /has\s+(?:a|an)\s+(\d)\s+in\s+the\s+([\w\s-]+?)\s*place/gi,
  ];
  for (const pp of placePatterns) {
    pp.lastIndex = 0;
    let pm;
    while ((pm = pp.exec(stripped)) !== null) {
      const claimedDigit = parseInt(pm[1], 10);
      const actual = getDigitAtPlace(contextNumberStr, pm[2]);
      if (actual !== null) {
        verified++;
        if (actual !== claimedDigit) allCorrect = false;
      }
    }
  }

  // (b) "worth/represents/value of/value is/valued at [NUMBER]"
  //     Must be preceded by a digit reference so we know WHICH digit's value to check.
  //     Pattern: "digit D ... worth V" or "the D ... worth V" or "D is worth V"
  const valuePatterns = [
    // "the 7 is worth 700", "digit 7 is worth 700"
    /(?:the\s+)?(?:digit\s+)?(\d)\s+(?:\w+\s+){0,4}?(?:is\s+worth|worth|represents?|has\s+a\s+value\s+of|valued?\s+at|value\s+(?:of|is))\s+\$?\s*([0-9,]+)/gi,
  ];
  for (const vp of valuePatterns) {
    vp.lastIndex = 0;
    let vm;
    while ((vm = vp.exec(stripped)) !== null) {
      const digit = parseInt(vm[1], 10);
      const claimedValue = parseInt(vm[2].replace(/,/g, ""), 10);
      const actuals = computeAllPlaceValues(contextNumberStr, digit);
      if (actuals.length > 0 && !isNaN(claimedValue)) {
        verified++;
        if (!actuals.includes(claimedValue)) allCorrect = false;
      }
    }
  }

  if (verified === 0) return null; // no parseable claims
  return allCorrect;
}

/**
 * Format-agnostic place value verifier that examines claims WITHIN each choice.
 *
 * Works for any question format — direct, word problem, "Is X correct?", etc. —
 * as long as the choices contain verifiable place value claims and the question
 * text mentions a multi-digit number.
 *
 * Returns:
 *   undefined — choices don't contain verifiable place value claims (no opinion)
 *   null      — should reject (no correct choice, or ambiguous)
 *   string    — the corrected correct-answer choice
 */
export function verifyPlaceValueChoiceClaims(
  questionText: string,
  choices: string[],
  correctAnswer: string,
): string | null | undefined {
  // Extract comma-formatted numbers from the question (e.g., 492,736 or 1,000)
  const numberMatches = questionText.match(/\b\d{1,3}(?:,\d{3})+\b/g);
  if (!numberMatches || numberMatches.length === 0) return undefined;

  // Sort longest-first: the biggest number is almost always the primary one
  // in a place value question (e.g., 492,736 before a claimed value like 7,000).
  const sorted = [...numberMatches].sort((a, b) => b.length - a.length);

  // Try each context number — usually there's one primary number
  // We pick the first number whose digits produce verifiable claims in the choices
  for (const numMatch of sorted) {
    const numStr = numMatch.replace(/,/g, "");

    const results: { choice: string; correct: boolean | null }[] = choices.map(
      (choice) => ({
        choice,
        correct: verifyChoicePlaceValueClaims(choice, numStr),
      })
    );

    const verifiedCount = results.filter((r) => r.correct !== null).length;
    if (verifiedCount < 2) continue; // not enough signal from this number

    const trueChoices = results.filter((r) => r.correct === true);
    const falseChoices = results.filter((r) => r.correct === false);

    // Check if AI's answer is among the mathematically correct choices
    if (trueChoices.some((r) => r.choice === correctAnswer)) {
      return undefined; // AI got it right
    }

    // AI's answer has false claims — try to auto-correct
    if (trueChoices.length === 1) {
      parseWarn({
        parser: "verifyPlaceValueChoiceClaims",
        field: "correctAnswer",
        fallback: `AUTO-CORRECTED to "${trueChoices[0].choice}"`,
        rawSnippet: `AI said "${correctAnswer}" but choice claims don't match number ${numStr}. ${falseChoices.length} choices have false claims.`,
      });
      return trueChoices[0].choice;
    }

    // Zero or multiple "correct" choices — reject
    if (trueChoices.length === 0) {
      parseWarn({
        parser: "verifyPlaceValueChoiceClaims",
        field: "correctAnswer",
        fallback: "REJECTED",
        rawSnippet: `No choice has all-correct place value claims for number ${numStr}`,
      });
      return null;
    }

    // Multiple true choices — ambiguous, reject
    parseWarn({
      parser: "verifyPlaceValueChoiceClaims",
      field: "correctAnswer",
      fallback: "REJECTED",
      rawSnippet: `${trueChoices.length} choices have correct claims for number ${numStr}: ${trueChoices.map((r) => r.choice).join(" | ")}`,
    });
    return null;
  }

  return undefined; // no context number produced enough verifiable claims
}

// ─── "Which person is correct" Verification ──────────────────────────

interface CharacterClaim {
  name: string;
  text: string;
}

/**
 * Extract character claims from question text.
 * Matches patterns like:
 *   Alex says "The digit 6 is in the hundreds place"
 *   His dad says "2,649 is bigger than 2,694"
 * Captures the last word before "says" as the character identifier.
 * Handles straight quotes, curly quotes, and single quotes.
 */
function extractCharacterClaims(questionText: string): CharacterClaim[] {
  const claims: CharacterClaim[] = [];
  const seen = new Set<string>();

  // Capture the word immediately before "says" + quoted claim
  // This handles both "Alex says" and "His dad says" (captures "dad")
  const patterns = [
    /(\b[A-Za-z]\w+)\s+says\s*["\u201C](.+?)["\u201D]/g,
    /(\b[A-Za-z]\w+)\s+says\s*['\u2018](.+?)['\u2019]/g,
  ];

  const skipWords = new Set(["he", "she", "it", "that", "this", "who", "the", "also", "then"]);

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(questionText)) !== null) {
      const name = match[1];
      const text = match[2].trim();
      const key = name.toLowerCase();
      if (skipWords.has(key)) continue;
      if (!seen.has(key)) {
        seen.add(key);
        claims.push({ name, text });
      }
    }
  }

  return claims;
}

/**
 * Evaluate a math claim that may include place value, odd/even, or comparison.
 * Claims may reference the context number implicitly (e.g., "The digit 6 is in
 * the hundreds place" without mentioning the number — the number comes from the
 * question context).
 *
 * Returns true/false if verifiable, null if not parseable.
 */
function evaluateMathClaim(claim: string, contextNumbers: string[]): boolean | null {
  // First try the existing statement verifier (handles claims WITH embedded numbers)
  const stmtResult = verifyNumberStatement(claim, contextNumbers);
  if (stmtResult !== null) return stmtResult;

  // Resolve the primary context number (largest = most likely the subject)
  const sortedCtx = [...contextNumbers].sort((a, b) =>
    b.replace(/,/g, "").length - a.replace(/,/g, "").length
  );
  const primaryNumStr = sortedCtx.length > 0 ? sortedCtx[0].replace(/,/g, "") : null;

  // ── Place value claims with IMPLICIT number (from context) ──

  // "The digit D is in the PLACE place" (no number in claim)
  const digitInPlaceImplicit = claim.match(/(?:the\s+)?digit\s+(\d)\s+is\s+in\s+the\s+([\w\s-]+?)\s*place/i);
  if (digitInPlaceImplicit && primaryNumStr) {
    const digit = parseInt(digitInPlaceImplicit[1], 10);
    const actual = getDigitAtPlace(primaryNumStr, digitInPlaceImplicit[2]);
    if (actual !== null) return actual === digit;
  }

  // "digit D ... worth/represents/value V" (no number in claim)
  const worthImplicit = claim.match(/(?:the\s+)?digit\s+(\d).*?(?:worth|represents?|value\s+(?:of|is)|valued?\s+at)\s+\$?\s*(\d[\d,]*)/i);
  if (worthImplicit && primaryNumStr) {
    const digit = parseInt(worthImplicit[1], 10);
    const claimedValue = parseInt(worthImplicit[2].replace(/,/g, ""), 10);
    const actuals = computeAllPlaceValues(primaryNumStr, digit);
    if (actuals.length > 0 && !isNaN(claimedValue)) return actuals.includes(claimedValue);
  }

  // ── Odd/even claims ──

  // "2,649 is odd" / "the number is even" (explicit number)
  const oddEvenMatch = claim.match(/\b(\d[\d,]*)\s+is\s+(odd|even)\b/i);
  if (oddEvenMatch) {
    const num = parseInt(oddEvenMatch[1].replace(/,/g, ""), 10);
    if (isNaN(num)) return null;
    const isOdd = num % 2 !== 0;
    return oddEvenMatch[2].toLowerCase() === "odd" ? isOdd : !isOdd;
  }

  // "add 1 it will be even/odd" (context number)
  const addOneMatch = claim.match(/add\s+1.*(?:will\s+be|becomes?|is)\s+(odd|even)/i);
  if (addOneMatch && primaryNumStr) {
    const num = parseInt(primaryNumStr, 10);
    if (isNaN(num)) return null;
    const plusOne = num + 1;
    const isOdd = plusOne % 2 !== 0;
    return addOneMatch[1].toLowerCase() === "odd" ? isOdd : !isOdd;
  }

  // ── Comparison claims ──

  // "2,649 is bigger/larger/greater than 2,694"
  const greaterMatch = claim.match(/(\d[\d,]*)\s+is\s+(?:bigger|larger|greater|more)\s+than\s+(\d[\d,]*)/i);
  if (greaterMatch) {
    const a = parseInt(greaterMatch[1].replace(/,/g, ""), 10);
    const b = parseInt(greaterMatch[2].replace(/,/g, ""), 10);
    if (isNaN(a) || isNaN(b)) return null;
    return a > b;
  }

  const lessMatch = claim.match(/(\d[\d,]*)\s+is\s+(?:smaller|less|fewer)\s+than\s+(\d[\d,]*)/i);
  if (lessMatch) {
    const a = parseInt(lessMatch[1].replace(/,/g, ""), 10);
    const b = parseInt(lessMatch[2].replace(/,/g, ""), 10);
    if (isNaN(a) || isNaN(b)) return null;
    return a < b;
  }

  return null;
}

/**
 * Parse a choice to determine which character names it claims are correct.
 * Returns a Set of lowercase names, or null if unparseable.
 */
function parsePersonChoice(choiceText: string, allNames: string[]): Set<string> | null {
  const text = choiceText.replace(/^[A-Ea-e]\)\s*/, "").toLowerCase();

  // "none" patterns
  if (/\bnone\b|\bno\s*one\b|\bnobody\b/.test(text)) return new Set<string>();

  // "all" patterns
  if (/\ball\s+(three|of\s+them|are)\b/.test(text)) {
    return new Set(allNames.map(n => n.toLowerCase()));
  }

  // Find which names appear in this choice
  const found = allNames.filter(name => text.includes(name.toLowerCase()));
  if (found.length === 0) return null;

  return new Set(found.map(n => n.toLowerCase()));
}

/**
 * Verify "which person is correct" type questions where claims are embedded
 * in the question text as character dialogue, not in the choices.
 *
 * Returns:
 *   undefined — not a "which person" question or can't verify
 *   null      — should reject (verified claims don't match any choice)
 *   string    — the corrected correct-answer choice
 */
export function verifyPersonQuestion(
  questionText: string,
  choices: string[],
  correctAnswer: string,
): string | null | undefined {
  // Detect "which person/friend/one is correct/right" or "who is correct"
  if (!/which\s+(?:person|friend|one)|who\s+is\s+(?:correct|right)|who\s+(?:is|made)|person\s+is\s+correct/i.test(questionText)) {
    return undefined;
  }

  // Extract character claims from question text
  const claims = extractCharacterClaims(questionText);
  if (claims.length < 2) return undefined; // need at least 2 characters

  // Extract context numbers from the question text
  const contextNumbers = questionText.match(/\b\d{2,}(?:,\d{3})*\b/g) ?? [];

  // Evaluate each character's claim
  const results: { name: string; correct: boolean | null }[] = claims.map(claim => ({
    name: claim.name,
    correct: evaluateMathClaim(claim.text, contextNumbers),
  }));

  // Need enough verifiable claims to be confident
  const verifiedCount = results.filter(r => r.correct !== null).length;
  if (verifiedCount < 2) return undefined;

  // Determine which characters are correct
  const correctNames = new Set(
    results.filter(r => r.correct === true).map(r => r.name.toLowerCase())
  );
  const allNames = claims.map(c => c.name);

  // Find the choice that matches the correct set of characters
  let matchingChoice: string | null = null;
  for (const choice of choices) {
    const implied = parsePersonChoice(choice, allNames);
    if (implied === null) continue;
    // Check set equality
    if (implied.size === correctNames.size && [...implied].every(n => correctNames.has(n))) {
      matchingChoice = choice;
      break;
    }
  }

  if (!matchingChoice) {
    // Can't map verified results to any choice — reject to be safe
    parseWarn({
      parser: "verifyPersonQuestion",
      field: "correctAnswer",
      fallback: "REJECTED",
      rawSnippet: `Verified ${verifiedCount} claims (correct: ${[...correctNames].join(", ")}), but no choice matches that combination`,
    });
    return null;
  }

  // Check if AI already got it right
  if (matchingChoice === correctAnswer) return undefined;

  // Auto-correct
  parseWarn({
    parser: "verifyPersonQuestion",
    field: "correctAnswer",
    fallback: `AUTO-CORRECTED to "${matchingChoice}"`,
    rawSnippet: `AI said "${correctAnswer}" but verified claims show correct characters: ${[...correctNames].join(", ")}`,
  });
  return matchingChoice;
}

// ─── Safety Net: Reject Unverifiable Place Value Questions ───────────

/**
 * Detect whether a question involves place value concepts based on keywords.
 * Used as a safety net: if a question looks like place value but no verifier
 * could evaluate it, we reject it rather than risk serving a wrong answer.
 */
function looksLikePlaceValueQuestion(questionText: string, choices: string[]): boolean {
  const allText = questionText + " " + choices.join(" ");
  // Must mention a multi-digit number (3+ digits)
  if (!/\b\d{3,}(?:,\d{3})*\b/.test(questionText)) return false;
  // Must mention place-value-related terms
  return /\b(?:digit|place\s+value|hundreds?|thousands?|ten[\s-]thousands?|hundred[\s-]thousands?|ones\s+place|tens\s+place|represents?\s+\d|worth\s+\d)/i.test(allText);
}

/**
 * Quick check: do at least 2 choices contain place-value claim patterns?
 * Used by the safety net to determine if verifyPlaceValueChoiceClaims
 * would have recognized (and therefore verified) this question format.
 */
function choicesContainPVClaimPatterns(questionText: string, choices: string[]): boolean {
  // Need a multi-digit number in the question
  if (!/\b\d{1,3}(?:,\d{3})+\b/.test(questionText)) return false;
  let count = 0;
  for (const choice of choices) {
    const text = choice.replace(/^[A-Ea-e]\)\s*/, "");
    if (
      /\b\d\s+is\s+in\s+the\s+[\w\s-]+place/i.test(text) ||
      /has\s+(?:a|an)\s+\d\s+in\s+the\s+/i.test(text) ||
      /(?:worth|represents?|value\s+of)\s+\$?\d/i.test(text)
    ) {
      count++;
    }
  }
  return count >= 2;
}

// ─── Centralized Validation Gateway ──────────────────────────────────

/**
 * Single chokepoint that ALL generated questions must pass through before
 * reaching a student.  Composes every verifier in the correct order:
 *
 *   1. Format / distinctness  (isValidQuestion)
 *   2. Direct place-value     (verifyPlaceValueAnswer — "value of digit X in N")
 *   3. Choice-level claims    (verifyPlaceValueChoiceClaims — word problems, etc.)
 *   4. "Which person" claims  (verifyPersonQuestion — character dialogue in question)
 *   5. Statement questions    (verifyStatementQuestion — "which statement is correct")
 *   6. Safety net             (reject unverifiable place value questions)
 *
 * Returns the (possibly auto-corrected) correctAnswer string if the question
 * is safe to serve, or null if it should be rejected.
 */
export function validateGeneratedQuestion(
  questionText: string,
  choices: string[],
  correctAnswer: string,
  parser: string,
  seedCorrectValue?: number,
): string | null {
  // 1. Format: enough choices, all distinct, valid letter
  if (!isValidQuestion(choices, correctAnswer, parser)) return null;

  let verified = correctAnswer;

  // 2. Direct place-value verification (narrow regex: "value of digit X in N")
  const pvDirect = verifyPlaceValueAnswer(questionText, choices, correctAnswer);
  if (pvDirect === null) return null;
  if (pvDirect !== undefined) verified = pvDirect;

  // 3. Choice-level place-value claim verification (word problems, "is X correct", etc.)
  //    Only needed when step 2 had no opinion (didn't recognise the format).
  if (pvDirect === undefined) {
    const pvClaims = verifyPlaceValueChoiceClaims(questionText, choices, verified);
    if (pvClaims === null) return null;
    if (pvClaims !== undefined) verified = pvClaims;
  }

  // 4. "Which person is correct" — claims embedded in question text as dialogue
  const personResult = verifyPersonQuestion(questionText, choices, verified);
  if (personResult === null) return null;
  if (personResult !== undefined) verified = personResult;

  // 5. "Which statement is correct" multi-truth guard
  if (verifyStatementQuestion(questionText, choices) === null) return null;

  // 6. Safety net: if question looks like place value but NO verifier could
  //    recognize its format, reject rather than risk serving a wrong answer.
  //    EXCEPTION: seeded questions have pre-computed correct answers — verify
  //    against the seed value directly instead of parsing English with regexes.
  if (looksLikePlaceValueQuestion(questionText, choices)) {
    // Seeded questions: the math was computed in code, not by the AI.
    // Verify the correct answer choice contains the seed's correct value.
    if (seedCorrectValue !== undefined) {
      const seedStr = seedCorrectValue.toLocaleString("en-US");
      const correctText = verified.replace(/^[A-Ea-e]\)\s*/, "").trim();
      if (!correctText.includes(seedStr)) {
        parseWarn({
          parser,
          field: "seed-mismatch",
          fallback: "REJECTED",
          rawSnippet: `Seeded correct value ${seedStr} not found in correct answer "${correctText}"`,
        });
        return null;
      }
      // Seed matches — question is correct by construction, skip regex format checks
      return verified;
    }

    const formatRecognized =
      // "value of digit X in N" — recognized by verifyPlaceValueAnswer
      detectPlaceValueQuestion(questionText) !== null ||
      // choices contain PV claim patterns — recognized by verifyPlaceValueChoiceClaims
      choicesContainPVClaimPatterns(questionText, choices) ||
      // "which person/who is correct" with extractable claims
      extractCharacterClaims(questionText).length >= 2 ||
      // "which statement is correct" — recognized by verifyStatementQuestion
      /which\s+statement/i.test(questionText);

    if (!formatRecognized) {
      parseWarn({
        parser,
        field: "unverifiable",
        fallback: "REJECTED",
        rawSnippet: `Question appears to involve place value but no verifier can check its format: "${questionText.slice(0, 120)}..."`,
      });
      return null;
    }
  }

  return verified;
}
