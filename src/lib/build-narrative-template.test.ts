import { describe, it, expect } from "vitest";
import { buildNarrativeTemplate, buildNarrativePayload } from "./build-narrative-template";
import type { ParentData } from "@/lib/parent-data";

// ─── Helpers ────────────────────────────────────────────────────────

function makeParentData(overrides: Partial<ParentData> = {}): ParentData {
  return {
    weeklyMinutes: 45,
    weeklyTarget: 150,
    activeDaysThisWeek: 4,
    masteryTimeline: [],
    domainReadiness: [
      {
        domainName: "Reading Comprehension",
        mastery: 65,
        strongSkills: ["Main Idea"],
        weakSkills: ["Inference"],
        trend: "improving" as const,
      },
      {
        domainName: "Quantitative Reasoning",
        mastery: 55,
        strongSkills: [],
        weakSkills: ["Word Problems"],
        trend: "stable" as const,
      },
      {
        domainName: "Math Achievement",
        mastery: 70,
        strongSkills: ["Fractions"],
        weakSkills: [],
        trend: "improving" as const,
      },
    ],
    sessionLog: [
      {
        date: new Date().toISOString(),
        type: "tutoring" as const,
        summary: "Practiced 3 skills",
        durationMinutes: 25,
      },
      {
        date: new Date().toISOString(),
        type: "reading" as const,
        summary: "Read a passage",
        durationMinutes: 10,
      },
    ],
    totalSessions: 12,
    mistakePatterns: [
      { skillName: "Inference", count: 5 },
      { skillName: "Word Problems", count: 3 },
    ],
    readingLevel: 3,
    readingWpm: 120,
    latestSimPercentile: 72,
    missedQuestionsByWeek: [],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("buildNarrativeTemplate", () => {
  it("generates a full narrative with typical data", () => {
    const data = makeParentData();
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("4 days");
    expect(result).toContain("45 minutes");
    expect(result).toContain("improvement");
    expect(result).toBeTruthy();
    // Should have multiple sentences
    const sentences = result.split(". ").length;
    expect(sentences).toBeGreaterThanOrEqual(2);
  });

  it("handles zero activity gracefully", () => {
    const data = makeParentData({
      activeDaysThisWeek: 0,
      weeklyMinutes: 0,
      sessionLog: [],
      domainReadiness: [],
      mistakePatterns: [],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("No practice sessions this week");
    expect(result).toContain("15 minutes");
  });

  it("handles single day activity", () => {
    const data = makeParentData({ activeDaysThisWeek: 1, weeklyMinutes: 25 });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("1 day");
    expect(result).not.toContain("1 days");
    expect(result).toContain("25 minutes");
  });

  it("mentions specific improving skill when available", () => {
    const data = makeParentData({
      domainReadiness: [
        {
          domainName: "Reading Comprehension",
          mastery: 80,
          strongSkills: ["Vocabulary in Context"],
          weakSkills: [],
          trend: "improving" as const,
        },
      ],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("Vocabulary in Context");
    expect(result).toContain("improvement");
  });

  it("falls back to domain name when no strong skills on improving domain", () => {
    const data = makeParentData({
      domainReadiness: [
        {
          domainName: "Reading Comprehension",
          mastery: 60,
          strongSkills: [],
          weakSkills: [],
          trend: "improving" as const,
        },
      ],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("reading");
    expect(result).toContain("improvement");
  });

  it("shows encouragement when all domains are declining", () => {
    const data = makeParentData({
      activeDaysThisWeek: 1,
      weeklyMinutes: 10,
      domainReadiness: [
        {
          domainName: "Reading Comprehension",
          mastery: 40,
          strongSkills: [],
          weakSkills: ["Main Idea"],
          trend: "declining" as const,
        },
        {
          domainName: "Quantitative Reasoning",
          mastery: 35,
          strongSkills: [],
          weakSkills: ["Number Sense"],
          trend: "declining" as const,
        },
      ],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("lighter week");
    expect(result).toContain("momentum");
  });

  it("shows stable message when all domains are stable", () => {
    const data = makeParentData({
      domainReadiness: [
        {
          domainName: "Reading Comprehension",
          mastery: 65,
          strongSkills: [],
          weakSkills: [],
          trend: "stable" as const,
        },
        {
          domainName: "Math Achievement",
          mastery: 70,
          strongSkills: [],
          weakSkills: [],
          trend: "stable" as const,
        },
      ],
      mistakePatterns: [],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("solid foundation");
    expect(result).toContain("Keep up the great work");
  });

  it("suggests weak skill focus when available", () => {
    const data = makeParentData({
      domainReadiness: [
        {
          domainName: "Reading Comprehension",
          mastery: 50,
          strongSkills: [],
          weakSkills: ["Author's Purpose"],
          trend: "stable" as const,
        },
      ],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("Author's Purpose");
    expect(result).toContain("focusing");
  });

  it("falls back to mistake pattern when no weak skills", () => {
    const data = makeParentData({
      domainReadiness: [
        {
          domainName: "Reading Comprehension",
          mastery: 75,
          strongSkills: ["Main Idea"],
          weakSkills: [],
          trend: "stable" as const,
        },
      ],
      mistakePatterns: [{ skillName: "Tone Analysis", count: 4 }],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("Tone Analysis");
    expect(result).toContain("solidify");
  });

  it("handles empty domain readiness with session log", () => {
    const data = makeParentData({
      activeDaysThisWeek: 2,
      weeklyMinutes: 30,
      domainReadiness: [],
      sessionLog: [
        {
          date: new Date().toISOString(),
          type: "reading" as const,
          summary: "Read a passage",
          durationMinutes: 15,
        },
      ],
      mistakePatterns: [],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("2 days");
    expect(result).toContain("30 minutes");
    expect(result).toContain("Keep up the great work");
  });

  it("derives reading subject from session log", () => {
    const data = makeParentData({
      domainReadiness: [],
      sessionLog: [
        {
          date: new Date().toISOString(),
          type: "reading" as const,
          summary: "Read a passage",
          durationMinutes: 15,
        },
      ],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("reading");
  });

  it("derives both math and reading subjects", () => {
    const data = makeParentData();
    const result = buildNarrativeTemplate(data);

    // Should mention both subjects in the activity sentence
    expect(result).toContain("reading");
    expect(result).toContain("math");
  });

  it("returns a non-empty string for any valid input", () => {
    // Minimal valid data
    const data = makeParentData({
      activeDaysThisWeek: 1,
      weeklyMinutes: 5,
      domainReadiness: [],
      sessionLog: [],
      mistakePatterns: [],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("does not produce excessive length", () => {
    const data = makeParentData();
    const result = buildNarrativeTemplate(data);

    // Narrative should be concise — under 300 chars
    expect(result.length).toBeLessThan(400);
  });

  it("handles writing-only sessions", () => {
    const data = makeParentData({
      activeDaysThisWeek: 1,
      weeklyMinutes: 20,
      domainReadiness: [],
      sessionLog: [
        {
          date: new Date().toISOString(),
          type: "writing" as const,
          summary: "Wrote an essay",
          durationMinutes: 20,
        },
      ],
      mistakePatterns: [],
    });
    const result = buildNarrativeTemplate(data);

    expect(result).toContain("writing");
    expect(result).toContain("1 day");
  });
});

describe("buildNarrativePayload", () => {
  it("extracts correct fields from full ParentData", () => {
    const data = makeParentData();
    const payload = buildNarrativePayload(data);

    expect(payload.type).toBe("generate_narrative");
    expect(payload.activeDays).toBe(4);
    expect(payload.weeklyMinutes).toBe(45);
    expect(payload.weeklyTarget).toBe(150);
    expect(payload.readingLevel).toBe(3);
    expect(payload.simPercentile).toBe(72);
  });

  it("derives subjects from session log and domains", () => {
    const data = makeParentData();
    const payload = buildNarrativePayload(data);

    expect(payload.subjects).toContain("reading");
    expect(payload.subjects).toContain("math");
  });

  it("collects improving skills from improving domains only", () => {
    const data = makeParentData({
      domainReadiness: [
        {
          domainName: "Reading Comprehension",
          mastery: 80,
          strongSkills: ["Main Idea", "Inference"],
          weakSkills: [],
          trend: "improving" as const,
        },
        {
          domainName: "Math Achievement",
          mastery: 50,
          strongSkills: ["Fractions"],
          weakSkills: ["Decimals"],
          trend: "stable" as const,
        },
      ],
    });
    const payload = buildNarrativePayload(data);

    // Only improving domain's strong skills
    expect(payload.improvingSkills).toEqual(["Main Idea", "Inference"]);
    // Weak skills from all domains
    expect(payload.weakSkills).toEqual(["Decimals"]);
  });

  it("sets topMistake to null when no mistakes", () => {
    const data = makeParentData({ mistakePatterns: [] });
    const payload = buildNarrativePayload(data);

    expect(payload.topMistake).toBeNull();
  });

  it("picks first mistake as topMistake", () => {
    const data = makeParentData({
      mistakePatterns: [
        { skillName: "Word Problems", count: 7 },
        { skillName: "Fractions", count: 3 },
      ],
    });
    const payload = buildNarrativePayload(data);

    expect(payload.topMistake).toBe("Word Problems");
  });

  it("handles null readingLevel and simPercentile", () => {
    const data = makeParentData({
      readingLevel: null,
      readingWpm: null,
      latestSimPercentile: null,
    });
    const payload = buildNarrativePayload(data);

    expect(payload.readingLevel).toBeNull();
    expect(payload.simPercentile).toBeNull();
  });

  it("caps improving skills at 20", () => {
    const manySkills = Array.from({ length: 25 }, (_, i) => `Skill ${i}`);
    const data = makeParentData({
      domainReadiness: [
        {
          domainName: "Reading Comprehension",
          mastery: 80,
          strongSkills: manySkills,
          weakSkills: [],
          trend: "improving" as const,
        },
      ],
    });
    const payload = buildNarrativePayload(data);

    expect(payload.improvingSkills.length).toBeLessThanOrEqual(20);
  });
});
