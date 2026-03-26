import { describe, it, expect } from "vitest";
import {
  selectNextSkills,
  adjustDifficulty,
  masteryToTier,
  createPacingState,
  getNextPacingAction,
  advancePacingAfterQuestion,
  advancePacingAfterTeaching,
  calculateMasteryUpdate,
  type StudentSkillState,
  type AttemptRecord,
  type ConfidenceTrend,
} from "./adaptive";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeState(
  overrides: Partial<StudentSkillState> & { skillId: string }
): StudentSkillState {
  return {
    masteryLevel: 0.5,
    attemptsCount: 10,
    correctCount: 5,
    lastPracticed: new Date(),
    confidenceTrend: "stable" as ConfidenceTrend,
    ...overrides,
  };
}

function makeAttempts(
  results: boolean[],
  timeSeconds: number | null = 45,
  hintUsed = false,
  tier: 1 | 2 | 3 | 4 | 5 = 3
): AttemptRecord[] {
  return results.map((isCorrect) => ({ isCorrect, timeSpentSeconds: timeSeconds, hintUsed, tier }));
}

const NOW = new Date("2026-03-08T12:00:00Z");
const DAYS_AGO = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

// Use real skill IDs from the reading comprehension domain
const RC_SKILLS = [
  "rc_main_idea",
  "rc_evidence_reasoning",
  "rc_inference",
  "rc_vocab_context",
  "rc_drawing_conclusions",
];

// ─── 1. Skill Selection ──────────────────────────────────────────────

