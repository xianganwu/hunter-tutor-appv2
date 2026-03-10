import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSessionFromCookie } from "@/lib/auth";

const VALID_KEYS = [
  "skill-mastery",
  "mistakes",
  "simulations",
  "reading-stamina",
  "teaching-moments",
  "essays",
] as const;

// ─── GET /api/progress — download all progress for current user ───────

export async function GET() {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rows = await prisma.userData.findMany({
      where: { studentId: session.sub },
    });

    const progress: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        progress[row.key] = JSON.parse(row.value);
      } catch {
        progress[row.key] = row.value;
      }
    }

    return NextResponse.json({ progress });
  } catch (err) {
    console.error("[progress] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST /api/progress — upload progress for current user ────────────

const syncSchema = z.object({
  progress: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = syncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const validKeys = new Set<string>(VALID_KEYS);
    const entries = Object.entries(parsed.data.progress).filter(
      ([key, value]) => validKeys.has(key) && value !== undefined && value !== null
    );

    // Save each key-value pair sequentially (LibSQL doesn't support concurrent upserts well)
    for (const [key, value] of entries) {
      const jsonValue = JSON.stringify(value);
      const existing = await prisma.userData.findFirst({
        where: { studentId: session.sub, key },
      });
      if (existing) {
        await prisma.userData.update({
          where: { id: existing.id },
          data: { value: jsonValue },
        });
      } else {
        await prisma.userData.create({
          data: { studentId: session.sub, key, value: jsonValue },
        });
      }
    }

    return NextResponse.json({ success: true, keysUpdated: entries.length });
  } catch (err) {
    console.error("[progress] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
