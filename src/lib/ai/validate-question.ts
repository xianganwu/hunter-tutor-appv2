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
export function normalizeChoiceValue(choice: string): string {
  // Strip leading letter+paren prefix: "A) 30%" → "30%"
  let s = choice.replace(/^[A-Ea-e]\)\s*/, "").trim().toLowerCase();
  // Remove currency symbols and commas: "$1,500" → "1500"
  s = s.replace(/[$,]/g, "");
  // Add leading zero: ".40" → "0.40"
  s = s.replace(/^\.(\d)/, "0.$1");
  // Remove trailing zeros after decimal: "0.40" → "0.4", "3.0" → "3"
  s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  // Normalize simple fractions to decimals for comparison
  const fractionMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    if (den !== 0) s = String(num / den);
  }
  // Normalize percentage to decimal: "50%" → "0.5"
  const pctMatch = s.match(/^(\d+(?:\.\d+)?)%$/);
  if (pctMatch) {
    s = String(parseFloat(pctMatch[1]) / 100);
  }
  // Collapse whitespace
  s = s.replace(/\s+/g, " ");
  return s;
}

// ─── Distinctness check ──────────────────────────────────────────────

/**
 * Check that all answer choices are distinct after normalizing.
 * Catches cases like "0.5" and "1/2" appearing as separate choices —
 * which would mean two choices are effectively "correct."
 */
export function hasDistinctChoices(choices: string[]): boolean {
  const normalized = choices.map((c) => normalizeChoiceValue(c));
  return new Set(normalized).size === normalized.length;
}

/**
 * Find which choices collide after normalization (for logging).
 * Returns pairs like [["A) 0.5", "C) 1/2"]] or [] if all distinct.
 */
export function findDuplicateChoices(choices: string[]): string[][] {
  const normalized = choices.map((c) => normalizeChoiceValue(c));
  const groups = new Map<string, string[]>();
  for (let i = 0; i < normalized.length; i++) {
    const key = normalized[i];
    const group = groups.get(key) ?? [];
    group.push(choices[i]);
    groups.set(key, group);
  }
  return [...groups.values()].filter((g) => g.length > 1);
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
