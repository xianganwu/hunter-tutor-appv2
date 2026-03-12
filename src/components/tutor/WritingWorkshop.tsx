"use client";

import { useState, useCallback, useEffect } from "react";
import type { EssayFeedback } from "@/lib/ai/tutor-agent";
import type {
  WorkshopPhase,
  StoredEssay,
  WritingApiResponse,
  EssayPrompt,
} from "./writing-types";
import { getRandomPrompt } from "./writing-prompts";
import { BrainstormChat } from "./BrainstormChat";
import { EssayEditor, countWords } from "./EssayEditor";
import { CountdownTimer } from "./CountdownTimer";
import { StagedFeedback } from "./StagedFeedback";
import { EssayHistory } from "./EssayHistory";
import { RevisionFeedback } from "./RevisionFeedback";
import { autoCompleteDailyTask } from "@/lib/daily-plan";
import { checkAndAwardBadges, buildBadgeContext } from "@/lib/achievements";
import { NextTaskPrompt } from "@/components/shared/NextTaskPrompt";
import { DailyPlanProgress } from "@/components/shared/DailyPlanProgress";

const ESSAY_DURATION_MINUTES = 40;

async function fetchEssays(): Promise<StoredEssay[]> {
  try {
    const res = await fetch("/api/writing");
    if (!res.ok) return [];
    const data = (await res.json()) as { essays?: StoredEssay[] };
    return data.essays ?? [];
  } catch {
    return [];
  }
}

