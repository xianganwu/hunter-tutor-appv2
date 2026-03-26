"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { MascotMoment } from "@/components/shared/MascotMoment";
import { useMascotMoment } from "@/hooks/useMascotMoment";
import { AssessmentLanding } from "./AssessmentLanding";
import { AssessmentSection } from "./AssessmentSection";
import { AssessmentBreak } from "./AssessmentBreak";
import { AssessmentWriting } from "./AssessmentWriting";
import { AssessmentResults } from "./AssessmentResults";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import {
  assembleAssessmentExam,
  checkAssessmentCooldown,
  loadAssessmentHistory,
  saveAssessment,
  getSeenQuestionIds,
  recordSeenQuestionIds,
  ASSESSMENT_CONFIG,
} from "@/lib/assessment";
import { getStorageKey } from "@/lib/user-profile";
import type {
  AssessmentPhase,
  AssessmentExam,
  AssessmentAnswer,
} from "@/lib/assessment";
import {
  generateAssessmentReport,
  applyOneDirectionalMasteryUpdate,
} from "@/lib/assessment-scoring";
import type {
  AssessmentReport,
  WritingAssessmentScore,
} from "@/lib/assessment-scoring";
import { getSkillById } from "@/lib/exam/curriculum";

// ─── localStorage Keys ───────────────────────────────────────────────

const SAVE_BASE_KEY = "hunter-tutor-assessment-in-progress";

/** User-scoped key so Student A can't see Student B's in-progress assessment. */
function getSaveKey(): string {
  return getStorageKey(SAVE_BASE_KEY);
}

interface SavedState {
  readonly phase: AssessmentPhase;
  readonly examJson: string;
  readonly answers: Record<string, string>;
  readonly flagged: string[];
  readonly currentIndex: number;
  readonly essayText: string;
  readonly timings: Record<string, number>;
  readonly sectionStartTime: number;
  readonly answerDetails: AssessmentAnswer[];
  readonly savedAt: number;
}

// ─── Main Component ──────────────────────────────────────────────────

