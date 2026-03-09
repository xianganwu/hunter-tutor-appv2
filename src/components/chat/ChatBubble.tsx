"use client";

import { MathText } from "./MathText";
import type { ChatMessageDisplay } from "@/components/tutor/types";

interface ChatBubbleProps {
  readonly message: ChatMessageDisplay;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isTutor = message.role === "tutor";

  return (
    <div
      className={`flex ${isTutor ? "justify-start" : "justify-end"} mb-3 animate-slide-up`}
      role="log"
      aria-label={`${isTutor ? "Tutor" : "You"}: ${message.content.slice(0, 50)}`}
    >
      <div
        className={`max-w-[85%] px-4 py-3 text-body leading-relaxed ${
          isTutor
            ? "bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-md text-surface-900 dark:text-surface-100 shadow-soft"
            : "bg-brand-600 text-white rounded-2xl rounded-tr-md"
        } ${message.type === "teaching" ? "max-w-[90%]" : ""}`}
      >
        {message.type === "teaching" && isTutor && (
          <div className="text-xs font-semibold text-brand-600 dark:text-brand-400 mb-1.5 uppercase tracking-wide">
            Lesson
          </div>
        )}
        {message.type === "hint" && isTutor && (
          <div className="text-xs font-semibold text-streak-600 dark:text-streak-400 mb-1.5 uppercase tracking-wide">
            Hint
          </div>
        )}
        {message.type === "teach_back_eval" && isTutor && (
          <div className="text-xs font-semibold text-success-600 dark:text-success-400 mb-1.5 uppercase tracking-wide">
            Teach Back
          </div>
        )}
        <div className="whitespace-pre-wrap [&_.katex]:text-lg">
          <MathText text={message.content} />
        </div>
      </div>
    </div>
  );
}
