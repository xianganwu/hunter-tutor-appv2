import type { EssayFeedback } from "@/lib/ai/tutor-agent";

// ─── Essay Prompts ───────────────────────────────────────────────────

export interface EssayPrompt {
  readonly id: string;
  readonly text: string;
  readonly category: "persuasive" | "expository";
  readonly level?: "foundations" | "hunter_prep";
}

// ─── Workshop Phases ─────────────────────────────────────────────────

export type WorkshopPhase =
  | "prompt"
  | "brainstorm"
  | "writing"
  | "submitting"
  | "feedback"
  | "revising"
  | "resubmitting"
  | "revision_feedback"
  | "complete";

export type BrainstormStep = "reaction" | "ideas" | "pick" | "done";

// ─── Brainstorm State ────────────────────────────────────────────────

export interface BrainstormMessage {
  readonly id: string;
  readonly role: "tutor" | "user";
  readonly content: string;
}

export interface BrainstormState {
  readonly step: BrainstormStep;
  readonly messages: readonly BrainstormMessage[];
  readonly reaction: string;
  readonly ideas: string;
  readonly choice: string;
}

// ─── Feedback State ──────────────────────────────────────────────────

export type FeedbackStage = 1 | 2 | 3;

export interface RewriteState {
  readonly originalIntro: string;
  readonly suggestion: string;
  readonly rewrittenIntro: string;
  readonly feedback: string | null;
}

// ─── Stored Essays ───────────────────────────────────────────────────

export interface StoredEssay {
  readonly id: string;
  readonly promptText: string;
  readonly essayText: string;
  readonly wordCount: number;
  readonly feedback: EssayFeedback;
  readonly createdAt: string; // ISO
  readonly revisionOf: string | null;
  readonly revisionNumber: number;
}

// ─── API ─────────────────────────────────────────────────────────────

export type WritingAction =
  | {
      type: "brainstorm";
      promptText: string;
      step: BrainstormStep;
      studentResponse: string;
    }
  | {
      type: "evaluate_essay";
      promptText: string;
      essayText: string;
    }
  | {
      type: "rewrite_feedback";
      originalIntro: string;
      rewrittenIntro: string;
      suggestion: string;
    }
  | {
      type: "evaluate_revision";
      promptText: string;
      originalEssayText: string;
      revisedEssayText: string;
      originalFeedback: string;
      originalSubmissionId: string;
      revisionNumber: number;
    };

export interface WritingApiResponse {
  readonly text: string;
  readonly feedback?: EssayFeedback;
  readonly scoreComparison?: readonly {
    category: string;
    before: number;
    after: number;
  }[];
  readonly submissionId?: string;
}
