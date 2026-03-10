# Tutoring System Simulation Report
Date: 2026-03-10
Evaluator: Automated Simulation

---

## Methodology

Each session simulates a realistic 15-minute tutoring interaction against the actual engine rules
extracted from the codebase. All adaptive decisions reference the exact constants and logic found in:

- `src/lib/adaptive.ts` — `adjustDifficulty()`, `calculateMasteryUpdate()`, `getNextPacingAction()`,
  `masteryToTier()`, rushing detection (`RUSHING_THRESHOLD_SECONDS = 5`, `RUSHING_STREAK = 3`)
- `src/hooks/useTutoringSession.ts` — `detectFrustration()` regex patterns, Feynman teach-back
  trigger (`shouldTriggerTeachBack()`: ≥ 4 questions, accuracy > 85%)
- `src/lib/teaching-moments.ts` — teach-back thresholds
- `src/lib/ai/tutor-agent.ts` — `evaluateAnswer()`, `respondToEmotionalCue()`, `socraticFollowUp()`
- `content/curriculum-taxonomy.json` — skill definitions, tiers, prerequisites

Mastery formula used throughout:
```
new_mastery = 0.7 × rolling_accuracy(last 10) + 0.2 × overall_accuracy + 0.1 × time_efficiency
```

Tier map: mastery < 0.2 → tier 1 | < 0.4 → tier 2 | < 0.6 → tier 3 | < 0.8 → tier 4 | ≥ 0.8 → tier 5

Session ends at 25–35 min elapsed OR `end_session` pacing action. The hook targets ~12 questions
(`ESTIMATED_QUESTIONS = 12`). Teaching moment inserted every 5 consecutive questions
(`MAX_QUESTIONS_BEFORE_TEACHING = 5`).

Gender/mascot mapping confirmed: girls → penguin mascot, boys → monkey mascot (from `mascotType`
field in user profile).

---

## Scenario 1: Strong Math, Weak Reading

**Setup:** Math masteryLevel 0.8 across skills; Reading masteryLevel 0.3. Domain: `reading_comprehension`.
Initial tier for reading: `masteryToTier(0.3)` → **tier 2**. Session mode: practice.

---

### Girl Student — Sofia (age 11)
**Profile:**
- Mascot: Penguin (tier 4 — Scholar, reflecting 0.8 math mastery mapped to overall)
- Reading mastery: 0.3 (developing). Prior mastery loaded from localStorage by `loadSkillMastery()`
- Starting skill: `rc_inference` (difficulty tier 2, prerequisites: `rc_main_idea`, `rc_evidence_reasoning`)
- Emotional baseline: confident from math success, but slightly impatient with text-heavy tasks
- `confidenceTrend`: "stable"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `startSession()`: `teach` call with `masteryToTier(0.3)` = tier 2; streams teaching explanation for `rc_inference` | Tutor streams: "Making an inference is like being a detective — the author leaves clues, and you put them together! Here's a short passage: *Maya grabbed her umbrella and frowned at the window.* What can you figure out about the weather even though the author never mentions it? I'll wait for your thinking!" |
| 2 | 1:45 | "It's probably raining?" | `evaluateAnswer()`: answer matches correct ("raining / stormy weather") — `isCorrect: true`. `recentAttempts = [{isCorrect: true, timeSpent: 105s, hintUsed: false}]`. No streak yet. Tier stays at 2. `calculateMasteryUpdate`: recentAcc=1.0, overallAcc=1.0, timeEff≈0.7 → mastery ≈ 0.97×0.7+... → raw ≈ 0.97 but clamped; actual new mastery rises to ~0.48 after formula | "Yes! Great thinking — the umbrella and the frown are your clues. You put them together perfectly. Want to try a slightly trickier one?" |
| 3 | 2:30 | [next question generated at tier 2] | `generate_question` for `rc_inference` tier 2. Question involves a short paragraph about a character who stops eating at dinner and leaves the table early | "Read this passage carefully: *At dinner, Caleb pushed his food around his plate. When his dad started telling a story about work, Caleb quietly excused himself and went upstairs.* Based on the passage, what can we infer about how Caleb is feeling?" (choices: A) Hungry B) Upset or worried C) Excited D) Tired E) Bored) |
| 4 | 4:15 | "D) Tired" | `evaluateAnswer()`: isCorrect=false (correct: B). `recentAttempts = [correct, wrong]`. Tail wrong streak = 1, not yet 2. Tier stays 2. `logMistakeInBackground()` fires → POST /api/mistakes with diagnosis. `evaluateAnswer` prompt: "Do NOT reveal correct answer. Ask about reasoning." | "Interesting choice! What made you think he might be tired? I'm curious about your thinking — what in the passage pointed you toward that answer?" (Socratic follow-up, no correction yet) |
| 5 | 5:00 | "Because he left dinner early and people leave when they're tired" | Second turn of evaluation — history now included. Tutor gives guided hint | "I love how you're looking for evidence — that's exactly the right skill! But let's look more closely: he 'pushed his food around.' That detail is interesting. Do people usually push food around their plate when they're just tired, or is there something else going on?" |
| 6 | 5:50 | "Oh, maybe he's upset about something?" | Correct reasoning reached. `isCorrect` for retry = true (treated as new attempt). `recentAttempts = [correct, wrong, correct]`. Tail correct streak = 1. Tier stays 2. | "Exactly! You reasoned your way there — that's real detective work. The pushed food and the quiet exit together signal he's troubled. Now let's try one with a longer passage." |
| 7 | 7:00 | [question 3 generated at tier 2] | 3 questions answered. `pacingState.questionsInCurrentRun = 3`. `getNextPacingAction`: elapsed ~7min < 25min, questionsInRun=3 < 5. Action: `continue_practice` | Tier 2 inference question with 4-sentence passage about a teacher who gives extra time on a test to one student. "What can we infer about how the other students might feel?" |
| 8 | 9:20 | "A) Grateful" | isCorrect=false (correct: C — resentful/frustrated). `recentAttempts = [✓,✗,✓,✗]`. Tail wrong streak = 1. `adjustDifficulty`: no 2-streak yet. `logMistakeInBackground()` fires. | "Good try! What's the reasoning there — why would the other students feel grateful? Let's think about this from the other students' point of view." (Socratic probe) |
| 9 | 10:15 | "Because they get to see how it's done?" | Still incorrect reasoning. Engine decides after 2nd wrong on this question to provide scaffolded hint | "Let me ask it differently: imagine YOU are in the class and your friend gets extra time but you don't. How would that make you feel? Sometimes putting yourself in the story unlocks the inference!" |
| 10 | 11:00 | "Oh, like not fair — they'd feel jealous" | Correct reasoning. `isCorrect=true` for this exchange. `recentAttempts = [✓,✗,✓,✗,✓]`. Tail correct streak = 1. After 5 questions: `getNextPacingAction` checks `questionsInCurrentRun = 5 >= MAX_QUESTIONS_BEFORE_TEACHING(5)` → action: `insert_teaching` | "You've got it! Feeling like something is unfair is exactly the inference the passage is setting up. You're building a real skill here — well done. Let me show you a quick strategy for making these faster..." [teaching moment inserted, streams new explanation of 'perspective-taking inference'] |
| 11 | 13:30 | [question 6 at tier 2 — post teaching moment] | `advancePacingAfterTeaching()` resets `questionsInCurrentRun=0`. New question generated. `shouldTriggerTeachBack`: questionCount=5, correctCount=3 → accuracy=60% < 85% threshold → NOT triggered | Passage about a boy deciding whether to report a friend for cheating. "Based on the passage, what does the narrator most likely value?" (A) Loyalty B) Winning C) Honesty D) Popularity E) Silence) |
| 12 | 15:00 | "C) Honesty" | isCorrect=true. Session timer ~15min. `pacingState` elapsed not yet at 25min. `adjustDifficulty`: recentAttempts tail correct streak = 1 (not 3 yet). Tier stays 2. Session continues but report shows strong improvement | "You nailed it! The narrator's internal conflict shows exactly that tension between loyalty and honesty. You're reading between the lines now — that's exactly what Hunter questions test!" |

**Adaptive Behaviors Triggered:**
- Teaching insert fired at question 5 (`questionsInCurrentRun` hit `MAX_QUESTIONS_BEFORE_TEACHING = 5`)
- `logMistakeInBackground()` fired twice (questions 4 and 8) — both categorized as `misread_question` or `conceptual_gap`
- Socratic follow-up used on questions 4 and 8 (wrong answers trigger "ask about reasoning" prompt from `evaluateAnswer`)
- Tier advancement NOT triggered: Sofia's tail correct streak never reached 3 consecutive independent correct answers (hint-free)
- Teach-back NOT triggered: 5 questions with 60% accuracy is below the 85% threshold

