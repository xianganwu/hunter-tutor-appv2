"use client";

import { useState, useEffect, useRef } from "react";
import { Mascot, type MascotAnimal } from "./Mascot";

export type MascotReaction = "idle" | "correct" | "incorrect" | "thinking" | "streak";

interface SessionMascotProps {
  readonly mascotType?: MascotAnimal;
  readonly tier?: 1 | 2 | 3 | 4 | 5;
  readonly reaction: MascotReaction;
  /** Increment to trigger a new reaction, even if the type hasn't changed. */
  readonly reactionKey: number;
}

const MESSAGES: Record<Exclude<MascotReaction, "idle">, readonly string[]> = {
  correct: ["Nice one!", "You got it!", "Great job!", "That's right!", "Nailed it!"],
  incorrect: ["Keep trying!", "Almost!", "You'll get it!", "Don't give up!"],
  thinking: ["Take your time...", "Think it through...", "You've got this..."],
  streak: ["You're on fire!", "Unstoppable!", "Amazing streak!", "On a roll!"],
};

function pickRandom(arr: readonly string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function SessionMascot({
  mascotType = "penguin",
  tier = 1,
  reaction,
  reactionKey,
}: SessionMascotProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevKeyRef = useRef(reactionKey);

  useEffect(() => {
    if (reaction === "idle" || reactionKey === prevKeyRef.current) {
      return;
    }
    prevKeyRef.current = reactionKey;

    setMessage(pickRandom(MESSAGES[reaction]));
    setVisible(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), 2500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [reaction, reactionKey]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 flex items-end gap-2 transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0"
      }`}
      aria-live="polite"
    >
      {/* Speech bubble */}
      <div
        className={`rounded-xl px-3 py-2 text-xs font-medium shadow-soft ${
          reaction === "correct" || reaction === "streak"
            ? "bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300"
            : reaction === "incorrect"
              ? "bg-streak-50 text-streak-700 dark:bg-streak-500/20 dark:text-streak-300"
              : "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
        }`}
      >
        {message}
      </div>

      {/* Mascot avatar */}
      <div
        className={`transition-transform duration-300 ${
          reaction === "streak" ? "animate-bounce" : ""
        }`}
      >
        <Mascot tier={tier} size="sm" mascotType={mascotType} />
      </div>
    </div>
  );
}
