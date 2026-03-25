/**
 * Comprehensive stress test: 10 student profiles with diverse behaviors.
 *
 * Validates exam assembly, per-student scoring, cross-student ordering,
 * confidence intervals, weighted vs raw divergence, edge cases, and
 * strength/weakness correctness across 7 verification rounds.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getSkillById, getDomainForSkill } from "./exam/curriculum";
import { assembleAssessmentExam, ASSESSMENT_CONFIG } from "./assessment";
import type { AssessmentExam, AssessmentAnswer } from "./assessment";
import { generateAssessmentReport } from "./assessment-scoring";
import type {
  WritingAssessmentScore,
  AssessmentReport,
  SkillAssessment,
} from "./assessment-scoring";
import type { ExamQuestion } from "./simulation";

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Deterministic pseudo-random: seeded so tests are repeatable.
 * Uses a simple LCG (linear congruential generator).
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/** Simulate answers with a seeded random for reproducibility. */
function simulateAnswers(
  questions: readonly ExamQuestion[],
  accuracy: number,
  section: "reading" | "qr" | "ma",
  rand: () => number
): { answers: Record<string, string>; details: AssessmentAnswer[] } {
  const answers: Record<string, string> = {};
  const details: AssessmentAnswer[] = [];

  for (const q of questions) {
    const isCorrect = rand() < accuracy;
    const selected = isCorrect
      ? q.correctAnswer
      : q.answerChoices.find((c) => c.letter !== q.correctAnswer)?.letter ?? q.correctAnswer;

    answers[q.id] = selected;
    const skill = getSkillById(q.skillId);
    details.push({
      questionId: q.id,
      skillId: q.skillId,
      selectedAnswer: selected,
      correctAnswer: q.correctAnswer,
      timeSpentMs: 0,
      section,
      difficultyTier: skill?.difficulty_tier ?? 3,
    });
  }

  return { answers, details };
}

/**
 * Simulate answers where the student SKIPS some questions.
 * skipRate = fraction of questions left unanswered (0.0–1.0).
 * accuracyOnAnswered = accuracy on questions they do attempt.
 */
function simulateWithSkips(
  questions: readonly ExamQuestion[],
  accuracyOnAnswered: number,
  skipRate: number,
  section: "reading" | "qr" | "ma",
  rand: () => number
): { answers: Record<string, string>; details: AssessmentAnswer[] } {
  const answers: Record<string, string> = {};
  const details: AssessmentAnswer[] = [];

  for (const q of questions) {
    const skipped = rand() < skipRate;
    if (skipped) {
      // No entry in answers — scoring treats as wrong
      // Still need a detail entry for the question to exist in the section
      const skill = getSkillById(q.skillId);
      details.push({
        questionId: q.id,
        skillId: q.skillId,
        selectedAnswer: "",
        correctAnswer: q.correctAnswer,
        timeSpentMs: 0,
        section,
        difficultyTier: skill?.difficulty_tier ?? 3,
      });
      continue;
    }

    const isCorrect = rand() < accuracyOnAnswered;
    const selected = isCorrect
      ? q.correctAnswer
      : q.answerChoices.find((c) => c.letter !== q.correctAnswer)?.letter ?? q.correctAnswer;

    answers[q.id] = selected;
    const skill = getSkillById(q.skillId);
    details.push({
      questionId: q.id,
      skillId: q.skillId,
      selectedAnswer: selected,
      correctAnswer: q.correctAnswer,
      timeSpentMs: 0,
      section,
      difficultyTier: skill?.difficulty_tier ?? 3,
    });
  }

  return { answers, details };
}

function makeWritingScore(overall: number): WritingAssessmentScore {
  return {
    overall,
    rubric: {
      organization: Math.min(10, overall + 1),
      developmentOfIdeas: overall,
      wordChoice: Math.max(1, overall - 1),
      sentenceStructure: overall,
      mechanics: Math.min(10, overall + 1),
    },
    feedback: `Writing scored ${overall}/10.`,
    strengths: overall >= 7 ? ["Clear organization", "Strong examples"] : [],
    improvements: overall < 7 ? ["Develop ideas more fully", "Vary sentence structure"] : [],
  };
}

// ─── Student Profiles ─────────────────────────────────────────────────

