# Todo: 5 Major Features

## Feature 5: Richer Motivation & Rewards
- [x] Create `src/lib/achievements.ts` — badge definitions, types, condition engine, localStorage CRUD
- [x] Add `"badges"` and `"mascot-customization"` to `DATA_SUFFIXES` in `user-profile.ts`
- [x] Create `src/components/shared/Confetti.tsx` — pure CSS confetti animation
- [x] Create `src/components/shared/BadgeNotification.tsx` — toast notification on badge earned
- [x] Create `src/components/dashboard/BadgeGallery.tsx` — grid of earned/locked badges
- [ ] Modify `Mascot.tsx` — add `accessory` prop with SVG overlays (hat, cap, badge, cape)
- [x] Integrate into `DashboardContent.tsx` — badge gallery section, notification rendering, mascot accessory
- [x] Wire `checkAndAwardBadges` into `use-dashboard-data.ts` on load
- [x] Wire `checkAndAwardBadges` into `useTutoringSession.ts` on session end
- [x] Wire `checkAndAwardBadges` into `WritingWorkshop.tsx` on essay feedback
- [x] Verify: typecheck, lint, build, manual test earning a badge

## Feature 1: Daily Practice Plan
- [x] Create `src/lib/daily-plan.ts` — plan generation algorithm, types, storage, auto-complete helper
- [x] Add `"daily-plan"` to `DATA_SUFFIXES` in `user-profile.ts`
- [x] Create `src/components/dashboard/DailyPracticePlan.tsx` — card with 3 tasks, checkmarks, start buttons
- [x] Integrate into `DashboardContent.tsx` — place prominently above skill map
- [x] Load daily plan in `use-dashboard-data.ts`, include in hook return
- [x] Wire `autoCompleteDailyTask` into `useTutoringSession.ts` on session end
- [x] Wire `autoCompleteDailyTask` into `WritingWorkshop.tsx` on feedback
- [x] Add all-done celebration state with confetti
- [x] Verify: typecheck, lint, build, manual test completing daily tasks

## Feature 3: Timed Drill Mode
- [x] Create `src/lib/drill.ts` — types, localStorage CRUD, result computation
- [x] Add `"drills"` to `DATA_SUFFIXES` in `user-profile.ts`
- [x] Add `generateDrillBatch()` method to `TutorAgent` in `tutor-agent.ts`
- [x] Add `"generate_drill_batch"` handler to `/api/chat/route.ts`
- [x] Create `src/hooks/useDrillSession.ts` — drill state machine (setup→active→complete)
- [x] Create `src/components/tutor/DrillMode.tsx` — full drill UI with timer, questions, results
- [x] Create `src/app/drill/page.tsx` — server component route
- [x] Add "Timed Drill" quick action to `DashboardContent.tsx`
- [x] Include drill history in `use-dashboard-data.ts` activity dates
- [x] Include drill results in `parent-data.ts` session log + weekly minutes
- [x] Wire badge check on drill completion
- [x] Wire `autoCompleteDailyTask` on drill completion
- [x] Verify: typecheck, lint, build, manual test running a drill

## Feature 2: Essay Revision Cycle
- [x] Add `revisionOf` and `revisionNumber` columns to `WritingSubmission` in `prisma/schema.prisma`
- [x] Run `npx prisma db push` to apply schema changes
- [x] Extend types in `writing-types.ts` — `StoredEssay`, `WorkshopPhase`, `WritingAction`
- [x] Add `"evaluate_revision"` handler to `/api/writing/route.ts`
- [x] Update GET handler to return `revisionOf` and `revisionNumber`
- [x] Create `src/components/tutor/RevisionFeedback.tsx` — score comparison grid + AI narrative
- [x] Modify `StagedFeedback.tsx` — add "Revise Full Essay" button + `onRevise` prop
- [x] Modify `WritingWorkshop.tsx` — add revision phases (revising, resubmitting, revision_feedback)
- [x] Modify `EssayHistory.tsx` — group by revision chain, show score progression
- [x] Wire badge check for "Revision Pro" on score improvement
- [x] Verify: typecheck, lint, build, manual test full revision cycle

## Feature 4: Weekly Parent Digest
- [x] Create `src/lib/weekly-digest.ts` — digest computation, mastery snapshots, text formatter
- [x] Add `"weekly-snapshots"` to `DATA_SUFFIXES` in `user-profile.ts`
- [x] Add `"generate_weekly_digest"` handler to `/api/parent/route.ts`
- [x] Create `src/components/parent/WeeklyReport.tsx` — digest UI with copy-to-clipboard
- [x] Add "Weekly Report" button to `ParentDashboard.tsx` header
- [x] Trigger weekly mastery snapshot in `use-dashboard-data.ts`
- [x] Include drill/essay/badge data from all new features in digest
- [x] Verify: typecheck, lint, build, manual test generating and copying report

## Final Review
- [ ] Full flow test: dashboard → daily plan → drill → tutor → writing → parent report
- [x] Run `npm run typecheck && npm run lint && npm run build`
- [ ] Verify all badge triggers fire correctly across features
- [ ] Check mobile responsiveness on all new components

## Remaining
- [ ] Modify `Mascot.tsx` — add `accessory` prop with SVG overlays (deferred, non-critical)
