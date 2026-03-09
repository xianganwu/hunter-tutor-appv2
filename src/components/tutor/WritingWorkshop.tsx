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

import { getStorageKey } from "@/lib/user-profile";

const STORAGE_KEY = "hunter-tutor-essays";
const ESSAY_DURATION_MINUTES = 40;

function loadEssays(): StoredEssay[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
  if (!data) return [];
  try {
    return JSON.parse(data) as StoredEssay[];
  } catch {
    return [];
  }
}

function saveEssay(essay: StoredEssay): void {
  const essays = loadEssays();
  essays.push(essay);
  localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(essays));
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

  // Load saved essays on mount
  useEffect(() => {
    setSavedEssays(loadEssays());
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

          // Save essay
          const storedEssay: StoredEssay = {
            id: Math.random().toString(36).slice(2, 10),
            promptText: prompt.text,
            essayText,
            wordCount: countWords(essayText),
            feedback: data.feedback,
            createdAt: new Date().toISOString(),
          };
          saveEssay(storedEssay);
          setSavedEssays(loadEssays());
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
  }, [essayText, isSubmitting, prompt.text]);

  const handleFeedbackComplete = useCallback(() => {
    setPhase("complete");
  }, []);

  const startNewSession = useCallback(() => {
    setPrompt(getRandomPrompt());
    setEssayText("");
    setFeedback(null);
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
              {phase === "complete" && "Session complete"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          />
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
            <div className="flex flex-col gap-2">
              <button
                onClick={startNewSession}
                className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Write Another Essay
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="rounded-xl bg-surface-100 dark:bg-surface-800 px-6 py-3 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
              >
                View Essay History
              </button>
              <a
                href="/dashboard"
                className="text-sm text-surface-500 hover:text-surface-700 transition-colors"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
