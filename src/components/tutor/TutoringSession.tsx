"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import "katex/dist/katex.min.css";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChoiceButtons } from "@/components/chat/ChoiceButtons";
import { QuickActions } from "@/components/chat/QuickActions";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { SessionTimer } from "@/components/chat/SessionTimer";
import { ProgressIndicator } from "@/components/chat/ProgressIndicator";
import { SessionSummary } from "@/components/chat/SessionSummary";
import { TeachItBack } from "./TeachItBack";
import { useTutoringSession } from "@/hooks/useTutoringSession";
import { getSkillById } from "@/lib/exam/curriculum";
import { SessionMascot, type MascotReaction } from "@/components/shared/SessionMascot";
import { getStoredMascotType } from "@/lib/user-profile";
import { getMascotTier } from "@/components/shared/Mascot";
import { loadAllSkillMasteries } from "@/lib/skill-mastery-store";
import { DailyPlanProgress } from "@/components/shared/DailyPlanProgress";

interface TutoringSessionProps {
  readonly skillId: string;
  readonly subject: string;
  readonly isRetentionCheck?: boolean;
  readonly isFirstSession?: boolean;
}

export function TutoringSession({ skillId, subject, isRetentionCheck = false, isFirstSession = false }: TutoringSessionProps) {
  const {
    state,
    summary,
    teachBackActive,
    submitAnswer,
    sendMessage,
    requestHint,
    requestExplanation,
    endSession,
    restart,
    handleTeachBackComplete,
    handleTeachBackSkip,
  } = useTutoringSession(skillId, isRetentionCheck, isFirstSession);

  const scrollRef = useRef<HTMLDivElement>(null);
  const skill = getSkillById(skillId);
  const isLoading = state.phase === "loading" || state.phase === "initializing";
  const lastMsg = state.messages[state.messages.length - 1];
  const isStreaming = isLoading && lastMsg?.role === "tutor" && lastMsg.content.length > 0;

  // Mascot reactions
  const mascotType = getStoredMascotType();
  const storedMasteries = loadAllSkillMasteries();
  const overallMastery = storedMasteries.length > 0
    ? storedMasteries.reduce((sum, s) => sum + s.masteryLevel, 0) / storedMasteries.length
    : 0;
  const mascotTier = getMascotTier(overallMastery);
  const [mascotReaction, setMascotReaction] = useState<MascotReaction>("idle");
  const [mascotReactionKey, setMascotReactionKey] = useState(0);
  const prevQuestionCountRef = useRef(state.questionCount);

  useEffect(() => {
    if (state.questionCount <= prevQuestionCountRef.current) return;
    prevQuestionCountRef.current = state.questionCount;

    if (state.correctStreak >= 3) {
      setMascotReaction("streak");
    } else if (state.correctStreak > 0) {
      setMascotReaction("correct");
    } else {
      setMascotReaction("incorrect");
    }
    setMascotReactionKey((k) => k + 1);
  }, [state.questionCount, state.correctStreak]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, isLoading]);

  const router = useRouter();
  const handleSummaryClose = useCallback(() => {
    if (isFirstSession) {
      router.push("/dashboard");
    } else {
      restart();
    }
  }, [isFirstSession, router, restart]);

  if (summary) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 bg-surface-50 dark:bg-surface-950 min-h-screen">
        <SessionSummary data={summary} onClose={handleSummaryClose} isFirstSession={isFirstSession} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-2rem)] max-w-2xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M13 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <div>
            <h1 className="text-sm font-semibold capitalize text-surface-900 dark:text-surface-100">
              {subject} Tutor
            </h1>
            <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">
              {skill?.name ?? skillId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <DailyPlanProgress />
          <ProgressIndicator
            current={state.questionCount}
            estimated={state.estimatedQuestions}
          />
          <SessionTimer
            startTime={state.startTime}
            stopped={state.phase === "complete"}
          />
          <button
            onClick={endSession}
            className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors font-medium"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Session goal banner */}
      {state.messages.length === 0 && state.phase === "initializing" && (
        <div className="mx-4 mt-4 rounded-2xl border border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/20 px-4 py-3 flex items-center gap-3 animate-fade-in">
          <span className="text-xl shrink-0" aria-hidden="true">🎯</span>
          <div>
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
              Today&apos;s goal: {skill?.name ?? skillId}
            </p>
            <p className="text-xs text-brand-600/70 dark:text-brand-400/70">
              About {state.estimatedQuestions} questions · You&apos;ve got this!
            </p>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-2"
      >
        {state.messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* MC choices for active question */}
        {state.activeQuestion && !isLoading && !teachBackActive && (
          <ChoiceButtons
            choices={state.activeQuestion.answerChoices}
            onSelect={(choice) => void submitAnswer(choice)}
            disabled={isLoading}
          />
        )}

        {/* Teach-it-back exercise */}
        {teachBackActive && (
          <TeachItBack
            skillId={state.currentSkillId}
            skillName={skill?.name ?? state.currentSkillId}
            onComplete={handleTeachBackComplete}
            onSkip={handleTeachBackSkip}
          />
        )}

        {isLoading && !isStreaming && <TypingIndicator />}
      </div>

      {/* Bottom controls */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 space-y-2">
        <QuickActions
          onHint={requestHint}
          onExplainMore={requestExplanation}
          disabled={isLoading}
          showHint={state.activeQuestion !== null}
          showExplain={state.messages.length > 0}
        />
        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder={
            state.activeQuestion
              ? "Type your answer or select a choice above..."
              : "Ask the tutor a question..."
          }
        />
      </div>

      <SessionMascot
        mascotType={mascotType}
        tier={mascotTier}
        reaction={mascotReaction}
        reactionKey={mascotReactionKey}
      />
    </div>
  );
}
