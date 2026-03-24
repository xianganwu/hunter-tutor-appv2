# Lessons Learned

## Bug: AI Marks Correct Place Value Answers as Wrong

### Symptoms
- Student selects E) 40,000 for "What is the value of the digit 4 in 247,583?" — which is correct
- Tutor responds with "Good try!" and treats it as wrong
- Tutor gives incorrect hint: "The digit 4 is in the third spot from the right" (it's actually the 5th)
- Same bug reproduced across multiple place value questions (247,583 and 247,836)

### Root Cause
The AI (Claude Sonnet) generates both the question AND designates the correct answer. For place value questions, it miscounts digit positions — e.g., confusing the ten-thousands place with the hundreds place. The existing validation layer (`validate-question.ts`) only checked:
- Are there at least 4 choices?
- Are all choices numerically distinct?
- Does the correct letter map to a valid choice?

It did NOT verify that the marked correct answer was actually mathematically correct. So a question where the AI labeled B) 400 as correct (instead of E) 40,000) passed all validation checks.

The `answersMatch()` function then correctly determined the student's answer didn't match the (wrong) "correct" answer, and the AI evaluation prompt received `isCorrect: false`, causing it to give "Good try!" feedback and attempt to guide the student toward the wrong answer.

### Fix (Three Layers)
1. **Programmatic verification** (`validate-question.ts`): Added `verifyPlaceValueAnswer()` that detects place value questions via regex, programmatically computes the correct value by finding the digit's position in the number, and either auto-corrects the answer or rejects the question.
2. **Prompt hardening** (`tutor-agent.ts`): Added explicit PLACE VALUE CHECK instructions in the question generation prompt with a worked example of counting positions right-to-left.
3. **Integration** (`tutor-agent.ts`): Wired the verifier into `parseGeneratedQuestion()` so every generated question is checked before reaching the student.

### Key Lesson
Never trust AI-generated math answers without programmatic verification. LLMs are notoriously bad at positional/counting tasks. For any question type where the correct answer is mechanically computable (place value, basic arithmetic, digit counting), add a deterministic verification step. The AI is great at generating creative question scenarios but unreliable at computing the correct answer for positional reasoning.

---

## Bug: Tutoring Session Never Ends

### Symptoms
- Student answers dozens of questions with no session summary or wrap-up
- The session continues indefinitely until the student manually clicks "End Session"
- Progress indicator shows "X / 12" but reaching 12 has no effect

### Root Cause
Session termination in `getNextPacingAction()` (`adaptive.ts`) was purely time-based:
- End after 25+ minutes with 3+ questions in current run
- Hard stop at 35 minutes

There was NO question-count-based termination. The `ESTIMATED_QUESTIONS = 12` constant in `useTutoringSession.ts` was only used for the UI progress indicator — it had zero effect on actual session termination.

The `isFirstSession` flag (which enables a 3-question early exit) was only set when the URL contained `?firstSession=1`, which only happens during onboarding. Normal tutoring sessions had no question limit at all.

For a student answering questions quickly (e.g., 1-2 minutes per question), they could easily answer 15-25 questions before hitting the 25-minute time threshold.

### Fix
Added `SESSION_MAX_QUESTIONS = 15` to `adaptive.ts` and a question-count check in `getNextPacingAction()` that triggers `end_session` after 15 questions, regardless of elapsed time. This sits between the time-based hard stop and the natural break check, so time-based stops still take priority if the student is slower.

### Key Lesson
UI indicators that suggest finite sessions (like "X / 12" progress bars) must be backed by actual termination logic. A disconnect between what the UI implies and how the system behaves creates a confusing user experience. For young students (ages 9-12), question-count limits are more important than time limits — kids work at different speeds, but cognitive load per question is relatively constant.

---

## Bug: "Which Statement Is Correct" Questions With Multiple Correct Answers

### Symptoms
- AI generates a "Which statement about these numbers is correct?" question with zoo visitor data (847,392 / 478,629 / 847,932 / 478,926)
- All five answer choices are actually true:
  - A) 847,392 has a 9 in the tens place → TRUE
  - B) In 478,629, the digit 6 represents 6 hundreds → TRUE
  - C) The largest number of visitors was in 2021 → TRUE
  - D) In 847,932, the digit 4 is in the ten-thousands place → TRUE
  - E) 478,629 and 478,926 have the same value in the thousands place → TRUE
- Whichever answer the student picks, they have a 4/5 chance of being told they're wrong despite being right

