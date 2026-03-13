import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MistakeEntry } from "@/lib/mistakes";
import type { StoredTeachingMoment } from "@/lib/teaching-moments";
import type { StaminaProgress } from "@/lib/reading-stamina";
import type { StoredSimulation, SectionScore, ScoreReport } from "@/lib/simulation";
import type { DrillResult, DrillAttempt } from "@/lib/drill";

// ─── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/mistakes", () => ({
  loadMistakes: vi.fn(() => []),
}));
vi.mock("@/lib/teaching-moments", () => ({
  loadTeachingMoments: vi.fn(() => []),
}));
vi.mock("@/lib/reading-stamina", () => ({
  loadStaminaProgress: vi.fn(
    (): StaminaProgress => ({ currentLevel: 1, records: [], completedPassageIds: [] })
  ),
}));
vi.mock("@/lib/simulation", () => ({
  loadSimulationHistory: vi.fn(() => []),
}));
vi.mock("@/lib/drill", () => ({
  loadDrillHistory: vi.fn(() => []),
}));
vi.mock("@/lib/exam/curriculum", () => ({
  getSkillIdsForDomain: vi.fn(() => []),
  getSkillById: vi.fn((id: string) => ({ name: id })),
}));

import { aggregateParentData } from "./parent-data";
import { loadMistakes } from "@/lib/mistakes";
import { loadTeachingMoments } from "@/lib/teaching-moments";
import { loadStaminaProgress } from "@/lib/reading-stamina";
import { loadSimulationHistory } from "@/lib/simulation";
import { loadDrillHistory } from "@/lib/drill";
import { getSkillIdsForDomain } from "@/lib/exam/curriculum";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeMistake(overrides: Partial<MistakeEntry> = {}): MistakeEntry {
  return {
    id: `m_${Math.random().toString(36).slice(2, 6)}`,
    skillId: "rc_main_idea",
    skillName: "Main Idea",
    questionText: "What is the main idea?",
    studentAnswer: "A",
    correctAnswer: "B",
    answerChoices: ["A", "B", "C", "D"],
    diagnosis: {
      category: "conceptual_gap",
      explanation: "Misunderstood the passage",
      relatedSkills: [],
    },
    createdAt: new Date().toISOString(),
    nextReviewAt: new Date().toISOString(),
    reviewCount: 0,
    lastReviewedAt: null,
    ...overrides,
  };
}

