import type { ExamQuestion, MissedQuestion } from "@/lib/simulation";
import { estimatePercentile, getSkillPracticeRoute } from "@/lib/simulation";
import { getSkillById } from "@/lib/exam/curriculum";
import {
  loadSkillMastery,
  saveSkillMastery,
} from "@/lib/skill-mastery-store";
import type { AssessmentAnswer, AssessmentExam } from "@/lib/assessment";

// ─── Types ────────────────────────────────────────────────────────────

export interface SkillAssessment {
  readonly skillId: string;
  readonly skillName: string;
  readonly correct: number;
  readonly total: number;
  readonly percentage: number;
  readonly strength: "strong" | "moderate" | "weak";
}

export interface SectionAssessmentScore {
  readonly correct: number;
  readonly total: number;
  readonly rawPercentage: number;
  readonly weightedPercentage: number;
  readonly bySkill: readonly SkillAssessment[];
}

export interface WritingAssessmentScore {
  readonly overall: number; // 0-10
  readonly rubric: {
    readonly organization: number;
    readonly developmentOfIdeas: number;
    readonly wordChoice: number;
    readonly sentenceStructure: number;
    readonly mechanics: number;
  };
  readonly feedback: string;
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
}

export interface ScoreProjection {
  readonly estimatedScore: number;
  readonly rangeLow: number;
  readonly rangeHigh: number;
  readonly estimatedPercentile: number;
  readonly percentileRangeLow: number;
  readonly percentileRangeHigh: number;
  readonly confidence: "high" | "medium" | "low";
}

export interface AssessmentReport {
  readonly assessmentId: string;
  readonly completedAt: string;
  readonly reading: SectionAssessmentScore;
  readonly qr: SectionAssessmentScore;
  readonly ma: SectionAssessmentScore;
  readonly writing: WritingAssessmentScore;
  readonly overall: ScoreProjection;
  readonly timeAnalysis: {
    readonly readingUsedMinutes: number;
    readonly qrUsedMinutes: number;
    readonly maUsedMinutes: number;
    readonly writingUsedMinutes: number;
  };
  readonly strongSkills: readonly SkillAssessment[];
  readonly weakSkills: readonly SkillAssessment[];
  readonly recommendations: readonly string[];
  readonly missedQuestions: readonly MissedQuestion[];
}

// ─── Difficulty Weights ───────────────────────────────────────────────

/**
 * Weight multipliers by difficulty tier.
 * Harder questions contribute more to the weighted score.
 */
const TIER_WEIGHTS: Record<number, number> = {
  1: 0.6,
  2: 0.8,
  3: 1.0,
  4: 1.2,
  5: 1.5,
} as const;

function getTierWeight(tier: number): number {
  return TIER_WEIGHTS[tier] ?? 1.0;
}

// ─── Section Scoring ──────────────────────────────────────────────────

/**
 * Classify a skill's strength based on its accuracy percentage.
 */
function classifyStrength(
  percentage: number
): "strong" | "moderate" | "weak" {
  if (percentage >= 80) return "strong";
  if (percentage >= 50) return "moderate";
  return "weak";
}

/**
 * Score a section with difficulty-weighted scoring.
 *
 * Each question's contribution is weighted by its difficulty tier:
 * - tier 1 = 0.6, tier 2 = 0.8, tier 3 = 1.0, tier 4 = 1.2, tier 5 = 1.5
 *
 * Weighted score = sum(correct * weight) / sum(all weights)
 *
 * @param questions - The questions in the section
 * @param answers - Map of questionId -> selected answer letter
 * @param answerDetails - Detailed answer records with timing and difficulty info
 */
