import type { Passage, PassageGenre } from "@/lib/types";
import { getAllPassages, getPassagesByGenre } from "@/lib/exam/passages";
import { getSkillById } from "@/lib/exam/curriculum";

// ─── Types ────────────────────────────────────────────────────────────

export interface ExamQuestion {
  readonly id: string;
  readonly questionText: string;
  readonly answerChoices: readonly { letter: string; text: string }[];
  readonly correctAnswer: string;
  readonly skillId: string;
}

export interface ExamPassageBlock {
  readonly passageId: string;
  readonly title: string;
  readonly preReadingContext: string;
  readonly passageText: string;
  readonly wordCount: number;
  readonly questions: readonly ExamQuestion[];
}

export interface SimulationExam {
  readonly id: string;
  readonly createdAt: string;
  readonly readingBlocks: readonly ExamPassageBlock[];
  readonly writingPrompt: { readonly id: string; readonly text: string };
  readonly qrQuestions: readonly ExamQuestion[];
  readonly maQuestions: readonly ExamQuestion[];
}

export interface SectionTiming {
  readonly sectionId: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly allocatedMinutes: number;
  readonly usedMinutes: number;
}

export interface SkillBreakdown {
  readonly skillId: string;
  readonly skillName: string;
  readonly correct: number;
  readonly total: number;
  readonly percentage: number;
}

export interface TimeAnalysis {
  readonly elaUsedMinutes: number;
  readonly elaAllocatedMinutes: number;
  readonly mathUsedMinutes: number;
  readonly mathAllocatedMinutes: number;
  readonly elaVerdict: "rushed" | "balanced" | "surplus";
  readonly mathVerdict: "rushed" | "balanced" | "surplus";
  readonly readingTimeEstimate: number;
  readonly writingTimeEstimate: number;
}

export interface SectionScore {
  readonly correct: number;
  readonly total: number;
  readonly percentage: number;
  readonly bySkill: readonly SkillBreakdown[];
}

export interface WritingScore {
  readonly score: number;
  readonly feedback: string;
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
}

export interface ScoreReport {
  readonly examId: string;
  readonly completedAt: string;
  readonly overall: {
    readonly correct: number;
    readonly total: number;
    readonly percentage: number;
    readonly estimatedPercentile: number;
  };
  readonly reading: SectionScore;
  readonly writing: WritingScore;
  readonly qr: SectionScore;
  readonly ma: SectionScore;
  readonly timeAnalysis: TimeAnalysis;
  readonly recommendations: readonly string[];
}

export interface StoredSimulation {
  readonly id: string;
  readonly completedAt: string;
  readonly report: ScoreReport;
}

// ─── Constants ────────────────────────────────────────────────────────

import { getStorageKey, notifyProgressChanged } from "./user-profile";

const STORAGE_KEY = "hunter-tutor-simulations";

export const COOLDOWN_DAYS = 14;
export const ELA_DURATION_MINUTES = 110;
export const MATH_DURATION_MINUTES = 75;
export const READING_QUESTION_TARGET = 50;
export const QR_QUESTION_COUNT = 37;
export const MA_QUESTION_COUNT = 47;

const GENRE_SELECTION_ORDER: PassageGenre[] = [
  "fiction",
  "nonfiction",
  "science_article",
  "historical_document",
  "poetry",
];

// ─── Reading Section Assembly ─────────────────────────────────────────

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function passageToBlock(p: Passage): ExamPassageBlock {
  return {
    passageId: p.metadata.passage_id,
    title: p.metadata.title,
    preReadingContext: p.pre_reading_context,
    passageText: p.passage_text,
    wordCount: p.metadata.word_count,
    questions: p.questions.map((q, i) => ({
      id: `${p.metadata.passage_id}_q${i + 1}`,
      questionText: q.question_text,
      answerChoices: q.answer_choices.map((c) => ({
        letter: c.letter,
        text: c.text,
      })),
      correctAnswer: q.correct_answer,
      skillId: q.skill_tested,
    })),
  };
}

