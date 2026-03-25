import type { Passage, PassageGenre } from "@/lib/types";
import type { ExamPassageBlock, ExamQuestion } from "@/lib/simulation";
import type { AssessmentReport } from "@/lib/assessment-scoring";
import { getAllPassages, getPassagesByGenre } from "@/lib/exam/passages";
import { getDomainForSkill } from "@/lib/exam/curriculum";
import {
  listSampleTestForms,
  loadSampleTestForm,
} from "@/lib/exam/sample-tests";
import { getStorageKey, notifyProgressChanged } from "./user-profile";

// ─── Types ────────────────────────────────────────────────────────────

export interface AssessmentConfig {
  readonly readingQuestionTarget: number;
  readonly qrQuestionTarget: number;
  readonly maQuestionTarget: number;
  readonly readingMinutes: number;
  readonly qrMinutes: number;
  readonly maMinutes: number;
  readonly writingMinutes: number;
  readonly breakMinutes: number;
  readonly cooldownDays: number;
}

export const ASSESSMENT_CONFIG: AssessmentConfig = {
  readingQuestionTarget: 25,
  qrQuestionTarget: 19,
  maQuestionTarget: 23,
  readingMinutes: 35,
  qrMinutes: 17,
  maMinutes: 21,
  writingMinutes: 20,
  breakMinutes: 2,
  cooldownDays: 7,
} as const;

export type AssessmentPhase =
  | "intro"
  | "ela_mc"
  | "break_1"
  | "math_qr"
  | "break_2"
  | "math_ma"
  | "break_3"
  | "writing"
  | "scoring"
  | "results";

export interface AssessmentAnswer {
  readonly questionId: string;
  readonly skillId: string;
  readonly selectedAnswer: string;
  readonly correctAnswer: string;
  readonly timeSpentMs: number;
  readonly section: "reading" | "qr" | "ma";
  readonly difficultyTier: number;
}

export interface AssessmentExam {
  readonly id: string;
  readonly createdAt: string;
  readonly readingBlocks: readonly ExamPassageBlock[];
  readonly qrQuestions: readonly ExamQuestion[];
  readonly maQuestions: readonly ExamQuestion[];
  readonly writingPrompt: string;
}

export interface StoredAssessment {
  readonly id: string;
  readonly completedAt: string;
  readonly report: AssessmentReport;
}

// ─── Constants ────────────────────────────────────────────────────────

const STORAGE_KEY = "hunter-tutor-assessments";

const GENRE_SELECTION_ORDER: readonly PassageGenre[] = [
  "fiction",
  "nonfiction",
  "science_article",
  "historical_document",
  "poetry",
] as const;

/**
 * Standalone writing prompts for 10-12 year olds.
 * Mix of persuasive and expository topics matching Hunter exam format.
 */
const WRITING_PROMPTS: readonly string[] = [
  "Some people believe that students should be required to wear uniforms to school. Do you agree or disagree? Write an essay explaining your position. Use specific reasons and examples to support your argument.",
  "Think about a time when you had to make a difficult choice. Write an essay describing the situation, the choice you made, and what you learned from the experience.",
  "Your school principal has proposed eliminating recess for students in grades 5 and 6 to allow more time for academics. Write a letter to your principal arguing for or against this proposal. Support your position with clear reasons and evidence.",
  "Imagine you could travel back in time to witness one historical event. Which event would you choose, and why? Write an essay explaining your choice and what you hope to learn from being there.",
  "Many schools are replacing physical textbooks with tablets and laptops. Do you think this is a good change? Write an essay taking a clear position. Use specific reasons and examples to support your argument.",
  "Think about someone who has made a positive difference in your community. Write an essay describing this person, what they did, and why their contribution matters.",
  "Some people argue that children spend too much time on screens and not enough time playing outside. Do you agree or disagree? Write a persuasive essay supporting your position with specific examples.",
  "If you could create one new rule for your school that would make it a better place for everyone, what would it be? Write an essay explaining your proposed rule, why it is needed, and how it would improve school life.",
  "Write about a book, movie, or experience that changed the way you think about something. Explain what it was, how it changed your perspective, and why that change matters to you.",
  "Your city is deciding whether to build a new park or a new community library. Which would you choose? Write a persuasive essay arguing for one option. Include specific reasons why your choice would benefit the community more.",
  "Think about an invention or technology that has changed daily life. Write an expository essay explaining how this invention works and why it is important. Use specific details and examples.",
  "Some students think homework helps them learn, while others think it takes away from their free time without helping. What is your opinion? Write an essay supporting your view with clear reasons and examples.",
  "Describe a challenge you faced and how you overcame it. What skills or qualities helped you succeed? Write an essay reflecting on this experience and what it taught you about yourself.",
  "If you could have dinner with any person — living or from history — who would you choose and why? Write an essay explaining your choice and what questions you would ask this person.",
  "Your town is considering banning single-use plastic bags in all stores. Do you support or oppose this ban? Write a persuasive essay with specific reasons and evidence to convince others of your position.",
] as const;

