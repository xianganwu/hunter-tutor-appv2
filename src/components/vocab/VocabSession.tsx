"use client";

import { useVocabBuilder } from "@/hooks/useVocabBuilder";
import type { VocabWord, VocabCard } from "@/lib/vocabulary";
import { NextTaskPrompt } from "@/components/shared/NextTaskPrompt";
import { DailyPlanProgress } from "@/components/shared/DailyPlanProgress";
import { PronounceButton } from "@/components/vocab/PronounceButton";
import { WordBrowser } from "@/components/vocab/WordBrowser";
import { MatchingQuiz, MatchingComplete } from "@/components/vocab/MatchingQuiz";

// ─── Main Component ──────────────────────────────────────────────────

export function VocabSession() {
  const {
    state,
    stats,
    dueCount,
    newCount,
    studyAvailable,
    progress,
    startStudy,
    showDefinition,
    markKnown,
    rateCard,
    startUseWord,
    setUseWordInput,
    submitSentence,
    skipUseWord,
    addWord,
    removeWord,
    handleUnretire,
    addRandomWords,
    backToOverview,
    openWordBrowser,
    startMatchingQuiz,
    selectMatchWord,
    selectMatchDefinition,
    fetchContextSentences,
  } = useVocabBuilder();

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-2xl mx-auto bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M13 16l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <div>
            <h1 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              Vocabulary Builder
            </h1>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {stats.totalCards} words &middot; {stats.learned} mastered
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DailyPlanProgress />
          {stats.streakDays > 0 && (
            <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
              {stats.streakDays} day streak
            </span>
          )}
          {state.phase !== "deck_overview" && (
            <button
              onClick={backToOverview}
              className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      </header>

      {/* Progress bar during flashcard study */}
      {(state.phase === "card_front" ||
        state.phase === "card_back" ||
        state.phase === "use_word") && (
        <div className="h-1 bg-surface-200 dark:bg-surface-800">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {state.phase === "deck_overview" && (
          <DeckOverview
            stats={stats}
            dueCount={dueCount}
            newCount={newCount}
            studyAvailable={studyAvailable}
            suggestedWords={state.suggestedWords}
            canMatch={state.deck.cards.filter((c) => !c.retired).length >= 5}
            onStartStudy={startStudy}
            onAddWord={addWord}
            onAddRandomWords={addRandomWords}
            onOpenWordBrowser={openWordBrowser}
            onStartMatchingQuiz={startMatchingQuiz}
          />
        )}

        {state.phase === "card_front" && state.currentCard && (
          <CardFront
            card={state.currentCard}
            cardIndex={state.currentCardIndex}
            totalCards={state.studyQueue.length}
            onShowDefinition={showDefinition}
            onMarkKnown={markKnown}
          />
        )}

        {state.phase === "card_back" && state.currentCard && (
          <CardBack
            card={state.currentCard}
            contextSentences={state.contextSentences}
            contextLoading={state.contextLoading}
            onRate={rateCard}
            onUseWord={startUseWord}
            onFetchContext={fetchContextSentences}
          />
        )}

        {state.phase === "use_word" && state.currentCard && (
          <UseWord
            card={state.currentCard}
            input={state.useWordInput}
            feedback={state.useWordFeedback}
            correct={state.useWordCorrect}
            loading={state.useWordLoading}
            isAutoPrompted={state.pendingRating !== null}
            onInputChange={setUseWordInput}
            onSubmit={submitSentence}
            onSkip={skipUseWord}
          />
        )}

        {state.phase === "session_complete" && (
          <SessionComplete
            stats={state.sessionStats}
            deckStats={stats}
            onBackToDashboard={backToOverview}
          />
        )}

        {state.phase === "word_browser" && (
          <WordBrowser
            cards={state.deck.cards}
            onRemoveWord={removeWord}
            onUnretireWord={handleUnretire}
            onBack={backToOverview}
          />
        )}

        {state.phase === "matching_quiz" && state.matching && (
          <MatchingQuiz
            matching={state.matching}
            onSelectWord={selectMatchWord}
            onSelectDefinition={selectMatchDefinition}
          />
        )}

        {state.phase === "matching_complete" && state.matching && (
          <MatchingComplete
            matching={state.matching}
            onBackToDashboard={backToOverview}
            onPlayAgain={startMatchingQuiz}
          />
        )}
      </div>
    </div>
  );
}

// ─── Deck Overview ───────────────────────────────────────────────────

function DeckOverview({
  stats,
  dueCount,
  newCount,
  studyAvailable,
  suggestedWords,
  canMatch,
  onStartStudy,
  onAddWord,
  onAddRandomWords,
  onOpenWordBrowser,
  onStartMatchingQuiz,
}: {
  readonly stats: {
    readonly totalCards: number;
    readonly dueNow: number;
    readonly learned: number;
    readonly streakDays: number;
  };
  readonly dueCount: number;
  readonly newCount: number;
  readonly studyAvailable: boolean;
  readonly suggestedWords: readonly VocabWord[];
  readonly canMatch: boolean;
  readonly onStartStudy: () => void;
  readonly onAddWord: (word: VocabWord) => void;
  readonly onAddRandomWords: (count: number) => void;
  readonly onOpenWordBrowser: () => void;
  readonly onStartMatchingQuiz: () => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Words" value={String(stats.totalCards)} />
        <StatCard
          label="Due Today"
          value={String(dueCount)}
          highlight={dueCount > 0}
        />
        <StatCard label="Mastered" value={String(stats.learned)} />
        <StatCard
          label="New to Learn"
          value={String(newCount)}
        />
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          onClick={onStartStudy}
          disabled={!studyAvailable}
          className="w-full rounded-2xl bg-brand-600 px-4 py-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors shadow-soft"
        >
          {dueCount > 0
            ? `Study Now (${dueCount} due${newCount > 0 ? ` + ${Math.min(newCount, 10)} new` : ""})`
            : newCount > 0
              ? `Learn ${Math.min(newCount, 10)} New Words`
              : "All caught up! Add more words below."}
        </button>

        <div className="flex gap-2">
          <button
            onClick={onStartMatchingQuiz}
            disabled={!canMatch}
            className="flex-1 rounded-xl border border-brand-300 dark:border-brand-600/30 bg-brand-50 dark:bg-brand-600/10 px-4 py-3 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Matching Quiz
          </button>
          <button
            onClick={onOpenWordBrowser}
            disabled={stats.totalCards === 0}
            className="flex-1 rounded-xl border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-4 py-3 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            My Words
          </button>
        </div>
      </div>

      {/* Empty state */}
      {stats.totalCards === 0 && (
        <div className="rounded-2xl bg-brand-50 dark:bg-brand-600/10 border border-brand-200 dark:border-brand-800 p-5 text-center space-y-3">
          <div className="text-3xl">📚</div>
          <h3 className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Build Your Vocabulary Deck
          </h3>
          <p className="text-xs text-brand-600 dark:text-brand-400">
            Add words below to start studying. The spaced repetition system will
            help you remember them for the long term.
          </p>
          <button
            onClick={() => onAddRandomWords(20)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Add 20 Starter Words
          </button>
        </div>
      )}

      {/* Suggested words to add */}
      {suggestedWords.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
              Add Words
            </h3>
            <button
              onClick={() => onAddRandomWords(5)}
              className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors"
            >
              + Add 5 random
            </button>
          </div>

          <div className="space-y-2">
            {suggestedWords.map((word) => (
              <div
                key={word.wordId}
                className="flex items-center justify-between rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 px-4 py-3 shadow-soft"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {word.word}
                    </span>
                    <span className="text-xs text-surface-400 italic">
                      {word.partOfSpeech}
                    </span>
                    <DifficultyDots difficulty={word.difficulty} />
                  </div>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">
                    {word.definition}
                  </p>
                </div>
                <button
                  onClick={() => onAddWord(word)}
                  className="flex-shrink-0 rounded-lg bg-brand-100 dark:bg-brand-600/20 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-600/30 transition-colors"
                  aria-label={`Add ${word.word} to deck`}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak celebration */}
      {stats.streakDays >= 3 && (
        <div className="rounded-2xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-600/30 p-4 text-center">
          <p className="text-sm font-medium text-success-700 dark:text-success-300">
            {stats.streakDays} day vocabulary streak! Keep it up!
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Card Front ──────────────────────────────────────────────────────

function CardFront({
  card,
  cardIndex,
  totalCards,
  onShowDefinition,
  onMarkKnown,
}: {
  readonly card: VocabCard;
  readonly cardIndex: number;
  readonly totalCards: number;
  readonly onShowDefinition: () => void;
  readonly onMarkKnown: () => void;
}) {
  const isNew = card.repetitions === 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      {/* Card counter */}
      <div className="text-xs text-surface-400 mb-6">
        Card {cardIndex + 1} of {totalCards}
        {isNew && (
          <span className="ml-2 rounded-full bg-brand-100 dark:bg-brand-600/20 px-2 py-0.5 text-brand-600 dark:text-brand-400 font-medium">
            New
          </span>
        )}
      </div>

      {/* Word card */}
      <div className="w-full max-w-md rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-8 text-center space-y-3">
        <DifficultyDots difficulty={card.word.difficulty} />
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
            {card.word.word}
          </h2>
          <PronounceButton word={card.word.word} />
        </div>
        <p className="text-sm text-surface-400 italic">
          {card.word.partOfSpeech}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-8 w-full max-w-md">
        <button
          onClick={onShowDefinition}
          className="flex-1 rounded-xl border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-4 py-3 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          Show Definition
        </button>
        <button
          onClick={onMarkKnown}
          className="flex-1 rounded-xl bg-success-500 px-4 py-3 text-sm font-medium text-white hover:bg-success-600 transition-colors"
        >
          I Know This
        </button>
      </div>
    </div>
  );
}

// ─── Card Back ───────────────────────────────────────────────────────

function CardBack({
  card,
  contextSentences,
  contextLoading,
  onRate,
  onUseWord,
  onFetchContext,
}: {
  readonly card: VocabCard;
  readonly contextSentences: readonly string[] | null;
  readonly contextLoading: boolean;
  readonly onRate: (quality: 1 | 2 | 4 | 5) => void;
  readonly onUseWord: () => void;
  readonly onFetchContext: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      {/* Word + Definition card */}
      <div className="w-full max-w-md rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-8 space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
              {card.word.word}
            </h2>
            <PronounceButton word={card.word.word} />
          </div>
          <p className="text-xs text-surface-400 italic mt-1">
            {card.word.partOfSpeech}
          </p>
        </div>

        <div className="border-t border-surface-200 dark:border-surface-700 pt-4">
          <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
            {card.word.definition}
          </p>
        </div>

        <div className="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
          <p className="text-xs text-surface-500 dark:text-surface-400 italic leading-relaxed">
            &ldquo;{card.word.exampleSentence}&rdquo;
          </p>
        </div>

        {/* Context sentences */}
        {contextSentences && contextSentences.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            <p className="text-xs font-medium text-surface-500">
              More examples:
            </p>
            {contextSentences.map((sentence, i) => (
              <div
                key={i}
                className="rounded-xl bg-surface-50 dark:bg-surface-800 p-3"
              >
                <p className="text-xs text-surface-500 dark:text-surface-400 italic leading-relaxed">
                  &ldquo;{sentence}&rdquo;
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onUseWord}
            className="flex-1 rounded-xl border border-brand-200 dark:border-brand-600/30 bg-brand-50 dark:bg-brand-600/10 px-3 py-2 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-600/20 transition-colors"
          >
            Use in a sentence
          </button>
          {!contextSentences && (
            <button
              onClick={onFetchContext}
              disabled={contextLoading}
              className="rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-3 py-2 text-xs font-medium text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-50 transition-colors"
            >
              {contextLoading ? "Loading..." : "More examples"}
            </button>
          )}
        </div>
      </div>

      {/* Rating buttons */}
      <div className="mt-6 w-full max-w-md">
        <p className="text-xs text-surface-400 text-center mb-3">
          How well did you know this?
        </p>
        <div className="grid grid-cols-4 gap-2">
          <RatingButton
            label="Again"
            sublabel="Forgot"
            quality={1}
            color="red"
            onRate={onRate}
          />
          <RatingButton
            label="Hard"
            sublabel="Struggled"
            quality={2}
            color="orange"
            onRate={onRate}
          />
          <RatingButton
            label="Good"
            sublabel="Recalled"
            quality={4}
            color="green"
            onRate={onRate}
          />
          <RatingButton
            label="Easy"
            sublabel="Instant"
            quality={5}
            color="blue"
            onRate={onRate}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Rating Button ───────────────────────────────────────────────────

function RatingButton({
  label,
  sublabel,
  quality,
  color,
  onRate,
}: {
  readonly label: string;
  readonly sublabel: string;
  readonly quality: 1 | 2 | 4 | 5;
  readonly color: "red" | "orange" | "green" | "blue";
  readonly onRate: (quality: 1 | 2 | 4 | 5) => void;
}) {
  const colorClasses: Record<string, string> = {
    red: "border-red-200 dark:border-red-600/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20",
    orange:
      "border-streak-200 dark:border-streak-600/30 bg-streak-50 dark:bg-streak-500/10 text-streak-700 dark:text-streak-300 hover:bg-streak-100 dark:hover:bg-streak-500/20",
    green:
      "border-success-200 dark:border-success-600/30 bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-500/20",
    blue: "border-brand-200 dark:border-brand-600/30 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/20",
  };

  return (
    <button
      onClick={() => onRate(quality)}
      className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${colorClasses[color]}`}
    >
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[10px] opacity-70">{sublabel}</div>
    </button>
  );
}

// ─── Use Word ────────────────────────────────────────────────────────

function UseWord({
  card,
  input,
  feedback,
  correct,
  loading,
  isAutoPrompted,
  onInputChange,
  onSubmit,
  onSkip,
}: {
  readonly card: VocabCard;
  readonly input: string;
  readonly feedback: string | null;
  readonly correct: boolean | null;
  readonly loading: boolean;
  readonly isAutoPrompted?: boolean;
  readonly onInputChange: (input: string) => void;
  readonly onSubmit: () => void;
  readonly onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="w-full max-w-md space-y-4">
        {/* Auto-prompt encouragement */}
        {isAutoPrompted && !feedback && (
          <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-200 dark:border-brand-600/30 px-4 py-3 text-center">
            <p className="text-xs text-brand-600 dark:text-brand-400">
              Let&apos;s practice this one! Try using it in a sentence to help it stick.
            </p>
          </div>
        )}

        {/* Word reference */}
        <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-5">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">
              {card.word.word}
            </h3>
            <PronounceButton word={card.word.word} />
          </div>
          <p className="text-xs text-surface-500 dark:text-surface-400 text-center mt-1">
            {card.word.definition}
          </p>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label
            htmlFor="sentence-input"
            className="text-sm font-medium text-surface-700 dark:text-surface-300"
          >
            Write a sentence using &ldquo;{card.word.word}&rdquo;
          </label>
          <textarea
            id="sentence-input"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={`Use "${card.word.word}" in your own sentence...`}
            disabled={loading || feedback !== null}
            rows={3}
            className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-4 py-3 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 resize-none"
          />
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`rounded-xl border p-4 animate-fade-in ${
              correct === true
                ? "border-success-200 dark:border-success-600/30 bg-success-50 dark:bg-success-500/10"
                : correct === false
                  ? "border-streak-200 dark:border-streak-600/30 bg-streak-50 dark:bg-streak-500/10"
                  : "border-brand-200 dark:border-brand-600/30 bg-brand-50 dark:bg-brand-500/10"
            }`}
          >
            <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
              {feedback}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!feedback ? (
            <>
              <button
                onClick={onSkip}
                className="flex-1 rounded-xl border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={onSubmit}
                disabled={!input.trim() || loading}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Checking...
                  </span>
                ) : (
                  "Check"
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onSkip}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Session Complete ────────────────────────────────────────────────

function SessionComplete({
  stats,
  deckStats,
  onBackToDashboard,
}: {
  readonly stats: {
    readonly reviewed: number;
    readonly correct: number;
    readonly newLearned: number;
  };
  readonly deckStats: {
    readonly totalCards: number;
    readonly dueNow: number;
    readonly learned: number;
    readonly streakDays: number;
  };
  readonly onBackToDashboard: () => void;
}) {
  const accuracy =
    stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;

  return (
    <div className="max-w-md mx-auto py-8 space-y-6 animate-slide-up">
      <div className="text-center">
        <div className="text-4xl mb-3">
          {accuracy >= 90 ? "🌟" : accuracy >= 70 ? "👏" : "💪"}
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
          Session Complete!
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          {accuracy >= 90
            ? "Outstanding! You really know your words!"
            : accuracy >= 70
              ? "Great work! Keep reviewing to lock these in."
              : "Good effort! These words will get easier with practice."}
        </p>
      </div>

      {/* Session stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
            {stats.reviewed}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">Reviewed</div>
        </div>
        <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div
            className={`text-2xl font-bold ${
              accuracy >= 80
                ? "text-success-500 dark:text-success-400"
                : accuracy >= 60
                  ? "text-streak-500 dark:text-streak-400"
                  : "text-red-500 dark:text-red-400"
            }`}
          >
            {accuracy}%
          </div>
          <div className="text-xs text-surface-500 mt-0.5">Accuracy</div>
        </div>
        <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-3 text-center">
          <div className="text-2xl font-bold text-success-500">
            {stats.newLearned}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">New Learned</div>
        </div>
      </div>

      {/* Deck progress */}
      <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
          Deck Progress
        </h3>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <div className="text-surface-400 text-xs">Total Words</div>
            <div className="font-medium text-surface-900 dark:text-surface-100">
              {deckStats.totalCards}
            </div>
          </div>
          <div>
            <div className="text-surface-400 text-xs">Mastered</div>
            <div className="font-medium text-surface-900 dark:text-surface-100">
              {deckStats.learned}
            </div>
          </div>
          <div>
            <div className="text-surface-400 text-xs">Due Tomorrow</div>
            <div className="font-medium text-surface-900 dark:text-surface-100">
              {deckStats.dueNow}
            </div>
          </div>
          <div>
            <div className="text-surface-400 text-xs">Streak</div>
            <div className="font-medium text-surface-900 dark:text-surface-100">
              {deckStats.streakDays} {deckStats.streakDays === 1 ? "day" : "days"}
            </div>
          </div>
        </div>

        {/* Mastery progress bar */}
        {deckStats.totalCards > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-surface-400">
              <span>Mastery</span>
              <span>
                {Math.round((deckStats.learned / deckStats.totalCards) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-success-500 transition-all duration-500"
                style={{
                  width: `${(deckStats.learned / deckStats.totalCards) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <NextTaskPrompt />
        <button
          onClick={onBackToDashboard}
          className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-2.5 text-center text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          Continue Studying
        </button>
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────

function StatCard({
  label,
  value,
  highlight,
}: {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl shadow-soft bg-surface-0 dark:bg-surface-900 p-4 text-center">
      <div
        className={`text-2xl font-bold ${
          highlight
            ? "text-brand-600 dark:text-brand-400"
            : "text-surface-900 dark:text-surface-100"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-surface-500 mt-0.5">{label}</div>
    </div>
  );
}

function DifficultyDots({ difficulty }: { readonly difficulty: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Difficulty ${difficulty} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < difficulty
              ? difficulty <= 2
                ? "bg-success-400"
                : difficulty <= 3
                  ? "bg-streak-400"
                  : "bg-red-400"
              : "bg-surface-200 dark:bg-surface-600"
          }`}
        />
      ))}
    </div>
  );
}
