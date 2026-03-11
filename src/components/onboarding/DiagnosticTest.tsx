"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDiagnostic } from "@/hooks/useDiagnostic";
import { getStoredAuthUser } from "@/lib/user-profile";
import { DOMAIN_LABELS, type DiagnosticDomain } from "@/lib/diagnostic";
import { Mascot } from "@/components/shared/Mascot";
import { MathText } from "@/components/chat/MathText";
import { getRandomQuestionPhrase } from "@/lib/loading-phrases";

export function DiagnosticTest() {
  const router = useRouter();
  const { state, startDiagnostic, submitAnswer } = useDiagnostic();

  useEffect(() => {
    const authUser = getStoredAuthUser();
    if (authUser?.onboardingComplete) {
      router.replace("/dashboard");
    }
  }, [router]);

  if (state.phase === "intro") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 text-center animate-fade-in">
          <div className="flex justify-center">
            <Mascot tier={1} size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Let&apos;s Find Your Level!
          </h1>
          <div className="text-left text-sm text-surface-600 dark:text-surface-400 space-y-2 mx-auto max-w-xs">
            <p className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">-</span>
              <span>15 multiple choice questions</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">-</span>
              <span>Reading, Math Reasoning, and Math Skills</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">-</span>
              <span>No timer — work at your own pace</span>
            </p>
          </div>

          {state.error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
              {state.error}
            </div>
          )}

          <button
            onClick={startDiagnostic}
            className="w-full rounded-2xl bg-brand-600 py-3.5 text-lg font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
          >
            Begin
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {getRandomQuestionPhrase()}
        </p>
      </div>
    );
  }

  if (state.phase === "active") {
    const question = state.questions[state.currentIndex];
    if (!question) return null;

    const total = state.questions.length;
    const progress = ((state.currentIndex) / total) * 100;

    return (
      <div className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg space-y-6 animate-fade-in">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
              <span>
                Question {state.currentIndex + 1} of {total}
              </span>
              <DomainChip domain={question.domain} />
            </div>
            <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="rounded-2xl bg-surface-0 p-5 shadow-card dark:bg-surface-900">
            <p className="text-sm font-medium text-surface-900 dark:text-surface-100 leading-relaxed">
              <MathText text={question.questionText} />
            </p>
          </div>

          {/* Answer choices */}
          <div className="space-y-2">
            {question.answerChoices.map((choice) => (
              <button
                key={choice.letter}
                onClick={() => submitAnswer(choice.letter)}
                className="w-full text-left rounded-xl border border-surface-200 bg-surface-0 px-4 py-3 text-sm text-surface-700 transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-300 dark:hover:border-brand-500 dark:hover:bg-brand-600/10"
              >
                <span className="font-medium mr-2">{choice.letter}.</span>
                <MathText text={choice.text} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "computing") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Calculating your results...
        </p>
      </div>
    );
  }

  // Results phase
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Mascot tier={3} size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            You&apos;re All Set!
          </h1>
          <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">
            Here&apos;s where you&apos;re starting. Your tutor will adjust to match your level.
          </p>
        </div>

        {/* Domain bars */}
        <div className="space-y-4">
          {state.results.map((result) => (
            <DomainResultBar key={result.domain} result={result} />
          ))}
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-2xl bg-brand-600 py-3.5 text-lg font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function DomainChip({ domain }: { readonly domain: DiagnosticDomain }) {
  const colors: Record<DiagnosticDomain, string> = {
    reading_comprehension:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    math_quantitative_reasoning:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    math_achievement:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[domain]}`}
    >
      {DOMAIN_LABELS[domain]}
    </span>
  );
}

function DomainResultBar({
  result,
}: {
  readonly result: { domain: DiagnosticDomain; correct: number; total: number; mastery: number };
}) {
  const pct = Math.round(result.mastery * 100);
  const barColor =
    pct >= 80
      ? "bg-success-500"
      : pct >= 60
        ? "bg-streak-500"
        : pct >= 40
          ? "bg-brand-500"
          : "bg-red-500";

  return (
    <div className="rounded-2xl bg-surface-0 p-4 shadow-card dark:bg-surface-900">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
          {DOMAIN_LABELS[result.domain]}
        </span>
        <span className="text-sm font-bold text-surface-700 dark:text-surface-300">
          {result.correct}/{result.total} ({pct}%)
        </span>
      </div>
      <div className="h-3 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
