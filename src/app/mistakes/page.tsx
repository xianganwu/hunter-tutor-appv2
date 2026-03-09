"use client";

import { useState } from "react";
import { MistakeJournal } from "@/components/tutor/MistakeJournal";
import { MistakeReview } from "@/components/tutor/MistakeReview";

export default function MistakesPage() {
  const [mode, setMode] = useState<"journal" | "review">("journal");

  return (
    <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <a
            href="/dashboard"
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M13 16l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <h1 className="text-xl font-bold">Mistake Journal</h1>
        </div>

        {mode === "journal" ? (
          <MistakeJournal onStartReview={() => setMode("review")} />
        ) : (
          <MistakeReview onComplete={() => setMode("journal")} />
        )}
      </div>
    </main>
  );
}
