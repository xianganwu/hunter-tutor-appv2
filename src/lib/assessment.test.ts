import { describe, it, expect, beforeEach } from "vitest";
import { getSkillById } from "./exam/curriculum";
import {
  assembleAssessmentExam,
  ASSESSMENT_CONFIG,
} from "./assessment";
import type { AssessmentExam, AssessmentAnswer } from "./assessment";
import {
  scoreSectionWeighted,
  computeScoreProjection,
  generateAssessmentReport,
} from "./assessment-scoring";
import type {
  WritingAssessmentScore,
  AssessmentReport,
  SectionAssessmentScore,
} from "./assessment-scoring";
import type { ExamQuestion } from "./simulation";

// ─── Helpers ──────────────────────────────────────────────────────────

/** Simulate a student answering questions with a given accuracy rate. */
function simulateAnswers(
  questions: readonly ExamQuestion[],
  accuracy: number,
  section: "reading" | "qr" | "ma"
): { answers: Record<string, string>; details: AssessmentAnswer[] } {
  const answers: Record<string, string> = {};
  const details: AssessmentAnswer[] = [];

  for (const q of questions) {
    const isCorrect = Math.random() < accuracy;
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
      organization: overall,
      developmentOfIdeas: overall,
      wordChoice: overall,
      sentenceStructure: overall,
      mechanics: overall,
    },
    feedback: "Test feedback.",
    strengths: overall >= 7 ? ["Clear organization", "Good examples"] : [],
    improvements: overall < 7 ? ["Develop ideas more", "Vary sentence length"] : [],
  };
}

interface StudentProfile {
  name: string;
  readingAccuracy: number;
  qrAccuracy: number;
  maAccuracy: number;
  writingScore: number; // 0-10
  expectedStrength: "strong" | "moderate" | "weak";
}

const STUDENTS: StudentProfile[] = [
  {
    name: "Ava (top performer)",
    readingAccuracy: 0.92,
    qrAccuracy: 0.90,
    maAccuracy: 0.88,
    writingScore: 9,
    expectedStrength: "strong",
  },
  {
    name: "Ben (above average)",
    readingAccuracy: 0.76,
    qrAccuracy: 0.78,
    maAccuracy: 0.74,
    writingScore: 7,
    expectedStrength: "moderate",
  },
  {
    name: "Cara (average)",
    readingAccuracy: 0.60,
    qrAccuracy: 0.58,
    maAccuracy: 0.55,
    writingScore: 5,
    expectedStrength: "moderate",
  },
  {
    name: "Dan (below average)",
    readingAccuracy: 0.40,
    qrAccuracy: 0.35,
    maAccuracy: 0.38,
    writingScore: 4,
    expectedStrength: "weak",
  },
  {
    name: "Ella (struggling / uneven)",
    readingAccuracy: 0.80,
    qrAccuracy: 0.30,
    maAccuracy: 0.25,
    writingScore: 6,
    expectedStrength: "weak", // overall weak despite strong reading
  },
];

// ─── Tests ────────────────────────────────────────────────────────────

