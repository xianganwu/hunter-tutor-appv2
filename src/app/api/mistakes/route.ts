import { NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";
import { MODEL_SONNET } from "@/lib/ai/tutor-agent";
import type { MistakeDiagnosis, MistakeCategory } from "@/lib/mistakes";
import { sanitizePromptInput } from "@/utils/sanitize-prompt";

// ─── Zod Schemas ──────────────────────────────────────────────────────

const MistakeActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("diagnose"),
    skillId: z.string().min(1).max(100),
    skillName: z.string().min(1).max(200),
    questionText: z.string().min(1).max(5000),
    studentAnswer: z.string().max(1000),
    correctAnswer: z.string().min(1).max(1000),
    answerChoices: z.array(z.string().max(500)).max(10),
  }),
  z.object({
    type: z.literal("analyze_patterns"),
    mistakes: z.array(z.object({
      skillName: z.string().max(200),
      questionText: z.string().max(5000),
      diagnosis: z.object({
        category: z.string().max(50),
        explanation: z.string().max(1000),
      }),
    })).max(50),
  }),
]);

const DIAGNOSIS_SYSTEM_TEXT = `You are a tutoring analytics assistant. When given a student's wrong answer, diagnose WHY they got it wrong. Categorize into exactly one of:
- conceptual_gap: The student doesn't understand the underlying concept
- careless_error: The student knows the concept but made a small computational or reading mistake
- misread_question: The student misunderstood what the question was asking

Be specific and brief. Write at a level a parent could understand.`;
const DIAGNOSIS_SYSTEM_CACHED = [{ type: "text" as const, text: DIAGNOSIS_SYSTEM_TEXT, cache_control: { type: "ephemeral" as const } }];

function parseDiagnosis(text: string, skillId: string): MistakeDiagnosis {
  const categoryMatch = text.match(
    /\b(conceptual_gap|careless_error|misread_question)\b/
  );
  const category: MistakeCategory =
    (categoryMatch?.[1] as MistakeCategory) ?? "conceptual_gap";

  // Strip the category label from explanation if present
  const explanation = text
    .replace(/^(CATEGORY|Category|TYPE|Type):\s*\S+\s*/i, "")
    .replace(/^(EXPLANATION|Explanation):\s*/i, "")
    .trim();

  return {
    category,
    explanation: explanation || text,
    relatedSkills: [skillId],
  };
}

export async function POST(
  request: Request
): Promise<NextResponse<{ diagnosis?: MistakeDiagnosis; analysis?: string; error?: string }>> {
  try {
    const raw = await request.json();
    const parsed = MistakeActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const body = parsed.data;

    switch (body.type) {
      case "diagnose": {
        const client = getAnthropicClient();
        const response = await client.messages.create({
          model: MODEL_SONNET,
          max_tokens: 256,
          system: DIAGNOSIS_SYSTEM_CACHED,
          messages: [
            {
              role: "user",
              content: `Skill: ${sanitizePromptInput(body.skillName, 200)} (${sanitizePromptInput(body.skillId, 100)})

Question: ${sanitizePromptInput(body.questionText, 5000)}

Answer choices:
${body.answerChoices.map((c) => sanitizePromptInput(c, 500)).join("\n")}

Student picked: ${sanitizePromptInput(body.studentAnswer, 1000)}
Correct answer: ${sanitizePromptInput(body.correctAnswer, 1000)}

First, state the category (conceptual_gap, careless_error, or misread_question).
Then explain in 1-2 sentences why the student likely chose their answer.`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        const diagnosis = parseDiagnosis(text, body.skillId);
        return NextResponse.json({ diagnosis });
      }

      case "analyze_patterns": {
        if (body.mistakes.length < 3) {
          return NextResponse.json({
            analysis:
              "Keep practicing! After a few more sessions, I'll be able to spot patterns in your mistakes.",
          });
        }

        const client = getAnthropicClient();
        const mistakeList = body.mistakes
          .slice(-20)
          .map(
            (m, i) =>
              `${i + 1}. Skill: ${sanitizePromptInput(m.skillName, 200)} | Category: ${sanitizePromptInput(m.diagnosis.category, 50)} | ${sanitizePromptInput(m.diagnosis.explanation, 500)}`
          )
          .join("\n");

        const response = await client.messages.create({
          model: MODEL_SONNET,
          max_tokens: 512,
          system: [{ type: "text" as const, text: `You are a tutoring analytics assistant analyzing a student's mistake patterns. The student may be a rising 5th grader or a 6th grader. Be specific, encouraging, and actionable. Write 2-3 short observations.`, cache_control: { type: "ephemeral" as const } }],
          messages: [
            {
              role: "user",
              content: `Here are the student's recent mistakes:\n\n${mistakeList}\n\nIdentify 2-3 patterns. For each, explain what the student tends to struggle with and give one concrete tip. Be encouraging — frame this as growth opportunities, not failures.`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        return NextResponse.json({ analysis: text });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action type" },
          { status: 400 }
        );
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Mistakes API error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
