import type { ExamQuestion, ExamPassageBlock, SimulationExam } from "@/lib/simulation";

// ─── Types ────────────────────────────────────────────────────────────

export interface SampleTestQuestion {
  readonly id: string;
  readonly questionNumber: number;
  readonly questionText: string;
  readonly answerChoices: readonly { letter: string; text: string }[];
  readonly correctAnswer: string;
  readonly skillId: string;
  readonly confidence: "high" | "medium" | "low";
  readonly excluded: boolean;
  readonly excludeReason?: string | null;
}

export interface SampleTestPassage {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly questionNumbers: readonly number[];
}

export interface SampleTestForm {
  readonly id: string;
  readonly title: string;
  readonly sections: {
    readonly verbal: readonly SampleTestQuestion[];
    readonly math: readonly SampleTestQuestion[];
  };
  readonly passages: readonly SampleTestPassage[];
  readonly metadata: {
    readonly totalQuestions: number;
    readonly source: string;
    readonly excludedCount: number;
  };
}

// ─── Lazy-loaded form data ───────────────────────────────────────────

let _formsCache: Map<string, SampleTestForm> | null = null;

// Static JSON imports — resolved at build time by webpack
import form1Data from "../../../content/sample-tests/form_1.json";
import form2Data from "../../../content/sample-tests/form_2.json";
import form3Data from "../../../content/sample-tests/form_3.json";
import form4Data from "../../../content/sample-tests/form_4.json";

function loadAllForms(): Map<string, SampleTestForm> {
  if (_formsCache) return _formsCache;

  const form1 = form1Data as unknown as SampleTestForm;
  const form2 = form2Data as unknown as SampleTestForm;
  const form3 = form3Data as unknown as SampleTestForm;
  const form4 = form4Data as unknown as SampleTestForm;

  _formsCache = new Map([
    [form1.id, form1],
    [form2.id, form2],
    [form3.id, form3],
    [form4.id, form4],
  ]);
  return _formsCache;
}

// ─── Public API ──────────────────────────────────────────────────────

export function loadSampleTestForm(formId: string): SampleTestForm | null {
  return loadAllForms().get(formId) ?? null;
}

export function listSampleTestForms(): { id: string; title: string }[] {
  return Array.from(loadAllForms().values()).map((f) => ({
    id: f.id,
    title: f.title,
  }));
}

/**
 * Convert a SampleTestQuestion to the ExamQuestion format used by the simulation.
 */
function toExamQuestion(q: SampleTestQuestion): ExamQuestion {
  return {
    id: q.id,
    questionText: q.questionText,
    answerChoices: q.answerChoices,
    correctAnswer: q.correctAnswer,
    skillId: q.skillId,
  };
}

/**
 * Group verbal questions into ExamPassageBlocks using passage data.
 * Each passage becomes a block with its questions grouped together.
 */
function groupVerbalIntoBlocks(
  questions: readonly SampleTestQuestion[],
  passages: readonly SampleTestPassage[]
): ExamPassageBlock[] {
  const active = questions.filter((q) => !q.excluded);
  const blocks: ExamPassageBlock[] = [];

  for (const passage of passages) {
    const nums = new Set(passage.questionNumbers);
    const pQuestions = active.filter((q) => nums.has(q.questionNumber));
    if (pQuestions.length === 0) continue;

    blocks.push({
      passageId: passage.id,
      title: passage.title,
      preReadingContext: "Hunter College Entrance Exam — Verbal Section",
      passageText: passage.text,
      wordCount: passage.text.split(/\s+/).filter(Boolean).length,
      questions: pQuestions.map(toExamQuestion),
    });
  }

  // Any questions not assigned to a passage get grouped as standalone
  const assignedNums = new Set(passages.flatMap((p) => [...p.questionNumbers]));
  const unassigned = active.filter((q) => !assignedNums.has(q.questionNumber));
  if (unassigned.length > 0) {
    const CHUNK_SIZE = 6;
    for (let i = 0; i < unassigned.length; i += CHUNK_SIZE) {
      const chunk = unassigned.slice(i, i + CHUNK_SIZE);
      blocks.push({
        passageId: `sample_standalone_${blocks.length + 1}`,
        title: `Questions ${chunk[0].questionNumber}–${chunk[chunk.length - 1].questionNumber}`,
        preReadingContext: "Hunter College Entrance Exam — Verbal Section",
        passageText: "",
        wordCount: 0,
        questions: chunk.map(toExamQuestion),
      });
    }
  }

  return blocks;
}

/**
 * Assemble a sample test form into a SimulationExam for the simulation engine.
 */
export function assembleSampleExam(formId: string): SimulationExam | null {
  const form = loadSampleTestForm(formId);
  if (!form) return null;

  const readingBlocks = groupVerbalIntoBlocks(form.sections.verbal, form.passages ?? []);
  const mathQuestions = form.sections.math
    .filter((q) => !q.excluded)
    .map(toExamQuestion);

  return {
    id: `sample_${formId}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    readingBlocks,
    writingPrompt: null,
    qrQuestions: [],
    maQuestions: [],
    mode: "sample",
    formId,
    mathQuestions,
  };
}

/**
 * Get non-excluded, high-confidence questions for a given skill from all forms.
 * Useful for the drill/tutoring system to pull curated Hunter-format questions.
 */
export function getSampleQuestionsForSkill(skillId: string): SampleTestQuestion[] {
  const allForms = loadAllForms();
  const results: SampleTestQuestion[] = [];

  for (const form of allForms.values()) {
    const allQuestions = [...form.sections.verbal, ...form.sections.math];
    for (const q of allQuestions) {
      if (!q.excluded && q.confidence === "high" && q.skillId === skillId) {
        results.push(q);
      }
    }
  }

  return results;
}

/**
 * Get the metadata for a sample test form (title, excluded count, etc.)
 */
export function getSampleTestMetadata(formId: string): {
  title: string;
  excludedCount: number;
  verbalCount: number;
  mathCount: number;
} | null {
  const form = loadSampleTestForm(formId);
  if (!form) return null;

  return {
    title: form.title,
    excludedCount: form.metadata.excludedCount,
    verbalCount: form.sections.verbal.filter((q) => !q.excluded).length,
    mathCount: form.sections.math.filter((q) => !q.excluded).length,
  };
}