export function AssessmentSession() {
  const [phase, setPhase] = useState<AssessmentPhase>("intro");
  const [exam, setExam] = useState<AssessmentExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sectionStartTime, setSectionStartTime] = useState(0);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [essayText, setEssayText] = useState("");
  const [answerDetails, setAnswerDetails] = useState<AssessmentAnswer[]>([]);
  const [previousReport, setPreviousReport] = useState<AssessmentReport | undefined>(undefined);

  // Load saved state on mount
  const [savedAssessment, setSavedAssessment] = useState<{
    phase: string;
    answeredCount: number;
    savedAt: number;
  } | null>(null);

  useEffect(() => {
    const saved = loadSavedState();
    if (saved) {
      setSavedAssessment({
        phase: saved.phase,
        answeredCount: Object.keys(saved.answers).length,
        savedAt: saved.savedAt,
      });
    }

    // Load previous report for comparison
    const history = loadAssessmentHistory();
    if (history.length > 0) {
      setPreviousReport(history[history.length - 1].report);
    }
  }, []);

  // Mascot moments
  const { mascotType, mascotTier, moment, momentKey, triggerMoment } = useMascotMoment();

  const assessmentCompletedRef = useRef(false);
  useEffect(() => {
    if (phase === "results" && report && !assessmentCompletedRef.current) {
      assessmentCompletedRef.current = true;
      const accuracy = (report.reading.rawPercentage + report.qr.rawPercentage + report.ma.rawPercentage) / 3;
      triggerMoment({ kind: "assessment-complete", accuracy });
    }
  }, [phase, report, triggerMoment]);

  // Persist state on answer/phase changes
  useEffect(() => {
    if (phase === "intro" || phase === "results" || phase === "scoring" || !exam) return;
    persistState({
      phase,
      examJson: JSON.stringify(exam),
      answers,
      flagged: Array.from(flagged),
      currentIndex,
      essayText,
      timings,
      sectionStartTime,
      answerDetails,
      savedAt: Date.now(),
    });
  }, [phase, answers, flagged, currentIndex, essayText, exam, timings, sectionStartTime, answerDetails]);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    const seenIds = getSeenQuestionIds();
    const newExam = assembleAssessmentExam(seenIds);
    setExam(newExam);
    setAnswers({});
    setFlagged(new Set());
    setCurrentIndex(0);
    setTimings({});
    setAnswerDetails([]);
    setEssayText("");
    setSectionStartTime(Date.now());
    setPhase("ela_mc");
    clearSavedState();
  }, []);

  const handleResume = useCallback(() => {
    const saved = loadSavedState();
    if (!saved) return;

    try {
      const parsedExam = JSON.parse(saved.examJson) as AssessmentExam;
      setExam(parsedExam);
      setAnswers(saved.answers);
      setFlagged(new Set(saved.flagged));
      setCurrentIndex(saved.currentIndex);
      setEssayText(saved.essayText);
      setTimings(saved.timings);
      // Compute how much time was already used in the current section,
      // then offset the start time backward so the CountdownTimer picks
      // up where it left off instead of giving a fresh timer.
      const elapsedMs = saved.savedAt - saved.sectionStartTime;
      setSectionStartTime(Date.now() - elapsedMs);
      setAnswerDetails(saved.answerDetails);
      setPhase(saved.phase);
      setSavedAssessment(null);
    } catch {
      // Corrupted save — discard
      clearSavedState();
      setSavedAssessment(null);
    }
  }, []);

  const handleAbandon = useCallback(() => {
    clearSavedState();
    setSavedAssessment(null);
  }, []);

  const handleAnswer = useCallback(
    (questionId: string, answer: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    },
    []
  );

  const handleFlag = useCallback((questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const recordSectionTiming = useCallback(
    (sectionKey: string) => {
      const elapsed = (Date.now() - sectionStartTime) / 1000 / 60; // minutes
      setTimings((prev) => ({ ...prev, [sectionKey]: elapsed }));
    },
    [sectionStartTime]
  );

  const advanceToNextPhase = useCallback(
    (currentPhase: AssessmentPhase) => {
      const phaseOrder: AssessmentPhase[] = [
        "ela_mc",
        "break_1",
        "math_qr",
        "break_2",
        "math_ma",
        "break_3",
        "writing",
        "scoring",
        "results",
      ];
      const idx = phaseOrder.indexOf(currentPhase);
      if (idx >= 0 && idx < phaseOrder.length - 1) {
        const next = phaseOrder[idx + 1];
        setCurrentIndex(0);
        setSectionStartTime(Date.now());
        setPhase(next);
      }
    },
    []
  );

  const handleSubmitSection = useCallback(
    (sectionKey: string) => {
      recordSectionTiming(sectionKey);
      advanceToNextPhase(phase);
    },
    [phase, recordSectionTiming, advanceToNextPhase]
  );

  const handleTimeUp = useCallback(
    (sectionKey: string) => {
      recordSectionTiming(sectionKey);
      advanceToNextPhase(phase);
    },
    [phase, recordSectionTiming, advanceToNextPhase]
  );

  // Build answer details when answering
  const buildAnswerDetail = useCallback(
    (questionId: string, selectedAnswer: string, section: "reading" | "qr" | "ma") => {
      if (!exam) return;
      const allQuestions = [
        ...exam.readingBlocks.flatMap((b) => b.questions),
        ...exam.qrQuestions,
        ...exam.maQuestions,
      ];
      const question = allQuestions.find((q) => q.id === questionId);
      if (!question) return;

      // Look up the real difficulty tier from the curriculum
      const skill = getSkillById(question.skillId);
      const difficultyTier = skill?.difficulty_tier ?? 3;

      const detail: AssessmentAnswer = {
        questionId,
        skillId: question.skillId,
        selectedAnswer,
        correctAnswer: question.correctAnswer,
        timeSpentMs: 0,
        section,
        difficultyTier,
      };

      setAnswerDetails((prev) => {
        // Replace existing or add new
        const filtered = prev.filter((d) => d.questionId !== questionId);
        return [...filtered, detail];
      });
    },
    [exam]
  );

  // Wrap handleAnswer to also build answer details
  const handleAnswerWithDetails = useCallback(
    (questionId: string, answer: string, section: "reading" | "qr" | "ma") => {
      handleAnswer(questionId, answer);
      buildAnswerDetail(questionId, answer, section);
    },
    [handleAnswer, buildAnswerDetail]
  );

  // ─── Writing Submit ─────────────────────────────────────────────────

  const handleWritingSubmit = useCallback(
    (text: string) => {
      setEssayText(text);
      recordSectionTiming("writing");
      setPhase("scoring");
    },
    [recordSectionTiming]
  );

  const handleWritingTimeUp = useCallback(
    (text: string) => {
      setEssayText(text);
      recordSectionTiming("writing");
      setPhase("scoring");
    },
    [recordSectionTiming]
  );

  // ─── Scoring Phase ──────────────────────────────────────────────────

  const scoringStartedRef = useRef(false);

  useEffect(() => {
    if (phase !== "scoring" || !exam || scoringStartedRef.current) return;
    scoringStartedRef.current = true;

    // Use a small delay to show the scoring screen
    const timeout = setTimeout(() => {
      // Mock writing score for now (AI scoring will be added later)
      const mockWritingScore: WritingAssessmentScore = {
        overall: 5,
        rubric: {
          organization: 5,
          developmentOfIdeas: 5,
          wordChoice: 5,
          sentenceStructure: 5,
          mechanics: 5,
        },
        feedback: "Writing score pending AI evaluation.",
        strengths: [],
        improvements: [],
      };

      const assessmentTimings = {
        readingUsedMinutes: timings["ela_mc"] ?? 0,
        qrUsedMinutes: timings["math_qr"] ?? 0,
        maUsedMinutes: timings["math_ma"] ?? 0,
        writingUsedMinutes: timings["writing"] ?? 0,
      };

      const generatedReport = generateAssessmentReport(
        exam,
        answers,
        answerDetails,
        assessmentTimings,
        mockWritingScore
      );

      // Save the assessment
      saveAssessment({
        id: exam.id,
        completedAt: generatedReport.completedAt,
        report: generatedReport,
      });

      // Record seen question IDs for future duplicate avoidance
      const allQuestionIds = [
        ...exam.readingBlocks.flatMap((b) => b.questions.map((q) => q.id)),
        ...exam.qrQuestions.map((q) => q.id),
        ...exam.maQuestions.map((q) => q.id),
      ];
      recordSeenQuestionIds(allQuestionIds);

      // Apply one-directional mastery update
      applyOneDirectionalMasteryUpdate(generatedReport);

      // Clear saved state
      clearSavedState();

      setReport(generatedReport);
      setPhase("results");
    }, 1500);

    return () => clearTimeout(timeout);
  }, [phase, exam, answers, answerDetails, timings]);

  // ─── Helper Data ────────────────────────────────────────────────────

  const cooldownInfo = useMemo(() => checkAssessmentCooldown(), []);
  const pastAssessments = useMemo(() => loadAssessmentHistory().length, []);

  const readingQuestions = useMemo(
    () => (exam?.readingBlocks.flatMap((b) => [...b.questions]) ?? []),
    [exam]
  );

  // ─── Render ─────────────────────────────────────────────────────────

  switch (phase) {
    case "intro":
      return (
        <AssessmentLanding
          onStart={handleStart}
          cooldownInfo={cooldownInfo}
          savedAssessment={savedAssessment}
          onResume={handleResume}
          onAbandon={handleAbandon}
          pastAssessments={pastAssessments}
        />
      );

    case "ela_mc":
      return (
        <AssessmentSection
          sectionLabel="ELA Reading"
          questions={readingQuestions}
          passageBlocks={exam?.readingBlocks}
          answers={answers}
          flagged={flagged}
          currentIndex={currentIndex}
          totalSeconds={ASSESSMENT_CONFIG.readingMinutes * 60}
          timerStartTime={sectionStartTime}
          onAnswer={(qId, ans) => handleAnswerWithDetails(qId, ans, "reading")}
          onFlag={handleFlag}
          onNavigate={setCurrentIndex}
          onSubmitSection={() => handleSubmitSection("ela_mc")}
          onTimeUp={() => handleTimeUp("ela_mc")}
        />
      );

    case "break_1":
      return (
        <AssessmentBreak
          nextSection="Quantitative Reasoning"
          totalSeconds={ASSESSMENT_CONFIG.breakMinutes * 60}
          onContinue={() => advanceToNextPhase("break_1")}
          onSkip={() => advanceToNextPhase("break_1")}
        />
      );

    case "math_qr":
      return (
        <AssessmentSection
          sectionLabel="Quantitative Reasoning"
          questions={exam?.qrQuestions ?? []}
          answers={answers}
          flagged={flagged}
          currentIndex={currentIndex}
          totalSeconds={ASSESSMENT_CONFIG.qrMinutes * 60}
          timerStartTime={sectionStartTime}
          onAnswer={(qId, ans) => handleAnswerWithDetails(qId, ans, "qr")}
          onFlag={handleFlag}
          onNavigate={setCurrentIndex}
          onSubmitSection={() => handleSubmitSection("math_qr")}
          onTimeUp={() => handleTimeUp("math_qr")}
        />
      );

    case "break_2":
      return (
        <AssessmentBreak
          nextSection="Math Achievement"
          totalSeconds={ASSESSMENT_CONFIG.breakMinutes * 60}
          onContinue={() => advanceToNextPhase("break_2")}
          onSkip={() => advanceToNextPhase("break_2")}
        />
      );

    case "math_ma":
      return (
        <AssessmentSection
          sectionLabel="Math Achievement"
          questions={exam?.maQuestions ?? []}
          answers={answers}
          flagged={flagged}
          currentIndex={currentIndex}
          totalSeconds={ASSESSMENT_CONFIG.maMinutes * 60}
          timerStartTime={sectionStartTime}
          onAnswer={(qId, ans) => handleAnswerWithDetails(qId, ans, "ma")}
          onFlag={handleFlag}
          onNavigate={setCurrentIndex}
          onSubmitSection={() => handleSubmitSection("math_ma")}
          onTimeUp={() => handleTimeUp("math_ma")}
        />
      );

    case "break_3":
      return (
        <AssessmentBreak
          nextSection="Writing"
          totalSeconds={ASSESSMENT_CONFIG.breakMinutes * 60}
          onContinue={() => advanceToNextPhase("break_3")}
          onSkip={() => advanceToNextPhase("break_3")}
        />
      );

    case "writing":
      return (
        <AssessmentWriting
          prompt={exam?.writingPrompt ?? ""}
          totalSeconds={ASSESSMENT_CONFIG.writingMinutes * 60}
          timerStartTime={sectionStartTime}
          onSubmit={handleWritingSubmit}
          onTimeUp={handleWritingTimeUp}
        />
      );

    case "scoring":
      return <ScoringScreen />;

    case "results":
      if (!report) return <ScoringScreen />;
      return (
        <>
          <AssessmentResults
            report={report}
            previousReport={previousReport}
          />
          <MascotMoment moment={moment} mascotType={mascotType} tier={mascotTier} momentKey={momentKey} />
        </>
      );
  }
}

// ─── Scoring Loading Screen ──────────────────────────────────────────

function ScoringScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
      <TypingIndicator />
      <p className="text-sm text-surface-500 dark:text-surface-400">
        Scoring your assessment...
      </p>
      <p className="text-xs text-surface-400">
        Evaluating your responses and generating your score report.
      </p>
    </div>
  );
}

// ─── localStorage Helpers ────────────────────────────────────────────

function persistState(state: SavedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getSaveKey(), JSON.stringify(state));
  } catch {
    // localStorage unavailable or quota exceeded
  }
}

function loadSavedState(): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(getSaveKey());
    if (!data) return null;
    return JSON.parse(data) as SavedState;
  } catch {
    return null;
  }
}

function clearSavedState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getSaveKey());
  } catch {
    // ignore
  }
}
