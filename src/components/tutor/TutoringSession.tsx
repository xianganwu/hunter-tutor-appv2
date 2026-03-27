"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import "katex/dist/katex.min.css";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChoiceButtons } from "@/components/chat/ChoiceButtons";
import { QuickActions } from "@/components/chat/QuickActions";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MathText } from "@/components/chat/MathText";
import { SessionInfoBar } from "@/components/chat/SessionInfoBar";
import { SessionSummary } from "@/components/chat/SessionSummary";
import { TeachItBack } from "./TeachItBack";
import { useTutoringSession, pickNextSkill } from "@/hooks/useTutoringSession";
import { getSkillById } from "@/lib/exam/curriculum";
import { loadSkillMastery } from "@/lib/skill-mastery-store";
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

const MASTERY_REDIRECT_THRESHOLD = 0.95;

export function TutoringSession({ skillId, subject, isRetentionCheck = false, isFirstSession = false }: TutoringSessionProps) {
  const [overrideMastery, setOverrideMastery] = useState(false);

  const storedMastery = useMemo(() => {
    if (typeof window === "undefined") return null;
    return loadSkillMastery(skillId);
  }, [skillId]);

  // For fully mastered skills (not retention checks), show a redirect card
  // instead of starting a session that may struggle to generate tier-5 questions.
  if (
    !overrideMastery &&
    !isRetentionCheck &&
    storedMastery &&
    storedMastery.masteryLevel >= MASTERY_REDIRECT_THRESHOLD
  ) {
    return (
      <MasteredSkillRedirect
        skillId={skillId}
        subject={subject}
        masteryLevel={storedMastery.masteryLevel}
        onContinueAnyway={() => setOverrideMastery(true)}
      />
    );
  }

  return (
    <TutoringSessionInner
      skillId={skillId}
      subject={subject}
      isRetentionCheck={isRetentionCheck}
      isFirstSession={isFirstSession}
    />
  );
}

function useMemoOnce<T>(fn: () => T): T {
  const ref = useRef<{ value: T } | null>(null);
  if (!ref.current) ref.current = { value: fn() };
  return ref.current.value;
}

function MasteredSkillRedirect({
  skillId,
  subject,
  masteryLevel,
  onContinueAnyway,
}: {
  readonly skillId: string;
  readonly subject: string;
  readonly masteryLevel: number;
  readonly onContinueAnyway: () => void;
}) {
  const router = useRouter();
  const skill = getSkillById(skillId);
  const skillName = skill?.name ?? skillId;
  const nextSkill = useMemoOnce(() => pickNextSkill(skillId));

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="mb-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-emerald-600 dark:text-emerald-400">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          You&apos;ve mastered {skillName}!
        </h2>
        <p className="text-surface-500 dark:text-surface-400">
          {Math.round(masteryLevel * 100)}% mastery. Great work!
          {nextSkill ? " Ready to tackle something new?" : ""}
        </p>
      </div>

      <div className="space-y-3">
        {nextSkill && (
          <button
            onClick={() => router.push(nextSkill.route)}
            className="w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Practice {nextSkill.skillName} instead
          </button>
        )}
        <button
          onClick={() => router.push(`/tutor/${subject}`)}
          className="w-full rounded-xl border border-surface-300 bg-surface-0 px-5 py-3 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
        >
          Choose a different topic
        </button>
        <button
          onClick={onContinueAnyway}
          className="w-full rounded-xl px-5 py-2.5 text-xs text-surface-400 hover:text-surface-600 transition-colors dark:text-surface-500 dark:hover:text-surface-300"
        >
          Continue practicing {skillName} anyway
        </button>
      </div>
    </div>
  );
}

function TutoringSessionInner({ skillId, subject, isRetentionCheck = false, isFirstSession = false }: TutoringSessionProps) {
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
  const { mascotType, mascotTier, mascotName, moment, momentKey, triggerMoment } = useMascotMoment();

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

  // Auto-scroll to bottom only when user is already near the bottom.
  // This prevents the scroll from hijacking the user's position when they
  // scroll up to re-read the question while a hint streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 150) {
      el.scrollTop = el.scrollHeight;
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
        {/* Sticky question header — keeps question visible when hints push it off-screen */}
        {state.activeQuestion && state.messages.length > 2 && (
          <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-surface-50/95 dark:bg-surface-950/95 backdrop-blur-sm border-b border-surface-200 dark:border-surface-800">
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mb-0.5 uppercase tracking-wide">Current Question</p>
            <p className="text-sm text-surface-800 dark:text-surface-200 line-clamp-3">
              <MathText text={state.activeQuestion.questionText.replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<svg[\s\S]*/gi, "").trim()} />
            </p>
          </div>
        )}

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

      <MascotMoment moment={moment} mascotType={mascotType} tier={mascotTier} momentKey={momentKey} mascotName={mascotName} />
    </div>
  );
}
