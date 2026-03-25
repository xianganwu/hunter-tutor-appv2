import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

// ─── Mocks ───────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    userData: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: vi.fn((args: unknown) => args), // returns the operation for $transaction
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const mockGetSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSessionFromCookie: (...args: unknown[]) => mockGetSession(...args),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeRow(key: string, value: unknown, updatedAt?: Date) {
  return {
    key,
    value: JSON.stringify(value),
    updatedAt: updatedAt ?? new Date("2026-03-01T00:00:00Z"),
  };
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFindMany.mockReset();
  mockTransaction.mockReset();
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ sub: "student-1", name: "Test", email: "t@t.com" });
  mockTransaction.mockResolvedValue([]);
});

describe("GET /api/progress", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns all progress keys with timestamps", async () => {
    mockFindMany.mockResolvedValue([
      makeRow("skill-mastery", { level: 5 }),
      makeRow("drills", [1, 2, 3]),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.progress).toEqual({
      "skill-mastery": { level: 5 },
      drills: [1, 2, 3],
    });
    expect(body.timestamps).toHaveProperty("skill-mastery");
    expect(body.timestamps).toHaveProperty("drills");
  });

  it("queries by studentId from session", async () => {
    mockFindMany.mockResolvedValue([]);

    await GET();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { studentId: "student-1" },
    });
  });

  it("returns raw value when JSON parse fails", async () => {
    mockFindMany.mockResolvedValue([
      { key: "bad-json", value: "not-json{", updatedAt: new Date() },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.progress["bad-json"]).toBe("not-json{");
  });

  it("returns empty progress when no data exists", async () => {
    mockFindMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.progress).toEqual({});
    expect(body.timestamps).toEqual({});
  });
});

describe("POST /api/progress", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makePostRequest({ progress: {} }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid request body", async () => {
    const res = await POST(makePostRequest({ notProgress: true }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("upserts valid keys in a transaction", async () => {
    const res = await POST(
      makePostRequest({
        progress: {
          "skill-mastery": { level: 3 },
          drills: [1, 2],
        },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.keysUpdated).toBe(2);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("filters out invalid keys", async () => {
    const res = await POST(
      makePostRequest({
        progress: {
          "skill-mastery": { level: 1 },
          "invalid-key": "should be ignored",
        },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.keysUpdated).toBe(1);
  });

  it("filters out null and undefined values", async () => {
    const res = await POST(
      makePostRequest({
        progress: {
          "skill-mastery": null,
          drills: [1],
        },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.keysUpdated).toBe(1);
  });

  it("returns keysUpdated 0 when no valid keys", async () => {
    const res = await POST(
      makePostRequest({
        progress: {
          "fake-key": "nope",
        },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.keysUpdated).toBe(0);
  });
});
