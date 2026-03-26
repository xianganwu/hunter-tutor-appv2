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
  // ── Session start ───────────────────────────────────────────────
  "session-start/greeting": [
    "Let's do this!",
    "Ready to learn?",
    "I believe in you!",
    "Let's make today count!",
    "Time to shine!",
    "Another day, another chance to grow!",
    "Let's pick up where we left off!",
    "You've got this. Let's go!",
    "Brain warmed up? Let's roll!",
    "Today's going to be a good one!",
    "Challenge accepted!",
    "Let's learn something new today!",
  ],

  // ── Session end ─────────────────────────────────────────────────
  "session-end/celebration": [
    "What a session! You crushed it!",
    "Incredible work today!",
    "You should be really proud!",
    "That was your best yet!",
    "You were absolutely on point!",
    "That's how it's done!",
    "Wow, you really brought it today!",
    "Top-notch work. Seriously impressive!",
    "You made that look easy!",
    "Standing ovation from me!",
  ],
  "session-end/encouragement": [
    "Great effort! Keep building!",
    "You're making real progress!",
    "Every session makes you stronger!",
    "Solid work today!",
    "You showed up and put in the work!",
    "Progress isn't always loud. You're growing!",
    "You're getting sharper every day!",
    "That's the kind of practice that adds up!",
    "Your future self will thank you for today!",
    "Consistency is your superpower!",
  ],
  "session-end/empathy": [
    "Every step forward counts!",
    "You showed up, and that matters!",
    "Learning takes time. You're on the right track!",
    "Tomorrow you'll be even stronger!",
    "Tough sessions build tough minds!",
    "The best learners are the ones who keep going!",
    "You didn't quit. That's what matters most!",
    "Rome wasn't built in a day. Neither is mastery!",
    "Even the hard days move you forward!",
    "Rest up. We'll come back stronger!",
  ],

  // ── Streaks ─────────────────────────────────────────────────────
  "streak/celebration": [
    "You're on fire!",
    "Unstoppable!",
    "Amazing streak!",
    "Look at you go!",
    "Nothing can stop you!",
    "You're in the zone!",
    "That brain is cooking!",
    "Streak machine!",
    "Is there anything you can't do?",
    "This is what flow state looks like!",
    "You're making this look effortless!",
    "Keep that hot streak rolling!",
  ],

  // ── Drill complete ──────────────────────────────────────────────
  "drill-complete/celebration": [
    "You nailed that drill!",
    "Excellent work!",
    "That was impressive!",
    "You made it look easy!",
    "Drills fear you now!",
    "Speed AND accuracy. Respect!",
    "That drill didn't stand a chance!",
    "You're getting dangerously good at this!",
    "Precision under pressure. Love it!",
    "That's champion-level drilling!",
  ],
  "drill-complete/encouragement": [
    "Good drill session!",
    "You're getting stronger!",
    "Nice effort! Keep at it!",
    "That practice will pay off!",
    "You're building muscle memory!",
    "Each drill sharpens the saw!",
    "Practice makes permanent. Keep going!",
    "You're leveling up one drill at a time!",
    "That's real progress right there!",
    "The more you drill, the more it clicks!",
  ],
  "drill-complete/empathy": [
    "Drills build strength over time!",
    "You stuck with it. That takes grit!",
    "Every rep counts. Keep going!",
    "The hard ones teach us the most!",
    "Tough drill? That means you're stretching!",
    "You didn't bail. That's huge!",
    "Struggle is how skills are built!",
    "This drill will be easier next time!",
    "You're tougher than any drill!",
    "Showing up is half the battle. You won it!",
  ],

  // ── Assessment complete ─────────────────────────────────────────
  "assessment-complete/celebration": [
    "Amazing score! You crushed it!",
    "Wow, what a performance!",
    "You should be so proud!",
    "That was outstanding!",
    "All that practice is paying off big time!",
    "You brought your A-game!",
    "That score speaks for itself!",
    "Hunter test? You're ready!",
    "Incredible focus and skill!",
    "That's a score worth celebrating!",
  ],
  "assessment-complete/encouragement": [
    "Solid assessment! Keep building!",
    "You're on the right track!",
    "Good work! Let's keep improving!",
    "That takes real effort. Well done!",
    "You're closer than you think!",
    "Every assessment sharpens your edge!",
    "Now we know what to focus on next!",
    "That's a strong foundation to build on!",
    "You handled the pressure well!",
    "Progress is progress, no matter the pace!",
  ],
  "assessment-complete/empathy": [
    "Every assessment teaches us something!",
    "You showed courage taking this test!",
    "This is just the beginning. Keep going!",
    "Now we know exactly where to focus!",
    "Tests don't define you. Your effort does!",
    "The bravest thing is trying. You did that!",
    "Knowledge grows from every attempt!",
    "You just gave yourself a roadmap to improve!",
    "This is data, not a verdict. Let's use it!",
    "You'll look back and see how far you've come!",
  ],

  // ── Mixed drill complete ────────────────────────────────────────
  "mixed-drill-complete/celebration": [
    "Nailed the mixed drill!",
    "You handled everything they threw at you!",
    "Multi-skill master!",
    "That range is impressive!",
    "You crushed every topic!",
    "Switching gears like a pro!",
    "Nothing catches you off guard!",
    "You're a well-rounded powerhouse!",
    "Versatility is your strength!",
    "That was a masterclass in mixed skills!",
  ],
  "mixed-drill-complete/encouragement": [
    "Good mixed practice!",
    "Mixing it up makes you stronger!",
    "Nice variety! Keep practicing!",
    "You're building well-rounded skills!",
    "Every topic you touch gets a little easier!",
    "Variety is the spice of learning!",
    "You're covering a lot of ground!",
    "Mixed drills build flexible thinking!",
    "That's how you become well-rounded!",
    "Good range today. Keep expanding it!",
  ],
  "mixed-drill-complete/empathy": [
    "Mixed drills are tough. You stuck with it!",
    "That took real persistence!",
    "Every mixed session builds range!",
    "The variety will pay off!",
    "Jumping between topics is hard. You did it!",
    "Your brain just got a full workout!",
    "Mixed drills are the hardest kind. Respect!",
    "You're building the kind of flexibility tests demand!",
    "Tough today, easier tomorrow!",
    "That grit will take you far!",
  ],
};

// ─── Message Picker ───────────────────────────────────────────────────

function pickRandom(arr: readonly string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a message for a mascot moment.
 * If mascotName is provided, some messages are personalized
 * (e.g., "Scout is on fire!" instead of "You're on fire!").
 */
export function pickMomentMessage(
  moment: MascotMomentType,
  mascotName?: string | null
): { readonly message: string; readonly tone: MascotMomentTone } {
  const tone = getMomentTone(moment);
  const key = `${moment.kind}/${tone}`;
  const messages = MESSAGES[key];

  if (!messages || messages.length === 0) {
    return { message: "Keep going!", tone };
  }

  let message = pickRandom(messages);

  // Personalize with mascot name ~50% of the time for variety
  if (mascotName && Math.random() < 0.5) {
    message = personalize(message, mascotName);
  }

  return { message, tone };
}

/**
 * Replace generic "You" phrasing with the mascot's name.
 * Only transforms messages that start with common patterns.
 */
function personalize(message: string, name: string): string {
  if (message.startsWith("You're ")) return `${name} is ${message.slice(7)}`;
  if (message.startsWith("You ")) return `${name} ${message.slice(4)}`;
  if (message.startsWith("You've ")) return `${name}'s ${message.slice(7)}`;
  return message;
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
