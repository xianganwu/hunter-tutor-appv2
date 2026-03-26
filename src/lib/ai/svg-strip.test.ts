import { describe, it, expect } from "vitest";
import { stripSvgBlocks, restoreSvgBlocks } from "./tutor-agent";

describe("stripSvgBlocks", () => {
  it("returns text unchanged when no SVGs present", () => {
    const input = "QUESTION: What is 2+2?\nA) 3\nB) 4\nC) 5\nD) 6\nE) 7\nCORRECT: B";
    const { cleaned, svgs } = stripSvgBlocks(input);
    expect(cleaned).toBe(input);
    expect(svgs).toHaveLength(0);
  });

  it("strips a single SVG block and replaces with placeholder", () => {
    const svg = '<svg width="300" height="200"><rect x="10" y="10" width="50" height="80" fill="blue"/></svg>';
    const input = `QUESTION: Look at this chart:\n${svg}\nWhat is the value?\nA) 10\nB) 20\nCORRECT: A`;
    const { cleaned, svgs } = stripSvgBlocks(input);

    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toBe(svg);
    expect(cleaned).toContain("__SVG_0__");
    expect(cleaned).not.toContain("<svg");
    expect(cleaned).not.toContain("</svg>");
  });

  it("strips multiple SVG blocks", () => {
    const svg1 = '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
    const svg2 = '<svg width="200" height="150"><rect x="0" y="0" width="200" height="150"/></svg>';
    const input = `First: ${svg1}\nSecond: ${svg2}\nEnd.`;
    const { cleaned, svgs } = stripSvgBlocks(input);

    expect(svgs).toHaveLength(2);
    expect(svgs[0]).toBe(svg1);
    expect(svgs[1]).toBe(svg2);
    expect(cleaned).toContain("__SVG_0__");
    expect(cleaned).toContain("__SVG_1__");
    expect(cleaned).not.toContain("<svg");
  });

  it("prevents SVG content with A) B) patterns from interfering with choice regex", () => {
    const svg = '<svg width="300" height="200"><text x="20" y="30">A) Pepperoni</text><text x="20" y="60">B) Cheese</text></svg>';
    const input = `QUESTION: Look at the chart:\n${svg}\nWhich topping is most popular?\nA) Pepperoni\nB) Cheese\nC) Sausage\nD) Mushroom\nE) Onion\nCORRECT: A`;

    const { cleaned } = stripSvgBlocks(input);

    // The choice regex should only find real choices, not SVG text
    const choices = cleaned.match(/[A-E]\)\s*.+/g);
    expect(choices).toHaveLength(5); // NOT 7 (which would happen without stripping)
    expect(choices![0]).toContain("Pepperoni");
    expect(choices![1]).toContain("Cheese");
    expect(choices![2]).toContain("Sausage");
    expect(choices![3]).toContain("Mushroom");
    expect(choices![4]).toContain("Onion");
  });

  it("handles SVG with complex attributes containing parentheses", () => {
    const svg = '<svg viewBox="0 0 300 200"><g id="barA)" transform="translate(10,0)"><rect width="30" height="100"/></g></svg>';
    const input = `QUESTION: Read the graph:\n${svg}\nA) 10\nB) 20\nCORRECT: A`;
    const { cleaned } = stripSvgBlocks(input);

    const choices = cleaned.match(/[A-E]\)\s*.+/g);
    expect(choices).toHaveLength(2); // Only real choices, not SVG id="barA)"
  });
});

describe("restoreSvgBlocks", () => {
  it("re-inserts SVG blocks at placeholder positions", () => {
    const svg = '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
    const cleaned = "Before __SVG_0__ After";
    const result = restoreSvgBlocks(cleaned, [svg]);
    expect(result).toBe(`Before ${svg} After`);
  });

  it("handles multiple SVGs", () => {
    const svg1 = '<svg><rect/></svg>';
    const svg2 = '<svg><circle/></svg>';
    const cleaned = "__SVG_0__ middle __SVG_1__";
    const result = restoreSvgBlocks(cleaned, [svg1, svg2]);
    expect(result).toBe(`${svg1} middle ${svg2}`);
  });

  it("returns text unchanged when no placeholders", () => {
    const text = "No placeholders here";
    expect(restoreSvgBlocks(text, [])).toBe(text);
  });
});
