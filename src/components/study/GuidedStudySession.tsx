"use client";

import { useRouter } from "next/navigation";
import "katex/dist/katex.min.css";
import { MathText } from "@/components/chat/MathText";
import { ChoiceButtons } from "@/components/chat/ChoiceButtons";
import { Mascot } from "@/components/shared/Mascot";
import { getRandomQuestionPhrase } from "@/lib/loading-phrases";
import {
  useGuidedStudy,
  formatTimeRemaining,
  type SkillSlot,
  type GuidedStudySummary,
} from "@/hooks/useGuidedStudy";
import { MistakeReviewList, type ReviewableMistake } from "@/components/shared/MistakeReviewCard";

// ─── Domain labels ───────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  reading_comprehension: "Reading",
  math_quantitative_reasoning: "Math Reasoning",
  math_achievement: "Math Skills",
};

const DOMAIN_COLORS: Record<string, string> = {
  reading_comprehension:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  math_quantitative_reasoning:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  math_achievement:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

// ─── Main Component ──────────────────────────────────────────────────

export function GuidedStudySession() {
  const router = useRouter();
  const {
    state,
    sessionMistakes,
    startSession,
    proceedToPractice,
    submitAnswer,
    nextQuestion,
    endSession,
  } = useGuidedStudy();

  // ─── Planning Phase ──────────────────────────────────────────────

  if (state.phase === "planning") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 text-center animate-fade-in">
          <div className="flex justify-center">
            <Mascot tier={3} size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Study for Me
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Sit back and let your tutor guide a 30-minute study session.
            Skills are picked automatically based on what you need most.
          </p>

          {state.error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
              {state.error}
            </div>
          )}

          <button
            onClick={() => void startSession()}
            className="w-full rounded-2xl bg-brand-600 py-3.5 text-lg font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
          >
            Begin Session
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Complete Phase ──────────────────────────────────────────────

  if (state.phase === "complete" && state.summary) {
    return (
      <SessionSummaryView
        summary={state.summary}
        mistakes={sessionMistakes}
        onDashboard={() => router.push("/dashboard")}
      />
    );
  }

  // ─── Active Session (teaching / practicing / transitioning) ─────

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <SessionHeader
        timeRemainingMs={state.timeRemainingMs}
        skillSlots={state.skillSlots}
        currentSlotIndex={state.currentSlotIndex}
        currentSkillName={state.currentSkillName}
        currentDomain={
          state.skillSlots[state.currentSlotIndex]?.domain ?? ""
        }
        totalQuestions={state.totalQuestions}
        totalCorrect={state.totalCorrect}
        onEnd={endSession}
      />

      {/* Error banner */}
      {state.error && (
        <div className="mx-4 mt-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col items-center px-4 py-6">
        <div className="w-full max-w-lg space-y-5">
          {/* Teaching Phase */}
          {state.phase === "teaching" && (
            <TeachingView
              text={state.teachingText}
              isStreaming={state.isStreaming}
              onProceed={() => void proceedToPractice()}
            />
          )}

          {/* Practicing Phase */}
          {state.phase === "practicing" && (
            <PracticingView
              activeQuestion={state.activeQuestion}
              feedbackText={state.feedbackText}
              showingFeedback={state.showingFeedback}
              lastAnswerCorrect={state.lastAnswerCorrect}
              isStreaming={state.isStreaming}

              onAnswer={(a) => void submitAnswer(a)}
              onNext={() => void nextQuestion()}
            />
          )}

          {/* Transitioning Phase */}
          {state.phase === "transitioning" && (
            <TransitionView
              nextSkillName={
                state.skillSlots[state.currentSlotIndex + 1]?.skillName ??
                "next skill"
              }
              nextDomain={
                state.skillSlots[state.currentSlotIndex + 1]?.domain ?? ""
              }
              completedCount={state.currentSlotIndex + 1}
              totalCount={state.skillSlots.length}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Session Header ──────────────────────────────────────────────────

function SessionHeader({
  timeRemainingMs,
  skillSlots,
  currentSlotIndex,
  currentSkillName,
  currentDomain,
  totalQuestions,
  totalCorrect,
  onEnd,
}: {
  readonly timeRemainingMs: number;
  readonly skillSlots: readonly SkillSlot[];
  readonly currentSlotIndex: number;
  readonly currentSkillName: string | null;
  readonly currentDomain: string;
  readonly totalQuestions: number;
  readonly totalCorrect: number;
  readonly onEnd: () => void;
}) {
  const isLow = timeRemainingMs < 5 * 60 * 1000;

  return (
    <div className="border-b border-surface-200 bg-surface-0/80 backdrop-blur-lg px-4 py-3 dark:border-surface-800 dark:bg-surface-950/80">
      <div className="mx-auto max-w-lg">
        {/* Top row: timer + stats + end */}
        <div className="flex items-center justify-between mb-2">
          <div
            className={`font-mono text-lg font-bold ${
              isLow
                ? "text-red-500 dark:text-red-400"
                : "text-surface-700 dark:text-surface-300"
            }`}
          >
            {formatTimeRemaining(timeRemainingMs)}
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-400">
            {totalCorrect}/{totalQuestions} correct
          </div>
          <button
            onClick={onEnd}
            className="rounded-lg px-3 py-1 text-xs font-medium text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-300"
          >
            End Session
          </button>
        </div>

        {/* Skill name + domain chip */}
        {currentSkillName && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
              {currentSkillName}
            </span>
            <DomainChip domain={currentDomain} />
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {skillSlots.map((slot, i) => (
            <div
              key={slot.skillId}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i < currentSlotIndex
                  ? "bg-success-500"
                  : i === currentSlotIndex
                    ? "bg-brand-500"
                    : "bg-surface-200 dark:bg-surface-700"
              }`}
              title={slot.skillName}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Teaching View ───────────────────────────────────────────────────

function TeachingView({
  text,
  isStreaming,
  onProceed,
}: {
  readonly text: string;
  readonly isStreaming: boolean;
  readonly onProceed: () => void;
}) {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="rounded-2xl bg-surface-0 p-5 shadow-card dark:bg-surface-900">
        {text ? (
          <div className="text-sm leading-relaxed text-surface-700 dark:text-surface-300">
            <MathText text={text} />
          </div>
        ) : (
          <div className="flex items-center gap-3 py-4">
            <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:0ms]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:150ms]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {!isStreaming && text && (
        <button
          onClick={onProceed}
          className="w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
        >
          Let&apos;s Practice
        </button>
      )}
    </div>
  );
}

// ─── Practicing View ─────────────────────────────────────────────────

function PracticingView({
  activeQuestion,
  feedbackText,
  showingFeedback,
  lastAnswerCorrect,
  isStreaming,
  onAnswer,
  onNext,
}: {
  readonly activeQuestion: {
    readonly questionText: string;
    readonly answerChoices: readonly string[];
  } | null;
  readonly feedbackText: string;
  readonly showingFeedback: boolean;
  readonly lastAnswerCorrect: boolean | null;
  readonly isStreaming: boolean;
  readonly onAnswer: (answer: string) => void;
  readonly onNext: () => void;
}) {
  // Loading state — generating question
  if (!activeQuestion && !showingFeedback) {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-3 text-sm text-surface-500 dark:text-surface-400">
          {getRandomQuestionPhrase()}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Question */}
      {activeQuestion && (
        <>
          <div className="rounded-2xl bg-surface-0 p-5 shadow-card dark:bg-surface-900">
            <p className="text-sm font-medium leading-relaxed text-surface-900 dark:text-surface-100">
              <MathText text={activeQuestion.questionText} />
            </p>
          </div>

          {/* Answer choices — hidden when showing feedback */}
          {!showingFeedback && !isStreaming && (
            <ChoiceButtons
              choices={activeQuestion.answerChoices}
              onSelect={onAnswer}
              disabled={isStreaming}
            />
          )}
        </>
      )}

      {/* Streaming evaluation / feedback */}
      {(isStreaming || showingFeedback) && feedbackText && (
        <div
          className={`rounded-2xl p-4 shadow-card ${
            lastAnswerCorrect === true
              ? "bg-success-50 border border-success-200 dark:bg-success-900/20 dark:border-success-800"
              : lastAnswerCorrect === false
                ? "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800"
                : "bg-surface-0 dark:bg-surface-900"
          }`}
        >
          <div className="flex items-start gap-2">
            {lastAnswerCorrect !== null && (
              <span className="text-lg mt-0.5" aria-hidden="true">
                {lastAnswerCorrect ? "\u2705" : "\u274C"}
              </span>
            )}
            <div className="text-sm leading-relaxed text-surface-700 dark:text-surface-300 flex-1">
              <MathText text={feedbackText} />
            </div>
          </div>
        </div>
      )}

      {/* Streaming dots */}
      {isStreaming && !feedbackText && (
        <div className="flex items-center gap-3 py-4 justify-center">
          <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:0ms]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:150ms]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:300ms]" />
        </div>
      )}

      {/* Next button */}
      {showingFeedback && !isStreaming && (
        <button
          onClick={onNext}
          className="w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
        >
          Next
        </button>
      )}
    </div>
  );
}

// ─── Transition View ─────────────────────────────────────────────────

function TransitionView({
  nextSkillName,
  nextDomain,
  completedCount,
  totalCount,
}: {
  readonly nextSkillName: string;
  readonly nextDomain: string;
  readonly completedCount: number;
  readonly totalCount: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in text-center">
      <div className="flex justify-center mb-4">
        <Mascot tier={2} size="md" />
      </div>
      <p className="text-lg font-semibold text-surface-800 dark:text-surface-200">
        Great work!
      </p>
      <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">
        {completedCount} of {totalCount} skills done
      </p>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-surface-600 dark:text-surface-400">
          Moving to:
        </span>
        <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
          {nextSkillName}
        </span>
        <DomainChip domain={nextDomain} />
      </div>
      <div className="mt-4 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
    </div>
  );
}

// ─── Session Summary ─────────────────────────────────────────────────

function SessionSummaryView({
  summary,
  mistakes,
  onDashboard,
}: {
  readonly summary: GuidedStudySummary;
  readonly mistakes?: readonly ReviewableMistake[];
  readonly onDashboard: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Mascot tier={4} size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Session Complete!
          </h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            {summary.totalMinutes} minute{summary.totalMinutes !== 1 ? "s" : ""}{" "}
            of focused study
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Questions" value={String(summary.totalQuestions)} />
          <StatCard label="Correct" value={String(summary.totalCorrect)} />
          <StatCard label="Accuracy" value={`${summary.accuracy}%`} />
        </div>

        {/* Skills practiced */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
            Skills Practiced
          </h2>
          {summary.skillsCompleted.map((slot) => (
            <SkillResultCard key={slot.skillId} slot={slot} />
          ))}
        </div>

        {mistakes && mistakes.length > 0 && <MistakeReviewList mistakes={mistakes} />}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onDashboard}
            className="w-full rounded-2xl bg-brand-600 py-3.5 text-lg font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────

function DomainChip({ domain }: { readonly domain: string }) {
  const colorClass =
    DOMAIN_COLORS[domain] ??
    "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400";
  const label = DOMAIN_LABELS[domain] ?? domain;

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-0 p-4 text-center shadow-card dark:bg-surface-900">
      <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
        {value}
      </p>
      <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
        {label}
      </p>
    </div>
  );
}

function SkillResultCard({ slot }: { readonly slot: SkillSlot }) {
  const accuracy =
    slot.questionsAnswered > 0
      ? Math.round((slot.correctCount / slot.questionsAnswered) * 100)
      : 0;
  const masteryDelta = slot.endMastery - slot.startMastery;
  const deltaStr =
    masteryDelta > 0
      ? `+${Math.round(masteryDelta * 100)}%`
      : masteryDelta < 0
        ? `${Math.round(masteryDelta * 100)}%`
        : "—";
  const deltaColor =
    masteryDelta > 0
      ? "text-success-600 dark:text-success-400"
      : masteryDelta < 0
        ? "text-red-500 dark:text-red-400"
        : "text-surface-400";

  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-0 px-4 py-3 shadow-card dark:bg-surface-900">
      <div className="flex items-center gap-2 min-w-0">
        <DomainChip domain={slot.domain} />
        <span className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
          {slot.skillName}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-surface-500 dark:text-surface-400">
          {slot.correctCount}/{slot.questionsAnswered} ({accuracy}%)
        </span>
        <span className={`text-xs font-semibold ${deltaColor}`}>
          {deltaStr}
        </span>
      </div>
    </div>
  );
}
