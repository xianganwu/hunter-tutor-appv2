/**
 * Structured logging for AI response parsing failures.
 *
 * Every silent fallback in the codebase should call one of these helpers
 * so that bad-default paths are visible in server logs instead of invisible.
 */

type Severity = "warn" | "error";

interface ParseEvent {
  /** Short tag identifying the parser, e.g. "parseEssayFeedback" */
  parser: string;
  /** What specifically failed */
  field: string;
  /** The value that was used instead */
  fallback: unknown;
  /** Optional: raw text that was being parsed (truncated for logs) */
  rawSnippet?: string;
}

function truncate(s: string, max = 200): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatEvent(severity: Severity, ev: ParseEvent): string {
  const tag = `[parse-${severity}]`;
  const snippet = ev.rawSnippet
    ? ` | raw: "${truncate(ev.rawSnippet)}"`
    : "";
  return `${tag} ${ev.parser}.${ev.field} → fallback=${JSON.stringify(ev.fallback)}${snippet}`;
}

/**
 * Log a non-critical parse fallback (e.g. score defaulted to 5).
 * These indicate the AI response was slightly malformed but the app can continue.
 */
export function parseWarn(ev: ParseEvent): void {
  console.warn(formatEvent("warn", ev));
}

/**
 * Log a critical parse failure (e.g. correct answer defaulted to "A",
 * entire JSON failed to parse, etc.).
 * These indicate the response was badly malformed and the result is unreliable.
 */
export function parseError(ev: ParseEvent): void {
  console.error(formatEvent("error", ev));
}
