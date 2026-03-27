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
  timestamps: z.record(z.string(), z.string()).optional(),
});

/** Returns true if value is an empty array, empty object, or has no meaningful content */
function isEmptyPayload(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object" && value !== null) return Object.keys(value).length === 0;
  return false;
}

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

    const clientTimestamps = parsed.data.timestamps ?? {};

    // Fetch existing rows for timestamp comparison and empty-payload protection
    const keysToCheck = entries.map(([k]) => k);
    const existingRows = keysToCheck.length > 0
      ? await prisma.userData.findMany({
          where: { studentId: session.sub, key: { in: keysToCheck } },
          select: { key: true, value: true, updatedAt: true },
        })
      : [];
    const existingMap = new Map(
      existingRows.map((r) => [r.key, { value: r.value, updatedAt: r.updatedAt }])
    );

    // Filter out stale entries (C1) and empty payloads replacing good data (C2)
    const freshEntries = entries.filter(([key, value]) => {
      const existing = existingMap.get(key);

      // C1: Timestamp guard — skip if client data is older than server data
      const clientTs = clientTimestamps[key];
      if (clientTs && existing) {
        const clientDate = new Date(clientTs);
        if (!isNaN(clientDate.getTime()) && clientDate < existing.updatedAt) {
          return false; // Client's last-known timestamp is older — stale data
        }
      }

      // C2: Empty-payload guard — skip if incoming is empty but existing has data
      if (isEmptyPayload(value) && existing && existing.value.length > 2) {
        // existing.value.length > 2 filters out stored "[]" or "{}" (already empty)
        return false;
      }

      return true;
    });

    // Batch upsert all fresh keys in a single transaction (atomic, 1 round-trip)
    if (freshEntries.length > 0) {
      await prisma.$transaction(
        freshEntries.map(([key, value]) =>
          prisma.userData.upsert({
            where: { studentId_key: { studentId: session.sub, key } },
            update: { value: JSON.stringify(value) },
            create: { studentId: session.sub, key, value: JSON.stringify(value) },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      keysUpdated: freshEntries.length,
      keysSkipped: entries.length - freshEntries.length,
    });
  } catch (err) {
    console.error("[progress] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
