"use client";

import { useState, useEffect, useRef } from "react";
import type { MascotAnimal } from "./Mascot";
import { MascotWithAccessory } from "./MascotWithAccessory";
import { loadMascotCustomization } from "@/lib/achievements";
import { Confetti } from "./Confetti";
import {
  pickMomentMessage,
  shouldShowConfetti,
  type MascotMomentType,
  type MascotMomentTone,
} from "./mascot-moments";

// ─── Props ────────────────────────────────────────────────────────────

interface MascotMomentProps {
  readonly moment: MascotMomentType | null;
  readonly mascotType?: MascotAnimal;
  readonly tier?: 1 | 2 | 3 | 4 | 5;
  /** Increment to trigger a new moment even if the type hasn't changed. */
  readonly momentKey?: number;
}

// ─── Phase Machine ────────────────────────────────────────────────────

type Phase = "hidden" | "entering" | "visible" | "exiting";

const ENTER_MS = 300;
const VISIBLE_MS = 3500;
const EXIT_MS = 300;

// ─── Tone → Colors ────────────────────────────────────────────────────

const BUBBLE_COLORS: Record<MascotMomentTone, string> = {
  celebration:
    "bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300 shadow-glow-success",
  encouragement:
    "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 shadow-glow",
  greeting:
    "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 shadow-glow",
  empathy:
    "bg-streak-50 text-streak-700 dark:bg-streak-500/20 dark:text-streak-300 shadow-glow-streak",
};

// ─── Sparkle Particles ────────────────────────────────────────────────

const SPARKLE_POSITIONS = [
  { top: "-8px", left: "-4px", delay: "0s" },
  { top: "-4px", right: "-6px", delay: "0.1s" },
  { bottom: "4px", left: "-8px", delay: "0.2s" },
  { top: "8px", right: "-4px", delay: "0.15s" },
  { bottom: "-4px", right: "8px", delay: "0.25s" },
] as const;

function SparkleParticles() {
  return (
    <>
      {SPARKLE_POSITIONS.map((pos, i) => (
        <span
          key={i}
          className="absolute animate-sparkle-pop text-streak-400"
          style={{
            ...pos,
            animationDelay: pos.delay,
          }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 0l1.5 4.5L12 6l-4.5 1.5L6 12l-1.5-4.5L0 6l4.5-1.5z" />
          </svg>
        </span>
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function MascotMoment({
  moment,
  mascotType = "penguin",
  tier = 1,
  momentKey = 0,
}: MascotMomentProps) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<MascotMomentTone>("greeting");
  const [showConfetti, setShowConfetti] = useState(false);
  const prevKeyRef = useRef(momentKey);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Respond to new moments
  useEffect(() => {
    if (!moment || momentKey === prevKeyRef.current) return;
    prevKeyRef.current = momentKey;

    // Clear any pending timers
    if (timerRef.current) clearTimeout(timerRef.current);

    const { message: msg, tone: t } = pickMomentMessage(moment);
    setMessage(msg);
    setTone(t);
    setShowConfetti(shouldShowConfetti(moment));
    setPhase("entering");

    // entering → visible
    timerRef.current = setTimeout(() => {
      setPhase("visible");

      // visible → exiting
      timerRef.current = setTimeout(() => {
        setPhase("exiting");

        // exiting → hidden
        timerRef.current = setTimeout(() => {
          setPhase("hidden");
          setShowConfetti(false);
        }, EXIT_MS);
      }, VISIBLE_MS);
    }, ENTER_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [moment, momentKey]);

  if (phase === "hidden") return null;

  const isEntering = phase === "entering";
  const isExiting = phase === "exiting";
  const isCelebration = tone === "celebration";

  return (
    <>
      {showConfetti && <Confetti active />}

      <div
        className={`fixed bottom-6 right-4 z-40 flex items-end gap-3 pointer-events-none transition-all ${
          isEntering
            ? "animate-mascot-enter"
            : isExiting
              ? "opacity-0 scale-75 transition-all duration-300"
              : ""
        }`}
        aria-live="polite"
      >
        {/* Speech bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm font-semibold max-w-[200px] ${
            BUBBLE_COLORS[tone]
          } ${isEntering ? "opacity-0 animate-fade-in" : ""}`}
          style={isEntering ? { animationDelay: "100ms", animationFillMode: "forwards" } : undefined}
        >
          {message}
        </div>

        {/* Mascot with animation */}
        <div className={`relative ${isCelebration ? "animate-mascot-wobble" : ""}`}>
          <MascotWithAccessory tier={tier} size="xl" mascotType={mascotType} accessory={loadMascotCustomization().equipped} />
          {isCelebration && <SparkleParticles />}
        </div>
      </div>
    </>
  );
}
