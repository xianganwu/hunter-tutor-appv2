import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/ai/client";

// ─── Request Types ────────────────────────────────────────────────────

type ParentAction =
  | {
      type: "verify_pin";
      pin: string;
    }
  | {
      type: "get_assessment";
      domains: readonly {
        name: string;
        mastery: number;
        strongSkills: readonly string[];
        weakSkills: readonly string[];
        trend: string;
      }[];
      weeklyMinutes: number;
      weeklyTarget: number;
      latestSimPercentile: number | null;
      readingLevel: number | null;
      readingWpm: number | null;
      mistakePatterns: readonly { skillName: string; count: number }[];
    };

// ─── Response ─────────────────────────────────────────────────────────

interface ParentApiResponse {
  readonly success?: boolean;
  readonly assessment?: string;
  readonly focusAreas?: readonly string[];
  readonly error?: string;
}

// ─── Handler ──────────────────────────────────────────────────────────

export async function POST(
  request: Request
): Promise<NextResponse<ParentApiResponse>> {
  try {
    const body = (await request.json()) as ParentAction;

    switch (body.type) {
      case "verify_pin": {
        const expected = process.env.PARENT_PIN ?? "1234";
        if (body.pin === expected) {
          return NextResponse.json({ success: true });
        }
        return NextResponse.json(
          { success: false, error: "Incorrect PIN" },
          { status: 401 }
        );
      }

      case "get_assessment": {
        const client = getAnthropicClient();

        const domainSummary = body.domains
          .map(
            (d) =>
              `- ${d.name}: ${d.mastery}% mastery (trend: ${d.trend})\n  Strong: ${d.strongSkills.join(", ") || "none identified yet"}\n  Needs work: ${d.weakSkills.join(", ") || "none identified yet"}`
          )
          .join("\n");

        const mistakeSummary = body.mistakePatterns
          .slice(0, 5)
          .map((p) => `- ${p.skillName}: ${p.count} mistakes`)
          .join("\n");

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: `You are a thoughtful education consultant briefing a parent on their child's progress building skills toward the Hunter College High School entrance exam. The student may be a rising 5th grader (age 9-10) working on foundations or a 6th grader (age 11-12) in intensive prep. Be honest but encouraging. The parent wants to know: (1) a clear readiness assessment, and (2) specific focus areas for the coming week. Speak directly to the parent. Keep it concise and actionable.`,
          messages: [
            {
              role: "user",
              content: `Here's the student's current data:

Practice this week: ${body.weeklyMinutes} of ${body.weeklyTarget} target minutes
${body.latestSimPercentile ? `Latest practice exam: estimated ${body.latestSimPercentile}th percentile` : "No practice exams completed yet"}
${body.readingLevel ? `Reading stamina: Level ${body.readingLevel}, ${body.readingWpm} WPM average` : "Reading stamina: not started yet"}

Domain mastery:
${domainSummary}

Most common mistake areas:
${mistakeSummary || "No mistakes recorded yet"}

Provide:
1. ASSESSMENT: A 3-4 sentence overall readiness assessment. What's going well, what needs attention. Be specific about skills, not generic.
2. FOCUS_AREAS: A JSON array of exactly 4 strings, each a specific 1-sentence recommendation for what to focus on this coming week. Be actionable ("Practice X for 15 minutes daily" rather than "Work on math").

Format your response exactly as:
ASSESSMENT: [your assessment here]
FOCUS_AREAS: ["rec1", "rec2", "rec3", "rec4"]`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        const assessmentMatch = text.match(
          /ASSESSMENT:\s*([\s\S]*?)(?=FOCUS_AREAS:|$)/i
        );
        const focusMatch = text.match(/FOCUS_AREAS:\s*(\[[\s\S]*?\])/i);

        const assessment = assessmentMatch?.[1]?.trim() ?? text;

        let focusAreas: string[] = [];
        if (focusMatch) {
          try {
            focusAreas = JSON.parse(focusMatch[1]) as string[];
          } catch {
            focusAreas = [
              "Continue regular daily practice sessions of 25-30 minutes.",
            ];
          }
        }

        return NextResponse.json({ assessment, focusAreas });
      }

      default:
        return NextResponse.json({ error: "Unknown action type" });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Parent API error:", err);
    return NextResponse.json({ error: message });
  }
}
