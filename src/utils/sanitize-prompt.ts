/**
 * Sanitize user-provided text before interpolating into AI prompts.
 *
 * This does NOT attempt to detect prompt injection — that's a losing game.
 * Instead, it:
 *   1. Caps length to prevent excessively long payloads that waste tokens.
 *   2. Strips XML/HTML-like tags that could confuse structured prompts.
 *   3. Provides a helper to wrap user text in clear delimiters so the AI
 *      can distinguish user content from instructions.
 */

/** Maximum length of user-provided text in prompt context. */
const MAX_PROMPT_INPUT_LENGTH = 10000;

/**
 * Sanitize a user-provided string for safe interpolation into AI prompts.
 * - Trims whitespace
 * - Caps length at `maxLength` characters
 * - Strips XML/HTML-like tags (e.g., <system>, </instructions>)
 */
export function sanitizePromptInput(
  text: string,
  maxLength: number = MAX_PROMPT_INPUT_LENGTH
): string {
  let s = text.trim();
  if (s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  // Strip XML/HTML-like tags that could confuse structured prompts
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  return s;
}
