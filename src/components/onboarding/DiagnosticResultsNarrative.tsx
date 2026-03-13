"use client";

import { useRouter } from "next/navigation";
import { Mascot } from "@/components/shared/Mascot";
import { getStoredAuthUser, getStoredMascotType } from "@/lib/user-profile";
import { getSkillById } from "@/lib/exam/curriculum";
import {
  DOMAIN_LABELS,
  DIAGNOSTIC_SKILLS,
  type DiagnosticAnswer,
  type DiagnosticResult,
  type DiagnosticDomain,
} from "@/lib/diagnostic";

interface DiagnosticResultsNarrativeProps {
  readonly answers: readonly DiagnosticAnswer[];
  readonly results: readonly DiagnosticResult[];
}

// ─── Narrative Logic (pure) ─────────────────────────────────────────

interface NarrativeData {
  studentName: string;
  strongestDomain: DiagnosticResult;
  weakestDomain: DiagnosticResult;
  strongSkillNames: string[];
  growthSkillNames: string[];
  allCorrect: boolean;
  firstSessionRoute: string;
}

function buildNarrative(
  answers: readonly DiagnosticAnswer[],
  results: readonly DiagnosticResult[]
): NarrativeData {
  const authUser = getStoredAuthUser();
  const studentName = authUser?.name ?? "there";

  // Sort by mastery to find strongest/weakest
  const sorted = [...results].sort((a, b) => b.mastery - a.mastery);
  const strongestDomain = sorted[0];
  const weakestDomain = sorted[sorted.length - 1];

  const allCorrect = answers.every((a) => a.isCorrect);

  // Skills answered correctly in strongest domain
  const strongDomainAnswers = answers.filter(
    (a) => a.domain === strongestDomain.domain && a.isCorrect
  );
  const strongSkillNames = strongDomainAnswers
    .map((a) => getSkillById(a.skillId)?.name)
    .filter((n): n is string => n !== undefined);

  // Skills answered incorrectly in weakest domain (growth areas)
  const weakDomainAnswers = answers.filter(
    (a) => a.domain === weakestDomain.domain && !a.isCorrect
  );
  const growthSkillNames = weakDomainAnswers
    .map((a) => getSkillById(a.skillId)?.name)
    .filter((n): n is string => n !== undefined);

  // Pick first session skill: a correctly-answered skill from strongest domain
  const firstSessionSkill = strongDomainAnswers[0]?.skillId
    ?? DIAGNOSTIC_SKILLS[strongestDomain.domain][0];

  const subject = strongestDomain.domain === "reading_comprehension" ? "reading" : "math";
  const firstSessionRoute = `/tutor/${subject}?skill=${firstSessionSkill}&firstSession=1`;

  return {
    studentName,
    strongestDomain,
    weakestDomain,
    strongSkillNames,
    growthSkillNames,
    allCorrect,
    firstSessionRoute,
  };
}

function buildNarrativeText(data: NarrativeData): string {
  const { strongestDomain, weakestDomain, strongSkillNames, growthSkillNames, allCorrect } = data;

  if (allCorrect) {
    return "Wow, you got every single question right! You clearly have a strong foundation across all areas. Let's jump in and challenge you with some next-level problems!";
  }

  const parts: string[] = [];

  if (strongSkillNames.length > 0) {
    const skillList = strongSkillNames.slice(0, 3).join(" and ");
    parts.push(
      `You showed strong skills in **${DOMAIN_LABELS[strongestDomain.domain]}** — especially **${skillList}**.`
    );
  } else {
    parts.push(
      `You made a solid effort across **${DOMAIN_LABELS[strongestDomain.domain]}**!`
    );
  }

  if (growthSkillNames.length > 0 && weakestDomain.domain !== strongestDomain.domain) {
    parts.push(
      `In **${DOMAIN_LABELS[weakestDomain.domain]}**, **${growthSkillNames[0]}** is a great area to start building.`
    );
  }

  parts.push("Your tutor will personalize everything from here.");

  return parts.join(" ");
}

// ─── Sub-components ─────────────────────────────────────────────────

function DomainResultBar({
  result,
}: {
  readonly result: DiagnosticResult;
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

function SkillCallouts({ answers, domain }: { readonly answers: readonly DiagnosticAnswer[]; readonly domain: DiagnosticDomain }) {
  const domainAnswers = answers.filter((a) => a.domain === domain);
  if (domainAnswers.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
        {DOMAIN_LABELS[domain]}
      </p>
      {domainAnswers.map((a) => {
        const skillName = getSkillById(a.skillId)?.name ?? a.skillId;
        return (
          <div key={a.skillId} className="flex items-center gap-2 text-sm">
            {a.isCorrect ? (
              <svg className="h-4 w-4 text-success-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-amber-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span className={a.isCorrect ? "text-surface-700 dark:text-surface-300" : "text-surface-500 dark:text-surface-400"}>
              {skillName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Narrative Text with bold rendering ─────────────────────────────

function NarrativeText({ text }: { readonly text: string }) {
  // Split on **bold** markers and render
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <span key={i} className="font-semibold text-surface-900 dark:text-surface-100">
              {part.slice(2, -2)}
            </span>
          );
        }
        return part;
      })}
    </p>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function DiagnosticResultsNarrative({ answers, results }: DiagnosticResultsNarrativeProps) {
  const router = useRouter();
  const mascotType = getStoredMascotType();
  const data = buildNarrative(answers, results);
  const narrativeText = buildNarrativeText(data);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Header with mascot */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Mascot tier={3} size="lg" mascotType={mascotType} />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Great job, {data.studentName}!
          </h1>
        </div>

        {/* Personalized narrative */}
        <div className="rounded-2xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 p-4">
          <NarrativeText text={narrativeText} />
        </div>

        {/* Domain result bars */}
        <div className="space-y-3">
          {results.map((result) => (
            <DomainResultBar key={result.domain} result={result} />
          ))}
        </div>

        {/* Skill-level callouts */}
        <div className="rounded-2xl bg-surface-0 dark:bg-surface-900 p-4 shadow-card space-y-4">
          {results.map((result) => (
            <SkillCallouts key={result.domain} answers={answers} domain={result.domain} />
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            onClick={() => router.push(data.firstSessionRoute)}
            className="w-full rounded-2xl bg-brand-600 py-3.5 text-lg font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
          >
            Try Your First Lesson
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full text-center text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 transition-colors py-2"
          >
            Skip to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