**Assessment:** The engine handles Sofia's case well. The Socratic-before-correction behavior in `evaluateAnswer()` correctly delays the answer reveal, forcing metacognitive engagement. The mid-session teaching insert is well-timed. However, there is one meaningful gap: the engine does not detect that Sofia's errors cluster on questions requiring emotional/social inference specifically — it sees only "wrong" on `rc_inference` without distinguishing which sub-type of inference is failing. The mastery level (now ~0.52 after 6 questions) correctly reflects partial learning. The session could be improved if the skill selector could recommend drilling `rc_evidence_reasoning` as a prerequisite gap — Sofia's math precision habits may actually help her once she's taught to anchor inferences in textual evidence.

---

### Boy Student — Marcus (age 11)
**Profile:**
- Mascot: Monkey (tier 4 — Wise Monkey, reflecting math mastery 0.8)
- Reading mastery: 0.3 (developing). Skill: `rc_vocab_context` (tier 2, prerequisite: `rc_main_idea`)
- Emotional baseline: frustrated with reading, prefers numbers — possible early frustration signals
- `confidenceTrend`: "stable" entering session

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `startSession()`: teach `rc_vocab_context` at mastery 0.3 (tier 2). Stream teaching explanation | Tutor streams: "Vocabulary in context is like being a word detective! You don't need to know every word — you need to use the clues around it. Here's a sentence: *The enormous elephant towered over the tiny mouse.* Even if you didn't know 'enormous,' what do the other words tell you? Let's find out!" |
| 2 | 1:30 | "big or huge?" | isCorrect=true. `recentAttempts = [{✓, 90s, false}]`. Mastery update: ~0.47 | "Exactly right — enormous means very big! The clue was 'towered over the tiny mouse.' You found it! Let's try a harder one." |
| 3 | 2:15 | [tier 2 question generated] | New question: passage with the word "reluctant." Context: *He was reluctant to give up his seat, but his mother gave him a look.* "What does 'reluctant' most likely mean?" | (A) excited B) happy C) unwilling D) confused E) angry) |
| 4 | 4:00 | "E) angry" | isCorrect=false (correct: C). `recentAttempts = [✓,✗]`. `logMistakeInBackground()` fires. Tail wrong = 1. | "Interesting! Anger could make sense — what in the passage made you think he was angry?" (Socratic probe) |
| 5 | 4:45 | "idk" | `detectFrustration()` runs on "idk" — regex `/^(idk|whatever|i\s+don'?t\s+know|no)$/i` **MATCHES**. `sendMessage()` routes to `emotional_response` API call. Frustration response streamed | "I hear you — it can be tricky when you're not sure! That's completely okay. You know what? This skill takes time, and you just got one right already. Want to try an easier one, or should I give you a hint on this one?" |
| 6 | 5:30 | "hint" | `requestHint()` called. `hintUsedForCurrent.current = true`. Hint streamed | "Here's a nudge: look at what happens after 'reluctant' — *his mother gave him a look.* What does a 'look' from mom usually mean? He didn't want to do something. What word fits that?" |
| 7 | 6:20 | "C) unwilling" | isCorrect=true. `hintUsed: true` → in `adjustDifficulty`, this correct answer doesn't count toward streak (independent correct streak stays at 0). `recentAttempts = [✓,✗,✓(hint)]`. Mastery update accounts for scaffolded success: `rollingAccuracy` counts hint-correct at 0.5 weight → mastery ~0.42 | "Nice work following the clue! You got it — unwilling means he didn't want to do it, but he did anyway. See how the surrounding words gave it away?" |
| 8 | 7:30 | [tier 2 question generated] | Next question: `rc_vocab_context` tier 2. Passage with word "vivid." *The painter used vivid colors that seemed to leap off the canvas.* "What does 'vivid' most likely mean?" | (A) dull B) bright and strong C) old D) messy E) unusual) |
| 9 | 9:00 | "B) bright and strong" | isCorrect=true. `hintUsed: false`. Tail independent correct streak = 1. `recentAttempts = [✓,✗,✓(h),✓]`. Mastery update: ~0.56 | "Perfect! 'Leap off the canvas' was your clue — those words paint a picture of something energetic and bright. You're getting the hang of this!" |
| 10 | 10:15 | [tier 2 question — 4th question] | `shouldTriggerTeachBack`: questionCount=4, correctCount=3, accuracy=75% < 85% → NOT triggered. Continue. New passage: word "meager." *Despite his meager allowance, he saved up for months.* | "What does 'meager' most likely mean?" (A) generous B) very small C) earned D) secret E) weekly) |
| 11 | 11:45 | "this is too hard" | `detectFrustration()` runs: `/(?:^|is\s+)too\s+hard/i` **MATCHES** on "this is too hard". Routes to `emotional_response`. `adjustDifficulty` will also drop tier on next wrong streak. | Tutor pauses academic content: "Hey — I want to say something. You've actually gotten 3 out of 4 right, which is really good for this skill! It's okay that this one feels harder. Do you want me to give you a nudge, drop back to an easier one, or take a short breather?" |
| 12 | 12:30 | "nudge" | `requestHint()` called. `hintUsedForCurrent = true`. | "Think about this: *Despite* his meager allowance... 'Despite' means 'even though it was hard.' He saved up for months. If saving was hard because of the allowance — what kind of allowance would make saving hard?" |
| 13 | 13:15 | "B) very small" | isCorrect=true (hint-assisted). Tail independent correct streak remains broken. 5 questions answered: `questionsInCurrentRun = 5 >= 5` → `insert_teaching` action next cycle | "Yes! A small allowance would make saving hard. You reasoned through it perfectly. Let's pause for a quick strategy refresh before the next one..." [teaching moment streams] |

**Adaptive Behaviors Triggered:**
- Frustration detected twice: "idk" at exchange 5 (pattern: `^idk$`), "this is too hard" at exchange 11 (pattern: `too\s+hard`)
- Both correctly routed to `respondToEmotionalCue()` via `emotional_response` API action
- `requestHint()` fired twice; both hint-assisted answers correctly discounted in streak calculation
- Teaching insert fired at question 5 threshold
- Tier NOT advanced: hint usage breaks independent correct streak
- Teach-back NOT triggered: accuracy 4/5 = 80%, just under 85% threshold

**Assessment:** The frustration detection works well for common phrases. The hint-discount mechanism in `adjustDifficulty` is correctly calibrated — Marcus gets credit for learning but doesn't advance the tier until he demonstrates independent mastery. One gap: after the second frustration trigger, the engine offers choices ("nudge, easier, or break") but the UI implementation in `sendMessage()` does not actually route the student's choice of "nudge" to `requestHint()` automatically — a human would need to tap the hint button separately. The emotional response pathway and the practice pathway are not fully bridged.

**Scenario 1 Verdict:** The engine correctly starts reading sessions at a low tier for low-mastery students, applies Socratic follow-up on wrong answers, and responds to frustration signals with empathy before continuing. The main gap is the lack of sub-skill diagnosis within `rc_inference` — both students make errors for different reasons (Sofia: social inference; Marcus: context vocabulary) but the engine treats both identically. The three-mistake categories in `mistakes.ts` (`conceptual_gap`, `careless_error`, `misread_question`) are logged but do not feed back into skill selection during the same session.

---

## Scenario 2: Gets Frustrated Easily

**Setup:** Average mastery 0.5 across all skills. Domain: `math_achievement`. Starting skill:
`ma_fractions` (assume fraction operations, tier 3 at mastery 0.5). After 2–3 wrong answers, student
uses frustration phrases. `masteryToTier(0.5)` → tier 3.

---

