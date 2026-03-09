import { NextResponse } from "next/server";
import { TutorAgent } from "@/lib/ai/tutor-agent";
import { getAnthropicClient } from "@/lib/ai/client";
import { getSkillById } from "@/lib/exam/curriculum";
import type { ChatAction, ChatApiResponse } from "@/components/tutor/types";
import type { DifficultyLevel } from "@/lib/types";

const agent = new TutorAgent();

export async function POST(request: Request): Promise<NextResponse<ChatApiResponse | { error: string }>> {
  try {
    const body = (await request.json()) as ChatAction;

    switch (body.type) {
      case "teach": {
        const skill = getSkillById(body.skillId);
        if (!skill) {
          return NextResponse.json({ error: `Unknown skill: ${body.skillId}` }, { status: 400 });
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
        const followUp = await agent.socraticFollowUp(body.context, body.history ?? []);
        return NextResponse.json({ text: followUp.question });
      }

      case "explain_more": {
        const skill = getSkillById(body.skillId);
        if (!skill) {
          return NextResponse.json({ error: `Unknown skill: ${body.skillId}` }, { status: 400 });
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
          system: `You are a warm tutor evaluating a 6th grader's explanation of a concept. They are trying to "teach it back" — explaining the concept as if teaching a friend. Evaluate their explanation for completeness and accuracy, then respond in a structured format.`,
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
        const response = await agent.respondToEmotionalCue(
          body.message,
          body.history ?? []
        );
        return NextResponse.json({ text: response });
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
