"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getRandomQuestionPhrase, getRandomPassagePhrase } from "@/lib/loading-phrases";
import {
  assembleReadingSection,
  scoreSection,
  estimatePercentile,
  analyzeTime,
  generateLocalRecommendations,
  collectMissedQuestions,
  saveSimulation,
  ELA_DURATION_MINUTES,
  MATH_DURATION_MINUTES,
  QR_QUESTION_COUNT,
  MA_QUESTION_COUNT,
} from "@/lib/simulation";
import type {
  SimulationExam,
  ExamQuestion,
  SectionTiming,
  ScoreReport,
  WritingScore,
} from "@/lib/simulation";
import { getRandomPrompt } from "@/components/tutor/writing-prompts";
import { assembleSampleExam, getSampleTestMetadata } from "@/lib/exam/sample-tests";

// ─── Types ────────────────────────────────────────────────────────────

export type SimPhase =
  | "gate"
  | "instructions"
  | "generating"
  | "ela"
  | "break"
  | "math"
  | "submitting"
  | "results";

export type ElaTab = "reading" | "writing";
export type MathTab = "qr" | "ma";

export interface SimState {
  readonly phase: SimPhase;
  readonly exam: SimulationExam | null;
  readonly elaTab: ElaTab;
  readonly mathTab: MathTab;
  readonly currentPassageIndex: number;
  readonly currentReadingQuestion: number;
  readonly currentQrQuestion: number;
  readonly currentMaQuestion: number;
  readonly currentMathQuestion: number;
  readonly answers: Record<string, string>;
  readonly essayText: string;
  readonly timings: SectionTiming[];
  readonly report: ScoreReport | null;
  readonly error: string | null;
  readonly generationProgress: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function generateMathBatch(
  section: "quantitative_reasoning" | "math_achievement",
  questionCount: number,
  label: string
): Promise<ExamQuestion[]> {
  const res = await fetch("/api/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "generate_math_questions", section, questionCount }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errBody?.error ?? `${label} generation failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { questions?: ExamQuestion[]; error?: string };
  if (data.error || !data.questions) {
    throw new Error(data.error ?? `No ${label} questions returned`);
  }

  return [...data.questions];
}

// ─── localStorage Persistence ────────────────────────────────────────

const SAVE_KEY_PREFIX = "hunter_sim_progress_";

/** Fields we persist — excludes transient fields (report, error, generationProgress). */
interface PersistedSimState {
  readonly phase: SimPhase;
  readonly exam: SimulationExam | null;
  readonly elaTab: ElaTab;
  readonly mathTab: MathTab;
  readonly currentPassageIndex: number;
  readonly currentReadingQuestion: number;
  readonly currentQrQuestion: number;
  readonly currentMaQuestion: number;
  readonly currentMathQuestion: number;
  readonly answers: Record<string, string>;
  readonly essayText: string;
  readonly timings: SectionTiming[];
  readonly sectionStartedAt: number;
  readonly savedAt: number;
}

/** Phases that represent an in-progress exam worth saving. */
const RESUMABLE_PHASES: ReadonlySet<SimPhase> = new Set([
  "instructions",
  "ela",
  "break",
  "math",
]);

function getSaveKey(examId: string): string {
  return `${SAVE_KEY_PREFIX}${examId}`;
}

function trySaveToLocalStorage(key: string, data: PersistedSimState): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

function tryClearFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

/**
 * Scan localStorage for any saved exam progress.
 * Returns the most recent saved state, or null if none found.
 */
function findSavedExamState(): PersistedSimState | null {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SAVE_KEY_PREFIX)) {
        keys.push(key);
      }
    }

    let best: PersistedSimState | null = null;
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as PersistedSimState;
        // Validate basic shape
        if (
          parsed &&
          parsed.exam &&
          parsed.phase &&
          RESUMABLE_PHASES.has(parsed.phase) &&
          typeof parsed.savedAt === "number"
        ) {
          if (!best || parsed.savedAt > best.savedAt) {
            best = parsed;
          }
        } else {
          // Invalid or non-resumable — clean it up
          tryClearFromLocalStorage(key);
        }
      } catch {
        // Corrupt entry — remove it
        tryClearFromLocalStorage(key);
      }
    }

    return best;
  } catch {
    // localStorage not available
    return null;
  }
}

