import type { TeachingScript } from "@/lib/types";

// Reading Comprehension
import rcMainIdea from "../../../content/teaching-scripts/reading-comprehension/rc_main_idea.json";
import rcEvidenceReasoning from "../../../content/teaching-scripts/reading-comprehension/rc_evidence_reasoning.json";
import rcInference from "../../../content/teaching-scripts/reading-comprehension/rc_inference.json";
import rcVocabContext from "../../../content/teaching-scripts/reading-comprehension/rc_vocab_context.json";
import rcDrawingConclusions from "../../../content/teaching-scripts/reading-comprehension/rc_drawing_conclusions.json";
import rcAuthorPurpose from "../../../content/teaching-scripts/reading-comprehension/rc_author_purpose.json";
import rcToneMood from "../../../content/teaching-scripts/reading-comprehension/rc_tone_mood.json";
import rcFigurativeLanguage from "../../../content/teaching-scripts/reading-comprehension/rc_figurative_language.json";
import rcPassageStructure from "../../../content/teaching-scripts/reading-comprehension/rc_passage_structure.json";
import rcComparingViewpoints from "../../../content/teaching-scripts/reading-comprehension/rc_comparing_viewpoints.json";

// Math: Quantitative Reasoning
import mqrQuantComparisons from "../../../content/teaching-scripts/math-quantitative-reasoning/mqr_quant_comparisons.json";
import mqrEstimation from "../../../content/teaching-scripts/math-quantitative-reasoning/mqr_estimation.json";
import mqrNumberSense from "../../../content/teaching-scripts/math-quantitative-reasoning/mqr_number_sense.json";
import mqrWordProblemTranslation from "../../../content/teaching-scripts/math-quantitative-reasoning/mqr_word_problem_translation.json";
import mqrPatternRecognition from "../../../content/teaching-scripts/math-quantitative-reasoning/mqr_pattern_recognition.json";
import mqrLogicalReasoning from "../../../content/teaching-scripts/math-quantitative-reasoning/mqr_logical_reasoning.json";

// Math: Achievement
import maFractionDecimalOps from "../../../content/teaching-scripts/math-achievement/ma_fraction_decimal_ops.json";
import maPercentProblems from "../../../content/teaching-scripts/math-achievement/ma_percent_problems.json";
import maRatiosProportions from "../../../content/teaching-scripts/math-achievement/ma_ratios_proportions.json";
import maProbabilityStatistics from "../../../content/teaching-scripts/math-achievement/ma_probability_statistics.json";
import maDataInterpretation from "../../../content/teaching-scripts/math-achievement/ma_data_interpretation.json";
import maAreaPerimeterVolume from "../../../content/teaching-scripts/math-achievement/ma_area_perimeter_volume.json";
import maCoordinateGeometry from "../../../content/teaching-scripts/math-achievement/ma_coordinate_geometry.json";
import maAlgebraicExpressions from "../../../content/teaching-scripts/math-achievement/ma_algebraic_expressions.json";
import maMultistepWordProblems from "../../../content/teaching-scripts/math-achievement/ma_multistep_word_problems.json";

const allScripts: Record<string, TeachingScript> = Object.fromEntries(
  ([
    rcMainIdea,
    rcEvidenceReasoning,
    rcInference,
    rcVocabContext,
    rcDrawingConclusions,
    rcAuthorPurpose,
    rcToneMood,
    rcFigurativeLanguage,
    rcPassageStructure,
    rcComparingViewpoints,
    mqrQuantComparisons,
    mqrEstimation,
    mqrNumberSense,
    mqrWordProblemTranslation,
    mqrPatternRecognition,
    mqrLogicalReasoning,
    maFractionDecimalOps,
    maPercentProblems,
    maRatiosProportions,
    maProbabilityStatistics,
    maDataInterpretation,
    maAreaPerimeterVolume,
    maCoordinateGeometry,
    maAlgebraicExpressions,
    maMultistepWordProblems,
  ] as unknown as TeachingScript[]).map((s) => [s.skill_id, s])
);

/** Get a teaching script by skill_id */
export function getTeachingScript(skillId: string): TeachingScript | undefined {
  return allScripts[skillId];
}

/** Get all teaching scripts */
export function getAllTeachingScripts(): ReadonlyMap<string, TeachingScript> {
  return new Map(Object.entries(allScripts));
}

/** Get all teaching script skill IDs */
export function getTeachingScriptIds(): string[] {
  return Object.keys(allScripts);
}
