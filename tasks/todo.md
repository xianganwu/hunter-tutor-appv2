# Vocab Session Enhancement

## Features
- [x] 1. Pronunciation Button (usePronunciation hook + PronounceButton component + integrate in VocabSession)
- [x] 2. Word Browser ("My Words" with status filters, sort, search, expandable detail)
- [x] 3. Matching Quiz Mode (5-word matching game with rounds)
- [x] 4. Context Sentences on Demand (use existing generate_context API)
- [x] 5. Auto-Prompt Sentence Writing for Struggling Words

## Verification
- [x] typecheck passes (0 new errors, 14 pre-existing)
- [x] lint passes (0 errors, 0 warnings)
- [ ] smoke test full vocab flow

## Files Created
- `src/hooks/usePronunciation.ts` — Web Speech API hook
- `src/components/vocab/PronounceButton.tsx` — Speaker icon button
- `src/components/vocab/WordBrowser.tsx` — My Words list with filters/sort/search
- `src/components/vocab/MatchingQuiz.tsx` — 5-word matching game + completion summary

## Files Modified
- `src/hooks/useVocabBuilder.ts` — Added matching, word browser, context, auto-prompt state/actions
- `src/components/vocab/VocabSession.tsx` — Integrated all 5 features into UI
- `src/lib/vocabulary.ts` — Added `WordStatus` type + `getWordStatus()` function
- `tailwind.config.ts` — Added shake animation for wrong match feedback