/**
 * Remove all saved exam progress entries from localStorage.
 */
function clearAllSavedExamStates(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SAVE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      tryClearFromLocalStorage(key);
    }
  } catch {
    // Ignore
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    phase: "gate",
    exam: null,
    elaTab: "reading",
    mathTab: "qr",
    currentPassageIndex: 0,
    currentReadingQuestion: 0,
    currentQrQuestion: 0,
    currentMaQuestion: 0,
    currentMathQuestion: 0,
    answers: {},
    essayText: "",
    timings: [],
    report: null,
    error: null,
    generationProgress: "",
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const sectionStartRef = useRef<number>(0);

  // Seconds of exam time already used in the current section before a resume.
  // 0 on a fresh section start; set to the pre-save work time on resume.
  // ExamTimer uses this to start at the correct remaining time.
  const [sectionElapsedOnResume, setSectionElapsedOnResume] = useState(0);

  // Track whether we've checked for saved state on mount
  const [savedExam, setSavedExam] = useState<PersistedSimState | null>(null);
  const hasCheckedRef = useRef(false);

  // ── Check for saved exam progress on mount ──
  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    const saved = findSavedExamState();
    if (saved) {
      setSavedExam(saved);
    }
  }, []);

  // ── Persist state to localStorage on meaningful changes ──
  // Individual state.* fields are listed intentionally; adding `state` itself would cause infinite loops.
  useEffect(() => {
    const { phase, exam } = state;
    if (!exam) return;

    // Only persist during resumable phases
    if (!RESUMABLE_PHASES.has(phase)) {
      // If we've reached results or gone back to gate, clear saved state
      if (phase === "results" || phase === "gate") {
        tryClearFromLocalStorage(getSaveKey(exam.id));
      }
      return;
    }

    const persisted: PersistedSimState = {
      phase,
      exam,
      elaTab: state.elaTab,
      mathTab: state.mathTab,
      currentPassageIndex: state.currentPassageIndex,
      currentReadingQuestion: state.currentReadingQuestion,
      currentQrQuestion: state.currentQrQuestion,
      currentMaQuestion: state.currentMaQuestion,
      currentMathQuestion: state.currentMathQuestion,
      answers: state.answers,
      essayText: state.essayText,
      timings: state.timings,
      sectionStartedAt: sectionStartRef.current,
      savedAt: Date.now(),
    };

    trySaveToLocalStorage(getSaveKey(exam.id), persisted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.phase,
    state.exam,
    state.elaTab,
    state.mathTab,
    state.currentPassageIndex,
    state.currentReadingQuestion,
    state.currentQrQuestion,
    state.currentMaQuestion,
    state.currentMathQuestion,
    state.answers,
    state.essayText,
    state.timings,
  ]);

  // ── beforeunload warning when exam is in progress ──
  useEffect(() => {
    const isInProgress = RESUMABLE_PHASES.has(state.phase);
    if (!isInProgress) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state.phase]);

  // ── Pause sectionStartRef during tab background/sleep ──
  // When the tab is hidden, shift sectionStartRef forward by the hidden
  // duration so finishEla/finishMath only count active exam time.
  const hiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    const isInProgress = state.phase === "ela" || state.phase === "math";
    if (!isInProgress) return;

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current !== null) {
        const away = Date.now() - hiddenAtRef.current;
        sectionStartRef.current += away;
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state.phase]);

  // Resume a saved exam
  const resumeExam = useCallback(() => {
    if (!savedExam || !savedExam.exam) return;

    // Restore the section start time, excluding time the student was away.
    // elapsedBeforeSave = actual work time between section start and save.
    // Shift sectionStartRef forward so Date.now() - sectionStartRef gives
    // only the accumulated work time, not the wall-clock time since original start.
    const elapsedBeforeSave = savedExam.savedAt - savedExam.sectionStartedAt;
    sectionStartRef.current = Date.now() - elapsedBeforeSave;

    // Tell ExamTimer how many seconds were already used before the save,
    // so it starts at the correct remaining time instead of the full duration.
    const elapsedSec = Math.max(0, Math.floor(elapsedBeforeSave / 1000));
    setSectionElapsedOnResume(elapsedSec);

    setState({
      phase: savedExam.phase,
      exam: savedExam.exam,
      elaTab: savedExam.elaTab,
      mathTab: savedExam.mathTab,
      currentPassageIndex: savedExam.currentPassageIndex,
      currentReadingQuestion: savedExam.currentReadingQuestion,
      currentQrQuestion: savedExam.currentQrQuestion,
      currentMaQuestion: savedExam.currentMaQuestion,
      currentMathQuestion: savedExam.currentMathQuestion,
      answers: savedExam.answers,
      essayText: savedExam.essayText,
      timings: savedExam.timings,
      report: null,
      error: null,
      generationProgress: "",
    });

    setSavedExam(null);
  }, [savedExam]);

  // Abandon a saved exam (dismiss the resume prompt and clear saved state)
  const abandonSavedExam = useCallback(() => {
    if (savedExam?.exam) {
      tryClearFromLocalStorage(getSaveKey(savedExam.exam.id));
    }
    clearAllSavedExamStates();
    setSavedExam(null);
  }, [savedExam]);

  // Start exam generation — if formId is provided, assemble a sample test locally
  const startExam = useCallback(async (formId?: string) => {
    // ── Sample test path: pure local data, no API calls ──
    if (formId) {
      setState((s) => ({
        ...s,
        phase: "generating",
        generationProgress: "Loading sample test...",
        error: null,
      }));

      try {
        const exam = assembleSampleExam(formId);
        if (!exam) throw new Error(`Sample test form "${formId}" not found`);

        setState((s) => ({
          ...s,
          phase: "instructions",
          exam,
          generationProgress: "",
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load sample test";
        setState((s) => ({
          ...s,
          phase: "gate",
          error: msg,
        }));
      }
      return;
    }

    // ── Random exam path: API-based generation ──
    setState((s) => ({
      ...s,
      phase: "generating",
      generationProgress: getRandomPassagePhrase(),
      error: null,
    }));

    try {
      // 1. Assemble reading section from library
      const readingBlocks = assembleReadingSection();

      // 2. Pick writing prompt
      const writingPrompt = getRandomPrompt();

      setState((s) => ({
        ...s,
        generationProgress: getRandomQuestionPhrase(),
      }));

      // 3–4. Generate QR + MA questions in parallel batches
      // Splitting into smaller batches keeps each API call well within the 60s timeout.
      const qrHalf1 = Math.ceil(QR_QUESTION_COUNT / 2);
      const qrHalf2 = QR_QUESTION_COUNT - qrHalf1;
      const maHalf1 = Math.ceil(MA_QUESTION_COUNT / 2);
      const maHalf2 = MA_QUESTION_COUNT - maHalf1;

      const batchConfigs = [
        ["quantitative_reasoning", qrHalf1, "QR"],
        ["quantitative_reasoning", qrHalf2, "QR"],
        ["math_achievement", maHalf1, "MA"],
        ["math_achievement", maHalf2, "MA"],
      ] as const;

      const settled = await Promise.allSettled(
        batchConfigs.map(([section, count, label]) =>
          generateMathBatch(section, count, label),
        ),
      );

      // Retry any failed batches once (sequential to avoid overloading during outage)
      const finalBatches: ExamQuestion[][] = [];
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        if (r.status === "fulfilled") {
          finalBatches.push(r.value);
        } else {
          const [section, count, label] = batchConfigs[i];
          const retried = await generateMathBatch(section, count, label);
          finalBatches.push(retried);
        }
      }

      const [qrBatch1, qrBatch2, maBatch1, maBatch2] = finalBatches;

      const qrQuestions: ExamQuestion[] = [...qrBatch1, ...qrBatch2].map((q, i) => ({
        ...q,
        id: `qr_${i + 1}`,
      }));

      const maQuestions: ExamQuestion[] = [...maBatch1, ...maBatch2].map((q, i) => ({
        ...q,
        id: `ma_${i + 1}`,
      }));

      // 5. Assemble exam
      const exam: SimulationExam = {
        id: `sim_${Date.now()}`,
        createdAt: new Date().toISOString(),
        readingBlocks,
        writingPrompt: { id: writingPrompt.id, text: writingPrompt.text },
        qrQuestions,
        maQuestions,
        mode: "random",
      };

      setState((s) => ({
        ...s,
        phase: "instructions",
        exam,
        generationProgress: "",
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate exam";
      setState((s) => ({
        ...s,
        phase: "gate",
        error: `Exam generation failed: ${msg}. Please try again.`,
      }));
    }
  }, []);

  // Begin ELA section
  const beginEla = useCallback(() => {
    sectionStartRef.current = Date.now();
    setSectionElapsedOnResume(0);
    setState((s) => ({ ...s, phase: "ela", elaTab: "reading" }));
  }, []);

  // Finish ELA section (manual or timer)
  const finishEla = useCallback(() => {
    const usedMs = Date.now() - sectionStartRef.current;
    const timing: SectionTiming = {
      sectionId: "ela",
      startedAt: sectionStartRef.current,
      endedAt: Date.now(),
      allocatedMinutes: ELA_DURATION_MINUTES,
      usedMinutes: usedMs / 60000,
    };

    setState((s) => ({
      ...s,
      phase: "break",
      timings: [...s.timings, timing],
    }));
  }, []);

  // Begin Math section
  const beginMath = useCallback(() => {
    sectionStartRef.current = Date.now();
    setSectionElapsedOnResume(0);
    setState((s) => ({
      ...s,
      phase: "math",
      mathTab: s.exam?.mode === "sample" ? "qr" : "qr", // both start at first tab
    }));
  }, []);

  // Finish Math section and compute results
  const finishMath = useCallback(async () => {
    const s = stateRef.current;
    if (!s.exam) return;

    const usedMs = Date.now() - sectionStartRef.current;
    const mathTiming: SectionTiming = {
      sectionId: "math",
      startedAt: sectionStartRef.current,
      endedAt: Date.now(),
      allocatedMinutes: MATH_DURATION_MINUTES,
      usedMinutes: usedMs / 60000,
    };

    const allTimings = [...s.timings, mathTiming];

    setState((prev) => ({
      ...prev,
      phase: "submitting",
      timings: allTimings,
    }));

    // Score sections
    const allReadingQuestions = s.exam.readingBlocks.flatMap((b) => b.questions);
    const readingScore = scoreSection(allReadingQuestions, s.answers);
    const isSample = s.exam.mode === "sample";

    const qrScore = isSample
      ? { correct: 0, total: 0, percentage: 0, bySkill: [] }
      : scoreSection(s.exam.qrQuestions, s.answers);
    const maScore = isSample
      ? { correct: 0, total: 0, percentage: 0, bySkill: [] }
      : scoreSection(s.exam.maQuestions, s.answers);
    const mathScore = isSample && s.exam.mathQuestions
      ? scoreSection(s.exam.mathQuestions, s.answers)
      : undefined;

    // Capture missed questions for score report
    const missedQuestions = isSample && s.exam.mathQuestions
      ? collectMissedQuestions(
          allReadingQuestions, [], [], s.answers, s.exam.mathQuestions
        )
      : collectMissedQuestions(
          allReadingQuestions, s.exam.qrQuestions, s.exam.maQuestions, s.answers
        );

    const mathCorrect = mathScore?.correct ?? 0;
    const mathTotal = mathScore?.total ?? 0;
    const totalCorrect = readingScore.correct + (isSample ? mathCorrect : qrScore.correct + maScore.correct);
    const totalQuestions = readingScore.total + (isSample ? mathTotal : qrScore.total + maScore.total);
    const overallPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const timeAnalysis = analyzeTime(allTimings);

    // Evaluate essay (skip for sample mode — no writing section)
    let writingScore: WritingScore = {
      score: 0,
      feedback: isSample ? "Sample tests do not include an essay section." : "No essay submitted.",
      strengths: [],
      improvements: isSample ? [] : ["Complete the essay section during the ELA booklet."],
    };

    if (!isSample && s.essayText.trim() && s.exam.writingPrompt) {
      try {
        const essayRes = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "evaluate_essay",
            promptText: s.exam.writingPrompt.text,
            essayText: s.essayText,
          }),
        });

        if (essayRes.ok) {
          const essayData = (await essayRes.json()) as {
            essayScore?: WritingScore;
          };
          if (essayData.essayScore) {
            writingScore = essayData.essayScore;
          }
        }
      } catch {
        // Use default
      }
    }

    // Generate recommendations
    let aiRecs: readonly string[] = [];
    const recSkills = isSample
      ? [...readingScore.bySkill, ...(mathScore?.bySkill ?? [])]
      : [...readingScore.bySkill, ...qrScore.bySkill, ...maScore.bySkill];

    if (!isSample) {
      try {
        const weakSkills = recSkills
          .filter((sk) => sk.percentage < 60)
          .slice(0, 5);

        const recRes = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "generate_recommendations",
            readingPct: readingScore.percentage,
            writingScore: writingScore.score,
            qrPct: qrScore.percentage,
            maPct: maScore.percentage,
            weakSkills,
            timeVerdict: {
              ela: timeAnalysis.elaVerdict,
              math: timeAnalysis.mathVerdict,
            },
          }),
        });

        if (recRes.ok) {
          const recData = (await recRes.json()) as {
            recommendations?: readonly string[];
          };
          if (recData.recommendations) {
            aiRecs = recData.recommendations;
          }
        }
      } catch {
        // Fall back to local recommendations
      }
    }

    const recommendations =
      aiRecs.length > 0
        ? aiRecs
        : generateLocalRecommendations(
            readingScore,
            isSample ? (mathScore ?? qrScore) : qrScore,
            isSample ? { correct: 0, total: 0, percentage: 100, bySkill: [] } : maScore,
            timeAnalysis
          );

    // Get sample test metadata if applicable
    const sampleMeta = isSample && s.exam.formId
      ? getSampleTestMetadata(s.exam.formId)
      : null;

    const report: ScoreReport = {
      examId: s.exam.id,
      completedAt: new Date().toISOString(),
      overall: {
        correct: totalCorrect,
        total: totalQuestions,
        percentage: overallPct,
        estimatedPercentile: estimatePercentile(overallPct),
      },
      reading: readingScore,
      writing: writingScore,
      qr: qrScore,
      ma: maScore,
      math: mathScore,
      mode: s.exam.mode,
      formTitle: sampleMeta?.title,
      excludedCount: sampleMeta?.excludedCount,
      timeAnalysis,
      recommendations,
      missedQuestions,
    };

    // Save to history
    saveSimulation({
      id: s.exam.id,
      completedAt: report.completedAt,
      report,
    });

    // Clear saved progress — exam is complete
    tryClearFromLocalStorage(getSaveKey(s.exam.id));

    setState((prev) => ({
      ...prev,
      phase: "results",
      report,
    }));
  }, []);

  // Navigation helpers
  const setAnswer = useCallback((questionId: string, answer: string) => {
    setState((s) => ({
      ...s,
      answers: { ...s.answers, [questionId]: answer },
    }));
  }, []);

  const setEssayText = useCallback((text: string) => {
    setState((s) => ({ ...s, essayText: text }));
  }, []);

  const setElaTab = useCallback((tab: ElaTab) => {
    setState((s) => ({ ...s, elaTab: tab }));
  }, []);

  const setMathTab = useCallback((tab: MathTab) => {
    setState((s) => ({ ...s, mathTab: tab }));
  }, []);

  const setPassageIndex = useCallback((index: number) => {
    setState((s) => ({
      ...s,
      currentPassageIndex: index,
      currentReadingQuestion: 0,
    }));
  }, []);

  const setReadingQuestion = useCallback((index: number) => {
    setState((s) => ({ ...s, currentReadingQuestion: index }));
  }, []);

  const setQrQuestion = useCallback((index: number) => {
    setState((s) => ({ ...s, currentQrQuestion: index }));
  }, []);

  const setMaQuestion = useCallback((index: number) => {
    setState((s) => ({ ...s, currentMaQuestion: index }));
  }, []);

  const setMathQuestion = useCallback((index: number) => {
    setState((s) => ({ ...s, currentMathQuestion: index }));
  }, []);

  return {
    state,
    savedExam,
    startExam,
    sectionElapsedOnResume,
    resumeExam,
    abandonSavedExam,
    beginEla,
    finishEla,
    beginMath,
    finishMath,
    setAnswer,
    setEssayText,
    setElaTab,
    setMathTab,
    setPassageIndex,
    setReadingQuestion,
    setQrQuestion,
    setMaQuestion,
    setMathQuestion,
  };
}
