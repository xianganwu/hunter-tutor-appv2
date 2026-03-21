# Fix: Math Drill Difficulty + Study Session Issues

## Drill Mode Fixes (complete)
- [x] Fix 1: `computeDrillDifficultyTier` — use mastery even when attemptsCount === 0
- [x] Fix 3: Deduplicate questions within a drill session
- [x] Fix 3b: Handle edge case where ALL fetched questions are duplicates (drill freeze bug)
- [x] Fix 5: Pass recent question texts to AI for variety

## Study Mode Fixes
- [x] Bug 1: `scoreSkill` (adaptive.ts:135) same attemptsCount === 0 pattern — diagnostic mastery ignored in skill selection
- [x] Bug 2: Difficulty tier never adjusts mid-skill — added streak-based adjustment in `nextQuestion`
- [x] Bug 3: `persistCurrentSkillMastery` didn't blend prior history — mastery over-inflated from 3 correct answers
- [x] Bug 5: No domain diversity guarantee — all 5 slots could be same domain. Added round-robin domain seeding.
- [ ] Bug 4: No question dedup within a study skill (lower priority — questions generated one at a time via cache)

## Verification
- [x] All 1101 tests pass (5 failures pre-existing in unrelated file)
- [x] Typecheck clean (pre-existing errors only)
- [x] `adaptive.test.ts`: 39/39 pass
- [x] `useDrillSession.test.ts`: 25/25 pass

## Files Modified
- `src/hooks/useDrillSession.ts` — Drill fixes 1, 3, 3b
- `src/hooks/useDrillSession.test.ts` — Updated tests
- `src/lib/ai/tutor-agent.ts` — recentQuestions in AI prompt
- `src/app/api/chat/route.ts` — schema + handler threading
- `src/lib/adaptive.ts` — scoreSkill attemptsCount === 0 fix
- `src/hooks/useGuidedStudy.ts` — mastery blending, mid-skill tier adjustment
- `src/lib/guided-study.ts` — domain diversity in buildStudyPlan
