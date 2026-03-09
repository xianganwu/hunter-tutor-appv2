import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/ai/client";
import type { MistakeDiagnosis, MistakeCategory } from "@/lib/mistakes";

interface DiagnoseRequest {
  type: "diagnose";
  skillId: string;
  skillName: string;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  answerChoices: readonly string[];
}

interface AnalyzePatternsRequest {
  type: "analyze_patterns";
  mistakes: readonly {
    skillName: string;
    questionText: string;
    diagnosis: { category: string; explanation: string };
  }[];
}

type MistakeAction = DiagnoseRequest | AnalyzePatternsRequest;

const DIAGNOSIS_SYSTEM = `You are a tutoring analytics assistant. When given a student's wrong answer, diagnose WHY they got it wrong. Categorize into exactly one of:
- conceptual_gap: The student doesn't understand the underlying concept
- careless_error: The student knows the concept but made a small computational or reading mistake
- misread_question: The student misunderstood what the question was asking

Be specific and brief. Write at a level a 6th grader's parent could understand.`;

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
    const body = (await request.json()) as MistakeAction;

    switch (body.type) {
      case "diagnose": {
        const client = getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          system: DIAGNOSIS_SYSTEM,
          messages: [
            {
              role: "user",
              content: `Skill: ${body.skillName} (${body.skillId})

Question: ${body.questionText}

Answer choices:
${body.answerChoices.join("\n")}

Student picked: ${body.studentAnswer}
Correct answer: ${body.correctAnswer}

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
              `${i + 1}. Skill: ${m.skillName} | Category: ${m.diagnosis.category} | ${m.diagnosis.explanation}`
          )
          .join("\n");

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system: `You are a tutoring analytics assistant analyzing a 6th grader's mistake patterns. Be specific, encouraging, and actionable. Write 2-3 short observations.`,
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
