import { describe, it, expect, beforeEach } from "vitest";
import {
  computeDrillDifficultyTier,
  persistDrillMastery,
  computeDrillStreakTier,
} from "./useDrillSession";

// ─── Mock localStorage ──────────────────────────────────────────────

const store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage });

function clearStore() {
  mockLocalStorage.clear();
}

// ─── computeDrillDifficultyTier ─────────────────────────────────────

describe("computeDrillDifficultyTier", () => {
  it("returns skill default tier when no mastery exists", () => {
    const tier = computeDrillDifficultyTier(null, 3);
    expect(tier).toBe(3);
  });

  it("clamps skill default tier to valid range", () => {
    expect(computeDrillDifficultyTier(null, 0)).toBe(1);
    expect(computeDrillDifficultyTier(null, 6)).toBe(5);
    expect(computeDrillDifficultyTier(null, -1)).toBe(1);
  });

  it("returns skill default when mastery has zero attempts", () => {
    const tier = computeDrillDifficultyTier(
      {
        skillId: "test",
        masteryLevel: 0,
        attemptsCount: 0,
        correctCount: 0,
        lastPracticed: new Date().toISOString(),
        confidenceTrend: "stable" as const,
      },
      2,
    );
    expect(tier).toBe(2);
  });

  it("maps high mastery to tier 5", () => {
    const tier = computeDrillDifficultyTier(
      {
        skillId: "test",
        masteryLevel: 0.85,
        attemptsCount: 20,
        correctCount: 17,
        lastPracticed: new Date().toISOString(),
        confidenceTrend: "stable" as const,
      },
      2,
    );
    expect(tier).toBe(5);
  });

  it("maps low mastery to tier 1", () => {
    const tier = computeDrillDifficultyTier(
      {
        skillId: "test",
        masteryLevel: 0.1,
        attemptsCount: 5,
        correctCount: 1,
        lastPracticed: new Date().toISOString(),
        confidenceTrend: "declining" as const,
      },
      3,
    );
    expect(tier).toBe(1);
  });

  it("maps mid-range mastery to tier 3", () => {
    const tier = computeDrillDifficultyTier(
      {
        skillId: "test",
        masteryLevel: 0.5,
        attemptsCount: 10,
        correctCount: 5,
        lastPracticed: new Date().toISOString(),
        confidenceTrend: "stable" as const,
      },
      2,
    );
    expect(tier).toBe(3);
  });

  it("maps mastery 0.65 to tier 4", () => {
    const tier = computeDrillDifficultyTier(
      {
        skillId: "test",
        masteryLevel: 0.65,
        attemptsCount: 15,
        correctCount: 10,
        lastPracticed: new Date().toISOString(),
        confidenceTrend: "improving" as const,
      },
      2,
    );
    expect(tier).toBe(4);
  });
});

// ─── persistDrillMastery ────────────────────────────────────────────

