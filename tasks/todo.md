# Reading Tutor Skill Mastery — Implementation Plan

## Context

The reading tutor runs as a stamina session: read passage → answer 5 questions → track WPM/comprehension. It **never updates per-skill mastery** despite every library passage question carrying a `skill_tested` field (e.g., `"rc_main_idea"`, `"rc_inference"`). The `passageQuestionToItem()` mapper at `useReadingStamina.ts:64` silently drops `skill_tested`.

**Goal:** Wire skill mastery tracking into the existing stamina flow. No topic picker. No isolated skill drilling. The stamina session continues to work exactly as today, with mastery tracking as an additive side-effect. Show mastery progress on the feedback screen after each passage.

---

## Critical Architectural Decision: Rolling Window

The math mastery algorithm (`calculateMasteryUpdate` in `adaptive.ts:520`) expects a batch of `AttemptRecord[]` from a single session — math sessions produce 5-15 attempts for one skill. Reading is fundamentally different: each passage produces **1 attempt per skill across 5 different skills**.

If we naively call `calculateMasteryUpdate([singleAttempt], tier)`, the confidence multiplier (`min(1, attempts/8)`) yields 0.125, anchoring mastery to the 0.3 prior. Every passage would produce mastery ≈ 0.3 regardless of correctness.

**Solution:** Maintain a **rolling window of the last 10 `AttemptRecord`s per skill** in localStorage. On each new reading attempt:
1. Load the rolling window for that skill
2. Append the new attempt (cap at 10)
3. Call `calculateMasteryUpdate(rollingWindow, tier, READING_WEIGHTS)`
4. Save updated mastery AND updated rolling window

After 8+ passages testing a skill, confidence reaches 1.0 and mastery fully reflects performance. This reuses the existing algorithm with zero formula changes.

**Storage:** ~10 small objects × ~14 reading skills = ~140 items in localStorage. Negligible.

---

## Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Topic picker? | **No** | Keep pure stamina approach, no isolated skill drilling |
| Update which skills? | **All skills** tested in each passage | Each question maps to a skill; update all |
| Passage selection? | **No filtering by topic** | Mimics Hunter Test: read passage, answer mixed-skill questions |
| Mastery display? | **Feedback screen only** | Reading/answering phases need zero distraction |
| Phasing? | **Phase 1 (data) first, Phase 2 (UI) second** | Validate mastery numbers via tests before users see them |
| Algorithm? | **Rolling window + configurable weights** | Reading needs accumulated data; time weight = 0 |

---

## Phase 1: Skill Tracking Foundation (ship first, validate via tests)

### 1.1 — Carry `skillId` through `QuestionItem` (library passages)
- **File:** `src/hooks/useReadingStamina.ts`
- Add `readonly skillId: string` to `QuestionItem` interface (line 40)
- Update `passageQuestionToItem()` (line 64) to include `skillId: q.skill_tested`
- **Risk:** None — additive field, zero existing code reads it

### 1.2 — Carry `skillId` through AI-generated passage questions
- **Files:** `src/app/api/reading/route.ts`, `src/hooks/useReadingStamina.ts`
- **API prompt** (route.ts lines 68-92): Add `"skillTested"` field to the JSON schema in the prompt. Add requirement: `"Each question must include a skillTested field from: rc_main_idea, rc_inference, rc_vocab_context, rc_evidence_reasoning, rc_author_purpose"`
- **API response type** (route.ts line 34): Add `readonly skillTested?: string` to `GeneratedQuestion`
- **Hook AI path** (useReadingStamina.ts lines 168-206): AI questions are used DIRECTLY (not through `passageQuestionToItem`). At line 196 where `questions: data.passage!.questions` is assigned, map to include `skillId`:
  ```
  questions: data.passage!.questions.map(q => ({
    ...q,
    skillId: q.skillTested ?? "rc_general"
  }))
  ```
- **Fallback path** (useReadingStamina.ts lines 209-230): Uses `passageQuestionToItem` on library passages — already handled by 1.1
- **Risk:** Low — prompt change with fallback to `"rc_general"` prevents crashes

### 1.3 — Register `"reading-attempts"` data key
- **File:** `src/lib/data-keys.ts` (line 5)
- Add `"reading-attempts"` to the `DATA_KEYS` array
- Required for: server sync, user data cleanup, proper namespacing via `getStorageKey()`
- **Risk:** None — additive array entry

### 1.4 — Create rolling window storage functions
- **File:** `src/lib/skill-mastery-store.ts` (new functions, no existing function changes)
- `loadReadingAttemptWindow(skillId: string): AttemptRecord[]` — loads from localStorage via `getStorageKey("reading-attempts")`, returns `[]` if missing
- `saveReadingAttemptWindow(skillId: string, attempts: AttemptRecord[]): void` — saves last 10 entries
- Storage format: JSON object keyed by skillId, e.g., `{ "rc_main_idea": [...], "rc_inference": [...] }`
- Uses `getStorageKey("reading-attempts")` for proper user namespacing (same pattern as existing mastery storage)
- **Risk:** None — new functions only, existing functions untouched