export function scoreSectionWeighted(
  questions: readonly ExamQuestion[],
  answers: Readonly<Record<string, string>>,
  answerDetails: readonly AssessmentAnswer[]
): SectionAssessmentScore {
  // Build a lookup from question ID to difficulty tier
  const tierByQuestion = new Map<string, number>();
  for (const detail of answerDetails) {
    tierByQuestion.set(detail.questionId, detail.difficultyTier);
  }

  // Per-skill tracking
  const bySkill = new Map<
    string,
    { correct: number; total: number; weightedCorrect: number; weightedTotal: number }
  >();

  let rawCorrect = 0;
  let weightedCorrectSum = 0;
  let weightedTotalSum = 0;

  for (const q of questions) {
    const selected = answers[q.id];
    const isCorrect = selected === q.correctAnswer;
    const tier = tierByQuestion.get(q.id) ?? 3;
    const weight = getTierWeight(tier);

    if (isCorrect) rawCorrect++;
    weightedCorrectSum += isCorrect ? weight : 0;
    weightedTotalSum += weight;

    const existing = bySkill.get(q.skillId) ?? {
      correct: 0,
      total: 0,
      weightedCorrect: 0,
      weightedTotal: 0,
    };
    bySkill.set(q.skillId, {
      correct: existing.correct + (isCorrect ? 1 : 0),
      total: existing.total + 1,
      weightedCorrect: existing.weightedCorrect + (isCorrect ? weight : 0),
      weightedTotal: existing.weightedTotal + weight,
    });
  }

  const skillAssessments: SkillAssessment[] = Array.from(
    bySkill.entries()
  ).map(([skillId, data]) => {
    const skill = getSkillById(skillId);
    const percentage =
      data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    return {
      skillId,
      skillName: skill?.name ?? skillId,
      correct: data.correct,
      total: data.total,
      percentage,
      strength: classifyStrength(percentage),
    };
  });

  // Sort weakest first
  skillAssessments.sort((a, b) => a.percentage - b.percentage);

  const rawPercentage =
    questions.length > 0
      ? Math.round((rawCorrect / questions.length) * 100)
      : 0;
  const weightedPercentage =
    weightedTotalSum > 0
      ? Math.round((weightedCorrectSum / weightedTotalSum) * 100)
      : 0;

  return {
    correct: rawCorrect,
    total: questions.length,
    rawPercentage,
    weightedPercentage,
    bySkill: skillAssessments,
  };
}

// ─── Score Projection ─────────────────────────────────────────────────

/**
 * Compute an overall score projection by combining section scores.
 *
 * Applies section weighting that mirrors the real Hunter exam:
 * - Reading: 30%
 * - QR: 20%
 * - MA: 30%
 * - Writing: 20%
 *
 * Confidence interval widens when:
 * - Performance is inconsistent across sections
 * - Question count is low
 */
export function computeScoreProjection(
  readingScore: SectionAssessmentScore,
  qrScore: SectionAssessmentScore,
  maScore: SectionAssessmentScore,
  writingScore: WritingAssessmentScore
): ScoreProjection {
  // Section weights (approximate Hunter exam weighting)
  const readingWeight = 0.30;
  const qrWeight = 0.20;
  const maWeight = 0.30;
  const writingWeight = 0.20;

  // Convert writing to 0-100 scale (it's 0-10)
  const writingPct = writingScore.overall * 10;

  // Composite weighted score
  const compositeScore = Math.round(
    readingScore.weightedPercentage * readingWeight +
    qrScore.weightedPercentage * qrWeight +
    maScore.weightedPercentage * maWeight +
    writingPct * writingWeight
  );

  // ── Confidence model ─────────────────────────────────────────────
  //
  // We compute confidence from two independent factors:
  //
  // 1. **Sampling precision** — more MC questions → tighter estimate.
  //    With n questions and observed proportion p, the 95 % margin of
  //    error is ≈ 1.96 × √(p(1−p)/n).  This is a statistical bound
  //    on how much the *true* percentage could differ from what we
  //    measured, independent of whether the student is "consistent."
  //
  // 2. **Cross-section spread** — large gaps between sections (e.g.
  //    90 % reading, 30 % math) don't reduce confidence in the
  //    *composite* score; they just mean the student has uneven
  //    skills.  We report this separately in the strength/weakness
  //    breakdown rather than inflating the margin of error.
  //
  // Writing is excluded from precision because it's AI-scored on a
  // 0-10 rubric with a fixed 20 % weight, so it doesn't contribute
  // sampling noise the way MC does.

  const totalQuestions =
    readingScore.total + qrScore.total + maScore.total;

  // Observed MC proportion (0-1)
  const totalCorrect =
    readingScore.correct + qrScore.correct + maScore.correct;
  const p = totalQuestions > 0 ? totalCorrect / totalQuestions : 0.5;

  // Standard error of the MC composite (binomial approximation)
  const se = totalQuestions > 0
    ? Math.sqrt((p * (1 - p)) / totalQuestions)
    : 0.15; // conservative fallback

  // 95 % margin on 0-100 scale (MC portion only, which is 80 % of score)
  const mcMargin = Math.round(se * 1.96 * 100 * 0.80);

  // Fixed writing uncertainty: mock scores add ~3 pts of uncertainty
  const writingUncertainty = 3;

  const margin = Math.max(3, mcMargin + writingUncertainty);

  // Confidence label based on margin width
  let confidence: "high" | "medium" | "low";
  if (margin <= 8) {
    confidence = "high";
  } else if (margin <= 13) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  const rangeLow = Math.max(0, compositeScore - margin);
  const rangeHigh = Math.min(100, compositeScore + margin);

  return {
    estimatedScore: compositeScore,
    rangeLow,
    rangeHigh,
    estimatedPercentile: estimatePercentile(compositeScore),
    percentileRangeLow: estimatePercentile(rangeLow),
    percentileRangeHigh: estimatePercentile(rangeHigh),
    confidence,
  };
}

