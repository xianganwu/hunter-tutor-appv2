# Root Cause Analysis: Bugs H3, H4, H5, H6

## Status: Analysis Complete — Awaiting Decision

---

## H3: Practice Exam Math Promise.all Failure (Group C1, ~5/50)

### Root Cause
**File:** `src/hooks/useSimulation.ts:437-442`

```
Promise.all([
  generateMathBatch("quantitative_reasoning", qrHalf1, "QR"),
  generateMathBatch("quantitative_reasoning", qrHalf2, "QR"),
  generateMathBatch("math_achievement", maHalf1, "MA"),
  generateMathBatch("math_achievement", maHalf2, "MA"),
])
```

4 parallel AI API calls. If **any one** rejects (timeout, rate limit, server error), `Promise.all` rejects immediately. The catch block (lines 471-478) resets the student to `phase: "gate"` with a generic error. All partial successes are discarded.

**Additional discovery:** `useDiagnostic.ts:86` has the **same vulnerability** — 3 parallel domain fetches via Promise.all.

**Blast radius:**
- Reading section assembly (synchronous, local data) succeeds but is discarded
- Writing prompt (synchronous) succeeds but is discarded
- Student sees "Exam generation failed" with no indication which batch failed
- No state corruption — `"generating"` phase is not saved to localStorage (correct)

### Perspectives

**Business User:** "My child waited 30 seconds for the exam to load, then got kicked back to the start screen with a useless error. They tried again and it worked, but the frustration is real — they thought they did something wrong."

**QA Engineer:** Reproduced by throttling network to 3G in DevTools. 1 of 4 batches timed out at the 60s Next.js limit → entire generation failed. No retry, no partial fallback. The same Promise.all pattern exists in diagnostic assessment (useDiagnostic.ts:86) — same risk there. Sample tests are immune (synchronous JSON loading).

**Software Architect:** The fundamental design error is treating 4 independent API calls as an atomic unit. Each `generateMathBatch` is self-contained — QR batch 1 has no dependency on MA batch 2. The correct abstraction is `Promise.allSettled` with per-batch retry, accepting partial results when possible.

### Potential Fixes

| # | Approach | Risk | Pros | Cons |
|---|----------|------|------|------|
| **A** | Replace `Promise.all` with `Promise.allSettled` + retry failed batches (up to 2 retries per batch) | **Low** | Handles partial failure; 3 successes + 1 retry = likely full success; minimal code change (~30 lines) | Adds retry latency; still fails if batch fails 3 times |
| **B** | `Promise.allSettled` + accept partial results (generate exam with fewer questions if a batch fails) | **Medium** | Student always gets an exam; never returns to gate on generation failure | Exam has uneven section lengths; scoring normalization needed; may confuse parents reviewing scores |
| **C** | Sequential generation with per-batch retry (no parallelism) | **Low** | Simplest retry logic; clear error per batch | 4x slower generation (serial instead of parallel); bad UX for 60+ seconds of waiting |
| **D** | Pre-generate question pools (background job) and serve from cache | **High** | Instant exam start; zero API failure risk at exam time | Major architectural change; stale questions; storage management; overkill for current scale |

**Recommendation:** **Fix A** — `Promise.allSettled` + per-batch retry. Lowest risk, highest impact. Apply same pattern to `useDiagnostic.ts`.

---

## H4: localStorage Clearing Loses Active State (Group D4, 20/20)

### Root Cause
**No `storage` event listener exists anywhere in the codebase.** Zero detection of external localStorage clearing.

Two critical persistence gaps:

1. **In-progress sessions are localStorage-only:**
   - Simulation: `hunter_sim_progress_${examId}` (useSimulation.ts:89) — NOT synced to server
   - Assessment: `hunter-tutor-assessment-in-progress` (AssessmentSession.tsx:39) — NOT synced to server
   - If localStorage is cleared, these are gone forever

2. **Auth identity is localStorage-only:**
   - `hunter-tutor:auth-user` and `hunter-tutor:active-user` (user-profile.ts:4-7)
   - If cleared, app thinks user is logged out — can't trigger automatic restore
   - ProgressHydrator (ProgressHydrator.tsx:24-57) can restore from server, but ONLY if auth keys exist

**16 synced data keys** (data-keys.ts:5-22) ARE backed up server-side via UserData table. These are recoverable on re-login. But the restore requires the auth keys which are also in localStorage.

**Additional discovery:** Simulation key `hunter_sim_progress_${examId}` is NOT user-scoped — if two students share a browser, Student B could resume Student A's exam.

### Perspectives

**Business User:** "My kid was 45 minutes into a practice exam. I cleared the browser cache because Safari was acting slow. When they went back, everything was gone — their exam, their progress bars, even their login. They had to log back in and all their drill history from the morning was missing until it 'appeared' later."

**QA Engineer:** Verified: clearing localStorage while a simulation is in phase "math" results in complete loss of exam state. The ProgressHydrator has a restore path from server, but it requires `auth-user` key to identify the student. With all keys cleared, user lands on login screen. After re-login, synced data (mastery, drills, simulations) restores, but in-progress exam and assessment sessions are permanently lost. No warning, no detection.