### Root Cause
Same underlying issue as the single place value bug: the AI generates questions where it fails to verify its own work. For "which statement is correct" questions, the AI is supposed to create exactly ONE true statement and FOUR false distractors. Instead, it creates statements that are all coincidentally (or lazily) true.

The existing validation layer had no concept of checking whether multiple answer choices could be simultaneously correct. It only checked for:
- Distinct choice text (all different)
- Valid correct answer letter
- At least 4 choices

This is a different failure mode from the wrong-answer bug: rather than labeling the wrong choice as correct, the AI makes ALL choices correct, meaning there's no unique right answer.

### Fix (Three Layers)
1. **Programmatic statement verifier** (`validate-question.ts`): Added `verifyStatementQuestion()` that detects "which statement" questions and programmatically evaluates each statement against the numbers in the question. Handles five patterns:
   - "[number] has a [digit] in the [place] place"
   - "In [number], the digit [d] represents [value]"
   - "In [number], the digit [d] is in the [place] place"
   - "The largest/smallest number is..."
   - "[num1] and [num2] have the same value in the [place] place"
2. **Rejection logic**: If more than one statement is verified as true, or if zero are true, the question is rejected and regenerated.
3. **Prompt hardening** (`tutor-agent.ts`): Added explicit STATEMENT QUESTIONS instruction warning the AI to verify each distractor is actually false.

### Key Lesson
"Which statement is correct" questions are particularly dangerous for AI generation because the AI must get FIVE things right: one true statement and four false ones. The probability of an error compounds — if the AI has even a 15% chance of accidentally making a distractor true, a 5-choice question has a ~48% chance of having at least one extra correct answer. Programmatic verification of each statement is essential for this question format.

---

## Architecture Insight: Answer Evaluation Flow

Understanding this flow was critical to diagnosing both bugs:

1. **Question generation**: AI generates question + correct answer letter via prompt
2. **Parsing** (`parseGeneratedQuestion`): Extracts question text, choices, correct answer from AI response
3. **Validation** (`isValidQuestion`): Checks format, distinctness, valid letter — but NOT mathematical correctness
4. **Student answers**: Frontend sends the full choice text (e.g., "E) 40,000") as `studentAnswer`
5. **Answer matching** (`answersMatch`): Server-side comparison of student answer vs stored correct answer using letter extraction and text matching
6. **AI evaluation** (`buildEvaluateMessages`): The `isCorrect` boolean is computed BEFORE the AI sees the answer. The AI receives `isCorrect` and crafts pedagogically appropriate feedback (praise for correct, Socratic hints for incorrect)

The critical insight: if the stored correct answer is wrong (step 2), everything downstream treats the student's correct answer as wrong (steps 5-6). The AI evaluation reinforces the error because it's told to give "incorrect" feedback and hint toward the (wrong) stored answer.

---

## Bug: Place Value Word Problems Bypass All Verification (Third Occurrence)

### Symptoms
- Student is asked: "Marcus's score is 492,736. His friend says digit 7 is worth 700. Is his friend correct?"
- The friend IS correct (7 is in the hundreds place, value = 700)
- Student answers "Yes" → marked wrong with red X
- Tutor gives "Good try!" and guides student toward the AI's (incorrect) answer

### Root Cause — Three Compounding Failures

**Failure 1: Batch/cache code paths skip ALL place value verification.**
The v1 fix added `verifyPlaceValueAnswer()` and `verifyStatementQuestion()` to `parseGeneratedQuestion()`, but this function is only called by `generateQuestion()` — the last-resort fallback path. The PRIMARY path (`generateDrillBatch()` → question cache) only called `isValidQuestion()` (format checks), completely bypassing place value and statement verification. Five of six question-serving paths had no mathematical verification.

**Failure 2: The detection regex is too narrow.**
`detectPlaceValueQuestion()` only matches: `"value of digit X in NUMBER"`. Word problems like "digit 7 is worth 700" use completely different phrasing and bypass the regex entirely.

**Failure 3: Batch generation prompts lacked place value instructions.**
The PLACE VALUE CHECK prompt paragraph (counting positions right-to-left) was only in `generateQuestion()`. The batch prompts (`generateDrillBatch`, `generateMixedDrillBatch`) had no place value instructions at all — while actively encouraging word problem formats.