### 1.5 — Make `calculateMasteryUpdate` accept optional weight config
- **File:** `src/lib/adaptive.ts` (line 520)
- Add optional third parameter with interface:
  ```typescript
  export interface MasteryWeightConfig {
    readonly weightRecent?: number;   // default 0.7
    readonly weightOverall?: number;  // default 0.2
    readonly weightTime?: number;     // default 0.1
  }
  ```
- Inside function body: `const wR = weights?.weightRecent ?? WEIGHT_RECENT` etc.
- **Existing callers** (3 call sites confirmed — `useTutoringSession.ts`, `useGuidedStudy.ts`, `useDrillSession.ts`): All pass exactly 2 args → unchanged behavior
- Reading callers will pass: `{ weightRecent: 0.8, weightOverall: 0.2, weightTime: 0.0 }`
- **Risk:** Low — optional param with defaults. Add regression test asserting old 2-arg call produces identical output.

### 1.6 — Create stamina-level-to-tier mapping
- **File:** `src/lib/reading-stamina.ts` (new exported function)
- Mapping: `1-2 → Tier 1, 3-4 → Tier 2, 5-6 → Tier 3, 7 → Tier 4, 8 → Tier 5`
- For library passages: prefer `metadata.difficulty_level` (guaranteed present, range 1-5, typed as `DifficultyLevel`)
- For AI-generated passages: use `staminaLevelToTier(currentStaminaLevel)`
- **Risk:** None — new pure function

### 1.7 — Wire mastery persistence into `answerQuestion()`
- **File:** `src/hooks/useReadingStamina.ts` (lines 268-335)
- Add `useRef<{skillId: string, isCorrect: boolean}[]>` to collect per-question results
- After line 273 (correctness check): push `{ skillId: question.skillId, isCorrect }`
- Reset the ref when loading a new passage
- In the `isLastQuestion` block (line 290), **AFTER** `saveStaminaProgress(updated)` (line 307) and `autoCompleteDailyTask` (line 308):
  ```
  try {
    const tier = passage.isAiGenerated
      ? staminaLevelToTier(s.progress.currentLevel)
      : (passageDifficultyLevel as DifficultyLevel);  // from metadata

    const READING_WEIGHTS = { weightRecent: 0.8, weightOverall: 0.2, weightTime: 0.0 };

    for (const { skillId, isCorrect } of questionResults.current) {
      if (skillId === "rc_general") continue;  // skip untagged AI questions

      const window = loadReadingAttemptWindow(skillId);
      const attempt: AttemptRecord = { isCorrect, timeSpentSeconds: null, hintUsed: false, tier };
      const updated = [...window, attempt].slice(-10);  // cap at 10

      const mastery = calculateMasteryUpdate(updated, tier, READING_WEIGHTS);
      const stored = loadSkillMastery(skillId);

      saveSkillMastery({
        skillId,
        masteryLevel: mastery.newMasteryLevel,
        attemptsCount: (stored?.attemptsCount ?? 0) + 1,
        correctCount: (stored?.correctCount ?? 0) + (isCorrect ? 1 : 0),
        lastPracticed: new Date().toISOString(),
        confidenceTrend: mastery.newConfidenceTrend,
        interval: stored?.interval,
        easeFactor: stored?.easeFactor,
        nextReviewDate: stored?.nextReviewDate,
        repetitions: stored?.repetitions,
      });

      saveReadingAttemptWindow(skillId, updated);
    }
  } catch (err) {
    console.error("[reading] skill mastery persist error:", err);
    // Stamina flow continues unaffected
  }
  ```
- Also: surface `skillResults` (skillId + isCorrect + mastery delta) for Phase 2 UI via state
- **Risk:** Medium — most complex change. Mitigated by:
  - Try/catch: if anything fails, stamina flow is completely unaffected
  - Runs AFTER existing `saveStaminaProgress` — never blocks it
  - All imports (`loadSkillMastery`, `saveSkillMastery`, `AttemptRecord`, `calculateMasteryUpdate`) are already exported and used elsewhere

### 1.8 — Unit tests
- `passageQuestionToItem` now carries `skillId`
- `loadReadingAttemptWindow` / `saveReadingAttemptWindow` round-trip
- `calculateMasteryUpdate` with 2 args (regression) produces identical output to current behavior
- `calculateMasteryUpdate` with reading weights: 100% correct → mastery > 0.7 after 10 attempts
- `calculateMasteryUpdate` with reading weights: 0% correct → mastery < 0.2 after 10 attempts
- `staminaLevelToTier` mapping correctness
- Full simulation: 8 passages, 1 correct `rc_inference` attempt each → confidence reaches 1.0, mastery reflects ~1.0
- **Risk:** None

---

## Phase 2: Mastery Display on Feedback Screen (ship after Phase 1 validated)

