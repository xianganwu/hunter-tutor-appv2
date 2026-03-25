import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSessionFromCookie } from "@/lib/auth";
import { DATA_KEYS } from "@/lib/data-keys";

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
    const timestamps: Record<string, string> = {};
    for (const row of rows) {
      try {
        progress[row.key] = JSON.parse(row.value);
      } catch {
        progress[row.key] = row.value;
      }
      timestamps[row.key] = row.updatedAt.toISOString();
    }

    return NextResponse.json({ progress, timestamps });
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

    const validKeys = new Set<string>(DATA_KEYS);
    const entries = Object.entries(parsed.data.progress).filter(
      ([key, value]) => validKeys.has(key) && value !== undefined && value !== null
    );

    // Batch upsert all keys in a single transaction (atomic, 1 round-trip)
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.userData.upsert({
          where: { studentId_key: { studentId: session.sub, key } },
          update: { value: JSON.stringify(value) },
          create: { studentId: session.sub, key, value: JSON.stringify(value) },
        })
      )
    );

    return NextResponse.json({ success: true, keysUpdated: entries.length });
  } catch (err) {
    console.error("[progress] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