### Fix (Architectural)
1. **Centralized validation gateway**: Created `validateGeneratedQuestion()` that composes ALL checks (format + direct place value + choice-level claims + statement verification). This is now the single chokepoint all six paths must pass through.
2. **Choice-level claim verification** (format-agnostic): Added `verifyPlaceValueChoiceClaims()` that examines claims WITHIN each choice (e.g., "the 7 is in the hundreds place", "worth 700") against the number in the question. Works for any question format — direct, word problem, "Is X correct?", "which statement" — without needing to detect the question format.
3. **Wired gateway into all paths**: `parseGeneratedQuestion()`, `generateDrillBatch()`, `generateMixedDrillBatch()`, `generate_diagnostic`, `popUnusedQuestion()` (cache), and `simulate/generate_math` all now call the gateway.
4. **Prompt parity**: Added PLACE VALUE CHECK and STATEMENT QUESTIONS instructions to both batch generation prompts.

### Key Lesson
**Verification must be a chokepoint, not an annotation.** The v1 fix was correct in logic but wrong in architecture — it added verification to ONE code path while the system had SIX. When you fix a validation gap, audit EVERY path that produces or serves the affected data type. A validation function that isn't called is the same as no validation at all. Create a single gateway function and ensure all paths pass through it. The gateway pattern also means future verifiers only need to be added in one place.

---

## Bug: Tutor Asks Open-Ended Socratic Questions Instead of MC Questions

### Symptoms
- After teaching a concept, the tutor asks an open-ended question like "What numbers do you see, and what operation do you think you need? Tell me your thinking!"
- Student types a free-form answer, then gets ANOTHER Socratic follow-up ("What would happen if Mike bought 4 packs instead of 3?")
- The actual MC question (with A/B/C/D/E choices) only appears after this double interaction
- The student experience is: teach → open-ended question → type answer → Socratic follow-up → MC question (3 interactions before the first real question)

### Root Cause — Three Compounding Sources of Open-Ended Questions

**Source 1: `buildTeachMessages()` prompt (tutor-agent.ts line 290)**
The teach prompt ended with "End by asking me a question to check my understanding." Combined with the Socratic philosophy in the system prompt, the AI naturally generated probing questions like "What numbers do you see? Tell me your thinking!"

**Source 2: Deferred MC question pattern (`useTutoringSession.ts`)**
After teaching, the hook stored the MC question in `pendingQuestion.current` and set `phase: "ready"` — waiting for the student to respond to the open-ended question. The MC question was only generated AFTER the student typed something. This existed in 3 places: initial session start, mid-session skill switch, and teach-mode after answer evaluation.

**Source 3: `buildHintMessages()` Socratic follow-up (tutor-agent.ts line 596)**
When the student typed a response to the teaching (with no `activeQuestion` set), the `sendMessage` handler called `get_hint`, which had its own prompt: "Ask me ONE thoughtful Socratic follow-up question to deepen my understanding." This generated ANOTHER open-ended question before finally generating the deferred MC question.

**Source 4: System prompt rule (tutor-agent.ts line 154)**
"If a student gives a wrong answer, ask what their reasoning was before correcting" — this generated open-ended questions after wrong MC answers too.

### Fix (Approach A: Remove all open-ended question sources + eliminate deferral)

1. **`buildTeachMessages()` prompt**: Changed from "End by asking me a question to check my understanding" → "End with an encouraging transition like 'Let's try one!' Do NOT ask me any questions — the system will present a practice question automatically."
2. **Removed deferral pattern**: At all 3 `pendingQuestion` sites, replaced the deferred pattern with immediate `generate_question` calls. The MC question now appears right after teaching, no student interaction required.
3. **`sendMessage` free-text handler**: Replaced `get_hint` (Socratic follow-up) with `explain_more` (helpful response without questions). Removed all dead `pendingQuestion` consumer code.
4. **`buildHintMessages()` prompt**: Changed from "ask me ONE thoughtful Socratic follow-up question" → "give me a helpful hint or nudge. Do NOT ask me any questions."
5. **System prompt rule**: Changed "ask what their reasoning was" → "give a brief encouraging nudge. Do NOT ask open-ended questions."
6. **Cleanup**: Removed `pendingQuestion` ref entirely (declaration + restart cleanup + import of unused `DifficultyLevel` type).

### Key Lesson
**Deferred interactions create invisible multi-step flows.** The `pendingQuestion` pattern seemed elegant (teach → let student absorb → then quiz) but created a confusing 3-step interaction before the first real question. For young students (ages 9-12), the flow should be as direct as possible: teach → MC question. If the student needs more help, they can click explicit buttons ("Explain more", "I'm stuck"). Don't force interactions — let the student pull help when they need it.

