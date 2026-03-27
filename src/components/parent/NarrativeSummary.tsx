"use client";

import { useState, useEffect } from "react";
import type { ParentData } from "@/lib/parent-data";
import {
  buildNarrativeTemplate,
  buildNarrativePayload,
} from "@/lib/build-narrative-template";

interface NarrativeSummaryProps {
  readonly data: ParentData;
}

export function NarrativeSummary({ data }: NarrativeSummaryProps) {
  const template = buildNarrativeTemplate(data);
  const [narrative, setNarrative] = useState(template);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    // Skip AI call if there's nothing to summarize
    if (data.activeDaysThisWeek === 0 && data.weeklyMinutes === 0) return;

    let cancelled = false;
    const payload = buildNarrativePayload(data);

    fetch("/api/parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ narrative?: string }>;
      })
      .then((result) => {
        if (cancelled) return;
        if (result?.narrative) {
          setNarrative(result.narrative);
          setEnhanced(true);
        }
      })
      .catch(() => {
        // Template stays — no error shown to user
      });

    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div className="rounded-2xl shadow-card bg-brand-50 dark:bg-brand-600/10 p-5">
      <h2 className="text-xs font-semibold text-brand-700 dark:text-brand-300 mb-2">
        Weekly Summary
      </h2>
      <p
        className={`text-sm text-surface-700 dark:text-surface-300 leading-relaxed transition-opacity duration-300 ${
          enhanced ? "opacity-100" : "opacity-90"
        }`}
      >
        {narrative}
      </p>
    </div>
  );
}
