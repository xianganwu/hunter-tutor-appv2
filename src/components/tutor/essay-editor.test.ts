import { describe, it, expect } from "vitest";
import { countWords } from "./EssayEditor";

describe("countWords", () => {
  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace only", () => {
    expect(countWords("   \n\t  ")).toBe(0);
  });

  it("counts words correctly", () => {
    expect(countWords("Hello world")).toBe(2);
    expect(countWords("One two three four five")).toBe(5);
  });

  it("handles multiple spaces", () => {
    expect(countWords("Hello   world")).toBe(2);
  });

  it("handles newlines", () => {
    expect(countWords("Hello\nworld")).toBe(2);
  });

  it("handles leading/trailing whitespace", () => {
    expect(countWords("  Hello world  ")).toBe(2);
  });

  it("counts a realistic essay", () => {
    const essay =
      "This is a short essay about why reading is important. Reading helps us learn new things and understand different perspectives. It also improves our vocabulary and writing skills.";
    expect(countWords(essay)).toBe(28);
  });
});
