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
