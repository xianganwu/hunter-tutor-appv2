"use client";

import { useRef, useEffect, useState } from "react";
import { PassageReader } from "./PassageReader";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useReadingStamina } from "@/hooks/useReadingStamina";
import {
  getStaminaLevel,
  computeStaminaStats,
  STAMINA_LEVELS,
} from "@/lib/reading-stamina";
import { getRandomPassagePhrase } from "@/lib/loading-phrases";

export function ReadingStaminaSession() {
  const {
    state,
    finishReading,
    answerQuestion,
    proceedFromFeedback,
    continueSession,
    endSession,
  } = useReadingStamina();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.phase, state.currentQuestionIndex]);

  const levelConfig = getStaminaLevel(state.progress.currentLevel);
  const stats = computeStaminaStats(state.progress.records);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-2xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M13 16l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <div>
            <h1 className="text-sm font-semibold">Reading Stamina</h1>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Level {state.progress.currentLevel}: {levelConfig.label} ({levelConfig.minWords}–{levelConfig.maxWords} words)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Stamina level indicator */}
          <div className="flex items-center gap-1.5">
            {STAMINA_LEVELS.map((sl) => (
              <div
                key={sl.level}
                className={`w-2 h-2 rounded-full ${
                  sl.level <= state.progress.currentLevel
                    ? "bg-success-500"
                    : "bg-surface-300 dark:bg-surface-600"
                }`}
                title={`Level ${sl.level}: ${sl.label}`}
              />
            ))}
          </div>
          {stats.averageWpm > 0 && (
            <span className="text-xs text-surface-500 dark:text-surface-400">
              Avg {stats.averageWpm} WPM
            </span>
          )}
          <button
            onClick={endSession}
            className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Main content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {/* Loading */}
        {state.phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in">
            <TypingIndicator />
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {getRandomPassagePhrase()}
            </p>
          </div>
        )}

        {/* Reading phase */}
        {state.phase === "reading" && state.currentPassage && (
          <PassageReader
            title={state.currentPassage.title}
            preReadingContext={state.currentPassage.preReadingContext}
            passageText={state.currentPassage.passageText}
            wordCount={state.currentPassage.wordCount}
            onFinishedReading={finishReading}
          />
        )}

        {/* Answering phase */}
        {state.phase === "answering" && state.currentPassage && (
          <AnsweringPhase
            passage={state.currentPassage}
            questionIndex={state.currentQuestionIndex}
            answers={state.answers}
            onAnswer={answerQuestion}
            wpm={state.currentWpm}
            passageText={state.currentPassage.passageText}
            preReadingContext={state.currentPassage.preReadingContext}
          />
        )}

        {/* Feedback phase */}
        {state.phase === "feedback" && state.currentPassage && (
          <FeedbackPhase
            passage={state.currentPassage}
            answers={state.answers}
            questionsCorrect={state.questionsCorrect}
            wpm={state.currentWpm}
            readingTimeSeconds={state.readingTimeSeconds}
            onContinue={proceedFromFeedback}
          />
        )}

        {/* Speed check phase */}
        {state.phase === "speed_check" && state.speedFeedback && (
          <SpeedCheckPhase
            feedback={state.speedFeedback}
            onContinue={continueSession}
          />
        )}

        {/* Level up phase */}
        {state.phase === "level_up" && state.newLevel && (
          <LevelUpPhase
            newLevel={state.newLevel}
            speedFeedback={state.speedFeedback}
            onContinue={
              state.speedFeedback
                ? () => {
                    // Show speed check after level up celebration
                  }
                : continueSession
            }
            onContinueWithSpeed={continueSession}
          />
        )}

        {/* Summary phase */}
        {state.phase === "summary" && (
          <SummaryPhase
            stats={stats}
            currentLevel={state.progress.currentLevel}
            passagesThisSession={state.passagesThisSession}
            startTime={state.startTime}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function AnsweringPhase({
  passage,
  questionIndex,
  answers,
  onAnswer,
  wpm,
  passageText,
  preReadingContext,
}: {
  readonly passage: {
    readonly title: string;
    readonly questions: readonly {
      readonly questionText: string;
      readonly choices: readonly string[];
      readonly correctIndex: number;
      readonly explanation: string;
    }[];
  };
  readonly questionIndex: number;
  readonly answers: readonly (number | null)[];
  readonly onAnswer: (choiceIndex: number) => void;
  readonly wpm: number;
  readonly passageText: string;
  readonly preReadingContext: string;
}) {
  const [showPassage, setShowPassage] = useState(false);
  const question = passage.questions[questionIndex];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          {passage.title}
        </h2>
        <span className="text-xs text-surface-400">
          {wpm} WPM
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {passage.questions.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < questionIndex
                ? answers[i] === passage.questions[i].correctIndex
                  ? "bg-success-500"
                  : "bg-streak-500"
                : i === questionIndex
                  ? "bg-brand-500"
                  : "bg-surface-300 dark:bg-surface-600"
            }`}
          />
        ))}
        <span className="text-xs text-surface-400 ml-1">
          Question {questionIndex + 1} of {passage.questions.length}
        </span>
      </div>

      {/* View passage toggle */}
      <button
        onClick={() => setShowPassage((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
        aria-expanded={showPassage}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={`transition-transform ${showPassage ? "rotate-180" : ""}`}
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {showPassage ? "Hide passage" : "View passage"}
      </button>

      {/* Collapsible passage */}
      {showPassage && (
        <div className="space-y-2 animate-fade-in">
          {preReadingContext && (
            <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-200 dark:border-brand-800 px-4 py-3">
              <p className="text-sm text-brand-700 dark:text-brand-300 italic">
                {preReadingContext}
              </p>
            </div>
          )}
          <article className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 border border-surface-200 dark:border-surface-800 max-h-72 overflow-y-auto">
            <div className="text-sm leading-relaxed text-surface-800 dark:text-surface-200 whitespace-pre-wrap">
              {passageText}
            </div>
          </article>
        </div>
      )}

      {/* Question */}
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 border border-surface-200 dark:border-surface-800">
        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 mb-4">
          {question.questionText}
        </p>

        <div className="space-y-2">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className="w-full text-left rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-4 py-3 text-sm text-surface-800 dark:text-surface-200 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors"
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedbackPhase({
  passage,
  answers,
  questionsCorrect,
  wpm,
  readingTimeSeconds,
  onContinue,
}: {
  readonly passage: {
    readonly title: string;
    readonly wordCount: number;
    readonly questions: readonly {
      readonly questionText: string;
      readonly choices: readonly string[];
      readonly correctIndex: number;
      readonly explanation: string;
    }[];
  };
  readonly answers: readonly (number | null)[];
  readonly questionsCorrect: number;
  readonly wpm: number;
  readonly readingTimeSeconds: number;
  readonly onContinue: () => void;
}) {
  const total = passage.questions.length;
  const accuracy = Math.round((questionsCorrect / total) * 100);
  const minutes = Math.floor(readingTimeSeconds / 60);
  const seconds = Math.round(readingTimeSeconds % 60);

  return (
    <div className="space-y-4 animate-slide-up">
      <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
        Passage Complete
      </h2>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div className="text-2xl font-bold text-brand-600">{wpm}</div>
          <div className="text-xs text-surface-500 mt-0.5">Words/min</div>
        </div>
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div className={`text-2xl font-bold ${accuracy >= 80 ? "text-success-500" : accuracy >= 60 ? "text-streak-500" : "text-red-500"}`}>
            {accuracy}%
          </div>
          <div className="text-xs text-surface-500 mt-0.5">Accuracy</div>
        </div>
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div className="text-2xl font-bold text-surface-700 dark:text-surface-300">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">Read Time</div>
        </div>
      </div>

      {/* Question review */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300">
          Review
        </h3>
        {passage.questions.map((q, i) => {
          const selected = answers[i];
          const isCorrect = selected === q.correctIndex;

          return (
            <div
              key={i}
              className={`rounded-xl border px-4 py-3 text-sm ${
                isCorrect
                  ? "border-success-200 dark:border-success-600/30 bg-success-50 dark:bg-success-500/10"
                  : "border-streak-200 dark:border-streak-600/30 bg-streak-50 dark:bg-streak-500/10"
              }`}
            >
              <p className="font-medium text-surface-900 dark:text-surface-100">
                {isCorrect ? "Correct" : "Incorrect"}: {q.questionText}
              </p>
              {!isCorrect && (
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onContinue}
        className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        Next Passage
      </button>
    </div>
  );
}

function SpeedCheckPhase({
  feedback,
  onContinue,
}: {
  readonly feedback: string;
  readonly onContinue: () => void;
}) {
  return (
    <div className="space-y-4 max-w-lg mx-auto py-8 animate-slide-up">
      <div className="rounded-2xl border-2 border-streak-200 dark:border-streak-600/30 bg-streak-50 dark:bg-streak-500/10 p-5 space-y-3 shadow-card">
        <div className="text-xs font-medium text-streak-600 dark:text-streak-400 uppercase tracking-wide">
          Reading Coach
        </div>
        <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed whitespace-pre-wrap">
          {feedback}
        </p>
      </div>

      <div className="rounded-2xl bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-4 space-y-2 shadow-card">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          Strategies for longer passages
        </h3>
        <ul className="text-sm text-surface-600 dark:text-surface-400 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-brand-500 mt-0.5 flex-shrink-0">1.</span>
            <span>Read the first and last paragraph first to get the big picture</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-500 mt-0.5 flex-shrink-0">2.</span>
            <span>Pause after each paragraph and summarize it in one sentence</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-500 mt-0.5 flex-shrink-0">3.</span>
            <span>Circle or note unfamiliar words, but keep reading — context often reveals meaning</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-500 mt-0.5 flex-shrink-0">4.</span>
            <span>Ask yourself &quot;What is the author trying to tell me?&quot; as you go</span>
          </li>
        </ul>
      </div>

      <button
        onClick={onContinue}
        className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        Ready for the next passage
      </button>
    </div>
  );
}

function LevelUpPhase({
  newLevel,
  speedFeedback,
  onContinue,
  onContinueWithSpeed,
}: {
  readonly newLevel: number;
  readonly speedFeedback: string | null;
  readonly onContinue: () => void;
  readonly onContinueWithSpeed: () => void;
}) {
  const levelConfig = getStaminaLevel(newLevel);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-slide-up">
      <div className="text-center space-y-2">
        <div className="text-4xl">
          {newLevel >= 5 ? "🏆" : newLevel >= 3 ? "⭐" : "📖"}
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
          Level Up!
        </h2>
        <p className="text-sm text-surface-600 dark:text-surface-400">
          You reached <strong>Level {newLevel}: {levelConfig.label}</strong>
        </p>
        <p className="text-sm text-surface-500">
          Passages will now be {levelConfig.minWords}–{levelConfig.maxWords} words
        </p>
      </div>

      {/* Stamina bar */}
      <div className="w-full max-w-xs">
        <div className="flex items-center gap-1">
          {STAMINA_LEVELS.map((sl) => (
            <div
              key={sl.level}
              className={`flex-1 h-3 rounded-full ${
                sl.level <= newLevel
                  ? "bg-success-500"
                  : "bg-surface-200 dark:bg-surface-700"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-surface-400">200w</span>
          <span className="text-xs text-surface-400">850w</span>
        </div>
      </div>

      <button
        onClick={speedFeedback ? onContinueWithSpeed : onContinue}
        className="rounded-xl bg-success-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-success-600 transition-colors"
      >
        Keep going!
      </button>
    </div>
  );
}

function SummaryPhase({
  stats,
  currentLevel,
  passagesThisSession,
  startTime,
}: {
  readonly stats: {
    readonly averageWpm: number;
    readonly bestWpm: number;
    readonly totalPassages: number;
    readonly totalWordsRead: number;
  };
  readonly currentLevel: number;
  readonly passagesThisSession: number;
  readonly startTime: number;
}) {
  const levelConfig = getStaminaLevel(currentLevel);
  const elapsed = Math.round((Date.now() - startTime) / 60000);

  return (
    <div className="max-w-md mx-auto py-8 space-y-6 animate-slide-up">
      <div className="text-center">
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
          Session Complete
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Great reading practice!
        </p>
      </div>

      {/* Session stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 text-center">
          <div className="text-2xl font-bold text-brand-600">
            {passagesThisSession}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">
            Passages Today
          </div>
        </div>
        <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-4 text-center">
          <div className="text-2xl font-bold text-success-500">
            {elapsed}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">
            Minutes
          </div>
        </div>
      </div>

      {/* All-time stats */}
      <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
          All-Time Progress
        </h3>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <div className="text-surface-400 text-xs">Stamina Level</div>
            <div className="font-medium text-surface-900 dark:text-surface-100">
              {currentLevel} — {levelConfig.label}
            </div>
          </div>
          <div>
            <div className="text-surface-400 text-xs">Average Speed</div>
            <div className="font-medium text-surface-900 dark:text-surface-100">
              {stats.averageWpm} WPM
            </div>
          </div>
          <div>
            <div className="text-surface-400 text-xs">Best Speed</div>
            <div className="font-medium text-surface-900 dark:text-surface-100">
              {stats.bestWpm} WPM
            </div>
          </div>
          <div>
            <div className="text-surface-400 text-xs">Total Words Read</div>
            <div className="font-medium text-surface-900 dark:text-surface-100">
              {stats.totalWordsRead.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <a
        href="/dashboard"
        className="block w-full rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        Back to Dashboard
      </a>
    </div>
  );
}