/**
 * Assemble reading passage blocks for the ELA section.
 * Selects diverse passages to reach ~50 questions.
 */
export function assembleReadingSection(): ExamPassageBlock[] {
  const blocks: ExamPassageBlock[] = [];
  let totalQuestions = 0;

  // Pick one random passage from each genre
  for (const genre of shuffle(GENRE_SELECTION_ORDER)) {
    if (totalQuestions >= READING_QUESTION_TARGET) break;
    const genrePassages = shuffle(getPassagesByGenre(genre));
    if (genrePassages.length > 0) {
      const block = passageToBlock(genrePassages[0]);
      blocks.push(block);
      totalQuestions += block.questions.length;
    }
  }

  // If we still need more questions, add more passages
  if (totalQuestions < READING_QUESTION_TARGET) {
    const usedIds = new Set(blocks.map((b) => b.passageId));
    const remaining = shuffle(
      Array.from(getAllPassages().values()).filter(
        (p) => !usedIds.has(p.metadata.passage_id)
      )
    );

    for (const p of remaining) {
      if (totalQuestions >= READING_QUESTION_TARGET) break;
      const block = passageToBlock(p);
      blocks.push(block);
      totalQuestions += block.questions.length;
    }
  }

  // Trim excess questions from the last block
  if (totalQuestions > READING_QUESTION_TARGET) {
    const lastBlock = blocks[blocks.length - 1];
    const excess = totalQuestions - READING_QUESTION_TARGET;
    const trimmedQuestions = lastBlock.questions.slice(
      0,
      lastBlock.questions.length - excess
    );
    blocks[blocks.length - 1] = { ...lastBlock, questions: trimmedQuestions };
  }

  return blocks;
}

// ─── Scoring ──────────────────────────────────────────────────────────

export function scoreSection(
  questions: readonly ExamQuestion[],
  answers: Record<string, string>
): SectionScore {
  const bySkill = new Map<
    string,
    { correct: number; total: number }
  >();

  let correct = 0;
  for (const q of questions) {
    const selected = answers[q.id];
    const isCorrect = selected === q.correctAnswer;
    if (isCorrect) correct++;

    const existing = bySkill.get(q.skillId) ?? { correct: 0, total: 0 };
    bySkill.set(q.skillId, {
      correct: existing.correct + (isCorrect ? 1 : 0),
      total: existing.total + 1,
    });
  }

  const skillBreakdown: SkillBreakdown[] = Array.from(bySkill.entries()).map(
    ([skillId, data]) => {
      const skill = getSkillById(skillId);
      return {
        skillId,
        skillName: skill?.name ?? skillId,
        correct: data.correct,
        total: data.total,
        percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      };
    }
  );

  // Sort by percentage ascending (weakest first)
  skillBreakdown.sort((a, b) => a.percentage - b.percentage);

  return {
    correct,
    total: questions.length,
    percentage: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
    bySkill: skillBreakdown,
  };
}

/**
 * Estimate percentile based on overall accuracy.
 * Rough approximation based on Hunter exam competitiveness.
 */
export function estimatePercentile(percentage: number): number {
  if (percentage >= 95) return 99;
  if (percentage >= 90) return 95;
  if (percentage >= 85) return 88;
  if (percentage >= 80) return 80;
  if (percentage >= 75) return 70;
  if (percentage >= 70) return 58;
  if (percentage >= 65) return 45;
  if (percentage >= 60) return 32;
  if (percentage >= 55) return 22;
  if (percentage >= 50) return 15;
  return 8;
}

