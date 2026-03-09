import type { SkillNodeLayout, SkillEdgeLayout, SerializedSkillState } from "./types";
import type { CurriculumTaxonomy } from "@/lib/types";

const DOMAIN_CONFIGS = [
  { id: "reading_comprehension", label: "Reading" },
  { id: "math_quantitative_reasoning", label: "Math Reasoning" },
  { id: "math_achievement", label: "Math Achievement" },
] as const;

interface LayoutConfig {
  readonly columnWidth: number;
  readonly rowHeight: number;
  readonly nodeRadius: number;
  readonly paddingX: number;
  readonly paddingY: number;
  readonly labelOffset: number;
}

const DESKTOP_CONFIG: LayoutConfig = {
  columnWidth: 360,
  rowHeight: 130,
  nodeRadius: 22,
  paddingX: 50,
  paddingY: 60,
  labelOffset: 32,
};

/**
 * Compute (x, y) positions for every skill node in the curriculum.
 * Layout: 3 columns (one per domain), rows by difficulty tier (1=top, 5=bottom).
 * Skills sharing a tier within a domain are spread horizontally.
 */
export function computeSkillLayout(
  taxonomy: CurriculumTaxonomy,
  states: ReadonlyMap<string, SerializedSkillState>,
  config: LayoutConfig = DESKTOP_CONFIG
): { nodes: SkillNodeLayout[]; edges: SkillEdgeLayout[]; width: number; height: number } {
  const nodes: SkillNodeLayout[] = [];
  const positionMap = new Map<string, { x: number; y: number }>();

  let maxTier = 1;

  for (let domainIdx = 0; domainIdx < DOMAIN_CONFIGS.length; domainIdx++) {
    const domainConfig = DOMAIN_CONFIGS[domainIdx];
    const domain = taxonomy.domains.find((d) => d.domain_id === domainConfig.id);
    if (!domain) continue;

    // Gather all skills and group by tier
    const tierGroups = new Map<number, { skillId: string; name: string }[]>();
    for (const cat of domain.skill_categories) {
      for (const skill of cat.skills) {
        const tier = skill.difficulty_tier;
        if (tier > maxTier) maxTier = tier;
        const group = tierGroups.get(tier) ?? [];
        group.push({ skillId: skill.skill_id, name: skill.name });
        tierGroups.set(tier, group);
      }
    }

    const columnCenterX =
      config.paddingX + domainIdx * config.columnWidth + config.columnWidth / 2;

    for (const [tier, skills] of Array.from(tierGroups.entries())) {
      const y = config.paddingY + (tier - 1) * config.rowHeight;
      const skillSpacing = 100;
      const totalWidth = (skills.length - 1) * skillSpacing;
      const startX = columnCenterX - totalWidth / 2;

      for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        const x = skills.length === 1 ? columnCenterX : startX + i * skillSpacing;
        const state = states.get(skill.skillId);

        positionMap.set(skill.skillId, { x, y });

        nodes.push({
          skillId: skill.skillId,
          name: skill.name,
          x,
          y,
          mastery: state?.masteryLevel ?? 0,
          attemptsCount: state?.attemptsCount ?? 0,
          confidenceTrend: state?.confidenceTrend ?? "stable",
          domainId: domainConfig.id,
        });
      }
    }
  }

  // Build edges from prerequisite relationships
  const edges: SkillEdgeLayout[] = [];
  for (const domain of taxonomy.domains) {
    for (const cat of domain.skill_categories) {
      for (const skill of cat.skills) {
        for (const prereqId of skill.prerequisite_skills) {
          const from = positionMap.get(prereqId);
          const to = positionMap.get(skill.skill_id);
          if (from && to) {
            edges.push({
              fromId: prereqId,
              toId: skill.skill_id,
              x1: from.x,
              y1: from.y,
              x2: to.x,
              y2: to.y,
            });
          }
        }
      }
    }
  }

  const width = config.paddingX * 2 + DOMAIN_CONFIGS.length * config.columnWidth;
  const height = config.paddingY * 2 + (maxTier - 1) * config.rowHeight;

  return { nodes, edges, width, height };
}

/** Get fill color for a mastery level */
export function getMasteryFill(mastery: number): string {
  if (mastery > 0.7) return "#22C55E";
  if (mastery >= 0.4) return "#EAB308";
  return "#EF4444";
}

/** Get status label for a mastery level */
export function getMasteryLabel(mastery: number): string {
  if (mastery > 0.7) return "Mastered";
  if (mastery >= 0.4) return "In Progress";
  return "Needs Practice";
}

/** Get status icon character for accessibility (not sole indicator of state) */
export function getMasteryIcon(mastery: number): string {
  if (mastery > 0.7) return "✓";
  if (mastery >= 0.4) return "–";
  return "!";
}

/**
 * Split a skill name into up to two lines for SVG rendering.
 * Tries to break at a natural separator (&, /, comma) near the middle,
 * falling back to a word boundary.
 */
export function wrapSkillName(name: string, maxLineChars = 18): string[] {
  if (name.length <= maxLineChars) return [name];

  // Try splitting at a natural separator near the middle
  const mid = Math.floor(name.length / 2);
  const separators = [" & ", ", ", " / "];
  let bestIdx = -1;
  let bestDist = Infinity;

  for (const sep of separators) {
    let idx = name.indexOf(sep);
    while (idx !== -1) {
      const dist = Math.abs(idx - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
      idx = name.indexOf(sep, idx + 1);
    }
  }

  if (bestIdx > 0) {
    return [name.slice(0, bestIdx).trim(), name.slice(bestIdx).trim()];
  }

  // Fallback: break at the last space before maxLineChars
  const spaceIdx = name.lastIndexOf(" ", maxLineChars);
  if (spaceIdx > 4) {
    return [name.slice(0, spaceIdx), name.slice(spaceIdx + 1)];
  }

  // Last resort: hard truncate
  return [name.slice(0, maxLineChars - 1) + "..."];
}

/** Domain labels for column headers */
export const DOMAIN_LABELS = DOMAIN_CONFIGS;
