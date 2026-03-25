"use client";

import { useRef, useMemo, useCallback } from "react";
import type { ExamPassageBlock, ExamQuestion } from "@/lib/simulation";
import { CountdownTimer } from "@/components/tutor/CountdownTimer";
import { MathText } from "@/components/chat/MathText";

interface AssessmentSectionProps {
  readonly sectionLabel: string;
  readonly questions: readonly ExamQuestion[];
  readonly passageBlocks?: readonly ExamPassageBlock[];
  readonly answers: Record<string, string>;
  readonly flagged: Set<string>;
  readonly currentIndex: number;
  readonly totalSeconds: number;
  readonly timerStartTime: number; // epoch ms — when this section's timer started
  readonly onAnswer: (questionId: string, answer: string) => void;
  readonly onFlag: (questionId: string) => void;
  readonly onNavigate: (index: number) => void;
  readonly onSubmitSection: () => void;
  readonly onTimeUp: () => void;
}

/**
 * For reading sections, flatten all passage-block questions into one ordered list
 * while tracking which passage each question belongs to.
 */
interface FlatQuestion {
  readonly question: ExamQuestion;
  readonly passageIndex: number; // -1 if no passage
}

function flattenQuestions(
  questions: readonly ExamQuestion[],
  passageBlocks?: readonly ExamPassageBlock[]
): readonly FlatQuestion[] {
  if (passageBlocks && passageBlocks.length > 0) {
    const flat: FlatQuestion[] = [];
    for (let pi = 0; pi < passageBlocks.length; pi++) {
      for (const q of passageBlocks[pi].questions) {
        flat.push({ question: q, passageIndex: pi });
      }
    }
    return flat;
  }
  return questions.map((q) => ({ question: q, passageIndex: -1 }));
}

