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
      className={`flex ${isTutor ? "justify-start" : "justify-end"} mb-3`}
      role="log"
      aria-label={`${isTutor ? "Tutor" : "You"}: ${message.content.slice(0, 50)}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isTutor
            ? "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            : "bg-blue-600 text-white"
        } ${message.type === "teaching" ? "max-w-[90%]" : ""}`}
      >
        {message.type === "teaching" && isTutor && (
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wide">
            Lesson
          </div>
        )}
        {message.type === "hint" && isTutor && (
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wide">
            Hint
          </div>
        )}
        {message.type === "teach_back_eval" && isTutor && (
          <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1 uppercase tracking-wide">
            Teach Back
          </div>
        )}
        <div className="whitespace-pre-wrap">
          <MathText text={message.content} />
        </div>
      </div>
    </div>
  );
}
