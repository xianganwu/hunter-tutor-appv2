import { NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";
import { MODEL_SONNET, MODEL_HAIKU } from "@/lib/ai/tutor-agent";
import { sanitizePromptInput } from "@/utils/sanitize-prompt";

// ─── Zod Schemas ──────────────────────────────────────────────────────

const ParentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("verify_pin"),
    pin: z.string().regex(/^\d{4,6}$/),
  }),
  z.object({
    type: z.literal("get_assessment"),
    domains: z.array(z.object({
      name: z.string().min(1).max(200),
      mastery: z.number().min(0).max(100),
      strongSkills: z.array(z.string().max(200)).max(50),
      weakSkills: z.array(z.string().max(200)).max(50),
      trend: z.string().max(50),
    })).max(20),
    weeklyMinutes: z.number().min(0).max(100000),
    weeklyTarget: z.number().min(0).max(100000),
    latestSimPercentile: z.number().nullable(),
    readingLevel: z.number().nullable(),
    readingWpm: z.number().nullable(),
    mistakePatterns: z.array(z.object({
      skillName: z.string().max(200),
      count: z.number().int().min(0),
    })).max(50),
  }),
  z.object({
    type: z.literal("generate_weekly_digest"),
    practiceDays: z.number().int().min(0).max(7),
    totalMinutes: z.number().min(0).max(100000),
    skillsImproved: z.array(z.object({
      name: z.string().max(200),
      before: z.number().min(0).max(100),
      after: z.number().min(0).max(100),
    })).max(50),
    areasNeedingAttention: z.array(z.object({
      name: z.string().max(200),
      mastery: z.number().min(0).max(100),
    })).max(50),
    essaysWritten: z.number().int().min(0),
    drillsCompleted: z.number().int().min(0),
    badgesEarned: z.array(z.string().max(100)).max(50),
    streakCurrent: z.number().int().min(0),
    streakLongest: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("generate_narrative"),
    activeDays: z.number().int().min(0).max(7),
    weeklyMinutes: z.number().min(0).max(100000),
    weeklyTarget: z.number().min(0).max(100000),
    subjects: z.array(z.string().max(100)).max(10),
    improvingSkills: z.array(z.string().max(200)).max(20),
    weakSkills: z.array(z.string().max(200)).max(20),
    topMistake: z.string().max(200).nullable(),
    readingLevel: z.number().nullable(),
    simPercentile: z.number().nullable(),
  }),
]);

// ─── Response ─────────────────────────────────────────────────────────

interface ParentApiResponse {
  readonly success?: boolean;
  readonly assessment?: string;
  readonly focusAreas?: readonly string[];
  readonly narrative?: string;
  readonly error?: string;
}

// ─── Handler ──────────────────────────────────────────────────────────

