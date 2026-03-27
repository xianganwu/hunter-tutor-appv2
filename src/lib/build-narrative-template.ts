import type { ParentData } from "@/lib/parent-data";

/**
 * Build a deterministic, parent-friendly weekly narrative from aggregated data.
 *
 * Pure function — no side effects, no network calls.
 * Used as instant fallback before an optional AI-polished version loads.
 *
 * Structure: (1) activity summary, (2) what's going well, (3) gentle focus suggestion.
 */
export function buildNarrativeTemplate(data: ParentData): string {
  const { activeDaysThisWeek, weeklyMinutes, domainReadiness, mistakePatterns } =
    data;

  if (activeDaysThisWeek === 0 && weeklyMinutes === 0) {
    return "No practice sessions this week yet. Even 15 minutes a day can make a real difference — try starting with a quick drill!";
  }

  const activitySentence = buildActivitySentence(
    activeDaysThisWeek,
    weeklyMinutes,
    data,
  );
  const trendSentence = buildTrendSentence(domainReadiness);
  const focusSentence = buildFocusSentence(domainReadiness, mistakePatterns);

  return [activitySentence, trendSentence, focusSentence]
    .filter(Boolean)
    .join(" ");
}

// ─── Activity Sentence ──────────────────────────────────────────────

function buildActivitySentence(
  days: number,
  minutes: number,
  data: ParentData,
): string {
  const subjects = deriveSubjects(data);
  const dayWord = days === 1 ? "day" : "days";

  if (subjects.length === 0) {
    return `This week, your child practiced ${days} ${dayWord} and spent ${minutes} minutes studying.`;
  }

  const subjectList = formatList(subjects);
  return `This week, your child practiced ${days} ${dayWord} and spent ${minutes} minutes on ${subjectList}.`;
}

// ─── Trend Sentence ─────────────────────────────────────────────────

function buildTrendSentence(
  domains: readonly ParentData["domainReadiness"][number][],
): string {
  const improving = domains.filter((d) => d.trend === "improving");
  const declining = domains.filter((d) => d.trend === "declining");

  if (improving.length > 0) {
    const skill = pickBestSkillMention(improving);
    if (skill) {
      return `They're showing steady improvement in ${skill}.`;
    }
    const domainNames = improving.map((d) => shortDomainName(d.domainName));
    return `They're showing steady improvement in ${formatList(domainNames)}.`;
  }

  if (declining.length === domains.length && domains.length > 0) {
    return "This was a lighter week — getting back to regular practice will help rebuild momentum.";
  }

  // All stable or mixed
  if (domains.length > 0) {
    return "They're maintaining a solid foundation across their subjects.";
  }

  return "";
}

// ─── Focus Sentence ─────────────────────────────────────────────────

function buildFocusSentence(
  domains: readonly ParentData["domainReadiness"][number][],
  mistakePatterns: readonly { skillName: string; count: number }[],
): string {
  // Find weak skills across all domains
  const allWeakSkills = domains.flatMap((d) => d.weakSkills);

  if (allWeakSkills.length > 0) {
    return `Consider focusing more on ${allWeakSkills[0]} next week.`;
  }

  if (mistakePatterns.length > 0) {
    return `Reviewing ${mistakePatterns[0].skillName} could help solidify their understanding.`;
  }

  return "Keep up the great work!";
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Derive which subjects were practiced from session log and domain readiness.
 */
function deriveSubjects(data: ParentData): string[] {
  const sessionTypes = new Set(data.sessionLog.map((s) => s.type));
  const subjects: string[] = [];

  // Map session types to human-readable subject names
  const hasMathActivity = data.domainReadiness.some(
    (d) =>
      (d.domainName.toLowerCase().includes("quantitative") ||
        d.domainName.toLowerCase().includes("math achievement")) &&
      d.mastery > 0,
  );

  if (
    sessionTypes.has("tutoring") ||
    sessionTypes.has("simulation") ||
    hasMathActivity
  ) {
    // Check if there's reading-specific activity
    const hasReadingActivity =
      sessionTypes.has("reading") ||
      data.domainReadiness.some(
        (d) =>
          d.domainName.toLowerCase().includes("reading") && d.mastery > 0,
      );

    if (hasReadingActivity) subjects.push("reading");
    if (hasMathActivity) subjects.push("math");
  } else {
    if (sessionTypes.has("reading")) subjects.push("reading");
    if (sessionTypes.has("writing")) subjects.push("writing");
  }

  return subjects;
}

/** Pick the most specific skill to mention from improving domains. */
function pickBestSkillMention(
  improvingDomains: readonly ParentData["domainReadiness"][number][],
): string | null {
  for (const domain of improvingDomains) {
    if (domain.strongSkills.length > 0) {
      return domain.strongSkills[0];
    }
  }
  return null;
}

/** Shorten domain names for natural-sounding sentences. */
function shortDomainName(domainName: string): string {
  const lower = domainName.toLowerCase();
  if (lower.includes("reading")) return "reading";
  if (lower.includes("quantitative")) return "quantitative reasoning";
  if (lower.includes("math achievement")) return "math";
  return domainName;
}

/** Format a list with commas and "and". */
function formatList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// ─── API Payload Builder ────────────────────────────────────────────

export interface NarrativeApiPayload {
  readonly type: "generate_narrative";
  readonly activeDays: number;
  readonly weeklyMinutes: number;
  readonly weeklyTarget: number;
  readonly subjects: readonly string[];
  readonly improvingSkills: readonly string[];
  readonly weakSkills: readonly string[];
  readonly topMistake: string | null;
  readonly readingLevel: number | null;
  readonly simPercentile: number | null;
}

/**
 * Extract the API payload from ParentData for the generate_narrative endpoint.
 */
export function buildNarrativePayload(data: ParentData): NarrativeApiPayload {
  const improving = data.domainReadiness.filter((d) => d.trend === "improving");
  const improvingSkills = improving.flatMap((d) => d.strongSkills).slice(0, 20);
  const weakSkills = data.domainReadiness.flatMap((d) => d.weakSkills).slice(0, 20);

  return {
    type: "generate_narrative",
    activeDays: data.activeDaysThisWeek,
    weeklyMinutes: data.weeklyMinutes,
    weeklyTarget: data.weeklyTarget,
    subjects: deriveSubjects(data),
    improvingSkills,
    weakSkills,
    topMistake: data.mistakePatterns.length > 0 ? data.mistakePatterns[0].skillName : null,
    readingLevel: data.readingLevel,
    simPercentile: data.latestSimPercentile,
  };
}
