import { describe, it, expect } from "vitest";
import { ESSAY_PROMPTS, getRandomPrompt, getPromptById } from "./writing-prompts";

describe("ESSAY_PROMPTS", () => {
  it("has at least 6 prompts", () => {
    expect(ESSAY_PROMPTS.length).toBeGreaterThanOrEqual(6);
  });

  it("all prompts have required fields", () => {
    for (const prompt of ESSAY_PROMPTS) {
      expect(prompt.id).toBeTruthy();
      expect(prompt.text.length).toBeGreaterThan(20);
      expect(["personal_narrative", "persuasive", "expository"]).toContain(
        prompt.category
      );
    }
  });

  it("all prompt IDs are unique", () => {
    const ids = ESSAY_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at least one prompt per category", () => {
    const categories = new Set(ESSAY_PROMPTS.map((p) => p.category));
    expect(categories.has("personal_narrative")).toBe(true);
    expect(categories.has("persuasive")).toBe(true);
    expect(categories.has("expository")).toBe(true);
  });
});

describe("getRandomPrompt", () => {
  it("returns a valid prompt", () => {
    const prompt = getRandomPrompt();
    expect(prompt.id).toBeTruthy();
    expect(prompt.text).toBeTruthy();
    expect(prompt.category).toBeTruthy();
  });
});

describe("getPromptById", () => {
  it("returns the correct prompt", () => {
    const prompt = getPromptById("pn_difficult_decision");
    expect(prompt).toBeDefined();
    expect(prompt!.category).toBe("personal_narrative");
  });

  it("returns undefined for unknown ID", () => {
    expect(getPromptById("nonexistent")).toBeUndefined();
  });
});
