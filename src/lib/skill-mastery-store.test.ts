import { describe, it, expect, beforeEach } from "vitest";
import {
  loadSkillMastery,
  saveSkillMastery,
  loadReadingAttemptWindow,
  saveReadingAttemptWindow,
} from "./skill-mastery-store";
import type { StoredSkillMastery } from "./skill-mastery-store";
import type { AttemptRecord } from "./adaptive";

const STORAGE_KEY = "hunter-tutor-skill-mastery";
const READING_ATTEMPTS_KEY = "hunter-tutor-reading-attempts";

function makeMastery(
  overrides: Partial<StoredSkillMastery> = {}
): StoredSkillMastery {
  return {
    skillId: "rc_main_idea",
    masteryLevel: 0.65,
    attemptsCount: 10,
    correctCount: 7,
    lastPracticed: new Date().toISOString(),
    confidenceTrend: "stable",
    ...overrides,
  };
}

function isLocalStorageAvailable(): boolean {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch {
    return false;
  }
}

beforeEach(() => {
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(READING_ATTEMPTS_KEY);
  }
});

describe("loadSkillMastery", () => {
  it("returns null for unknown skill", () => {
    expect(loadSkillMastery("nonexistent")).toBeNull();
  });

  it("returns stored mastery for a known skill", () => {
    if (!isLocalStorageAvailable()) return;
    const data = makeMastery({ skillId: "rc_inference", masteryLevel: 0.72 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([data]));

    const result = loadSkillMastery("rc_inference");
    expect(result).not.toBeNull();
    expect(result!.masteryLevel).toBe(0.72);
    expect(result!.skillId).toBe("rc_inference");
  });

  it("handles corrupted localStorage gracefully", () => {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(loadSkillMastery("anything")).toBeNull();
  });
});

describe("saveSkillMastery", () => {
  it("saves new skill mastery", () => {
    if (!isLocalStorageAvailable()) return;
    saveSkillMastery(makeMastery({ skillId: "ma_percent_problems" }));

    const result = loadSkillMastery("ma_percent_problems");
    expect(result).not.toBeNull();
    expect(result!.masteryLevel).toBe(0.65);
  });

  it("updates existing skill mastery", () => {
    if (!isLocalStorageAvailable()) return;
    saveSkillMastery(makeMastery({ skillId: "rc_main_idea", masteryLevel: 0.5 }));
    saveSkillMastery(makeMastery({ skillId: "rc_main_idea", masteryLevel: 0.8 }));

    const result = loadSkillMastery("rc_main_idea");
    expect(result!.masteryLevel).toBe(0.8);
  });

  it("preserves other skills when updating one", () => {
    if (!isLocalStorageAvailable()) return;
    saveSkillMastery(makeMastery({ skillId: "skill_a", masteryLevel: 0.3 }));
    saveSkillMastery(makeMastery({ skillId: "skill_b", masteryLevel: 0.7 }));
    saveSkillMastery(makeMastery({ skillId: "skill_a", masteryLevel: 0.9 }));

    expect(loadSkillMastery("skill_a")!.masteryLevel).toBe(0.9);
    expect(loadSkillMastery("skill_b")!.masteryLevel).toBe(0.7);
  });
});

// ─── Reading Attempt Rolling Window ──────────────────────────────────

function makeAttempt(isCorrect: boolean, tier: 1 | 2 | 3 | 4 | 5 = 3): AttemptRecord {
  return { isCorrect, timeSpentSeconds: null, hintUsed: false, tier };
}

describe("loadReadingAttemptWindow", () => {
  it("returns empty array for unknown skill", () => {
    expect(loadReadingAttemptWindow("rc_nonexistent")).toEqual([]);
  });

  it("returns empty array when localStorage is empty", () => {
    expect(loadReadingAttemptWindow("rc_main_idea")).toEqual([]);
  });
});

describe("saveReadingAttemptWindow", () => {
  it("saves and loads attempts for a skill", () => {
    if (!isLocalStorageAvailable()) return;
    const attempts = [makeAttempt(true), makeAttempt(false)];
    saveReadingAttemptWindow("rc_inference", attempts);

    const loaded = loadReadingAttemptWindow("rc_inference");
    expect(loaded).toHaveLength(2);
    expect(loaded[0].isCorrect).toBe(true);
    expect(loaded[1].isCorrect).toBe(false);
  });

  it("caps at 10 attempts", () => {
    if (!isLocalStorageAvailable()) return;
    const attempts = Array.from({ length: 15 }, (_, i) => makeAttempt(i % 2 === 0));
    saveReadingAttemptWindow("rc_main_idea", attempts);

    const loaded = loadReadingAttemptWindow("rc_main_idea");
    expect(loaded).toHaveLength(10);
    // Should keep the last 10
    expect(loaded[0].isCorrect).toBe(false); // index 5 from original (odd)
  });

  it("preserves other skills when saving", () => {
    if (!isLocalStorageAvailable()) return;
    saveReadingAttemptWindow("rc_main_idea", [makeAttempt(true)]);
    saveReadingAttemptWindow("rc_inference", [makeAttempt(false)]);

    expect(loadReadingAttemptWindow("rc_main_idea")).toHaveLength(1);
    expect(loadReadingAttemptWindow("rc_main_idea")[0].isCorrect).toBe(true);
    expect(loadReadingAttemptWindow("rc_inference")).toHaveLength(1);
    expect(loadReadingAttemptWindow("rc_inference")[0].isCorrect).toBe(false);
  });

  it("handles corrupted localStorage gracefully", () => {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem(READING_ATTEMPTS_KEY, "not json");
    expect(loadReadingAttemptWindow("rc_main_idea")).toEqual([]);
  });
});
