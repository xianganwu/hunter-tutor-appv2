"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import type {
  BrainstormMessage,
  BrainstormStep,
  WritingApiResponse,
} from "./writing-types";

interface BrainstormChatProps {
  readonly promptText: string;
  readonly onComplete: () => void;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const TUTOR_QUESTIONS: Record<string, string> = {
  reaction:
    "Before we start writing, let's brainstorm! Read the prompt carefully. What's your first reaction? What comes to mind when you think about this topic?",
  ideas: "", // filled by AI response
  pick: "", // filled by AI response
  done: "",
};

async function callBrainstormApi(
  promptText: string,
  step: BrainstormStep,
  studentResponse: string
): Promise<string> {
  const res = await fetch("/api/writing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "brainstorm",
      promptText,
      step,
      studentResponse,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as { error: string }).error);
  }
  const data = (await res.json()) as WritingApiResponse;
  return data.text;
}

const STEP_ORDER: BrainstormStep[] = ["reaction", "ideas", "pick", "done"];

export function BrainstormChat({ promptText, onComplete }: BrainstormChatProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [messages, setMessages] = useState<BrainstormMessage[]>([
    {
      id: makeId(),
      role: "tutor",
      content: TUTOR_QUESTIONS.reaction,
    },
  ]);
  const [currentStep, setCurrentStep] = useState<BrainstormStep>("reaction");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(
    async (text: string) => {
      if (isLoading || currentStep === "done") return;

      const userMsg: BrainstormMessage = {
        id: makeId(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const aiResponse = await callBrainstormApi(
          promptText,
          currentStep,
          text
        );

        const tutorMsg: BrainstormMessage = {
          id: makeId(),
          role: "tutor",
          content: aiResponse,
        };
        setMessages((prev) => [...prev, tutorMsg]);

        // Advance to next step
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const nextStep = STEP_ORDER[currentIndex + 1];
        if (nextStep === "done") {
          setCurrentStep("done");
        } else {
          setCurrentStep(nextStep);
        }
      } catch {
        const fallback: BrainstormMessage = {
          id: makeId(),
          role: "tutor",
          content:
            currentStep === "reaction"
              ? "Great thought! Now, can you think of 3 different ideas or angles you could write about?"
              : currentStep === "ideas"
                ? "Those are interesting ideas! Which one feels strongest to you, and why?"
                : "That sounds like a strong choice! You're ready to start writing. Remember to begin with a clear opening that grabs the reader's attention.",
        };
        setMessages((prev) => [...prev, fallback]);
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const nextStep = STEP_ORDER[currentIndex + 1];
        setCurrentStep(nextStep === "done" ? "done" : nextStep);
      }

      setIsLoading(false);
    },
    [isLoading, currentStep, promptText]
  );

  const placeholders: Record<BrainstormStep, string> = {
    reaction: "Share your first reaction...",
    ideas: "List your 3 ideas...",
    pick: "Which idea is strongest and why?",
    done: "",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide">
            Brainstorming
          </span>
          <span className="text-xs text-surface-400">
            Step {STEP_ORDER.indexOf(currentStep) + 1} of 3
          </span>
        </div>
        <button
          onClick={() => setShowPrompt((v) => !v)}
          className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
        >
          {showPrompt ? "Hide Prompt" : "Show Prompt"}
        </button>
      </div>

      {showPrompt && (
        <div className="px-4 py-2.5 bg-brand-50 dark:bg-brand-600/10 border-b border-brand-100 dark:border-brand-800">
          <p className="text-xs text-brand-700 dark:text-brand-300">
            <strong>Prompt:</strong> {promptText}
          </p>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={{
              ...msg,
              type: msg.role === "tutor" ? "teaching" : "text",
              timestamp: Date.now(),
            }}
          />
        ))}
        {isLoading && <TypingIndicator />}
      </div>

      {currentStep !== "done" ? (
        <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder={placeholders[currentStep]}
          />
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800">
          <button
            onClick={onComplete}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Start Writing
          </button>
        </div>
      )}
    </div>
  );
}
