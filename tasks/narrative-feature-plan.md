# Parent Dashboard Narrative Summary — Implementation Plan

## Feature Description

Add an always-visible, human-readable weekly narrative to the top of the Parent Dashboard:

> "This week, [Student] practiced 4 days and spent 45 minutes on math and reading. They're showing steady improvement in fractions and should focus more on reading comprehension next week."

Generated from the same data that powers the existing charts (`aggregateParentData()`), presented as the first substantive content a parent sees.

---

## Recommended Approach: Hybrid (Deterministic Template + Optional AI Polish)

**Why this approach**: Zero new failure modes, zero perceived latency, graceful degradation. The template renders instantly; Haiku optionally upgrades it in the background.

### Alternatives Considered

| Option | Risk | Quality | Cost | Verdict |
|--------|------|---------|------|---------|
| A. Extend `generate_weekly_digest` | Low | High | ~$0.0004/call | Couples narrative to existing digest flow |
| B. New `generate_narrative` action | Low-Med | High | ~$0.0004/call | Clean but more new code |
| C. Deterministic template only | Lowest | Medium | $0 | Reads like a template |
| **D. Hybrid (template + AI)** | **Lowest** | **High** | **~$0.0004/call** | **Recommended** |

---

## Implementation Steps

### Step 1: Build the template function
- [ ] Create `src/lib/build-narrative-template.ts`
- [ ] Pure function: `buildNarrativeTemplate(data: ParentData): string`
- [ ] Handles edge cases: zero days, no improving skills, no weak skills, no data at all
- [ ] Derives subjects practiced from `sessionLog[].type` (map tutoring→subjects via domain readiness)
- [ ] 3 sentences: (1) activity summary, (2) what's going well, (3) gentle focus suggestion
- [ ] Unit testable — write `build-narrative-template.test.ts` alongside it

### Step 2: Add `generate_narrative` action to `/api/parent`
- [ ] Add new variant to `ParentActionSchema` discriminated union in `src/app/api/parent/route.ts`
- [ ] Zod schema: `{ type: "generate_narrative", activeDays, weeklyMinutes, weeklyTarget, subjects, improvingSkills, weakSkills, topMistake, readingLevel?, simPercentile? }`
- [ ] Uses `MODEL_HAIKU`, `max_tokens: 128`
- [ ] System prompt: warm teacher tone, 2-3 sentences, structured as activity → trend → suggestion
- [ ] Response: `{ narrative: string }`
- [ ] Uses `sanitizePromptInput()` on all string inputs (existing pattern)
- [ ] Add `narrative?: string` to `ParentApiResponse` interface (already exists, used by digest)

### Step 3: Create `NarrativeSummary` component
- [ ] Create `src/components/parent/NarrativeSummary.tsx`
- [ ] Props: `{ data: ParentData }`
- [ ] On mount: render template immediately via `buildNarrativeTemplate(data)`
- [ ] On mount (parallel): fire `fetch('/api/parent', { type: 'generate_narrative', ... })`
- [ ] On AI success: replace template text with AI narrative (no flash — use CSS transition)
- [ ] On AI failure: template stays, no error shown
- [ ] Style: `rounded-2xl shadow-card bg-brand-50 dark:bg-brand-600/10 p-5` (matches assessment card)
- [ ] ~40-60 lines total

### Step 4: Integrate into ParentDashboard
- [ ] Import `NarrativeSummary` in `ParentDashboard.tsx`
- [ ] Insert `<NarrativeSummary data={data} />` between Quick Actions and Weekly Practice card (after line 329)
- [ ] No changes to existing components or data flow
- [ ] No new state in `Dashboard()` — NarrativeSummary manages its own state

### Step 5: Test
- [ ] Unit test `buildNarrativeTemplate` with: full data, empty data, zero days, single domain improving, all declining, no mistakes
- [ ] Manual smoke test: dashboard loads → template visible instantly → AI narrative swaps in after ~300ms
- [ ] Verify existing assessment and weekly report still work unchanged
- [ ] Test with ANTHROPIC_API_KEY unset → template shows, no crash
- [ ] Test dark mode rendering

---

## Files Changed (5 files, 3 new)

| File | Change | Lines |
|------|--------|-------|
| `src/lib/build-narrative-template.ts` | **NEW** — pure template function | ~50 |
| `src/lib/build-narrative-template.test.ts` | **NEW** — unit tests | ~80 |
| `src/app/api/parent/route.ts` | Add `generate_narrative` action to discriminated union | ~40 added |
| `src/components/parent/NarrativeSummary.tsx` | **NEW** — the narrative card component | ~50 |
| `src/components/parent/ParentDashboard.tsx` | Import + render `<NarrativeSummary>` (1 line) | ~2 changed |

**Total new code**: ~220 lines across 5 files
**Existing code modified**: ~2 lines in ParentDashboard, ~40 lines added to parent API route

---

## Risk Assessment

### What could go wrong

1. **AI generates unhelpful text** → Template is always the fallback; parent sees something useful regardless
2. **Extra API call slows dashboard** → Haiku is ~300ms and runs in parallel; template shows instantly
3. **Prompt injection via skill names** → Already mitigated by `sanitizePromptInput()` on all inputs
4. **New Zod schema variant breaks existing actions** → Discriminated union on `type` field; existing variants untouched
5. **Component re-render when AI text arrives** → Single `useState` swap, minimal DOM change

### What this does NOT touch
- No changes to `aggregateParentData()` or any data aggregation logic
- No changes to existing `get_assessment` or `generate_weekly_digest` flows
- No changes to `WeeklyReport`, `MasteryChart`, or `MissedQuestionsByWeek`
- No database schema changes
- No new dependencies
- No changes to the student-facing dashboard

---

## Data Flow Diagram

```
aggregateParentData() → ParentData (already computed)
        │
        ├── buildNarrativeTemplate(data) → template string (instant, ~0ms)
        │         │
        │         └── Renders immediately in NarrativeSummary card
        │
        └── POST /api/parent { type: "generate_narrative", ... }
                  │
                  └── Claude Haiku → polished narrative (~300ms)
                            │
                            └── Replaces template text (CSS transition)
```

---

## Edge Cases to Handle in Template

| Scenario | Template output |
|----------|----------------|
| Zero practice days | "No practice sessions this week yet. Even 15 minutes a day makes a difference!" |
| All domains improving | "Great momentum across all subjects! [specific skill] is really clicking." |
| All domains declining | "This was a lighter week. Getting back to regular practice will help rebuild momentum." |
| No domain data at all | "Getting started is the hardest part. Try a 15-minute session today!" |
| Only one subject practiced | "Focused on [subject] this week with [X] minutes of practice." |
| Sim percentile available | Include: "Their latest practice exam puts them around the Xth percentile." |

---

## Cost Summary

| Metric | Value |
|--------|-------|
| API cost per dashboard load | ~$0.0004 (Haiku) |
| API cost per week (14 loads) | ~$0.006 |
| API cost per month | ~$0.024 |
| Latency added to dashboard | 0ms perceived (template-first) |
| New dependencies | 0 |
| New files | 3 (template, test, component) |
| Existing files modified | 2 (API route, dashboard) |

---

## Review Checklist

- [ ] Template function is a pure function with no side effects
- [ ] AI call failure is invisible to the user (template stays)
- [ ] No PII sent in the AI prompt (only skill names, numbers, percentages)
- [ ] Zod validates all inputs before they reach the AI prompt
- [ ] Dark mode tested
- [ ] Mobile layout tested (card should be full-width)
- [ ] Existing features (assessment, weekly report, charts) unchanged
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