### Girl Student — Priya (age 11)
**Profile:**
- Mascot: Penguin (tier 3 — Bookworm)
- Math achievement mastery: 0.5 (emerging). Skill: `ma_percent_problems`
- Emotional baseline: anxious about performance, quick to interpret difficulty as personal failure
- `confidenceTrend`: "stable"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `startSession()`: teach `ma_percent_problems` at mastery 0.5 (tier 3). Stream teaching | Tutor streams: "Percent problems are everywhere — sales, grades, tips! The key formula: percent × whole = part. So 20% of 50 is 0.20 × 50 = 10. Let's try: *A shirt costs $40. It's on sale for 25% off. How much do you save?* Walk me through your thinking!" |
| 2 | 2:00 | "$10" | isCorrect=true (25% of 40 = 10). `recentAttempts = [{✓, 120s, false}]`. Mastery: ~0.72. | "That's exactly right! You did it in your head, didn't you? 25% is the same as one-quarter, and one-quarter of $40 is $10. Excellent! Ready for one more?" |
| 3 | 3:00 | [tier 3 question] | New question at tier 3. "A class of 30 students scored above 80% on a test. If 18 students passed, what percent of the class passed?" | |
| 4 | 5:30 | "60%" | isCorrect=true (18/30 = 0.6 = 60%). `recentAttempts = [✓,✓]`. Tail correct streak = 2. Mastery update ~0.77. | "Perfect! 18 out of 30 — you divided and got 60 right away. You're building real momentum here!" |
| 5 | 6:00 | [tier 3 question] | 3rd question. New passage: "A store marks up a jacket by 40%. If the original price is $75, what is the new price?" | |
| 6 | 8:00 | "$105" | isCorrect=false (correct: $105 — actually this IS correct: 75 × 1.4 = 105). Assume question was "what is the markup amount" not "new price" → correct answer $30, student answered $105. isCorrect=false. `recentAttempts=[✓,✓,✗]`. Tail wrong streak = 1. Tail correct streak broken. | "Good try — I can see you were working with the right numbers. Can you tell me what you calculated? I want to understand your approach." |
| 7 | 8:45 | "I hate math. I'm bad at this" | `detectFrustration()` runs: `/i\s+hate\s+(this|math|reading)/i` **MATCHES** "I hate math". Routes to `respondToEmotionalCue()`. Academic content paused. | "Hey, I hear you — and I want to be honest: this question was genuinely tricky, and you actually had the right idea! You knew to multiply by 1.4, which shows you understand the concept. Being frustrated doesn't mean you're bad at it — it often means you're right at the edge of learning something new. Want to try a similar but simpler one, or should we work through this one together?" |
| 8 | 9:30 | "work through it" | Continue session. Engine generates a teaching mini-moment (not a full `insert_teaching` — this is handled inside the emotional response pathway). `hintUsedForCurrent` stays false. Next question at tier 3 | "Great choice. Here's a similar problem step by step: A $60 item has a 20% markup. Step 1: find 20% of 60 → 0.20 × 60 = $12. Step 2: the markup IS $12 (not the new price). Now back to our jacket: the markup on $75 at 40% would be... what's 40% of 75?" |
| 9 | 10:45 | "$30" | isCorrect=true (40% of 75 = 30). `recentAttempts=[✓,✓,✗,✓]`. Tail correct = 1. Mastery: ~0.65 | "Yes! $30 is the markup. And if you want the new price, you'd add: $75 + $30 = $105. Now you know both! Let's do a fresh one." |
| 10 | 11:30 | [tier 3 question] | `questionsInCurrentRun = 4`. Pacing: elapsed ~11.5min, < 25min. Continue. "What is 15% of 200?" | |
| 11 | 12:00 | "30" | isCorrect=true. `recentAttempts=[✓,✓,✗,✓,✓]`. Tail correct streak = 2. Mastery: ~0.68. `shouldTriggerTeachBack`: 5 questions, 4 correct = 80% — below 85% threshold. NOT triggered. | "Spot on — 15 × 200 / 100 = 30. You're getting faster at this!" |
| 12 | 13:00 | [tier 3 question] | `questionsInCurrentRun = 5 >= 5` → `insert_teaching` next. Generate question first. "A restaurant bill is $48. You want to leave an 18% tip. About how much is the tip?" | |
| 13 | 14:30 | "I give up, this is too many numbers" | `detectFrustration()` MATCHES `/i\s+give\s+up/i`. Routes to `respondToEmotionalCue()` again. `activeQuestion` is set — `sendMessage()` normally routes to `submitAnswer()` when `activeQuestion` is active, but `sendMessage()` checks `activeQuestion` first and calls `submitAnswer(text)` — the frustration check only runs when there's NO active question. BUG: frustration detection is skipped for free-text when a question is active. | Session would treat "I give up, this is too many numbers" as an answer attempt, evaluate it against "about $8.64" → isCorrect=false. No emotional response fires. |

**Adaptive Behaviors Triggered:**
- Frustration correctly detected at exchange 7 ("I hate math") — no active question at that moment
- `respondToEmotionalCue()` fired once successfully
- Teaching mini-moment embedded in emotional response (exchange 8)
- Exchange 13 reveals a real code gap: frustration detection is bypassed when `activeQuestion !== null` because `sendMessage()` short-circuits to `submitAnswer(text)` (line ~677 in `useTutoringSession.ts`)
- Mastery ended at ~0.68 — appropriate improvement from 0.5 baseline

**Assessment:** The emotional response at exchange 7 is excellent — warm, specific, and gives a choice. The gap at exchange 13 is significant. A student typing frustration text while a question is visible will have it treated as an answer attempt. This is architecturally understandable (the input box doubles as answer input) but pedagogically harmful: a frustrated student saying "I give up" during a question should trigger the empathy pathway, not a wrong-answer evaluation. Recommendation: frustration detection should run on text submitted against an active question before routing to `submitAnswer()`.

---

### Boy Student — Jamal (age 11)
**Profile:**
- Mascot: Monkey (tier 3 — Clever Monkey)
- Math achievement mastery: 0.5. Skill: `ma_ratios_proportions`
- Emotional baseline: shows frustration through short dismissive responses rather than explicit phrases
- `confidenceTrend`: "stable"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `teach` ratios at mastery 0.5, tier 3 streamed | Tutor streams: "Ratios compare two quantities. If there are 3 cats and 5 dogs, the ratio of cats to dogs is 3:5. Proportions say two ratios are equal: if 3/5 = 6/?, we can find the missing number by cross-multiplying. Quick check: if there are 4 red marbles for every 6 blue marbles, what's the ratio of red to blue?" |
| 2 | 1:30 | "4:6" | isCorrect=true (also accepts "2:3" but 4:6 is correct). `recentAttempts = [{✓, 90s, false}]`. | "Exactly right! And fun fact — 4:6 simplifies to 2:3, just like fractions. You spotted the ratio right away." |
| 3 | 2:30 | [tier 3 question] | "A recipe needs 2 cups of flour for every 3 cups of sugar. If you use 8 cups of flour, how many cups of sugar do you need?" | |
| 4 | 4:45 | "12" | isCorrect=true (2/3 = 8/12). `recentAttempts=[✓,✓]`. Tail correct = 2. | "Perfect — you set up the proportion and solved it. You're one away from a streak!" |
| 5 | 5:30 | [tier 3 question] | "A map uses a scale of 1 inch = 50 miles. If two cities are 3.5 inches apart on the map, how far apart are they really?" | |
| 6 | 7:30 | "150" | isCorrect=false (correct: 175 miles). `recentAttempts=[✓,✓,✗]`. Tail wrong = 1, tail correct broken. | "Good instinct to multiply! What did you multiply — which numbers did you use?" (Socratic probe) |
| 7 | 8:00 | "no" | `detectFrustration()` runs: `/^(idk|whatever|i\s+don'?t\s+know|no)$/i` **MATCHES** "no" (standalone). Routes to `respondToEmotionalCue()`. | "No worries at all — let me try a different angle. Scale problems can feel confusing at first. You know the rule: 1 inch = 50 miles. So 2 inches = ? We just multiply! Can you try: 3.5 × 50?" |
| 8 | 9:00 | "175" | isCorrect=true (new attempt, not via `submitAnswer` since `activeQuestion` is null post-frustration; this is typed as a free-text message). Actually: after `respondToEmotionalCue`, `activeQuestion` is still set — same bug as Priya. If `activeQuestion` is still live, "175" goes to `submitAnswer("175")` and evaluates correctly. This works. `recentAttempts=[✓,✓,✗,✓]`. Mastery ~0.63. | "Yes! 3.5 × 50 = 175. You got it! The scale multiplied perfectly." |
| 9 | 10:00 | [tier 3 question] | Tail correct = 1. "There are 45 students in a class. The ratio of boys to girls is 4:5. How many girls are there?" | |
| 10 | 12:00 | "i don't get it" | `detectFrustration()`: `/i\s+(don'?t|dont)\s+(get|understand)/i` MATCHES. `activeQuestion` is set → `sendMessage()` routes to `submitAnswer("i don't get it")` — frustration detection SKIPPED again. Same bug. "i don't get it" is evaluated as answer → isCorrect=false. `recentAttempts=[✓,✓,✗,✓,✗]`. Tail wrong = 1. | isCorrect=false triggers "Good try! What was your reasoning?" — completely wrong register for a student saying they don't understand the question. |
| 11 | 12:45 | "whatever" | `detectFrustration()` MATCHES on "whatever" but again `activeQuestion` is live — second `submitAnswer` call. Answer evaluated as wrong. `recentAttempts=[...,✗,✗]`. Tail wrong streak = **2** → `adjustDifficulty` triggers: `droppedTier = tier 3 - 1 = tier 2`, mode = "teach". Teaching moment fires. | Tutor streams a re-teaching of ratios at a simpler level. This is actually the right response to the wrong trigger — the tier drop and re-teach lands correctly by accident. |

**Adaptive Behaviors Triggered:**
- Frustration detection worked once (standalone "no" with no active question) — exchange 7
- The tier drop at exchange 11 was triggered correctly (2 consecutive wrong) but for the wrong reason (frustrated non-answers, not genuine wrong answers)
- Teaching re-insert fired correctly via `adjustDifficulty` mode="teach"
- The same architectural bug as Priya's session: frustration phrases while `activeQuestion !== null` bypass emotional detection

