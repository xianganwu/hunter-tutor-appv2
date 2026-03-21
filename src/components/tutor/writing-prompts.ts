import type { EssayPrompt } from "./writing-types";

export const ESSAY_PROMPTS: readonly EssayPrompt[] = [
  // ── Foundations (Rising 5th Grade) ─────────────────────────────────
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
    id: "f_pe_homework",
    text: "Some teachers give homework every night, while others give very little. Do you think students should have homework every day? Write an essay explaining your opinion and giving at least two reasons to support it.",
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
    id: "f_ex_invention",
    text: "Think about an invention that changed how people live — like the telephone, the car, or the internet. Explain how this invention changed everyday life and why it is important.",
    category: "expository",
    level: "foundations",
  },
  {
    id: "f_ex_community_helper",
    text: "Choose a person in your community who helps others — like a teacher, firefighter, or doctor. Explain what this person does and why their work matters to the community.",
    category: "expository",
    level: "foundations",
  },
  {
    id: "f_pe_screen_time",
    text: "Many parents limit how much time their children spend on screens. Do you think screen time should be limited, or should kids decide for themselves? Explain your opinion with reasons.",
    category: "persuasive",
    level: "foundations",
  },
  {
    id: "f_ex_season",
    text: "What is your favorite season of the year? Explain what makes it special. Describe the weather, activities, and feelings that make this season the best one.",
    category: "expository",
    level: "foundations",
  },
  {
    id: "f_pe_lunch",
    text: "Your school cafeteria is changing its menu. Some students want only healthy food, while others want more choices including pizza and burgers. What do you think the cafeteria should serve? Explain your opinion with reasons.",
    category: "persuasive",
    level: "foundations",
  },
  // ── Hunter Prep (6th Grade) ────────────────────────────────────────
  {
    id: "pe_uniforms",
    text: "Some schools require students to wear uniforms. Others let students choose their own clothing. Should schools require uniforms? Write an essay taking a clear position and supporting it with specific reasons and examples.",
    category: "persuasive",
    level: "hunter_prep",
  },
  {
    id: "ex_reading_importance",
    text: "Many people say that reading is one of the most important skills a student can develop. Explain why reading matters beyond school. How does reading help a person in everyday life? Use specific examples to support your ideas.",
    category: "expository",
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
  {
    id: "pe_social_media",
    text: "Should students your age be allowed to use social media? Some people believe it helps students stay connected, while others worry about its effects on mental health. Take a position and support it with specific reasons and examples.",
    category: "persuasive",
    level: "hunter_prep",
  },
  {
    id: "ex_historical_event",
    text: "Choose a historical event that changed the world — such as the invention of the printing press, the moon landing, or the civil rights movement. Explain what happened, why it was important, and how it still affects us today.",
    category: "expository",
    level: "hunter_prep",
  },
  {
    id: "pe_arts_funding",
    text: "Some people think schools should spend more money on arts programs like music, drama, and painting. Others think the money would be better spent on math and science. What do you think? Write an essay supporting your position with clear reasons.",
    category: "persuasive",
    level: "hunter_prep",
  },
];

/** Track recently used prompt IDs to avoid repeats. */
const recentPromptIds: string[] = [];
const MAX_RECENT = 5;

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