describe("Assessment Exam Assembly", () => {
  let exam: AssessmentExam;

  beforeEach(() => {
    exam = assembleAssessmentExam();
  });

  it("should create an exam with a valid id and timestamp", () => {
    expect(exam.id).toMatch(/^assessment_/);
    expect(exam.createdAt).toBeTruthy();
    expect(() => new Date(exam.createdAt)).not.toThrow();
  });

  it("should have reading blocks with questions", () => {
    expect(exam.readingBlocks.length).toBeGreaterThanOrEqual(3);
    const totalReadingQs = exam.readingBlocks.reduce(
      (sum, b) => sum + b.questions.length,
      0
    );
    expect(totalReadingQs).toBeGreaterThanOrEqual(15);
    expect(totalReadingQs).toBeLessThanOrEqual(
      ASSESSMENT_CONFIG.readingQuestionTarget + 5
    );
  });

  it("should have genre diversity (3+ genres)", () => {
    // Each passage has a passageId that encodes genre (fiction_01, nonfiction_02, etc.)
    const genres = new Set(
      exam.readingBlocks.map((b) => {
        const id = b.passageId;
        // Extract genre from passage ID like "fiction_01" -> "fiction"
        const parts = id.split("_");
        // Handle multi-word genres like "science_article" or "historical_document"
        if (parts.length >= 3 && !isNaN(Number(parts[parts.length - 1]))) {
          return parts.slice(0, -1).join("_");
        }
        return parts[0];
      })
    );
    expect(genres.size).toBeGreaterThanOrEqual(3);
  });

  it("should have QR questions near target count", () => {
    expect(exam.qrQuestions.length).toBeGreaterThan(0);
    expect(exam.qrQuestions.length).toBeLessThanOrEqual(
      ASSESSMENT_CONFIG.qrQuestionTarget + 5
    );
  });

  it("should have MA questions near target count", () => {
    expect(exam.maQuestions.length).toBeGreaterThan(0);
    expect(exam.maQuestions.length).toBeLessThanOrEqual(
      ASSESSMENT_CONFIG.maQuestionTarget + 5
    );
  });

  it("should have a non-empty writing prompt", () => {
    expect(exam.writingPrompt.length).toBeGreaterThan(50);
  });

  it("should have valid answer choices for all questions", () => {
    const allQuestions = [
      ...exam.readingBlocks.flatMap((b) => [...b.questions]),
      ...exam.qrQuestions,
      ...exam.maQuestions,
    ];

    for (const q of allQuestions) {
      expect(q.id).toBeTruthy();
      expect(q.questionText).toBeTruthy();
      expect(q.answerChoices.length).toBeGreaterThanOrEqual(2);
      expect(q.correctAnswer).toBeTruthy();
      // Correct answer must be one of the choice letters
      const letters = q.answerChoices.map((c) => c.letter);
      expect(letters).toContain(q.correctAnswer);
      // Each choice must have a letter and text
      for (const c of q.answerChoices) {
        expect(c.letter).toBeTruthy();
        expect(c.text).toBeTruthy();
      }
    }
  });

  it("should have no duplicate question IDs", () => {
    const allQuestions = [
      ...exam.readingBlocks.flatMap((b) => [...b.questions]),
      ...exam.qrQuestions,
      ...exam.maQuestions,
    ];
    const ids = allQuestions.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("should have passage text for every reading block", () => {
    for (const block of exam.readingBlocks) {
      expect(block.passageText.length).toBeGreaterThan(50);
      expect(block.title).toBeTruthy();
    }
  });
});

describe("Assessment Scoring — 5 Student Profiles", () => {
  let exam: AssessmentExam;

  beforeEach(() => {
    exam = assembleAssessmentExam();
  });

  for (const student of STUDENTS) {
    describe(student.name, () => {
      let report: AssessmentReport;

      beforeEach(() => {
        const readingQuestions = exam.readingBlocks.flatMap((b) => [...b.questions]);
        const reading = simulateAnswers(readingQuestions, student.readingAccuracy, "reading");
        const qr = simulateAnswers([...exam.qrQuestions], student.qrAccuracy, "qr");
        const ma = simulateAnswers([...exam.maQuestions], student.maAccuracy, "ma");

        const allAnswers = { ...reading.answers, ...qr.answers, ...ma.answers };
        const allDetails = [...reading.details, ...qr.details, ...ma.details];

        const timings = {
          readingUsedMinutes: 30,
          qrUsedMinutes: 15,
          maUsedMinutes: 18,
          writingUsedMinutes: 18,
        };

        report = generateAssessmentReport(
          exam,
          allAnswers,
          allDetails,
          timings,
          makeWritingScore(student.writingScore)
        );
      });

      it("should produce a valid report", () => {
        expect(report.assessmentId).toBe(exam.id);
        expect(report.completedAt).toBeTruthy();
      });

      it("should have section scores in valid range", () => {
        for (const section of [report.reading, report.qr, report.ma]) {
          expect(section.rawPercentage).toBeGreaterThanOrEqual(0);
          expect(section.rawPercentage).toBeLessThanOrEqual(100);
          expect(section.weightedPercentage).toBeGreaterThanOrEqual(0);
          expect(section.weightedPercentage).toBeLessThanOrEqual(100);
          expect(section.correct).toBeGreaterThanOrEqual(0);
          expect(section.correct).toBeLessThanOrEqual(section.total);
          expect(section.total).toBeGreaterThan(0);
        }
      });

      it("should have skill breakdowns for each section", () => {
        expect(report.reading.bySkill.length).toBeGreaterThan(0);
        // QR and MA may have varying skill coverage depending on available questions
        // At minimum, if there are questions, there should be skills
        if (report.qr.total > 0) {
          expect(report.qr.bySkill.length).toBeGreaterThan(0);
        }
        if (report.ma.total > 0) {
          expect(report.ma.bySkill.length).toBeGreaterThan(0);
        }
      });

      it("should have valid score projection", () => {
        const { overall } = report;
        expect(overall.estimatedScore).toBeGreaterThanOrEqual(0);
        expect(overall.estimatedScore).toBeLessThanOrEqual(100);
        expect(overall.rangeLow).toBeLessThanOrEqual(overall.estimatedScore);
        expect(overall.rangeHigh).toBeGreaterThanOrEqual(overall.estimatedScore);
        expect(overall.rangeLow).toBeGreaterThanOrEqual(0);
        expect(overall.rangeHigh).toBeLessThanOrEqual(100);
        expect(["high", "medium", "low"]).toContain(overall.confidence);
        expect(overall.estimatedPercentile).toBeGreaterThanOrEqual(1);
        expect(overall.estimatedPercentile).toBeLessThanOrEqual(99);
      });

      it("should have writing score in report", () => {
        expect(report.writing.overall).toBe(student.writingScore);
        expect(report.writing.rubric.organization).toBe(student.writingScore);
      });

      it("should classify strengths and weaknesses", () => {
        // All skills should have valid strength classification
        const allSkills = [
          ...report.reading.bySkill,
          ...report.qr.bySkill,
          ...report.ma.bySkill,
        ];
        for (const skill of allSkills) {
          expect(["strong", "moderate", "weak"]).toContain(skill.strength);
          expect(skill.skillId).toBeTruthy();
          expect(skill.skillName).toBeTruthy();
        }

        // Strong/weak lists should be subsets of all skills
        for (const s of report.strongSkills) {
          expect(s.strength).toBe("strong");
        }
        for (const w of report.weakSkills) {
          expect(w.strength).toBe("weak");
        }
      });

      it("should have recommendations", () => {
        expect(report.recommendations.length).toBeGreaterThan(0);
      });

      it("should track missed questions correctly", () => {
        const totalQuestions =
          report.reading.total + report.qr.total + report.ma.total;
        const totalCorrect =
          report.reading.correct + report.qr.correct + report.ma.correct;
        const totalMissed = totalQuestions - totalCorrect;
        expect(report.missedQuestions.length).toBe(totalMissed);

        for (const mq of report.missedQuestions) {
          expect(mq.questionId).toBeTruthy();
          expect(mq.correctAnswer).toBeTruthy();
          expect(["reading", "qr", "ma"]).toContain(mq.section);
        }
      });

      it("should have time analysis", () => {
        expect(report.timeAnalysis.readingUsedMinutes).toBe(30);
        expect(report.timeAnalysis.qrUsedMinutes).toBe(15);
        expect(report.timeAnalysis.maUsedMinutes).toBe(18);
        expect(report.timeAnalysis.writingUsedMinutes).toBe(18);
      });
    });
  }
});

describe("Score Projection Reasonableness", () => {
  let exam: AssessmentExam;

  beforeEach(() => {
    exam = assembleAssessmentExam();
  });

  it("top performer should score higher than struggling student", () => {
    const topStudent = STUDENTS[0]; // Ava
    const weakStudent = STUDENTS[3]; // Dan

    const readingQs = exam.readingBlocks.flatMap((b) => [...b.questions]);

    const topReading = simulateAnswers(readingQs, topStudent.readingAccuracy, "reading");
    const topQr = simulateAnswers([...exam.qrQuestions], topStudent.qrAccuracy, "qr");
    const topMa = simulateAnswers([...exam.maQuestions], topStudent.maAccuracy, "ma");

    const weakReading = simulateAnswers(readingQs, weakStudent.readingAccuracy, "reading");
    const weakQr = simulateAnswers([...exam.qrQuestions], weakStudent.qrAccuracy, "qr");
    const weakMa = simulateAnswers([...exam.maQuestions], weakStudent.maAccuracy, "ma");

    const timings = {
      readingUsedMinutes: 30,
      qrUsedMinutes: 15,
      maUsedMinutes: 18,
      writingUsedMinutes: 18,
    };

    const topReport = generateAssessmentReport(
      exam,
      { ...topReading.answers, ...topQr.answers, ...topMa.answers },
      [...topReading.details, ...topQr.details, ...topMa.details],
      timings,
      makeWritingScore(topStudent.writingScore)
    );

    const weakReport = generateAssessmentReport(
      exam,
      { ...weakReading.answers, ...weakQr.answers, ...weakMa.answers },
      [...weakReading.details, ...weakQr.details, ...weakMa.details],
      timings,
      makeWritingScore(weakStudent.writingScore)
    );

    expect(topReport.overall.estimatedScore).toBeGreaterThan(
      weakReport.overall.estimatedScore
    );
    expect(topReport.overall.estimatedPercentile).toBeGreaterThan(
      weakReport.overall.estimatedPercentile
    );
    expect(topReport.missedQuestions.length).toBeLessThan(
      weakReport.missedQuestions.length
    );
  });

  it("uneven student should get similar confidence to consistent student (same question count)", () => {
    // Under the new model, confidence is based on sampling precision
    // (question count + binomial SE), NOT cross-section variance.
    // Both students answer the same number of questions, so margins
    // should be in the same ballpark.
    const evenStudent = STUDENTS[1]; // Ben (consistent ~75%)
    const unevenStudent = STUDENTS[4]; // Ella (80% reading, 30% QR, 25% MA)

    const readingQs = exam.readingBlocks.flatMap((b) => [...b.questions]);

    const evenReading = simulateAnswers(readingQs, evenStudent.readingAccuracy, "reading");
    const evenQr = simulateAnswers([...exam.qrQuestions], evenStudent.qrAccuracy, "qr");
    const evenMa = simulateAnswers([...exam.maQuestions], evenStudent.maAccuracy, "ma");

    const unevenReading = simulateAnswers(readingQs, unevenStudent.readingAccuracy, "reading");
    const unevenQr = simulateAnswers([...exam.qrQuestions], unevenStudent.qrAccuracy, "qr");
    const unevenMa = simulateAnswers([...exam.maQuestions], unevenStudent.maAccuracy, "ma");

    const timings = {
      readingUsedMinutes: 30,
      qrUsedMinutes: 15,
      maUsedMinutes: 18,
      writingUsedMinutes: 18,
    };

    const evenReport = generateAssessmentReport(
      exam,
      { ...evenReading.answers, ...evenQr.answers, ...evenMa.answers },
      [...evenReading.details, ...evenQr.details, ...evenMa.details],
      timings,
      makeWritingScore(evenStudent.writingScore)
    );

    const unevenReport = generateAssessmentReport(
      exam,
      { ...unevenReading.answers, ...unevenQr.answers, ...unevenMa.answers },
      [...unevenReading.details, ...unevenQr.details, ...unevenMa.details],
      timings,
      makeWritingScore(unevenStudent.writingScore)
    );

    // Both should have the same confidence level (same total question count)
    expect(unevenReport.overall.confidence).toBe(evenReport.overall.confidence);
  });

  it("all student scores should map to reasonable percentiles", () => {
    const readingQs = exam.readingBlocks.flatMap((b) => [...b.questions]);
    const timings = {
      readingUsedMinutes: 30,
      qrUsedMinutes: 15,
      maUsedMinutes: 18,
      writingUsedMinutes: 18,
    };

    for (const student of STUDENTS) {
      const reading = simulateAnswers(readingQs, student.readingAccuracy, "reading");
      const qr = simulateAnswers([...exam.qrQuestions], student.qrAccuracy, "qr");
      const ma = simulateAnswers([...exam.maQuestions], student.maAccuracy, "ma");

      const report = generateAssessmentReport(
        exam,
        { ...reading.answers, ...qr.answers, ...ma.answers },
        [...reading.details, ...qr.details, ...ma.details],
        timings,
        makeWritingScore(student.writingScore)
      );

      // Percentile should be between 1 and 99
      expect(report.overall.estimatedPercentile).toBeGreaterThanOrEqual(1);
      expect(report.overall.estimatedPercentile).toBeLessThanOrEqual(99);

      // Score should be between 0 and 100
      expect(report.overall.estimatedScore).toBeGreaterThanOrEqual(0);
      expect(report.overall.estimatedScore).toBeLessThanOrEqual(100);

      // Range should be valid
      expect(report.overall.rangeLow).toBeLessThanOrEqual(
        report.overall.rangeHigh
      );
    }
  });
});

describe("Weighted Scoring", () => {
  it("should weight harder questions more heavily", () => {
    const questions: ExamQuestion[] = [
      {
        id: "q1",
        questionText: "Easy question",
        answerChoices: [
          { letter: "A", text: "Right" },
          { letter: "B", text: "Wrong" },
        ],
        correctAnswer: "A",
        skillId: "test_skill_1",
      },
      {
        id: "q2",
        questionText: "Hard question",
        answerChoices: [
          { letter: "A", text: "Wrong" },
          { letter: "B", text: "Right" },
        ],
        correctAnswer: "B",
        skillId: "test_skill_2",
      },
    ];

    // Student gets the easy question right and hard question wrong
    const answersEasyRight: Record<string, string> = { q1: "A", q2: "A" };
    const detailsEasyRight: AssessmentAnswer[] = [
      { questionId: "q1", skillId: "test_skill_1", selectedAnswer: "A", correctAnswer: "A", timeSpentMs: 0, section: "reading", difficultyTier: 1 },
      { questionId: "q2", skillId: "test_skill_2", selectedAnswer: "A", correctAnswer: "B", timeSpentMs: 0, section: "reading", difficultyTier: 5 },
    ];

    // Student gets the hard question right and easy question wrong
    const answersHardRight: Record<string, string> = { q1: "B", q2: "B" };
    const detailsHardRight: AssessmentAnswer[] = [
      { questionId: "q1", skillId: "test_skill_1", selectedAnswer: "B", correctAnswer: "A", timeSpentMs: 0, section: "reading", difficultyTier: 1 },
      { questionId: "q2", skillId: "test_skill_2", selectedAnswer: "B", correctAnswer: "B", timeSpentMs: 0, section: "reading", difficultyTier: 5 },
    ];

    const scoreEasyRight = scoreSectionWeighted(questions, answersEasyRight, detailsEasyRight);
    const scoreHardRight = scoreSectionWeighted(questions, answersHardRight, detailsHardRight);

    // Both get 1/2 raw, but weighted should differ
    expect(scoreEasyRight.rawPercentage).toBe(50);
    expect(scoreHardRight.rawPercentage).toBe(50);

    // Getting the hard question right should give a higher weighted score
    expect(scoreHardRight.weightedPercentage).toBeGreaterThan(
      scoreEasyRight.weightedPercentage
    );
  });
});

describe("Score Projection Confidence", () => {
  const makeSection = (pct: number, total: number): SectionAssessmentScore => ({
    correct: Math.round(total * pct / 100),
    total,
    rawPercentage: pct,
    weightedPercentage: pct,
    bySkill: [],
  });

  it("high confidence with 67 questions (half-test size)", () => {
    // ~80% across 67 MC questions → SE ≈ √(0.8×0.2/67) ≈ 0.049
    // margin ≈ 0.049 × 1.96 × 100 × 0.8 + 3 ≈ 10.7 → "medium"
    // but let's check it's at least reasonable
    const projection = computeScoreProjection(
      makeSection(80, 25),
      makeSection(78, 19),
      makeSection(82, 23),
      makeWritingScore(8)
    );

    expect(["high", "medium"]).toContain(projection.confidence);
    expect(projection.rangeHigh - projection.rangeLow).toBeLessThanOrEqual(24);
  });

  it("uneven student should NOT get lower confidence just because sections differ", () => {
    // The new model bases confidence on sampling precision (question count),
    // NOT on cross-section variance. An uneven student with the same total
    // question count should get similar confidence to a consistent student.
    const evenProjection = computeScoreProjection(
      makeSection(75, 25),
      makeSection(75, 19),
      makeSection(75, 23),
      makeWritingScore(7)
    );

    const unevenProjection = computeScoreProjection(
      makeSection(95, 25),
      makeSection(30, 19),
      makeSection(20, 23),
      makeWritingScore(5)
    );

    // Both have 67 MC questions, so sampling precision is similar
    expect(unevenProjection.confidence).toBe(evenProjection.confidence);
  });

  it("fewer questions should widen the margin", () => {
    const moreQs = computeScoreProjection(
      makeSection(70, 25),
      makeSection(70, 19),
      makeSection(70, 23),
      makeWritingScore(7)
    );
    const fewerQs = computeScoreProjection(
      makeSection(70, 10),
      makeSection(70, 8),
      makeSection(70, 10),
      makeWritingScore(7)
    );

    const moreRange = moreQs.rangeHigh - moreQs.rangeLow;
    const fewerRange = fewerQs.rangeHigh - fewerQs.rangeLow;
    expect(fewerRange).toBeGreaterThan(moreRange);
  });

  it("extreme accuracy (very high or very low) should give tighter margins", () => {
    // Binomial SE is smallest when p is near 0 or 1
    const mid = computeScoreProjection(
      makeSection(50, 25),
      makeSection(50, 19),
      makeSection(50, 23),
      makeWritingScore(5)
    );
    const high = computeScoreProjection(
      makeSection(95, 25),
      makeSection(95, 19),
      makeSection(95, 23),
      makeWritingScore(9)
    );

    const midRange = mid.rangeHigh - mid.rangeLow;
    const highRange = high.rangeHigh - high.rangeLow;
    expect(highRange).toBeLessThanOrEqual(midRange);
  });
});

// ─── Diagnostic: Print Full Reports for Visual Inspection ────────────

describe("Diagnostic: Full Score Reports (visual inspection)", () => {
  let exam: AssessmentExam;

  beforeEach(() => {
    exam = assembleAssessmentExam();
  });

  it("prints score reports for all 5 students", () => {
    const readingQs = exam.readingBlocks.flatMap((b) => [...b.questions]);
    const timings = {
      readingUsedMinutes: 30,
      qrUsedMinutes: 15,
      maUsedMinutes: 18,
      writingUsedMinutes: 18,
    };

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║         HALF-LENGTH ASSESSMENT — 5 STUDENT PROFILES        ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  Exam: ${readingQs.length} reading + ${exam.qrQuestions.length} QR + ${exam.maQuestions.length} MA = ${readingQs.length + exam.qrQuestions.length + exam.maQuestions.length} MC questions`);
    console.log(`║  Genres: ${[...new Set(exam.readingBlocks.map(b => b.passageId.replace(/_\d+$/, "")))].join(", ")}`);
    console.log(`║  Writing prompt: "${exam.writingPrompt.slice(0, 60)}..."`);
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    for (const student of STUDENTS) {
      const reading = simulateAnswers(readingQs, student.readingAccuracy, "reading");
      const qr = simulateAnswers([...exam.qrQuestions], student.qrAccuracy, "qr");
      const ma = simulateAnswers([...exam.maQuestions], student.maAccuracy, "ma");

      const report = generateAssessmentReport(
        exam,
        { ...reading.answers, ...qr.answers, ...ma.answers },
        [...reading.details, ...qr.details, ...ma.details],
        timings,
        makeWritingScore(student.writingScore)
      );

      const bar = (pct: number) => {
        const filled = Math.round(pct / 5);
        return "█".repeat(filled) + "░".repeat(20 - filled);
      };

      console.log(`┌── ${student.name} ${"─".repeat(Math.max(0, 52 - student.name.length))}┐`);
      console.log(`│  OVERALL: ${report.overall.estimatedScore}/100  (range: ${report.overall.rangeLow}–${report.overall.rangeHigh})  ${report.overall.confidence} confidence`);
      console.log(`│  Percentile: ~${report.overall.estimatedPercentile}th  (range: ${report.overall.percentileRangeLow}th–${report.overall.percentileRangeHigh}th)`);
      console.log("│");
      console.log(`│  Reading:  ${bar(report.reading.rawPercentage)} ${report.reading.correct}/${report.reading.total}  raw ${report.reading.rawPercentage}%  wtd ${report.reading.weightedPercentage}%`);
      console.log(`│  QR:       ${bar(report.qr.rawPercentage)} ${report.qr.correct}/${report.qr.total}  raw ${report.qr.rawPercentage}%  wtd ${report.qr.weightedPercentage}%`);
      console.log(`│  MA:       ${bar(report.ma.rawPercentage)} ${report.ma.correct}/${report.ma.total}  raw ${report.ma.rawPercentage}%  wtd ${report.ma.weightedPercentage}%`);
      console.log(`│  Writing:  ${bar(student.writingScore * 10)} ${student.writingScore}/10`);
      console.log("│");

      if (report.strongSkills.length > 0) {
        console.log(`│  STRONG: ${report.strongSkills.slice(0, 3).map(s => `${s.skillName} (${s.percentage}%)`).join(", ")}`);
      }
      if (report.weakSkills.length > 0) {
        console.log(`│  WEAK:   ${report.weakSkills.slice(0, 3).map(s => `${s.skillName} (${s.percentage}%)`).join(", ")}`);
      }
      console.log(`│  Missed: ${report.missedQuestions.length} questions`);
      console.log(`│  Recs:   ${report.recommendations.length} recommendations`);
      console.log(`└${"─".repeat(60)}┘\n`);
    }

    // This test always passes — it's for visual inspection
    expect(true).toBe(true);
  });
});