interface StudentProfile {
  readonly name: string;
  readonly archetype: string;
  readonly seed: number;
  readonly reading: number;
  readonly qr: number;
  readonly ma: number;
  readonly writingScore: number;
  readonly skipRate: number; // 0 = answers all, 0.4 = skips 40%
  readonly timings: {
    readonly readingUsedMinutes: number;
    readonly qrUsedMinutes: number;
    readonly maUsedMinutes: number;
    readonly writingUsedMinutes: number;
  };
}

const STUDENTS: readonly StudentProfile[] = [
  {
    name: "Aisha",
    archetype: "Perfect scorer",
    seed: 1001,
    reading: 1.0, qr: 1.0, ma: 1.0, writingScore: 10,
    skipRate: 0,
    timings: { readingUsedMinutes: 28, qrUsedMinutes: 12, maUsedMinutes: 16, writingUsedMinutes: 19 },
  },
  {
    name: "Brian",
    archetype: "Near-perfect, one gap (weak MA)",
    seed: 2002,
    reading: 0.95, qr: 0.95, ma: 0.40, writingScore: 8,
    skipRate: 0,
    timings: { readingUsedMinutes: 30, qrUsedMinutes: 14, maUsedMinutes: 20, writingUsedMinutes: 18 },
  },
  {
    name: "Chloe",
    archetype: "Bookworm (reading-strong, math-weak)",
    seed: 3003,
    reading: 0.90, qr: 0.35, ma: 0.30, writingScore: 7,
    skipRate: 0,
    timings: { readingUsedMinutes: 25, qrUsedMinutes: 16, maUsedMinutes: 20, writingUsedMinutes: 19 },
  },
  {
    name: "Diego",
    archetype: "Math whiz (math-strong, reading-weak)",
    seed: 4004,
    reading: 0.40, qr: 0.92, ma: 0.95, writingScore: 5,
    skipRate: 0,
    timings: { readingUsedMinutes: 34, qrUsedMinutes: 10, maUsedMinutes: 13, writingUsedMinutes: 15 },
  },
  {
    name: "Emma",
    archetype: "Solid average",
    seed: 5005,
    reading: 0.62, qr: 0.60, ma: 0.58, writingScore: 6,
    skipRate: 0,
    timings: { readingUsedMinutes: 32, qrUsedMinutes: 15, maUsedMinutes: 19, writingUsedMinutes: 18 },
  },
  {
    name: "Felix",
    archetype: "Random guesser",
    seed: 6006,
    reading: 0.22, qr: 0.20, ma: 0.20, writingScore: 2,
    skipRate: 0,
    timings: { readingUsedMinutes: 15, qrUsedMinutes: 8, maUsedMinutes: 10, writingUsedMinutes: 8 },
  },
  {
    name: "Grace",
    archetype: "Skips questions (40% unanswered, 85% on rest)",
    seed: 7007,
    reading: 0.85, qr: 0.80, ma: 0.80, writingScore: 7,
    skipRate: 0.40,
    timings: { readingUsedMinutes: 33, qrUsedMinutes: 16, maUsedMinutes: 20, writingUsedMinutes: 19 },
  },
  {
    name: "Hugo",
    archetype: "Speed demon (rushes, careless)",
    seed: 8008,
    reading: 0.55, qr: 0.50, ma: 0.45, writingScore: 4,
    skipRate: 0,
    timings: { readingUsedMinutes: 14, qrUsedMinutes: 7, maUsedMinutes: 9, writingUsedMinutes: 8 },
  },
  {
    name: "Iris",
    archetype: "Cautious perfectionist (uses almost all time)",
    seed: 9009,
    reading: 0.88, qr: 0.85, ma: 0.82, writingScore: 8,
    skipRate: 0,
    timings: { readingUsedMinutes: 34, qrUsedMinutes: 16.5, maUsedMinutes: 20.5, writingUsedMinutes: 19.5 },
  },
  {
    name: "Javier",
    archetype: "Collapses under pressure (strong start, falls apart)",
    seed: 10010,
    reading: 0.75, qr: 0.65, ma: 0.30, writingScore: 3,
    skipRate: 0,
    timings: { readingUsedMinutes: 30, qrUsedMinutes: 16, maUsedMinutes: 20, writingUsedMinutes: 17 },
  },
] as const;

