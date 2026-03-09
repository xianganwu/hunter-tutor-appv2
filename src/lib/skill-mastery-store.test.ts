import { describe, it, expect, beforeEach } from "vitest";
import { loadSkillMastery, saveSkillMastery } from "./skill-mastery-store";
import type { StoredSkillMastery } from "./skill-mastery-store";

const STORAGE_KEY = "hunter-tutor-skill-mastery";

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
