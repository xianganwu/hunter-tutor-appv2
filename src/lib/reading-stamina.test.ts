import { describe, it, expect } from "vitest";
import {
  computeWPM,
  detectSpeedDrop,
  shouldAdvanceLevel,
  getStaminaLevel,
  selectPassageForLevel,
  computeStaminaStats,
  recordReading,
  staminaLevelToTier,
  RC_SKILL_NAMES,
  STAMINA_LEVELS,
  MIN_ACCEPTABLE_WPM,
  SPEED_DROP_THRESHOLD,
} from "./reading-stamina";
import type { ReadingRecord } from "./reading-stamina";
import type { Passage } from "@/lib/types";

function makeRecord(overrides: Partial<ReadingRecord> = {}): ReadingRecord {
  return {
    passageId: "test-1",
    passageTitle: "Test Passage",
    wordCount: 300,
    readingTimeSeconds: 120,
    wpm: 150,
    staminaLevel: 1,
    questionsCorrect: 4,
    questionsTotal: 5,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makePassage(id: string, wordCount: number): Passage {
  return {
    metadata: {
      passage_id: id,
      title: `Passage ${id}`,
      genre: "fiction",
      difficulty_level: 1,
      word_count: wordCount,
      tagged_skills: ["rc_main_idea"],
      source_description: "test",
    },
    pre_reading_context: "Test context",
    passage_text: "x ".repeat(wordCount),
    questions: [],
  };
}

// ─── computeWPM ───────────────────────────────────────────────────────

describe("computeWPM", () => {
  it("computes words per minute correctly", () => {
    // 300 words in 120 seconds = 150 WPM
    expect(computeWPM(300, 120)).toBe(150);
  });

  it("returns 0 for zero time", () => {
    expect(computeWPM(300, 0)).toBe(0);
  });

  it("returns 0 for negative time", () => {
    expect(computeWPM(300, -10)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    // 250 words in 90 seconds = 166.67 WPM → 167
    expect(computeWPM(250, 90)).toBe(167);
  });

  it("handles large word counts", () => {
    // 800 words in 240 seconds = 200 WPM
    expect(computeWPM(800, 240)).toBe(200);
  });
});

// ─── detectSpeedDrop ──────────────────────────────────────────────────

describe("detectSpeedDrop", () => {
  it("returns null with fewer than 3 records", () => {
    const records = [makeRecord({ wpm: 200 }), makeRecord({ wpm: 100 })];
    expect(detectSpeedDrop(records)).toBeNull();
  });

  it("returns null when speed is stable", () => {
    const records = [
      makeRecord({ wpm: 150 }),
      makeRecord({ wpm: 155 }),
      makeRecord({ wpm: 148 }),
      makeRecord({ wpm: 152 }),
    ];
    expect(detectSpeedDrop(records)).toBeNull();
  });

  it("detects a significant speed drop", () => {
    const records = [
      makeRecord({ wpm: 200 }),
      makeRecord({ wpm: 195 }),
      makeRecord({ wpm: 205 }),
      makeRecord({ wpm: 140 }), // ~30% drop from avg ~200
    ];
    const drop = detectSpeedDrop(records);
    expect(drop).not.toBeNull();
    expect(drop!).toBeGreaterThanOrEqual(SPEED_DROP_THRESHOLD);
  });

  it("ignores minor speed decreases", () => {
    const records = [
      makeRecord({ wpm: 200 }),
      makeRecord({ wpm: 195 }),
      makeRecord({ wpm: 205 }),
      makeRecord({ wpm: 185 }), // ~7.5% drop, below threshold
    ];
    expect(detectSpeedDrop(records)).toBeNull();
  });

  it("uses only last 5 records for average", () => {
    // Old fast records shouldn't inflate the baseline
    const records = [
      makeRecord({ wpm: 300 }), // old, excluded from window
      makeRecord({ wpm: 300 }), // old, excluded from window
      makeRecord({ wpm: 150 }),
      makeRecord({ wpm: 155 }),
      makeRecord({ wpm: 148 }),
      makeRecord({ wpm: 152 }),
      makeRecord({ wpm: 145 }),
      makeRecord({ wpm: 130 }), // compared to avg of last 5 (~150)
    ];
    const drop = detectSpeedDrop(records);
    // avg of 150,155,148,152,145 = 150; 130 is ~13% drop, below 20%
    expect(drop).toBeNull();
  });
});

// ─── shouldAdvanceLevel ───────────────────────────────────────────────

describe("shouldAdvanceLevel", () => {
  it("returns false with no records", () => {
    expect(shouldAdvanceLevel(1, [])).toBe(false);
  });

  it("returns false with only 1 good reading at level", () => {
    const records = [makeRecord({ staminaLevel: 1, wpm: 200 })];
    expect(shouldAdvanceLevel(1, records)).toBe(false);
  });

  it("returns true with 2 good readings at level", () => {
    const records = [
      makeRecord({ staminaLevel: 1, wpm: 200 }),
      makeRecord({ staminaLevel: 1, wpm: 180 }),
    ];
    expect(shouldAdvanceLevel(1, records)).toBe(true);
  });

  it("ignores readings below minimum WPM", () => {
    const records = [
      makeRecord({ staminaLevel: 1, wpm: MIN_ACCEPTABLE_WPM - 1 }),
      makeRecord({ staminaLevel: 1, wpm: MIN_ACCEPTABLE_WPM - 10 }),
    ];
    expect(shouldAdvanceLevel(1, records)).toBe(false);
  });

  it("ignores readings from other levels", () => {
    const records = [
      makeRecord({ staminaLevel: 2, wpm: 200 }),
      makeRecord({ staminaLevel: 2, wpm: 200 }),
    ];
    expect(shouldAdvanceLevel(1, records)).toBe(false);
  });

  it("returns false at max level", () => {
    const maxLevel = STAMINA_LEVELS.length;
    const records = [
      makeRecord({ staminaLevel: maxLevel, wpm: 200 }),
      makeRecord({ staminaLevel: maxLevel, wpm: 200 }),
    ];
    expect(shouldAdvanceLevel(maxLevel, records)).toBe(false);
  });
});

// ─── getStaminaLevel ──────────────────────────────────────────────────

describe("getStaminaLevel", () => {
  it("returns level 1 config", () => {
    const level = getStaminaLevel(1);
    expect(level.level).toBe(1);
    expect(level.minWords).toBe(200);
    expect(level.maxWords).toBe(300);
  });

  it("returns last level for out-of-range input", () => {
    const level = getStaminaLevel(99);
    expect(level.level).toBe(STAMINA_LEVELS.length);
  });

  it("clamps to level 1 for zero or negative input", () => {
    expect(getStaminaLevel(0).level).toBe(1);
    expect(getStaminaLevel(-1).level).toBe(1);
  });
});

// ─── selectPassageForLevel ────────────────────────────────────────────

describe("selectPassageForLevel", () => {
  const passages = [
    makePassage("short-1", 250),
    makePassage("short-2", 280),
    makePassage("medium-1", 350),
    makePassage("medium-2", 380),
    makePassage("long-1", 450),
  ];

  it("selects a passage in the right word count range", () => {
    const result = selectPassageForLevel(1, [], passages);
    expect(result).not.toBeNull();
    expect(result!.metadata.word_count).toBeLessThanOrEqual(350);
  });

  it("skips completed passages", () => {
    const result = selectPassageForLevel(1, ["short-1", "short-2"], passages);
    // Only medium and long passages left; level 1 range is 200-300 (+50 tolerance = up to 350)
    expect(result).not.toBeNull();
    expect(result!.metadata.passage_id).toBe("medium-1");
  });

  it("returns null when no passages match", () => {
    const result = selectPassageForLevel(6, [], passages);
    // Level 6 wants 750-850 words, nothing in library
    expect(result).toBeNull();
  });

  it("prefers passages closest to range midpoint", () => {
    const result = selectPassageForLevel(1, [], passages);
    // Level 1 midpoint = 250, short-1 (250) is closest
    expect(result!.metadata.passage_id).toBe("short-1");
  });
});

// ─── computeStaminaStats ─────────────────────────────────────────────

describe("computeStaminaStats", () => {
  it("returns zeros for empty records", () => {
    const stats = computeStaminaStats([]);
    expect(stats.averageWpm).toBe(0);
    expect(stats.bestWpm).toBe(0);
    expect(stats.totalPassages).toBe(0);
    expect(stats.totalWordsRead).toBe(0);
  });

  it("computes correct stats", () => {
    const records = [
      makeRecord({ wpm: 150, wordCount: 300 }),
      makeRecord({ wpm: 200, wordCount: 400 }),
      makeRecord({ wpm: 180, wordCount: 350 }),
    ];
    const stats = computeStaminaStats(records);
    expect(stats.averageWpm).toBe(177); // (150+200+180)/3 = 176.67 → 177
    expect(stats.bestWpm).toBe(200);
    expect(stats.totalPassages).toBe(3);
    expect(stats.totalWordsRead).toBe(1050);
  });
});

// ─── recordReading ────────────────────────────────────────────────────

describe("recordReading", () => {
  it("adds record and tracks completed passage", () => {
    const progress = { currentLevel: 1, records: [], completedPassageIds: [] };
    const record = makeRecord({ passageId: "p1", staminaLevel: 1, wpm: 200 });
    const { progress: updated } = recordReading(progress, record);

    expect(updated.records).toHaveLength(1);
    expect(updated.completedPassageIds).toContain("p1");
  });

  it("advances level after enough good readings", () => {
    const progress = {
      currentLevel: 1,
      records: [makeRecord({ staminaLevel: 1, wpm: 200 })],
      completedPassageIds: ["p1"],
    };
    const record = makeRecord({ passageId: "p2", staminaLevel: 1, wpm: 180 });
    const { progress: updated, advanced } = recordReading(progress, record);

    expect(advanced).toBe(true);
    expect(updated.currentLevel).toBe(2);
  });

  it("does not advance if WPM is too low", () => {
    const progress = {
      currentLevel: 1,
      records: [makeRecord({ staminaLevel: 1, wpm: 200 })],
      completedPassageIds: ["p1"],
    };
    const record = makeRecord({ passageId: "p2", staminaLevel: 1, wpm: 50 });
    const { progress: updated, advanced } = recordReading(progress, record);

    expect(advanced).toBe(false);
    expect(updated.currentLevel).toBe(1);
  });

  it("caps level at maximum", () => {
    const maxLevel = STAMINA_LEVELS.length;
    const progress = {
      currentLevel: maxLevel,
      records: [
        makeRecord({ staminaLevel: maxLevel, wpm: 200 }),
      ],
      completedPassageIds: ["p1"],
    };
    const record = makeRecord({ passageId: "p2", staminaLevel: maxLevel, wpm: 200 });
    const { progress: updated, advanced } = recordReading(progress, record);

    expect(advanced).toBe(false);
    expect(updated.currentLevel).toBe(maxLevel);
  });
});

// ─── Constants ────────────────────────────────────────────────────────

describe("constants", () => {
  it("has 6 stamina levels", () => {
    expect(STAMINA_LEVELS).toHaveLength(6);
  });

  it("levels have increasing word counts", () => {
    for (let i = 1; i < STAMINA_LEVELS.length; i++) {
      expect(STAMINA_LEVELS[i].minWords).toBeGreaterThan(
        STAMINA_LEVELS[i - 1].minWords
      );
    }
  });

  it("starts at 200 words and ends at 850", () => {
    expect(STAMINA_LEVELS[0].minWords).toBe(200);
    expect(STAMINA_LEVELS[STAMINA_LEVELS.length - 1].maxWords).toBe(850);
  });
});

// ─── staminaLevelToTier ─────────────────────────────────────────────

describe("staminaLevelToTier", () => {
  it("maps stamina level 1 to tier 1", () => {
    expect(staminaLevelToTier(1)).toBe(1);
  });

  it("maps stamina level 2 to tier 2", () => {
    expect(staminaLevelToTier(2)).toBe(2);
  });

  it("maps stamina level 3 to tier 3", () => {
    expect(staminaLevelToTier(3)).toBe(3);
  });

  it("maps stamina levels 4-5 to tier 4", () => {
    expect(staminaLevelToTier(4)).toBe(4);
    expect(staminaLevelToTier(5)).toBe(4);
  });

  it("maps stamina level 6+ to tier 5", () => {
    expect(staminaLevelToTier(6)).toBe(5);
    expect(staminaLevelToTier(7)).toBe(5);
  });

  it("handles edge case of 0 or negative", () => {
    expect(staminaLevelToTier(0)).toBe(1);
    expect(staminaLevelToTier(-1)).toBe(1);
  });
});

// ─── RC_SKILL_NAMES ─────────────────────────────────────────────────

describe("RC_SKILL_NAMES", () => {
  it("has entries for all 14 reading skills plus rc_general", () => {
    expect(Object.keys(RC_SKILL_NAMES).length).toBe(15);
  });

  it("maps rc_main_idea to Main Idea", () => {
    expect(RC_SKILL_NAMES["rc_main_idea"]).toBe("Main Idea");
  });

  it("maps rc_inference to Inference", () => {
    expect(RC_SKILL_NAMES["rc_inference"]).toBe("Inference");
  });

  it("maps rc_general to Reading Comprehension", () => {
    expect(RC_SKILL_NAMES["rc_general"]).toBe("Reading Comprehension");
  });
});