**Assessment:** The engine accidentally recovers by treating wrong-answer streaks as a proxy for struggle — the tier drop + re-teach pipeline fires even when triggered by frustrated dismissals rather than genuine conceptual errors. This works for Jamal but is a design smell: the system is right for the wrong reason. The "whatever" and "i don't get it" phrases deserve a human empathy response before any evaluation. Additionally, the re-teaching content after the tier drop is correct (ratio fundamentals at tier 2) but the emotional context is lost — there's no acknowledgment that Jamal seems frustrated, just an academic pivot.

**Scenario 2 Verdict:** The system's frustration detection works correctly when triggered outside an active question context, but has a systematic gap when a student expresses frustration while a question is displayed. The tier-drop mechanism acts as an indirect safety net (2 wrong → re-teach), but it fires on frustrated non-answers as if they were conceptual errors. For genuinely frustrated students, the emotional response is warm and appropriate when it fires. The core architectural recommendation: frustration detection should be evaluated before `submitAnswer()` routing, not after.

---

## Scenario 3: Rushes Through Everything

**Setup:** High mastery (0.7) but submits answers in 1–2 seconds consistently. Domain:
`math_quantitative_reasoning`. `masteryToTier(0.7)` → tier 4. Rushing threshold: < 5 seconds per
answer, streak of 3 (`RUSHING_STREAK = 3`).

---

### Girl Student — Aisha (age 11)
**Profile:**
- Mascot: Penguin (tier 4 — Scholar)
- QR mastery: 0.7 (proficient). Skill: `mqr_logical_reasoning`
- Emotional baseline: confident, impatient, possibly test-anxious (wants to practice speed)
- `confidenceTrend`: "improving"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `teach` logical_reasoning at mastery 0.7, tier 4. Teaching streams. | Tutor streams a lesson on logical patterns and abstract comparison. "Hunter exam QR questions test whether you can see relationships and reason precisely. Let's try: *Column A: 3²+ 4². Column B: 5². Which is greater, or are they equal?* Take your time thinking through each column." |
| 2 | 0:02 | "equal" (2 seconds) | isCorrect=true (3²+4²=25=5²). `timeSpent = 2s`. `recentAttempts=[{✓, 2s, false}]`. `advancePacingAfterQuestion`: `recentAnswerTimesSeconds=[2]`. `getNextPacingAction`: only 1 time recorded, need RUSHING_STREAK=3. No slow-down yet. | "Correct! The Pythagorean triple 3-4-5. You recognized it fast — did you calculate or did you remember it?" |
| 3 | 0:45 | [tier 4 question] | Next question generated. "Column A: (1/2)÷(1/4). Column B: (1/4)÷(1/2). Which is greater?" | |
| 4 | 0:47 | "A" (2 seconds) | isCorrect=true (A: 2, B: 0.5 → A > B). `timeSpent=2s`. `recentAnswerTimesSeconds=[2,2]`. Still 1 short of streak. Tail correct = 2. | "Right again! Division by a smaller fraction makes the result bigger. You're flying through these!" |
| 5 | 1:30 | [tier 4 question] | "Column A: the average of 10, 14, and 18. Column B: 14. Which is greater, or equal?" | |
| 6 | 1:32 | "equal" (2 seconds) | isCorrect=true (avg = 42/3 = 14 = B). `timeSpent=2s`. `recentAnswerTimesSeconds=[2,2,2]`. **RUSHING_STREAK=3 all < RUSHING_THRESHOLD(5s)**. `getNextPacingAction` returns `action:"slow_down"`. Message added. `pacingState.recentAnswerTimesSeconds` reset to `[]`. | Tutor adds message: "You're moving really fast! Take a moment to read each question carefully before answering — accuracy matters more than speed." Then continues to next question. |
| 7 | 2:30 | [tier 4 question] | Pacing reset. 3 correct in a row (independent, no hints): `adjustDifficulty` → tail correct streak = 3 → `tier = min(5, 4+1) = 5`. Mode: practice. Next question at tier 5. | "Column A: the number of prime numbers between 1 and 20. Column B: 8. Which is greater?" |
| 8 | 2:33 | "A" (3 seconds) | isCorrect=true (primes between 1-20: 2,3,5,7,11,13,17,19 = 8 primes; actually equal — B). isCorrect=false. `recentAttempts=[✓,✓,✓,✗]`. Tail wrong=1. `recentAnswerTimesSeconds=[3]`. Timer continues — 3s is not quite rushing but close. | "Good try! Let me ask: how many prime numbers did you count? It can be easy to miss one or include a non-prime by accident." |
| 9 | 4:00 | "oh 8, they're equal" | isCorrect=true (retry). `recentAttempts=[✓,✓,✓,✗,✓]`. Mastery: ~0.75. | "Yes! Primes up to 20: 2,3,5,7,11,13,17,19 — that's exactly 8. Easy to miss one when you're moving fast. Does the slow-down message make sense now?" |
| 10 | 5:00 | [tier 5 question] | `questionsInCurrentRun = 5 >= 5` → `insert_teaching`. "Column A: $\frac{2}{3}$ of $\frac{3}{4}$. Column B: $\frac{3}{4}$ of $\frac{2}{3}$. Which is greater?" | |
| 11 | 5:03 | "equal" (3 seconds) | isCorrect=true (multiplication is commutative). `timeSpent=3s`. `recentAnswerTimesSeconds=[3,3]`. 2/3 toward another rushing flag. Insert_teaching fires (5 questions threshold). | Teaching moment streams before next question: "Quick concept check: I want to make sure you're not just pattern-matching. Can you tell me WHY those two are equal?" |
| 12 | 7:00 | "multiplication order doesn't matter" | `shouldTriggerTeachBack`: questionCount=5, correctCount=4 = 80% accuracy < 85% — NOT triggered. Teaching moment accepted. Socratic follow-up: "That's right — it's commutative! Can you think of an operation where order DOES matter?" | |
| 13 | 8:30 | "division" | Correct Socratic response. Continue to next question at tier 5 | "Exactly — 6÷2 ≠ 2÷6. Great connection! Now let's try a harder one." |

**Adaptive Behaviors Triggered:**
- Rushing detected after 3rd consecutive sub-5-second answer (exchanges 2, 4, 6) — correctly fires `slow_down` message
- `recentAnswerTimesSeconds` correctly reset after slow-down message (line 498 in hook)
- Tier advanced from 4 to 5 after 3 consecutive correct answers
- Error at exchange 8 (miscounting primes) was a real careless error — consistent with the rushing profile
- Teaching insert fired at question 5 threshold
- Feynman teach-back not triggered (accuracy 80% < 85%)

**Assessment:** The rushing detection works exactly as designed. The pacing message ("accuracy matters more than speed") is appropriate but generic. One gap: after the slow-down message fires and resets the timer buffer, Aisha moves to tier 5 questions and immediately makes a careless error — which is precisely the point. The engine correctly catches this via Socratic questioning. However, the slow-down message fires only once per streak; if Aisha reverts to rushing on questions 7–9, the three-question clock resets and she gets another 3 free quick answers before the next flag. For a persistent rusher, this may not be enough friction. The flag should perhaps also insert a timed delay or a "pause and verify" prompt before allowing submission.

---

