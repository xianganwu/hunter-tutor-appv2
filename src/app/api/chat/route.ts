import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { TutorAgent } from "@/lib/ai/tutor-agent";
import { getAnthropicClient } from "@/lib/ai/client";
import { getSkillById } from "@/lib/exam/curriculum";
import { prisma } from "@/lib/db";
import type { ChatAction } from "@/components/tutor/types";
import type { DifficultyLevel } from "@/lib/types";

const agent = new TutorAgent();

// ─── Streaming helpers ─────────────────────────────────────────────────

type StreamMeta = Record<string, unknown>;

interface StreamParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Anthropic.MessageParam[];
}

/**
 * Create an SSE ReadableStream from an Anthropic streaming call.
 * Events:
 *   data: {"delta":"..."} — text chunk
 *   data: {"done":true, ...meta} — final event with optional metadata
 */
function createSSEStream(params: StreamParams, meta?: StreamMeta): Response {
  const client = getAnthropicClient();
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: params.model,
          max_tokens: params.max_tokens,
          system: params.system,
          messages: params.messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`)
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, ...(meta ?? {}) })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── POST handler ─────────────────────────────────────────────────────

interface StreamableAction extends Record<string, unknown> {
  stream?: boolean;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ChatAction & StreamableAction;
    const wantStream = body.stream === true;

    switch (body.type) {
      case "teach": {
        const skill = getSkillById(body.skillId);
        if (!skill) {
          return NextResponse.json({ error: `Unknown skill: ${body.skillId}` }, { status: 400 });
        }

        if (wantStream) {
          return createSSEStream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: agent.getSystemPrompt(),
            messages: agent.buildTeachMessages(skill, body.mastery),
          });
        }

        const result = await agent.teachConcept(skill, body.mastery);
        return NextResponse.json({ text: result.explanation });
      }

      case "generate_question": {
        const skill = getSkillById(body.skillId);
        if (!skill) {
          return NextResponse.json({ error: `Unknown skill: ${body.skillId}` }, { status: 400 });
        }
        const question = await agent.generateQuestion(skill, body.difficultyTier as DifficultyLevel);
        return NextResponse.json({ text: question.questionText, question });
      }

      case "evaluate_answer": {
        const { messages, isCorrect } = agent.buildEvaluateMessages(
          body.questionText,
          body.studentAnswer,
          body.correctAnswer,
          body.history ?? []
        );

        // Persist the attempt to DB if session context is provided (fire-and-forget)
        if (body.sessionId && body.skillId) {
          void prisma.questionAttempt.create({
            data: {
              sessionId: body.sessionId,
              skillId: body.skillId,
              questionText: body.questionText,
              studentAnswer: body.studentAnswer,
              correctAnswer: body.correctAnswer,
              isCorrect,
              timeSpentSeconds: body.timeSpentSeconds ?? null,
              hintUsed: body.hintUsed ?? false,
            },
          }).catch((err: unknown) => console.error("[chat] QuestionAttempt persist error:", err));
        }

        if (wantStream) {
          return createSSEStream(
            {
              model: "claude-sonnet-4-20250514",
              max_tokens: 768,
              system: agent.getSystemPrompt(),
              messages,
            },
            { isCorrect }
          );
        }

        const feedback = await agent.evaluateAnswer(
          body.questionText,
          body.studentAnswer,
          body.correctAnswer,
          body.history ?? []
        );
        return NextResponse.json({
          text: feedback.feedback,
          isCorrect: feedback.isCorrect,
        });
      }

      case "get_hint": {
        if (wantStream) {
          return createSSEStream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 256,
            system: agent.getSystemPrompt(),
            messages: agent.buildHintMessages(body.context, body.history ?? []),
          });
        }

        const followUp = await agent.socraticFollowUp(body.context, body.history ?? []);
        return NextResponse.json({ text: followUp.question });
      }

      case "explain_more": {
        const skill = getSkillById(body.skillId);
        if (!skill) {
          return NextResponse.json({ error: `Unknown skill: ${body.skillId}` }, { status: 400 });
        }

        if (wantStream) {
          return createSSEStream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: agent.getSystemPrompt(),
            messages: agent.buildTeachMessages(skill, body.mastery),
          });
        }

        const result = await agent.teachConcept(skill, body.mastery);
        return NextResponse.json({ text: result.explanation });
      }

      case "evaluate_teach_back": {
        const skill = getSkillById(body.skillId);
        if (!skill) {
          return NextResponse.json({ error: `Unknown skill: ${body.skillId}` }, { status: 400 });
        }

        const client = getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system: `You are a warm tutor evaluating a student's explanation of a concept. The student may be a rising 5th grader (age 9-10) or a 6th grader (age 11-12). They are trying to "teach it back" — explaining the concept as if teaching a friend. Evaluate their explanation for completeness and accuracy, then respond in a structured format. Match your language to the student's age level.`,
          messages: [
            {
              role: "user",
              content: `The student was asked to explain this concept in their own words:

Skill: "${body.skillName}" (${body.skillId})
Description: ${skill.description}

Student's explanation:
"${body.studentExplanation}"

Evaluate their explanation. Respond in this EXACT format:

COMPLETENESS: [complete|partial|missing_key_concepts]
ACCURACY: [accurate|minor_errors|misconception]
MISSING: [comma-separated list of missing concepts, or "none"]
FEEDBACK: [2-3 sentences — start with specific praise for what they got right, then gently note any gaps. Be warm and encouraging. If they nailed it, celebrate! If not, frame gaps as "one thing to add" rather than errors.]`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        const completenessMatch = text.match(
          /COMPLETENESS:\s*(complete|partial|missing_key_concepts)/i
        );
        const accuracyMatch = text.match(
          /ACCURACY:\s*(accurate|minor_errors|misconception)/i
        );
        const missingMatch = text.match(/MISSING:\s*(.+?)(?:\n|$)/i);
        const feedbackMatch = text.match(/FEEDBACK:\s*([\s\S]+?)$/i);

        type Completeness = "complete" | "partial" | "missing_key_concepts";
        type Accuracy = "accurate" | "minor_errors" | "misconception";

        const completeness = (completenessMatch?.[1]?.toLowerCase() ?? "partial") as Completeness;
        const accuracy = (accuracyMatch?.[1]?.toLowerCase() ?? "accurate") as Accuracy;
        const missingRaw = missingMatch?.[1]?.trim() ?? "none";
        const missingConcepts =
          missingRaw.toLowerCase() === "none"
            ? []
            : missingRaw.split(",").map((s) => s.trim()).filter(Boolean);
        const feedback = feedbackMatch?.[1]?.trim() ?? text;

        return NextResponse.json({
          text: feedback,
          teachBackEvaluation: {
            completeness,
            accuracy,
            feedback,
            missingConcepts,
          },
        });
      }

      case "emotional_response": {
        if (wantStream) {
          return createSSEStream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 768,
            system: agent.getSystemPrompt(),
            messages: agent.buildEmotionalMessages(body.message, body.history ?? []),
          });
        }

        const response = await agent.respondToEmotionalCue(
          body.message,
          body.history ?? []
        );
        return NextResponse.json({ text: response });
      }

      case "generate_drill_batch": {
        const skill = getSkillById(body.skillId);
        if (!skill) {
          return NextResponse.json({ error: `Unknown skill: ${body.skillId}` }, { status: 400 });
        }
        const questions = await agent.generateDrillBatch(skill, body.count ?? 10);
        return NextResponse.json({ questions });
      }

      case "generate_diagnostic": {
        const diagnosticQuestions = [];
        for (const skillId of body.skillIds) {
          const skill = getSkillById(skillId);
          if (!skill) continue;
          const batch = await agent.generateDrillBatch(skill, 1);
          if (batch.length > 0) {
            diagnosticQuestions.push({
              skillId,
              questionText: batch[0].questionText,
              answerChoices: batch[0].answerChoices,
              correctAnswer: batch[0].correctAnswer,
            });
          }
        }
        return NextResponse.json({ questions: diagnosticQuestions });
      }

      case "get_summary": {
        const accuracy = body.questionsAnswered > 0
          ? Math.round((body.correctCount / body.questionsAnswered) * 100)
          : 0;
        const skillNames = body.skillsCovered
          .map((id) => getSkillById(id)?.name ?? id)
          .join(", ");

        const summaryText = [
          `Great session! You practiced for ${body.elapsedMinutes} minutes.`,
          `You answered ${body.questionsAnswered} questions with ${accuracy}% accuracy.`,
          `Skills covered: ${skillNames}.`,
          body.correctCount >= body.questionsAnswered * 0.7
            ? "You're making excellent progress — keep it up!"
            : "Keep practicing — every attempt makes you stronger!",
        ].join(" ");

        return NextResponse.json({ text: summaryText });
      }

      default:
        return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Chat API error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
