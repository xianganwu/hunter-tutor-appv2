import { NextResponse } from "next/server";
import { TutorAgent } from "@/lib/ai/tutor-agent";
import { getAnthropicClient } from "@/lib/ai/client";
import type { WritingAction, WritingApiResponse, StoredEssay } from "@/components/tutor/writing-types";
import { prisma } from "@/lib/db";
import { getSessionFromCookie } from "@/lib/auth";
import type { EssayFeedback } from "@/lib/ai/tutor-agent";

const agent = new TutorAgent();

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── GET /api/writing — list student's essays ─────────────────────────

export async function GET(): Promise<NextResponse<{ essays: StoredEssay[] } | { error: string }>> {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ essays: [] });
    }

    const submissions = await prisma.writingSubmission.findMany({
      where: { session: { studentId: session.sub } },
      orderBy: { createdAt: "asc" },
    });

    const essays: StoredEssay[] = submissions.map((s) => {
      const feedback = s.aiFeedback
        ? (JSON.parse(s.aiFeedback) as EssayFeedback)
        : {
            overallFeedback: "",
            scores: { organization: 5, clarity: 5, evidence: 5, grammar: 5 },
            strengths: [],
            improvements: [],
          };
      return {
        id: s.id,
        promptText: s.prompt,
        essayText: s.essayText,
        wordCount: countWords(s.essayText),
        feedback,
        createdAt: s.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ essays });
  } catch (err) {
    console.error("[writing] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const BRAINSTORM_SYSTEM = `You are a warm, encouraging writing tutor helping a student brainstorm for an essay. The student may be a rising 5th grader (age 9-10) or a 6th grader (age 11-12). Keep responses to 2-3 sentences. Be enthusiastic but not over the top. Never write the essay for them — guide their thinking. Use simple, encouraging language appropriate for their age.`;

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

        // Persist to DB in the background if user is authenticated
        void (async () => {
          try {
            const session = await getSessionFromCookie();
            if (!session) return;
            // Create a writing session to associate the submission with
            const writingSession = await prisma.tutoringSession.create({
              data: { studentId: session.sub, domain: "writing" },
            });
            await prisma.writingSubmission.create({
              data: {
                sessionId: writingSession.id,
                prompt: body.promptText,
                essayText: body.essayText,
                aiFeedback: JSON.stringify(feedback),
              },
            });
          } catch (err) {
            console.error("[writing] DB save error:", err);
          }
        })();

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
