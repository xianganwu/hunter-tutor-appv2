"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuthUser } from "@/lib/user-profile";
import { Mascot } from "@/components/shared/Mascot";

type Step = "welcome" | "features" | "how_it_works" | "level_check";
const STEPS: Step[] = ["welcome", "features", "how_it_works", "level_check"];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const authUser = getStoredAuthUser();

  useEffect(() => {
    if (authUser?.onboardingComplete) {
      router.replace("/dashboard");
    }
  }, [authUser, router]);

  const currentIndex = STEPS.indexOf(step);

  function goNext() {
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]);
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1]);
    }
  }

  const name = authUser?.name ?? "there";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        {step === "welcome" && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <Mascot tier={1} size="lg" />
            </div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
              Hi, {name}!
            </h1>
            <p className="text-lg text-surface-600 dark:text-surface-400">
              Welcome to Hunter Tutor! We&apos;re going to help you build the
              skills you need for the Hunter entrance exam.
            </p>
            <p className="text-base font-medium text-brand-600 dark:text-brand-400">
              Let&apos;s get started!
            </p>
          </div>
        )}

        {step === "features" && (
          <div className="space-y-6">
            <h2 className="text-center text-2xl font-bold text-surface-900 dark:text-surface-100">
              What You&apos;ll Get
            </h2>
            <div className="space-y-4">
              <FeatureCard
                icon="📋"
                title="Daily Practice Plan"
                description="A personalized plan each day with 3 tasks matched to your skill level."
              />
              <FeatureCard
                icon="🗺️"
                title="Skill Map"
                description="See all your skills at a glance. Watch them grow as you practice."
              />
              <FeatureCard
                icon="🏅"
                title="Badges & Rewards"
                description="Earn badges for streaks, mastery milestones, and more."
              />
            </div>
          </div>
        )}

        {step === "how_it_works" && (
          <div className="space-y-6">
            <h2 className="text-center text-2xl font-bold text-surface-900 dark:text-surface-100">
              How It Works
            </h2>
            <div className="space-y-4">
              <StepItem number={1} text="Your tutor teaches you a concept with examples." />
              <StepItem number={2} text="You practice with questions that match your level." />
              <StepItem number={3} text="You level up as you master each skill!" />
            </div>
            <p className="text-center text-sm text-surface-500 dark:text-surface-400">
              The tutor adapts to you — it gets harder as you improve and
              provides extra help when you need it.
            </p>
          </div>
        )}

        {step === "level_check" && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <Mascot tier={2} size="lg" />
            </div>
            <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
              Before We Begin...
            </h2>
            <p className="text-base text-surface-600 dark:text-surface-400">
              Let&apos;s find your starting level! You&apos;ll answer 15 quick questions
              across reading, math reasoning, and math skills.
            </p>
            <ul className="text-left text-sm text-surface-600 dark:text-surface-400 space-y-2 mx-auto max-w-xs">
              <li className="flex items-start gap-2">
                <span className="text-brand-500 font-bold mt-0.5">-</span>
                <span>No timer — take your time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-500 font-bold mt-0.5">-</span>
                <span>No grades — this just sets your starting point</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-500 font-bold mt-0.5">-</span>
                <span>5 questions per subject area</span>
              </li>
            </ul>
            <button
              onClick={() => router.push("/diagnostic")}
              className="w-full rounded-2xl bg-brand-600 py-3.5 text-lg font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
            >
              Find My Level
            </button>
          </div>
        )}

        {/* Navigation */}
        {step !== "level_check" && (
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={currentIndex === 0}
              className="rounded-xl px-4 py-2 text-sm font-medium text-surface-500 hover:text-surface-700 disabled:opacity-0 dark:text-surface-400 dark:hover:text-surface-300"
            >
              Back
            </button>
            <button
              onClick={goNext}
              className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div className="mt-6 flex justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === currentIndex
                  ? "bg-brand-600 dark:bg-brand-400"
                  : i < currentIndex
                    ? "bg-brand-300 dark:bg-brand-600"
                    : "bg-surface-300 dark:bg-surface-600"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-surface-0 p-4 shadow-card dark:bg-surface-900">
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function StepItem({
  number,
  text,
}: {
  readonly number: number;
  readonly text: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {number}
      </div>
      <p className="mt-1 text-sm text-surface-700 dark:text-surface-300">
        {text}
      </p>
    </div>
  );
}
