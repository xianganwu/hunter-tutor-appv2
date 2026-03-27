# Daily Practice Plan Algorithm — Critical Analysis

## What the Algorithm Does Well

**1. Prerequisite-aware prioritization.** The scoring system correctly identifies foundational skills that gate downstream content (`PRIORITY_PREREQUISITE_GAP = 100 + dependents * 5`). With hub skills like `rc_main_idea` gating 7+ downstream skills, fixing a prerequisite gap first is the pedagogically correct choice. This is the strongest part of the design.

**2. Spaced repetition integration.** Mistakes, vocab, and skill retention all use interval-based scheduling. The mistake system's fixed intervals (1, 3, 7, 14, 30 days) are simple and predictable. The SM-2 on skills and vocab provides adaptive spacing.

**3. Domain balance.** The one-skill-per-domain constraint (lines 179-208) ensures breadth across reading and both math domains, preventing a student from only grinding one subject.

**4. Deterministic reproducibility.** Same state → same plan. No randomization means the plan is debuggable and testable. This is an underappreciated engineering quality.

---

## Problems Identified

### Problem 1: Stale Score Can Dominate Everything

The stale score formula is `50 * min(daysSince/7, 3)`, which caps at **150** for skills unpracticed 21+ days. This outranks every priority except prerequisite gaps with 10+ dependents.

**What this means:** A skill the student practiced to 85% mastery three weeks ago scores 150. A brand new foundational skill scores 40. A declining skill at 30% mastery scores 84. The algorithm will prioritize the already-strong-but-stale skill over the genuinely struggling one.

**Is this correct?** Debatable. In pure SRS theory, reviewing a stale skill prevents forgetting. But in exam prep with a finite timeline, spending 12 minutes on a 85%-mastered stale skill instead of a 30%-mastered declining one is likely the wrong tradeoff.

### Problem 2: The 15-Minute Plan Can Be Empty

With a 15-minute budget and no mistakes/vocab due:
- Retention checks need 5 min (fits, but only if skills are due for review)
- Skill practice needs 12 min (fits, but requires remaining >= 12 after retention)
- Drills need 5 min

A brand-new student with zero data and a 15-minute budget gets: one 12-min skill practice task (from priority 4). That's fine. But a moderately advanced student with no due items gets **nothing** until the speed drill step, which requires 5 min. In practice this rarely produces an empty plan, but the algorithm has no explicit "minimum one task" guarantee.

### Problem 3: No Same-Day Recency Protection

If a student practices Fractions for 12 minutes, then regenerates their plan mid-day, Fractions can appear again immediately. The algorithm has no concept of "already practiced today" beyond the completion state of the current plan instance.

This matters because:
- Regeneration happens when changing time budgets (15→30→45)
- The staleness check can invalidate plans mid-day
- A student might manually regenerate

### Problem 4: Near-Mastery Gets the Lowest Priority

Skills at 70-85% mastery score only 30-37.5 points. This is lower than new skills (40), low mastery (60-90), stale (50-150), and declining (70-90). The only things scored lower are skills above 85% mastery (which score 0 and only appear in speed drills).

**The problem:** The 70-85% range is exactly where targeted practice has the highest ROI. A student is close to mastery but hasn't consolidated it. Pushing this to lowest priority means the algorithm favors breadth (new skills) over depth (consolidation). For exam prep specifically, consolidating near-mastered skills is often more valuable than introducing new ones.

### Problem 5: Writing Scheduling Is Calendar-Based, Not Need-Based

`dayOfYear % 3 === 0` is a blunt instrument. It doesn't account for:
- Whether the student has ever done a writing session
- Whether writing is a weak area
- Whether the student has an essay due (external context)
- The student's writing mastery relative to other domains

At 25 minutes, writing also dominates the budget on its scheduled days, potentially crowding out math/reading practice.

### Problem 6: No Engagement or Completion Rate Signal

The algorithm makes no use of:
- How many tasks the student completed yesterday
- Whether they're consistently abandoning certain task types
- Whether they're rushing through drills (the rushing detection in `adaptive.ts` exists but doesn't feed back into plan generation)
- Session duration vs estimated duration