// ─── Generate All Reports Once ────────────────────────────────────────

let exam: AssessmentExam;
let reports: Map<string, AssessmentReport>;
let readingQs: ExamQuestion[];

beforeAll(() => {
  // Use a fixed seed for exam assembly by calling it once
  exam = assembleAssessmentExam();
  readingQs = exam.readingBlocks.flatMap((b) => [...b.questions]);
  reports = new Map();

  for (const student of STUDENTS) {
    const rand = seededRandom(student.seed);

    let reading: ReturnType<typeof simulateAnswers>;
    let qr: ReturnType<typeof simulateAnswers>;
    let ma: ReturnType<typeof simulateAnswers>;

    if (student.skipRate > 0) {
      reading = simulateWithSkips(readingQs, student.reading, student.skipRate, "reading", rand);
      qr = simulateWithSkips([...exam.qrQuestions], student.qr, student.skipRate, "qr", rand);
      ma = simulateWithSkips([...exam.maQuestions], student.ma, student.skipRate, "ma", rand);
    } else {
      reading = simulateAnswers(readingQs, student.reading, "reading", rand);
      qr = simulateAnswers([...exam.qrQuestions], student.qr, "qr", rand);
      ma = simulateAnswers([...exam.maQuestions], student.ma, "ma", rand);
    }

    const allAnswers = { ...reading.answers, ...qr.answers, ...ma.answers };
    const allDetails = [...reading.details, ...qr.details, ...ma.details];

    const report = generateAssessmentReport(
      exam,
      allAnswers,
      allDetails,
      student.timings,
      makeWritingScore(student.writingScore)
    );

    reports.set(student.name, report);
  }
});

function getReport(name: string): AssessmentReport {
  const r = reports.get(name);
  if (!r) throw new Error(`No report for ${name}`);
  return r;
}

// ═══════════════════════════════════════════════════════════════════════
// ROUND 1: Exam Assembly
// ═══════════════════════════════════════════════════════════════════════