// ─── Missed Questions ─────────────────────────────────────────────────

/**
 * Collect all incorrectly answered questions across sections.
 */
function collectAssessmentMissedQuestions(
  readingQuestions: readonly ExamQuestion[],
  qrQuestions: readonly ExamQuestion[],
  maQuestions: readonly ExamQuestion[],
  answers: Readonly<Record<string, string>>
): MissedQuestion[] {
  const missed: MissedQuestion[] = [];

  const process = (
    questions: readonly ExamQuestion[],
    section: "reading" | "qr" | "ma"
  ) => {
    for (const q of questions) {
      const selected = answers[q.id];
      if (selected !== q.correctAnswer) {
        const skill = getSkillById(q.skillId);
        const studentChoice = q.answerChoices.find(
          (c) => c.letter === selected
        );
        const correctChoice = q.answerChoices.find(
          (c) => c.letter === q.correctAnswer
        );
        missed.push({
          questionId: q.id,
          questionText: q.questionText,
          studentAnswer: selected
            ? `${selected}) ${studentChoice?.text ?? ""}`
            : "(no answer)",
          correctAnswer: `${q.correctAnswer}) ${correctChoice?.text ?? ""}`,
          skillId: q.skillId,
          skillName: skill?.name ?? q.skillId,
          section,
        });
      }
    }
  };

  process(readingQuestions, "reading");
  process(qrQuestions, "qr");
  process(maQuestions, "ma");

  return missed;
}

// ─── Recommendations ──────────────────────────────────────────────────

/**
 * Generate study recommendations based on assessment results.
 */
function generateAssessmentRecommendations(
  reading: SectionAssessmentScore,
  qr: SectionAssessmentScore,
  ma: SectionAssessmentScore,
  writing: WritingAssessmentScore,
  timeAnalysis: AssessmentReport["timeAnalysis"]
): string[] {
  const recs: string[] = [];

  // Collect all skill assessments and find weakest
  const allSkills = [...reading.bySkill, ...qr.bySkill, ...ma.bySkill];
  const weakSkills = allSkills
    .filter((s) => s.strength === "weak")
    .sort((a, b) => a.percentage - b.percentage);

  if (weakSkills.length > 0) {
    const top3 = weakSkills.slice(0, 3);
    for (const s of top3) {
      const route = getSkillPracticeRoute(s.skillId);
      recs.push(
        `Focus on **${s.skillName}** (${s.correct}/${s.total} correct). [Practice this skill](${route}).`
      );
    }
  }

  // Section-level feedback
  if (reading.rawPercentage < 70) {
    recs.push(
      "Your reading comprehension needs attention. Try Reading Stamina mode to build passage endurance and speed."
    );
  }
  if (qr.rawPercentage < 70) {
    recs.push(
      "Quantitative reasoning was challenging. Focus on word problems and number pattern recognition in the math tutor."
    );
  }
  if (ma.rawPercentage < 70) {
    recs.push(
      "Math achievement has room for growth. Practice fractions, percents, and geometry fundamentals."
    );
  }

  // Writing feedback
  if (writing.overall < 6) {
    recs.push(
      "Your essay score suggests room to grow. Practice organizing your ideas into clear paragraphs with a strong introduction and conclusion."
    );
  }

  // Time management
  const readingAllocated = 35;
  const qrAllocated = 17;
  const maAllocated = 21;

  if (timeAnalysis.readingUsedMinutes >= readingAllocated * 0.95) {
    recs.push(
      "You ran tight on time in the reading section. Practice reading passages faster without sacrificing comprehension."
    );
  }
  if (timeAnalysis.qrUsedMinutes >= qrAllocated * 0.95) {
    recs.push(
      "You were pressed for time in quantitative reasoning. Practice mental math shortcuts and estimating answers."
    );
  }
  if (timeAnalysis.maUsedMinutes >= maAllocated * 0.95) {
    recs.push(
      "Math achievement timing was tight. Skip hard questions and come back to them with remaining time."
    );
  }

  // Overall encouragement
  const compositeRaw = Math.round(
    ((reading.correct + qr.correct + ma.correct) /
      Math.max(reading.total + qr.total + ma.total, 1)) *
      100
  );

  if (compositeRaw >= 85) {
    recs.push(
      "Strong overall performance! Focus on your weakest 1-2 skills to push into the top percentiles."
    );
  } else if (compositeRaw >= 70) {
    recs.push(
      "Solid foundation. Consistent daily practice on weak areas can raise your score significantly."
    );
  } else {
    recs.push(
      "Keep practicing! Target one skill per day and aim for steady improvement rather than cramming."
    );
  }

  return recs;
}

// ─── Report Generation ────────────────────────────────────────────────

