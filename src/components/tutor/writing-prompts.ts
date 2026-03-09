import type { EssayPrompt } from "./writing-types";

export const ESSAY_PROMPTS: readonly EssayPrompt[] = [
  {
    id: "pn_difficult_decision",
    text: "Think about a time when you had to make a difficult decision. What did you decide, and what did you learn from the experience? Use specific details to help the reader understand your situation.",
    category: "personal_narrative",
  },
  {
    id: "pn_unexpected_lesson",
    text: "Write about a time when you learned something important from an unexpected source — maybe a younger child, a mistake, or an ordinary moment. What happened, and why was the lesson meaningful to you?",
    category: "personal_narrative",
  },
  {
    id: "pe_technology",
    text: "Some people believe that technology makes our lives better, while others think it creates new problems. Do you think technology helps or hurts our daily lives? Use specific examples to support your opinion.",
    category: "persuasive",
  },
  {
    id: "pe_school_change",
    text: "Your school is considering extending the school day by one hour. Do you think this is a good idea or a bad idea? Write an essay explaining your position and supporting it with reasons and examples.",
    category: "persuasive",
  },
  {
    id: "ex_important_skill",
    text: "What is the most important skill a person can learn? Explain what this skill is, why it matters, and how someone can develop it. Use examples to support your ideas.",
    category: "expository",
  },
  {
    id: "ex_role_model",
    text: "Think about someone you admire — a family member, historical figure, or public figure. What qualities make this person admirable? Explain why these qualities are important and how they have influenced you or others.",
    category: "expository",
  },
];

export function getRandomPrompt(): EssayPrompt {
  const index = Math.floor(Math.random() * ESSAY_PROMPTS.length);
  return ESSAY_PROMPTS[index];
}

export function getPromptById(id: string): EssayPrompt | undefined {
  return ESSAY_PROMPTS.find((p) => p.id === id);
}