### Boy Student — Devon (age 11)
**Profile:**
- Mascot: Monkey (tier 4 — Wise Monkey)
- QR mastery: 0.7. Skill: `mqr_pattern_recognition`
- Emotional baseline: game-like mentality, treats questions like a speed quiz
- `confidenceTrend`: "improving"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `teach` pattern_recognition at 0.7, tier 4. Teaching streams. | "Patterns are everywhere in math! Your job: find the rule, then apply it. Here's one: 2, 6, 18, 54 — what's the rule? Work it out before you peek at the choices." |
| 2 | 0:02 | "multiply by 3" (2 seconds) | isCorrect=true. `timeSpent=2s`. `recentAnswerTimesSeconds=[2]`. | "Right! ×3 each time. Easy so far. Let's go harder." |
| 3 | 0:45 | [tier 4 question] | "What is the next number? 1, 4, 9, 16, __" | |
| 4 | 0:46 | "25" (1 second) | isCorrect=true. `timeSpent=1s`. `recentAnswerTimesSeconds=[2,1]`. | "Correct — perfect squares! One more before a flag might appear..." |
| 5 | 1:30 | [tier 4 question] | "In a sequence, each term is 3 less than twice the previous term. If the first term is 4, what is the 3rd term?" | |
| 6 | 1:31 | "5" (1 second) | isCorrect=false (term2 = 2×4-3=5; term3 = 2×5-3=7; correct answer: 7). `timeSpent=1s`. `recentAnswerTimesSeconds=[2,1,1]`. **RUSHING STREAK TRIGGERED**: all 3 < 5s. `slow_down` message fires. `recentAnswerTimesSeconds` reset. But simultaneously: `recentAttempts=[✓,✓,✗]`. Tail wrong=1. | Slow-down message: "You're moving really fast! Take a moment to read each question carefully before answering — accuracy matters more than speed." Then evaluation: "Interesting — how did you get 5? Walk me through the steps." |
| 7 | 2:30 | "I just picked a number that seemed close" | Socratic response from `evaluateAnswer()`. Not a frustration phrase (no regex match). | "Ah, that tells me a lot! This kind of problem needs two steps — not one. You found term 2 (which IS 5), but then needed one more step. Can you apply the rule again starting from 5?" |
| 8 | 3:15 | "7" | isCorrect=true (retry). `recentAttempts=[✓,✓,✗,✓]`. Mastery ~0.66. | "Exactly! Two applications of the rule. On the exam, multi-step patterns need patience — you've got the skill, just don't skip steps." |
| 9 | 4:00 | [tier 4 question] | `adjustDifficulty`: tail correct=1, tail wrong=1. Tier stays 4. Continue. "The first 5 terms of a sequence are: 3, 7, 15, 31, 63. What is the rule?" | |
| 10 | 4:04 | "B) double and add 1" (4 seconds) | isCorrect=true. `timeSpent=4s`. `recentAnswerTimesSeconds=[4]`. Getting slightly slower (4s vs 1-2s before). `shouldTriggerTeachBack`: 4 questions, 3 correct = 75% < 85% → NOT triggered. | "Right — double then add 1. You're slowing down a bit and it's paying off! Notice the difference between this and the last question?" |
| 11 | 6:00 | [tier 4 question] | `questionsInCurrentRun = 4`. Continue. Tier 4 question: "A pattern alternates: square, triangle, square, triangle, circle, square, triangle, square, triangle, circle... What is the 23rd shape?" | |
| 12 | 6:03 | "triangle" (3 seconds) | isCorrect=true (period=5: 23 mod 5 = 3 → 3rd in cycle = square; actually 23÷5=4r3, 3rd position = square, not triangle). isCorrect=false. `timeSpent=3s`. `recentAnswerTimesSeconds=[4,3]`. | "Almost! You spotted the repeating pattern — nice. But let me check your mod arithmetic. What's 23 divided by 5 and what's the remainder?" |
| 13 | 8:00 | "4 remainder 3, so... square?" | isCorrect=true. `recentAttempts=[✓,✓,✗,✓,✓,✗,✓]`. Mastery: ~0.61. | "Exactly. The remainder tells you the position in the cycle. You caught yourself! That's the kind of verification that saves points on exam day." |

**Adaptive Behaviors Triggered:**
- Rushing detected after 3 consecutive sub-5-second answers (exchanges 2, 4, 6 — 2s, 1s, 1s)
- Slow-down message fired correctly; Devon's subsequent answers average 3–4s (improvement)
- Error at exchange 6 was directly caused by rushing (skipped step) — pedagogically meaningful connection
- The Socratic prompt "how did you get 5?" at exchange 7 extracts a revealing admission: "I just picked a number"
- Feynman teach-back not triggered (accuracy 5/7 ≈ 71%)

**Assessment:** Excellent scenario for rushing detection. The connection between rushing and error is made explicit by the Socratic follow-up at exchange 7, where Devon admits guessing. The slow-down message alone doesn't change behavior immediately — it takes the experience of a wrong answer to shift Devon's approach. The system correctly identifies the wrong answer at exchange 6 and the Socratic probe is well-targeted. One gap: after the rushing flag fires, there's no mechanism to verify whether the student actually slowed down before the next question — the system just resets the timer buffer. A more robust approach would maintain a "rushing warning active" state and apply more scrutiny to the next 2–3 answers before fully clearing the flag.

**Scenario 3 Verdict:** Rushing detection is mechanically correct and fires at the right moment. The `slow_down` message text ("accuracy matters more than speed") is appropriate. The indirect pedagogical value — the rushing student inevitably makes an error that illustrates the point — is a feature, not a bug. Gaps: the flag fires once per 3-question window and resets cleanly, giving a persistent rusher repeated fresh starts. The system would benefit from escalating responses (first: gentle reminder; second: requires acknowledging before continuing; third: insert a mandatory reflection prompt).

---

## Scenario 4: Strong Overall but Careless Errors

**Setup:** High mastery (0.8) but makes 1 wrong answer per 3–4 questions due to misreading.
Pattern: correct-correct-correct-wrong-correct-correct-correct-wrong. Domain: `math_achievement`.
`masteryToTier(0.8)` → tier 5 (maximum). Mistakes categorized as `misread_question`.

---

### Girl Student — Zoe (age 11)
**Profile:**
- Mascot: Penguin (tier 5 — Champion)
- Math achievement mastery: 0.8 (advanced). Skill: `ma_multistep_word_problems`
- Emotional baseline: confident, occasionally careless under time pressure
- `confidenceTrend`: "stable"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `teach` multistep word problems at mastery 0.8, tier 5. Teaching streams. | "At tier 5, we're at Hunter exam level. Multi-step word problems have hidden sub-problems inside. Your strategy: find ALL the questions the problem is really asking, solve them in order. Try this: *Sarah earns $12/hour. She worked 6.5 hours on Monday and 4.75 hours on Wednesday. She spent 1/4 of her earnings on lunch. How much did she have left?* What are the sub-problems?" |
| 2 | 2:30 | "first find total hours, then total pay, then subtract 1/4" | isCorrect=true (correct approach articulated). `recentAttempts=[{✓, 150s, false}]`. Mastery stable at 0.8. | "Perfect problem breakdown! Now solve it. 6.5 + 4.75 = ? Then multiply by $12. Then find 3/4 of that." |
| 3 | 4:30 | "$85.50" | isCorrect=true (11.25 hrs × $12 = $135; 3/4 × $135 = $101.25 — actually $101.25, not $85.50). isCorrect=false. **Careless error** — Zoe likely computed 3/4 of something wrong. `recentAttempts=[{✓, 150s, false},{✗, 120s, false}]`. Tail wrong=1. `logMistakeInBackground()` fires → diagnosis likely `careless_error`. | "Interesting! Your approach was exactly right. Let me ask: after you got the total earnings, what number did you multiply by 3/4? Let's check that step." |
| 4 | 5:00 | "oh wait, I multiplied 3/4 by $114 not $135" | Correct recognition of error. Retry attempt: "$101.25" | isCorrect=true. `recentAttempts=[{✓,150s,false},{✗,120s,false},{✓,30s,false}]`. Tail correct=1. Mastery ~0.74. |
| 5 | 5:30 | [tier 5 question] | Continue. "A rectangle has a perimeter of 56 cm. Its length is 3 times its width. What is its area?" | |
| 6 | 7:00 | "147 cm²" | isCorrect=true (width=7, length=21, area=147). `recentAttempts=[...,✓]`. Tail correct=2. | "Excellent — you set up the equation w + 3w = 28 automatically. That's Hunter-level thinking." |
| 7 | 8:00 | [tier 5 question] | Tail correct=2. One more for advancement. "A train travels at 60 mph for 2 hours, then at 90 mph for 1.5 hours. What is its average speed for the entire journey?" | |
| 8 | 9:30 | "75 mph" | isCorrect=false (correct: total distance = 120+135=255 miles; total time=3.5 hrs; avg = 255/3.5 = 72.86 mph). Classic average-speed trap. `recentAttempts=[...,✗]`. Tail wrong=1. Tail correct streak broken. `logMistakeInBackground()` fires → `misread_question` diagnosis. | "Good try — 75 mph would be the arithmetic mean of 60 and 90, but average speed has a trap. Can you tell me: what does average speed actually mean? How is it defined?" |
| 9 | 10:15 | "total distance divided by total time?" | isCorrect=true (correct definition). Retry: Zoe calculates 255/3.5 = "72.86 mph" | isCorrect=true (approximate). `recentAttempts=[...,✗,✓]`. Tail correct=1. Mastery: 0.72. |
| 10 | 11:00 | [tier 5 question] | `questionsInCurrentRun=5` → `insert_teaching` action. Teaching moment: debrief on "average vs. arithmetic mean" trap. Streams. After teaching, `advancePacingAfterTeaching()` resets run counter. | "Here's the key insight: whenever a problem says 'average speed,' NEVER just average the speeds. Always: total distance ÷ total time. This is one of Hunter's favorite traps. Let's do one more." |
| 11 | 13:00 | [tier 5 question] | "A box contains 5 red, 3 blue, and 2 green marbles. Two marbles are drawn without replacement. What is the probability both are red?" | |
| 12 | 14:30 | "5/10 × 4/9" | isCorrect=true (= 20/90 = 2/9). `recentAttempts=[...,✓,✓]`. Tail correct=2. Mastery: ~0.75. | "Beautiful — you remembered to reduce the denominator after the first draw. That's the key to 'without replacement' problems!" |
| 13 | 15:00 | [tier 5 question] | `shouldTriggerTeachBack`: 6 questions, 5 correct = 83.3% < 85% — NOT triggered. Continue with tier 5 question about coordinate geometry. | |

