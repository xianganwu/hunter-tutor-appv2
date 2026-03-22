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

## General Principles

- **Validate AI outputs deterministically wherever possible.** Don't rely on "verify your answer" instructions in prompts — they're unreliable for mechanical reasoning tasks.
- **Errors compound in multi-part AI generation.** A question with 5 statements has 5 chances for the AI to make a mistake. The more independent claims the AI must get right, the more likely at least one will be wrong. Design validation to check EACH claim, not just the overall structure.
- **Session boundaries need explicit limits on multiple dimensions** (time AND question count AND maybe cognitive load indicators). Relying on a single dimension leaves gaps.
- **UI promises must match system behavior.** If the progress bar says "12 questions," the session should actually end near 12.
- **Trace the full data flow when debugging.** The bug wasn't in `answersMatch()` or the AI evaluation — it was upstream in question generation. Following the data from creation to consumption revealed the true root cause.
- **Layer defenses: prompt + programmatic + rejection.** Prompt instructions reduce error frequency but can't eliminate it. Programmatic verification catches what prompts miss. Rejection + regeneration ensures students only see correct questions. All three layers are needed.
