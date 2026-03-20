import type {
  SerializedSkillState,
  DomainProgress,
  StreakData,
  WeeklySummaryData,
} from "./types";
import type { ConfidenceTrend } from "@/lib/adaptive";
import { getSkillIdsForDomain } from "@/lib/exam/curriculum";

function makeSkill(
  skillId: string,
  mastery: number,
  attempts: number,
  correctRatio: number,
  daysAgo: number | null,
  trend: ConfidenceTrend = "stable"
): SerializedSkillState {
  const now = new Date();
  return {
    skillId,
    masteryLevel: mastery,
    attemptsCount: attempts,
    correctCount: Math.round(attempts * correctRatio),
    lastPracticed:
      daysAgo !== null
        ? new Date(now.getTime() - daysAgo * 86400000).toISOString()
        : null,
    confidenceTrend: trend,
  };
}

export function getMockStudentStates(): SerializedSkillState[] {
  return [
    // Reading Comprehension — varied mastery
    makeSkill("rc_main_idea", 0.85, 20, 0.85, 1, "stable"),
    makeSkill("rc_evidence_reasoning", 0.72, 15, 0.73, 2, "improving"),
    makeSkill("rc_inference", 0.55, 12, 0.58, 3, "stable"),
    makeSkill("rc_vocab_context", 0.68, 18, 0.67, 1, "improving"),
    makeSkill("rc_drawing_conclusions", 0.42, 8, 0.5, 5, "declining"),
    makeSkill("rc_author_purpose", 0.6, 10, 0.6, 4, "stable"),
    makeSkill("rc_tone_mood", 0.35, 6, 0.33, 7, "declining"),
    makeSkill("rc_figurative_language", 0.48, 10, 0.5, 3, "stable"),
    makeSkill("rc_passage_structure", 0.3, 5, 0.4, 10, "declining"),
    makeSkill("rc_comparing_viewpoints", 0.15, 3, 0.33, 14, "stable"),

    // Math Quantitative Reasoning
    makeSkill("mqr_quant_comparisons", 0.78, 22, 0.77, 1, "stable"),
    makeSkill("mqr_estimation", 0.65, 14, 0.64, 2, "improving"),
    makeSkill("mqr_number_sense", 0.9, 25, 0.88, 1, "stable"),
    makeSkill("mqr_word_problem_translation", 0.52, 10, 0.5, 3, "stable"),
    makeSkill("mqr_pattern_recognition", 0.45, 8, 0.5, 6, "declining"),
    makeSkill("mqr_logical_reasoning", 0.25, 4, 0.25, 8, "stable"),

    // Math Achievement
    makeSkill("ma_fraction_decimal_ops", 0.82, 20, 0.8, 1, "stable"),
    makeSkill("ma_percent_problems", 0.58, 12, 0.58, 2, "improving"),
    makeSkill("ma_ratios_proportions", 0.55, 10, 0.5, 4, "stable"),
    makeSkill("ma_probability_statistics", 0.7, 16, 0.69, 2, "stable"),
    makeSkill("ma_data_interpretation", 0.38, 8, 0.38, 6, "declining"),
    makeSkill("ma_area_perimeter_volume", 0.75, 18, 0.72, 1, "improving"),
    makeSkill("ma_coordinate_geometry", 0.32, 5, 0.4, 9, "stable"),
    makeSkill("ma_algebraic_expressions", 0.62, 14, 0.64, 2, "improving"),
    makeSkill("ma_multistep_word_problems", 0.2, 5, 0.2, 12, "declining"),

    // Writing
    makeSkill("w_sentence_structure", 0.8, 18, 0.78, 1, "stable"),
    makeSkill("w_grammar_mechanics", 0.65, 14, 0.64, 2, "improving"),
    makeSkill("w_paragraph_writing", 0.72, 16, 0.69, 1, "stable"),
    makeSkill("w_personal_narrative", 0.55, 10, 0.5, 3, "stable"),
    makeSkill("w_opinion_writing", 0.48, 8, 0.5, 4, "declining"),
    makeSkill("w_word_choice", 0.6, 12, 0.58, 2, "improving"),
    makeSkill("w_essay_structure", 0.35, 6, 0.33, 6, "stable"),
    makeSkill("w_persuasive_writing", 0.28, 5, 0.4, 8, "stable"),
    makeSkill("w_expository_writing", 0.22, 4, 0.25, 10, "declining"),
    makeSkill("w_evidence_integration", 0.15, 3, 0.33, 12, "stable"),
    makeSkill("w_revision_editing", 0.4, 7, 0.43, 5, "improving"),
  ];
}

export function getMockDomainProgress(): DomainProgress[] {
  const states = getMockStudentStates();
  const stateMap = new Map(states.map((s) => [s.skillId, s]));

  const domains = [
    { id: "reading_comprehension", name: "Reading Comprehension" },
    { id: "math_quantitative_reasoning", name: "Math: Quantitative Reasoning" },
    { id: "math_achievement", name: "Math: Achievement" },
    { id: "writing", name: "Writing" },
  ];

  return domains.map((d) => {
    const skillIds = getSkillIdsForDomain(d.id);
    const masteries = skillIds.map(
      (id) => stateMap.get(id)?.masteryLevel ?? 0
    );
    return {
      domainId: d.id,
      domainName: d.name,
      overallMastery:
        masteries.reduce((a, b) => a + b, 0) / masteries.length,
      skillCount: skillIds.length,
      masteredCount: masteries.filter((m) => m > 0.7).length,
      inProgressCount: masteries.filter((m) => m >= 0.4 && m <= 0.7).length,
      needsWorkCount: masteries.filter((m) => m < 0.4).length,
    };
  });
}

export function getMockStreakData(): StreakData {
  const now = new Date();
  const dates: string[] = [];
  // Practiced 5 of last 7 days, with a gap on days 5 and 6
  const practiced = [true, true, true, true, true, false, false, true, true, false, true, false, false, true];
  for (let i = 0; i < 14; i++) {
    if (practiced[i]) {
      dates.push(
        new Date(now.getTime() - i * 86400000).toISOString().split("T")[0]
      );
    }
  }
  return {
    currentStreak: 5,
    longestStreak: 7,
    practicedDates: dates,
  };
}

export function getMockWeeklySummary(): WeeklySummaryData {
  return {
    skillsImproved: [
      { skillId: "rc_evidence_reasoning", skillName: "Evidence-Based Reasoning", delta: 0.12 },
      { skillId: "mqr_estimation", skillName: "Estimation Strategies", delta: 0.08 },
      { skillId: "ma_algebraic_expressions", skillName: "Algebraic Expressions", delta: 0.1 },
    ],
    totalMinutesPracticed: 148,
    sessionsCompleted: 6,
    areasToFocus: [
      { skillId: "rc_passage_structure", skillName: "Passage Structure Analysis", reason: "Not practiced in 10 days" },
      { skillId: "rc_tone_mood", skillName: "Tone and Mood", reason: "Confidence declining" },
      { skillId: "ma_multistep_word_problems", skillName: "Multi-Step Word Problems", reason: "Prerequisite for advanced skills" },
    ],
  };
}
