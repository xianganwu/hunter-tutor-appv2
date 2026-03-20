import { describe, it, expect, vi } from "vitest";
import { TutorAgent } from "./tutor-agent";
import type Anthropic from "@anthropic-ai/sdk";
import { getSkillById } from "@/lib/exam/curriculum";

// ─── Mock Anthropic Client ───────────────────────────────────────────

function createMockClient(responseText: string): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: responseText }],
      }),
    },
  } as unknown as Anthropic;
}

function getLastCallArgs(
  client: Anthropic
): Anthropic.MessageCreateParams {
  const mock = client.messages.create as ReturnType<typeof vi.fn>;
  return mock.mock.calls[mock.mock.calls.length - 1][0];
}

/** Extract the system prompt text from either string or TextBlockParam[] format. */
function getSystemText(
  system: string | Anthropic.TextBlockParam[] | undefined
): string {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) {
    return system
      .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("TutorAgent", () => {
  const mainIdeaSkill = getSkillById("rc_main_idea")!;

  describe("constructor and system prompt", () => {
    it("builds a system prompt containing the curriculum taxonomy", () => {
      const mockClient = createMockClient("test");
      const agent = new TutorAgent(mockClient);

      // Force a call to inspect the system prompt
      agent.teachConcept(mainIdeaSkill, 0.5);

      const args = getLastCallArgs(mockClient);
      const systemText = getSystemText(args.system);
      expect(systemText).toContain("rc_main_idea");
      expect(systemText).toContain("rc_inference");
      expect(systemText).toContain("ma_fraction_decimal_ops");
      expect(systemText).toContain("Socratic");
      expect(systemText).toContain("Hunter College");
      expect(systemText).toContain("prerequisite");
    });

    it("uses claude-sonnet-4-20250514 model", async () => {
      const mockClient = createMockClient("test");
      const agent = new TutorAgent(mockClient);

      await agent.teachConcept(mainIdeaSkill, 0.5);

      const args = getLastCallArgs(mockClient);
      expect(args.model).toBe("claude-sonnet-4-20250514");
    });
  });

  describe("teachConcept", () => {
    it("includes skill name and mastery level in the prompt", async () => {
      const mockClient = createMockClient(
        "Let me explain main idea identification..."
      );
      const agent = new TutorAgent(mockClient);

      const result = await agent.teachConcept(mainIdeaSkill, 0.3);

      const args = getLastCallArgs(mockClient);
      expect(args.messages[0].content).toContain("Main Idea Identification");
      expect(args.messages[0].content).toContain("30%");
      expect(args.messages[0].content).toContain("some understanding");
      expect(result.explanation).toBe(
        "Let me explain main idea identification..."
      );
    });

    it("adjusts language for low mastery students", async () => {
      const mockClient = createMockClient("explanation");
      const agent = new TutorAgent(mockClient);

      await agent.teachConcept(mainIdeaSkill, 0.1);

      const args = getLastCallArgs(mockClient);
      expect(args.messages[0].content).toContain(
        "Start from the very basics"
      );
    });

    it("adjusts language for high mastery students", async () => {
      const mockClient = createMockClient("explanation");
      const agent = new TutorAgent(mockClient);

      await agent.teachConcept(mainIdeaSkill, 0.7);

      const args = getLastCallArgs(mockClient);
      expect(args.messages[0].content).toContain("go deeper");
    });
  });

  describe("generateQuestion", () => {
    it("parses a well-formatted question response", async () => {
      const responseText = `QUESTION: Read the following passage and determine the main idea.

"The octopus is one of the ocean's most intelligent creatures. Scientists have observed octopuses solving puzzles, opening jars, and even escaping from aquariums. Their problem-solving abilities rival those of many mammals."

What is the main idea of this passage?
A) Octopuses live in the ocean
B) Octopuses are remarkably intelligent animals
C) Scientists study ocean creatures
D) Mammals are smarter than octopuses
E) Aquariums are not secure enough
CORRECT: B`;

      const mockClient = createMockClient(responseText);
      const agent = new TutorAgent(mockClient);

      const result = await agent.generateQuestion(mainIdeaSkill, 2);

      expect(result).not.toBeNull();
      expect(result!.skillId).toBe("rc_main_idea");
      expect(result!.difficultyTier).toBe(2);
      expect(result!.answerChoices).toHaveLength(5);
      expect(result!.correctAnswer).toBe(
        "B) Octopuses are remarkably intelligent animals"
      );
      expect(result!.questionText).toContain("main idea");
    });

    it("sends correct difficulty tier in the prompt", async () => {
      const mockClient = createMockClient(
        "QUESTION: test\nA) a\nB) b\nC) c\nD) d\nE) e\nCORRECT: A"
      );
      const agent = new TutorAgent(mockClient);

      await agent.generateQuestion(mainIdeaSkill, 4);

      const args = getLastCallArgs(mockClient);
      expect(args.messages[0].content).toContain("Difficulty tier: 4/5");
    });
  });

  describe("evaluateAnswer", () => {
    it("returns positive feedback for correct answers", async () => {
      const mockClient = createMockClient(
        "Excellent work! You nailed it. Want to try a tougher one?"
      );
      const agent = new TutorAgent(mockClient);

      const result = await agent.evaluateAnswer(
        "What is the main idea?",
        "B",
        "B"
      );

      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toContain("Excellent");
    });

    it("does not reveal the answer for incorrect responses", async () => {
      const mockClient = createMockClient(
        "Good try! What made you pick that answer? Let's think about this together."
      );
      const agent = new TutorAgent(mockClient);

      const result = await agent.evaluateAnswer(
        "What is the main idea?",
        "A",
        "B"
      );

      expect(result.isCorrect).toBe(false);
      const args = getLastCallArgs(mockClient);
      expect(args.messages[args.messages.length - 1].content).toContain(
        "Do NOT reveal the correct answer"
      );
    });

    it("is case-insensitive when checking correctness", async () => {
      const mockClient = createMockClient("Great!");
      const agent = new TutorAgent(mockClient);

      const result = await agent.evaluateAnswer("Q?", "b", "B");
      expect(result.isCorrect).toBe(true);
    });

    it("passes conversation history to the API", async () => {
      const mockClient = createMockClient("Follow up...");
      const agent = new TutorAgent(mockClient);

      await agent.evaluateAnswer("Q?", "A", "B", [
        { role: "assistant", content: "Here's a question..." },
        { role: "user", content: "I think A" },
      ]);

      const args = getLastCallArgs(mockClient);
      // History (2) + new prompt (1) = 3 messages
      expect(args.messages).toHaveLength(3);
      expect(args.messages[0].content).toBe("Here's a question...");
    });
  });

  describe("evaluateEssay", () => {
    const ESSAY_RESPONSE = `OVERALL: You've written a thoughtful essay with a clear point of view. Your introduction grabs the reader's attention, and you show good awareness of the topic.

SCORES (1-10 each):
Organization: 7
Clarity: 8
Evidence: 6
Grammar: 7

STRENGTHS:
- Your opening sentence is strong and draws the reader in: "Every morning, the school bell rings at exactly 8:00."
- You clearly state your opinion in the first paragraph.
- Your conclusion connects back to your introduction nicely.

IMPROVEMENTS:
- Try adding a specific example in your second paragraph to support your argument — maybe a statistic or a quote from an expert.
- Your third paragraph could use a topic sentence to tell the reader what it's about before diving into details.
- Watch for run-on sentences — try breaking your longer sentences into two shorter ones.`;

    it("parses scores from the response", async () => {
      const mockClient = createMockClient(ESSAY_RESPONSE);
      const agent = new TutorAgent(mockClient);

      const result = await agent.evaluateEssay(
        "Should school start later?",
        "Every morning, the school bell rings..."
      );

      expect(result.scores.organization).toBe(7);
      expect(result.scores.clarity).toBe(8);
      expect(result.scores.evidence).toBe(6);
      expect(result.scores.grammar).toBe(7);
    });

    it("parses strengths and improvements", async () => {
      const mockClient = createMockClient(ESSAY_RESPONSE);
      const agent = new TutorAgent(mockClient);

      const result = await agent.evaluateEssay("prompt", "essay text");

      expect(result.strengths.length).toBeGreaterThanOrEqual(2);
      expect(result.improvements.length).toBeGreaterThanOrEqual(2);
      expect(result.strengths[0]).toContain("opening sentence");
    });

    it("parses overall feedback", async () => {
      const mockClient = createMockClient(ESSAY_RESPONSE);
      const agent = new TutorAgent(mockClient);

      const result = await agent.evaluateEssay("prompt", "essay text");

      expect(result.overallFeedback).toContain("thoughtful essay");
    });

    it("clamps scores to 1-10 range", async () => {
      const badScores = `OVERALL: Good work.

SCORES (1-10 each):
Organization: 15
Clarity: 0
Evidence: -3
Grammar: abc

STRENGTHS:
- Good effort

IMPROVEMENTS:
- Keep practicing`;

      const mockClient = createMockClient(badScores);
      const agent = new TutorAgent(mockClient);

      const result = await agent.evaluateEssay("prompt", "essay");

      expect(result.scores.organization).toBe(10); // 15 clamped to 10
      expect(result.scores.clarity).toBe(1); // 0 clamped to 1
      expect(result.scores.evidence).toBe(5); // -3 doesn't match \d+, falls back to 5
      expect(result.scores.grammar).toBe(5); // "abc" doesn't match \d+, falls back to 5
    });
  });

  describe("socraticFollowUp", () => {
    it("sends context and returns a question", async () => {
      const mockClient = createMockClient(
        "If the author had written this passage as a letter instead of an article, what do you think would change about the tone?"
      );
      const agent = new TutorAgent(mockClient);

      const result = await agent.socraticFollowUp(
        "Student just correctly identified the author's purpose as 'to persuade' in a passage about recycling."
      );

      expect(result.question).toContain("tone");
    });

    it("includes conversation history", async () => {
      const mockClient = createMockClient("What if...?");
      const agent = new TutorAgent(mockClient);

      await agent.socraticFollowUp("context", [
        { role: "assistant", content: "Let's think about this..." },
        { role: "user", content: "I think the author wants to persuade" },
      ]);

      const args = getLastCallArgs(mockClient);
      expect(args.messages).toHaveLength(3);
    });
  });
});