function makeTeachingMoment(
  overrides: Partial<StoredTeachingMoment> = {}
): StoredTeachingMoment {
  return {
    id: `tm_${Math.random().toString(36).slice(2, 6)}`,
    skillId: "rc_main_idea",
    skillName: "Main Idea",
    studentExplanation: "Student explained concept",
    evaluation: {
      completeness: "complete",
      accuracy: "accurate",
      feedback: "Great job!",
      missingConcepts: [],
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSectionScore(
  correct: number,
  total: number,
  bySkill: SectionScore["bySkill"] = []
): SectionScore {
  return {
    correct,
    total,
    percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    bySkill,
  };
}

function makeScoreReport(overrides: Partial<ScoreReport> = {}): ScoreReport {
  return {
    examId: `exam_${Math.random().toString(36).slice(2, 6)}`,
    completedAt: new Date().toISOString(),
    reading: makeSectionScore(40, 50),
    qr: makeSectionScore(30, 37),
    ma: makeSectionScore(35, 47),
    writing: {
      score: 7,
      feedback: "Good writing.",
      strengths: ["Clear thesis"],
      improvements: ["More examples"],
    },
    overall: {
      correct: 105,
      total: 134,
      percentage: 78,
      estimatedPercentile: 72,
    },
    timeAnalysis: {
      elaAllocatedMinutes: 110,
      elaUsedMinutes: 90,
      elaVerdict: "balanced",
      mathAllocatedMinutes: 75,
      mathUsedMinutes: 60,
      mathVerdict: "balanced",
      readingTimeEstimate: 70,
      writingTimeEstimate: 20,
    },
    recommendations: ["Study more"],
    ...overrides,
  };
}

function makeSimulation(
  overrides: Partial<StoredSimulation> = {}
): StoredSimulation {
  return {
    id: `sim_${Math.random().toString(36).slice(2, 6)}`,
    completedAt: new Date().toISOString(),
    report: makeScoreReport(),
    ...overrides,
  };
}

function makeDrillAttempt(
  overrides: Partial<DrillAttempt> = {}
): DrillAttempt {
  return {
    questionText: "What is 5 + 3?",
    studentAnswer: "7",
    correctAnswer: "8",
    isCorrect: false,
    timeSpentMs: 3000,
    ...overrides,
  };
}

function makeDrillResult(
  overrides: Partial<DrillResult> = {}
): DrillResult {
  return {
    id: `drill_${Math.random().toString(36).slice(2, 6)}`,
    skillId: "math_addition",
    skillName: "Addition",
    durationSeconds: 60,
    attempts: [makeDrillAttempt()],
    totalCorrect: 0,
    totalQuestions: 1,
    accuracy: 0,
    questionsPerMinute: 1,
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(loadMistakes).mockReturnValue([]);
  vi.mocked(loadTeachingMoments).mockReturnValue([]);
  vi.mocked(loadStaminaProgress).mockReturnValue({
    currentLevel: 1,
    records: [],
    completedPassageIds: [],
  });
  vi.mocked(loadSimulationHistory).mockReturnValue([]);
  vi.mocked(loadDrillHistory).mockReturnValue([]);
  vi.mocked(getSkillIdsForDomain).mockReturnValue([]);
});

describe("aggregateParentData", () => {
  it("returns default structure with no data", () => {
    const data = aggregateParentData();

    expect(data.weeklyMinutes).toBe(0);
    expect(data.weeklyTarget).toBe(150);
    expect(data.activeDaysThisWeek).toBe(0);
    // With no data, still shows a today baseline at 50%
    expect(data.masteryTimeline.length).toBeLessThanOrEqual(1);
    expect(data.domainReadiness).toHaveLength(3);
    expect(data.sessionLog).toEqual([]);
    expect(data.totalSessions).toBe(0);
    expect(data.mistakePatterns).toEqual([]);
    expect(data.readingLevel).toBeNull();
    expect(data.readingWpm).toBeNull();
    expect(data.latestSimPercentile).toBeNull();
  });

  it("calculates weekly minutes from reading stamina records", () => {
    vi.mocked(loadStaminaProgress).mockReturnValue({
      currentLevel: 2,
      records: [
        {
          passageId: "p1",
          wordCount: 300,
          readingTimeSeconds: 120,
          wpm: 150,
          passageTitle: "Test Passage 1",
          questionsCorrect: 4,
          questionsTotal: 5,
          staminaLevel: 1,
          timestamp: Date.now(),
        },
        {
          passageId: "p2",
          wordCount: 350,
          readingTimeSeconds: 180,
          wpm: 117,
          passageTitle: "Test Passage 2",
          questionsCorrect: 3,
          questionsTotal: 5,
          staminaLevel: 2,
          timestamp: Date.now(),
        },
      ],
      completedPassageIds: ["p1", "p2"],
    });

    const data = aggregateParentData();
    // (120 + 180) / 60 = 5 minutes
    expect(data.weeklyMinutes).toBe(5);
    expect(data.activeDaysThisWeek).toBe(1);
    expect(data.readingLevel).toBe(2);
    expect(data.readingWpm).toBe(134); // (150 + 117) / 2 rounded
  });

  it("calculates weekly minutes from simulations", () => {
    vi.mocked(loadSimulationHistory).mockReturnValue([
      makeSimulation({
        completedAt: new Date().toISOString(),
        report: makeScoreReport({
          timeAnalysis: {
            elaAllocatedMinutes: 110,
            elaUsedMinutes: 95,
            elaVerdict: "balanced",
            mathAllocatedMinutes: 75,
            mathUsedMinutes: 65,
            mathVerdict: "balanced",
            readingTimeEstimate: 75,
            writingTimeEstimate: 20,
          },
        }),
      }),
    ]);

    const data = aggregateParentData();
    expect(data.weeklyMinutes).toBe(160); // 95 + 65
    expect(data.latestSimPercentile).toBe(72);
  });

  it("estimates tutoring time from mistake dates", () => {
    vi.mocked(loadMistakes).mockReturnValue([
      makeMistake({ createdAt: new Date().toISOString() }),
      makeMistake({ createdAt: new Date().toISOString() }),
    ]);

    const data = aggregateParentData();
    // Both from same day → 1 session → 25 min
    expect(data.weeklyMinutes).toBe(25);
    expect(data.activeDaysThisWeek).toBe(1);
  });

  it("builds mastery timeline from simulations", () => {
    const twoWeeksAgo = new Date(
      Date.now() - 14 * 86400000
    ).toISOString();
    const oneWeekAgo = new Date(
      Date.now() - 7 * 86400000
    ).toISOString();

    vi.mocked(loadSimulationHistory).mockReturnValue([
      makeSimulation({
        completedAt: twoWeeksAgo,
        report: makeScoreReport({
          reading: makeSectionScore(30, 50),
          qr: makeSectionScore(20, 37),
          ma: makeSectionScore(25, 47),
        }),
      }),
      makeSimulation({
        completedAt: oneWeekAgo,
        report: makeScoreReport({
          reading: makeSectionScore(40, 50),
          qr: makeSectionScore(30, 37),
          ma: makeSectionScore(35, 47),
        }),
      }),
    ]);

    const data = aggregateParentData();
    // Should have at least the 2 sim snapshots + today estimate
    expect(data.masteryTimeline.length).toBeGreaterThanOrEqual(2);

    // Ordered by date
    for (let i = 1; i < data.masteryTimeline.length; i++) {
      expect(data.masteryTimeline[i].date >= data.masteryTimeline[i - 1].date).toBe(true);
    }
  });

  it("builds domain readiness for all 3 domains", () => {
    const data = aggregateParentData();

    expect(data.domainReadiness).toHaveLength(3);
    expect(data.domainReadiness[0].domainName).toBe("Reading Comprehension");
    expect(data.domainReadiness[1].domainName).toBe("Quantitative Reasoning");
    expect(data.domainReadiness[2].domainName).toBe("Math Achievement");

    // Default trend is stable
    for (const dr of data.domainReadiness) {
      expect(dr.trend).toBe("stable");
    }
  });

  it("detects improving trend from 2 simulations", () => {
    vi.mocked(loadSimulationHistory).mockReturnValue([
      makeSimulation({
        completedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
        report: makeScoreReport({
          reading: makeSectionScore(30, 50),
        }),
      }),
      makeSimulation({
        completedAt: new Date().toISOString(),
        report: makeScoreReport({
          reading: makeSectionScore(45, 50), // 90% vs 60% → improving
        }),
      }),
    ]);

    const data = aggregateParentData();
    const reading = data.domainReadiness.find(
      (d) => d.domainName === "Reading Comprehension"
    );
    expect(reading?.trend).toBe("improving");
  });

  it("builds session log from multiple sources", () => {
    vi.mocked(loadMistakes).mockReturnValue([
      makeMistake({
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      }),
    ]);

    vi.mocked(loadStaminaProgress).mockReturnValue({
      currentLevel: 1,
      records: [
        {
          passageId: "p1",
          wordCount: 300,
          readingTimeSeconds: 120,
          wpm: 150,
          passageTitle: "Test Passage 1",
          questionsCorrect: 4,
          questionsTotal: 5,
          staminaLevel: 1,
          timestamp: Date.now() - 86400000,
        },
      ],
      completedPassageIds: ["p1"],
    });

    vi.mocked(loadSimulationHistory).mockReturnValue([
      makeSimulation({
        completedAt: new Date().toISOString(),
      }),
    ]);

    const data = aggregateParentData();
    expect(data.totalSessions).toBeGreaterThanOrEqual(3);

    const types = data.sessionLog.map((e) => e.type);
    expect(types).toContain("tutoring");
    expect(types).toContain("reading");
    expect(types).toContain("simulation");
  });

  it("session log is sorted newest first", () => {
    vi.mocked(loadMistakes).mockReturnValue([
      makeMistake({
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      }),
    ]);
    vi.mocked(loadSimulationHistory).mockReturnValue([
      makeSimulation({
        completedAt: new Date().toISOString(),
      }),
    ]);

    const data = aggregateParentData();
    for (let i = 1; i < data.sessionLog.length; i++) {
      const prev = new Date(data.sessionLog[i - 1].date).getTime();
      const curr = new Date(data.sessionLog[i].date).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("caps session log at 20 entries", () => {
    const mistakes = Array.from({ length: 30 }, (_, i) =>
      makeMistake({
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        skillId: `skill_${i}`,
        skillName: `Skill ${i}`,
      })
    );
    vi.mocked(loadMistakes).mockReturnValue(mistakes);

    const data = aggregateParentData();
    expect(data.sessionLog.length).toBeLessThanOrEqual(20);
    expect(data.totalSessions).toBeGreaterThan(20);
  });

  it("aggregates mistake patterns with counts only", () => {
    vi.mocked(loadMistakes).mockReturnValue([
      makeMistake({ skillName: "Main Idea" }),
      makeMistake({ skillName: "Main Idea" }),
      makeMistake({ skillName: "Main Idea" }),
      makeMistake({ skillName: "Inference" }),
      makeMistake({ skillName: "Inference" }),
      makeMistake({ skillName: "Vocabulary" }),
    ]);

    const data = aggregateParentData();

    expect(data.mistakePatterns).toHaveLength(3);
    // Sorted by count descending
    expect(data.mistakePatterns[0].skillName).toBe("Main Idea");
    expect(data.mistakePatterns[0].count).toBe(3);
    expect(data.mistakePatterns[1].skillName).toBe("Inference");
    expect(data.mistakePatterns[1].count).toBe(2);
    expect(data.mistakePatterns[2].skillName).toBe("Vocabulary");
    expect(data.mistakePatterns[2].count).toBe(1);
  });

  it("caps mistake patterns at 8", () => {
    const mistakes = Array.from({ length: 12 }, (_, i) =>
      makeMistake({
        skillName: `Skill ${i}`,
        skillId: `skill_${i}`,
      })
    );
    vi.mocked(loadMistakes).mockReturnValue(mistakes);

    const data = aggregateParentData();
    expect(data.mistakePatterns.length).toBeLessThanOrEqual(8);
  });

  it("includes missed questions in missedQuestionsByWeek", () => {
    vi.mocked(loadMistakes).mockReturnValue([
      makeMistake({ questionText: "Secret question" }),
    ]);

    const data = aggregateParentData();
    const serialized = JSON.stringify(data);

    // Missed questions are now intentionally exposed via missedQuestionsByWeek
    expect(serialized).toContain("Secret question");
    expect(data.missedQuestionsByWeek.length).toBeGreaterThan(0);
    expect(data.missedQuestionsByWeek[0].questions[0].questionText).toBe(
      "Secret question"
    );
    expect(data.missedQuestionsByWeek[0].questions[0].source).toBe("tutoring");
  });

  it("does not count old data in weekly minutes", () => {
    vi.mocked(loadStaminaProgress).mockReturnValue({
      currentLevel: 2,
      records: [
        {
          passageId: "p1",
          wordCount: 300,
          readingTimeSeconds: 600,
          wpm: 30,
          passageTitle: "Old Passage",
          questionsCorrect: 3,
          questionsTotal: 5,
          staminaLevel: 1,
          timestamp: Date.now() - 30 * 86400000, // 30 days ago
        },
      ],
      completedPassageIds: ["p1"],
    });

    const data = aggregateParentData();
    expect(data.weeklyMinutes).toBe(0);
    // Still shows reading level from all-time data
    expect(data.readingLevel).toBe(2);
  });

  it("includes teaching moments in session log", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    vi.mocked(loadTeachingMoments).mockReturnValue([
      makeTeachingMoment({
        skillName: "Inference",
        createdAt: yesterday,
      }),
    ]);

    const data = aggregateParentData();
    const teachEntry = data.sessionLog.find(
      (e) => e.summary.includes("Teach-it-back")
    );
    expect(teachEntry).toBeTruthy();
    expect(teachEntry?.type).toBe("tutoring");
  });

  it("returns empty missedQuestionsByWeek with no data", () => {
    const data = aggregateParentData();
    expect(data.missedQuestionsByWeek).toEqual([]);
  });

  it("groups missed questions by week, newest first", () => {
    const thisWeek = new Date();
    const lastWeek = new Date(Date.now() - 7 * 86400000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);

    vi.mocked(loadMistakes).mockReturnValue([
      makeMistake({
        id: "m1",
        questionText: "Q this week",
        createdAt: thisWeek.toISOString(),
      }),
      makeMistake({
        id: "m2",
        questionText: "Q last week",
        createdAt: lastWeek.toISOString(),
      }),
      makeMistake({
        id: "m3",
        questionText: "Q two weeks ago",
        createdAt: twoWeeksAgo.toISOString(),
      }),
    ]);

    const data = aggregateParentData();

    // Should have 2-3 week groups depending on date boundaries
    expect(data.missedQuestionsByWeek.length).toBeGreaterThanOrEqual(2);

    // Newest week first
    for (let i = 1; i < data.missedQuestionsByWeek.length; i++) {
      const prev = new Date(data.missedQuestionsByWeek[i - 1].weekStartISO).getTime();
      const curr = new Date(data.missedQuestionsByWeek[i].weekStartISO).getTime();
      expect(prev).toBeGreaterThan(curr);
    }
  });

  it("includes only incorrect drill attempts in missedQuestionsByWeek", () => {
    vi.mocked(loadDrillHistory).mockReturnValue([
      makeDrillResult({
        id: "drill_1",
        attempts: [
          makeDrillAttempt({
            questionText: "Wrong answer Q",
            isCorrect: false,
          }),
          makeDrillAttempt({
            questionText: "Right answer Q",
            isCorrect: true,
            studentAnswer: "8",
            correctAnswer: "8",
          }),
          makeDrillAttempt({
            questionText: "Another wrong Q",
            isCorrect: false,
          }),
        ],
      }),
    ]);

    const data = aggregateParentData();
    const allQuestions = data.missedQuestionsByWeek.flatMap((w) => w.questions);

    expect(allQuestions).toHaveLength(2);
    expect(allQuestions.every((q) => q.source === "drill")).toBe(true);
    expect(allQuestions.map((q) => q.questionText)).toContain("Wrong answer Q");
    expect(allQuestions.map((q) => q.questionText)).toContain("Another wrong Q");
    expect(allQuestions.map((q) => q.questionText)).not.toContain("Right answer Q");
  });

  it("includes simulation missed questions when present", () => {
    vi.mocked(loadSimulationHistory).mockReturnValue([
      makeSimulation({
        completedAt: new Date().toISOString(),
        report: makeScoreReport({
          missedQuestions: [
            {
              questionId: "q1",
              questionText: "What is the main idea of passage 3?",
              studentAnswer: "A",
              correctAnswer: "C",
              skillId: "rc_main_idea",
              skillName: "Main Idea",
              section: "reading" as const,
            },
            {
              questionId: "q2",
              questionText: "Solve: $3x + 5 = 20$",
              studentAnswer: "B",
              correctAnswer: "D",
              skillId: "ma_algebra",
              skillName: "Algebra",
              section: "ma" as const,
            },
          ],
        }),
      }),
    ]);

    const data = aggregateParentData();
    const allQuestions = data.missedQuestionsByWeek.flatMap((w) => w.questions);

    const examQuestions = allQuestions.filter((q) => q.source === "practice-exam");
    expect(examQuestions).toHaveLength(2);
    expect(examQuestions[0].skillName).toBe("Main Idea");
    expect(examQuestions[1].skillName).toBe("Algebra");
    expect(examQuestions.every((q) => q.diagnosis === null)).toBe(true);
  });

  it("uses simulation mastery for domain readiness when available", () => {
    vi.mocked(loadSimulationHistory).mockReturnValue([
      makeSimulation({
        completedAt: new Date().toISOString(),
        report: makeScoreReport({
          reading: makeSectionScore(45, 50), // 90%
          qr: makeSectionScore(15, 37), // ~41%
          ma: makeSectionScore(35, 47), // ~74%
        }),
      }),
    ]);

    const data = aggregateParentData();
    const reading = data.domainReadiness.find(
      (d) => d.domainName === "Reading Comprehension"
    );
    const qr = data.domainReadiness.find(
      (d) => d.domainName === "Quantitative Reasoning"
    );
    expect(reading?.mastery).toBe(90);
    expect(qr?.mastery).toBe(41);
  });
});