**Software Architect:** The app has a split-brain persistence model: 16 data keys are synced (localStorage + SQLite), but session state and auth identity are localStorage-only. The restore path in ProgressHydrator assumes auth keys survive clearing, which is the exact scenario that breaks. The fix needs to address detection (storage event), identity recovery (session cookie or IndexedDB), and in-progress session backup (periodic server checkpoint or IndexedDB fallback).

### Potential Fixes

| # | Approach | Risk | Pros | Cons |
|---|----------|------|------|------|
| **A** | Add `storage` event listener + periodic integrity check (every 30s verify expected keys exist) | **Low** | Detects external clearing; warns user; prompts re-login before state is fully lost | Doesn't prevent data loss — only detects it; polling has small perf cost |
| **B** | Mirror auth identity to a `httpOnly` session cookie or IndexedDB (separate from localStorage) | **Medium** | Auth survives localStorage clear; ProgressHydrator can auto-restore without re-login | Cookie requires server-side session management; IndexedDB adds complexity |
| **C** | Periodic server checkpoint for in-progress sessions (POST partial exam state every 60s) | **Medium** | In-progress exams survive localStorage clear; server becomes source of truth | API load increase; needs new endpoint or model; 60s of work still lost between checkpoints |
| **D** | Full dual-write to IndexedDB (mirror all localStorage writes) | **High** | Complete redundancy; IndexedDB survives cache clears in most browsers | Major refactor; IndexedDB API is async (localStorage is sync); doubles write overhead |

**Recommendation:** **Fix A + B combined.** A gives immediate detection/warning (low risk). B ensures auth survives so the existing restore path works. C is valuable but higher effort — consider as Phase 2.

---

## H5: Drill Exit Without beforeunload Loses Progress (Group H3, 15/15)

### Root Cause
**File:** `src/hooks/useDrillSession.ts` — **zero** `beforeunload`, `pagehide`, or `visibilitychange` handlers.

All drill state lives in React `useState` only (lines 164-176). The ONLY path to persist results is `endDrill()` (lines 429-454), which:
1. Calls `saveDrillResult()` → writes to localStorage drill history
2. Calls `autoCompleteDailyTask()` → marks daily plan task complete
3. Calls `persistMastery()` → updates skill mastery in localStorage

If the student closes the tab, navigates away, or the browser crashes, **100% of session data is lost**: attempts, mastery updates, daily task completion, badge awards.

**Contrast with simulation** (useSimulation.ts:298-309): Has `beforeunload` handler that warns on exit during resumable phases. Also has periodic localStorage saves (lines 249-296) triggered by a `useEffect` on every state change.

**Same bug exists in** `useMixedDrill.ts` (276 lines) — identical pattern, no beforeunload, no periodic saves.

### Perspectives

**Business User:** "My daughter was doing a 5-minute math drill and her tablet went to sleep. When she unlocked it, the page reloaded and all her work was gone. She'd gotten 12 questions right! Now the daily plan still shows that drill as incomplete. She was upset and didn't want to redo it."

**QA Engineer:** Confirmed: started a 5-minute drill, answered 8 questions correctly, closed the tab. Reopened — no drill history entry, daily task still pending, mastery unchanged. The simulation module handles this correctly (beforeunload warning + periodic localStorage saves + resume dialog). The drill module has none of these protections. Also confirmed in useMixedDrill.ts — same gap.

**Software Architect:** The drill was designed assuming uninterrupted completion: start → answer all → end. This is a valid model for 3-5 minute drills on desktop, but breaks on tablets (sleep/wake), unstable connections, and accidental navigation. The simulation module's resilience pattern (beforeunload + periodic state saves + resume) is the proven reference implementation. The drill needs the same architecture, adapted for its shorter duration.

### Potential Fixes

| # | Approach | Risk | Pros | Cons |
|---|----------|------|------|------|
| **A** | Add `beforeunload` handler that calls `endDrill()` synchronously | **Low** | Captures most tab-close scenarios; saves all progress; minimal code (~15 lines) | `beforeunload` is unreliable on mobile Safari/iOS; doesn't handle browser crashes; `endDrill` may not complete in time if it's async |
| **B** | Save drill attempts to localStorage after each answer + `beforeunload` + resume on return | **Medium** | Handles crashes, sleep/wake, and navigation; student can resume interrupted drills; mirrors simulation pattern | More complex; needs resume UI; stale drill state cleanup logic needed |
| **C** | `beforeunload` + `visibilitychange` (save on tab background) + `pagehide` (iOS) | **Low-Medium** | Covers mobile + desktop; `visibilitychange` fires reliably on iOS; three-layer safety net | Still doesn't handle hard crashes; three event listeners to maintain |
| **D** | POST each attempt to server in real-time (fire-and-forget) | **Medium** | Server-side durability; survives everything including localStorage clearing | API load per question; needs new endpoint; latency could slow drill flow; offline breaks it |

