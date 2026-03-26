/**
 * Mascot moment types, tone derivation, and message bank.
 * No React code — pure types and data.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type MascotMomentTone = "celebration" | "encouragement" | "greeting" | "empathy";

export type MascotMomentType =
  | { readonly kind: "session-start" }
  | { readonly kind: "session-end"; readonly questionsAnswered: number; readonly correctCount: number }
  | { readonly kind: "streak"; readonly streakCount: number }
  | { readonly kind: "drill-complete"; readonly accuracy: number }
  | { readonly kind: "assessment-complete"; readonly accuracy: number }
  | { readonly kind: "mixed-drill-complete"; readonly accuracy: number };

// ─── Tone Derivation ──────────────────────────────────────────────────

function accuracyToTone(accuracy: number): MascotMomentTone {
  if (accuracy >= 80) return "celebration";
  if (accuracy >= 50) return "encouragement";
  return "empathy";
}

export function getMomentTone(moment: MascotMomentType): MascotMomentTone {
  switch (moment.kind) {
    case "session-start":
      return "greeting";
    case "session-end": {
      const pct = moment.questionsAnswered > 0
        ? (moment.correctCount / moment.questionsAnswered) * 100
        : 50;
      return accuracyToTone(pct);
    }
    case "streak":
      return "celebration";
    case "drill-complete":
      return accuracyToTone(moment.accuracy);
    case "assessment-complete":
      return accuracyToTone(moment.accuracy);
    case "mixed-drill-complete":
      return accuracyToTone(moment.accuracy);
  }
}

// ─── Message Bank ─────────────────────────────────────────────────────

const MESSAGES: Record<string, readonly string[]> = {
  // Session start
  "session-start/greeting": [
    "Let's do this!",
    "Ready to learn?",
    "I believe in you!",
    "Let's make today count!",
    "Time to shine!",
  ],

  // Session end
  "session-end/celebration": [
    "What a session! You crushed it!",
    "Incredible work today!",
    "You should be really proud!",
    "That was your best yet!",
  ],
  "session-end/encouragement": [
    "Great effort! Keep building!",
    "You're making real progress!",
    "Every session makes you stronger!",
    "Solid work today!",
  ],
  "session-end/empathy": [
    "Every step forward counts!",
    "You showed up, and that matters!",
    "Learning takes time. You're on the right track!",
    "Tomorrow you'll be even stronger!",
  ],

  // Streaks
  "streak/celebration": [
    "You're on fire!",
    "Unstoppable!",
    "Amazing streak!",
    "Look at you go!",
    "Nothing can stop you!",
  ],

  // Drill complete
  "drill-complete/celebration": [
    "You nailed that drill!",
    "Excellent work!",
    "That was impressive!",
    "You made it look easy!",
  ],
  "drill-complete/encouragement": [
    "Good drill session!",
    "You're getting stronger!",
    "Nice effort! Keep at it!",
    "That practice will pay off!",
  ],
  "drill-complete/empathy": [
    "Drills build strength over time!",
    "You stuck with it. That takes grit!",
    "Every rep counts. Keep going!",
    "The hard ones teach us the most!",
  ],

  // Assessment complete
  "assessment-complete/celebration": [
    "Amazing score! You crushed it!",
    "Wow, what a performance!",
    "You should be so proud!",
    "That was outstanding!",
  ],
  "assessment-complete/encouragement": [
    "Solid assessment! Keep building!",
    "You're on the right track!",
    "Good work! Let's keep improving!",
    "That takes real effort. Well done!",
  ],
  "assessment-complete/empathy": [
    "Every assessment teaches us something!",
    "You showed courage taking this test!",
    "This is just the beginning. Keep going!",
    "Now we know exactly where to focus!",
  ],

  // Mixed drill complete
  "mixed-drill-complete/celebration": [
    "Nailed the mixed drill!",
    "You handled everything they threw at you!",
    "Multi-skill master!",
    "That range is impressive!",
  ],
  "mixed-drill-complete/encouragement": [
    "Good mixed practice!",
    "Mixing it up makes you stronger!",
    "Nice variety! Keep practicing!",
    "You're building well-rounded skills!",
  ],
  "mixed-drill-complete/empathy": [
    "Mixed drills are tough. You stuck with it!",
    "That took real persistence!",
    "Every mixed session builds range!",
    "The variety will pay off!",
  ],
};

// ─── Message Picker ───────────────────────────────────────────────────

function pickRandom(arr: readonly string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickMomentMessage(
  moment: MascotMomentType
): { readonly message: string; readonly tone: MascotMomentTone } {
  const tone = getMomentTone(moment);
  const key = `${moment.kind}/${tone}`;
  const messages = MESSAGES[key];

  if (!messages || messages.length === 0) {
    // Fallback — should never happen with complete message bank
    return { message: "Keep going!", tone };
  }

  return { message: pickRandom(messages), tone };
}

/**
 * Whether this moment should trigger confetti.
 * Only celebrations at streaks of 10+ or high-score completions.
 */
export function shouldShowConfetti(moment: MascotMomentType): boolean {
  const tone = getMomentTone(moment);
  if (tone !== "celebration") return false;

  if (moment.kind === "streak") return moment.streakCount >= 10;
  if (moment.kind === "assessment-complete") return true;
  if (moment.kind === "session-end") return false; // Session end celebration is quieter
  return moment.kind === "drill-complete" || moment.kind === "mixed-drill-complete";
}