export function analyzeTime(timings: readonly SectionTiming[]): TimeAnalysis {
  const ela = timings.find((t) => t.sectionId === "ela");
  const math = timings.find((t) => t.sectionId === "math");

  const elaUsed = ela?.usedMinutes ?? 0;
  const mathUsed = math?.usedMinutes ?? 0;

  const classify = (used: number, allocated: number) => {
    const ratio = used / allocated;
    if (ratio >= 0.95) return "rushed" as const;
    if (ratio >= 0.70) return "balanced" as const;
    return "surplus" as const;
  };

  // Estimate reading vs writing split (rough: first 70% of ELA time for reading)
  return {
    elaUsedMinutes: Math.round(elaUsed),
    elaAllocatedMinutes: ELA_DURATION_MINUTES,
    mathUsedMinutes: Math.round(mathUsed),
    mathAllocatedMinutes: MATH_DURATION_MINUTES,
    elaVerdict: classify(elaUsed, ELA_DURATION_MINUTES),
    mathVerdict: classify(mathUsed, MATH_DURATION_MINUTES),
    readingTimeEstimate: Math.round(elaUsed * 0.7),
    writingTimeEstimate: Math.round(elaUsed * 0.3),
  };
}

/**
 * Generate study recommendations based on score data.
 */
export function generateLocalRecommendations(
  reading: SectionScore,
  qr: SectionScore,
  ma: SectionScore,
  timeAnalysis: TimeAnalysis
): string[] {
  const recs: string[] = [];

  // Find weakest skills (below 60%)
  const allSkills = [...reading.bySkill, ...qr.bySkill, ...ma.bySkill];
  const weakSkills = allSkills.filter((s) => s.percentage < 60);

  if (weakSkills.length > 0) {
    const top3 = weakSkills.slice(0, 3);
    for (const s of top3) {
      recs.push(
        `Focus on **${s.skillName}** — you got ${s.correct}/${s.total} correct. Practice this skill in the tutor.`
      );
    }
  }

  // Section-level feedback
  if (reading.percentage < 70) {
    recs.push(
      "Your reading comprehension needs attention. Try the Reading Stamina mode to build passage endurance."
    );
  }
  if (qr.percentage < 70) {
    recs.push(
      "Quantitative reasoning was challenging. Work on word problems and pattern recognition in the math tutor."
    );
  }
  if (ma.percentage < 70) {
    recs.push(
      "Math achievement has room for growth. Practice fractions, percents, and geometry fundamentals."
    );
  }

  // Time management
  if (timeAnalysis.elaVerdict === "rushed") {
    recs.push(
      "You ran tight on time in the ELA section. Practice reading passages faster without sacrificing comprehension."
    );
  }
  if (timeAnalysis.mathVerdict === "rushed") {
    recs.push(
      "You were pressed for time in math. Practice mental math shortcuts and skip hard questions to come back later."
    );
  }
  if (timeAnalysis.elaVerdict === "surplus") {
    recs.push(
      "You finished ELA with plenty of time. Use extra time to review answers — look for questions you might have misread."
    );
  }

  // Overall
  const overallPct = Math.round(
    ((reading.correct + qr.correct + ma.correct) /
      (reading.total + qr.total + ma.total)) *
      100
  );
  if (overallPct >= 85) {
    recs.push(
      "Strong overall performance! Focus on your weakest 1-2 skills to push into the top percentiles."
    );
  } else if (overallPct >= 70) {
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

// ─── Cooldown / Storage ───────────────────────────────────────────────

export function loadSimulationHistory(): StoredSimulation[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
    if (!data) return [];
    return JSON.parse(data) as StoredSimulation[];
  } catch {
    return [];
  }
}

export function saveSimulation(sim: StoredSimulation): void {
  if (typeof window === "undefined") return;
  const history = loadSimulationHistory();
  history.push(sim);
  localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(history));
  notifyProgressChanged();
}

export function checkCooldown(): {
  allowed: boolean;
  nextDate: string | null;
  daysSinceLast: number | null;
} {
  const history = loadSimulationHistory();
  if (history.length === 0) {
    return { allowed: true, nextDate: null, daysSinceLast: null };
  }

  const last = history[history.length - 1];
  const lastDate = new Date(last.completedAt);
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays >= COOLDOWN_DAYS) {
    return {
      allowed: true,
      nextDate: null,
      daysSinceLast: Math.floor(diffDays),
    };
  }

  const nextAvailable = new Date(
    lastDate.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );
  return {
    allowed: false,
    nextDate: nextAvailable.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    daysSinceLast: Math.floor(diffDays),
  };
}
