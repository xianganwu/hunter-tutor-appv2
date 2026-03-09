"use client";

import { useState, useEffect, useRef } from "react";
import { MathText } from "@/components/chat/MathText";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ScoreReport } from "./ScoreReport";
import { useSimulation } from "@/hooks/useSimulation";
import {
  checkCooldown,
  loadSimulationHistory,
  ELA_DURATION_MINUTES,
  MATH_DURATION_MINUTES,
  READING_QUESTION_TARGET,
  QR_QUESTION_COUNT,
  MA_QUESTION_COUNT,
  COOLDOWN_DAYS,
} from "@/lib/simulation";
import type { ExamQuestion } from "@/lib/simulation";
import { countWords } from "@/components/tutor/EssayEditor";

// ─── Main Component ───────────────────────────────────────────────────

export function SimulationSession() {
  const sim = useSimulation();
  const { state } = sim;

  switch (state.phase) {
    case "gate":
      return <GateScreen onStart={sim.startExam} error={state.error} />;
    case "generating":
      return <GeneratingScreen progress={state.generationProgress} />;
    case "instructions":
      return <InstructionsScreen onBegin={sim.beginEla} />;
    case "ela":
      return <ElaBooklet sim={sim} />;
    case "break":
      return <BreakScreen onContinue={sim.beginMath} />;
    case "math":
      return <MathBooklet sim={sim} />;
    case "submitting":
      return <SubmittingScreen />;
    case "results":
      return state.report ? (
        <ScoreReport report={state.report} />
      ) : (
        <SubmittingScreen />
      );
  }
}

// ─── Gate Screen ──────────────────────────────────────────────────────