export async function POST(
  request: Request
): Promise<NextResponse<ParentApiResponse>> {
  try {
    const raw = await request.json();
    const parsed = ParentActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const body = parsed.data;

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
              `- ${sanitizePromptInput(d.name, 200)}: ${d.mastery}% mastery (trend: ${sanitizePromptInput(d.trend, 50)})\n  Strong: ${d.strongSkills.map((s) => sanitizePromptInput(s, 200)).join(", ") || "none identified yet"}\n  Needs work: ${d.weakSkills.map((s) => sanitizePromptInput(s, 200)).join(", ") || "none identified yet"}`
          )
          .join("\n");

        const mistakeSummary = body.mistakePatterns
          .slice(0, 5)
          .map((p) => `- ${sanitizePromptInput(p.skillName, 200)}: ${p.count} mistakes`)
          .join("\n");

        const response = await client.messages.create({
          model: MODEL_SONNET,
          max_tokens: 1024,
          system: [{ type: "text" as const, text: `You are a thoughtful education consultant briefing a parent on their child's progress building skills toward the Hunter College High School entrance exam. The student may be a rising 5th grader (age 9-10) working on foundations or a 6th grader (age 11-12) in intensive prep. Be honest but encouraging. The parent wants to know: (1) a clear readiness assessment, and (2) specific focus areas for the coming week. Speak directly to the parent. Keep it concise and actionable.`, cache_control: { type: "ephemeral" as const } }],
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

      case "generate_weekly_digest": {
        const client = getAnthropicClient();

        const skillsImpSummary = body.skillsImproved
          .map((s) => `- ${sanitizePromptInput(s.name, 200)}: ${s.before}% → ${s.after}%`)
          .join("\n");
        const attentionSummary = body.areasNeedingAttention
          .map((a) => `- ${sanitizePromptInput(a.name, 200)}: ${a.mastery}% mastery`)
          .join("\n");

        const response = await client.messages.create({
          model: MODEL_HAIKU,
          max_tokens: 256,
          system: [{ type: "text" as const, text: `You are writing a brief weekly progress summary for a parent whose child is preparing for the Hunter College High School entrance exam. Be warm, specific, and encouraging. Keep it to 2-3 sentences.`, cache_control: { type: "ephemeral" as const } }],
          messages: [
            {
              role: "user",
              content: `Write a 2-3 sentence parent-friendly summary of this week's progress:

Practice: ${body.practiceDays} days, ${body.totalMinutes} minutes
Streak: ${body.streakCurrent} days (longest: ${body.streakLongest})
Essays: ${body.essaysWritten}, Drills: ${body.drillsCompleted}
Badges earned: ${body.badgesEarned.length > 0 ? body.badgesEarned.map((b) => sanitizePromptInput(b, 100)).join(", ") : "none"}
${skillsImpSummary ? `Skills improved:\n${skillsImpSummary}` : "No notable skill improvements this week."}
${attentionSummary ? `Needs attention:\n${attentionSummary}` : ""}

Keep it brief and parent-friendly. Focus on what went well and one area to encourage.`,
            },
          ],
        });

        const narrative =
          response.content[0].type === "text" ? response.content[0].text : "";

        return NextResponse.json({ narrative });
      }

      case "generate_narrative": {
        const client = getAnthropicClient();

        const subjectText =
          body.subjects.length > 0
            ? body.subjects.map((s) => sanitizePromptInput(s, 100)).join(", ")
            : "general practice";

        const improvingText =
          body.improvingSkills.length > 0
            ? body.improvingSkills
                .slice(0, 3)
                .map((s) => sanitizePromptInput(s, 200))
                .join(", ")
            : "none identified yet";

        const weakText =
          body.weakSkills.length > 0
            ? body.weakSkills
                .slice(0, 3)
                .map((s) => sanitizePromptInput(s, 200))
                .join(", ")
            : "none identified yet";

        const extras: string[] = [];
        if (body.readingLevel !== null) {
          extras.push(`Reading stamina: Level ${body.readingLevel}`);
        }
        if (body.simPercentile !== null) {
          extras.push(
            `Latest practice exam: around the ${body.simPercentile}th percentile`,
          );
        }

        const response = await client.messages.create({
          model: MODEL_HAIKU,
          max_tokens: 128,
          system: [
            {
              type: "text" as const,
              text: "You are a warm, encouraging teacher writing a brief weekly update for a parent whose child is preparing for the Hunter College High School entrance exam. Write exactly 2-3 sentences. First sentence: what they did this week (days, minutes, subjects). Second sentence: what is going well (mention a specific skill). Third sentence: one gentle suggestion for next week. Sound like a caring teacher, not a report card. Never use jargon.",
              cache_control: { type: "ephemeral" as const },
            },
          ],
          messages: [
            {
              role: "user",
              content: `Write a 2-3 sentence parent-friendly weekly summary from this data:

Practice: ${body.activeDays} days, ${body.weeklyMinutes} of ${body.weeklyTarget} target minutes
Subjects: ${subjectText}
Improving skills: ${improvingText}
Needs attention: ${weakText}
${body.topMistake ? `Most common mistake area: ${sanitizePromptInput(body.topMistake, 200)}` : ""}
${extras.join("\n")}

Keep it to exactly 2-3 sentences. Be warm and specific.`,
            },
          ],
        });

        const narrative =
          response.content[0].type === "text" ? response.content[0].text : "";

        return NextResponse.json({ narrative });
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
