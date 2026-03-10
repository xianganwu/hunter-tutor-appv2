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
}

// ─── POST /api/progress — upload progress for current user ────────────

const syncSchema = z.object({
  progress: z.record(
    z.enum(VALID_KEYS),
    z.unknown()
  ),
});

export async function POST(request: Request) {
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

  const entries = Object.entries(parsed.data.progress);

  // Upsert each key-value pair
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.userData.upsert({
        where: {
          studentId_key: { studentId: session.sub, key },
        },
        create: {
          studentId: session.sub,
          key,
          value: JSON.stringify(value),
        },
        update: {
          value: JSON.stringify(value),
        },
      })
    )
  );

  return NextResponse.json({ success: true, keysUpdated: entries.length });
}
