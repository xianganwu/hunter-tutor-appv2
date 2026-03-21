import { prisma } from "@/lib/db";
import { TutorAgent } from "@/lib/ai/tutor-agent";
import type { GeneratedQuestion } from "@/lib/ai/tutor-agent";
import type { Skill, DifficultyLevel } from "@/lib/types";
import { isValidQuestion } from "@/lib/ai/validate-question";

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
  agent: TutorAgent,
  recentQuestions?: string[]
): Promise<GeneratedQuestion | null> {
  // Try to serve from cache first — gracefully degrade if the table
  // doesn't exist yet (e.g., prisma db push hasn't run on this deploy)
  try {
    const cached = await popUnusedQuestion(skill.skill_id, difficultyTier);

    if (cached) {
      // Check remaining pool size and refill in background if low
      void checkAndRefillPool(skill, difficultyTier, agent, recentQuestions);

      return {
        questionText: cached.questionText,
        answerChoices: cached.answerChoices,
        correctAnswer: cached.correctAnswer,
        skillId: skill.skill_id,
        difficultyTier,
      };
    }

    // Cache miss — generate a fresh batch, cache them, and serve one
    const firstQuestion = await generateAndCacheBatch(skill, difficultyTier, agent, recentQuestions);

    if (firstQuestion) {
      return firstQuestion;
    }
  } catch (err) {
    // Table may not exist — fall through to direct generation
    console.warn("[question-cache] Cache unavailable, falling back to direct generation:", err);
  }

  // Fallback: generate a single question directly (no caching)
  return agent.generateQuestion(skill, difficultyTier, recentQuestions);
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

/**
 * Flush all unused cached questions. Useful after deploying prompt changes
 * to ensure stale questions are not served.
 */
export async function flushUnusedCache(): Promise<number> {
  const result = await prisma.questionCache.deleteMany({
    where: { used: false },
  });

  if (result.count > 0) {
    console.log(`[question-cache] Flushed ${result.count} unused cached questions`);
  }

  return result.count;
}

// ─── One-time cache flush on deploy ──────────────────────────────────
//
// Flush stale cached questions on server startup to ensure students
// always get questions generated with the latest prompts.
// This runs once per server process startup.

let cacheFlushDone = false;

export async function ensureCacheFlushed(): Promise<void> {
  if (cacheFlushDone) return;
  cacheFlushDone = true;

  try {
    await flushUnusedCache();
    await cleanupStaleQuestions();
  } catch (err) {
    console.error("[question-cache] Cache flush on startup failed:", err);
  }
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

    // 1. Validate JSON structure BEFORE marking as used
    let answerChoices: string[];
    try {
      answerChoices = JSON.parse(row.answerChoices) as string[];
    } catch {
      // Malformed JSON — consume this entry so we don't retry it, but return null
      console.error(`[question-cache] Malformed answerChoices for id=${row.id}`);
      await tx.questionCache.update({ where: { id: row.id }, data: { used: true } });
      return null;
    }

    // 2. Re-validate the question against current validation logic
    //    (catches issues if validation rules evolved since the question was cached)
    if (!isValidQuestion(answerChoices, row.correctAnswer, "question-cache/pop")) {
      console.warn(`[question-cache] Cached question id=${row.id} failed re-validation, discarding`);
      await tx.questionCache.update({ where: { id: row.id }, data: { used: true } });
      return null;
    }

    // 3. Mark as used only after validation passes
    await tx.questionCache.update({
      where: { id: row.id },
      data: { used: true },
    });

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
  agent: TutorAgent,
  recentQuestions?: string[]
): Promise<void> {
  const key = `${skill.skill_id}:${difficultyTier}`;

  // Skip if a refill is already in-flight for this skill+tier.
  // Claim the key immediately to prevent TOCTOU races between the
  // has() check and the async countUnused() call.
  if (refillInProgress.has(key)) return;
  refillInProgress.add(key);

  try {
    const remaining = await countUnused(skill.skill_id, difficultyTier);

    if (remaining < REFILL_THRESHOLD) {
      void generateAndCacheBatch(skill, difficultyTier, agent, recentQuestions)
        .catch((err) => {
          console.error(
            `[question-cache] Background refill failed for ${skill.skill_id} tier ${difficultyTier}:`,
            err
          );
        })
        .finally(() => {
          refillInProgress.delete(key);
        });
      return; // key will be cleaned up in the .finally() above
    }
  } catch (err) {
    console.error("[question-cache] Pool check failed:", err);
  }

  // Release the key if we didn't start a refill
  refillInProgress.delete(key);
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
  agent: TutorAgent,
  recentQuestions?: string[]
): Promise<GeneratedQuestion | null> {
  const rawQuestions = await agent.generateDrillBatch(skill, BATCH_SIZE, difficultyTier, recentQuestions);

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
