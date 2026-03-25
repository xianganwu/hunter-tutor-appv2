# Retire Mastered Words from Matching Quiz

## Step 1: Data model (`src/lib/vocabulary.ts`)
- [x] Add `matchCorrectStreak?: number` and `retired?: boolean` to VocabCard
- [x] Add `"retired"` to WordStatus type
- [x] Update `getWordStatus()`: return "retired" if `card.retired === true`
- [x] Update `getDueCards()`: filter out retired
- [x] Update `getNewCards()`: filter out retired
- [x] Update `computeVocabStats()`: exclude retired from due/learned counts
- [x] Add `retireWord()` and `unretireWord()` functions
- [x] Add `MATCH_STREAK_TO_RETIRE = 3` constant
- [x] Unit tests: 14/14 pass

## Step 2: Matching quiz tracking (`src/hooks/useVocabBuilder.ts`)
- [x] `buildMatchingRound()`: exclude retired cards
- [x] `selectMatchDefinition()`: increment `matchCorrectStreak` on first-try correct
- [x] `selectMatchDefinition()`: reset `matchCorrectStreak` to 0 on wrong
- [x] Auto-retire when streak reaches 3
- [x] Show retirement celebration via `recentlyRetiredWord` field
- [x] `startMatchingQuiz()`: use non-retired count for totalRounds
- [x] Fix `newCount` computed value to exclude retired

## Step 3: Word Browser UI (`src/components/vocab/WordBrowser.tsx`)
- [x] Add "retired" to filter options with count and status config
- [x] Status badge styling for retired
- [x] Show "Bring back for study" button for retired words
- [x] Left border + opacity for retired words

## Step 4: Suggested words exclusion
- [x] Already handled — retired words are in deck, so excluded from `getAllWords().filter(!existingIds)`

## Step 5: UI updates
- [x] Retirement celebration banner in MatchingQuiz component
- [x] `canMatch` uses non-retired count

## Verification
- [x] typecheck: 0 new errors (14 pre-existing)
- [x] lint: 0 errors, 0 warnings
- [x] vocabulary.test.ts: 14/14 pass
- [x] full test suite: 0 new failures (17 pre-existing)
