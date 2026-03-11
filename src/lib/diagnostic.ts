import { getSkillIdsForDomain } from "@/lib/exam/curriculum";

// ─── Diagnostic Skill IDs ────────────────────────────────────────────

export const DIAGNOSTIC_SKILLS = {
  reading_comprehension: [
    "rc_main_idea",
    "rc_supporting_details",
    "rc_vocab_context",
    "rc_inference",
    "rc_author_purpose",
  ],
  math_quantitative_reasoning: [
    "mqr_place_value",
    "mqr_number_sense",
    "mqr_estimation",
    "mqr_word_problem_translation",
    "mqr_pattern_recognition",
  ],
  math_achievement: [
    "ma_multiply_divide",
    "ma_fraction_basics",
    "ma_angles_shapes",
    "ma_data_reading",
    "ma_order_of_operations",
  ],
} as const;

export type DiagnosticDomain = keyof typeof DIAGNOSTIC_SKILLS;

export const DIAGNOSTIC_DOMAINS: DiagnosticDomain[] = [
  "reading_comprehension",
  "math_quantitative_reasoning",
  "math_achievement",
];

export const DOMAIN_LABELS: Record<DiagnosticDomain, string> = {
  reading_comprehension: "Reading",
  math_quantitative_reasoning: "Math Reasoning",
  math_achievement: "Math Skills",
};

// ─── Types ───────────────────────────────────────────────────────────

export interface DiagnosticQuestion {
  readonly skillId: string;
  readonly domain: DiagnosticDomain;
  readonly questionText: string;
  readonly answerChoices: readonly { letter: string; text: string }[];
  readonly correctAnswer: string;
}

export interface DiagnosticResult {
  readonly domain: DiagnosticDomain;
  readonly correct: number;
  readonly total: number;
  readonly mastery: number; // 0.0 - 1.0
}

export interface DiagnosticAnswer {
  readonly skillId: string;
  readonly domain: DiagnosticDomain;
  readonly selectedAnswer: string;
  readonly correctAnswer: string;
  readonly isCorrect: boolean;
}

// ─── Computation ─────────────────────────────────────────────────────

/**
 * Group answers by domain and compute per-domain mastery.
 */
export function computeDiagnosticResults(
  answers: readonly DiagnosticAnswer[]
): DiagnosticResult[] {
  return DIAGNOSTIC_DOMAINS.map((domain) => {
    const domainAnswers = answers.filter((a) => a.domain === domain);
    const correct = domainAnswers.filter((a) => a.isCorrect).length;
    const total = domainAnswers.length;
    const mastery = total > 0 ? correct / total : 0;

    return { domain, correct, total, mastery };
  });
}

/**
 * For each domain, get ALL skill IDs in that domain and set them to the
 * domain's diagnostic mastery level. Returns flat array of { skillId, mastery }.
 */
export function buildInitialMasteries(
  results: readonly DiagnosticResult[]
): { skillId: string; mastery: number }[] {
  const entries: { skillId: string; mastery: number }[] = [];

  for (const result of results) {
    // Get all skills in this domain, not just the diagnostic ones
    const allDomainSkills = getSkillIdsForDomain(result.domain);
    for (const skillId of allDomainSkills) {
      entries.push({ skillId, mastery: result.mastery });
    }
  }

  return entries;
}