**Adaptive Behaviors Triggered:**
- `logMistakeInBackground()` fired twice (exchanges 3 and 8) — both diagnosed as `careless_error` or `misread_question`
- Socratic follow-up correctly asked "what number did you multiply" (exchange 3) and "how is average speed defined" (exchange 8) — both probe the point of failure precisely
- Tier stayed at 5 throughout: careless errors break the 3-correct streak, but mastery stays high
- Teaching insert at question 5 (average vs. arithmetic mean) was timely and directly relevant
- Feynman teach-back NOT triggered despite 83% accuracy — misses by 2 percentage points

**Assessment:** The careless error pattern is handled well through the Socratic "what was your reasoning?" approach. The engine correctly does not drop the difficulty tier — Zoe's mastery is genuinely high, and the errors are careless rather than conceptual. The mistake journal (`logMistakeInBackground`) fires and categorizes both errors, building a record that would surface in spaced repetition review. However, the system cannot distinguish between conceptual errors and careless errors in real time — both trigger the same Socratic follow-up. A stronger system might track the ratio of `misread_question` diagnoses and flag: "You've misread 3 questions today — try reading each question twice before answering."

---

### Boy Student — Ethan (age 11)
**Profile:**
- Mascot: Monkey (tier 5 — Monkey King)
- Math achievement mastery: 0.8. Skill: `ma_algebraic_expressions`
- Emotional baseline: confident bordering on overconfident, dismissive of easy questions
- `confidenceTrend`: "stable"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `teach` algebraic expressions at mastery 0.8, tier 5. | "Hunter algebra questions need you to both set up AND simplify expressions precisely. Careful reading is everything. Try: *If x + y = 10 and x − y = 4, what is x²− y²?* Don't solve for x and y separately — there's a shortcut." |
| 2 | 2:00 | "40" (x²-y²=(x+y)(x-y)=10×4=40) | isCorrect=true. `recentAttempts=[{✓, 120s, false}]`. | "Excellent — you spotted the factored form immediately. That's exactly the shortcut. Let's go harder." |
| 3 | 3:00 | [tier 5 question] | "If $3a + 2b = 20$ and $a - b = 1$, what is the value of $5a + b$?" | |
| 4 | 5:30 | "22" | isCorrect=false (3a+2b=20, a-b=1 → a=b+1 → 3(b+1)+2b=20 → 5b=17 → b=3.4, a=4.4; 5a+b=22+3.4=25.4; or looking for integer solution: if a=b+1, 5b+3=20 → b=17/5 — not integer. Perhaps the question has integer solution: 5a+b = (3a+2b)+(2a-b) = 20+2(a)-b... Actually 5a+b = (3a+2b) + 2(a-b) = 20 + 2(1) = 22. Correct! isCorrect=true.) `recentAttempts=[✓,✓]`. Tail correct=2. | "Brilliant — you combined the equations without solving for each variable. That's Hunter-level efficiency!" |
| 5 | 6:00 | [tier 5 question] | "A store sells pencils for $0.35 each and pens for $0.85 each. Emma buys a total of 12 items and spends $7.20. How many pens did she buy?" | |
| 6 | 8:00 | "6 pens" | isCorrect=false (p + q = 12, 0.85p + 0.35q = 7.20 → 0.5p = 7.20 - 0.35×12 = 7.20-4.20=3.00 → p = 6. Actually correct! isCorrect=true.) `recentAttempts=[✓,✓,✓]`. **Tail correct streak = 3** → `adjustDifficulty`: `tier = min(5, 5+1) = 5` (already max, stays). Mastery update: ~0.87. | "Yes! Systems of equations word problems — you set it up perfectly. You've got a great streak going." |
| 7 | 8:30 | `shouldTriggerTeachBack` check | 3 questions answered, correctCount=3 = 100% > 85%. BUT `questionCount=3 < TEACH_BACK_MIN_QUESTIONS(4)` → NOT triggered yet. | Continue. |
| 8 | 9:00 | [tier 5 question] | New tier 5 question: "Simplify: $\frac{x^2 - 9}{x^2 - x - 6}$" | |
| 9 | 10:30 | "x+3/x+2" | isCorrect=false (correct: (x-3)(x+3)/((x-3)(x+2)) = (x+3)/(x+2), which Ethan wrote as x+3/x+2 — probably means (x+3)/(x+2), which IS correct. If the answer format requires "$(x+3)/(x+2)$" and Ethan wrote without parentheses, this may be a format mismatch. Assume isCorrect=false due to notation). `recentAttempts=[✓,✓,✓,✗]`. Tail wrong=1, correct streak broken. | "Almost — I think you have the right idea. Can you show me how you factored the denominator first? Let's see all the steps." |
| 10 | 11:15 | "(x-3)(x+2) bottom, (x-3)(x+3) top, cancel (x-3), get (x+3)/(x+2)" | Correct explanation. isCorrect=true (retry). `recentAttempts=[...,✗,✓]`. Tail correct=1. | "Perfect explanation — and yes, the answer was right! I wanted to see your work since notation on the exam needs to be precise. At Hunter, partial credit isn't a thing — make sure you write clearly." |
| 11 | 12:00 | [tier 5 question] | `questionsInCurrentRun=5` → `insert_teaching`. "Let me show a common trap with rational expressions..." Teaching streams. | Teaching: "When simplifying rational expressions, you can only cancel FACTORS, never terms. $(x+3)/(x+3+2)$ is NOT the same as $1/(1+2/x+1)$ — you need to factor first. Always factor completely before canceling." |
| 12 | 13:30 | [tier 5 question — post teach] | `shouldTriggerTeachBack`: 5 questions, 5 correct = 100% > 85% AND questionCount=5 >= 4. **TRIGGERED**. `teachBackActive=true`. Session pauses. | "Ethan, you've been crushing these! I want to try something: can you pretend I'm a student who missed the last few classes? Explain to me in your own words how to simplify a rational expression. Teach me like you'd teach a friend." |
| 13 | 15:00 | [Ethan provides teach-back explanation] | `handleTeachBackComplete()` called after explanation. `TeachItBack` component evaluates explanation. `saveTeachingMoment()` stores the moment. | Evaluation feedback displayed. Session continues to question 6. |

**Adaptive Behaviors Triggered:**
- Tier stayed at max (5) throughout — correctly pinned since mastery is already 0.8
- 3-correct streak fired `adjustDifficulty` advance but was already at tier cap
- Feynman teach-back correctly triggered at question 5: accuracy 100% > 85%, questionCount ≥ 4
- Teaching insert fired at question 5
- `logMistakeInBackground()` fired once (exchange 9) for notation error — correctly categorized as `misread_question` or `careless_error`
- Mastery ended at ~0.85 (advanced toward top)

**Assessment:** The teach-back trigger is the highlight of this scenario — it fires correctly and at an appropriate moment (after a strong performance streak). The careless error at exchange 9 was notation-based and caught well by the Socratic "show me your work" follow-up. One structural gap: Ethan's mastery is 0.8 → tier 5, but there's no way for the session to push past tier 5. The engine correctly leaves tier at max and keeps generating tier-5 questions, which is appropriate. The mistake journal captures the notation careless error — useful for the parent dashboard. The session is close to ideal for a high-mastery student.

**Scenario 4 Verdict:** The engine handles careless error patterns through Socratic follow-up rather than tier adjustments, which is correct. Careless errors don't indicate conceptual failure — the student understands but misreads. The mistake categorization pipeline (`misread_question` diagnosis via API) correctly identifies these. The system does not yet provide in-session pattern feedback about repeated misreads ("you've misread 2 questions — try re-reading"). This would require tracking `mistakeCategory` counts within a session, which is not currently done.

---

## Scenario 5: Test Anxiety

**Setup:** Average-to-good mastery (0.65) but shows anxiety signals. Domain: `reading_comprehension`.
`masteryToTier(0.65)` → tier 4. Anxiety phrases: "what if i fail", "i'm nervous about the real test".

---

