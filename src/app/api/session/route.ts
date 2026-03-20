import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSessionFromCookie } from "@/lib/auth";

// ─── GET /api/session — list recent sessions for current user ─────────

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

    const sessions = await prisma.tutoringSession.findMany({
      where: { studentId: session.sub },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        _count: { select: { questionAttempts: true } },
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        domain: s.domain,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        skillsCovered: JSON.parse(s.skillsCovered),
        sessionSummary: s.sessionSummary,
        questionCount: s._count.questionAttempts,
      })),
    });
  } catch (err) {
    console.error("[session] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST /api/session — create or end a tutoring session ─────────────

const createSchema = z.object({
  action: z.literal("create"),
  domain: z.string().min(1),
  skillsCovered: z.array(z.string()).optional(),
});

const endSchema = z.object({
  action: z.literal("end"),
  sessionId: z.string().min(1),
  summary: z.string().optional(),
  skillsCovered: z.array(z.string()).optional(),
});

const requestSchema = z.discriminatedUnion("action", [createSchema, endSchema]);

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.action === "create") {
      const tutoringSession = await prisma.tutoringSession.create({
        data: {
          studentId: session.sub,
          domain: data.domain,
          skillsCovered: JSON.stringify(data.skillsCovered ?? []),
        },
      });

      return NextResponse.json({
        session: {
          id: tutoringSession.id,
          domain: tutoringSession.domain,
          startedAt: tutoringSession.startedAt.toISOString(),
        },
      });
    } else {
      const tutoringSession = await prisma.tutoringSession.findFirst({
        where: { id: data.sessionId, studentId: session.sub },
      });

      if (!tutoringSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const updated = await prisma.tutoringSession.update({
        where: { id: data.sessionId },
        data: {
          endedAt: new Date(),
          sessionSummary: data.summary ?? null,
          ...(data.skillsCovered
            ? { skillsCovered: JSON.stringify(data.skillsCovered) }
            : {}),
        },
      });

      return NextResponse.json({
        session: {
          id: updated.id,
          domain: updated.domain,
          startedAt: updated.startedAt.toISOString(),
          endedAt: updated.endedAt?.toISOString() ?? null,
          sessionSummary: updated.sessionSummary,
        },
      });
    }
  } catch (err) {
    console.error("[session] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
