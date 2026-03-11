import { loadMistakes } from "@/lib/mistakes";
import type { MistakeEntry } from "@/lib/mistakes";
import { loadTeachingMoments } from "@/lib/teaching-moments";
import type { StoredTeachingMoment } from "@/lib/teaching-moments";
import { loadStaminaProgress } from "@/lib/reading-stamina";
import type { StaminaProgress, ReadingRecord } from "@/lib/reading-stamina";
import { loadSimulationHistory } from "@/lib/simulation";
import type { StoredSimulation } from "@/lib/simulation";
import { loadDrillHistory } from "@/lib/drill";
import type { DrillResult } from "@/lib/drill";
import { getSkillById, getSkillIdsForDomain } from "@/lib/exam/curriculum";

// ─── Types ────────────────────────────────────────────────────────────

export interface MasterySnapshot {
  readonly date: string; // YYYY-MM-DD
  readonly reading: number; // 0–100
  readonly mathQr: number;
  readonly mathMa: number;
}

export interface SessionLogEntry {
  readonly date: string; // ISO
  readonly type: "tutoring" | "reading" | "writing" | "simulation";
  readonly summary: string;
  readonly durationMinutes: number | null;
}

export interface DomainReadiness {
  readonly domainName: string;
  readonly mastery: number; // 0–100
  readonly strongSkills: readonly string[];
  readonly weakSkills: readonly string[];
  readonly trend: "improving" | "stable" | "declining";
}

