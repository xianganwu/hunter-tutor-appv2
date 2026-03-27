import { NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";
import { MODEL_SONNET, MODEL_HAIKU } from "@/lib/ai/tutor-agent";
import { parseError } from "@/lib/ai/parse-logger";
import { sanitizePromptInput } from "@/utils/sanitize-prompt";

// ─── Zod Schemas ──────────────────────────────────────────────────────

const ReadingActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("generate_passage"),
    targetWordCount: z.number().int().min(50).max(2000),
    genre: z.string().min(1).max(100).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    type: z.literal("speed_feedback"),
    currentWpm: z.number().min(0).max(10000),
    averageWpm: z.number().min(0).max(10000),
    dropPercent: z.number().min(0).max(100),
    passageWordCount: z.number().int().min(1).max(10000),
    passageTitle: z.string().min(1).max(500),
  }),
]);

// ─── Response Types ───────────────────────────────────────────────────

interface GeneratedPassageResponse {
  readonly title: string;
  readonly passageText: string;
  readonly wordCount: number;
  readonly preReadingContext: string;
  readonly questions: readonly GeneratedQuestion[];
}

interface GeneratedQuestion {
  readonly questionText: string;
  readonly choices: readonly string[];
  readonly correctIndex: number;
  readonly explanation: string;
  readonly skillTested?: string;
}

interface ReadingApiResponse {
  readonly text: string;
  readonly passage?: GeneratedPassageResponse;
}

// ─── Handler ──────────────────────────────────────────────────────────

export async function POST(
  request: Request
): Promise<NextResponse<ReadingApiResponse | { error: string }>> {
  try {
    const raw = await request.json();
    const parsed = ReadingActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const body = parsed.data;
    const client = getAnthropicClient();

    switch (body.type) {
      case "generate_passage": {
        const genre = sanitizePromptInput(body.genre ?? "nonfiction", 100);
        const difficulty = body.difficulty ?? 3;
        const target = body.targetWordCount;

        const response = await client.messages.create({
          model: MODEL_SONNET,
          max_tokens: 4096,
          system: [{ type: "text" as const, text: `You are a reading passage author creating content for students building toward the Hunter College High School entrance exam. Students range from rising 5th graders (age 9-10) to 6th graders (age 11-12). Write engaging, age-appropriate passages that challenge reading comprehension without being frustrating. Calibrate vocabulary and sentence complexity to the difficulty level requested. Include rich detail that supports inference and analysis questions.`, cache_control: { type: "ephemeral" as const } }],
          messages: [
            {
              role: "user",
              content: `Write a ${genre} reading passage of approximately ${target} words at difficulty level ${difficulty}/5. ${difficulty <= 2 ? "Target a 4th-5th grade reading level with concrete, relatable topics." : "Target a 6th grade reading level appropriate for Hunter exam prep."} Then create 5 multiple-choice comprehension questions.

Respond in this EXACT JSON format (no markdown, just raw JSON):

{
  "title": "Passage Title",
  "preReadingContext": "One sentence setting up the reading.",
  "passageText": "The full passage text here...",
  "wordCount": ${target},
  "questions": [
    {
      "questionText": "What is the main idea?",
      "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctIndex": 0,
      "explanation": "Why this is correct...",
      "skillTested": "rc_main_idea"
    }
  ]
}

Requirements:
- Passage must be ${target - 30} to ${target + 30} words
- Questions should test: main idea, inference, vocabulary in context, evidence, and author's purpose
- Each question has exactly 4 choices
- correctIndex is 0-based
- Each question must include a skillTested field with one of: rc_main_idea, rc_inference, rc_vocab_context, rc_evidence_reasoning, rc_author_purpose
- Age-appropriate content only`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        // Extract JSON from the response (handle potential markdown wrapping)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          parseError({ parser: "reading/generate_passage", field: "JSON", fallback: "error response", rawSnippet: text });
          return NextResponse.json(
            { error: "Failed to generate passage" },
            { status: 500 }
          );
        }

        try {
          const parsed = JSON.parse(jsonMatch[0]) as GeneratedPassageResponse;
          return NextResponse.json({
            text: parsed.title,
            passage: parsed,
          });
        } catch (err) {
          parseError({ parser: "reading/generate_passage", field: "JSON", fallback: "error response (parse exception)", rawSnippet: text });
          console.error("[reading] generate_passage JSON parse error:", err);
          return NextResponse.json(
            { error: "Failed to parse generated passage" },
            { status: 500 }
          );
        }
      }

      case "speed_feedback": {
        const response = await client.messages.create({
          model: MODEL_HAIKU,
          max_tokens: 512,
          system: [{ type: "text" as const, text: `You are a warm, encouraging reading tutor. The student's reading speed has dropped on a longer passage. Your job is to normalize this, offer specific strategies, and ask an open-ended question to understand where they struggled. Be conversational and supportive — never make them feel bad about slowing down. Keep your response to 3-4 sentences.`, cache_control: { type: "ephemeral" as const } }],
          messages: [
            {
              role: "user",
              content: `The student just read "${sanitizePromptInput(body.passageTitle, 500)}" (${body.passageWordCount} words).

Their speed was ${body.currentWpm} WPM, compared to their average of ${body.averageWpm} WPM — a ${body.dropPercent}% drop.

Provide supportive feedback about the speed drop and ask what part was hardest. Start with: "I notice this longer passage took more time."`,
            },
          ],
        });

        const feedbackText =
          response.content[0].type === "text" ? response.content[0].text : "";

        return NextResponse.json({ text: feedbackText });
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
    console.error("Reading API error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