export function AssessmentSection({
  sectionLabel,
  questions,
  passageBlocks,
  answers,
  flagged,
  currentIndex,
  totalSeconds,
  timerStartTime,
  onAnswer,
  onFlag,
  onNavigate,
  onSubmitSection,
  onTimeUp,
}: AssessmentSectionProps) {
  const submittedRef = useRef(false);
  const isReading = passageBlocks !== undefined && passageBlocks.length > 0;

  // Guard against double-fire (manual submit + timer expiry racing)
  const handleSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmitSection();
  }, [onSubmitSection]);

  const handleTimeExpired = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onTimeUp();
  }, [onTimeUp]);

  const flatQuestions = useMemo(
    () => flattenQuestions(questions, passageBlocks),
    [questions, passageBlocks]
  );

  const total = flatQuestions.length;
  const current = flatQuestions[currentIndex];
  const currentPassage =
    isReading && current && current.passageIndex >= 0
      ? passageBlocks![current.passageIndex]
      : null;

  const durationMinutes = totalSeconds / 60;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-4xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Test-mode header with amber accent */}
      <header className="flex items-center justify-between px-4 py-2 border-b-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
        <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          {sectionLabel}
        </div>
        <div className="flex items-center gap-3">
          <CountdownTimer
            durationMinutes={durationMinutes}
            startTime={timerStartTime}
            onTimeUp={handleTimeExpired}
            stopped={false}
          />
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            Submit Section
          </button>
        </div>
      </header>

      {/* Question Navigator */}
      <div className="px-4 py-2 border-b border-surface-200 dark:border-surface-800 overflow-x-auto">
        <div className="flex gap-1.5 min-w-0">
          {flatQuestions.map((fq, i) => {
            const isAnswered = !!answers[fq.question.id];
            const isFlagged = flagged.has(fq.question.id);
            const isCurrent = i === currentIndex;

            return (
              <button
                key={fq.question.id}
                onClick={() => onNavigate(i)}
                className={`w-7 h-7 text-xs rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                  isCurrent
                    ? "ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-surface-900"
                    : ""
                } ${
                  isFlagged
                    ? "bg-streak-100 dark:bg-streak-500/20 text-streak-600 dark:text-streak-400 border border-streak-300 dark:border-streak-600/40"
                    : isAnswered
                      ? "bg-brand-100 dark:bg-brand-600/20 text-brand-600 dark:text-brand-400"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400"
                }`}
                aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}${isFlagged ? ", flagged" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {current && (
          <>
            {isReading && currentPassage ? (
              <ReadingLayout
                passage={currentPassage}
                question={current.question}
                questionNumber={currentIndex + 1}
                selectedAnswer={answers[current.question.id] ?? null}
                isFlagged={flagged.has(current.question.id)}
                onAnswer={(letter) => onAnswer(current.question.id, letter)}
                onFlag={() => onFlag(current.question.id)}
              />
            ) : (
              <MathLayout
                question={current.question}
                questionNumber={currentIndex + 1}
                selectedAnswer={answers[current.question.id] ?? null}
                isFlagged={flagged.has(current.question.id)}
                onAnswer={(letter) => onAnswer(current.question.id, letter)}
                onFlag={() => onFlag(current.question.id)}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 flex items-center justify-between">
        <button
          onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="rounded-lg px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-surface-500 dark:text-surface-400">
          Question {currentIndex + 1} of {total}
        </span>
        <button
          onClick={() => onNavigate(Math.min(total - 1, currentIndex + 1))}
          disabled={currentIndex === total - 1}
          className="rounded-lg px-4 py-2 text-sm text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 disabled:opacity-30 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Reading Layout (Split Pane) ──────────────────────────────────────

function ReadingLayout({
  passage,
  question,
  questionNumber,
  selectedAnswer,
  isFlagged,
  onAnswer,
  onFlag,
}: {
  readonly passage: ExamPassageBlock;
  readonly question: ExamQuestion;
  readonly questionNumber: number;
  readonly selectedAnswer: string | null;
  readonly isFlagged: boolean;
  readonly onAnswer: (letter: string) => void;
  readonly onFlag: () => void;
}) {
  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Passage Pane */}
      <div className="md:w-1/2 overflow-y-auto border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-800 px-4 py-4">
        <article className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
          {passage.preReadingContext && (
            <div className="text-xs text-brand-600 dark:text-brand-400 italic mb-2">
              {passage.preReadingContext}
            </div>
          )}
          <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-3">
            {passage.title}
          </h2>
          <div className="text-sm leading-relaxed text-surface-800 dark:text-surface-200 whitespace-pre-wrap">
            {passage.passageText}
          </div>
        </article>
      </div>

      {/* Question Pane */}
      <div className="md:w-1/2 overflow-y-auto px-4 py-4">
        <QuestionDisplay
          question={question}
          questionNumber={questionNumber}
          selectedAnswer={selectedAnswer}
          isFlagged={isFlagged}
          onAnswer={onAnswer}
          onFlag={onFlag}
        />
      </div>
    </div>
  );
}

// ─── Math Layout (Full Width) ─────────────────────────────────────────

function MathLayout({
  question,
  questionNumber,
  selectedAnswer,
  isFlagged,
  onAnswer,
  onFlag,
}: {
  readonly question: ExamQuestion;
  readonly questionNumber: number;
  readonly selectedAnswer: string | null;
  readonly isFlagged: boolean;
  readonly onAnswer: (letter: string) => void;
  readonly onFlag: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <QuestionDisplay
        question={question}
        questionNumber={questionNumber}
        selectedAnswer={selectedAnswer}
        isFlagged={isFlagged}
        onAnswer={onAnswer}
        onFlag={onFlag}
      />
    </div>
  );
}

// ─── Shared Question Display ──────────────────────────────────────────

function QuestionDisplay({
  question,
  questionNumber,
  selectedAnswer,
  isFlagged,
  onAnswer,
  onFlag,
}: {
  readonly question: ExamQuestion;
  readonly questionNumber: number;
  readonly selectedAnswer: string | null;
  readonly isFlagged: boolean;
  readonly onAnswer: (letter: string) => void;
  readonly onFlag: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Question Card */}
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
            <span className="text-surface-400 mr-1">{questionNumber}.</span>{" "}
            <MathText text={question.questionText} />
          </p>
          <button
            onClick={onFlag}
            className={`flex-shrink-0 rounded-lg px-2 py-1 text-xs transition-colors ${
              isFlagged
                ? "bg-streak-100 dark:bg-streak-500/20 text-streak-600 dark:text-streak-400 border border-streak-300 dark:border-streak-600/40"
                : "text-surface-400 hover:text-streak-500 hover:bg-streak-50 dark:hover:bg-streak-500/10"
            }`}
            aria-label={isFlagged ? "Remove flag" : "Flag for review"}
          >
            {isFlagged ? "Flagged" : "Flag"}
          </button>
        </div>

        {/* Answer Choices */}
        <div className="space-y-1.5">
          {question.answerChoices.map((choice) => (
            <button
              key={choice.letter}
              onClick={() => onAnswer(choice.letter)}
              className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors ${
                selectedAnswer === choice.letter
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-600/10 text-brand-900 dark:text-brand-100"
                  : "border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-500"
              }`}
            >
              <span className="font-medium mr-1.5">{choice.letter}.</span>
              <MathText text={choice.text} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