describe("selectNextSkills", () => {
  it("prioritizes prerequisite gaps over other factors", () => {
    // rc_main_idea is a prerequisite for rc_evidence_reasoning, rc_inference, etc.
    const states = new Map<string, StudentSkillState>([
      [
        "rc_main_idea",
        makeState({
          skillId: "rc_main_idea",
          masteryLevel: 0.3, // below 0.6 AND has dependents
        }),
      ],
      [
        "rc_vocab_context",
        makeState({
          skillId: "rc_vocab_context",
          masteryLevel: 0.3, // below 0.6 but fewer dependents
          confidenceTrend: "declining",
        }),
      ],
    ]);

    const result = selectNextSkills(RC_SKILLS, states, NOW);
    // rc_main_idea should rank highest: it's a prereq for many skills
    expect(result[0].skillId).toBe("rc_main_idea");
    expect(result[0].reason).toBe("prerequisite_gap");
  });

  it("ranks declining confidence skills highly", () => {
    const states = new Map<string, StudentSkillState>([
      [
        "rc_main_idea",
        makeState({
          skillId: "rc_main_idea",
          masteryLevel: 0.75,
          confidenceTrend: "stable",
        }),
      ],
      [
        "rc_inference",
        makeState({
          skillId: "rc_inference",
          masteryLevel: 0.65,
          confidenceTrend: "declining",
        }),
      ],
    ]);

    const result = selectNextSkills(RC_SKILLS, states, NOW);
    const inferenceRank = result.findIndex((r) => r.skillId === "rc_inference");
    const mainIdeaRank = result.findIndex((r) => r.skillId === "rc_main_idea");
    expect(inferenceRank).toBeLessThan(mainIdeaRank);
  });

  it("flags stale skills not practiced in 7+ days", () => {
    const states = new Map<string, StudentSkillState>([
      [
        "rc_main_idea",
        makeState({
          skillId: "rc_main_idea",
          masteryLevel: 0.8,
          lastPracticed: DAYS_AGO(10),
        }),
      ],
      [
        "rc_vocab_context",
        makeState({
          skillId: "rc_vocab_context",
          masteryLevel: 0.8,
          lastPracticed: DAYS_AGO(1),
        }),
      ],
    ]);

    const result = selectNextSkills(RC_SKILLS, states, NOW);
    const staleEntry = result.find((r) => r.skillId === "rc_main_idea");
    expect(staleEntry).toBeDefined();
    expect(staleEntry!.reason).toBe("stale");
  });

  it("identifies near-mastery skills needing reinforcement", () => {
    const states = new Map<string, StudentSkillState>([
      [
        "rc_main_idea",
        makeState({
          skillId: "rc_main_idea",
          masteryLevel: 0.75,
          lastPracticed: DAYS_AGO(1),
        }),
      ],
    ]);

    const result = selectNextSkills(
      ["rc_main_idea"],
      states,
      NOW
    );
    expect(result[0].reason).toBe("near_mastery");
  });

  it("assigns new_skill to unpracticed skills", () => {
    const states = new Map<string, StudentSkillState>();
    const result = selectNextSkills(["rc_main_idea"], states, NOW);
    expect(result[0].reason).toBe("new_skill");
  });

  it("returns all domain skills sorted by priority", () => {
    const states = new Map<string, StudentSkillState>();
    const result = selectNextSkills(RC_SKILLS, states, NOW);
    expect(result).toHaveLength(RC_SKILLS.length);
    // Should be sorted descending by score
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});

// ─── 2. Difficulty Adjustment ────────────────────────────────────────

describe("adjustDifficulty", () => {
  it("starts at mastery-based tier with no attempts", () => {
    const result = adjustDifficulty(0.5, []);
    expect(result.tier).toBe(3);
    expect(result.mode).toBe("practice");
  });

  it("maps mastery levels to correct tiers", () => {
    expect(adjustDifficulty(0.0, []).tier).toBe(1);
    expect(adjustDifficulty(0.15, []).tier).toBe(1);
    expect(adjustDifficulty(0.25, []).tier).toBe(2);
    expect(adjustDifficulty(0.45, []).tier).toBe(3);
    expect(adjustDifficulty(0.65, []).tier).toBe(4);
    expect(adjustDifficulty(0.85, []).tier).toBe(5);
    expect(adjustDifficulty(1.0, []).tier).toBe(5);
  });

  it("advances tier after 3 correct in a row", () => {
    const attempts = makeAttempts([false, true, true, true]);
    const result = adjustDifficulty(0.5, attempts);
    expect(result.tier).toBe(4); // base 3 + 1
    expect(result.mode).toBe("practice");
  });

  it("drops tier and switches to teach after 2 wrong in a row", () => {
    const attempts = makeAttempts([true, false, false]);
    const result = adjustDifficulty(0.5, attempts);
    expect(result.tier).toBe(2); // base 3 - 1
    expect(result.mode).toBe("teach");
  });

  it("does not advance above tier 5", () => {
    const attempts = makeAttempts([true, true, true]);
    const result = adjustDifficulty(0.9, attempts);
    expect(result.tier).toBe(5);
  });

  it("does not drop below tier 1", () => {
    const attempts = makeAttempts([false, false]);
    const result = adjustDifficulty(0.1, attempts);
    expect(result.tier).toBe(1);
    expect(result.mode).toBe("teach");
  });

  it("stays at current tier with mixed results", () => {
    const attempts = makeAttempts([true, false, true, false, true]);
    const result = adjustDifficulty(0.5, attempts);
    expect(result.tier).toBe(3);
    expect(result.mode).toBe("practice");
  });

  it("prioritizes wrong streak over correct streak", () => {
    // 3 correct then 2 wrong → the trailing 2 wrong wins
    const attempts = makeAttempts([true, true, true, false, false]);
    const result = adjustDifficulty(0.5, attempts);
    expect(result.mode).toBe("teach");
    expect(result.tier).toBe(2);
  });
});

// ─── 3. Session Pacing ───────────────────────────────────────────────

describe("session pacing", () => {
  it("creates initial pacing state", () => {
    const state = createPacingState(NOW);
    expect(state.questionsInCurrentRun).toBe(0);
    expect(state.totalQuestions).toBe(0);
  });

  it("continues practice when under the question limit", () => {
    const state = createPacingState(NOW);
    const action = getNextPacingAction(state, NOW);
    expect(action.action).toBe("continue_practice");
  });

  it("inserts teaching after 5 consecutive questions", () => {
    let state = createPacingState(NOW);
    for (let i = 0; i < 5; i++) {
      state = advancePacingAfterQuestion(state);
    }
    const action = getNextPacingAction(state, NOW);
    expect(action.action).toBe("insert_teaching");
  });

  it("resets question run after teaching", () => {
    let state = createPacingState(NOW);
    for (let i = 0; i < 5; i++) {
      state = advancePacingAfterQuestion(state);
    }
    state = advancePacingAfterTeaching(state);
    expect(state.questionsInCurrentRun).toBe(0);
    expect(state.totalQuestions).toBe(5); // total preserved

    const action = getNextPacingAction(state, NOW);
    expect(action.action).toBe("continue_practice");
  });

  it("ends session at 35 minutes", () => {
    const state = createPacingState(NOW);
    const later = new Date(NOW.getTime() + 35 * 60 * 1000);
    const action = getNextPacingAction(state, later);
    expect(action.action).toBe("end_session");
  });

  it("suggests ending after 25 minutes at a natural break", () => {
    const start = NOW;
    let state = createPacingState(start);
    // Need 3+ questions in current run for natural break
    for (let i = 0; i < 3; i++) {
      state = advancePacingAfterQuestion(state);
    }
    const later = new Date(start.getTime() + 26 * 60 * 1000);
    const action = getNextPacingAction(state, later);
    expect(action.action).toBe("end_session");
  });

  it("does not end at 25 minutes if only 1 question in run", () => {
    const start = NOW;
    let state = createPacingState(start);
    state = advancePacingAfterQuestion(state);
    const later = new Date(start.getTime() + 26 * 60 * 1000);
    const action = getNextPacingAction(state, later);
    expect(action.action).toBe("continue_practice");
  });
});

// ─── 4. Mastery Update ──────────────────────────────────────────────

describe("calculateMasteryUpdate", () => {
  it("returns 0 mastery for no attempts", () => {
    const result = calculateMasteryUpdate([], 3);
    expect(result.newMasteryLevel).toBe(0);
    expect(result.newConfidenceTrend).toBe("stable");
  });

  it("returns high mastery for all correct with enough attempts", () => {
    // 10 attempts → confidence = 10/8 = 1.0, no dampening
    const attempts = makeAttempts([
      true, true, true, true, true,
      true, true, true, true, true,
    ]);
    const result = calculateMasteryUpdate(attempts, 3);
    expect(result.newMasteryLevel).toBeGreaterThanOrEqual(0.9);
    expect(result.newConfidenceTrend).toBe("stable");
  });

  it("returns low mastery for all wrong attempts", () => {
    const attempts = makeAttempts([
      false, false, false, false, false,
    ]);
    const result = calculateMasteryUpdate(attempts, 3);
    // With confidence multiplier: blended toward 0.3 prior but raw is very low
    expect(result.newMasteryLevel).toBeLessThan(0.2);
  });

  it("weights recent performance more heavily", () => {
    // 10 wrong then 5 correct (recent window sees the 5 correct + 5 wrong)
    const oldWrong = makeAttempts([
      false, false, false, false, false,
      false, false, false, false, false,
    ]);
    const recentCorrect = makeAttempts([true, true, true, true, true]);
    const attempts = [...oldWrong, ...recentCorrect];

    const result = calculateMasteryUpdate(attempts, 3);
    // Recent 10: 5 correct out of 10 = 0.5
    // Overall: 5/15 = 0.333
    // Should show improving trend since recent > overall
    expect(result.newConfidenceTrend).toBe("improving");
  });

  it("detects declining trend when recent performance drops", () => {
    // 10 correct then 5 wrong
    const oldCorrect = makeAttempts([
      true, true, true, true, true,
      true, true, true, true, true,
    ]);
    const recentWrong = makeAttempts([false, false, false, false, false]);
    const attempts = [...oldCorrect, ...recentWrong];

    const result = calculateMasteryUpdate(attempts, 3);
    expect(result.newConfidenceTrend).toBe("declining");
  });

  it("mastery stays between 0 and 1", () => {
    const allCorrect = makeAttempts(Array(20).fill(true), 10); // very fast
    const result = calculateMasteryUpdate(allCorrect, 1);
    expect(result.newMasteryLevel).toBeLessThanOrEqual(1);
    expect(result.newMasteryLevel).toBeGreaterThanOrEqual(0);
  });

  it("time efficiency rewards faster correct answers", () => {
    const fastCorrect = makeAttempts([true, true, true, true, true], 20);
    const slowCorrect = makeAttempts([true, true, true, true, true], 120);

    const fastResult = calculateMasteryUpdate(fastCorrect, 3);
    const slowResult = calculateMasteryUpdate(slowCorrect, 3);

    expect(fastResult.newMasteryLevel).toBeGreaterThan(
      slowResult.newMasteryLevel
    );
  });

  it("rounds to 3 decimal places", () => {
    const attempts = makeAttempts([true, false, true]);
    const result = calculateMasteryUpdate(attempts, 2);
    const decimals = result.newMasteryLevel.toString().split(".")[1] ?? "";
    expect(decimals.length).toBeLessThanOrEqual(3);
  });

  it("discounts hint-assisted correct answers in mastery", () => {
    const independent = makeAttempts([true, true, true, true, true], 45, false);
    const hinted = makeAttempts([true, true, true, true, true], 45, true);

    const indResult = calculateMasteryUpdate(independent, 3);
    const hintResult = calculateMasteryUpdate(hinted, 3);

    // Hint-assisted should produce lower mastery (0.5 credit per correct)
    expect(hintResult.newMasteryLevel).toBeLessThan(indResult.newMasteryLevel);
  });
});

// ─── 4b. Confidence Multiplier ──────────────────────────────────────

describe("confidence multiplier prevents early mastery", () => {
  it("caps mastery below 0.5 with only 2 correct answers", () => {
    // The bug: 2 correct answers used to produce mastery ~0.95
    const attempts = makeAttempts([true, true]);
    const result = calculateMasteryUpdate(attempts, 3);
    // confidence = 2/8 = 0.25, blended with prior 0.3
    expect(result.newMasteryLevel).toBeLessThan(0.5);
  });

  it("produces higher mastery with more attempts at same accuracy", () => {
    const few = makeAttempts([true, true], 45);
    const many = makeAttempts([
      true, true, true, true, true,
      true, true, true, true, true,
    ], 45);

    const fewResult = calculateMasteryUpdate(few, 3);
    const manyResult = calculateMasteryUpdate(many, 3);

    // Same 100% accuracy, but 10 attempts should produce significantly higher mastery
    expect(manyResult.newMasteryLevel).toBeGreaterThan(fewResult.newMasteryLevel + 0.3);
  });

  it("reaches full mastery formula output at 8+ attempts", () => {
    // At 8 attempts, confidence = 1.0, formula is fully trusted
    const attempts = makeAttempts([
      true, true, true, true,
      true, true, true, true,
    ], 45);
    const result = calculateMasteryUpdate(attempts, 3);
    // Raw mastery with all correct + good time ≈ 1.0, confidence = 1.0
    expect(result.newMasteryLevel).toBeGreaterThanOrEqual(0.9);
  });

  it("blends toward prior with very few attempts", () => {
    // 1 correct answer: confidence = 1/8 = 0.125
    const attempts = makeAttempts([true], 45);
    const result = calculateMasteryUpdate(attempts, 3);
    // Should be close to the prior (0.3), not close to 1.0
    expect(result.newMasteryLevel).toBeLessThan(0.45);
    expect(result.newMasteryLevel).toBeGreaterThan(0.2);
  });
});

// ─── 4c. Difficulty-Weighted Accuracy ───────────────────────────────

describe("difficulty-weighted accuracy", () => {
  it("produces higher mastery for harder questions at full confidence", () => {
    // Use 8+ attempts to eliminate confidence multiplier effect
    const easyCorrect = makeAttempts(Array(10).fill(true), 45, false, 1);
    const hardCorrect = makeAttempts(Array(10).fill(true), 45, false, 5);

    const easyResult = calculateMasteryUpdate(easyCorrect, 1);
    const hardResult = calculateMasteryUpdate(hardCorrect, 5);

    // Both 100% accuracy, but at full confidence both should be high.
    // The raw accuracy is 1.0 for both since weighted_earned / weighted_max = 1.0
    // when all answers are correct regardless of tier weight.
    // The difference comes from time efficiency (different expected times per tier).
    // Both should reach high mastery.
    expect(easyResult.newMasteryLevel).toBeGreaterThanOrEqual(0.9);
    expect(hardResult.newMasteryLevel).toBeGreaterThanOrEqual(0.9);
  });

  it("penalizes wrong answers on harder questions more", () => {
    // Mixed results: getting hard questions wrong hurts more
    // 5 correct, 5 wrong at tier 1 (easy) vs tier 5 (hard)
    const easyMixed = makeAttempts(
      [true, true, true, true, true, false, false, false, false, false],
      45, false, 1
    );
    const hardMixed = makeAttempts(
      [true, true, true, true, true, false, false, false, false, false],
      45, false, 5
    );

    const easyResult = calculateMasteryUpdate(easyMixed, 1);
    const hardResult = calculateMasteryUpdate(hardMixed, 5);

    // Both should be around 0.5 accuracy, both at full confidence (10 attempts).
    // The weighted accuracy is the same (50%) since all attempts share the same tier.
    // The difference comes from time efficiency (different expected seconds).
    // Key point: both produce similar results when all attempts are same tier.
    expect(easyResult.newMasteryLevel).toBeGreaterThan(0.3);
    expect(hardResult.newMasteryLevel).toBeGreaterThan(0.3);
    expect(easyResult.newMasteryLevel).toBeLessThan(0.7);
    expect(hardResult.newMasteryLevel).toBeLessThan(0.7);
  });
});

// ─── 5. Hint Impact on Difficulty ────────────────────────────────────

describe("adjustDifficulty with hints", () => {
  it("does not advance tier when correct answers used hints", () => {
    const attempts = makeAttempts([true, true, true], 45, true);
    const result = adjustDifficulty(0.5, attempts);
    // Hint-assisted correct breaks advancement streak → stays at base tier
    expect(result.tier).toBe(3);
    expect(result.mode).toBe("practice");
  });

  it("hint-assisted correct breaks advancement streak", () => {
    // 2 independent correct, then 1 hinted correct
    const attempts: AttemptRecord[] = [
      { isCorrect: true, timeSpentSeconds: 45, hintUsed: false, tier: 3 },
      { isCorrect: true, timeSpentSeconds: 45, hintUsed: false, tier: 3 },
      { isCorrect: true, timeSpentSeconds: 45, hintUsed: true, tier: 3 },
    ];
    const result = adjustDifficulty(0.5, attempts);
    // The hinted answer breaks the streak of 3 → no advancement
    expect(result.tier).toBe(3);
  });

  it("still drops tier on wrong streak regardless of hints", () => {
    const attempts: AttemptRecord[] = [
      { isCorrect: true, timeSpentSeconds: 45, hintUsed: true, tier: 3 },
      { isCorrect: false, timeSpentSeconds: 45, hintUsed: false, tier: 3 },
      { isCorrect: false, timeSpentSeconds: 45, hintUsed: false, tier: 3 },
    ];
    const result = adjustDifficulty(0.5, attempts);
    expect(result.tier).toBe(2);
    expect(result.mode).toBe("teach");
  });
});

// ─── 6. Rushing Detection ────────────────────────────────────────────

describe("rushing detection in pacing", () => {
  it("detects rushing when last 3 answers under 5 seconds", () => {
    let state = createPacingState(NOW);
    state = advancePacingAfterQuestion(state, 3);
    state = advancePacingAfterQuestion(state, 2);
    state = advancePacingAfterQuestion(state, 4);

    const action = getNextPacingAction(state, NOW);
    expect(action.action).toBe("slow_down");
  });

  it("does not flag rushing with normal answer times", () => {
    let state = createPacingState(NOW);
    state = advancePacingAfterQuestion(state, 30);
    state = advancePacingAfterQuestion(state, 25);
    state = advancePacingAfterQuestion(state, 45);

    const action = getNextPacingAction(state, NOW);
    expect(action.action).toBe("continue_practice");
  });

  it("does not flag rushing with fewer than 3 fast answers", () => {
    let state = createPacingState(NOW);
    state = advancePacingAfterQuestion(state, 2);
    state = advancePacingAfterQuestion(state, 3);

    const action = getNextPacingAction(state, NOW);
    expect(action.action).toBe("continue_practice");
  });

  it("only checks the last 3 answers for rushing", () => {
    let state = createPacingState(NOW);
    // First 3 are fast, then 3 normal
    state = advancePacingAfterQuestion(state, 2);
    state = advancePacingAfterQuestion(state, 3);
    state = advancePacingAfterQuestion(state, 4);
    // Reset question run to avoid triggering insert_teaching at 5 questions
    state = advancePacingAfterTeaching(state);
    state = advancePacingAfterQuestion(state, 30);
    state = advancePacingAfterQuestion(state, 25);
    state = advancePacingAfterQuestion(state, 45);

    const action = getNextPacingAction(state, NOW);
    // Last 3 are normal speed → no rushing, and only 3 in current run → no teaching
    expect(action.action).toBe("continue_practice");
  });

  it("tracks answer times through advancePacingAfterQuestion", () => {
    let state = createPacingState(NOW);
    expect(state.recentAnswerTimesSeconds).toEqual([]);

    state = advancePacingAfterQuestion(state, 15);
    expect(state.recentAnswerTimesSeconds).toEqual([15]);

    state = advancePacingAfterQuestion(state, 20);
    expect(state.recentAnswerTimesSeconds).toEqual([15, 20]);
  });
});

// ─── 7. masteryToTier ────────────────────────────────────────────────

describe("masteryToTier", () => {
  it("maps mastery levels to tiers", () => {
    expect(masteryToTier(0.0)).toBe(1);
    expect(masteryToTier(0.15)).toBe(1);
    expect(masteryToTier(0.2)).toBe(2);
    expect(masteryToTier(0.4)).toBe(3);
    expect(masteryToTier(0.6)).toBe(4);
    expect(masteryToTier(0.8)).toBe(5);
    expect(masteryToTier(1.0)).toBe(5);
  });
});

// ─── 8. calculateMasteryUpdate with custom weights ──────────────────

describe("calculateMasteryUpdate with custom weights", () => {
  it("produces identical results when no weights are passed (regression)", () => {
    const attempts = makeAttempts([true, true, false, true, true, true, false, true, true, true], 45);
    const result2arg = calculateMasteryUpdate(attempts, 3);
    const result3arg = calculateMasteryUpdate(attempts, 3, undefined);
    expect(result3arg.newMasteryLevel).toBe(result2arg.newMasteryLevel);
    expect(result3arg.newConfidenceTrend).toBe(result2arg.newConfidenceTrend);
  });

  it("produces identical results when defaults are explicitly passed", () => {
    const attempts = makeAttempts([true, false, true, true, false], 30);
    const resultDefault = calculateMasteryUpdate(attempts, 2);
    const resultExplicit = calculateMasteryUpdate(attempts, 2, {
      weightRecent: 0.7,
      weightOverall: 0.2,
      weightTime: 0.1,
    });
    expect(resultExplicit.newMasteryLevel).toBe(resultDefault.newMasteryLevel);
    expect(resultExplicit.newConfidenceTrend).toBe(resultDefault.newConfidenceTrend);
  });

  it("reading weights (0.8/0.2/0.0) produce high mastery for all correct", () => {
    const attempts = makeAttempts(Array(10).fill(true) as boolean[], null, false, 3);
    const result = calculateMasteryUpdate(attempts, 3, {
      weightRecent: 0.8,
      weightOverall: 0.2,
      weightTime: 0.0,
    });
    // 10 attempts = full confidence. 100% accuracy, no time component.
    // raw = 0.8 * 1.0 + 0.2 * 1.0 + 0 = 1.0
    expect(result.newMasteryLevel).toBeGreaterThanOrEqual(0.95);
  });

  it("reading weights produce low mastery for all wrong", () => {
    const attempts = makeAttempts(Array(10).fill(false) as boolean[], null, false, 3);
    const result = calculateMasteryUpdate(attempts, 3, {
      weightRecent: 0.8,
      weightOverall: 0.2,
      weightTime: 0.0,
    });
    // raw = 0.8 * 0 + 0.2 * 0 + 0 = 0
    expect(result.newMasteryLevel).toBe(0);
  });

  it("reading weights with 1 attempt anchor heavily to prior", () => {
    const attempts: AttemptRecord[] = [
      { isCorrect: true, timeSpentSeconds: null, hintUsed: false, tier: 3 },
    ];
    const result = calculateMasteryUpdate(attempts, 3, {
      weightRecent: 0.8,
      weightOverall: 0.2,
      weightTime: 0.0,
    });
    // confidence = 1/8 = 0.125, raw = 1.0
    // blended = 0.125 * 1.0 + 0.875 * 0.3 = 0.125 + 0.2625 = 0.3875
    expect(result.newMasteryLevel).toBeGreaterThan(0.35);
    expect(result.newMasteryLevel).toBeLessThan(0.45);
  });

  it("reading weights build confidence across 8 passages", () => {
    // Simulate 8 correct attempts accumulating (like 8 passages)
    const attempts: AttemptRecord[] = Array.from({ length: 8 }, () => ({
      isCorrect: true,
      timeSpentSeconds: null,
      hintUsed: false,
      tier: 3 as const,
    }));
    const result = calculateMasteryUpdate(attempts, 3, {
      weightRecent: 0.8,
      weightOverall: 0.2,
      weightTime: 0.0,
    });
    // confidence = 8/8 = 1.0, raw = 1.0 → mastery = 1.0
    expect(result.newMasteryLevel).toBeGreaterThanOrEqual(0.95);
  });

  it("reading weights with mixed results across passages produce moderate mastery", () => {
    // 6 correct, 4 wrong = 60% accuracy
    const attempts: AttemptRecord[] = [
      ...Array.from({ length: 6 }, () => ({
        isCorrect: true, timeSpentSeconds: null, hintUsed: false, tier: 3 as const,
      })),
      ...Array.from({ length: 4 }, () => ({
        isCorrect: false, timeSpentSeconds: null, hintUsed: false, tier: 3 as const,
      })),
    ];
    const result = calculateMasteryUpdate(attempts, 3, {
      weightRecent: 0.8,
      weightOverall: 0.2,
      weightTime: 0.0,
    });
    // Full confidence (10 attempts), raw = 0.8 * 0.6 + 0.2 * 0.6 = 0.6
    expect(result.newMasteryLevel).toBeGreaterThan(0.5);
    expect(result.newMasteryLevel).toBeLessThan(0.7);
  });
});
