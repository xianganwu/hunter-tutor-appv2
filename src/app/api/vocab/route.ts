import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/ai/client";
import { MODEL_HAIKU, MODEL_SONNET } from "@/lib/ai/tutor-agent";

// ─── Request Types ────────────────────────────────────────────────────

type VocabAction =
  | {
      type: "generate_context";
      word: string;
      definition: string;
      partOfSpeech: string;
    }
  | {
      type: "evaluate_usage";
      word: string;
      definition: string;
      studentSentence: string;
    }
  | {
      type: "extract_vocab";
      passageText: string;
    };

// ─── Response Types ───────────────────────────────────────────────────

interface GenerateContextResponse {
  readonly sentences: readonly string[];
}

interface EvaluateUsageResponse {
  readonly correct: boolean;
  readonly feedback: string;
}

interface ExtractedWord {
  readonly word: string;
  readonly definition: string;
  readonly partOfSpeech: string;
}

interface ExtractVocabResponse {
  readonly words: readonly ExtractedWord[];
}

type VocabApiResponse =
  | GenerateContextResponse
  | EvaluateUsageResponse
  | ExtractVocabResponse;

// ─── Handler ──────────────────────────────────────────────────────────

export async function POST(
  request: Request
): Promise<NextResponse<VocabApiResponse | { error: string }>> {
  try {
    const body = (await request.json()) as VocabAction;
    const client = getAnthropicClient();

    switch (body.type) {
      case "generate_context": {
        const response = await client.messages.create({
          model: MODEL_HAIKU,
          max_tokens: 512,
          system: [{ type: "text" as const, text: "You are a vocabulary tutor for students preparing for the Hunter College High School entrance exam. Students are ages 9-12. Generate clear, age-appropriate example sentences that demonstrate the word's meaning in context. Make each sentence showcase a different usage or context for the word.", cache_control: { type: "ephemeral" as const } }],
          messages: [
            {
              role: "user",
              content: `Generate exactly 3 example sentences for the word "${body.word}" (${body.partOfSpeech}: ${body.definition}). Each sentence should use the word in a different context to help a student understand its meaning.

Respond in this EXACT JSON format (no markdown, just raw JSON):

{
  "sentences": [
    "First example sentence using the word.",
    "Second example sentence in a different context.",
    "Third example sentence showing another usage."
  ]
}

Requirements:
- Each sentence should be 10-20 words
- Use age-appropriate language (grades 4-6)
- Each sentence should highlight a different aspect of the word's meaning
- The word must appear in each sentence`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return NextResponse.json(
            { error: "Failed to generate context sentences" },
            { status: 500 }
          );
        }

        try {
          const parsed = JSON.parse(jsonMatch[0]) as GenerateContextResponse;
          return NextResponse.json(parsed);
        } catch {
          return NextResponse.json(
            { error: "Failed to parse generated sentences" },
            { status: 500 }
          );
        }
      }

      case "evaluate_usage": {
        const response = await client.messages.create({
          model: MODEL_HAIKU,
          max_tokens: 256,
          system: [{ type: "text" as const, text: "You are a warm, encouraging vocabulary tutor for students ages 9-12 preparing for the Hunter College High School entrance exam. Evaluate whether the student used the vocabulary word correctly in their sentence. Be supportive — celebrate correct usage and gently guide incorrect usage. Never say 'wrong' — instead, help them understand how to improve.", cache_control: { type: "ephemeral" as const } }],
          messages: [
            {
              role: "user",
              content: `The student is practicing the word "${body.word}" (definition: ${body.definition}).

They wrote this sentence: "${body.studentSentence}"

Evaluate whether they used the word correctly and meaningfully. Respond in this EXACT JSON format (no markdown, just raw JSON):

{
  "correct": true or false,
  "feedback": "Your encouraging feedback here. 2-3 sentences max."
}

If correct: praise their sentence and point out what makes it strong.
If incorrect: gently explain how the word should be used and give a tip.`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return NextResponse.json(
            { error: "Failed to evaluate usage" },
            { status: 500 }
          );
        }

        try {
          const parsed = JSON.parse(jsonMatch[0]) as EvaluateUsageResponse;
          return NextResponse.json(parsed);
        } catch {
          return NextResponse.json(
            { error: "Failed to parse evaluation" },
            { status: 500 }
          );
        }
      }

      case "extract_vocab": {
        const response = await client.messages.create({
          model: MODEL_SONNET,
          max_tokens: 1024,
          system: [{ type: "text" as const, text: "You are a vocabulary tutor for students ages 9-12 preparing for the Hunter College High School entrance exam. Extract challenging but grade-appropriate vocabulary words from passages. Provide kid-friendly definitions.", cache_control: { type: "ephemeral" as const } }],
          messages: [
            {
              role: "user",
              content: `Extract 5 to 8 challenging vocabulary words from this passage that a 4th-6th grade student should learn. Choose words that are important for reading comprehension and likely to appear on standardized tests.

Passage:
${body.passageText}

Respond in this EXACT JSON format (no markdown, just raw JSON):

{
  "words": [
    {
      "word": "the vocabulary word",
      "definition": "A kid-friendly, one-sentence definition.",
      "partOfSpeech": "noun/verb/adjective/adverb"
    }
  ]
}

Requirements:
- Pick 5-8 words
- Skip common words everyone knows
- Definitions should be one sentence, easy for a 10-year-old to understand
- Include the part of speech`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return NextResponse.json(
            { error: "Failed to extract vocabulary" },
            { status: 500 }
          );
        }

        try {
          const parsed = JSON.parse(jsonMatch[0]) as ExtractVocabResponse;
          return NextResponse.json(parsed);
        } catch {
          return NextResponse.json(
            { error: "Failed to parse extracted vocabulary" },
            { status: 500 }
          );
        }
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
    console.error("Vocab API error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
