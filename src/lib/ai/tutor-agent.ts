import type Anthropic from "@anthropic-ai/sdk";
import type { DifficultyLevel, Skill } from "@/lib/types";
import { getAnthropicClient } from "./client";
import { getAllSkills } from "@/lib/exam/curriculum";

// ─── Types ────────────────────────────────────────────────────────────

export interface TeachConceptResult {
  readonly explanation: string;
}

export interface GeneratedQuestion {
  readonly questionText: string;
  readonly correctAnswer: string;
  readonly answerChoices: readonly string[];
  readonly skillId: string;
  readonly difficultyTier: DifficultyLevel;
}

export interface AnswerFeedback {
  readonly isCorrect: boolean;
  readonly feedback: string;
}

export interface EssayFeedback {
  readonly overallFeedback: string;
  readonly scores: {
    readonly organization: number;
    readonly clarity: number;
    readonly evidence: number;
    readonly grammar: number;
  };
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
}

export interface SocraticFollowUp {
  readonly question: string;
}

export interface ConversationMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

// ─── Constants ────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_LESSON = 1024;
const MAX_TOKENS_QUESTION = 512;
const MAX_TOKENS_FEEDBACK = 768;
const MAX_TOKENS_ESSAY = 1024;
const MAX_TOKENS_FOLLOWUP = 256;

// ─── System Prompt ────────────────────────────────────────────────────

function buildCurriculumSummary(): string {
  const skills = getAllSkills();
  const lines: string[] = [];

  for (const [id, skill] of Array.from(skills.entries())) {
    const prereqs =
      skill.prerequisite_skills.length > 0
        ? skill.prerequisite_skills.join(", ")
        : "none";
    const level = skill.level ?? "foundations";
    lines.push(
      `- ${id}: "${skill.name}" [${level}] (tier ${skill.difficulty_tier}, prereqs: ${prereqs})`
    );
  }

  return lines.join("\n");
}

function buildSystemPrompt(): string {
  const curriculum = buildCurriculumSummary();

  return `You are a warm, patient tutor helping a student build foundational skills for the Hunter College High School entrance exam. The student may be a rising 5th grader (age 9-10) working on foundations, or a 6th grader (age 11-12) doing intensive Hunter prep. Your name is not important — the student is the star.

## Your Teaching Philosophy

1. **Socratic method**: Never give answers immediately. Ask guiding questions that lead the student to discover the answer. Use phrases like "What do you think would happen if...?" and "Can you tell me why you chose that?"

2. **Celebrate effort**: Praise the thinking process, not just correct answers. Say things like "I love how you broke that down" or "Great reasoning — you're really thinking this through." Never say "wrong" — say "not quite" or "let's look at this another way."

3. **Patient scaffolding**: If a student is stuck, break the problem into smaller steps. If they're still stuck, give a worked example of a similar (not identical) problem, then circle back.

4. **Age-appropriate language**: Write at a 4th-5th grade reading level for "foundations" level skills, and 6th grade level for "hunter_prep" skills. Short sentences. Concrete, relatable examples (sports, animals, games, school life). Avoid jargon — but introduce vocabulary naturally when relevant.

5. **Encouraging tone**: Every response should leave the student feeling capable. End teaching moments with forward momentum: "Now you know X — let's try one together!"

6. **Progressive learning**: Students start with foundational skills and progress to Hunter prep level skills. When a student masters a foundations-level skill, celebrate and introduce the next level: "You've gotten really strong at this! Ready for a bigger challenge?"

## Emotional Awareness

Students preparing for a competitive exam often feel anxious, frustrated, or discouraged. Younger students (ages 9-10) are especially sensitive. Watch for signals:

- **Frustration**: "I don't get it", "this is too hard", "I give up", short or angry responses, repeated wrong answers
- **Anxiety**: "I'm nervous", "what if I fail", "I'm scared", "I'm not smart enough"
- **Disengagement**: very short answers, "idk", "whatever"

When you detect these signals:
1. Pause the academic content immediately
2. Validate their feelings: "It's totally normal to feel frustrated — this IS challenging material"
3. Remind them of progress: reference something they got right earlier
4. Offer a choice: "Want to try an easier one, take a quick break, or switch topics?"
5. Never minimize their feelings or push through frustration
6. Use a lighter tone after emotional moments — warmth helps

A student who feels safe makes more progress than one who feels pressured.

## Rules
- Keep responses concise: 2-4 sentences for dialogue, longer for worked explanations.
- Use LaTeX notation for math expressions: wrap inline math in single dollar signs like $\\frac{3}{4}$ and display math in double dollar signs like $$x^2 + 3x = 10$$. Keep simple numbers plain.
- Never break character or mention being an AI.
- If a student gives a wrong answer, ask what their reasoning was before correcting.
- Reference prerequisite skills when a gap appears (e.g., "Let's make sure we're solid on fractions before tackling ratios").
- For younger students (foundations level), use more relatable examples: pizza slices, sports scores, classroom scenarios, animals, games.

## Curriculum Taxonomy

This curriculum has two levels:
- **foundations**: Core skills for rising 5th graders (ages 9-10) building toward Hunter prep
- **hunter_prep**: Advanced skills for 6th graders (ages 11-12) in intensive Hunter exam preparation

Skills with difficulty tier (1-5), level, and prerequisites:

${curriculum}

Use this taxonomy to:
- Match your language complexity to the skill's level (simpler for foundations, more advanced for hunter_prep)
- Reference prerequisite skills when a student struggles
- Connect concepts across skills ("This is like what we practiced with main idea — same strategy!")
- Celebrate when a student is ready to progress from foundations to hunter_prep level skills`;
}