export function WritingWorkshop() {
  const [phase, setPhase] = useState<WorkshopPhase>("prompt");
  const [prompt, setPrompt] = useState<EssayPrompt>(getRandomPrompt);
  const [essayText, setEssayText] = useState("");
  const [writingStartTime, setWritingStartTime] = useState(0);
  const [feedback, setFeedback] = useState<EssayFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedEssays, setSavedEssays] = useState<StoredEssay[]>([]);
  const [originalFeedback, setOriginalFeedback] = useState<EssayFeedback | null>(null);
  const [revisedFeedback, setRevisedFeedback] = useState<EssayFeedback | null>(null);
  const [revisionNumber, setRevisionNumber] = useState(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Load saved essays on mount
  useEffect(() => {
    void fetchEssays().then(setSavedEssays);
  }, []);

  const startBrainstorm = useCallback(() => {
    setPhase("brainstorm");
  }, []);

  const startWriting = useCallback(() => {
    setWritingStartTime(Date.now());
    setPhase("writing");
  }, []);

  const handleTimeUp = useCallback(() => {
    if (essayText.trim()) {
      void submitEssay();
    }
  }, [essayText]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitEssay = useCallback(async () => {
    if (!essayText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setPhase("submitting");

    try {
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "evaluate_essay",
          promptText: prompt.text,
          essayText,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as WritingApiResponse;
        if (data.feedback) {
          setFeedback(data.feedback);
          if (data.submissionId) setSubmissionId(data.submissionId);
          // Auto-complete daily plan + badge check
          autoCompleteDailyTask(undefined, "writing");
          const ctx = buildBadgeContext({ essaysWritten: savedEssays.length + 1 });
          checkAndAwardBadges(ctx);
          // Reload essays from server (DB save happens in background on the server)
          void fetchEssays().then(setSavedEssays);
        }
      } else {
        // Fallback feedback
        setFeedback({
          overallFeedback: "Great effort! Keep writing to improve your skills.",
          scores: { organization: 5, clarity: 5, evidence: 5, grammar: 5 },
          strengths: ["You completed the essay — that's the most important step!"],
          improvements: ["Try to add more specific examples from your own experience."],
        });
      }
    } catch {
      setFeedback({
        overallFeedback: "Great effort! Keep writing to improve your skills.",
        scores: { organization: 5, clarity: 5, evidence: 5, grammar: 5 },
        strengths: ["You completed the essay — that's the most important step!"],
        improvements: ["Try to add more specific examples from your own experience."],
      });
    }

    setIsSubmitting(false);
    setPhase("feedback");
  }, [essayText, isSubmitting, prompt.text, savedEssays.length]);

  const handleFeedbackComplete = useCallback(() => {
    setPhase("complete");
  }, []);

  const handleRevise = useCallback(() => {
    if (!feedback || revisionNumber >= 2) return;
    setOriginalFeedback(feedback);
    setRevisionNumber((n) => n + 1);
    setPhase("revising");
  }, [feedback, revisionNumber]);

  const submitRevision = useCallback(async () => {
    if (!essayText.trim() || isSubmitting || !originalFeedback) return;
    setIsSubmitting(true);
    setPhase("resubmitting");

    try {
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "evaluate_revision",
          promptText: prompt.text,
          originalEssayText: essayText,
          revisedEssayText: essayText,
          originalFeedback: JSON.stringify(originalFeedback),
          originalSubmissionId: submissionId ?? "",
          revisionNumber,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as WritingApiResponse;
        if (data.feedback) {
          setRevisedFeedback(data.feedback);
          setFeedback(data.feedback);

          // Check if score improved for badge
          const origAvg =
            (originalFeedback.scores.organization +
              originalFeedback.scores.clarity +
              originalFeedback.scores.evidence +
              originalFeedback.scores.grammar) /
            4;
          const newAvg =
            (data.feedback.scores.organization +
              data.feedback.scores.clarity +
              data.feedback.scores.evidence +
              data.feedback.scores.grammar) /
            4;
          if (newAvg > origAvg) {
            const ctx = buildBadgeContext({ revisionImproved: true });
            checkAndAwardBadges(ctx);
          }

          void fetchEssays().then(setSavedEssays);
        }
      }
    } catch {
      // Fallback
    }

    setIsSubmitting(false);
    setPhase("revision_feedback");
  }, [essayText, isSubmitting, originalFeedback, prompt.text, submissionId, revisionNumber]);

  const startNewSession = useCallback(() => {
    setPrompt(getRandomPrompt());
    setEssayText("");
    setFeedback(null);
    setOriginalFeedback(null);
    setRevisedFeedback(null);
    setRevisionNumber(0);
    setSubmissionId(null);
    setPhase("prompt");
  }, []);

  // History view
  if (showHistory) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 bg-surface-50 dark:bg-surface-950 min-h-screen">
        <EssayHistory
          essays={savedEssays}
          onClose={() => setShowHistory(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-2xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M13 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <div>
            <h1 className="text-sm font-semibold">Writing Workshop</h1>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {phase === "prompt" && "Choose your prompt"}
              {phase === "brainstorm" && "Brainstorming"}
              {phase === "writing" && "Write your essay"}
              {phase === "submitting" && "Evaluating..."}
              {phase === "feedback" && "Review feedback"}
              {phase === "revising" && "Revise your essay"}
              {phase === "resubmitting" && "Re-evaluating..."}
              {phase === "revision_feedback" && "Revision feedback"}
              {phase === "complete" && "Session complete"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DailyPlanProgress />
          {phase === "writing" && (
            <CountdownTimer
              durationMinutes={ESSAY_DURATION_MINUTES}
              startTime={writingStartTime}
              onTimeUp={handleTimeUp}
              stopped={phase !== "writing"}
            />
          )}
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            History ({savedEssays.length})
          </button>
        </div>
      </header>

      {/* Prompt phase */}
      {phase === "prompt" && (
        <div className="flex-1 flex items-center justify-center px-4 animate-fade-in">
          <div className="max-w-md text-center space-y-6">
            <div className="rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 p-6 border border-surface-200 dark:border-surface-800">
              <div className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-3">
                Essay Prompt
              </div>
              <p className="text-surface-800 dark:text-surface-200 leading-relaxed">
                {prompt.text}
              </p>
            </div>
            <div className="text-xs text-surface-500 space-y-1">
              <p>You&apos;ll have {ESSAY_DURATION_MINUTES} minutes to write.</p>
              <p>First, let&apos;s brainstorm to plan your essay.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={startBrainstorm}
                className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Start Brainstorming
              </button>
              {savedEssays.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="rounded-xl bg-surface-100 dark:bg-surface-800 px-6 py-3 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                >
                  View Previous Essays ({savedEssays.length})
                </button>
              )}
              <button
                onClick={() => {
                  setPrompt(getRandomPrompt());
                }}
                className="text-xs text-surface-500 hover:text-surface-700 transition-colors"
              >
                Get a different prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brainstorm phase */}
      {phase === "brainstorm" && (
        <BrainstormChat
          promptText={prompt.text}
          onComplete={startWriting}
        />
      )}

      {/* Writing phase */}
      {phase === "writing" && (
        <div className="flex-1 flex flex-col animate-fade-in">
          <div className="px-4 py-2 bg-brand-50 dark:bg-brand-600/10 border-b border-brand-100 dark:border-brand-800">
            <p className="text-xs text-brand-700 dark:text-brand-300">
              <strong>Prompt:</strong> {prompt.text}
            </p>
          </div>
          <div className="flex-1 px-4 py-3">
            <div className="h-full rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden flex flex-col shadow-card">
              <EssayEditor
                value={essayText}
                onChange={setEssayText}
                disabled={false}
              />
            </div>
          </div>
          <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800">
            <button
              onClick={() => void submitEssay()}
              disabled={countWords(essayText) < 50}
              className="w-full rounded-xl bg-success-500 px-4 py-3 text-sm font-semibold text-white hover:bg-success-600 disabled:opacity-50 disabled:hover:bg-success-500 transition-colors"
            >
              {countWords(essayText) < 50
                ? `Write at least 50 words to submit (${countWords(essayText)} so far)`
                : "Submit Essay"}
            </button>
          </div>
        </div>
      )}

      {/* Submitting phase */}
      {phase === "submitting" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 animate-fade-in">
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Your tutor is reading your essay...
            </p>
          </div>
        </div>
      )}

      {/* Feedback phase */}
      {phase === "feedback" && feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <StagedFeedback
            feedback={feedback}
            essayText={essayText}
            onComplete={handleFeedbackComplete}
            onRevise={revisionNumber < 2 ? handleRevise : undefined}
          />
        </div>
      )}

      {/* Revising phase */}
      {phase === "revising" && (
        <div className="flex-1 flex flex-col animate-fade-in">
          <div className="px-4 py-2 bg-brand-50 dark:bg-brand-600/10 border-b border-brand-100 dark:border-brand-800">
            <p className="text-xs text-brand-700 dark:text-brand-300">
              <strong>Revision {revisionNumber}:</strong> Improve your essay based on the feedback.
            </p>
          </div>
          {originalFeedback && (
            <div className="px-4 py-2 bg-streak-50 dark:bg-streak-600/10 border-b border-streak-100 dark:border-streak-800">
              <details className="text-xs text-streak-700 dark:text-streak-300">
                <summary className="cursor-pointer font-medium">View feedback</summary>
                <p className="mt-1">{originalFeedback.overallFeedback}</p>
              </details>
            </div>
          )}
          <div className="flex-1 px-4 py-3">
            <div className="h-full rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden flex flex-col shadow-card">
              <EssayEditor
                value={essayText}
                onChange={setEssayText}
                disabled={false}
              />
            </div>
          </div>
          <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800">
            <button
              onClick={() => void submitRevision()}
              disabled={countWords(essayText) < 50}
              className="w-full rounded-xl bg-success-500 px-4 py-3 text-sm font-semibold text-white hover:bg-success-600 disabled:opacity-50 disabled:hover:bg-success-500 transition-colors"
            >
              Submit Revision
            </button>
          </div>
        </div>
      )}

      {/* Resubmitting phase */}
      {phase === "resubmitting" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 animate-fade-in">
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Evaluating your revision...
            </p>
          </div>
        </div>
      )}

      {/* Revision Feedback phase */}
      {phase === "revision_feedback" && originalFeedback && revisedFeedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <RevisionFeedback
            originalFeedback={originalFeedback}
            revisedFeedback={revisedFeedback}
            narrative={revisedFeedback.overallFeedback}
          />
          <div className="flex gap-3 mt-4">
            {revisionNumber < 2 && (
              <button
                onClick={handleRevise}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Revise Again
              </button>
            )}
            <button
              onClick={handleFeedbackComplete}
              className="flex-1 rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              Finish
            </button>
          </div>
        </div>
      )}

      {/* Complete phase */}
      {phase === "complete" && (
        <div className="flex-1 flex items-center justify-center px-4 animate-fade-in">
          <div className="max-w-md text-center space-y-6">
            <h3 className="text-xl font-semibold">Great work!</h3>
            <p className="text-surface-600 dark:text-surface-400">
              You&apos;ve completed a writing session. Every essay you write builds your skills for the Hunter exam.
            </p>
            <div className="flex flex-col gap-3">
              <NextTaskPrompt />
              <button
                onClick={startNewSession}
                className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-6 py-3 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
              >
                Write Another Essay
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
              >
                View Essay History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
