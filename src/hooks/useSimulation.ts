"use client";

import { useState, useCallback, useRef } from "react";
import {
  assembleReadingSection,
  scoreSection,
  estimatePercentile,
  analyzeTime,
  generateLocalRecommendations,
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
  readonly answers: Record<string, string>;
  readonly essayText: string;
  readonly timings: SectionTiming[];
  readonly report: ScoreReport | null;
  readonly error: string | null;
  readonly generationProgress: string;
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

  // Start exam generation
  const startExam = useCallback(async () => {
    setState((s) => ({
      ...s,
      phase: "generating",
      generationProgress: "Assembling reading passages...",
      error: null,
    }));

    try {
      // 1. Assemble reading section from library
      const readingBlocks = assembleReadingSection();

      // 2. Pick writing prompt
      const writingPrompt = getRandomPrompt();

      setState((s) => ({
        ...s,
        generationProgress: "Generating quantitative reasoning questions...",
      }));

      // 3. Generate QR questions
      const qrRes = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate_math_questions",
          section: "quantitative_reasoning",
          questionCount: QR_QUESTION_COUNT,
        }),
      });

      if (!qrRes.ok) throw new Error("Failed to generate QR questions");
      const qrData = (await qrRes.json()) as {
        questions?: readonly ExamQuestion[];
        error?: string;
      };
      if (qrData.error || !qrData.questions) {
        throw new Error(qrData.error ?? "No QR questions returned");
      }

      const qrQuestions: ExamQuestion[] = qrData.questions.map((q, i) => ({
        ...q,
        id: `qr_${i + 1}`,
      }));

      setState((s) => ({
        ...s,
        generationProgress: "Generating math achievement questions...",
      }));

      // 4. Generate MA questions
      const maRes = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate_math_questions",
          section: "math_achievement",
          questionCount: MA_QUESTION_COUNT,
        }),
      });

      if (!maRes.ok) throw new Error("Failed to generate MA questions");
      const maData = (await maRes.json()) as {
        questions?: readonly ExamQuestion[];
        error?: string;
      };
      if (maData.error || !maData.questions) {
        throw new Error(maData.error ?? "No MA questions returned");
      }

      const maQuestions: ExamQuestion[] = maData.questions.map((q, i) => ({
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
    setState((s) => ({ ...s, phase: "math", mathTab: "qr" }));
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
    const qrScore = scoreSection(s.exam.qrQuestions, s.answers);
    const maScore = scoreSection(s.exam.maQuestions, s.answers);

    const totalCorrect = readingScore.correct + qrScore.correct + maScore.correct;
    const totalQuestions = readingScore.total + qrScore.total + maScore.total;
    const overallPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const timeAnalysis = analyzeTime(allTimings);

    // Evaluate essay
    let writingScore: WritingScore = {
      score: 0,
      feedback: "No essay submitted.",
      strengths: [],
      improvements: ["Complete the essay section during the ELA booklet."],
    };

    if (s.essayText.trim()) {
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

    // Generate AI recommendations
    let aiRecs: readonly string[] = [];
    try {
      const allSkills = [
        ...readingScore.bySkill,
        ...qrScore.bySkill,
        ...maScore.bySkill,
      ];
      const weakSkills = allSkills
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

    const recommendations =
      aiRecs.length > 0
        ? aiRecs
        : generateLocalRecommendations(readingScore, qrScore, maScore, timeAnalysis);

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
      timeAnalysis,
      recommendations,
    };

    // Save to history
    saveSimulation({
      id: s.exam.id,
      completedAt: report.completedAt,
      report,
    });

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

  return {
    state,
    startExam,
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
  };
}
