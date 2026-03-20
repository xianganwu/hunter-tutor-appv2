import type { EssayPrompt } from "./writing-types";

export const ESSAY_PROMPTS: readonly EssayPrompt[] = [
  // ── Foundations (Rising 5th Grade) ─────────────────────────────────
  {
    id: "f_pn_favorite_day",
    text: "Think about your favorite day ever. What happened that made it so special? Write about that day using lots of details so the reader can picture it.",
    category: "personal_narrative",
    level: "foundations",
  },
  {
    id: "f_pn_new_thing",
    text: "Write about a time you tried something new — like a sport, a food, or an activity. Were you nervous? What happened? What did you learn from the experience?",
    category: "personal_narrative",
    level: "foundations",
  },
  {
    id: "f_pe_recess",
    text: "Your school is thinking about making recess longer but cutting art class shorter. Do you think this is a good idea or a bad idea? Explain your opinion with reasons.",
    category: "persuasive",
    level: "foundations",
  },
  {
    id: "f_pe_pet",
    text: "If you could have any animal as a pet, what would you choose and why? Write a paragraph convincing your family that this would be the best pet.",
    category: "persuasive",
    level: "foundations",
  },
  {
    id: "f_ex_friendship",
    text: "What makes someone a good friend? Think about the qualities that matter most and explain why they are important. Use examples from your own life.",
    category: "expository",
    level: "foundations",
  },
  {
    id: "f_ex_superpower",
    text: "If you could have one superpower, what would it be? Explain what you would do with it and how it would help people.",
    category: "expository",
    level: "foundations",
  },
  // ── Hunter Prep (6th Grade) ────────────────────────────────────────
  {
    id: "pn_difficult_decision",
    text: "Think about a time when you had to make a difficult decision. What did you decide, and what did you learn from the experience? Use specific details to help the reader understand your situation.",
    category: "personal_narrative",
    level: "hunter_prep",
  },
  {
    id: "pn_unexpected_lesson",
    text: "Write about a time when you learned something important from an unexpected source — maybe a younger child, a mistake, or an ordinary moment. What happened, and why was the lesson meaningful to you?",
    category: "personal_narrative",
    level: "hunter_prep",
  },
  {
    id: "pe_technology",
    text: "Some people believe that technology makes our lives better, while others think it creates new problems. Do you think technology helps or hurts our daily lives? Use specific examples to support your opinion.",
    category: "persuasive",
    level: "hunter_prep",
  },
  {
    id: "pe_school_change",
    text: "Your school is considering extending the school day by one hour. Do you think this is a good idea or a bad idea? Write an essay explaining your position and supporting it with reasons and examples.",
    category: "persuasive",
    level: "hunter_prep",
  },
  {
    id: "ex_important_skill",
    text: "What is the most important skill a person can learn? Explain what this skill is, why it matters, and how someone can develop it. Use examples to support your ideas.",
    category: "expository",
    level: "hunter_prep",
  },
  {
    id: "ex_role_model",
    text: "Think about someone you admire — a family member, historical figure, or public figure. What qualities make this person admirable? Explain why these qualities are important and how they have influenced you or others.",
    category: "expository",
    level: "hunter_prep",
  },
];

/** Track recently used prompt IDs to avoid repeats. */
const recentPromptIds: string[] = [];
const MAX_RECENT = 3;

export function getRandomPrompt(level?: "foundations" | "hunter_prep"): EssayPrompt {
  const filtered = level
    ? ESSAY_PROMPTS.filter((p) => p.level === level)
    : ESSAY_PROMPTS;

  // Prefer prompts not recently used
  const unused = filtered.filter((p) => !recentPromptIds.includes(p.id));
  const pool = unused.length > 0 ? unused : filtered;

  const index = Math.floor(Math.random() * pool.length);
  const selected = pool[index];

  // Track this prompt as recently used
  recentPromptIds.push(selected.id);
  if (recentPromptIds.length > MAX_RECENT) {
    recentPromptIds.shift();
  }

  return selected;
}

export function getPromptById(id: string): EssayPrompt | undefined {
  return ESSAY_PROMPTS.find((p) => p.id === id);
}

export function getPromptsByLevel(level: "foundations" | "hunter_prep"): readonly EssayPrompt[] {
  return ESSAY_PROMPTS.filter((p) => p.level === level);
}