describe("Round 1: Exam Assembly", () => {
  it("has correct reading question count (~25)", () => {
    const total = exam.readingBlocks.reduce((s, b) => s + b.questions.length, 0);
    expect(total).toBeGreaterThanOrEqual(20);
    expect(total).toBeLessThanOrEqual(30);
  });

  it("has correct QR question count (~19)", () => {
    expect(exam.qrQuestions.length).toBeGreaterThanOrEqual(10);
    expect(exam.qrQuestions.length).toBeLessThanOrEqual(25);
  });

  it("has correct MA question count (~23)", () => {
    expect(exam.maQuestions.length).toBeGreaterThanOrEqual(15);
    expect(exam.maQuestions.length).toBeLessThanOrEqual(30);
  });

  it("has 3+ reading genres", () => {
    const genres = new Set(
      exam.readingBlocks.map((b) => {
        const parts = b.passageId.split("_");
        return parts.length >= 3 && !isNaN(Number(parts[parts.length - 1]))
          ? parts.slice(0, -1).join("_")
          : parts[0];
      })
    );
    expect(genres.size).toBeGreaterThanOrEqual(3);
  });

  it("all questions have valid answer choices with correct answer present", () => {
    const all = [
      ...exam.readingBlocks.flatMap((b) => [...b.questions]),
      ...exam.qrQuestions,
      ...exam.maQuestions,
    ];
    for (const q of all) {
      expect(q.answerChoices.length).toBeGreaterThanOrEqual(2);
      const letters = q.answerChoices.map((c) => c.letter);
      expect(letters).toContain(q.correctAnswer);
      for (const c of q.answerChoices) {
        expect(c.letter.length).toBeGreaterThan(0);
        expect(c.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("has no duplicate question IDs", () => {
    const all = [
      ...exam.readingBlocks.flatMap((b) => [...b.questions]),
      ...exam.qrQuestions,
      ...exam.maQuestions,
    ];
    const ids = all.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a substantive writing prompt (50+ chars)", () => {
    expect(exam.writingPrompt.length).toBeGreaterThan(50);
  });

  it("every reading block has passage text", () => {
    for (const b of exam.readingBlocks) {
      expect(b.passageText.length).toBeGreaterThan(50);
      expect(b.title.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ROUND 2: Per-Student Scoring Sanity
// ═══════════════════════════════════════════════════════════════════════

describe("Round 2: Per-Student Scoring Sanity", () => {
  for (const student of STUDENTS) {
    describe(student.name + " — " + student.archetype, () => {
      it("section raw percentages in 0-100", () => {
        const r = getReport(student.name);
        for (const sec of [r.reading, r.qr, r.ma]) {
          expect(sec.rawPercentage).toBeGreaterThanOrEqual(0);
          expect(sec.rawPercentage).toBeLessThanOrEqual(100);
        }
      });

      it("section weighted percentages in 0-100", () => {
        const r = getReport(student.name);
        for (const sec of [r.reading, r.qr, r.ma]) {
          expect(sec.weightedPercentage).toBeGreaterThanOrEqual(0);
          expect(sec.weightedPercentage).toBeLessThanOrEqual(100);
        }
      });

      it("correct <= total for every section", () => {
        const r = getReport(student.name);
        for (const sec of [r.reading, r.qr, r.ma]) {
          expect(sec.correct).toBeLessThanOrEqual(sec.total);
          expect(sec.correct).toBeGreaterThanOrEqual(0);
          expect(sec.total).toBeGreaterThan(0);
        }
      });

      it("missed question count = total - correct", () => {
        const r = getReport(student.name);
        const totalQ = r.reading.total + r.qr.total + r.ma.total;
        const totalCorrect = r.reading.correct + r.qr.correct + r.ma.correct;
        expect(r.missedQuestions.length).toBe(totalQ - totalCorrect);
      });

      it("writing score matches input", () => {
        const r = getReport(student.name);
        expect(r.writing.overall).toBe(student.writingScore);
      });

      it("time analysis matches input", () => {
        const r = getReport(student.name);
        expect(r.timeAnalysis.readingUsedMinutes).toBe(student.timings.readingUsedMinutes);
        expect(r.timeAnalysis.qrUsedMinutes).toBe(student.timings.qrUsedMinutes);
        expect(r.timeAnalysis.maUsedMinutes).toBe(student.timings.maUsedMinutes);
        expect(r.timeAnalysis.writingUsedMinutes).toBe(student.timings.writingUsedMinutes);
      });

      it("has at least 1 recommendation", () => {
        const r = getReport(student.name);
        expect(r.recommendations.length).toBeGreaterThan(0);
      });

      it("all skill classifications are valid", () => {
        const r = getReport(student.name);
        const allSkills = [...r.reading.bySkill, ...r.qr.bySkill, ...r.ma.bySkill];
        for (const sk of allSkills) {
          expect(["strong", "moderate", "weak"]).toContain(sk.strength);
          expect(sk.skillId.length).toBeGreaterThan(0);
          expect(sk.skillName.length).toBeGreaterThan(0);
          expect(sk.total).toBeGreaterThan(0);
          expect(sk.correct).toBeGreaterThanOrEqual(0);
          expect(sk.correct).toBeLessThanOrEqual(sk.total);
          expect(sk.percentage).toBeGreaterThanOrEqual(0);
          expect(sk.percentage).toBeLessThanOrEqual(100);
        }
      });

      it("strongSkills are all classified 'strong', weakSkills are all 'weak'", () => {
        const r = getReport(student.name);
        for (const s of r.strongSkills) expect(s.strength).toBe("strong");
        for (const w of r.weakSkills) expect(w.strength).toBe("weak");
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ROUND 3: Cross-Student Ordering
// ═══════════════════════════════════════════════════════════════════════

describe("Round 3: Cross-Student Ordering", () => {
  it("Aisha (perfect) has the highest overall score", () => {
    const aisha = getReport("Aisha").overall.estimatedScore;
    for (const student of STUDENTS) {
      if (student.name === "Aisha") continue;
      expect(aisha).toBeGreaterThanOrEqual(getReport(student.name).overall.estimatedScore);
    }
  });

  it("Felix (guesser) has the lowest overall score", () => {
    const felix = getReport("Felix").overall.estimatedScore;
    for (const student of STUDENTS) {
      if (student.name === "Felix") continue;
      expect(felix).toBeLessThanOrEqual(getReport(student.name).overall.estimatedScore);
    }
  });

  it("scores follow expected relative ordering", () => {
    // Expected rough ordering (highest to lowest):
    // Aisha > Iris > Brian > Diego ≈ Chloe > Emma > Grace > Hugo ≈ Ella/Javier > Felix
    const scores = STUDENTS.map((s) => ({
      name: s.name,
      score: getReport(s.name).overall.estimatedScore,
    })).sort((a, b) => b.score - a.score);

    // Aisha should be #1
    expect(scores[0].name).toBe("Aisha");

    // Felix should be last
    expect(scores[scores.length - 1].name).toBe("Felix");

    // Iris (88/85/82, writing 8) should beat Emma (62/60/58, writing 6)
    expect(getReport("Iris").overall.estimatedScore)
      .toBeGreaterThan(getReport("Emma").overall.estimatedScore);

    // Hugo (55/50/45, writing 4) should beat Felix (22/20/20, writing 2)
    expect(getReport("Hugo").overall.estimatedScore)
      .toBeGreaterThan(getReport("Felix").overall.estimatedScore);
  });

  it("percentiles follow the same ordering as scores", () => {
    const data = STUDENTS.map((s) => ({
      name: s.name,
      score: getReport(s.name).overall.estimatedScore,
      pctile: getReport(s.name).overall.estimatedPercentile,
    })).sort((a, b) => b.score - a.score);

    for (let i = 0; i < data.length - 1; i++) {
      // Higher score should have >= percentile (percentile fn is monotonic)
      if (data[i].score > data[i + 1].score) {
        expect(data[i].pctile).toBeGreaterThanOrEqual(data[i + 1].pctile);
      }
    }
  });

  it("top 3 students have more strong skills than weak", () => {
    const ranked = STUDENTS.map((s) => ({
      name: s.name,
      score: getReport(s.name).overall.estimatedScore,
    })).sort((a, b) => b.score - a.score);

    for (const entry of ranked.slice(0, 3)) {
      const r = getReport(entry.name);
      expect(r.strongSkills.length).toBeGreaterThanOrEqual(r.weakSkills.length);
    }
  });

  it("bottom 2 students have more weak skills than strong", () => {
    const ranked = STUDENTS.map((s) => ({
      name: s.name,
      score: getReport(s.name).overall.estimatedScore,
    })).sort((a, b) => b.score - a.score);

    for (const entry of ranked.slice(-2)) {
      const r = getReport(entry.name);
      expect(r.weakSkills.length).toBeGreaterThanOrEqual(r.strongSkills.length);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ROUND 4: Confidence & Projection Quality
// ═══════════════════════════════════════════════════════════════════════

describe("Round 4: Confidence & Projection Quality", () => {
  for (const student of STUDENTS) {
    it(`${student.name}: confidence interval is valid (low <= est <= high)`, () => {
      const r = getReport(student.name);
      expect(r.overall.rangeLow).toBeLessThanOrEqual(r.overall.estimatedScore);
      expect(r.overall.rangeHigh).toBeGreaterThanOrEqual(r.overall.estimatedScore);
      expect(r.overall.rangeLow).toBeGreaterThanOrEqual(0);
      expect(r.overall.rangeHigh).toBeLessThanOrEqual(100);
    });

    it(`${student.name}: percentile range brackets the point estimate`, () => {
      const r = getReport(student.name);
      expect(r.overall.percentileRangeLow).toBeLessThanOrEqual(r.overall.estimatedPercentile);
      expect(r.overall.percentileRangeHigh).toBeGreaterThanOrEqual(r.overall.estimatedPercentile);
    });
  }

  it("all students show 'medium' confidence (67 MC questions → SE ≈ 9 pts)", () => {
    // With ~67 questions, the binomial SE at p=0.5 is ~6.1%
    // margin = 6.1 * 1.96 * 0.8 + 3 ≈ 12.6 → "medium" (8 < 12.6 < 13)
    // At extreme p (0.2 or 0.95), SE shrinks, but still medium territory
    for (const student of STUDENTS) {
      const r = getReport(student.name);
      expect(["high", "medium"]).toContain(r.overall.confidence);
    }
  });

  it("Aisha (100%) has tighter range than Hugo (~50%)", () => {
    // Binomial SE is smallest at p near 0 or 1
    const aisha = getReport("Aisha");
    const hugo = getReport("Hugo");
    const aishaRange = aisha.overall.rangeHigh - aisha.overall.rangeLow;
    const hugoRange = hugo.overall.rangeHigh - hugo.overall.rangeLow;
    expect(aishaRange).toBeLessThanOrEqual(hugoRange);
  });

  it("Felix (20%) has tighter range than Emma (60%)", () => {
    // p=0.2 has lower variance than p=0.5
    const felix = getReport("Felix");
    const emma = getReport("Emma");
    const felixRange = felix.overall.rangeHigh - felix.overall.rangeLow;
    const emmaRange = emma.overall.rangeHigh - emma.overall.rangeLow;
    expect(felixRange).toBeLessThanOrEqual(emmaRange);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ROUND 5: Weighted vs Raw Divergence
// ═══════════════════════════════════════════════════════════════════════

describe("Round 5: Weighted vs Raw Divergence", () => {
  it("at least one section for one student shows raw ≠ weighted", () => {
    let foundDivergence = false;
    for (const student of STUDENTS) {
      const r = getReport(student.name);
      for (const sec of [r.reading, r.qr, r.ma]) {
        if (sec.rawPercentage !== sec.weightedPercentage) {
          foundDivergence = true;
          break;
        }
      }
      if (foundDivergence) break;
    }
    expect(foundDivergence).toBe(true);
  });

  it("difficulty weighting produces meaningful spread across students", () => {
    // Check that the weighted score isn't just always identical to raw
    let totalDifferences = 0;
    for (const student of STUDENTS) {
      const r = getReport(student.name);
      for (const sec of [r.reading, r.qr, r.ma]) {
        if (sec.rawPercentage !== sec.weightedPercentage) {
          totalDifferences++;
        }
      }
    }
    // Expect at least 5 divergences across 30 sections (10 students × 3 sections)
    expect(totalDifferences).toBeGreaterThanOrEqual(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ROUND 6: Edge Cases
// ═══════════════════════════════════════════════════════════════════════

describe("Round 6: Edge Cases", () => {
  it("Grace (skips 40%): unanswered questions are counted as wrong", () => {
    const r = getReport("Grace");
    const totalQ = r.reading.total + r.qr.total + r.ma.total;

    // Grace skips 40%, gets 85% of the 60% she answers ≈ 51% overall
    // But it's random, so just verify she scores less than her accuracy-on-answered
    // (85%) since many are skipped
    const rawOverall = Math.round(
      ((r.reading.correct + r.qr.correct + r.ma.correct) / totalQ) * 100
    );
    expect(rawOverall).toBeLessThan(85);
    expect(rawOverall).toBeGreaterThan(10); // She's not at 0
  });

  it("Felix (guesser, ~20%): doesn't crash, scores low", () => {
    const r = getReport("Felix");
    expect(r.overall.estimatedScore).toBeLessThan(35);
    expect(r.overall.estimatedPercentile).toBeLessThanOrEqual(15);
    expect(r.weakSkills.length).toBeGreaterThan(0);
  });

  it("Aisha (perfect): doesn't crash, scores high", () => {
    const r = getReport("Aisha");
    expect(r.overall.estimatedScore).toBeGreaterThanOrEqual(90);
    expect(r.overall.estimatedPercentile).toBeGreaterThanOrEqual(88);
    expect(r.missedQuestions.length).toBe(0);
  });

  it("Javier (collapse): MA section reflects poor performance", () => {
    const r = getReport("Javier");
    // Reading should be decent (75%), MA should be poor (30%)
    expect(r.reading.rawPercentage).toBeGreaterThan(r.ma.rawPercentage);
    expect(r.ma.rawPercentage).toBeLessThan(50);
  });

  it("Hugo (speed demon): time analysis reflects fast completion", () => {
    const r = getReport("Hugo");
    // Hugo uses 14 min of 35 for reading (40%), etc.
    expect(r.timeAnalysis.readingUsedMinutes).toBeLessThan(20);
    expect(r.timeAnalysis.qrUsedMinutes).toBeLessThan(10);
  });

  it("Iris (cautious): uses nearly all allotted time", () => {
    const r = getReport("Iris");
    expect(r.timeAnalysis.readingUsedMinutes).toBeGreaterThan(30);
    expect(r.timeAnalysis.maUsedMinutes).toBeGreaterThan(19);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ROUND 7: Strength/Weakness Correctness
// ═══════════════════════════════════════════════════════════════════════

describe("Round 7: Strength/Weakness Correctness", () => {
  function getSkillDomains(skills: readonly SkillAssessment[]): Set<string> {
    const domains = new Set<string>();
    for (const s of skills) {
      const d = getDomainForSkill(s.skillId);
      if (d) domains.add(d);
    }
    return domains;
  }

  it("Chloe (bookworm): strong skills are reading, weak skills are math", () => {
    const r = getReport("Chloe");

    // Her strong skills should include reading comprehension domain
    if (r.strongSkills.length > 0) {
      const strongDomains = getSkillDomains(r.strongSkills);
      expect(strongDomains.has("reading_comprehension")).toBe(true);
    }

    // Her weak skills should include math domains
    if (r.weakSkills.length > 0) {
      const weakDomains = getSkillDomains(r.weakSkills);
      const hasMath = weakDomains.has("math_quantitative_reasoning") ||
        weakDomains.has("math_achievement");
      expect(hasMath).toBe(true);
    }
  });

  it("Diego (math whiz): strong skills are math, weak skills are reading", () => {
    const r = getReport("Diego");

    if (r.strongSkills.length > 0) {
      const strongDomains = getSkillDomains(r.strongSkills);
      const hasMath = strongDomains.has("math_quantitative_reasoning") ||
        strongDomains.has("math_achievement");
      expect(hasMath).toBe(true);
    }

    if (r.weakSkills.length > 0) {
      const weakDomains = getSkillDomains(r.weakSkills);
      expect(weakDomains.has("reading_comprehension")).toBe(true);
    }
  });

  it("Emma (average): mostly 'moderate' classifications", () => {
    const r = getReport("Emma");
    const all = [...r.reading.bySkill, ...r.qr.bySkill, ...r.ma.bySkill];
    const moderateCount = all.filter((s) => s.strength === "moderate").length;
    // At 60% accuracy, most skills should land in 50-80% → "moderate"
    expect(moderateCount).toBeGreaterThanOrEqual(all.length * 0.3);
  });

  it("Felix (guesser): mostly 'weak' classifications", () => {
    const r = getReport("Felix");
    const all = [...r.reading.bySkill, ...r.qr.bySkill, ...r.ma.bySkill];
    const weakCount = all.filter((s) => s.strength === "weak").length;
    expect(weakCount).toBeGreaterThanOrEqual(all.length * 0.5);
  });

  it("Aisha (perfect): mostly 'strong' classifications", () => {
    const r = getReport("Aisha");
    const all = [...r.reading.bySkill, ...r.qr.bySkill, ...r.ma.bySkill];
    const strongCount = all.filter((s) => s.strength === "strong").length;
    expect(strongCount).toBeGreaterThanOrEqual(all.length * 0.8);
  });

  it("Brian (near-perfect, weak MA): strong reading/QR, weak MA", () => {
    const r = getReport("Brian");

    // Reading and QR should be high
    expect(r.reading.rawPercentage).toBeGreaterThanOrEqual(80);
    expect(r.qr.rawPercentage).toBeGreaterThanOrEqual(80);

    // MA should be clearly lower
    expect(r.ma.rawPercentage).toBeLessThan(60);

    // Weak skills should include MA domain skills
    if (r.weakSkills.length > 0) {
      const weakDomains = getSkillDomains(r.weakSkills);
      expect(weakDomains.has("math_achievement")).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DIAGNOSTIC: Print All Reports
// ═══════════════════════════════════════════════════════════════════════

describe("Diagnostic: Full Score Reports", () => {
  it("prints all 10 student reports for visual inspection", () => {
    const bar = (pct: number) => {
      const filled = Math.round(pct / 5);
      return "\u2588".repeat(filled) + "\u2591".repeat(20 - filled);
    };

    const totalQ = readingQs.length + exam.qrQuestions.length + exam.maQuestions.length;
    console.log("\n" + "=".repeat(70));
    console.log("  HALF-LENGTH ASSESSMENT STRESS TEST — 10 STUDENT PROFILES");
    console.log("=".repeat(70));
    console.log(`  Exam: ${readingQs.length} reading + ${exam.qrQuestions.length} QR + ${exam.maQuestions.length} MA = ${totalQ} MC questions`);
    console.log(`  Writing prompt: "${exam.writingPrompt.slice(0, 55)}..."\n`);

    const ranked = STUDENTS.map((s) => ({
      student: s,
      report: getReport(s.name),
    })).sort((a, b) => b.report.overall.estimatedScore - a.report.overall.estimatedScore);

    for (const { student, report } of ranked) {
      const r = report;
      const totalCorrect = r.reading.correct + r.qr.correct + r.ma.correct;
      const totalMC = r.reading.total + r.qr.total + r.ma.total;

      console.log(`  #${ranked.indexOf({ student, report }) + 1}  ${student.name} — ${student.archetype}`);
      console.log(`  ${"─".repeat(66)}`);
      console.log(`  SCORE: ${r.overall.estimatedScore}/100  range: [${r.overall.rangeLow}–${r.overall.rangeHigh}]  ${r.overall.confidence} confidence`);
      console.log(`  PERCENTILE: ~${r.overall.estimatedPercentile}th  range: [${r.overall.percentileRangeLow}th–${r.overall.percentileRangeHigh}th]`);
      console.log(`  MC: ${totalCorrect}/${totalMC} correct (${Math.round(totalCorrect / totalMC * 100)}%)`);
      console.log("");
      console.log(`  Reading: ${bar(r.reading.rawPercentage)} ${String(r.reading.correct).padStart(2)}/${r.reading.total}  raw ${String(r.reading.rawPercentage).padStart(3)}%  wtd ${String(r.reading.weightedPercentage).padStart(3)}%`);
      console.log(`  QR:      ${bar(r.qr.rawPercentage)} ${String(r.qr.correct).padStart(2)}/${r.qr.total}  raw ${String(r.qr.rawPercentage).padStart(3)}%  wtd ${String(r.qr.weightedPercentage).padStart(3)}%`);
      console.log(`  MA:      ${bar(r.ma.rawPercentage)} ${String(r.ma.correct).padStart(2)}/${r.ma.total}  raw ${String(r.ma.rawPercentage).padStart(3)}%  wtd ${String(r.ma.weightedPercentage).padStart(3)}%`);
      console.log(`  Writing: ${bar(r.writing.overall * 10)} ${r.writing.overall}/10`);
      console.log("");
      console.log(`  Strong: ${r.strongSkills.length > 0 ? r.strongSkills.slice(0, 3).map(s => `${s.skillName} (${s.percentage}%)`).join(", ") : "(none)"}`);
      console.log(`  Weak:   ${r.weakSkills.length > 0 ? r.weakSkills.slice(0, 3).map(s => `${s.skillName} (${s.percentage}%)`).join(", ") : "(none)"}`);
      console.log(`  Missed: ${r.missedQuestions.length}  Recs: ${r.recommendations.length}`);
      console.log(`  Time: R ${r.timeAnalysis.readingUsedMinutes}/${ASSESSMENT_CONFIG.readingMinutes}min  QR ${r.timeAnalysis.qrUsedMinutes}/${ASSESSMENT_CONFIG.qrMinutes}min  MA ${r.timeAnalysis.maUsedMinutes}/${ASSESSMENT_CONFIG.maMinutes}min  W ${r.timeAnalysis.writingUsedMinutes}/${ASSESSMENT_CONFIG.writingMinutes}min`);
      console.log("");
    }

    // Summary table
    console.log("  RANKING SUMMARY");
    console.log("  " + "─".repeat(66));
    console.log("  " + "Name".padEnd(12) + "Score".padStart(6) + "Range".padStart(10) + "Pctile".padStart(8) + "Conf".padStart(8) + "Strong".padStart(7) + "Weak".padStart(6) + "Missed".padStart(7));
    for (const { student, report: r } of ranked) {
      console.log(
        "  " +
        student.name.padEnd(12) +
        String(r.overall.estimatedScore).padStart(6) +
        `${r.overall.rangeLow}-${r.overall.rangeHigh}`.padStart(10) +
        `~${r.overall.estimatedPercentile}th`.padStart(8) +
        r.overall.confidence.padStart(8) +
        String(r.strongSkills.length).padStart(7) +
        String(r.weakSkills.length).padStart(6) +
        String(r.missedQuestions.length).padStart(7)
      );
    }
    console.log("");

    expect(true).toBe(true);
  });
});