---

## Alternative Approaches

### Option A: Weighted Random Sampling (Instead of Greedy Packing)

**How it works:** Instead of always picking the single highest-scoring skill, treat scores as weights in a probability distribution. Higher-scored skills are more likely to be selected, but not guaranteed.

**What changes:**
- `selectNextSkills()` returns a weighted pool instead of a sorted list
- Each plan generation samples from the pool (seeded by date for reproducibility)
- Same student state on the same day → same plan (deterministic via date seed)

**Pros:**
- Introduces variety without sacrificing priority awareness
- Prevents the same skill from appearing every single day
- Student sees different plans even if their mastery hasn't changed

**Cons:**
- Harder to reason about ("why did it pick this?")
- Can occasionally pick genuinely wrong skills (low-priority over critical)
- Harder to test deterministically without controlling the seed

**Risk:** Low-medium. Core scoring logic unchanged; only the selection step changes. Can A/B test against current approach.

**Recommendation:** Not recommended as primary approach. The current deterministic selection is more aligned with exam prep where there's a clear "right answer" for what to practice. But worth considering for the speed drill tier (priority 6) where variety matters more.

---

### Option B: Fix the Score Bands (Tune Constants Only)

**How it works:** Adjust the priority constants so the ranking reflects actual pedagogical value, without changing the algorithm structure at all.

**Proposed constant changes:**

| Priority | Current Score | Proposed Score | Rationale |
|----------|--------------|----------------|-----------|
| Prerequisite Gap | `100 + deps*5` | `100 + deps*5` | Correct as-is |
| Declining Confidence | `70 + (1-m)*20` | `80 + (1-m)*20` | Declining at low mastery should outrank stale |
| Stale | `50 * min(d/7, 3)` → max 150 | `40 * min(d/7, 2)` → max 80 | Cap at 80 so stale never outranks declining/low mastery |
| Low Mastery | `60 + (1-m)*30` | `65 + (1-m)*30` | Slight bump; struggling skills deserve attention |
| Near Mastery | `30 + (0.85-m)*50` | `50 + (0.85-m)*40` | Bump to 50-56 range; consolidation is valuable |
| New Skill | `40` | `35` | Slight reduction; new skills are less urgent than consolidation |

**What this fixes:**
- Stale score capped at 80, no longer dominates declining (80-100) or low mastery (65-95)
- Near-mastery bumped to 50-56, now outranks new skills (35) and competes with stale (40-80)
- Priority order becomes: prerequisite (100+) > declining (80-100) > low mastery (65-95) > stale (40-80) > near mastery (50-56) > new (35)

**Risk:** **Lowest possible.** Only 6 constants change. Zero structural changes. All existing tests pass. Can be tuned further based on observation.

**Recommendation:** Do this first regardless of any other option chosen. It's the highest-value, lowest-risk change.

---

### Option C: Add a Recency Cooldown

**How it works:** Track which skills were practiced today. Apply a score penalty (or outright exclusion) for skills practiced within the last N hours.

**What changes:**
- Add `lastPracticedToday: Map<skillId, timestamp>` to `DailyPlan` state
- When `autoCompleteDailyTask()` fires, record the timestamp
- In `buildTaskList()`, filter or penalize skills in the cooldown window

**Two sub-options:**

**C1 — Hard exclusion (simpler):**
```
if skill was completed in today's plan → skip it in selectNextSkills
```
Already partially works because tasks completed in the current plan are tracked in `completedTaskIds`. But `regeneratePlanWithBudget()` builds a fresh plan that doesn't inherit this filter.

**C2 — Score penalty (softer):**
```
if skill.lastPracticed is today → score *= 0.3
```
Allows the skill to appear if nothing else is available, but strongly deprioritizes it.

**Risk:** Low. The daily plan already stores `completedTaskIds`. The change is to carry forward the completed skill IDs into the regeneration step as an exclusion set.