/**
 * Generate a complete assessment report from exam data and student responses.
 *
 * @param exam - The assembled assessment exam
 * @param answers - Map of questionId -> selected answer letter
 * @param answerDetails - Detailed per-question answer records
 * @param timings - Time used per section in minutes
 * @param writingScore - AI-scored writing rubric
 */
export function generateAssessmentReport(
  exam: AssessmentExam,
  answers: Readonly<Record<string, string>>,
  answerDetails: readonly AssessmentAnswer[],
  timings: {
    readonly readingUsedMinutes: number;
    readonly qrUsedMinutes: number;
    readonly maUsedMinutes: number;
    readonly writingUsedMinutes: number;
  },
  writingScore: WritingAssessmentScore
): AssessmentReport {
  // Flatten reading questions from blocks
  const readingQuestions: ExamQuestion[] = exam.readingBlocks.flatMap(
    (b) => [...b.questions]
  );

  // Filter answer details by section
  const readingDetails = answerDetails.filter(
    (a) => a.section === "reading"
  );
  const qrDetails = answerDetails.filter((a) => a.section === "qr");
  const maDetails = answerDetails.filter((a) => a.section === "ma");

  // Score each section
  const readingScore = scoreSectionWeighted(
    readingQuestions,
    answers,
    readingDetails
  );
  const qrScore = scoreSectionWeighted(
    [...exam.qrQuestions],
    answers,
    qrDetails
  );
  const maScore = scoreSectionWeighted(
    [...exam.maQuestions],
    answers,
    maDetails
  );

  // Compute overall projection
  const overall = computeScoreProjection(
    readingScore,
    qrScore,
    maScore,
    writingScore
  );

  // Collect missed questions
  const missedQuestions = collectAssessmentMissedQuestions(
    readingQuestions,
    [...exam.qrQuestions],
    [...exam.maQuestions],
    answers
  );

  // Identify strong and weak skills
  const allSkills = [
    ...readingScore.bySkill,
    ...qrScore.bySkill,
    ...maScore.bySkill,
  ];
  const strongSkills = allSkills
    .filter((s) => s.strength === "strong")
    .sort((a, b) => b.percentage - a.percentage);
  const weakSkills = allSkills
    .filter((s) => s.strength === "weak")
    .sort((a, b) => a.percentage - b.percentage);

  // Generate recommendations
  const recommendations = generateAssessmentRecommendations(
    readingScore,
    qrScore,
    maScore,
    writingScore,
    timings
  );

  return {
    assessmentId: exam.id,
    completedAt: new Date().toISOString(),
    reading: readingScore,
    qr: qrScore,
    ma: maScore,
    writing: writingScore,
    overall,
    timeAnalysis: timings,
    strongSkills,
    weakSkills,
    recommendations,
    missedQuestions,
  };
}

// ─── One-Directional Mastery Update ───────────────────────────────────

/**
 * Update skill mastery based on assessment results.
 * Only updates UPWARD — if the assessment reveals higher ability
 * than the current stored mastery, the mastery is raised.
 * Never lowers mastery from assessment results.
 *
 * This ensures that a single bad assessment day doesn't erase
 * progress earned through consistent practice.
 */
export function applyOneDirectionalMasteryUpdate(
  report: AssessmentReport
): void {
  const allSkills = [
    ...report.reading.bySkill,
    ...report.qr.bySkill,
    ...report.ma.bySkill,
  ];

  for (const skillResult of allSkills) {
    // Skip skills with too few questions to be meaningful
    if (skillResult.total < 2) continue;

    const assessmentMastery = skillResult.percentage / 100;
    const existing = loadSkillMastery(skillResult.skillId);

    if (!existing) {
      // No prior mastery record — create one from assessment data
      saveSkillMastery({
        skillId: skillResult.skillId,
        masteryLevel: assessmentMastery,
        attemptsCount: skillResult.total,
        correctCount: skillResult.correct,
        lastPracticed: new Date().toISOString(),
        confidenceTrend: "stable",
      });
      continue;
    }

    // Only update upward
    if (assessmentMastery > existing.masteryLevel) {
      saveSkillMastery({
        ...existing,
        masteryLevel: assessmentMastery,
        attemptsCount: existing.attemptsCount + skillResult.total,
        correctCount: existing.correctCount + skillResult.correct,
        lastPracticed: new Date().toISOString(),
        // Keep confidence trend — assessment alone doesn't define trend
      });
    } else {
      // Even if mastery didn't increase, record the practice attempt
      saveSkillMastery({
        ...existing,
        attemptsCount: existing.attemptsCount + skillResult.total,
        correctCount: existing.correctCount + skillResult.correct,
        lastPracticed: new Date().toISOString(),
      });
    }
  }
}