function GateScreen({
  onStart,
  error,
}: {
  readonly onStart: () => void;
  readonly error: string | null;
}) {
  const cooldown = checkCooldown();
  const history = loadSimulationHistory();

  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          Full Practice Exam
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">
          Simulate real Hunter exam conditions
        </p>
      </div>

      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3 text-sm">
        <h2 className="font-semibold text-surface-900 dark:text-surface-100">
          What to expect
        </h2>
        <div className="space-y-2 text-surface-600 dark:text-surface-400">
          <div className="flex gap-2">
            <span className="font-medium text-surface-900 dark:text-surface-100 w-24 flex-shrink-0">
              ELA Booklet
            </span>
            <span>
              {READING_QUESTION_TARGET} reading questions + 1 essay prompt —{" "}
              {ELA_DURATION_MINUTES} minutes
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-surface-900 dark:text-surface-100 w-24 flex-shrink-0">
              Math Booklet
            </span>
            <span>
              {QR_QUESTION_COUNT} QR + {MA_QUESTION_COUNT} math achievement —{" "}
              {MATH_DURATION_MINUTES} minutes
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-surface-900 dark:text-surface-100 w-24 flex-shrink-0">
              Total
            </span>
            <span>
              {READING_QUESTION_TARGET + QR_QUESTION_COUNT + MA_QUESTION_COUNT}{" "}
              questions + essay, ~3 hours
            </span>
          </div>
        </div>
        <p className="text-xs text-surface-400 pt-1">
          No hints. No teaching. Just like the real exam.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {!cooldown.allowed ? (
        <div className="rounded-2xl border-2 border-streak-200 dark:border-streak-600/30 bg-streak-50 dark:bg-streak-500/10 p-5 space-y-2 text-center shadow-card">
          <p className="text-sm font-medium text-streak-600 dark:text-streak-400">
            Next simulation available {cooldown.nextDate}
          </p>
          <p className="text-xs text-streak-500 dark:text-streak-500">
            We limit full practice exams to once every {COOLDOWN_DAYS} days to
            prevent burnout. Use the time to practice specific skills!
          </p>
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Start Practice Exam
        </button>
      )}

      {history.length > 0 && (
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 space-y-2">
          <h3 className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            Past Simulations
          </h3>
          {history.map((h) => (
            <div
              key={h.id}
              className="flex justify-between text-sm text-surface-600 dark:text-surface-400"
            >
              <span>
                {new Date(h.completedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="font-medium">
                {h.report.overall.percentage}% — est.{" "}
                {h.report.overall.estimatedPercentile}th pctl
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <a
          href="/dashboard"
          className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

// ─── Generating Screen ────────────────────────────────────────────────

function GeneratingScreen({
  progress,
}: {
  readonly progress: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
      <TypingIndicator />
      <p className="text-sm text-surface-500 dark:text-surface-400">{progress}</p>
      <p className="text-xs text-surface-400">
        This may take a minute — we&apos;re creating a unique exam for you.
      </p>
    </div>
  );
}

// ─── Instructions Screen ──────────────────────────────────────────────

function InstructionsScreen({
  onBegin,
}: {
  readonly onBegin: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
      <h1 className="text-xl font-bold text-center text-surface-900 dark:text-surface-100">
        Exam Instructions
      </h1>

      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-4 text-sm text-surface-700 dark:text-surface-300">
        <div>
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Section 1: ELA Booklet ({ELA_DURATION_MINUTES} minutes)
          </h2>
          <ul className="space-y-1 text-surface-600 dark:text-surface-400">
            <li>
              - Read each passage carefully, then answer the questions
            </li>
            <li>- Write your essay in response to the prompt</li>
            <li>- You manage your own time between reading and writing</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Break (5 minutes)
          </h2>
          <p className="text-surface-600 dark:text-surface-400">
            Optional rest between sections.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Section 2: Math Booklet ({MATH_DURATION_MINUTES} minutes)
          </h2>
          <ul className="space-y-1 text-surface-600 dark:text-surface-400">
            <li>- Quantitative Reasoning: {QR_QUESTION_COUNT} questions</li>
            <li>- Math Achievement: {MA_QUESTION_COUNT} questions</li>
            <li>- No calculator allowed</li>
          </ul>
        </div>

        <div className="rounded-xl bg-streak-50 dark:bg-streak-500/10 border border-streak-200 dark:border-streak-600/30 p-3 text-xs text-streak-600 dark:text-streak-400">
          No hints, explanations, or teaching will be given during the exam.
          Answer every question — there is no penalty for guessing.
        </div>
      </div>

      <button
        onClick={onBegin}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        Begin ELA Section
      </button>
    </div>
  );
}

// ─── Countdown Timer ──────────────────────────────────────────────────

function ExamTimer({
  durationMinutes,
  onTimeUp,
}: {
  readonly durationMinutes: number;
  readonly onTimeUp: () => void;
}) {
  const [remaining, setRemaining] = useState(durationMinutes * 60);
  const startRef = useRef(Date.now());
  const calledRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    setRemaining(durationMinutes * 60);
    calledRef.current = false;
  }, [durationMinutes]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, durationMinutes * 60 - Math.floor(elapsed));
      setRemaining(left);

      if (left <= 0 && !calledRef.current) {
        calledRef.current = true;
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [durationMinutes, onTimeUp]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 300; // under 5 minutes
  const isCritical = remaining < 60;

  return (
    <span
      className={`font-mono text-sm font-medium ${
        isCritical
          ? "text-red-500 dark:text-red-400 animate-pulse"
          : isLow
            ? "text-streak-500 dark:text-streak-400"
            : "text-surface-700 dark:text-surface-300"
      }`}
    >
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

// ─── ELA Booklet ──────────────────────────────────────────────────────

function ElaBooklet({
  sim,
}: {
  readonly sim: ReturnType<typeof useSimulation>;
}) {
  const { state } = sim;
  const exam = state.exam!;
  const tab = state.elaTab;

  const totalReadingAnswered = exam.readingBlocks
    .flatMap((b) => b.questions)
    .filter((q) => state.answers[q.id]).length;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-3xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-surface-200 dark:border-surface-800">
        <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          ELA Booklet
        </div>
        <div className="flex items-center gap-4">
          <ExamTimer
            durationMinutes={ELA_DURATION_MINUTES}
            onTimeUp={sim.finishEla}
          />
          <button
            onClick={sim.finishEla}
            className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            Submit ELA
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-surface-200 dark:border-surface-800">
        <TabButton
          active={tab === "reading"}
          onClick={() => sim.setElaTab("reading")}
          label={`Reading (${totalReadingAnswered}/${READING_QUESTION_TARGET})`}
        />
        <TabButton
          active={tab === "writing"}
          onClick={() => sim.setElaTab("writing")}
          label="Essay"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "reading" ? (
          <ReadingSection sim={sim} />
        ) : (
          <WritingSection sim={sim} />
        )}
      </div>
    </div>
  );
}

// ─── Reading Section ──────────────────────────────────────────────────

function ReadingSection({
  sim,
}: {
  readonly sim: ReturnType<typeof useSimulation>;
}) {
  const { state } = sim;
  const exam = state.exam!;
  const passage = exam.readingBlocks[state.currentPassageIndex];

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Passage navigator */}
      <div className="flex gap-1.5 flex-wrap">
        {exam.readingBlocks.map((block, i) => {
          const answeredInBlock = block.questions.filter(
            (q) => state.answers[q.id]
          ).length;
          const allAnswered = answeredInBlock === block.questions.length;

          return (
            <button
              key={block.passageId}
              onClick={() => sim.setPassageIndex(i)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                i === state.currentPassageIndex
                  ? "bg-brand-600 text-white border-brand-600"
                  : allAnswered
                    ? "bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400 border-success-200 dark:border-success-600/30"
                    : "bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-brand-400"
              }`}
            >
              Passage {i + 1}
              {allAnswered && " \u2713"}
            </button>
          );
        })}
      </div>

      {/* Passage text */}
      <article className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
        <div className="text-xs text-brand-600 dark:text-brand-400 italic mb-2">
          {passage.preReadingContext}
        </div>
        <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-3">
          {passage.title}
        </h2>
        <div className="text-sm leading-relaxed text-surface-800 dark:text-surface-200 whitespace-pre-wrap">
          {passage.passageText}
        </div>
      </article>

      {/* Questions */}
      <div className="space-y-4">
        {passage.questions.map((q, qi) => (
          <QuestionCard
            key={q.id}
            question={q}
            questionNumber={qi + 1}
            selectedAnswer={state.answers[q.id] ?? null}
            onSelect={(letter) => sim.setAnswer(q.id, letter)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Writing Section ──────────────────────────────────────────────────

function WritingSection({
  sim,
}: {
  readonly sim: ReturnType<typeof useSimulation>;
}) {
  const { state } = sim;
  const exam = state.exam!;
  const wc = countWords(state.essayText);

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5">
        <div className="text-xs font-medium text-surface-400 uppercase tracking-wide mb-2">
          Essay Prompt
        </div>
        <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed">
          {exam.writingPrompt.text}
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          value={state.essayText}
          onChange={(e) => sim.setEssayText(e.target.value)}
          placeholder="Write your essay here..."
          className="w-full rounded-2xl border border-surface-200 dark:border-surface-600 bg-surface-0 dark:bg-surface-900 px-4 py-3 text-sm leading-relaxed text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[400px] resize-y"
          aria-label="Essay response"
        />
        <div className="text-xs text-surface-400 text-right">
          {wc} words
        </div>
      </div>
    </div>
  );
}

// ─── Break Screen ─────────────────────────────────────────────────────

function BreakScreen({
  onContinue,
}: {
  readonly onContinue: () => void;
}) {
  const [countdown, setCountdown] = useState(300); // 5 minutes

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          onContinue();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onContinue]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 animate-fade-in">
      <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
        ELA Section Complete
      </h1>
      <p className="text-sm text-surface-500 dark:text-surface-400 text-center max-w-md">
        Take a short break. Stretch, get some water, rest your eyes.
        The math section starts automatically in{" "}
        <span className="font-mono font-medium">
          {mins}:{secs.toString().padStart(2, "0")}
        </span>
        .
      </p>
      <button
        onClick={onContinue}
        className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        Start Math Section Now
      </button>
    </div>
  );
}

// ─── Math Booklet ─────────────────────────────────────────────────────

function MathBooklet({
  sim,
}: {
  readonly sim: ReturnType<typeof useSimulation>;
}) {
  const { state } = sim;
  const exam = state.exam!;
  const tab = state.mathTab;

  const qrAnswered = exam.qrQuestions.filter((q) => state.answers[q.id]).length;
  const maAnswered = exam.maQuestions.filter((q) => state.answers[q.id]).length;

  const questions = tab === "qr" ? exam.qrQuestions : exam.maQuestions;
  const currentIndex = tab === "qr" ? state.currentQrQuestion : state.currentMaQuestion;
  const setQuestion = tab === "qr" ? sim.setQrQuestion : sim.setMaQuestion;
  const question = questions[currentIndex];

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-3xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-surface-200 dark:border-surface-800">
        <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Math Booklet
        </div>
        <div className="flex items-center gap-4">
          <ExamTimer
            durationMinutes={MATH_DURATION_MINUTES}
            onTimeUp={() => void sim.finishMath()}
          />
          <button
            onClick={() => void sim.finishMath()}
            className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            Submit Math
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-surface-200 dark:border-surface-800">
        <TabButton
          active={tab === "qr"}
          onClick={() => sim.setMathTab("qr")}
          label={`Quantitative Reasoning (${qrAnswered}/${QR_QUESTION_COUNT})`}
        />
        <TabButton
          active={tab === "ma"}
          onClick={() => sim.setMathTab("ma")}
          label={`Math Achievement (${maAnswered}/${MA_QUESTION_COUNT})`}
        />
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {question && (
          <div className="space-y-4">
            <div className="text-xs text-surface-400">
              Question {currentIndex + 1} of {questions.length}
            </div>

            <QuestionCard
              question={question}
              questionNumber={currentIndex + 1}
              selectedAnswer={state.answers[question.id] ?? null}
              onSelect={(letter) => sim.setAnswer(question.id, letter)}
            />

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setQuestion(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="rounded-lg px-3 py-1.5 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setQuestion(Math.min(questions.length - 1, currentIndex + 1))
                }
                disabled={currentIndex === questions.length - 1}
                className="rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Question grid */}
        <div className="pt-4 border-t border-surface-200 dark:border-surface-800">
          <div className="text-xs text-surface-400 mb-2">Question Navigator</div>
          <div className="flex flex-wrap gap-1">
            {questions.map((q, i) => {
              const answered = !!state.answers[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setQuestion(i)}
                  className={`w-7 h-7 text-xs rounded ${
                    i === currentIndex
                      ? "bg-brand-600 text-white"
                      : answered
                        ? "bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400"
                        : "bg-surface-100 dark:bg-surface-800 text-surface-500"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Submitting Screen ────────────────────────────────────────────────

function SubmittingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
      <TypingIndicator />
      <p className="text-sm text-surface-500 dark:text-surface-400">
        Scoring your exam...
      </p>
      <p className="text-xs text-surface-400">
        Evaluating your essay and generating your score report.
      </p>
    </div>
  );
}

// ─── Shared Sub-components ────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-medium transition-colors ${
        active
          ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400"
          : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
      }`}
    >
      {label}
    </button>
  );
}

function QuestionCard({
  question,
  questionNumber,
  selectedAnswer,
  onSelect,
}: {
  readonly question: ExamQuestion;
  readonly questionNumber: number;
  readonly selectedAnswer: string | null;
  readonly onSelect: (letter: string) => void;
}) {
  return (
    <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4">
      <p className="text-sm font-medium text-surface-900 dark:text-surface-100 mb-3">
        <span className="text-surface-400 mr-1">{questionNumber}.</span>{" "}
        <MathText text={question.questionText} />
      </p>

      <div className="space-y-1.5">
        {question.answerChoices.map((choice) => (
          <button
            key={choice.letter}
            onClick={() => onSelect(choice.letter)}
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
  );
}
