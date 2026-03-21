/**
 * Push the Prisma schema to a remote Turso database.
 *
 * Usage:
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx tsx scripts/push-turso-schema.ts
 *
 * This creates all tables if they don't exist, matching the Prisma schema.
 * It's safe to run multiple times (uses IF NOT EXISTS).
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Missing TURSO_DATABASE_URL");
  process.exit(1);
}

const client = createClient({ url, authToken });

const statements = [
  // Tables (order matters for foreign keys — Student first)
  `CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "parentPinHash" TEXT,
    "mascotType" TEXT NOT NULL DEFAULT 'penguin',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentSessionId" TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "SkillMastery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "masteryLevel" REAL NOT NULL DEFAULT 0.0,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "lastPracticed" DATETIME,
    "confidenceTrend" TEXT NOT NULL DEFAULT 'stable',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillMastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "TutoringSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "skillsCovered" TEXT NOT NULL DEFAULT '[]',
    "sessionSummary" TEXT,
    CONSTRAINT "TutoringSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "QuestionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "studentAnswer" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpentSeconds" INTEGER,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "explanationRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TutoringSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "WritingSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "essayText" TEXT NOT NULL,
    "aiFeedback" TEXT,
    "scoresJson" TEXT,
    "revisionOf" TEXT,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WritingSubmission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TutoringSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "QuestionCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillId" TEXT NOT NULL,
    "difficultyTier" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerChoices" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "UserData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserData_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  // Indexes
  `CREATE UNIQUE INDEX IF NOT EXISTS "Student_email_key" ON "Student"("email")`,
  `CREATE INDEX IF NOT EXISTS "SkillMastery_studentId_idx" ON "SkillMastery"("studentId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SkillMastery_studentId_skillId_key" ON "SkillMastery"("studentId", "skillId")`,
  `CREATE INDEX IF NOT EXISTS "TutoringSession_studentId_idx" ON "TutoringSession"("studentId")`,
  `CREATE INDEX IF NOT EXISTS "QuestionAttempt_sessionId_idx" ON "QuestionAttempt"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "QuestionAttempt_skillId_idx" ON "QuestionAttempt"("skillId")`,
  `CREATE INDEX IF NOT EXISTS "WritingSubmission_sessionId_idx" ON "WritingSubmission"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "QuestionCache_skillId_difficultyTier_used_idx" ON "QuestionCache"("skillId", "difficultyTier", "used")`,
  `CREATE INDEX IF NOT EXISTS "UserData_studentId_idx" ON "UserData"("studentId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserData_studentId_key_key" ON "UserData"("studentId", "key")`,
];

// ─── Column migrations (handles drift when tables already exist) ─────

interface ColumnMigration {
  table: string;
  column: string;
  definition: string;
}

const columnMigrations: ColumnMigration[] = [
  { table: "WritingSubmission", column: "revisionOf", definition: "TEXT" },
  { table: "WritingSubmission", column: "revisionNumber", definition: "INTEGER NOT NULL DEFAULT 0" },
];

async function applyColumnMigrations() {
  for (const { table, column, definition } of columnMigrations) {
    try {
      const info = await client.execute(`PRAGMA table_info("${table}")`);
      const exists = info.rows.some((row) => row.name === column);
      if (!exists) {
        await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
        console.log(`  ✓ Added ${table}.${column}`);
      }
    } catch (err) {
      console.error(`  ✗ Migration ${table}.${column}:`, err);
    }
  }
}

async function main() {
  console.log(`Pushing schema to: ${url}`);

  for (const sql of statements) {
    const name = sql.match(/"(\w+)"/)?.[1] ?? "unknown";
    try {
      await client.execute(sql);
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.error(`  ✗ ${name}:`, err);
    }
  }

  // Apply column migrations for tables that already existed
  console.log("\nApplying column migrations...");
  await applyColumnMigrations();

  // Verify tables exist
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  console.log("\nTables in remote DB:");
  for (const row of result.rows) {
    console.log(`  - ${row.name}`);
  }

  console.log("\nDone!");
  client.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
