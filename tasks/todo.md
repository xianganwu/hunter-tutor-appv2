# Feature: Reading Passage Library Expansion + Difficulty Tagging

## Phase 1: Content Generation (25 new passages → 50 total)
- [x] Generate 5 new fiction passages (difficulty 2-5, word counts 250-800)
- [x] Generate 5 new nonfiction passages (difficulty 2-5, word counts 250-800)
- [x] Generate 5 new poetry passages (difficulty 2-5, word counts 200-400)
- [x] Generate 5 new historical_document passages (difficulty 2-5, word counts 300-700)
- [x] Generate 5 new science_article passages (difficulty 2-5, word counts 300-800)
- [x] Each passage: 5 MC questions tagged to specific reading skills
- [x] Ensure even distribution across stamina levels (1-6)

## Phase 2: Dynamic Passage Loading
- [x] Update `passages.ts` to import all 50 passages (10 per genre)
- [x] Add new query functions: `getPassagesByLexile()`, `getPassagesByTheme()`, `getAllThemes()`
- [x] Update `queryPassages()` to support lexile and theme filters

## Phase 3: Enhanced Metadata & Filtering
- [x] Add `lexile_range` field to PassageMetadata type
- [x] Add `themes` field to PassageMetadata type
- [x] Update existing 25 passages with lexile_range and themes
- [x] All 25 new passages include lexile_range and themes

## Phase 4: Integration with Reading Stamina
- [x] Update `selectPassageForLevel()` to prefer genre diversity
- [x] Pass recent reading records for genre diversity logic
- [x] Typecheck + lint + build passes

---

# Feature: Vocabulary Builder with Spaced Repetition

## Phase 1: Data Model & Types
- [x] Create `src/lib/vocabulary.ts` — VocabWord, VocabCard, VocabDeck types
- [x] SM-2 spaced repetition algorithm: computeNextReview()
- [x] Deck operations: getDueCards, getNewCards, addWordToDeck, removeWordFromDeck
- [x] Storage: loadVocabDeck/saveVocabDeck (localStorage)
- [x] Stats: computeVocabStats with streak calculation

## Phase 2: Word List Content
- [x] `content/vocabulary/foundations.json` — 105 words (difficulty 1-3)
- [x] `content/vocabulary/hunter_prep.json` — 108 words (difficulty 3-5)
- [x] `src/lib/exam/vocabulary.ts` — word list loader + query functions

## Phase 3: Vocab API
- [x] `src/app/api/vocab/route.ts` — 3 actions:
  - generate_context: AI generates example sentences
  - evaluate_usage: AI evaluates student's sentence
  - extract_vocab: AI extracts challenging words from passage

## Phase 4: Core UI
- [x] `src/app/vocab/page.tsx` — route shell
- [x] `src/hooks/useVocabBuilder.ts` — state machine hook
- [x] `src/components/vocab/VocabSession.tsx` — full UI with:
  - Deck overview with stats + suggested words
  - Card front (word + "Show Definition" / "I Know This")
  - Card back (definition + example + SM-2 rating buttons)
  - Use in a sentence mini-exercise with AI evaluation
  - Session complete with stats summary

## Phase 5: Integration
- [x] Add "Vocab" to TopNav navigation links
- [x] Add "Vocab Builder" quick action to DashboardContent
- [x] Add /vocab to middleware protected paths + matcher
- [ ] After reading session: extract difficult words → offer to add to vocab deck (future)

## Phase 6: Verify
- [x] Typecheck passes
- [x] Lint passes
- [x] Production build succeeds
- [x] All 50 passages valid JSON with proper metadata