// ─── TutorAgent Class ─────────────────────────────────────────────────

export class TutorAgent {
  private readonly client: Anthropic;
  private readonly systemPrompt: string;

  constructor(client?: Anthropic) {
    this.client = client ?? getAnthropicClient();
    this.systemPrompt = buildSystemPrompt();
  }

  /**
   * Generate a lesson explanation calibrated to the student's mastery level.
   */
  async teachConcept(
    skill: Skill,
    studentMastery: number
  ): Promise<TeachConceptResult> {
    const masteryLabel = describeMastery(studentMastery);
    const prereqNames = skill.prerequisite_skills.join(", ") || "none";

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_LESSON,
      system: this.systemPrompt,
      messages: [
        {
          role: "user",
          content: `Teach me the concept: "${skill.name}"

Skill description: ${skill.description}
Difficulty tier: ${skill.difficulty_tier}/5
Prerequisite skills: ${prereqNames}
My current mastery: ${masteryLabel} (${Math.round(studentMastery * 100)}%)

${
  studentMastery < 0.3
    ? "I'm just starting to learn this. Start from the very basics with a simple example."
    : studentMastery < 0.6
      ? "I have some understanding but I'm not confident yet. Use a clear example and check my understanding."
      : "I know the basics but need to go deeper. Show me a challenging example and connect it to related skills."
}

Give me a clear explanation with one worked example. End by asking me a question to check my understanding.`,
        },
      ],
    });

    return {
      explanation: extractText(response),
    };
  }

  /**
   * Dynamically generate a new practice question (not from a bank).
   */
  async generateQuestion(
    skill: Skill,
    difficultyTier: DifficultyLevel
  ): Promise<GeneratedQuestion> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_QUESTION,
      system: this.systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate a practice question for me.

Skill: "${skill.name}" (${skill.skill_id})
Description: ${skill.description}
Difficulty tier: ${difficultyTier}/5

Create an original question appropriate for a ${skill.level === "hunter_prep" ? "6th grader (age 11-12)" : "rising 5th grader (age 9-10)"} at difficulty tier ${difficultyTier}. ${skill.level === "foundations" ? "Use simple, concrete scenarios that 9-10 year olds can relate to (school, sports, animals, games)." : ""} Format your response EXACTLY as:

