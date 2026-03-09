import { NextResponse } from "next/server";
import { TutorAgent } from "@/lib/ai/tutor-agent";
import { getAnthropicClient } from "@/lib/ai/client";
import type { WritingAction, WritingApiResponse } from "@/components/tutor/writing-types";

const agent = new TutorAgent();

const BRAINSTORM_SYSTEM = `You are a warm, encouraging writing tutor helping a 6th grader (age 11-12) brainstorm for an essay. Keep responses to 2-3 sentences. Be enthusiastic but not over the top. Never write the essay for them — guide their thinking.`;

export async function POST(
  request: Request
): Promise<NextResponse<WritingApiResponse | { error: string }>> {
  try {
    const body = (await request.json()) as WritingAction;

    switch (body.type) {
      case "brainstorm": {
        const client = getAnthropicClient();
        let prompt: string;

        switch (body.step) {
          case "reaction":
            prompt = `The student was given this essay prompt: "${body.promptText}"

Their first reaction is: "${body.studentResponse}"

Respond warmly to their reaction. Acknowledge what they said, then ask: "Now let's think bigger — can you come up with 3 different ideas or angles you could write about for this prompt?" Keep it brief and encouraging.`;
            break;

          case "ideas":
            prompt = `The student is brainstorming for this essay prompt: "${body.promptText}"

They came up with these ideas: "${body.studentResponse}"

Briefly comment on their ideas (pick out one that's interesting). Then ask: "Which of these ideas feels strongest to you? Pick one and tell me why you think it would make a great essay." Keep it to 2-3 sentences.`;
            break;

          case "pick":
            prompt = `The student is brainstorming for this essay prompt: "${body.promptText}"

They chose this idea and explained why: "${body.studentResponse}"

Give them a brief, enthusiastic response about their choice. Then give them ONE concrete tip for starting their essay (e.g., "Try opening with a specific moment" or "Start by painting a picture for your reader"). End with something like "You're ready to write! Good luck!" Keep it to 3-4 sentences.`;
            break;

          default:
            return NextResponse.json({ text: "Ready to write!" });
        }

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          system: BRAINSTORM_SYSTEM,
          messages: [{ role: "user", content: prompt }],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        return NextResponse.json({ text });
      }

      case "evaluate_essay": {
        const feedback = await agent.evaluateEssay(
          body.promptText,
          body.essayText
        );
        return NextResponse.json({
          text: feedback.overallFeedback,
          feedback,
        });
      }

      case "rewrite_feedback": {
        const client = getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system: BRAINSTORM_SYSTEM,
          messages: [
            {
              role: "user",
              content: `The student was told to improve their introduction. The suggestion was: "${body.suggestion}"

Original introduction:
"${body.originalIntro}"

Rewritten introduction:
"${body.rewrittenIntro}"

Give specific, encouraging feedback on their rewrite. Point out what improved. If there's still room for growth, mention ONE more thing they could try next time. Keep it to 3-4 sentences. Be warm and specific — quote parts of their writing.`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        return NextResponse.json({ text });
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
    console.error("Writing API error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
