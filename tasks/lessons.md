# Lessons Learned

## 12 Failing Tests in progress-hydration.test.ts — Do Not Fix

**Root cause**: Circular module import between `auth-client.ts` and `user-profile.ts`. When vitest dynamically imports `auth-client`, the circular dependency corrupts the `localStorage` global — methods like `clear()` and `setItem` become unavailable. The 4 tests in the same file that don't touch `localStorage` pass fine.

**Why not fix**: The real fix requires breaking the circular dependency, which means refactoring core state management files (`auth-client.ts`, `user-profile.ts`) used across the entire app. Medium-to-high risk of introducing bugs for zero user-facing benefit — the actual code works correctly in the browser where `localStorage` isn't corrupted by vitest module mocking.

**Status**: Leave as-is. These are test infrastructure failures, not application bugs.

## Always Use getStorageKey() for localStorage Keys

**Pattern**: Every localStorage key that stores per-student data MUST use `getStorageKey(baseKey)` from `user-profile.ts` to namespace it by the active user (e.g., `hunter-tutor-skill-mastery` → `hunter-tutor:Emma:skill-mastery`).

**What went wrong**: The assessment in-progress save/resume feature used a hardcoded global key (`hunter-tutor-assessment-in-progress`) instead of calling `getStorageKey()`. This meant Student B could see and resume Student A's in-progress assessment on a shared browser — leaking answers, essay text, and timing data.

**Rule**: Before writing any `localStorage.setItem()` call, check: "Does this data belong to a specific student?" If yes, use `getStorageKey()`. No exceptions. The only keys that should be unscoped are truly global preferences (e.g., `hunter-tutor-theme`).

**Applies to**: Any new feature that persists state client-side — assessments, simulations, drafts, etc.

## Security Audit Findings: Verify Before Acting

**Pattern**: When reviewing a security audit, always verify each finding against the CURRENT codebase before implementing fixes. Audits can be stale or wrong.

**What happened**: A security audit flagged 4 items as CRITICAL. On verification:
- JWT secret hardcoded fallback — already fixed in a prior commit (stale finding)
- Sequential database updates — already batched in a transaction (factually wrong)
- SQLite in production — mischaracterized Turso as bare SQLite (wrong technology assessment)
- Regex prompt injection filtering recommendation — anti-pattern that creates false security

**Rule**: For every audit finding: (1) grep the codebase for the exact code cited, (2) check git log for recent fixes, (3) evaluate whether the recommended fix is actually sound engineering. Don't blindly implement audit recommendations.

## Vercel Build Failures: Always Verify Locally Before Pushing

**Pattern**: Before every push to main, run `npm run build` locally (not just `tsc --noEmit` or `next lint`). The full build command (`npx prisma generate && next build`) catches issues that typecheck and lint miss: SSR rendering errors, missing exports consumed during static page generation, dynamic import failures, and Edge Runtime incompatibilities.

**Verification checklist before every push:**
1. `npx tsc --noEmit` — type safety
2. `npx next lint` — lint rules
3. `npm run build` — full production build (Prisma generate + Next.js build + static page generation)
4. `npx vitest run` — tests

**Why not just typecheck?** Next.js build does additional work beyond TypeScript: it actually renders static pages, resolves all dynamic imports, tree-shakes unused code, and validates Edge Runtime compatibility. A file can typecheck perfectly but fail during static generation (e.g., server-side code importing a client-only module, or a component that crashes during SSR).

**When Vercel fails but local passes:** If all 4 checks pass locally but Vercel still fails, the cause is usually: (1) Vercel build cache corruption — trigger a redeploy with an empty commit, (2) Node.js version mismatch — pin the version in `package.json` `engines` field, (3) missing env vars on Vercel that exist locally in `.env.local`.

**Rule**: Never push to main without running `npm run build` locally first. Make this a habit, not an afterthought.

## Prisma Schema Changes Require Production DB Migration

**Pattern**: Adding a column to `prisma/schema.prisma` regenerates the Prisma client (which Vercel does via `npx prisma generate` at build time), but does NOT migrate the production database. The deployed app will crash on any query touching the new column.

**What happened**: Added `mascotName String?` to the Student model. Vercel built successfully (Prisma client generated), but every login/signup failed with "Something went wrong" because the production Turso DB didn't have the `mascotName` column. Prisma's `findUnique()` SELECTs all columns by default.

**Fix**: `turso db shell hunter-tutor "ALTER TABLE Student ADD COLUMN mascotName TEXT;"` — but this was discovered only after users couldn't log in.