**Recommendation:** **Fix C** — triple event handler (`beforeunload` + `visibilitychange` + `pagehide`). Covers desktop and mobile. Apply to both `useDrillSession.ts` and `useMixedDrill.ts`. Consider adding per-answer localStorage saves (from Fix B) as a Phase 2 enhancement for crash resilience.

---

## H6: No Essay Draft Auto-Save (Group G1, ~5/20)

### Root Cause
**File:** `src/components/tutor/WritingWorkshop.tsx`

Essay text lives exclusively in `useState` (line 37: `const [essayText, setEssayText] = useState("")`). The `EssayEditor.tsx` component is a plain `<textarea>` that updates parent state via `onChange`. **Zero persistence** to localStorage or server during the 40-minute writing window (`ESSAY_DURATION_MINUTES = 40`, line 23).

The essay only persists if `submitEssay()` (lines 77-126) succeeds — it POSTs to `/api/writing` which creates a `WritingSubmission` in the database. If the browser crashes, tab closes, network fails, or student navigates away before submission: **complete data loss**.

**Contrast with simulation** (useSimulation.ts:249-296): Saves `state.essayText` to localStorage on every state change via a `useEffect` with `state.essayText` in the dependency array. The simulation's essay section has full persistence; the standalone WritingWorkshop has none.

**No draft model exists** in the Prisma schema — `WritingSubmission` only stores finalized essays.

### Perspectives

**Business User:** "My son spent 35 minutes writing an essay about his favorite book. The browser froze and he had to force-quit. When he reopened it, the essay was completely gone. He was in tears. He refused to rewrite it. That's 35 minutes of focused writing — gone."

**QA Engineer:** Verified: typed 300 words into WritingWorkshop over 10 minutes, force-killed browser process, reopened — textarea empty, no recovery prompt, no draft in localStorage. The simulation module saves essay text continuously and offers resume. WritingWorkshop has no auto-save, no beforeunload warning, no draft recovery. The CountdownTimer (CountdownTimer.tsx) has no save-interval functionality either.

**Software Architect:** This is a straightforward missing feature. The simulation module already implements the exact pattern needed: debounced localStorage save on text change. For WritingWorkshop, the implementation is simpler because there's only one field to save (essay text) vs the simulation's 12+ fields. The key is a `useEffect` with `essayText` in the dependency array, debounced to avoid localStorage thrashing during fast typing, plus cleanup on successful submission.

### Potential Fixes

| # | Approach | Risk | Pros | Cons |
|---|----------|------|------|------|
| **A** | Debounced localStorage save (every 1-2 seconds when text changes) + load on mount + clear on submit | **Low** | Simple; proven pattern from simulation module; ~20 lines of code; survives tab close and refresh | Doesn't survive localStorage clearing (see H4); no server backup |
| **B** | Fix A + `beforeunload` warning when essay has content | **Low** | Two-layer protection: warn on exit + recover from localStorage; covers accidental navigation | `beforeunload` dialog text is browser-controlled, not customizable |
| **C** | Fix B + periodic server-side draft save (POST to /api/writing with `isDraft: true` flag) | **Medium** | Server durability; survives localStorage clearing and device switching; professional-grade | Needs schema change (add `isDraft` to WritingSubmission or new DraftEssay model); API load; cleanup of abandoned drafts |
| **D** | Fix A + IndexedDB fallback for large essays | **Low-Medium** | localStorage has 5MB limit; IndexedDB handles larger content; dual persistence | IndexedDB is async; adds complexity; 5MB is plenty for student essays |

**Recommendation:** **Fix B** — localStorage auto-save + beforeunload warning. Lowest risk, highest impact for the scenario described. The simulation module's pattern is the template. Fix C is ideal but higher effort — consider for Phase 2.

---

## Cross-Bug Pattern Analysis

| Pattern | H3 | H4 | H5 | H6 |
|---------|----|----|----|----|
| Missing error resilience | Promise.all all-or-nothing | No detection of external clearing | No exit protection | No persistence layer |
| Simulation module has it right | N/A (different concern) | Periodic localStorage saves | beforeunload + resume | essayText in dependency array |
| Fix complexity | ~30 lines | ~50 lines (A+B) | ~25 lines | ~20 lines |
| Shared root cause | — | All four bugs stem from **inconsistent resilience patterns** across modules |

The simulation module (`useSimulation.ts`) was built with resilience as a first-class concern. The drill, writing, and diagnostic modules were not. The fixes largely involve porting proven patterns from the simulation module to the modules that lack them.

---

## Review

- [x] H3: Root cause identified, code paths traced, fixes ranked
- [x] H4: All 16 localStorage keys cataloged, restore path traced, auth gap identified
- [x] H5: Drill vs simulation comparison complete, daily task impact confirmed
- [x] H6: WritingWorkshop vs simulation auto-save compared, schema gap noted
- [x] Cross-cutting patterns identified
- [ ] Awaiting decision on which fixes to implement
