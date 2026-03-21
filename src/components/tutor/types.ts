import type { DifficultyLevel } from "@/lib/types";
import type { GeneratedQuestion, ConversationMessage } from "@/lib/ai/tutor-agent";

// ─── Chat Display Types ──────────────────────────────────────────────

export type MessageType =
  | "teaching"
  | "question"
  | "feedback"
  | "hint"
  | "text"
  | "summary"
  | "teach_back_prompt"
  | "teach_back_eval";

export interface ChatMessageDisplay {
  readonly id: string;
  readonly role: "user" | "tutor";
  readonly content: string;
  readonly type: MessageType;
  readonly timestamp: number; // epoch ms
  readonly choices?: readonly string[];
}

// ─── Session State ───────────────────────────────────────────────────

export interface SessionState {
  readonly phase: "initializing" | "ready" | "loading" | "complete";
  readonly messages: readonly ChatMessageDisplay[];
  readonly activeQuestion: GeneratedQuestion | null;
  readonly currentSkillId: string;
  readonly mastery: number;
  readonly difficultyTier: DifficultyLevel;
  readonly questionCount: number;
  readonly correctCount: number;
  readonly correctStreak: number;
  readonly skillsCovered: readonly string[];
  readonly startTime: number; // epoch ms
  readonly estimatedQuestions: number;
}

// ─── API Request/Response ────────────────────────────────────────────

export type ChatAction =
  | {
      type: "teach";
      skillId: string;
      mastery: number;
    }
  | {
      type: "generate_question";
      skillId: string;
      difficultyTier: DifficultyLevel;
    }
  | {
      type: "evaluate_answer";
      questionText: string;
      studentAnswer: string;
      correctAnswer: string;
      history?: ConversationMessage[];
      sessionId?: string;
      skillId?: string;
      timeSpentSeconds?: number;
      hintUsed?: boolean;
    }
  | {
      type: "get_hint";
      context: string;
      history?: ConversationMessage[];
    }
  | {
      type: "explain_more";
      skillId: string;
      mastery: number;
      context: string;
    }
  | {
      type: "get_summary";
      questionsAnswered: number;
      correctCount: number;
      skillsCovered: readonly string[];
      elapsedMinutes: number;
    }
  | {
      type: "evaluate_teach_back";
      skillId: string;
      skillName: string;
      studentExplanation: string;
    }
  | {
      type: "emotional_response";
      message: string;
      history?: ConversationMessage[];
    }
  | {
      type: "generate_drill_batch";
      skillId: string;
      count?: number;
      difficultyTier?: DifficultyLevel;
    }
  | {
      type: "generate_mixed_drill_batch";
      skills: Array<{ skillId: string; tier: DifficultyLevel }>;
      totalCount: number;
    }
  | {
      type: "generate_diagnostic";
      domain: string;
      skillIds: readonly string[];
    };

export interface ChatApiResponse {
  readonly text: string;
  readonly question?: GeneratedQuestion;
  readonly isCorrect?: boolean;
  readonly teachBackEvaluation?: {
    readonly completeness: "complete" | "partial" | "missing_key_concepts";
    readonly accuracy: "accurate" | "minor_errors" | "misconception";
    readonly feedback: string;
    readonly missingConcepts: readonly string[];
  };
}

// ─── Level-Up Event ──────────────────────────────────────────────────

export interface LevelUpEvent {
  readonly skillName: string;
  readonly newTier: DifficultyLevel;
  readonly newTierLabel: string;
}

// ─── Progress Diff ───────────────────────────────────────────────────

export interface SkillProgressDiff {
  readonly skillName: string;
  readonly masteryBefore: number; // 0-1
  readonly masteryAfter: number; // 0-1
  readonly tierBefore: DifficultyLevel;
  readonly tierAfter: DifficultyLevel;
  readonly tierLabelAfter: string;
}

// ─── Session Summary ─────────────────────────────────────────────────

export interface SessionSummaryData {
  readonly questionsAnswered: number;
  readonly correctCount: number;
  readonly accuracy: number;
  readonly skillsCovered: readonly string[];
  readonly elapsedMinutes: number;
  readonly tutorMessage: string;
  readonly nextSkill?: {
    readonly skillId: string;
    readonly skillName: string;
    readonly route: string;
  };
  readonly progressDiff?: SkillProgressDiff;
}