describe("persistDrillMastery", () => {
  beforeEach(clearStore);

  it("creates mastery entry for drill-only user (no prior mastery)", () => {
    const result = persistDrillMastery(
      "skill_a",
      null,
      [
        { isCorrect: true, timeSpentMs: 5000 },
        { isCorrect: true, timeSpentMs: 4000 },
        { isCorrect: false, timeSpentMs: 6000 },
      ],
      3,
    );

    expect(result).toBeDefined();
    expect(result!.masteryLevel).toBeGreaterThan(0);
    expect(result!.attemptsCount).toBe(3);
    expect(result!.correctCount).toBe(2);
    expect(result!.skillId).toBe("skill_a");
  });

  it("updates existing mastery entry with cumulative counts", () => {
    const prior = {
      skillId: "skill_b",
      masteryLevel: 0.5,
      attemptsCount: 20,
      correctCount: 10,
      lastPracticed: "2026-03-01T00:00:00.000Z",
      confidenceTrend: "stable" as const,
    };

    const result = persistDrillMastery(
      "skill_b",
      prior,
      [
        { isCorrect: true, timeSpentMs: 3000 },
        { isCorrect: true, timeSpentMs: 4000 },
        { isCorrect: true, timeSpentMs: 5000 },
      ],
      3,
    );

    expect(result).toBeDefined();
    expect(result!.attemptsCount).toBe(23); // 20 + 3
    expect(result!.correctCount).toBe(13); // 10 + 3
  });

  it("blends prior history with session attempts for mastery level", () => {
    // Prior: 50% accuracy over 20 attempts
    const prior = {
      skillId: "skill_blend",
      masteryLevel: 0.5,
      attemptsCount: 20,
      correctCount: 10,
      lastPracticed: "2026-03-01T00:00:00.000Z",
      confidenceTrend: "stable" as const,
    };

    // Session: 100% accuracy
    const sessionAllCorrect = persistDrillMastery(
      "skill_blend",
      prior,
      [
        { isCorrect: true, timeSpentMs: 3000 },
        { isCorrect: true, timeSpentMs: 4000 },
        { isCorrect: true, timeSpentMs: 5000 },
      ],
      3,
    );

    // Session-only computation (no prior) with same attempts
    const sessionOnly = persistDrillMastery(
      "skill_new",
      null,
      [
        { isCorrect: true, timeSpentMs: 3000 },
        { isCorrect: true, timeSpentMs: 4000 },
        { isCorrect: true, timeSpentMs: 5000 },
      ],
      3,
    );

    // With prior 50% history, the blended mastery should be LOWER than session-only
    // because the prior history dilutes the perfect session
    expect(sessionAllCorrect!.masteryLevel).toBeLessThan(
      sessionOnly!.masteryLevel,
    );
  });

  it("returns null for empty attempts", () => {
    const result = persistDrillMastery("skill_c", null, [], 3);
    expect(result).toBeNull();
  });

  it("updates SM-2 scheduling fields", () => {
    const result = persistDrillMastery(
      "skill_d",
      null,
      [
        { isCorrect: true, timeSpentMs: 3000 },
        { isCorrect: true, timeSpentMs: 4000 },
      ],
      3,
    );

    expect(result).toBeDefined();
    expect(result!.interval).toBeDefined();
    expect(result!.easeFactor).toBeDefined();
    expect(result!.nextReviewDate).toBeDefined();
  });

  it("sets lastPracticed to recent timestamp", () => {
    const before = Date.now();
    const result = persistDrillMastery(
      "skill_e",
      null,
      [{ isCorrect: true, timeSpentMs: 3000 }],
      3,
    );
    const after = Date.now();

    expect(result).toBeDefined();
    const ts = new Date(result!.lastPracticed).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("preserves existing SM-2 fields from prior mastery", () => {
    const prior = {
      skillId: "skill_f",
      masteryLevel: 0.6,
      attemptsCount: 10,
      correctCount: 6,
      lastPracticed: "2026-03-01T00:00:00.000Z",
      confidenceTrend: "stable" as const,
      interval: 6,
      easeFactor: 2.5,
      nextReviewDate: Date.now() + 86400000,
      repetitions: 2,
    };

    const result = persistDrillMastery(
      "skill_f",
      prior,
      [{ isCorrect: true, timeSpentMs: 3000 }],
      3,
    );

    // SM-2 schedule should be updated (not just carried forward)
    expect(result).toBeDefined();
    expect(result!.interval).toBeDefined();
    expect(result!.easeFactor).toBeDefined();
  });
});

// ─── computeDrillStreakTier ─────────────────────────────────────────

describe("computeDrillStreakTier", () => {
  it("returns base tier with no attempts", () => {
    const tier = computeDrillStreakTier(3, []);
    expect(tier).toBe(3);
  });

  it("advances tier after 3 consecutive correct answers", () => {
    const attempts = [
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
    ];
    const tier = computeDrillStreakTier(3, attempts);
    expect(tier).toBe(4);
  });

  it("drops tier after 2 consecutive wrong answers", () => {
    const attempts = [
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: false },
    ];
    const tier = computeDrillStreakTier(3, attempts);
    expect(tier).toBe(2);
  });

  it("does not advance above tier 5", () => {
    const attempts = [
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
    ];
    const tier = computeDrillStreakTier(5, attempts);
    expect(tier).toBe(5);
  });

  it("does not drop below tier 1", () => {
    const attempts = [{ isCorrect: false }, { isCorrect: false }];
    const tier = computeDrillStreakTier(1, attempts);
    expect(tier).toBe(1);
  });

  it("stays at base tier with mixed results", () => {
    const attempts = [
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: true },
      { isCorrect: false },
    ];
    const tier = computeDrillStreakTier(3, attempts);
    expect(tier).toBe(3);
  });

  it("uses only trailing streak (ignores earlier results)", () => {
    // 2 wrong then 3 correct -> trailing streak is correct
    const attempts = [
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
    ];
    const tier = computeDrillStreakTier(3, attempts);
    expect(tier).toBe(4);
  });

  it("handles single correct answer (no advancement)", () => {
    const tier = computeDrillStreakTier(3, [{ isCorrect: true }]);
    expect(tier).toBe(3);
  });

  it("handles single wrong answer (no drop)", () => {
    const tier = computeDrillStreakTier(3, [{ isCorrect: false }]);
    expect(tier).toBe(3);
  });

  it("advances from tier 1 to tier 2", () => {
    const attempts = [
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
    ];
    const tier = computeDrillStreakTier(1, attempts);
    expect(tier).toBe(2);
  });
});
