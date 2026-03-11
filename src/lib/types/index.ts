export type Subject = "math" | "reading" | "writing";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export type TutoringState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "streaming"; content: string }
  | { status: "error"; error: string };

// Curriculum taxonomy types

export type SkillLevel = "foundations" | "hunter_prep";

export interface Skill {
  skill_id: string;
  name: string;
  description: string;
  level: SkillLevel;
  prerequisite_skills: readonly string[];
  difficulty_tier: DifficultyLevel;
  example_teaching_prompts: readonly string[];
}

export interface SkillCategory {
  category_id: string;
  name: string;
  skills: readonly Skill[];
}

export interface Domain {
  domain_id: string;
  name: string;
  description: string;
  skill_categories: readonly SkillCategory[];
}

export interface CurriculumTaxonomy {
  version: string;
  exam: string;
  target_grade_range: string;
  levels: {
    foundations: string;
    hunter_prep: string;
  };
  domains: readonly Domain[];
}

// Teaching script types

export interface WorkedExample {
  problem: string;
  thinking_out_loud: readonly string[];
  solution: string;
}

export interface Misconception {
  misconception: string;
  why_it_happens: string;
  how_to_address: string;
}

export type PracticeType = "guided" | "supported" | "independent";

export interface PracticeQuestion {
  question_number: number;
  type: PracticeType;
  question: string;
  hints: readonly string[];
  answer: string;
  explanation: string;
}

export interface TeachingScript {
  skill_id: string;
  skill_name: string;
  concept_explanation: string;
  worked_examples: readonly WorkedExample[];
  common_misconceptions: readonly Misconception[];
  scaffolded_practice: readonly PracticeQuestion[];
  real_world_connection: string;
  transition_cues: readonly string[];
}

// Passage curation types

export type PassageGenre =
  | "fiction"
  | "nonfiction"
  | "poetry"
  | "historical_document"
  | "science_article";

export type AnswerLetter = "A" | "B" | "C" | "D" | "E";

export interface AnswerChoice {
  readonly letter: AnswerLetter;
  readonly text: string;
}

export interface DistractorExplanation {
  readonly letter: AnswerLetter;
  readonly explanation: string;
}

export interface PassageQuestion {
  readonly question_number: number;
  readonly question_text: string;
  readonly answer_choices: readonly AnswerChoice[];
  readonly correct_answer: AnswerLetter;
  readonly correct_answer_explanation: string;
  readonly distractor_explanations: readonly DistractorExplanation[];
  readonly skill_tested: string;
}

export interface PassageMetadata {
  readonly passage_id: string;
  readonly title: string;
  readonly genre: PassageGenre;
  readonly difficulty_level: DifficultyLevel;
  readonly word_count: number;
  readonly tagged_skills: readonly string[];
  readonly source_description: string;
  readonly lexile_range?: string;
  readonly themes?: readonly string[];
}

export interface Passage {
  readonly metadata: PassageMetadata;
  readonly pre_reading_context: string;
  readonly passage_text: string;
  readonly questions: readonly PassageQuestion[];
}
