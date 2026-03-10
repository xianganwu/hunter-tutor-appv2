import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/ai/client";

// ─── Request Types ────────────────────────────────────────────────────

type ReadingAction =
  | {
      type: "generate_passage";
      targetWordCount: number;
      genre?: string;
      difficulty?: number;
    }
  | {
      type: "speed_feedback";
      currentWpm: number;
      averageWpm: number;
      dropPercent: number;
      passageWordCount: number;
      passageTitle: string;
    };

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
    const body = (await request.json()) as ReadingAction;
    const client = getAnthropicClient();

    switch (body.type) {
      case "generate_passage": {
        const genre = body.genre ?? "nonfiction";
        const difficulty = body.difficulty ?? 3;
        const target = body.targetWordCount;

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: `You are a reading passage author creating content for students building toward the Hunter College High School entrance exam. Students range from rising 5th graders (age 9-10) to 6th graders (age 11-12). Write engaging, age-appropriate passages that challenge reading comprehension without being frustrating. Calibrate vocabulary and sentence complexity to the difficulty level requested. Include rich detail that supports inference and analysis questions.`,
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
      "explanation": "Why this is correct..."
    }
  ]
}

Requirements:
- Passage must be ${target - 30} to ${target + 30} words
- Questions should test: main idea, inference, vocabulary in context, evidence, and author's purpose
- Each question has exactly 4 choices
- correctIndex is 0-based
- Age-appropriate content only`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        // Extract JSON from the response (handle potential markdown wrapping)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
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
        } catch {
          return NextResponse.json(
            { error: "Failed to parse generated passage" },
            { status: 500 }
          );
        }
      }

      case "speed_feedback": {
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system: `You are a warm, encouraging reading tutor. The student's reading speed has dropped on a longer passage. Your job is to normalize this, offer specific strategies, and ask an open-ended question to understand where they struggled. Be conversational and supportive — never make them feel bad about slowing down. Keep your response to 3-4 sentences.`,
          messages: [
            {
              role: "user",
              content: `The student just read "${body.passageTitle}" (${body.passageWordCount} words).

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