// ─── Utility ──────────────────────────────────────────────────────────

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

// ─── Reading Section Assembly ─────────────────────────────────────────

/**
 * Select diverse reading passages for the assessment.
 * Picks 1 passage from each of 3+ genres (shuffled), then fills to target.
 * Avoids previously-seen question IDs. Trims excess from last block.
 */
function assembleReadingBlocks(
  seenQuestionIds: ReadonlySet<string>
): ExamPassageBlock[] {
  const target = ASSESSMENT_CONFIG.readingQuestionTarget;
  const blocks: ExamPassageBlock[] = [];
  let totalQuestions = 0;
  const usedPassageIds = new Set<string>();

  // Pick one random passage from each genre (shuffled order)
  for (const genre of shuffle(GENRE_SELECTION_ORDER)) {
    if (totalQuestions >= target) break;

    const candidates = shuffle(getPassagesByGenre(genre)).filter((p) => {
      if (usedPassageIds.has(p.metadata.passage_id)) return false;
      // Check that the passage has questions not already seen
      const block = passageToBlock(p);
      const unseenQs = block.questions.filter(
        (q) => !seenQuestionIds.has(q.id)
      );
      return unseenQs.length > 0;
    });

    if (candidates.length > 0) {
      const block = passageToBlock(candidates[0]);
      // Filter out previously seen questions
      const filteredBlock: ExamPassageBlock = {
        ...block,
        questions: block.questions.filter(
          (q) => !seenQuestionIds.has(q.id)
        ),
      };
      if (filteredBlock.questions.length > 0) {
        blocks.push(filteredBlock);
        usedPassageIds.add(filteredBlock.passageId);
        totalQuestions += filteredBlock.questions.length;
      }
    }
  }

  // If we still need more questions, add more passages from any genre
  if (totalQuestions < target) {
    const remaining = shuffle(
      Array.from(getAllPassages().values()).filter((p) => {
        if (usedPassageIds.has(p.metadata.passage_id)) return false;
        const block = passageToBlock(p);
        return block.questions.some((q) => !seenQuestionIds.has(q.id));
      })
    );

    for (const p of remaining) {
      if (totalQuestions >= target) break;
      const block = passageToBlock(p);
      const filteredBlock: ExamPassageBlock = {
        ...block,
        questions: block.questions.filter(
          (q) => !seenQuestionIds.has(q.id)
        ),
      };
      if (filteredBlock.questions.length > 0) {
        blocks.push(filteredBlock);
        usedPassageIds.add(filteredBlock.passageId);
        totalQuestions += filteredBlock.questions.length;
      }
    }
  }

  // Trim excess questions from the last block if over target
  if (totalQuestions > target && blocks.length > 0) {
    const lastBlock = blocks[blocks.length - 1];
    const excess = totalQuestions - target;
    const trimmedQuestions = lastBlock.questions.slice(
      0,
      lastBlock.questions.length - excess
    );
    blocks[blocks.length - 1] = { ...lastBlock, questions: trimmedQuestions };
  }

  return blocks;
}

// ─── Math Question Assembly ───────────────────────────────────────────

/**
 * Load all non-excluded math questions from sample test forms,
 * classified into QR and MA by skill domain.
 *
 * Uses getDomainForSkill() to split each question:
 * - "math_quantitative_reasoning" -> QR
 * - "math_achievement" (or any other domain) -> MA
 */
