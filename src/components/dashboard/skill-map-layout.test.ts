import { describe, it, expect } from "vitest";
import { computeSkillLayout, getMasteryFill, getMasteryLabel, getMasteryIcon } from "./skill-map-layout";
import { curriculum } from "@/lib/exam/curriculum";
import { getMockStudentStates } from "./mock-data";
import type { SerializedSkillState } from "./types";

describe("computeSkillLayout", () => {
  const states = getMockStudentStates();
  const stateMap = new Map<string, SerializedSkillState>(
    states.map((s) => [s.skillId, s])
  );
  const layout = computeSkillLayout(curriculum, stateMap);

  it("produces a node for every skill in the curriculum", () => {
    let totalSkills = 0;
    for (const domain of curriculum.domains) {
      for (const cat of domain.skill_categories) {
        totalSkills += cat.skills.length;
      }
    }
    expect(layout.nodes).toHaveLength(totalSkills);
  });

  it("produces edges for all prerequisite relationships", () => {
    let totalEdges = 0;
    for (const domain of curriculum.domains) {
      for (const cat of domain.skill_categories) {
        for (const skill of cat.skills) {
          totalEdges += skill.prerequisite_skills.length;
        }
      }
    }
    expect(layout.edges).toHaveLength(totalEdges);
  });

  it("assigns unique positions to each node", () => {
    const positions = layout.nodes.map((n) => `${n.x},${n.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("all nodes have positive coordinates", () => {
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });

  it("edges connect valid node pairs", () => {
    const nodeIds = new Set(layout.nodes.map((n) => n.skillId));
    for (const edge of layout.edges) {
      expect(nodeIds.has(edge.fromId)).toBe(true);
      expect(nodeIds.has(edge.toId)).toBe(true);
    }
  });

  it("width and height are positive", () => {
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it("nodes have mastery from state map", () => {
    const mainIdea = layout.nodes.find((n) => n.skillId === "rc_main_idea");
    expect(mainIdea).toBeDefined();
    expect(mainIdea!.mastery).toBe(0.85);
  });
});

describe("mastery helpers", () => {
  it("getMasteryFill returns correct colors", () => {
    expect(getMasteryFill(0.8)).toBe("#22C55E");
    expect(getMasteryFill(0.5)).toBe("#EAB308");
    expect(getMasteryFill(0.2)).toBe("#EF4444");
  });

  it("getMasteryLabel returns correct labels", () => {
    expect(getMasteryLabel(0.8)).toBe("Mastered");
    expect(getMasteryLabel(0.5)).toBe("In Progress");
    expect(getMasteryLabel(0.2)).toBe("Needs Practice");
  });

  it("getMasteryIcon returns correct icons", () => {
    expect(getMasteryIcon(0.8)).toBe("✓");
    expect(getMasteryIcon(0.5)).toBe("–");
    expect(getMasteryIcon(0.2)).toBe("!");
  });

  it("boundary values are classified correctly", () => {
    // > 0.7 is green
    expect(getMasteryFill(0.71)).toBe("#22C55E");
    expect(getMasteryFill(0.7)).toBe("#EAB308"); // exactly 0.7 is yellow
    // >= 0.4 is yellow
    expect(getMasteryFill(0.4)).toBe("#EAB308");
    expect(getMasteryFill(0.39)).toBe("#EF4444");
  });
});
