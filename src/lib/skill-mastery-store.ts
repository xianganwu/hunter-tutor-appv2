import type { ConfidenceTrend } from "./adaptive";
import { getStorageKey } from "./user-profile";

// ─── Types ────────────────────────────────────────────────────────────

export interface StoredSkillMastery {
  readonly skillId: string;
  readonly masteryLevel: number; // 0.0 - 1.0
  readonly attemptsCount: number;
  readonly correctCount: number;
  readonly lastPracticed: string; // ISO
  readonly confidenceTrend: ConfidenceTrend;
}

// ─── Storage ──────────────────────────────────────────────────────────

const STORAGE_KEY = "hunter-tutor-skill-mastery";

export function loadAllSkillMasteries(): StoredSkillMastery[] {
  try {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(getStorageKey(STORAGE_KEY));
    if (!data) return [];
    return JSON.parse(data) as StoredSkillMastery[];
  } catch {
    return [];
  }
}

function saveAll(entries: readonly StoredSkillMastery[]): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(entries));
  } catch {
    // localStorage unavailable
  }
}

export function loadSkillMastery(skillId: string): StoredSkillMastery | null {
  return loadAllSkillMasteries().find((e) => e.skillId === skillId) ?? null;
}

export function saveSkillMastery(data: StoredSkillMastery): void {
  const all = loadAllSkillMasteries();
  const idx = all.findIndex((e) => e.skillId === data.skillId);
  if (idx >= 0) {
    all[idx] = data;
  } else {
    all.push(data);
  }
  saveAll(all);
}
