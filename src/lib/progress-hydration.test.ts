/**
 * Comprehensive tests for the progress hydration migration:
 * - DATA_KEYS completeness
 * - flushSyncImmediate (sendBeacon flush)
 * - initializeFromServer (dirty key push + server pull)
 * - scheduleSyncToServer debounce timing
 * - time-budget dirty tracking via saveTimeBudget
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ─── DATA_KEYS tests ─────────────────────────────────────────────────────

describe("DATA_KEYS", () => {
  it("contains all expected keys including new streak-freezes and time-budget", async () => {
    const { DATA_KEYS } = await import("./data-keys");
    expect(DATA_KEYS).toContain("streak-freezes");
    expect(DATA_KEYS).toContain("time-budget");
  });

  it("has exactly 14 keys", async () => {
    const { DATA_KEYS } = await import("./data-keys");
    expect(DATA_KEYS).toHaveLength(14);
  });

  it("contains all original 12 keys", async () => {
    const { DATA_KEYS } = await import("./data-keys");
    const original = [
      "skill-mastery",
      "mistakes",
      "simulations",
      "reading-stamina",
      "teaching-moments",
      "essays",
      "badges",
      "mascot-customization",
      "daily-plan",
      "drills",
      "weekly-snapshots",
      "vocab-deck",
    ];
    for (const key of original) {
      expect(DATA_KEYS).toContain(key);
    }
  });

  it("has no duplicate keys", async () => {
    const { DATA_KEYS } = await import("./data-keys");
    const unique = new Set(DATA_KEYS);
    expect(unique.size).toBe(DATA_KEYS.length);
  });
});

// ─── flushSyncImmediate tests ─────────────────────────────────────────────

describe("flushSyncImmediate", () => {
  let flushSyncImmediate: typeof import("./auth-client").flushSyncImmediate;

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    // Dynamic import to get fresh module
    const mod = await import("./auth-client");
    flushSyncImmediate = mod.flushSyncImmediate;
  });

  it("returns false when no dirty keys exist", () => {
    // No dirty keys set
    const result = flushSyncImmediate("TestUser");
    expect(result).toBe(false);
  });

  it("sends beacon with dirty key data and clears dirty keys", () => {
    // Set up dirty keys
    localStorage.setItem(
      "hunter-tutor:dirty-keys",
      JSON.stringify(["skill-mastery"])
    );
    localStorage.setItem(
      "hunter-tutor:TestUser:skill-mastery",
      JSON.stringify([{ skillId: "math_1", level: 3 }])
    );

    const mockSendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: mockSendBeacon });

    const result = flushSyncImmediate("TestUser");

    expect(result).toBe(true);
    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    expect(mockSendBeacon).toHaveBeenCalledWith(
      "/api/progress",
      expect.any(Blob)
    );

    // Verify dirty keys were cleared
    expect(localStorage.getItem("hunter-tutor:dirty-keys")).toBeNull();
  });

  it("does not clear dirty keys when sendBeacon returns false", () => {
    localStorage.setItem(
      "hunter-tutor:dirty-keys",
      JSON.stringify(["mistakes"])
    );
    localStorage.setItem(
      "hunter-tutor:TestUser:mistakes",
      JSON.stringify([{ id: "m1" }])
    );

    const mockSendBeacon = vi.fn().mockReturnValue(false);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: mockSendBeacon });

    const result = flushSyncImmediate("TestUser");

    expect(result).toBe(false);
    // Dirty keys should NOT be cleared
    expect(localStorage.getItem("hunter-tutor:dirty-keys")).not.toBeNull();
  });

  it("returns false when dirty keys exist but localStorage values are missing", () => {
    localStorage.setItem(
      "hunter-tutor:dirty-keys",
      JSON.stringify(["skill-mastery"])
    );
    // Don't set the actual data key — simulates cleared localStorage

    const result = flushSyncImmediate("TestUser");
    expect(result).toBe(false);
  });

  it("sends correct JSON payload in beacon blob", async () => {
    localStorage.setItem(
      "hunter-tutor:dirty-keys",
      JSON.stringify(["mistakes", "badges"])
    );
    localStorage.setItem(
      "hunter-tutor:TestUser:mistakes",
      JSON.stringify([{ id: "m1" }])
    );
    localStorage.setItem(
      "hunter-tutor:TestUser:badges",
      JSON.stringify(["first_correct"])
    );

    let capturedBlob: Blob | undefined;
    const mockSendBeacon = vi.fn().mockImplementation((_url: string, blob: Blob) => {
      capturedBlob = blob;
      return true;
    });
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: mockSendBeacon });

    flushSyncImmediate("TestUser");

    expect(capturedBlob).toBeDefined();
    expect(capturedBlob!.type).toBe("application/json");

    const text = await capturedBlob!.text();
    const payload = JSON.parse(text);
    expect(payload).toEqual({
      progress: {
        mistakes: [{ id: "m1" }],
        badges: ["first_correct"],
      },
    });
  });
});

// ─── initializeFromServer tests ───────────────────────────────────────────

describe("initializeFromServer", () => {
  let initializeFromServer: typeof import("./auth-client").initializeFromServer;

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    const mod = await import("./auth-client");
    initializeFromServer = mod.initializeFromServer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pulls server data into localStorage when no dirty keys", async () => {
    const serverData = {
      progress: {
        "skill-mastery": [{ skillId: "math_1", level: 3 }],
        mistakes: [{ id: "m1" }],
      },
      timestamps: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(serverData),
    });

    const result = await initializeFromServer("TestUser");

    expect(result).toBe(true);
    expect(
      JSON.parse(localStorage.getItem("hunter-tutor:TestUser:skill-mastery")!)
    ).toEqual([{ skillId: "math_1", level: 3 }]);
    expect(
      JSON.parse(localStorage.getItem("hunter-tutor:TestUser:mistakes")!)
    ).toEqual([{ id: "m1" }]);
  });

  it("pushes dirty keys before pulling server data", async () => {
    // Mark skill-mastery as dirty with local data
    localStorage.setItem(
      "hunter-tutor:dirty-keys",
      JSON.stringify(["skill-mastery"])
    );
    localStorage.setItem(
      "hunter-tutor:TestUser:skill-mastery",
      JSON.stringify([{ skillId: "local_skill", level: 5 }])
    );

    const fetchCalls: { method?: string; body?: string }[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      fetchCalls.push({ method: opts?.method, body: opts?.body as string });
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            progress: { "skill-mastery": [{ skillId: "server_skill", level: 2 }] },
            timestamps: {},
          }),
      });
    });

    await initializeFromServer("TestUser");

    // First call should be POST (push dirty), second should be GET (pull)
    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[0].method).toBe("POST");
    expect(fetchCalls[1].method).toBeUndefined(); // GET has no method set

    // Verify dirty data was sent in POST
    const postBody = JSON.parse(fetchCalls[0].body!);
    expect(postBody.progress["skill-mastery"]).toEqual([
      { skillId: "local_skill", level: 5 },
    ]);
  });

  it("clears dirty keys after successful sync", async () => {
    localStorage.setItem(
      "hunter-tutor:dirty-keys",
      JSON.stringify(["mistakes"])
    );
    localStorage.setItem(
      "hunter-tutor:TestUser:mistakes",
      JSON.stringify([])
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {}, timestamps: {} }),
    });

    await initializeFromServer("TestUser");

    expect(localStorage.getItem("hunter-tutor:dirty-keys")).toBeNull();
  });

  it("returns false when server request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    const result = await initializeFromServer("TestUser");
    expect(result).toBe(false);
  });

  it("returns false when network error occurs", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await initializeFromServer("TestUser");
    expect(result).toBe(false);
  });
});

// ─── scheduleSyncToServer debounce timing ─────────────────────────────────

describe("scheduleSyncToServer debounce", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses 2000ms debounce (not 5000ms)", async () => {
    const mod = await import("./auth-client");

    // Set up some data so sync has something to send
    localStorage.setItem(
      "hunter-tutor:TestUser:skill-mastery",
      JSON.stringify([])
    );

    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    // Ensure navigator.onLine is true
    vi.stubGlobal("navigator", { ...navigator, onLine: true });

    mod.scheduleSyncToServer("TestUser");

    // At 1999ms, fetch should NOT have been called
    await vi.advanceTimersByTimeAsync(1999);
    expect(global.fetch).not.toHaveBeenCalled();

    // At 2000ms, fetch SHOULD be called
    await vi.advanceTimersByTimeAsync(1);
    expect(global.fetch).toHaveBeenCalled();
  });
});

// ─── time-budget dirty tracking ───────────────────────────────────────────

describe("saveTimeBudget dirty tracking", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("marks time-budget as dirty when saveTimeBudget is called via regeneratePlanWithBudget", async () => {
    // Set up active user context
    localStorage.setItem("hunter-tutor:active-user", "TestUser");
    localStorage.setItem(
      "hunter-tutor:auth-user",
      JSON.stringify({ id: "1", name: "TestUser", email: "test@test.com" })
    );

    // Prevent actual sync from firing
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { regeneratePlanWithBudget } = await import("./daily-plan");
    regeneratePlanWithBudget(45);

    // Check that time-budget is in the dirty keys
    const dirtyRaw = localStorage.getItem("hunter-tutor:dirty-keys");
    expect(dirtyRaw).not.toBeNull();
    const dirtyKeys = JSON.parse(dirtyRaw!);
    expect(dirtyKeys).toContain("time-budget");
  });
});