QUESTION: [the question text — include a short passage or scenario if this is a reading skill]
A) [choice A]
B) [choice B]
C) [choice C]
D) [choice D]
E) [choice E]
CORRECT: [letter]

Make the question test exactly the skill described. Make distractors plausible but clearly wrong to someone who understands the concept.`,
        },
      ],
    });

    return parseGeneratedQuestion(extractText(response), skill.skill_id, difficultyTier);
  }

  /**
   * Evaluate a student's answer. If wrong, ask about their reasoning before explaining.
   */
  async evaluateAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    conversationHistory: readonly ConversationMessage[] = []
  ): Promise<AnswerFeedback> {
    const isCorrect =
      studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

    const historyMessages: Anthropic.MessageParam[] = conversationHistory.map(
      (m) => ({ role: m.role, content: m.content })
    );

    const prompt = isCorrect
      ? `The student answered correctly!

Question: ${questionText}
Student's answer: ${studentAnswer}
Correct answer: ${correctAnswer}

Give brief, enthusiastic praise (1-2 sentences). Acknowledge their specific reasoning if possible. Then ask if they want to try a harder one or move on.`
      : `The student answered incorrectly.

Question: ${questionText}
Student's answer: ${studentAnswer}
Correct answer: ${correctAnswer}

IMPORTANT: Do NOT reveal the correct answer yet. Instead:
1. Acknowledge their attempt positively ("Good try!" or "Interesting choice.")
2. Ask what made them pick that answer — what was their reasoning?
3. Give a small hint that nudges them toward the right thinking without giving it away.

Keep it encouraging. We want them to try again.`;

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_FEEDBACK,
      system: this.systemPrompt,
      messages: [
        ...historyMessages,
        { role: "user", content: prompt },
      ],
    });

    return {
      isCorrect,
      feedback: extractText(response),
    };
  }

  /**
   * Evaluate an essay with structured feedback and scores.
   */
  async evaluateEssay(
    prompt: string,
    essayText: string
  ): Promise<EssayFeedback> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_ESSAY,
      system: this.systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please evaluate this student's essay.

Writing prompt: "${prompt}"

Student's essay:
---
${essayText}
---

Evaluate this student's essay. Be encouraging but honest. Format your response EXACTLY as:

OVERALL: [2-3 sentences of overall feedback — start with something positive]

SCORES (1-10 each):
Organization: [score]
Clarity: [score]
Evidence: [score]
Grammar: [score]

STRENGTHS:
- [specific thing they did well, with a quote from their essay]
- [another specific strength]
- [another specific strength]

IMPROVEMENTS:
- [specific, actionable suggestion — not "write better" but "try adding a topic sentence to your second paragraph"]
- [another specific suggestion]
- [another specific suggestion]

Remember: this student may be a 9-10 year old building foundations or an 11-12 year old preparing for the Hunter exam. Be age-appropriate and encouraging.`,
        },
      ],
    });

    return parseEssayFeedback(extractText(response));
  }

  /**
   * Respond empathetically to a student showing frustration, anxiety, or discouragement.
   */
  async respondToEmotionalCue(
    message: string,
    conversationHistory: readonly ConversationMessage[] = []
  ): Promise<string> {
    const historyMessages: Anthropic.MessageParam[] = conversationHistory.map(
      (m) => ({ role: m.role, content: m.content })
    );

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_FEEDBACK,
      system: this.systemPrompt,
      messages: [
        ...historyMessages,
        {
          role: "user",
          content: `The student just said: "${message}"

This seems like they might be feeling frustrated, anxious, or discouraged. Respond with empathy and support. Do NOT jump back into academic content — acknowledge their feelings first, then gently offer options for how to proceed (try an easier question, take a break, or switch topics).`,
        },
      ],
    });

    return extractText(response);
  }

  /**
   * Ask a probing Socratic follow-up question to deepen understanding.
   */
  async socraticFollowUp(
    context: string,
    conversationHistory: readonly ConversationMessage[] = []
  ): Promise<SocraticFollowUp> {
    const historyMessages: Anthropic.MessageParam[] = conversationHistory.map(
      (m) => ({ role: m.role, content: m.content })
    );

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_FOLLOWUP,
      system: this.systemPrompt,
      messages: [
        ...historyMessages,
        {
          role: "user",
          content: `Based on this context, ask me ONE thoughtful Socratic follow-up question to deepen my understanding. The question should push me to think more deeply, connect to related concepts, or apply what I just learned in a new way.

Context: ${context}

Ask just the question — nothing else. Make it feel natural, not like a quiz.`,
        },
      ],
    });

    return {
      question: extractText(response),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function extractText(response: Anthropic.Message): string {
  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }
  return "";
}