export interface ParentData {
  readonly weeklyMinutes: number;
  readonly weeklyTarget: number;
  readonly activeDaysThisWeek: number;
  readonly masteryTimeline: readonly MasterySnapshot[];
  readonly domainReadiness: readonly DomainReadiness[];
  readonly sessionLog: readonly SessionLogEntry[];
  readonly totalSessions: number;
  readonly mistakePatterns: readonly { skillName: string; count: number }[];
  readonly readingLevel: number | null;
  readonly readingWpm: number | null;
  readonly latestSimPercentile: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────

const WEEKLY_TARGET_MINUTES = 150; // 5 × 30 min
const ESTIMATED_SESSION_MINUTES = 25;

// ─── Helpers ──────────────────────────────────────────────────────────

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day;
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function toDateKey(ts: number | string): string {
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  return d.toISOString().split("T")[0];
}

function isThisWeek(ts: number | string): boolean {
  const d = typeof ts === "string" ? new Date(ts).getTime() : ts;
  return d >= startOfWeek().getTime();
}

function domainMasteryFromMistakes(
  domainId: string,
  mistakes: readonly MistakeEntry[]
): number {
  const skillIds = getSkillIdsForDomain(domainId);
  if (skillIds.length === 0) return 50;

  const bySkill = new Map<string, { correct: number; total: number }>();
  for (const id of skillIds) {
    bySkill.set(id, { correct: 0, total: 0 });
  }

  for (const m of mistakes) {
    if (bySkill.has(m.skillId)) {
      const s = bySkill.get(m.skillId)!;
      s.total += 1;
      // Reviewed successfully = eventual mastery evidence
      if (m.reviewCount > 0 && m.lastReviewedAt) {
        s.correct += 1;
      }
    }
  }

  // Estimate mastery: skills with no data → 50% default
  let total = 0;
  for (const id of skillIds) {
    const data = bySkill.get(id)!;
    if (data.total === 0) {
      total += 50;
    } else {
      total += Math.round((data.correct / data.total) * 100);
    }
  }

  return Math.round(total / skillIds.length);
}

// ─── Main Aggregation ─────────────────────────────────────────────────

export function aggregateParentData(): ParentData {
  const mistakes = loadMistakes();
  const teachingMoments = loadTeachingMoments();
  const stamina = loadStaminaProgress();
  const simulations = loadSimulationHistory();
  const drills = loadDrillHistory();

  // ── Weekly time ──
  const activeDates = new Set<string>();
  let weeklyMinutes = 0;

  // Reading stamina this week
  for (const r of stamina.records) {
    if (isThisWeek(r.timestamp)) {
      weeklyMinutes += r.readingTimeSeconds / 60;
      activeDates.add(toDateKey(r.timestamp));
    }
  }

  // Simulations this week
  for (const s of simulations) {
    if (isThisWeek(s.completedAt)) {
      const ta = s.report.timeAnalysis;
      weeklyMinutes += ta.elaUsedMinutes + ta.mathUsedMinutes;
      activeDates.add(toDateKey(s.completedAt));
    }
  }

  // Drills this week
  for (const d of drills) {
    if (isThisWeek(d.completedAt)) {
      weeklyMinutes += d.durationSeconds / 60;
      activeDates.add(toDateKey(d.completedAt));
    }
  }

  // Tutoring sessions this week (estimate from mistakes/teaching moments)
  const tutoringDates = new Set<string>();
  for (const m of mistakes) {
    if (isThisWeek(m.createdAt)) {
      tutoringDates.add(toDateKey(m.createdAt));
    }
  }
  for (const t of teachingMoments) {
    if (isThisWeek(t.createdAt)) {
      tutoringDates.add(toDateKey(t.createdAt));
    }
  }
  for (const d of tutoringDates) {
    activeDates.add(d);
    weeklyMinutes += ESTIMATED_SESSION_MINUTES;
  }

  // ── Mastery timeline ──
  const timeline = buildMasteryTimeline(mistakes, simulations, stamina);

  // ── Domain readiness ──
  const domainReadiness = buildDomainReadiness(mistakes, teachingMoments, simulations);

  // ── Session log ──
  const sessionLog = buildSessionLog(mistakes, teachingMoments, stamina, simulations, drills);

  // ── Mistake patterns (parent-safe: counts only) ──
  const patternMap = new Map<string, number>();
  for (const m of mistakes) {
    patternMap.set(m.skillName, (patternMap.get(m.skillName) ?? 0) + 1);
  }
  const mistakePatterns = Array.from(patternMap.entries())
    .map(([skillName, count]) => ({ skillName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Reading stats ──
  const readingLevel = stamina.records.length > 0 ? stamina.currentLevel : null;
  const readingWpm =
    stamina.records.length > 0
      ? Math.round(
          stamina.records.reduce((s, r) => s + r.wpm, 0) /
            stamina.records.length
        )
      : null;

  // ── Latest sim ──
  const latestSim = simulations.length > 0 ? simulations[simulations.length - 1] : null;
  const latestSimPercentile = latestSim?.report.overall.estimatedPercentile ?? null;

  return {
    weeklyMinutes: Math.round(weeklyMinutes),
    weeklyTarget: WEEKLY_TARGET_MINUTES,
    activeDaysThisWeek: activeDates.size,
    masteryTimeline: timeline,
    domainReadiness,
    sessionLog: sessionLog.slice(0, 20),
    totalSessions: sessionLog.length,
    mistakePatterns,
    readingLevel,
    readingWpm,
    latestSimPercentile,
  };
}

// ─── Mastery Timeline ─────────────────────────────────────────────────

function buildMasteryTimeline(
  mistakes: readonly MistakeEntry[],
  simulations: readonly StoredSimulation[],
  stamina: StaminaProgress
): MasterySnapshot[] {
  const snapshots: MasterySnapshot[] = [];

  // Add simulation data points (most accurate)
  for (const sim of simulations) {
    snapshots.push({
      date: toDateKey(sim.completedAt),
      reading: sim.report.reading.percentage,
      mathQr: sim.report.qr.percentage,
      mathMa: sim.report.ma.percentage,
    });
  }

  // Add current estimate as latest point
  const currentReading = domainMasteryFromMistakes("reading_comprehension", mistakes);
  const currentQr = domainMasteryFromMistakes("math_quantitative_reasoning", mistakes);
  const currentMa = domainMasteryFromMistakes("math_achievement", mistakes);

  const today = toDateKey(Date.now());
  const hasToday = snapshots.some((s) => s.date === today);
  if (!hasToday) {
    // If we have sim data, blend it with mistake-derived mastery
    const latestSim = simulations.length > 0 ? simulations[simulations.length - 1] : null;
    snapshots.push({
      date: today,
      reading: latestSim
        ? Math.round((latestSim.report.reading.percentage + currentReading) / 2)
        : currentReading,
      mathQr: latestSim
        ? Math.round((latestSim.report.qr.percentage + currentQr) / 2)
        : currentQr,
      mathMa: latestSim
        ? Math.round((latestSim.report.ma.percentage + currentMa) / 2)
        : currentMa,
    });
  }

  // Add a baseline start point if we have activity
  if (snapshots.length > 0) {
    const allDates = [
      ...mistakes.map((m) => m.createdAt),
      ...stamina.records.map((r) => new Date(r.timestamp).toISOString()),
      ...simulations.map((s) => s.completedAt),
    ].filter(Boolean);

    if (allDates.length > 0) {
      const earliest = allDates.sort()[0];
      const startDate = toDateKey(earliest);
      const hasStart = snapshots.some((s) => s.date === startDate);
      if (!hasStart && startDate !== today) {
        snapshots.unshift({ date: startDate, reading: 50, mathQr: 50, mathMa: 50 });
      }
    }
  }

  // Sort by date
  snapshots.sort((a, b) => a.date.localeCompare(b.date));

  // Deduplicate by date (keep last)
  const deduped = new Map<string, MasterySnapshot>();
  for (const s of snapshots) {
    deduped.set(s.date, s);
  }

  return Array.from(deduped.values());
}

// ─── Domain Readiness ─────────────────────────────────────────────────

function buildDomainReadiness(
  mistakes: readonly MistakeEntry[],
  teachingMoments: readonly StoredTeachingMoment[],
  simulations: readonly StoredSimulation[]
): DomainReadiness[] {
  const domains = [
    { id: "reading_comprehension", name: "Reading Comprehension" },
    { id: "math_quantitative_reasoning", name: "Quantitative Reasoning" },
    { id: "math_achievement", name: "Math Achievement" },
  ];

  const latestSim = simulations.length > 0 ? simulations[simulations.length - 1] : null;
  const prevSim = simulations.length > 1 ? simulations[simulations.length - 2] : null;

  return domains.map((domain) => {
    const skillIds = getSkillIdsForDomain(domain.id);

    // Mastery from simulation or estimate
    let mastery: number;
    if (latestSim) {
      if (domain.id === "reading_comprehension") mastery = latestSim.report.reading.percentage;
      else if (domain.id === "math_quantitative_reasoning") mastery = latestSim.report.qr.percentage;
      else mastery = latestSim.report.ma.percentage;
    } else {
      mastery = domainMasteryFromMistakes(domain.id, mistakes);
    }

    // Identify strong vs weak skills
    const skillMistakeCounts = new Map<string, number>();
    const skillTeachBacks = new Set<string>();

    for (const m of mistakes) {
      if (skillIds.includes(m.skillId)) {
        skillMistakeCounts.set(
          m.skillId,
          (skillMistakeCounts.get(m.skillId) ?? 0) + 1
        );
      }
    }

    for (const t of teachingMoments) {
      if (
        skillIds.includes(t.skillId) &&
        t.evaluation.completeness === "complete" &&
        t.evaluation.accuracy === "accurate"
      ) {
        skillTeachBacks.add(t.skillId);
      }
    }

    // Use simulation skill breakdowns if available
    const simSkills = latestSim
      ? domain.id === "reading_comprehension"
        ? latestSim.report.reading.bySkill
        : domain.id === "math_quantitative_reasoning"
          ? latestSim.report.qr.bySkill
          : latestSim.report.ma.bySkill
      : [];

    const strongSkills: string[] = [];
    const weakSkills: string[] = [];

    if (simSkills.length > 0) {
      for (const sk of simSkills) {
        const name = getSkillById(sk.skillId)?.name ?? sk.skillId;
        if (sk.percentage >= 75) strongSkills.push(name);
        else if (sk.percentage < 50) weakSkills.push(name);
      }
    } else {
      for (const id of skillIds) {
        const name = getSkillById(id)?.name ?? id;
        const mistakeCount = skillMistakeCounts.get(id) ?? 0;
        if (skillTeachBacks.has(id) && mistakeCount < 3) {
          strongSkills.push(name);
        } else if (mistakeCount >= 3) {
          weakSkills.push(name);
        }
      }
    }

    // Trend from simulation comparison
    let trend: "improving" | "stable" | "declining" = "stable";
    if (latestSim && prevSim) {
      const getScore = (s: StoredSimulation) => {
        if (domain.id === "reading_comprehension") return s.report.reading.percentage;
        if (domain.id === "math_quantitative_reasoning") return s.report.qr.percentage;
        return s.report.ma.percentage;
      };
      const diff = getScore(latestSim) - getScore(prevSim);
      if (diff > 5) trend = "improving";
      else if (diff < -5) trend = "declining";
    }

    return {
      domainName: domain.name,
      mastery,
      strongSkills: strongSkills.slice(0, 3),
      weakSkills: weakSkills.slice(0, 3),
      trend,
    };
  });
}

// ─── Session Log ──────────────────────────────────────────────────────

function buildSessionLog(
  mistakes: readonly MistakeEntry[],
  teachingMoments: readonly StoredTeachingMoment[],
  stamina: StaminaProgress,
  simulations: readonly StoredSimulation[],
  drills: readonly DrillResult[] = []
): SessionLogEntry[] {
  const entries: SessionLogEntry[] = [];

  // Tutoring sessions: group mistakes by date
  const mistakesByDate = new Map<string, MistakeEntry[]>();
  for (const m of mistakes) {
    const key = toDateKey(m.createdAt);
    const list = mistakesByDate.get(key) ?? [];
    list.push(m);
    mistakesByDate.set(key, list);
  }
  for (const [date, dayMistakes] of mistakesByDate) {
    const skills = new Set(dayMistakes.map((m) => m.skillName));
    entries.push({
      date: new Date(date).toISOString(),
      type: "tutoring",
      summary: `Practiced ${skills.size} skill${skills.size > 1 ? "s" : ""}: ${Array.from(skills).slice(0, 3).join(", ")}${skills.size > 3 ? "..." : ""}`,
      durationMinutes: ESTIMATED_SESSION_MINUTES,
    });
  }

  // Reading stamina sessions: group by date
  const readingByDate = new Map<string, ReadingRecord[]>();
  for (const r of stamina.records) {
    const key = toDateKey(r.timestamp);
    const list = readingByDate.get(key) ?? [];
    list.push(r);
    readingByDate.set(key, list);
  }
  for (const [date, records] of readingByDate) {
    const avgWpm = Math.round(
      records.reduce((s, r) => s + r.wpm, 0) / records.length
    );
    const totalTime = Math.round(
      records.reduce((s, r) => s + r.readingTimeSeconds, 0) / 60
    );
    entries.push({
      date: new Date(date).toISOString(),
      type: "reading",
      summary: `${records.length} passage${records.length > 1 ? "s" : ""} read, ${avgWpm} WPM avg`,
      durationMinutes: totalTime,
    });
  }

  // Simulations
  for (const sim of simulations) {
    const r = sim.report;
    const totalMin = Math.round(
      r.timeAnalysis.elaUsedMinutes + r.timeAnalysis.mathUsedMinutes
    );
    entries.push({
      date: sim.completedAt,
      type: "simulation",
      summary: `Practice exam: ${r.overall.percentage}% overall, est. ${r.overall.estimatedPercentile}th percentile`,
      durationMinutes: totalMin,
    });
  }

  // Drill sessions
  for (const d of drills) {
    entries.push({
      date: d.completedAt,
      type: "tutoring",
      summary: `Timed drill: ${d.skillName} — ${d.accuracy}% accuracy, ${d.questionsPerMinute} q/min`,
      durationMinutes: Math.round(d.durationSeconds / 60),
    });
  }

  // Teaching moments (if not already covered by tutoring date)
  for (const t of teachingMoments) {
    const dateKey = toDateKey(t.createdAt);
    if (!mistakesByDate.has(dateKey)) {
      entries.push({
        date: t.createdAt,
        type: "tutoring",
        summary: `Teach-it-back: demonstrated understanding of ${t.skillName}`,
        durationMinutes: null,
      });
    }
  }

  // Sort newest first
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return entries;
}