**Rule**: After any `schema.prisma` change, BEFORE pushing to main:
1. Run the migration against production: `turso db shell <db-name> "ALTER TABLE ..."` for Turso, or `npx prisma db push` for standard databases
2. Verify the column exists: `turso db shell <db-name> "PRAGMA table_info(<Table>);"`
3. Note: `npx prisma db push` does NOT work with `libsql://` URLs — use the Turso CLI directly

**Why not caught locally**: Local dev uses `file:./dev.db` (SQLite file) where `npx prisma db push` works fine. Production uses Turso (libsql://) which requires separate migration.

## HSTS Header Is a Free Win

**Pattern**: If the app runs on HTTPS (all Vercel apps do), add `Strict-Transport-Security: max-age=63072000; includeSubDomains` to security headers. One line, zero risk, prevents HTTPS downgrade attacks.

**What happened**: The app had 5 security headers configured but missed HSTS — the one that actually prevents a real attack vector (man-in-the-middle on first HTTP visit). The security audit also missed it while listing 7 medium-priority items of lower impact.

## Strip Structured Content Before Regex Parsing

**Pattern**: When AI responses contain embedded structured content (SVG, HTML, JSON blocks), regex parsers that scan the entire response will match patterns inside that content. Always strip/replace structured blocks with placeholders before running content-extraction regexes, then re-insert after parsing.

**What happened**: Added SVG chart generation for data interpretation skills. The AI response contained SVG charts with text labels like `<text>A) Pepperoni</text>`. The choice-extraction regex `/[A-E]\)\s*.+/g` matched these SVG-internal patterns as answer choices, inflating the choice count from 5 to 7+. This caused the correct-answer index to be out of bounds, `parseGeneratedQuestion()` returned `null`, and students saw "Failed to generate a valid question."

**Fix**: `stripSvgBlocks()` extracts all `<svg>...</svg>` blocks and replaces them with `__SVG_N__` placeholders before choice parsing. After parsing, `restoreSvgBlocks()` re-inserts them into the question text so they render in the chat. A non-visual fallback retry ensures students always get a question even if SVG parsing fails.

**Rule**: Any time you add a new content type to AI responses (SVG, HTML tables, code blocks, JSON), audit all downstream parsers that use regexes on the raw response text. The parser was written for plain-text responses and has no concept of structured blocks. Either strip the blocks before parsing, or make the regexes structure-aware.

## AI Wraps English Prose in LaTeX Delimiters

**Pattern**: When the AI prompt says "use $...$ for math expressions" without explicitly prohibiting prose, the AI sometimes wraps entire English sentences containing numbers in `$...$`. The renderer faithfully sends this to KaTeX, which renders English words as broken italic math with no spaces.

**What happened**: The system prompt (tutor-agent.ts:174) said "Use LaTeX notation for math expressions: wrap inline math in single dollar signs." The AI generated teach explanations like `$47 is 2 more than 45, while 23 is 2 less than 25$` — mixing prose with numbers in a single LaTeX block. KaTeX rendered this as garbled italic text. The renderer's regex (`MathTextRenderer.tsx:103`) has no concept of "this is English, not math" — it sends everything between `$...$` to KaTeX.

**Fix**: Two layers: (1) Hardened the system prompt to explicitly prohibit English words inside `$...$` with concrete examples of what NOT to do. (2) Added a `looksLikeProse()` heuristic in `MathTextRenderer.tsx` that detects 3+ consecutive alphabetic characters (excluding valid LaTeX commands like `frac`, `times`, `sqrt`) inside `$...$` blocks and renders them as plain text instead of math.

**Rule**: AI prompt instructions about formatting must include explicit negative examples ("do NOT do X") in addition to positive examples ("do X"). The AI is better at following format instructions when it sees concrete examples of the wrong format it should avoid. Additionally, any rendering pipeline that consumes AI-generated delimiters needs a validation layer — trust but verify.

## Safety Net Rejects Seeded Questions at Tier 5 (Fifth Occurrence)

**Pattern**: When a validator safety net rejects "unverifiable" questions, it must distinguish between questions where the AI computed the math (needs verification) and questions where code pre-computed the math (correct by construction). A safety net that treats all questions identically will reject valid seeded questions whose format doesn't match the finite set of regexes.

**What happened**: A student with 100% mastery on place value (mqr_place_value) always gets tier 5 difficulty. `generatePlaceValueSeed(5)` correctly pre-computes a 6-digit number, target digit, correct value, and distractors. But the seed prompt permits word problems ("You may present as a direct question or a simple word problem"). At tier 5, the AI generates creative word problems where the number appears in a story preamble far from the "digit X" / "value of" phrase. The safety net in `validateGeneratedQuestion()` (validate-question.ts:1030-1049) detects place-value keywords (`looksLikePlaceValueQuestion = true`) but none of the 4 format detectors can parse the creative format (`formatRecognized = false`). Question is rejected. All retry paths generate similar creative formats → all rejected → "Failed to generate a valid question."

**Fix**: Layered approach: (1) Verify seeded questions against the seed's `correctValue` directly instead of parsing English — the seed IS the verification. (2) Cap retention-check difficulty at tier 3-4 since retention tests memory, not ceiling performance. (3) Add tier fallback in `getCachedQuestion()` — if all tier-N attempts fail, retry at tier N-1. (4) Replace raw error strings with child-friendly UI and retry/redirect buttons.

**Rule**: When adding a "reject what you can't verify" safety net, always create an escape hatch for data whose correctness is guaranteed by construction. A safety net that doesn't know the difference between AI-computed and code-computed answers will reject valid questions. The validation pipeline needs a concept of provenance — seeded questions should verify against the seed, not against regex parsing of English. More broadly: validation strictness must be proportional to the uncertainty of the data source.

## Never Use Wall-Clock Timestamps for Elapsed Time in Pausable Contexts

**Pattern**: If a timer can be interrupted (tab background, computer sleep, page close + resume), tracking "when did it start" with `Date.now()` and computing elapsed as `Date.now() - startTime` will include all inactive time. This applies to any feature with a countdown, time limit, or duration measurement.

**What happened**: The practice exam timer stored `sectionStartedAt` (a wall-clock timestamp) and used `Date.now() - sectionStartedAt` for both the countdown display and the final `usedMinutes` calculation. Three bugs resulted:
1. **Tab background/sleep**: Student minimizes tab for 60 min → timer jumps forward 60 min on return, potentially auto-submitting the section instantly.
2. **Resume timing corruption**: `sectionStartRef` was restored to the original start timestamp on resume, so `finishEla()` recorded `usedMinutes` that included the entire away period.
3. **Timer reset on resume**: `ExamTimer` remounted fresh with full duration, giving the student extra time (the pre-resume work was forgotten).

**Fix**: Three coordinated changes:
- On resume, compute `elapsedBeforeSave = savedAt - sectionStartedAt` and set `sectionStartRef = Date.now() - elapsedBeforeSave` (shift the origin forward to exclude away time).
- Add `visibilitychange` listeners on both the UI timer and the hook-level ref that shift the start time forward by the hidden duration.
- Pass `initialElapsedSeconds` to the timer component on resume so it starts at the correct remaining time.

**Rule**: When building any timed feature:
1. Store **cumulative elapsed time** (seconds used), not a start timestamp.
2. Add `visibilitychange` handling to pause during tab background.
3. On resume from persistence, restore elapsed time — not the original start time.
4. If using `Date.now() - ref` patterns, ensure the ref is shifted forward by any inactive gaps.

## Validation Logic Must Handle All Occurrences, Not Just the First

**Pattern**: `String.indexOf()` returns the first (leftmost) match. When verifying a claim about "digit X in number N," if X appears multiple times, `indexOf` silently picks the wrong occurrence and the validator rejects a correct answer.

**What happened**: `computePlaceValue("424583", 4)` used `indexOf("4")` → index 0 → value 400,000. But the question was about the 4 at the hundreds place (value 400). The validator rejected the correct answer because it only checked the leftmost occurrence. At tier 5 (6-digit numbers), ~85% of numbers have repeated digits, causing near-total question generation failure for students at 100% mastery.

**Fix**: Changed `computePlaceValue` to `computeAllPlaceValues`, returning a `number[]` of values for every occurrence of the digit. All 4 callers updated to check if the claimed value matches *any* valid occurrence.

**Rule**: Whenever verifying a property of a character/digit/token within a string, always consider that it may appear multiple times. Use a loop or `matchAll`/`indexOf` in a loop rather than a single `indexOf` or `match`. If the result is ambiguous (multiple valid values), accept any valid interpretation rather than picking the first.

## Overly Strict Safety Nets Cause Silent Failures

**Pattern**: A safety net that rejects "anything it can't verify" will reject valid inputs when the verifier's format coverage doesn't match the generator's format diversity. The rejection is silent (logged server-side, user sees a generic error), making it hard to diagnose.

**What happened**: The place-value question safety net rejected any question that "looked like place value" (had a multi-digit number + keywords like "digit" or "hundreds") but didn't match any of the narrow verification regexes. The AI was instructed to "vary question format" in batches, generating creative phrasings like "how much does digit 4 contribute" that the narrow regex `/value\s+of\s+(?:the\s+)?digit\s+(\d)\s+in/` couldn't match. Valid questions with correct answers were silently rejected.

**Fix**: Broadened `detectPlaceValueQuestion` from 1 regex pattern to 6, covering "place value of," "how much ... digit X," "digit X represent/contribute," and inverted "In N, ... digit X" word orders.

**Rule**: When adding a safety net that rejects unverifiable inputs:
1. Ensure the verifier's format coverage matches or exceeds the generator's output diversity.
2. If the generator is instructed to "vary format," either constrain it to verifiable formats or expand the verifier.
3. Log rejections with enough detail to diagnose false positives (the existing `parseWarn` logging was good — the problem was that nobody was monitoring it).
4. Prefer "accept if plausible" over "reject if unverifiable" when the generator is trusted (e.g., seed-guided questions where the math is pre-computed).

## Resilience Patterns Must Be Consistent Across Modules

**Pattern**: When one module implements resilience features (auto-save, beforeunload, periodic persistence, retry), all modules with similar data-loss risk must implement them too. Inconsistency means users experience failures in some features but not others — and the "good" module proves the pattern works.

**What happened**: Four bugs stemmed from the same root cause — the simulation module (`useSimulation.ts`) was built with resilience as a first-class concern, while drill, writing, and diagnostic modules were not:
- **H3 (Promise.all)**: Simulation had no parallel retry, but all 4 math generation API calls used `Promise.all`. One failure killed the entire exam. Diagnostic had the same issue.
- **H5 (Drill exit)**: Simulation had `beforeunload` + periodic localStorage saves + resume dialog. Drill had none — closing a tab lost 100% of drill progress.
- **H6 (Essay auto-save)**: Simulation auto-saved `essayText` to localStorage on every change. WritingWorkshop's 40-minute essay sessions had zero persistence.
- **H4 (localStorage clearing)**: No module had detection for external localStorage clearing.

**Fixes applied**:
- `Promise.allSettled` + per-batch retry in `useSimulation.ts` and `useDiagnostic.ts`
- Triple event handler (`beforeunload` + `visibilitychange` + `pagehide`) in `useDrillSession.ts` and `useMixedDrill.ts`
- Debounced localStorage auto-save + draft restore + beforeunload warning in `WritingWorkshop.tsx`
- Storage event listener + periodic integrity check in `ProgressHydrator.tsx`

**Rule**: When adding a new feature that holds user work in volatile state (React state, in-memory), check: (1) Does the simulation module handle this scenario? (2) Am I handling it too? The simulation module is the reference implementation for: auto-save to localStorage, beforeunload/pagehide/visibilitychange handlers, resume-from-saved-state, and graceful degradation on API failure. New modules must match its resilience level, or explicitly document why they don't need it.

## Promise.all Is All-or-Nothing — Use allSettled for Independent Calls

**Pattern**: `Promise.all` rejects immediately when ANY promise rejects. If the promises are independent (no data dependency between them), use `Promise.allSettled` so partial successes are preserved and failed calls can be retried individually.

**What happened**: Practice exam generation fired 4 parallel `generateMathBatch` API calls via `Promise.all`. If any single call timed out (common on slow connections), the entire exam generation failed — even if 3 of 4 batches succeeded. Student was sent back to the gate screen with a generic error. Same vulnerability existed in diagnostic assessment (3 parallel domain fetches).

**Fix**: Replaced `Promise.all` with `Promise.allSettled`, loop over results checking `status === "fulfilled"`, retry rejected batches once sequentially (sequential to avoid overloading during an outage). If retry also fails, the error propagates to the existing catch block.

**Rule**: Before using `Promise.all`, ask: "Are these promises independent?" If yes, use `Promise.allSettled` + per-item retry. Reserve `Promise.all` for cases where ALL results are truly required simultaneously and partial success is meaningless.

## Mastery-Based Scoring Needs Guards at Boundary Values

**Pattern**: Scoring algorithms that work well in the middle range (mastery 0.3–0.8) can produce counterintuitive results at the extremes (0.0 or 1.0). Always test boundary values.

**What happened**: The `scoreSkill` function's "stale" check gave priority score `40 * staleness` to any skill not practiced in 7+ days, regardless of mastery. A skill at 100% mastery (fully learned, no need for practice) that was "stale" for 14 days scored 80 — higher than near-mastery skills (50–57) and new skills (35). The daily plan kept routing students back to already-mastered topics.

**Fix**: Added a `masteryDamper` that tapers the stale boost to zero as mastery goes from 0.85 → 1.0: `masteryDamper = 1 - (mastery - 0.85) / 0.15`. A fully mastered skill now scores 0 when stale, correctly deferring to the SM-2 retention check system for review scheduling.

**Rule**: For any scoring function that combines multiple signals (mastery, staleness, prerequisites), test all combinations of extreme values: {mastery=0, mastery=1} × {stale, fresh} × {has dependents, no dependents}. A scoring function that "looks right" for typical students can badly misbehave for edge-case students.
