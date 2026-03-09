import { describe, it, expect } from "vitest";
import { detectFrustration } from "./useTutoringSession";

describe("detectFrustration", () => {
  it("detects 'I don't get it'", () => {
    expect(detectFrustration("I don't get it")).toBe(true);
    expect(detectFrustration("I dont understand")).toBe(true);
  });

  it("detects 'too hard'", () => {
    expect(detectFrustration("This is too hard")).toBe(true);
    expect(detectFrustration("too hard for me")).toBe(true);
  });

  it("detects giving up", () => {
    expect(detectFrustration("I give up")).toBe(true);
    expect(detectFrustration("i want to quit")).toBe(true);
    expect(detectFrustration("i want to stop")).toBe(true);
  });

  it("detects self-deprecation", () => {
    expect(detectFrustration("I'm stupid")).toBe(true);
    expect(detectFrustration("im dumb")).toBe(true);
    expect(detectFrustration("I'm bad at math")).toBe(true);
  });

  it("detects anxiety", () => {
    expect(detectFrustration("I'm scared")).toBe(true);
    expect(detectFrustration("I'm so nervous")).toBe(true);
    expect(detectFrustration("What if I fail")).toBe(true);
    expect(detectFrustration("I'm anxious")).toBe(true);
  });

  it("detects disengagement", () => {
    expect(detectFrustration("idk")).toBe(true);
    expect(detectFrustration("whatever")).toBe(true);
  });

  it("detects hatred of subject", () => {
    expect(detectFrustration("I hate this")).toBe(true);
    expect(detectFrustration("I hate math")).toBe(true);
    expect(detectFrustration("I can't do this")).toBe(true);
  });

  it("does NOT flag normal responses", () => {
    expect(detectFrustration("I think the answer is B")).toBe(false);
    expect(detectFrustration("I got it!")).toBe(false);
    expect(detectFrustration("Can you explain that again?")).toBe(false);
    expect(detectFrustration("The main idea is about dogs")).toBe(false);
    expect(detectFrustration("B")).toBe(false);
  });

  it("does NOT flag positive statements with similar words", () => {
    expect(detectFrustration("I understand now")).toBe(false);
    expect(detectFrustration("That wasn't hard at all")).toBe(false);
    expect(detectFrustration("I'm getting better at this")).toBe(false);
  });

  it("handles empty and whitespace input", () => {
    expect(detectFrustration("")).toBe(false);
    expect(detectFrustration("   ")).toBe(false);
  });
});