### 2.1 — Create `ReadingSkillsSummary` component
- **New file:** `src/components/tutor/ReadingSkillsSummary.tsx`
- Props: `skills: readonly { skillId: string; skillName: string; mastery: number; previousMastery: number; isCorrect: boolean }[]`
- Renders compact card: "Skills Practiced" header, then per skill:
  - Human-readable skill name (e.g., "Main Idea")
  - Mini mastery bar (reuse `masteryColor` logic)
  - Mastery percentage
  - Delta arrow: green ↑ if mastery increased, gray → if stable, red ↓ if declined
- **Risk:** None — new file

### 2.2 — Skill name mapping
- **File:** `src/lib/reading-stamina.ts` (new function)
- Map `rc_main_idea` → "Main Idea", `rc_inference` → "Inference", etc.
- Source names from `content/curriculum-taxonomy.json` reading_comprehension skills
- **Risk:** None — pure lookup

### 2.3 — Surface skill results in hook state
- **File:** `src/hooks/useReadingStamina.ts`
- Add `readonly skillResults: readonly SkillResult[]` to `ReadingStaminaState` (UI-only, not persisted)
- Populated in 1.7's mastery persist block: capture `{ skillId, skillName, mastery, previousMastery, isCorrect }` before/after each update
- Cleared when loading next passage
- **Risk:** Low — additive state field

### 2.4 — Render in feedback phase
- **File:** `src/components/tutor/ReadingStaminaSession.tsx` (FeedbackPhase, lines 313-407)
- After existing comprehension score display, render `<ReadingSkillsSummary skills={state.skillResults} />`
- **Risk:** Low — additive JSX, no logic changes

### 2.5 — Manual smoke test
- Complete 3+ passages, verify:
  - Skills card appears on feedback screen with correct names
  - Mastery bars colored correctly (red < 40%, amber < 70%, green ≥ 70%)
  - Delta arrows show correct direction
  - Stamina UI (WPM, level, comprehension %) completely unchanged
  - Math tutor mastery completely unaffected
  - AI-generated passages show skill results (or gracefully omit untagged questions)

---

## Files Modified (existing)

| File | Change | Risk |
|------|--------|------|
| `src/hooks/useReadingStamina.ts` | `skillId` on `QuestionItem`, attempt collection, mastery persist, skill results state | **Medium** — try/catch isolated |
| `src/app/api/reading/route.ts` | `skillTested` in AI prompt + `GeneratedQuestion` type | **Low** — prompt + optional type field |
| `src/lib/adaptive.ts` | Optional `MasteryWeightConfig` param on `calculateMasteryUpdate` | **Low** — defaults preserve behavior |
| `src/lib/skill-mastery-store.ts` | New `loadReadingAttemptWindow` / `saveReadingAttemptWindow` functions | **None** — additive only |
| `src/lib/reading-stamina.ts` | New `staminaLevelToTier` + skill name mapping functions | **None** — additive only |
| `src/lib/data-keys.ts` | Add `"reading-attempts"` to `DATA_KEYS` | **None** — array entry |
| `src/components/tutor/ReadingStaminaSession.tsx` | Render `ReadingSkillsSummary` in feedback phase | **Low** — additive JSX |

## Files Created (new)

| File | Purpose |
|------|---------|
| `src/components/tutor/ReadingSkillsSummary.tsx` | Skill mastery card for feedback screen |

## Files NOT Modified (stability guarantee)

| File | Why untouched |
|------|--------------|
| `prisma/schema.prisma` | Already supports `rc_*` skill IDs |
| `src/components/tutor/MathTopicPicker.tsx` | Math UI unchanged |
| `src/hooks/useTutoringSession.ts` | Math session hook unchanged |
| `src/hooks/useGuidedStudy.ts` | Guided study unchanged |
| `src/hooks/useDrillSession.ts` | Drill session unchanged |
| `src/lib/reading-stamina.ts` existing functions | `recordReading`, `saveStaminaProgress`, etc. all untouched |
| All 50 passage JSON files | Content unchanged; `skill_tested` already present |

## Execution Order

```
Phase 1 (invisible to user — data plumbing)
  1.1  QuestionItem.skillId (library)     → zero risk
  1.2  QuestionItem.skillId (AI)          → low risk, fallback
  1.3  Register data key                  → zero risk
  1.4  Rolling window storage functions   → zero risk
  1.5  Configurable mastery weights       → low risk, regression tested
  1.6  Stamina-to-tier mapping            → zero risk
  1.7  Wire it together in answerQuestion → medium risk, try/catch isolated
  1.8  Unit tests                         → validates everything

  ── checkpoint: run tests, inspect localStorage after 3+ passages ──

Phase 2 (visible to user — UI)
  2.1  ReadingSkillsSummary component     → zero risk, new file
  2.2  Skill name mapping                 → zero risk
  2.3  Surface skill results in state     → low risk
  2.4  Render in feedback phase           → low risk
  2.5  Manual smoke test                  → confirms full flow
```
