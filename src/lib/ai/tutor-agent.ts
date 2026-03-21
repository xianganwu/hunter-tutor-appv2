import type Anthropic from "@anthropic-ai/sdk";
import type { DifficultyLevel, Skill } from "@/lib/types";
import { getAnthropicClient } from "./client";
import { getAllSkills } from "@/lib/exam/curriculum";
import { parseWarn, parseError } from "./parse-logger";
import { isValidQuestion } from "./validate-question";

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
    readonly voice?: number;
    readonly ideas?: number;
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

export const MODEL_SONNET = "claude-sonnet-4-20250514";
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
const MAX_TOKENS_LESSON = 4096;
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
- When writing about money, write out the word "dollars" (or "cents") instead of using the $ symbol (e.g. "15 dollars" not "$15"), since $ is reserved for LaTeX math delimiters.

## Diagrams
Do NOT include SVG diagrams unless the concept is truly impossible to understand without a visual. Most math concepts can be taught effectively with text, LaTeX notation, and step-by-step explanations alone. When in doubt, do NOT include a diagram.

Only include a diagram for concepts like: geometric shapes/angles that must be seen, coordinate plane plots, or spatial reasoning problems where text alone genuinely fails. Do NOT create diagrams for: number lines, bar charts, pie charts, fraction models, tables, Venn diagrams, or any concept that can be explained with words and numbers.