function describeMastery(level: number): string {
  if (level < 0.2) return "beginner";
  if (level < 0.4) return "developing";
  if (level < 0.6) return "emerging";
  if (level < 0.8) return "proficient";
  return "advanced";
}

function parseGeneratedQuestion(
  text: string,
  skillId: string,
  difficultyTier: DifficultyLevel
): GeneratedQuestion {
  const questionMatch = text.match(/QUESTION:\s*([\s\S]+?)(?=\n[A-E]\))/);
  const choiceMatches = text.match(/[A-E]\)\s*.+/g);
  const correctMatch = text.match(/CORRECT:\s*([A-E])/i);

  const questionText = questionMatch?.[1]?.trim() ?? text;
  const answerChoices = choiceMatches?.map((c) => c.trim()) ?? [];
  const correctLetter = correctMatch?.[1]?.toUpperCase() ?? "A";
  const correctIndex = correctLetter.charCodeAt(0) - "A".charCodeAt(0);
  const correctAnswer =
    answerChoices[correctIndex]?.replace(/^[A-E]\)\s*/, "") ?? correctLetter;

  return {
    questionText,
    correctAnswer,
    answerChoices,
    skillId,
    difficultyTier,
  };
}

function parseEssayFeedback(text: string): EssayFeedback {
  const overallMatch = text.match(/OVERALL:\s*([\s\S]+?)(?=\nSCORES)/);
  const orgMatch = text.match(/Organization:\s*(\d+)/);
  const clarityMatch = text.match(/Clarity:\s*(\d+)/);
  const evidenceMatch = text.match(/Evidence:\s*(\d+)/);
  const grammarMatch = text.match(/Grammar:\s*(\d+)/);

  const strengthsMatch = text.match(
    /STRENGTHS:\s*\n([\s\S]*?)(?=\nIMPROVEMENTS:)/
  );
  const improvementsMatch = text.match(/IMPROVEMENTS:\s*\n([\s\S]*?)$/);

  const parseBullets = (block: string | undefined): string[] => {
    if (!block) return [];
    return block
      .split("\n")
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter((line) => line.length > 0);
  };

  return {
    overallFeedback: overallMatch?.[1]?.trim() ?? text.slice(0, 200),
    scores: {
      organization: clampScore(parseInt(orgMatch?.[1] ?? "5", 10)),
      clarity: clampScore(parseInt(clarityMatch?.[1] ?? "5", 10)),
      evidence: clampScore(parseInt(evidenceMatch?.[1] ?? "5", 10)),
      grammar: clampScore(parseInt(grammarMatch?.[1] ?? "5", 10)),
    },
    strengths: parseBullets(strengthsMatch?.[1]),
    improvements: parseBullets(improvementsMatch?.[1]),
  };
}

function clampScore(n: number): number {
  if (isNaN(n)) return 5;
  return Math.max(1, Math.min(10, n));
}