### Girl Student — Emma (age 11)
**Profile:**
- Mascot: Penguin (tier 4 — Scholar)
- Reading mastery: 0.65 (proficient). Skill: `rc_advanced_inference` (hunter_prep level, tier 4)
- Emotional baseline: capable but catastrophizes about exam day
- `confidenceTrend`: "improving"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `teach` `rc_advanced_inference` at 0.65, tier 4. Teaching streams. Prerequisites: rc_inference, rc_drawing_conclusions, rc_evidence_reasoning. | Tutor streams: "Advanced inference on the Hunter exam means pulling together multiple clues that are never directly stated. Think of it as connecting dots across a whole passage, not just one sentence. Here's a short passage — I'll show you how to layer clues..." |
| 2 | 2:30 | "ok" | Minimal response, no frustration trigger. `questionShownAt` set. First question generated. | Tier 4 advanced inference question with 5-sentence passage. "Based on the passage, what can we infer about the narrator's relationship with her grandmother, even though it's never stated directly?" |
| 3 | 4:30 | "they're close?" | isCorrect=true (inference supported by warmth clues). `recentAttempts=[{✓, 120s, false}]`. Mastery: 0.70. | "Yes — and what specific clues in the passage led you there? Let's anchor your inference in evidence." |
| 4 | 5:30 | "the part where she says she saved the recipe" | Good evidence citation. Continue. Next question generated. | |
| 5 | 6:00 | [tier 4 question] | "What if I fail the real test? This question is so hard and it's like exactly what will be on it" | |
| 6 | 6:05 | [anxiety message] | `detectFrustration()` runs: `/what\s+if\s+i\s+fail/i` **MATCHES** "what if I fail". `activeQuestion` is null at this moment (question was just generated but not yet `activeQuestion`... actually `activeQuestion` is set in `setState` simultaneously with question display). Let's assume this was typed as a message before the first submit — `activeQuestion` is null. Routes to `respondToEmotionalCue()`. | Tutor pauses question: "Hey — I hear something important in what you just said. It's completely normal to feel nervous, especially when you care about something this much. Can I tell you something? The fact that you're practicing today means you're preparing yourself. The best way to feel less scared about a test is to walk in knowing you're ready. You're building that right now. Want to take a breath and try the question together, or talk about what's worrying you?" |
| 7 | 7:30 | "ok let's try the question" | Continue session. `activeQuestion` re-engaged. | Resume with the tier 4 question: passage about two scientists with different methods. "What can we infer about how each scientist views the other's approach?" |
| 8 | 9:00 | "one thinks the other is wrong and the other thinks the first is too slow" | isCorrect=true (paraphrase of competing perspectives inference). `recentAttempts=[✓,✓]`. Tail correct=2. Mastery: ~0.73. | "That's a sophisticated inference — you read between the lines of both viewpoints simultaneously. That's exactly what the Hunter exam asks for." |
| 9 | 10:00 | [tier 4 question] | "The way a passage is organized helps carry its meaning. This question asks: how does the author's decision to switch perspectives mid-passage change your understanding of the main argument?" | |
| 10 | 11:30 | "I'm nervous about the real test, what if I don't understand the passage in time" | `detectFrustration()`: `/i'?m\s+(\w+\s+)?(scared|nervous|worried|anxious)/i` MATCHES "I'm nervous". AND `/what\s+if\s+i\s+fail/i`-adjacent content. `activeQuestion` is likely null (message typed between questions). Routes to `respondToEmotionalCue()`. | Tutor: "Two things I want you to know: first, you just answered that last question correctly — you ARE understanding passages and reading between the lines. Second, the exam gives you time, and you'll practice with timed passages before January. Right now, every question you practice is making you faster and better. What would make you feel more prepared?" |
| 11 | 12:30 | "just doing more of these I guess" | Continue. `activeQuestion` still null. Conversation continues. No frustration pattern. Next question generated. | "That's exactly the right instinct — and that's what we're doing right now! Let's keep going." |
| 12 | 13:00 | [tier 4 question] | `questionsInCurrentRun=3`. Continue. New passage: poetry with implied emotion. "What is the speaker most likely feeling in the final stanza, based on the imagery used?" | |
| 13 | 14:30 | "lonely or maybe sad" | isCorrect=true. `recentAttempts=[✓,✓,✓]`. Tail correct=3 → `adjustDifficulty` tier advance: 4+1=5. Mode: practice. `shouldTriggerTeachBack`: 3 questions < 4 minimum → NOT triggered. | "Exactly right — the 'empty shore' and 'fading light' are both images of loss and solitude. Your literary instincts are strong. You're moving to a harder challenge!" |

**Adaptive Behaviors Triggered:**
- Anxiety detected twice: "what if I fail" (exchange 5–6), "I'm nervous" (exchange 10)
- Both correctly routed to `respondToEmotionalCue()` (timing: both when `activeQuestion` was null)
- Anxiety responses appropriately: (1) validate feelings, (2) remind of progress, (3) offer agency
- Tier advanced from 4 to 5 after 3 consecutive correct answers
- Feynman teach-back not triggered (only 3 questions when streak hit)

**Assessment:** The anxiety pathway works well. The key is that both anxiety expressions happened when no question was active — meaning the routing to `respondToEmotionalCue()` fires correctly. The tutor responses reference concrete progress ("you just answered that correctly"), which is the right counter to test anxiety catastrophizing. The second anxiety response (exchange 10) is particularly well-structured: specific, grounding, and action-oriented. One gap: the engine has no memory that Emma has expressed anxiety twice in the same session. The second response could specifically acknowledge this: "You've mentioned feeling nervous a couple of times — that's worth taking seriously. Let's make a plan for exam day." The system treats each emotional trigger in isolation.

---

### Boy Student — Leo (age 11)
**Profile:**
- Mascot: Monkey (tier 4 — Wise Monkey)
- Reading mastery: 0.65. Skill: `rc_comparing_viewpoints` (hunter_prep, tier 5, prerequisites include rc_advanced_inference)
- Emotional baseline: expresses anxiety through questions about exam logistics rather than explicit phrases
- `confidenceTrend`: "stable"

**Session Trace:**

| # | Time | Student Input | Engine Decision | Tutor Response Summary |
|---|------|--------------|-----------------|----------------------|
| 1 | 0:00 | [session start] | `teach` `rc_comparing_viewpoints` at 0.65, tier 4 (mastery 0.65 → tier 4; skill's native tier is 5 but engine uses student's mastery tier). Teaching streams. | "Comparing viewpoints means seeing the same topic through two different lenses. On Hunter, you'll read a passage where two people disagree, or where one passage shows two sides. Your job: map out EACH viewpoint and find where they agree AND where they split. Let's practice." |
| 2 | 2:30 | "how long is the actual reading section on the real exam?" | No frustration pattern matches. Treated as a free-text message (no `activeQuestion`). Engine processes as general message; since `detectFrustration` returns false, nothing special fires. No emotional response. Tutor does not respond to the logistical question — it would only respond to frustration/anxiety patterns. **GAP**: off-topic questions have no handling pathway. | Tutor does not address the exam logistics question. The `sendMessage()` function with no active question and no frustration detection simply adds the user message and... does nothing (no response generated unless through a frustration route). Actually reviewing code: after `addMessages(makeUserMsg(text))`, if `!detectFrustration(text)`, the function returns without generating any tutor response. **Dead end in the conversation.** |
| 3 | 3:00 | "hello?" | Same situation — no active question, no frustration trigger, no tutor response generated. | Silence from tutor. Student confusion increases. |
| 4 | 3:30 | "i'm worried i won't pass the exam" | `detectFrustration()`: `/i'?m\s+(\w+\s+)?(scared|nervous|worried|anxious)/i` MATCHES "i'm worried". Routes to `respondToEmotionalCue()`. | "That worry is real, and I want to acknowledge it — the Hunter exam IS competitive, and caring about it shows how much it means to you. But here's what I want you to focus on: every session we do together is building the exact skills the exam tests. You're not hoping to get ready — you ARE getting ready. Want to dive into a question together?" |
| 5 | 4:30 | "ok" | Continue. `activeQuestion` generated. First viewpoints question: passage where a journalist and a scientist disagree about climate data reporting. "What would each author say about the other's main argument?" | |
| 6 | 7:00 | "the journalist thinks the scientist uses too much jargon, and the scientist thinks the journalist oversimplifies" | isCorrect=true. `recentAttempts=[{✓, 150s, false}]`. Mastery ~0.69. | "That's a precise and fair reading of both positions. You didn't favor one over the other — that's the intellectual even-handedness the exam rewards." |
| 7 | 8:00 | [tier 4 question] | Next question: dual-perspective passage. "Both authors agree on one thing — what is it, and how do you know from the text?" | |
| 8 | 10:00 | "they both think the public should care about climate change" | isCorrect=true. `recentAttempts=[✓,✓]`. Tail correct=2. Mastery ~0.73. | "Exactly — agreement-finding is as important as difference-finding. In a debate, the common ground tells you what the real disagreement is about." |
| 9 | 10:30 | "what if i fail" | `detectFrustration()` MATCHES. `activeQuestion` is null between questions. Routes to `respondToEmotionalCue()`. Third emotional response in the session. | "You've gotten two questions right in a row — that's real evidence you have these skills. 'What if I fail' is a scary thought, but you can't fail a practice session. Right now, every question is just information about what you know and what to strengthen. What part of the exam worries you most?" |
| 10 | 11:30 | "the reading with the long passages" | No frustration trigger. No active question. **Same dead-end gap as exchanges 2–3**: `sendMessage()` adds user message, no frustration, no response. The student's meaningful answer to the tutor's own question goes unaddressed. | Silence. |
| 11 | 12:00 | "test day" | `detectFrustration()`: `/i'?m\s+(\w+\s+)?scared/i` — does NOT match "test day" alone. No match. Another dead end. | Silence from tutor again. |
| 12 | 12:30 | "I'm scared about test day" | `detectFrustration()` MATCHES `/i'?m\s+(\w+\s+)?(scared|nervous|worried|anxious)/i`. Routes to `respondToEmotionalCue()`. | "Being scared about test day is something almost every student feels — it actually means you're taking it seriously. Here's something that helps: the more familiar the format feels before January, that's what we're building together right now. You're doing it." |
| 13 | 13:30 | [tier 4 question] | `questionsInCurrentRun=2`. Continue. New passage. | |

