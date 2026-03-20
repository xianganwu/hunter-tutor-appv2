import { getAnthropicClient } from "./client";
import { MODEL_HAIKU } from "./tutor-agent";

// ─── Types ────────────────────────────────────────────────────────────

/** Minimal question shape accepted by the verifier. */
export interface VerifiableQuestion {
  questionText: string;
  answerChoices: string[] | readonly string[];
  correctAnswer: string;
}

// ─── Constants ────────────────────────────────────────────────────────

/** Max questions per verification call to stay within token limits. */
const VERIFY_BATCH_SIZE = 10;

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Verify and fix answer keys for a batch of generated questions.
 *
 * Uses a fast model (Haiku) to independently solve each question and
 * correct any mismatched correctAnswer values. Returns the same array
 * with corrected answers where needed.
 *
 * Gracefully returns the original questions on any verification error.
 */
export async function verifyQuestionAnswers<T extends VerifiableQuestion>(
  questions: T[]
): Promise<T[]> {
  if (questions.length === 0) return questions;

  const results: T[] = [];

  for (let i = 0; i < questions.length; i += VERIFY_BATCH_SIZE) {
    const batch = questions.slice(i, i + VERIFY_BATCH_SIZE);
    const verified = await verifyBatch(batch);
    results.push(...verified);
  }

  return results;
}

// ─── Internal ─────────────────────────────────────────────────────────

async function verifyBatch<T extends VerifiableQuestion>(
  questions: T[]
): Promise<T[]> {
  const questionsText = questions.map((q, idx) => {
    const choices = Array.isArray(q.answerChoices)
      ? q.answerChoices
      : [...q.answerChoices];

    // Normalize choices — they may be "A) text" format or just "text"
    const formattedChoices = choices
      .map((c, i) => {
        const letter = String.fromCharCode(65 + i); // A, B, C, D, E
        return c.match(/^[A-E]\)/) ? `  ${c}` : `  ${letter}) ${c}`;
      })
      .join("\n");

    // Extract just the letter from correctAnswer (might be "A) text" or just "A")
    const correctLetter = q.correctAnswer.trim().charAt(0).toUpperCase();

    return `QUESTION ${idx + 1}:\n${q.questionText}\n${formattedChoices}\nStated correct answer: ${correctLetter}`;
  });

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 2048,
      system:
        "You are a math answer verifier. For each question, determine the ACTUALLY correct answer by solving it yourself. Respond with ONLY a JSON array of objects, one per question, in order. Each object: {\"question\": <1-based index>, \"verified_answer\": \"<letter A-E>\", \"matches\": <true if stated answer is correct, false if wrong>}. No explanation, no markdown fences.",
      messages: [
        {
          role: "user",
          content: `Verify the correct answer for each question below. Solve each one yourself and check if the stated answer is right.\n\n${questionsText.join("\n\n")}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return questions;

    const verifications = JSON.parse(jsonMatch[0]) as {
      question: number;
      verified_answer: string;
      matches: boolean;
    }[];

    return questions.map((q, idx) => {
      const v = verifications.find((v) => v.question === idx + 1);
      if (!v || v.matches) return q;

      const verifiedLetter = v.verified_answer?.trim().charAt(0).toUpperCase();
      if (!/^[A-E]$/.test(verifiedLetter)) return q;

      // Reconstruct correctAnswer in the same format as the original
      const originalFormat = q.correctAnswer.trim();
      const isFullFormat = originalFormat.match(/^[A-E]\)/); // "A) text" format

      let fixedAnswer: string;
      if (isFullFormat) {
        // Find the matching answer choice text
        const choices = Array.isArray(q.answerChoices)
          ? q.answerChoices
          : [...q.answerChoices];
        const matchIdx = verifiedLetter.charCodeAt(0) - 65;
        const matchingChoice = choices[matchIdx];
        fixedAnswer = matchingChoice?.match(/^[A-E]\)/)
          ? matchingChoice
          : `${verifiedLetter}) ${matchingChoice ?? ""}`;
      } else {
        // Just a letter
        fixedAnswer = verifiedLetter;
      }

      console.warn(
        `[verify-answers] Corrected "${q.questionText.slice(0, 60)}..." from ${originalFormat.charAt(0)} → ${verifiedLetter}`
      );

      return { ...q, correctAnswer: fixedAnswer };
    });
  } catch (err) {
    console.error("[verify-answers] Verification failed, using originals:", err);
    return questions;
  }
}
