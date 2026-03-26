"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import "katex/dist/katex.min.css";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChoiceButtons } from "@/components/chat/ChoiceButtons";
import { QuickActions } from "@/components/chat/QuickActions";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { SessionInfoBar } from "@/components/chat/SessionInfoBar";
import { SessionSummary } from "@/components/chat/SessionSummary";
import { TeachItBack } from "./TeachItBack";
import { useTutoringSession } from "@/hooks/useTutoringSession";
import { getSkillById } from "@/lib/exam/curriculum";
import { MascotMoment } from "@/components/shared/MascotMoment";
import { useMascotMoment } from "@/hooks/useMascotMoment";
import { DailyPlanProgress } from "@/components/shared/DailyPlanProgress";
import { LevelUpBanner } from "@/components/shared/LevelUpBanner";
import { DrillMode } from "./DrillMode";

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
    sessionMistakes,
    teachBackActive,
    levelUpEvent,
    clearLevelUp,
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
  const currentSkill = getSkillById(state.currentSkillId);
  const currentSkillName = currentSkill?.name ?? skill?.name ?? skillId;
  const isLoading = state.phase === "loading" || state.phase === "initializing";
  const lastMsg = state.messages[state.messages.length - 1];
  const isStreaming = isLoading && lastMsg?.role === "tutor" && lastMsg.content.length > 0;

  // Mascot moments
  const { mascotType, mascotTier, moment, momentKey, triggerMoment } = useMascotMoment();

  // Session start moment (fires once)
  const sessionStartedRef = useRef(false);
  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    triggerMoment({ kind: "session-start" });
  }, [triggerMoment]);

  // Streak moments (fires at 5, 10, 15...)
  const lastStreakMomentRef = useRef(0);
  useEffect(() => {
    if (state.correctStreak >= 5 && state.correctStreak % 5 === 0 && state.correctStreak !== lastStreakMomentRef.current) {
      triggerMoment({ kind: "streak", streakCount: state.correctStreak });
      lastStreakMomentRef.current = state.correctStreak;
    }
    if (state.correctStreak === 0) lastStreakMomentRef.current = 0;
  }, [state.correctStreak, triggerMoment]);

  // Session end moment (fires when summary appears)
  const sessionEndedRef = useRef(false);
  useEffect(() => {
    if (summary && !sessionEndedRef.current) {
      sessionEndedRef.current = true;
      triggerMoment({ kind: "session-end", questionsAnswered: state.questionCount, correctCount: state.correctCount });
    }
  }, [summary, state.questionCount, state.correctCount, triggerMoment]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, isLoading]);

  const [drillActive, setDrillActive] = useState(false);

  const router = useRouter();
  const handleSummaryClose = useCallback(() => {
    if (isFirstSession) {
      router.push("/dashboard");
    } else {
      restart();
    }
  }, [isFirstSession, router, restart]);

  if (summary && drillActive) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50 dark:bg-surface-950">
        <DrillMode initialSkillId={state.currentSkillId} autoStart />
      </div>
    );
  }

  if (summary) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 bg-surface-50 dark:bg-surface-950 min-h-screen">
        <SessionSummary data={summary} mistakes={sessionMistakes} onClose={handleSummaryClose} isFirstSession={isFirstSession} onStartDrill={() => setDrillActive(true)} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-2rem)] max-w-2xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Header — navigation and session controls */}
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
          </div>
        </div>
        <div className="flex items-center gap-4">
          <DailyPlanProgress />
          <button
            onClick={endSession}
            className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors font-medium"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Session info bar — timer, skill name, mastery */}
      <SessionInfoBar
        mastery={state.mastery}
        difficultyTier={state.difficultyTier}
        startTime={state.startTime}
        stopped={state.phase === "complete"}
        skillName={currentSkillName}
      />

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

      {levelUpEvent && (
        <LevelUpBanner event={levelUpEvent} onDismiss={clearLevelUp} />
      )}

      <MascotMoment moment={moment} mascotType={mascotType} tier={mascotTier} momentKey={momentKey} />
    </div>
  );
}