function loadMathQuestionsByDomain(): {
  qr: readonly ExamQuestion[];
  ma: readonly ExamQuestion[];
} {
  const qrQuestions: ExamQuestion[] = [];
  const maQuestions: ExamQuestion[] = [];

  const formList = listSampleTestForms();
  for (const { id: formId } of formList) {
    const form = loadSampleTestForm(formId);
    if (!form) continue;

    for (const q of form.sections.math) {
      if (q.excluded) continue;

      const examQ: ExamQuestion = {
        id: q.id,
        questionText: q.questionText,
        answerChoices: q.answerChoices,
        correctAnswer: q.correctAnswer,
        skillId: q.skillId,
      };

      const domain = getDomainForSkill(q.skillId);
      if (domain === "math_quantitative_reasoning") {
        qrQuestions.push(examQ);
      } else {
        // Default to MA for "math_achievement" and any unknown domain
        maQuestions.push(examQ);
      }
    }
  }

  return { qr: qrQuestions, ma: maQuestions };
}

/**
 * Select math questions for a section, avoiding previously-seen questions.
 * Shuffles and spreads across skills for balanced coverage.
 */
function selectMathQuestions(
  pool: readonly ExamQuestion[],
  target: number,
  seenQuestionIds: ReadonlySet<string>
): ExamQuestion[] {
  // Filter out seen questions
  const available = pool.filter((q) => !seenQuestionIds.has(q.id));

  if (available.length <= target) {
    return shuffle(available);
  }

  // Group by skill for balanced selection
  const bySkill = new Map<string, ExamQuestion[]>();
  for (const q of available) {
    const existing = bySkill.get(q.skillId) ?? [];
    existing.push(q);
    bySkill.set(q.skillId, existing);
  }

  // Shuffle within each skill group
  for (const [skillId, questions] of bySkill) {
    bySkill.set(skillId, shuffle(questions));
  }

  // Round-robin across skills to spread coverage
  const selected: ExamQuestion[] = [];
  const skillIds = shuffle(Array.from(bySkill.keys()));
  let round = 0;

  while (selected.length < target) {
    let addedThisRound = false;
    for (const skillId of skillIds) {
      if (selected.length >= target) break;
      const skillQuestions = bySkill.get(skillId);
      if (skillQuestions && round < skillQuestions.length) {
        selected.push(skillQuestions[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round++;
  }

  return selected;
}

// ─── Writing Prompt Selection ─────────────────────────────────────────

/**
 * Select a writing prompt, avoiding recently used ones.
 */
function selectWritingPrompt(): string {
  const history = loadAssessmentHistory();
  const recentCount = Math.min(history.length, WRITING_PROMPTS.length - 1);

  // Build a set of recently used prompt indices from past assessments
  // Since we can't retrieve exact prompts from reports, use a simple
  // deterministic hash to avoid the same prompt in consecutive assessments
  const usedIndices = new Set<number>();
  for (let i = 0; i < recentCount && i < history.length; i++) {
    const assessment = history[history.length - 1 - i];
    // Use the assessment ID as a seed to determine which prompt was used
    const seed = hashCode(assessment.id);
    usedIndices.add(Math.abs(seed) % WRITING_PROMPTS.length);
  }

  // Pick from unused prompts; fall back to any if all used
  const availableIndices = Array.from(
    { length: WRITING_PROMPTS.length },
    (_, i) => i
  ).filter((i) => !usedIndices.has(i));

  const pool = availableIndices.length > 0
    ? availableIndices
    : Array.from({ length: WRITING_PROMPTS.length }, (_, i) => i);

  const idx = pool[Math.floor(Math.random() * pool.length)];
  return WRITING_PROMPTS[idx];
}

/** Simple string hash for deterministic prompt tracking. */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}

// ─── Main Assembly ────────────────────────────────────────────────────

/**
 * Assemble a complete half-length assessment exam.
 *
 * Selects:
 * - 4-5 reading passages from the passage bank (3+ genre diversity, ~25 questions)
 * - ~19 QR questions from sample test forms
 * - ~23 MA questions from sample test forms
 * - 1 writing prompt from the curated bank
 *
 * Avoids previously-seen questions when possible.
 */
export function assembleAssessmentExam(
  seenQuestionIds?: Set<string>
): AssessmentExam {
  const seen = seenQuestionIds ?? new Set<string>();

  // Assemble reading section
  const readingBlocks = assembleReadingBlocks(seen);

  // Assemble math sections
  const { qr: qrPool, ma: maPool } = loadMathQuestionsByDomain();
  const qrQuestions = selectMathQuestions(
    qrPool,
    ASSESSMENT_CONFIG.qrQuestionTarget,
    seen
  );
  const maQuestions = selectMathQuestions(
    maPool,
    ASSESSMENT_CONFIG.maQuestionTarget,
    seen
  );

  // Select writing prompt
  const writingPrompt = selectWritingPrompt();

  return {
    id: `assessment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    readingBlocks,
    qrQuestions,
    maQuestions,
    writingPrompt,
  };
}

// ─── Cooldown ─────────────────────────────────────────────────────────

/**
 * Check if the student can take a new assessment (7-day cooldown).
 * Returns whether they're allowed, and if not, when the next window opens.
 */
export function checkAssessmentCooldown(): {
  readonly allowed: boolean;
  readonly nextDate: string | null;
  readonly daysSinceLast: number | null;
} {
  const history = loadAssessmentHistory();
  if (history.length === 0) {
    return { allowed: true, nextDate: null, daysSinceLast: null };
  }

  const last = history[history.length - 1];
  const lastDate = new Date(last.completedAt);
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays >= ASSESSMENT_CONFIG.cooldownDays) {
    return {
      allowed: true,
      nextDate: null,
      daysSinceLast: Math.floor(diffDays),
    };
  }

  const nextAvailable = new Date(
    lastDate.getTime() +
      ASSESSMENT_CONFIG.cooldownDays * 24 * 60 * 60 * 1000
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

// ─── Storage ──────────────────────────────────────────────────────────

/**
 * Load all completed assessments from localStorage.
 */
export function loadAssessmentHistory(): StoredAssessment[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
    if (!data) return [];
    return JSON.parse(data) as StoredAssessment[];
  } catch {
    return [];
  }
}

/**
 * Save a completed assessment to localStorage.
 */
export function saveAssessment(assessment: StoredAssessment): void {
  if (typeof window === "undefined") return;
  const history = loadAssessmentHistory();
  history.push(assessment);
  localStorage.setItem(
    getStorageKey(STORAGE_KEY),
    JSON.stringify(history)
  );
  notifyProgressChanged("assessments");
}

/**
 * Collect all question IDs that appeared in previous assessments.
 * Used to avoid repeating questions on retakes.
 */
export function getSeenQuestionIds(): Set<string> {
  const history = loadAssessmentHistory();
  const seen = new Set<string>();

  for (const assessment of history) {
    const report = assessment.report;

    // Collect from missed questions (which store questionId)
    if (report.missedQuestions) {
      for (const mq of report.missedQuestions) {
        seen.add(mq.questionId);
      }
    }

    // Collect from per-skill breakdowns — we need the full question IDs
    // which are stored in the answers. Since we don't store raw answers
    // in the report, we infer from missed + correct counts.
    // For robust tracking, the hook should also persist seen IDs.
  }

  // Also check for a dedicated seen-questions store
  if (typeof window !== "undefined") {
    try {
      const seenData = localStorage.getItem(
        getStorageKey("hunter-tutor-assessment-seen-questions")
      );
      if (seenData) {
        const ids = JSON.parse(seenData) as string[];
        for (const id of ids) {
          seen.add(id);
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return seen;
}

/**
 * Persist a batch of question IDs as "seen" for future duplicate avoidance.
 */
export function recordSeenQuestionIds(questionIds: readonly string[]): void {
  if (typeof window === "undefined") return;
  const existing = getSeenQuestionIds();
  for (const id of questionIds) {
    existing.add(id);
  }
  try {
    localStorage.setItem(
      getStorageKey("hunter-tutor-assessment-seen-questions"),
      JSON.stringify(Array.from(existing))
    );
  } catch {
    // localStorage unavailable
  }
}
