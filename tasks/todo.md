# Feature: Guided Study Mode ("Study for Me")

## Overview
30-minute auto-piloted session that picks optimal skills, teaches, practices,
then moves to the next weakness. Zero decision fatigue — student clicks one
button and the system runs the entire session.

## Phase 1: Core Library (`src/lib/guided-study.ts`)
- [x] Define types: `GuidedStudyPhase`, `SkillSlot`, `GuidedStudySummary`
- [x] `buildStudyPlan()` — uses `selectNextSkills()` to pick 5 skills across domains
- [x] `shouldAdvanceSkill()` — logic for when to move to next skill
- [x] `computeSessionSummary()` — aggregate stats across all skills
- [x] Constants: `SESSION_DURATION_MS`, `MIN_QUESTIONS_PER_SKILL`, `MAX_QUESTIONS_PER_SKILL`
- [x] `formatTimeRemaining()` — mm:ss display

## Phase 2: State Machine Hook (`src/hooks/useGuidedStudy.ts`)
- [x] Phases: `planning` → `teaching` → `practicing` → `transitioning` → `complete`
- [x] Streaming support for teaching + feedback (reuse SSE pattern from useTutoringSession)
- [x] Auto-select first skill and stream teaching on start
- [x] Question generation + answer submission + streamed feedback
- [x] Skill advancement logic (3 consecutive correct = advance early, max 7 questions per skill)
- [x] Auto-transition to next skill with brief interstitial
- [x] 30-minute global timer with clean wrap-up
- [x] Mastery persistence after each skill block via `saveSkillMastery()`
- [x] Session summary computation on complete
- [x] Badge awards and daily task auto-completion

## Phase 3: UI Component (`src/components/study/GuidedStudySession.tsx`)
- [x] Header: countdown timer (30:00 → 0:00), skill progress dots, end button
- [x] Planning phase: skill plan preview with "Begin Session" button
- [x] Teaching phase: streaming tutor text + "Let's Practice" button
- [x] Practicing phase: question text + MC choices + streamed feedback + "Next" button
- [x] Transitioning phase: brief motivational interstitial (auto-advances)
- [x] Complete phase: session summary with per-skill mastery changes + overall stats
- [x] MathText integration for LaTeX/SVG rendering throughout

## Phase 4: Route + Navigation Integration
- [x] `src/app/study/page.tsx` — route shell
- [x] Add "Study" to TopNav navigation links
- [x] Add "Study for Me" quick action to DashboardContent (prominent placement)
- [x] Add `/study` to middleware protected paths + matcher

## Phase 5: Verify
- [x] Typecheck passes
- [x] Lint passes
- [x] Production build succeeds
- [ ] Smoke test: session starts, teaches, questions work, transitions, timer ends session