**Recommendation:** Implement C1 (hard exclusion) as part of `regeneratePlanWithBudget()` — when rebuilding a plan mid-day, carry forward the skill IDs from completed tasks as an exclusion set. This is ~10 lines of code.

---

### Option D: Add a Minimum Task Guarantee

**How it works:** After `buildTaskList()` completes, if `tasks.length === 0`, append one fallback task.

**What changes:**
```
if (tasks.length === 0) {
  // Pick the highest-priority skill across all domains
  const allPriorities = DOMAINS.flatMap(d => selectNextSkills(getSkillIdsForDomain(d), stateMap))
    .sort((a, b) => b.score - a.score);
  if (allPriorities.length > 0) {
    tasks.push({ type: "drill", skillId: allPriorities[0].skillId, estimatedMinutes: 5, ... });
  }
}
```

**Risk:** Lowest possible. 5-6 lines, only fires in the empty-plan edge case.

**Recommendation:** Yes, do this. It's a safety net that prevents a blank dashboard.

---

### Option E: Need-Based Writing Scheduling

**How it works:** Replace `dayOfYear % 3 === 0` with a scoring mechanism that considers:
1. Days since last writing session
2. Writing mastery relative to other domains
3. Whether the student has done any writing this week

**What changes:**
- Load writing skill masteries (already available via `getSkillIdsForDomain("writing")`)
- Compute average writing mastery
- If writing mastery < average of other domains AND days since last writing >= 3 → schedule writing
- Otherwise, skip writing and allocate time to math/reading

**Risk:** Low-medium. Replaces a simple calendar check with a data-driven decision. Requires loading one extra domain's mastery data.

**Recommendation:** Worth considering but not urgent. The current approach ensures writing happens regularly (every 3 days) regardless of performance. A need-based approach could accidentally deprioritize writing for students who avoid it — which is the opposite of what you want. The `% 3` approach is crude but safe.

---

### Option F: Replace Greedy Packing with Constraint Optimization

**How it works:** Instead of adding tasks sequentially until budget is exhausted, formulate task selection as a knapsack problem: maximize total priority score within the time budget.

**What changes:**
- Generate a candidate pool of all possible tasks (mistake review, vocab, retention, skill practice, writing, drills)
- Each task has a value (priority score) and a cost (minutes)
- Solve the 0/1 knapsack to find the maximum-value subset that fits the budget

**Pros:**
- Globally optimal allocation (greedy can miss better combinations)
- Naturally handles budget overflow (writing day example)
- Can add constraints like "at most 1 per domain" or "at least 1 review task"

**Cons:**
- Overkill for 5-8 candidate tasks (greedy is already near-optimal at this scale)
- Harder to explain to a parent "why this plan?"
- Knapsack introduces combinatorial complexity (though negligible for N<10)

**Risk:** Medium. More structural change than other options. The greedy approach is likely within 5% of optimal for this problem size.

**Recommendation:** Not recommended. The candidate pool is small enough (typically 8-12 possible tasks) that greedy packing produces near-optimal results. The complexity isn't worth the marginal improvement.

---

## Recommendation Summary

| Option | Impact | Risk | Recommendation |
|--------|--------|------|----------------|
| **B. Tune score constants** | High | Lowest | **Do first.** Fixes stale dominance and near-mastery undervaluing. |
| **D. Minimum task guarantee** | Low | Lowest | **Do.** Safety net, 5 lines. |
| **C1. Recency exclusion on regen** | Medium | Low | **Do.** Prevents same-skill-twice-today on mid-day regen. |
| **E. Need-based writing** | Medium | Low-Med | **Defer.** Current approach is crude but safe. |
| **A. Weighted random sampling** | Medium | Low-Med | **Defer.** Consider for speed drill tier only. |
| **F. Knapsack optimization** | Low | Medium | **Skip.** Overkill for this problem size. |

**The highest-value path is B + D + C1: tune the constants, guarantee a non-empty plan, and add recency exclusion on regeneration. Total risk: minimal. Total new code: ~25 lines of logic changes.**