When you do include a diagram (rare), follow these SVG rules:
- CRITICAL ACCURACY: The visual MUST be mathematically correct. If angles are labeled, the drawn angles must visually match (e.g., a triangle with angles 60/50/70 must NOT look equilateral — the sides and angles must look different). If a shape is a right triangle, draw it with a visible right angle. Never draw a shape that contradicts the labels. Double-check that side lengths, angles, and proportions in your SVG are consistent with the math.
- Output raw SVG tags inline (e.g., \`<svg width="300" height="200" viewBox="0 0 300 200">...</svg>\`).
- CRITICAL: Keep SVGs compact — under 60 lines of SVG code. Use minimal grid lines (skip fine grids). Avoid verbose patterns/defs when simple shapes suffice.
- Max dimensions: 300px wide, 200px tall.
- The SVG will always be rendered on a white background. Use dark colors for text and labels.
- Use these exact colors: bars/shapes \`#6366f1\` (indigo), \`#22c55e\` (green), \`#f59e0b\` (amber), \`#ef4444\` (red), \`#8b5cf6\` (purple). Text/labels \`#1e293b\`, axis/grid lines \`#94a3b8\`.
- Always include text labels (axis labels, data labels).
- Use \`font-family="system-ui, sans-serif"\` and \`font-size="12"\` for labels.
- Do NOT reference external images or use \`<image>\` tags. Everything must be self-contained.
- CRITICAL: Always close every SVG tag properly. The SVG MUST end with \`</svg>\`. Never leave SVG incomplete.
- Place the SVG on its own line.

Formatting rules:
- Do NOT use markdown formatting (no ##, no **, no - bullets, no ### headers). The UI does not render markdown.
- Use plain text for explanations. Separate paragraphs with blank lines.
- For emphasis, simply state things clearly — do not wrap in asterisks or use header syntax.
- For lists, write numbered steps like "1. First step" or use natural language ("First,... Then,... Finally,...").
- Use $...$ for inline math and $$...$$ for display math (LaTeX).

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

/** Build a cached system prompt block for Anthropic API calls. */
function buildCachedSystemBlock(text: string): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text" as const,
      text,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}

/**
 * Extract the choice letter from "B) text" or bare "B" formats.
 * Returns null if the string doesn't look like a letter-based answer
 * (e.g., "Roosevelt High School" should NOT return "R").
 */
function extractChoiceLetter(s: string): string | null {
  const trimmed = s.trim();
  // Match "C) text" format
  const match = trimmed.match(/^([A-Ea-e])\)/);
  if (match) return match[1].toUpperCase();
  // Match bare single letter "C"
  if (/^[A-Ea-e]$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

/**
 * Compare student answer and correct answer, handling mixed formats:
 * - Both letter-prefixed: "C) text" vs "C) text"
 * - Bare letter vs letter-prefixed: "C" vs "C) text"
 * - Both plain text: "Roosevelt High School" vs "Roosevelt High School"
 * - Plain text vs letter-prefixed: "Roosevelt High School" vs "C) Roosevelt High School"
 */
function answersMatch(studentAnswer: string, correctAnswer: string): boolean {
  // Strategy 1: Direct text match (case-insensitive)
  if (studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) return true;

  // Strategy 2: Both resolve to the same choice letter
  const sLetter = extractChoiceLetter(studentAnswer);
  const cLetter = extractChoiceLetter(correctAnswer);
  if (sLetter && cLetter) return sLetter === cLetter;

  // Strategy 3: Match after stripping letter prefix from both
  const stripPrefix = (s: string) => s.replace(/^[A-Ea-e]\)\s*/, "").trim().toLowerCase();
  if (stripPrefix(studentAnswer) === stripPrefix(correctAnswer)) return true;

  return false;
}

// ─── TutorAgent Class ─────────────────────────────────────────────────

export class TutorAgent {
  private readonly client: Anthropic;
  private readonly systemPrompt: string;
  private readonly cachedSystemBlock: Anthropic.TextBlockParam[];

  constructor(client?: Anthropic) {
    this.client = client ?? getAnthropicClient();
    this.systemPrompt = buildSystemPrompt();
    this.cachedSystemBlock = buildCachedSystemBlock(this.systemPrompt);
  }

  getCachedSystemBlock(): Anthropic.TextBlockParam[] {
    return this.cachedSystemBlock;
  }

  /** Build messages for teachConcept (shared by streaming and non-streaming). */
  buildTeachMessages(skill: Skill, studentMastery: number): Anthropic.MessageParam[] {
    const masteryLabel = describeMastery(studentMastery);
    const prereqNames = skill.prerequisite_skills.join(", ") || "none";

    return [
      {
        role: "user" as const,
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
    ];
  }

  /**
   * Generate a lesson explanation calibrated to the student's mastery level.
   */
  async teachConcept(
    skill: Skill,
    studentMastery: number
  ): Promise<TeachConceptResult> {
    const response = await this.client.messages.create({
      model: MODEL_SONNET,
      max_tokens: MAX_TOKENS_LESSON,
      system: this.cachedSystemBlock,
      messages: this.buildTeachMessages(skill, studentMastery),
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
  ): Promise<GeneratedQuestion | null> {
    const response = await this.client.messages.create({
      model: MODEL_SONNET,
      max_tokens: MAX_TOKENS_QUESTION,
      system: this.cachedSystemBlock,
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

Make the question test exactly the skill described. Make distractors plausible but clearly wrong to someone who understands the concept.

CRITICAL: There must be exactly ONE correct answer. Every answer choice must be a distinct value — no two choices may be mathematically equivalent (e.g., do NOT include both "0.5" and "1/2", or "40%" and ".40", or "$20" and "20%"). Verify your answer is correct before responding.`,
        },
      ],
    });

    return parseGeneratedQuestion(extractText(response), skill.skill_id, difficultyTier);
  }

  /** Build messages for evaluateAnswer (shared by streaming and non-streaming). */
  buildEvaluateMessages(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    conversationHistory: readonly ConversationMessage[] = []
  ): { messages: Anthropic.MessageParam[]; isCorrect: boolean } {
    const isCorrect = answersMatch(studentAnswer, correctAnswer);

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

    return {
      messages: [...historyMessages, { role: "user" as const, content: prompt }],
      isCorrect,
    };
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
    const { messages, isCorrect } = this.buildEvaluateMessages(
      questionText, studentAnswer, correctAnswer, conversationHistory
    );

    const response = await this.client.messages.create({
      model: MODEL_SONNET,
      max_tokens: MAX_TOKENS_FEEDBACK,
      system: this.cachedSystemBlock,
      messages,
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
      model: MODEL_SONNET,
      max_tokens: MAX_TOKENS_ESSAY,
      system: this.cachedSystemBlock,
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
Organization: [score — structure, paragraphs, logical flow]
Clarity: [score — clear sentences, appropriate word choice]
Evidence: [score — specific details, examples, support for ideas]
Grammar: [score — mechanics, punctuation, spelling]
Voice: [score — authentic, engaging tone; does the writing sound like a real person with something to say?]
Ideas: [score — depth of thinking, addresses the prompt directly, develops ideas beyond surface level]

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

  /** Build messages for respondToEmotionalCue. */
  buildEmotionalMessages(
    message: string,
    conversationHistory: readonly ConversationMessage[] = []
  ): Anthropic.MessageParam[] {
    const historyMessages: Anthropic.MessageParam[] = conversationHistory.map(
      (m) => ({ role: m.role, content: m.content })
    );
    return [
      ...historyMessages,
      {
        role: "user" as const,
        content: `The student just said: "${message}"

This seems like they might be feeling frustrated, anxious, or discouraged. Respond with empathy and support. Do NOT jump back into academic content — acknowledge their feelings first, then gently offer options for how to proceed (try an easier question, take a break, or switch topics).`,
      },
    ];
  }

  /**
   * Respond empathetically to a student showing frustration, anxiety, or discouragement.
   */
  async respondToEmotionalCue(
    message: string,
    conversationHistory: readonly ConversationMessage[] = []
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: MAX_TOKENS_FEEDBACK,
      system: this.cachedSystemBlock,
      messages: this.buildEmotionalMessages(message, conversationHistory),
    });

    return extractText(response);
  }

  /** Build messages for socraticFollowUp. */
  buildHintMessages(
    context: string,
    conversationHistory: readonly ConversationMessage[] = []
  ): Anthropic.MessageParam[] {
    const historyMessages: Anthropic.MessageParam[] = conversationHistory.map(
      (m) => ({ role: m.role, content: m.content })
    );
    return [
      ...historyMessages,
      {
        role: "user" as const,
        content: `Based on this context, ask me ONE thoughtful Socratic follow-up question to deepen my understanding. The question should push me to think more deeply, connect to related concepts, or apply what I just learned in a new way.

Context: ${context}

Ask just the question — nothing else. Make it feel natural, not like a quiz.`,
      },
    ];
  }

  /**
   * Ask a probing Socratic follow-up question to deepen understanding.
   */
  async socraticFollowUp(
    context: string,
    conversationHistory: readonly ConversationMessage[] = []
  ): Promise<SocraticFollowUp> {
    const response = await this.client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: MAX_TOKENS_FOLLOWUP,
      system: this.cachedSystemBlock,
      messages: this.buildHintMessages(context, conversationHistory),
    });

    return {
      question: extractText(response),
    };
  }

  /**
   * Generate a batch of drill questions for rapid-fire practice.
   * Returns an array of question objects with choices and correct answers.
   */
  async generateDrillBatch(
    skill: Skill,
    count: number = 10
  ): Promise<{ questionText: string; correctAnswer: string; answerChoices: string[] }[]> {
    const response = await this.client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 2048,
      system: this.cachedSystemBlock,
      messages: [
        {
          role: "user",
          content: `Generate ${count} rapid-fire practice questions for a timed drill.

Skill: "${skill.name}" (${skill.skill_id})
Description: ${skill.description}
Target: ${skill.level === "hunter_prep" ? "6th grader (age 11-12)" : "rising 5th grader (age 9-10)"}

These are for speed practice — questions should be clear and solvable quickly (15-30 seconds each).
Each question should have 4-5 multiple choice answers.

Format your response as a JSON array. ONLY output the JSON array, no other text:
[
  {
    "questionText": "...",
    "answerChoices": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctAnswer": "A) ..."
  },
  ...
]

Make sure:
- Questions test the skill directly
- Distractors are plausible but clearly wrong
- Each question is distinct (no repeats)
- Questions are appropriate difficulty for the student's age
- CRITICAL: Each question has exactly ONE correct answer. Every answer choice must be a distinct value — no two choices may be mathematically equivalent (e.g., do NOT include both "0.5" and "1/2", or "40%" and ".40", or "$20" and "20%"). Verify each answer is correct before including it.`,
        },
      ],
    });

    const text = extractText(response);

    try {
      // Extract JSON from the response (may be wrapped in markdown code block)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        parseError({ parser: "generateDrillBatch", field: "JSON", fallback: "[]", rawSnippet: text });
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        questionText: string;
        correctAnswer: string;
        answerChoices: string[];
      }[];

      const filtered = parsed.filter((q) => isValidQuestion(q.answerChoices, q.correctAnswer, "generateDrillBatch"));
      if (filtered.length < parsed.length) {
        parseWarn({ parser: "generateDrillBatch", field: "validation", fallback: `${filtered.length}/${parsed.length} questions passed` });
      }
      if (filtered.length === 0) {
        parseError({ parser: "generateDrillBatch", field: "result", fallback: "[] (all questions filtered out)", rawSnippet: text });
      }

      return filtered.map((q) => ({
          questionText: q.questionText,
          correctAnswer: q.correctAnswer,
          answerChoices: q.answerChoices,
        }));
    } catch (err) {
      parseError({ parser: "generateDrillBatch", field: "JSON", fallback: "[] (parse exception)", rawSnippet: text });
      console.error("[tutor-agent] generateDrillBatch JSON parse error:", err);
      return [];
    }
  }

  /**
   * Generate a batch of mixed drill questions spanning multiple skills.
   * Each returned question is tagged with its skillId.
   */
  async generateMixedDrillBatch(
    skills: Array<{ skill: Skill; tier: DifficultyLevel }>,
    totalCount: number
  ): Promise<{ questionText: string; correctAnswer: string; answerChoices: string[]; skillId: string }[]> {
    const skillList = skills
      .map(
        (s) =>
          `- skill_id: "${s.skill.skill_id}", name: "${s.skill.name}", tier: ${s.tier}/5, description: ${s.skill.description}`
      )
      .join("\n");

    const response = await this.client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 2048,
      system: this.cachedSystemBlock,
      messages: [
        {
          role: "user",
          content: `Generate exactly ${totalCount} rapid-fire practice questions spread across these skills. Distribute questions as evenly as possible across the skills.

Skills:
${skillList}

These are for a mixed drill — questions should be clear and solvable quickly (15-30 seconds each).
Each question should have 4-5 multiple choice answers.
Each question MUST include the skill_id it belongs to.

Format your response as a JSON array. ONLY output the JSON array, no other text:
[
  {
    "skillId": "the_skill_id",
    "questionText": "...",
    "answerChoices": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctAnswer": "A) ..."
  },
  ...
]

Make sure:
- Questions test the specified skill directly
- Distractors are plausible but clearly wrong
- Each question is distinct (no repeats)
- Questions are at the specified difficulty tier for each skill
- CRITICAL: Each question has exactly ONE correct answer. Every answer choice must be a distinct value — no two choices may be mathematically equivalent (e.g., do NOT include both "0.5" and "1/2", or "40%" and ".40", or "$20" and "20%"). Verify each answer is correct before including it.`,
        },
      ],
    });

    const text = extractText(response);

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        parseError({ parser: "generateMixedDrillBatch", field: "JSON", fallback: "[]", rawSnippet: text });
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        skillId: string;
        questionText: string;
        correctAnswer: string;
        answerChoices: string[];
      }[];

      const filtered = parsed.filter((q) => isValidQuestion(q.answerChoices, q.correctAnswer, "generateMixedDrillBatch"));
      if (filtered.length < parsed.length) {
        parseWarn({ parser: "generateMixedDrillBatch", field: "validation", fallback: `${filtered.length}/${parsed.length} questions passed` });
      }
      if (filtered.length === 0) {
        parseError({ parser: "generateMixedDrillBatch", field: "result", fallback: "[] (all questions filtered out)", rawSnippet: text });
      }

      return filtered.map((q) => ({
          skillId: q.skillId,
          questionText: q.questionText,
          correctAnswer: q.correctAnswer,
          answerChoices: q.answerChoices,
        }));
    } catch (err) {
      parseError({ parser: "generateMixedDrillBatch", field: "JSON", fallback: "[] (parse exception)", rawSnippet: text });
      console.error("[tutor-agent] generateMixedDrillBatch JSON parse error:", err);
      return [];
    }
  }

  /** Get the system prompt (for use by streaming route handler). */
  getSystemPrompt(): string {
    return this.systemPrompt;
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
): GeneratedQuestion | null {
  const questionMatch = text.match(/QUESTION:\s*([\s\S]+?)(?=\n[A-E]\))/);
  const choiceMatches = text.match(/[A-E]\)\s*.+/g);
  const correctMatch = text.match(/CORRECT:\s*([A-E])/i);

  if (!questionMatch) {
    parseWarn({ parser: "parseGeneratedQuestion", field: "questionText", fallback: "raw text", rawSnippet: text });
  }
  const questionText = questionMatch?.[1]?.trim() ?? text;

  if (!choiceMatches || choiceMatches.length === 0) {
    parseError({ parser: "parseGeneratedQuestion", field: "answerChoices", fallback: "[]", rawSnippet: text });
    return null;
  }
  const answerChoices = choiceMatches.map((c) => c.trim());

  if (!correctMatch) {
    parseError({ parser: "parseGeneratedQuestion", field: "correctAnswer", fallback: "REJECTED (no CORRECT: line)", rawSnippet: text });
    return null;
  }
  const correctLetter = correctMatch[1].toUpperCase();
  const correctIndex = correctLetter.charCodeAt(0) - "A".charCodeAt(0);

  if (correctIndex < 0 || correctIndex >= answerChoices.length) {
    parseError({ parser: "parseGeneratedQuestion", field: "correctAnswer", fallback: `REJECTED (letter ${correctLetter} out of range for ${answerChoices.length} choices)`, rawSnippet: text });
    return null;
  }
  const correctAnswer = answerChoices[correctIndex];

  // Reject if any choices are equivalent after normalization
  if (!isValidQuestion(answerChoices, correctAnswer, "parseGeneratedQuestion")) {
    return null;
  }

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
  const voiceMatch = text.match(/Voice:\s*(\d+)/);
  const ideasMatch = text.match(/Ideas:\s*(\d+)/);

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

  if (!overallMatch) {
    parseWarn({ parser: "parseEssayFeedback", field: "overallFeedback", fallback: "raw text (first 200 chars)", rawSnippet: text });
  }

  // Parse each score, logging when any falls back to 5
  const scoreFields: [string, RegExpMatchArray | null][] = [
    ["organization", orgMatch],
    ["clarity", clarityMatch],
    ["evidence", evidenceMatch],
    ["grammar", grammarMatch],
  ];
  const parsedScores: Record<string, number> = {};
  for (const [name, match] of scoreFields) {
    if (!match) {
      parseWarn({ parser: "parseEssayFeedback", field: name, fallback: 5, rawSnippet: text });
      parsedScores[name] = 5;
    } else {
      parsedScores[name] = clampScore(parseInt(match[1], 10), "parseEssayFeedback", name, text);
    }
  }

  if (!strengthsMatch) {
    parseWarn({ parser: "parseEssayFeedback", field: "strengths", fallback: "[]", rawSnippet: text });
  }
  if (!improvementsMatch) {
    parseWarn({ parser: "parseEssayFeedback", field: "improvements", fallback: "[]", rawSnippet: text });
  }

  return {
    overallFeedback: overallMatch?.[1]?.trim() ?? text.slice(0, 200),
    scores: {
      organization: parsedScores["organization"],
      clarity: parsedScores["clarity"],
      evidence: parsedScores["evidence"],
      grammar: parsedScores["grammar"],
      voice: voiceMatch ? clampScore(parseInt(voiceMatch[1], 10), "parseEssayFeedback", "voice", text) : undefined,
      ideas: ideasMatch ? clampScore(parseInt(ideasMatch[1], 10), "parseEssayFeedback", "ideas", text) : undefined,
    },
    strengths: parseBullets(strengthsMatch?.[1]),
    improvements: parseBullets(improvementsMatch?.[1]),
  };
}

function clampScore(n: number, parser?: string, field?: string, rawSnippet?: string): number {
  if (isNaN(n)) {
    parseWarn({ parser: parser ?? "clampScore", field: field ?? "score", fallback: 5, rawSnippet });
    return 5;
  }
  if (n < 1 || n > 10) {
    parseWarn({ parser: parser ?? "clampScore", field: field ?? "score", fallback: Math.max(1, Math.min(10, n)), rawSnippet: `Original value: ${n}` });
  }
  return Math.max(1, Math.min(10, n));
}


