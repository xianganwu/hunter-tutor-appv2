import { prisma } from "@/lib/db";
import { TutorAgent } from "@/lib/ai/tutor-agent";
import type { GeneratedQuestion } from "@/lib/ai/tutor-agent";
import type { Skill, DifficultyLevel } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────

/** Number of questions to generate per batch when filling the cache. */
const BATCH_SIZE = 5;

/** Refill the cache when unused question count drops to this threshold. */
const REFILL_THRESHOLD = 2;

/** Questions older than this (in days) are considered stale and cleaned up. */
const STALE_DAYS = 30;

// ─── In-memory guard against duplicate refills ────────────────────────

const refillInProgress = new Set<string>();

// ─── Types ────────────────────────────────────────────────────────────

interface CachedQuestion {
  id: string;
  questionText: string;
  answerChoices: string[];
  correctAnswer: string;
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Get a question from the cache for a given skill + difficulty tier.
 * If the cache is empty, generates a fresh batch via the AI and caches them.
 * Triggers an async background refill when the pool is running low.
 *
 * Returns a GeneratedQuestion ready for the client.
 */
export async function getCachedQuestion(
  skill: Skill,
  difficultyTier: DifficultyLevel,
  agent: TutorAgent
): Promise<GeneratedQuestion> {
  // Try to serve from cache first
  const cached = await popUnusedQuestion(skill.skill_id, difficultyTier);

  if (cached) {
    // Check remaining pool size and refill in background if low
    void checkAndRefillPool(skill, difficultyTier, agent);

    return {
      questionText: cached.questionText,
      answerChoices: cached.answerChoices,
      correctAnswer: cached.correctAnswer,
      skillId: skill.skill_id,
      difficultyTier,
    };
  }

  // Cache miss — generate a fresh batch, cache them, and serve one
  const firstQuestion = await generateAndCacheBatch(skill, difficultyTier, agent);

  if (firstQuestion) {
    return firstQuestion;
  }

  // Fallback: if batch generation failed, generate a single question directly
  return agent.generateQuestion(skill, difficultyTier);
}

/**
 * Clean up stale cached questions older than STALE_DAYS.
 * Call this periodically (e.g., on app startup or via a cron job).
 */
export async function cleanupStaleQuestions(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);

  const result = await prisma.questionCache.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}

// ─── Internal helpers ─────────────────────────────────────────────────

/**
 * Pop one unused question from the cache, marking it as used atomically.
 * Uses a transaction to prevent two concurrent requests from claiming the
 * same question (SQLite serializes transactions).
 */
async function popUnusedQuestion(
  skillId: string,
  difficultyTier: DifficultyLevel
): Promise<CachedQuestion | null> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.questionCache.findFirst({
      where: {
        skillId,
        difficultyTier,
        used: false,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!row) return null;

    await tx.questionCache.update({
      where: { id: row.id },
      data: { used: true },
    });

    let answerChoices: string[];
    try {
      answerChoices = JSON.parse(row.answerChoices) as string[];
    } catch {
      // Malformed JSON — skip this entry and treat as cache miss
      console.error(`[question-cache] Malformed answerChoices for id=${row.id}`);
      return null;
    }

    return {
      id: row.id,
      questionText: row.questionText,
      answerChoices,
      correctAnswer: row.correctAnswer,
    };
  });
}

/**
 * Count unused questions for a skill+tier.
 */
async function countUnused(
  skillId: string,
  difficultyTier: DifficultyLevel
): Promise<number> {
  return prisma.questionCache.count({
    where: {
      skillId,
      difficultyTier,
      used: false,
    },
  });
}

/**
 * Check if the pool is running low and trigger an async refill if needed.
 * Uses an in-memory guard to prevent duplicate concurrent refills for the
 * same skill+tier combination.
 */
async function checkAndRefillPool(
  skill: Skill,
  difficultyTier: DifficultyLevel,
  agent: TutorAgent
): Promise<void> {
  const key = `${skill.skill_id}:${difficultyTier}`;

  // Skip if a refill is already in-flight for this skill+tier
  if (refillInProgress.has(key)) return;

  try {
    const remaining = await countUnused(skill.skill_id, difficultyTier);

    if (remaining < REFILL_THRESHOLD) {
      refillInProgress.add(key);
      void generateAndCacheBatch(skill, difficultyTier, agent)
        .catch((err) => {
          console.error(
            `[question-cache] Background refill failed for ${skill.skill_id} tier ${difficultyTier}:`,
            err
          );
        })
        .finally(() => {
          refillInProgress.delete(key);
        });
    }
  } catch (err) {
    console.error("[question-cache] Pool check failed:", err);
  }
}

/**
 * Generate a batch of questions via the AI and store them in the cache.
 * The first question in the batch is returned directly to the caller (and
 * marked as used). Remaining questions are stored as unused for future requests.
 *
 * Returns the first GeneratedQuestion, or null if generation failed.
 */
async function generateAndCacheBatch(
  skill: Skill,
  difficultyTier: DifficultyLevel,
  agent: TutorAgent
): Promise<GeneratedQuestion | null> {
  const rawQuestions = await agent.generateDrillBatch(skill, BATCH_SIZE);

  if (rawQuestions.length === 0) return null;

  // First question is served immediately → mark as used.
  // Remaining questions go into the pool as unused.
  try {
    await prisma.questionCache.createMany({
      data: rawQuestions.map((q, i) => ({
        skillId: skill.skill_id,
        difficultyTier,
        questionText: q.questionText,
        answerChoices: JSON.stringify(q.answerChoices),
        correctAnswer: q.correctAnswer,
        used: i === 0, // first question is served directly, mark used
      })),
    });
  } catch (err) {
    console.error("[question-cache] Failed to cache questions:", err);
    // Still return the first question even if caching failed
  }

  const first = rawQuestions[0];
  return {
    questionText: first.questionText,
    answerChoices: first.answerChoices,
    correctAnswer: first.correctAnswer,
    skillId: skill.skill_id,
    difficultyTier,
  };
}