**AI prompts that say "ask a question" will always generate questions.** Even with a system prompt that says "no follow-up questions after correct answers," a teach prompt that says "end by asking a question" will generate a question. Prompt instructions don't override each other — they compound. Be explicit about what the AI should NOT do in EVERY prompt that could generate unwanted behavior.

**Audit every consumer of removed state.** When removing `pendingQuestion`, the ref was set in 3 places but consumed in 2 (sendMessage + restart). Removing the setters without removing the consumers would leave dead code. Always grep for all references when removing state.

---

## Bug: "Failed to Generate a Valid Question" After Teaching

### Symptoms
- After the tutor teaches a concept, instead of seeing a multiple choice question, the student sees: "Hmm, I had some trouble there. Failed to generate a valid question. Please try again."
- This appeared after removing the deferred question pattern (teach → immediate MC question).

### Root Cause
The question generation pipeline (`getCachedQuestion` in `question-cache.ts`) has three fallback paths: cache lookup → batch generation → direct generation. ALL three must fail for the user to see the error. The failure is caused by two compounding factors:

**Factor 1: Back-to-back API calls.** After removing the deferred question pattern, the teach streaming (Anthropic API) is immediately followed by a question generation call (also Anthropic API). With no gap between them, rate limit pressure or connection contention can degrade the second call, causing the AI to return malformed responses that fail parsing.

**Factor 2: Zero retries + strict validation.** The validation gateway (`validateGeneratedQuestion`) runs 4 validators (format, place value, choice claims, statements). A question that fails any single check is rejected. With 5 questions per batch and strict validation, it's possible for all 5 to be rejected — and then the direct fallback is also rejected. With zero retries at any level, a single bad batch means total failure.

**Factor 3: Dedup pressure.** As the student answers more questions, the `recentQuestions` array grows (up to 20 entries). This is injected into the AI prompt as "avoid these questions," making the prompt increasingly restrictive and harder for the AI to satisfy while also passing validation.

### Fix
1. **150ms delay** after teach streaming before question generation — avoids API rate contention.
2. **Retry batch generation** once with trimmed dedup list (last 5 instead of all 20) when first batch fails.
3. **Retry direct fallback** once with trimmed dedup list (last 3) when first attempt fails.

### Key Lesson
**Validation without retry is a cliff edge.** Strict validation is essential (we've seen what happens with invalid place-value questions), but each rejection point needs a retry mechanism. The retry should relax constraints progressively — first try with full dedup, then with partial dedup. The cost of one extra API call on failure is negligible compared to showing the user an error.

**Sequential API calls need breathing room.** When one streaming API call is immediately followed by another, add a small delay. Streaming responses keep the connection alive until the last byte; a 150ms gap ensures the connection is fully released before the next request.

---

## General Principles

- **Validate AI outputs deterministically wherever possible.** Don't rely on "verify your answer" instructions in prompts — they're unreliable for mechanical reasoning tasks.
- **Errors compound in multi-part AI generation.** A question with 5 statements has 5 chances for the AI to make a mistake. The more independent claims the AI must get right, the more likely at least one will be wrong. Design validation to check EACH claim, not just the overall structure.
- **Session boundaries need explicit limits on multiple dimensions** (time AND question count AND maybe cognitive load indicators). Relying on a single dimension leaves gaps.
- **UI promises must match system behavior.** If the progress bar says "12 questions," the session should actually end near 12.
- **Trace the full data flow when debugging.** The bug wasn't in `answersMatch()` or the AI evaluation — it was upstream in question generation. Following the data from creation to consumption revealed the true root cause.
- **Layer defenses: prompt + programmatic + rejection.** Prompt instructions reduce error frequency but can't eliminate it. Programmatic verification catches what prompts miss. Rejection + regeneration ensures students only see correct questions. All three layers are needed.
- **Verification must be a chokepoint, not an annotation.** When adding validation, create a single gateway function and route ALL code paths through it. Adding verification to one path while others bypass it is a false sense of safety. Audit every producer and consumer of the data type being validated.
- **Verify claims at the choice level, not just the question level.** Detecting question format via regex is fragile — the AI generates infinite phrasings. Instead, verify the mathematical claims embedded within each answer choice. This is format-agnostic and catches errors regardless of how the question is worded.
