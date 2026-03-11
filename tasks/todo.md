# Fix: Math fractions rendering as raw text

## Root Cause
`ChoiceButtons` component renders answer choice text as plain `<span>` instead of `<MathText>`.
When AI generates LaTeX like `$\frac{4}{3}$`, the raw LaTeX shows instead of a rendered fraction.
The user sees "43" instead of the properly rendered fraction 4/3.

## Affected Components
- [x] `src/components/chat/ChoiceButtons.tsx` — answer choices (plain span, no MathText)
- [x] `src/components/tutor/DrillMode.tsx` — question text (plain text, no MathText)
- [x] `src/components/tutor/MistakeReview.tsx` — question text + answer choices (plain text)
- [x] `src/components/tutor/MistakeJournal.tsx` — question text, student/correct answers (plain text)

## Already Correct (no changes needed)
- `DiagnosticTest.tsx` — uses MathText for question + choices
- `SimulationSession.tsx` QuestionCard — uses MathText
- `ChatBubble.tsx` — uses MathText
- `GuidedStudySession.tsx` TeachingView + PracticingView question — uses MathText

## Fix Plan
1. Update `ChoiceButtons` to wrap choice text in `<MathText>`
2. Update `DrillMode` to wrap questionText in `<MathText>`
3. Update `MistakeReview` to use `<MathText>` for question + choices
4. Update `MistakeJournal` to use `<MathText>` for question, student answer, correct answer

## Review
- [x] Typecheck passes
- [x] Lint passes
- [x] Build passes
