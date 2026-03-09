"use client";

import { useRef, useEffect } from "react";
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

interface TutoringSessionProps {
  readonly skillId: string;
  readonly subject: string;
}

export function TutoringSession({ skillId, subject }: TutoringSessionProps) {
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
  } = useTutoringSession(skillId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const skill = getSkillById(skillId);
  const isLoading = state.phase === "loading" || state.phase === "initializing";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, isLoading]);

  if (summary) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <SessionSummary data={summary} onClose={restart} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M13 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <div>
            <h1 className="text-sm font-semibold capitalize">{subject} Tutor</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {skill?.name ?? skillId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
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
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
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

        {isLoading && <TypingIndicator />}
      </div>

      {/* Bottom controls */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
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
    </div>
  );
}