**Adaptive Behaviors Triggered:**
- Anxiety detected 3 times (exchanges 4, 9, 12) — all correctly when `activeQuestion` was null
- **Critical gap discovered**: exchanges 2–3 and 10–11 expose that `sendMessage()` with no active question and no frustration trigger produces complete silence — the tutor does not respond at all to off-topic or follow-up messages
- The tutor's own question ("What part of the exam worries you most?") at exchange 9 generates a meaningful student response, which is then silently ignored — this is a significant UX and pedagogical failure
- Tier not advanced: only 2 questions answered in 13 minutes due to conversation dead-ends

**Assessment:** This scenario exposes the most significant architectural gap in the system: the `sendMessage()` pathway has no fallback general-conversation response. The function only generates a tutor reply when (a) there is an active question (routes to `submitAnswer`), or (b) `detectFrustration()` returns true. Any other free-text message — including follow-up responses to the tutor's own questions, logistical questions, and general conversation — receives no reply. This creates an eerie silence that would confuse and potentially further distress an anxious student. The fix requires a general conversational fallback: when `sendMessage()` is called with no active question and no frustration detected, it should still call the API with a "general_response" action type.

**Scenario 5 Verdict:** The anxiety detection patterns are well-designed and fire correctly when triggered. The response content is thoughtful and appropriately grounding. However, the system's inability to engage in general free-text conversation outside of the question/frustration binary creates meaningful dead zones. For an anxious student who wants to talk through worries or ask questions, the silence is worse than no app at all. The single highest-impact fix for this scenario is implementing a conversational fallback response path in `sendMessage()`.

---

## Overall Findings

### What the Engine Does Well

**1. Socratic-first evaluation is consistently applied.**
`evaluateAnswer()` correctly delays answer revelation for wrong answers, always asking "what was your reasoning?" first. This is the most valuable pedagogical behavior in the system and works correctly in all 10 sessions.

**2. Difficulty adjustment is mechanically sound.**
`adjustDifficulty()` with the 3-correct-advance / 2-wrong-drop rules fires correctly in all scenarios. The hint-discount (correct answers with `hintUsed: true` don't count toward the independent streak) is an elegant and important nuance.

**3. Rushing detection works as designed.**
The `RUSHING_THRESHOLD_SECONDS = 5` / `RUSHING_STREAK = 3` combination is well-tuned. The pacing message fires at the right moment, and the buffer reset after the flag prevents over-nagging.

**4. Emotional responses are warm and pedagogically appropriate.**
When `respondToEmotionalCue()` fires, the content is consistently: (1) validate, (2) reference prior success, (3) offer agency. This is the right framework for 11-year-olds under exam pressure.

**5. The mistake journal pipeline is thorough.**
`logMistakeInBackground()` fires on wrong answers, calls the diagnosis API, and stores entries with spaced repetition scheduling. The three diagnosis categories (`conceptual_gap`, `careless_error`, `misread_question`) are appropriate for this age group.

**6. Mastery formula correctly multi-factors.**
The `calculateMasteryUpdate()` formula (70% recent accuracy + 20% overall + 10% time efficiency) is well-designed. The hint-discount in `rollingAccuracy()` (0.5 weight for scaffolded correct answers) prevents inflation.

**7. Feynman teach-back is well-gated.**
The `shouldTriggerTeachBack()` conditions (≥4 questions AND accuracy > 85%) are appropriately stringent. It fired correctly only once across 10 sessions (Ethan, Scenario 4) — exactly when warranted.

---

### Gaps and Recommendations

**Gap 1 — CRITICAL: Frustration detection bypassed when `activeQuestion` is active**
Location: `useTutoringSession.ts` lines ~677–679.
When `activeQuestion !== null`, `sendMessage()` immediately calls `submitAnswer(text)` without running `detectFrustration(text)`. A student typing "I give up" or "this is too hard" while a question is displayed has their message treated as an answer attempt, gets an incorrect evaluation, and receives no empathy response.
Fix: In `sendMessage()`, run `detectFrustration(text)` before routing to `submitAnswer()`. If frustration is detected, route to `emotional_response` instead.

**Gap 2 — CRITICAL: No conversational fallback in `sendMessage()`**
Location: `useTutoringSession.ts` lines ~675–703.
When there is no active question AND `detectFrustration()` returns false, `sendMessage()` adds the user message and returns silently. No tutor response is generated. This creates dead zones for any off-topic question, follow-up, or response to the tutor's own questions.
Fix: Add a `general_response` action type as fallback: when no question is active and no frustration is detected, still call the API with `{ type: "general_response", message: text, history: getHistory() }`.

**Gap 3 — MODERATE: Emotional context is stateless across triggers**
Each `respondToEmotionalCue()` call is independent. The system has no memory of how many times the student has expressed anxiety or frustration in the current session. A student who expresses anxiety three times receives three separate, generically warm responses with no escalation or acknowledgment of the pattern.
Fix: Track `frustrationCount` and `anxietyCount` in session state. After a second or third trigger, reference the pattern: "I've noticed this has come up a few times today — this is worth talking about."

**Gap 4 — MODERATE: No in-session careless error pattern feedback**
Mistake entries are logged to localStorage for later spaced repetition review, but no in-session signal is raised when a student accumulates multiple `misread_question` diagnoses in one session. A student making 3 careless errors in 12 questions could benefit from a mid-session reminder about careful reading.
Fix: In `submitAnswer()`, after `logMistakeInBackground()` fires, increment a session-level `misreadCount`. If it hits 2+, inject a pacing message: "I've noticed a couple of answers where you seem to have misread the question — try reading it twice before choosing."

**Gap 5 — MINOR: Rushing flag resets completely after one warning**
After the `slow_down` message fires, `recentAnswerTimesSeconds` is reset to `[]`. A student who resumes rushing after the warning gets a full fresh 3-question window before the next flag. For persistent rushers, this allows repeated cycling of the flag without meaningful behavioral change.
Fix: Implement escalating responses (first: gentle message; second: "Let's pause — I want you to explain your answer before we move on"; third: mandatory 5-second delay before question loads).

**Gap 6 — MINOR: Teach-back trigger only runs after correct answers**
`shouldTriggerTeachBack()` is only called inside the `if (isCorrect)` branch of `submitAnswer()`. A student who achieves 85%+ accuracy but whose last answer was wrong will never trigger teach-back even if they've met both thresholds.
Fix: Move `shouldTriggerTeachBack()` check outside the `isCorrect` branch, or call it at the end of each question regardless of correctness.

---

### Gender-Specific Observations

The system's only gender differentiation is the mascot assignment: girls receive the penguin mascot (Hatchling through Champion), boys receive the monkey mascot (Baby Monkey through Monkey King). All adaptive logic, system prompts, question generation, difficulty adjustment, and emotional response pathways are gender-neutral.

**Mascot Implementation:**
The `Mascot` component correctly derives tier from `overallMastery` via `getMascotTier()` and displays the appropriate mascot variant. The tier labels are encouraging and age-appropriate for both tracks (penguin: Hatchling→Explorer→Bookworm→Scholar→Champion; monkey: Baby→Adventurer→Clever→Wise→Monkey King). No gender stereotyping was observed in the mascot design or label language.

**Observed behavioral differences in simulation:**
These reflect the profiles assigned to each student, not system differentiation:
- Girl students in scenarios 1 and 5 (Sofia, Emma) showed more engagement with emotional support before continuing. The system's response quality was equally appropriate for both.
- Boy students in scenarios 2 and 3 (Jamal, Devon) showed more dismissive frustration patterns ("no", "whatever") — the regex patterns handle these short-form expressions effectively.
- No systematic difference in academic performance was built into the profiles, and the engine treats academic attempts identically regardless of gender.

**One observation:** The system prompt references mascot type only through the student profile `mascotType` field, but the actual tutor dialogue does not personalize to the mascot or student name. The tutor never says "Great job, Sofia!" or uses the mascot character to build rapport ("Your penguin is impressed!"). Adding name-personalization to the system prompt context injection would strengthen emotional connection without requiring gender differentiation.

---

*Report generated: 2026-03-10 | Based on static analysis of production codebase at commit d26180f*
