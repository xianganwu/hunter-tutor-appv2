"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type {
  ChatAction,
  ChatApiResponse,
  ChatMessageDisplay,
  LevelUpEvent,
  SessionState,
  SessionSummaryData,
} from "@/components/tutor/types";
import type { ConversationMessage, GeneratedQuestion } from "@/lib/ai/tutor-agent";
import {
  adjustDifficulty,
  masteryToTier,
  calculateMasteryUpdate,
  createPacingState,
  advancePacingAfterQuestion,
  advancePacingAfterTeaching,
  getNextPacingAction,
  tierLabel,
} from "@/lib/adaptive";
import type { AttemptRecord } from "@/lib/adaptive";
import { addMistake, createMistakeEntry } from "@/lib/mistakes";
import type { MistakeDiagnosis } from "@/lib/mistakes";
import { getSkillById, getDomainForSkill } from "@/lib/exam/curriculum";
import {
  shouldTriggerTeachBack,
  saveTeachingMoment,
  createTeachingMoment,
} from "@/lib/teaching-moments";
import type { TeachingMomentEvaluation } from "@/lib/teaching-moments";
import { loadSkillMastery, saveSkillMastery, loadAllSkillMasteries, computeSkillReviewSchedule } from "@/lib/skill-mastery-store";
import { selectNextSkills } from "@/lib/adaptive";
import { getSkillIdsForDomain } from "@/lib/exam/curriculum";
import { autoCompleteDailyTask } from "@/lib/daily-plan";
import { checkAndAwardBadges, buildBadgeContext } from "@/lib/achievements";

const ESTIMATED_QUESTIONS = 12;

const SKILL_DOMAINS = [
  "reading_comprehension",
  "math_quantitative_reasoning",
  "math_achievement",
] as const;

function pickNextSkill(currentSkillId: string): { skillId: string; skillName: string; route: string } | null {
  const all = loadAllSkillMasteries();
  const stateMap = new Map(
    all.map((s) => [s.skillId, { ...s, lastPracticed: s.lastPracticed ? new Date(s.lastPracticed) : null }])
  );

  let bestSkillId: string | null = null;
  let bestScore = -1;

  for (const domain of SKILL_DOMAINS) {
    const skillIds = getSkillIdsForDomain(domain);
    const priorities = selectNextSkills(skillIds, stateMap);
    if (priorities.length > 0 && priorities[0].score > bestScore && priorities[0].skillId !== currentSkillId) {
      bestScore = priorities[0].score;
      bestSkillId = priorities[0].skillId;
    }
  }

  if (!bestSkillId) return null;
  const skill = getSkillById(bestSkillId);
  const route = bestSkillId.startsWith("rc_")
    ? `/tutor/reading?skill=${bestSkillId}`
    : `/tutor/math?skill=${bestSkillId}`;
  return { skillId: bestSkillId, skillName: skill?.name ?? bestSkillId, route };
}

/**
 * Pick the next best skill within the SAME domain as the current skill.
 * Used for mid-session skill switching when the student demonstrates mastery.
 */
function pickNextSkillInDomain(
  currentSkillId: string,
  coveredSkills: readonly string[]
): { skillId: string; skillName: string } | null {
  const domain = getDomainForSkill(currentSkillId);
  if (!domain) return null;

  const domainSkillIds = getSkillIdsForDomain(domain);
  if (domainSkillIds.length <= 1) return null;

  const all = loadAllSkillMasteries();
  const stateMap = new Map(
    all.map((s) => [s.skillId, { ...s, lastPracticed: s.lastPracticed ? new Date(s.lastPracticed) : null }])
  );

  const priorities = selectNextSkills(domainSkillIds, stateMap);
  const excludeSet = new Set(coveredSkills);

  // Pick the highest-priority skill that hasn't been covered this session
  for (const p of priorities) {
    if (!excludeSet.has(p.skillId)) {
      const skill = getSkillById(p.skillId);
      if (skill) {
        return { skillId: p.skillId, skillName: skill.name };
      }
    }
  }

  return null;
}

/** Streak threshold to trigger mid-session skill switch (matches STREAK_TO_ADVANCE). */
const SKILL_SWITCH_STREAK = 3;

/** Minimum mastery to consider a skill "well-practiced" for switching. */
const SKILL_SWITCH_MASTERY = 0.7;

// ─── Frustration Detection ────────────────────────────────────────────

const FRUSTRATION_PATTERNS = [
  /i\s+(don'?t|dont)\s+(get|understand)/i,
  /(?:^|is\s+)too\s+hard/i,
  /i\s+give\s+up/i,
  /i\s+hate\s+(this|math|reading)/i,
  /i\s+(can'?t|cant)\s+(do\s+)?this/i,
  /i'?m\s+(stupid|dumb|bad\s+at)/i,
  /this\s+is\s+(impossible|stupid|pointless)/i,
  /i'?m\s+(\w+\s+)?(scared|nervous|worried|anxious)/i,
  /what\s+if\s+i\s+fail/i,
  /^(idk|whatever|i\s+don'?t\s+know|no)$/i,
  /i\s+want\s+to\s+(stop|quit)/i,
];

export function detectFrustration(text: string): boolean {
  return FRUSTRATION_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

// ─── Constants ───────────────────────────────────────────────────────

/** Max recent question texts to track for deduplication. */
const MAX_RECENT_QUESTIONS = 20;

// ─── Helpers ──────────────────────────────────────────────────────────

/** Record a question text for dedup, keeping the list capped. */
function trackQuestion(ref: { current: string[] }, text: string): void {
  ref.current.push(text);
  if (ref.current.length > MAX_RECENT_QUESTIONS) {
    ref.current = ref.current.slice(-MAX_RECENT_QUESTIONS);
  }
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeTutorMsg(
  content: string,
  type: ChatMessageDisplay["type"]
): ChatMessageDisplay {
  return {
    id: makeId(),
    role: "tutor",
    content,
    type,
    timestamp: Date.now(),
  };
}

function makeUserMsg(content: string): ChatMessageDisplay {
  return {
    id: makeId(),
    role: "user",
    content,
    type: "text",
    timestamp: Date.now(),
  };
}

/**
 * Log a wrong answer to the mistake journal (fires in background, non-blocking).
 */
function logMistakeInBackground(
  question: GeneratedQuestion,
  studentAnswer: string
): void {
  const skill = getSkillById(question.skillId);
  const skillName = skill?.name ?? question.skillId;

  fetch("/api/mistakes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "diagnose",
      skillId: question.skillId,
      skillName,
      questionText: question.questionText,
      studentAnswer,
      correctAnswer: question.correctAnswer,
      answerChoices: question.answerChoices,
    }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data?.diagnosis) {
        const entry = createMistakeEntry({
          skillId: question.skillId,
          skillName,
          questionText: question.questionText,
          studentAnswer,
          correctAnswer: question.correctAnswer,
          answerChoices: question.answerChoices,
          diagnosis: data.diagnosis as MistakeDiagnosis,
        });
        addMistake(entry);
      }
    })
    .catch(() => {
      // Fallback: log with a generic diagnosis if API fails
      const entry = createMistakeEntry({
        skillId: question.skillId,
        skillName,
        questionText: question.questionText,
        studentAnswer,
        correctAnswer: question.correctAnswer,
        answerChoices: question.answerChoices,
        diagnosis: {
          category: "conceptual_gap",
          explanation: "Review this skill for a deeper understanding.",
          relatedSkills: [question.skillId],
        },
      });
      addMistake(entry);
    });
}

async function callApi(action: ChatAction): Promise<ChatApiResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as { error: string }).error);
  }
  return res.json() as Promise<ChatApiResponse>;
}

/**
 * Stream an API call. Returns text progressively via onDelta, and final metadata on completion.
 */
async function callApiStream(
  action: ChatAction,
  onDelta: (text: string) => void
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, stream: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as { error: string }).error);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let meta: Record<string, unknown> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) throw new Error(data.error);
        if (data.delta) onDelta(data.delta);
        if (data.done) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { done: _done, ...rest } = data;
          meta = rest;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Stream error") throw e;
      }
    }
  }

  return meta;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useTutoringSession(skillId: string, isRetentionCheck: boolean = false, isFirstSession: boolean = false) {
  // Fix #1: Load prior mastery from localStorage instead of hardcoding 0.5
  const priorMastery = useMemo(() => {
    if (typeof window === "undefined") return null;
    return loadSkillMastery(skillId);
  }, [skillId]);

  const initialMastery = priorMastery?.masteryLevel ?? 0.5;

  const [state, setState] = useState<SessionState>({
    phase: "initializing",
    messages: [],
    activeQuestion: null,
    currentSkillId: skillId,
    mastery: initialMastery,
    difficultyTier: masteryToTier(initialMastery),
    questionCount: 0,
    correctCount: 0,
    correctStreak: 0,
    skillsCovered: [skillId],
    startTime: Date.now(),
    estimatedQuestions: ESTIMATED_QUESTIONS,
  });

  const [summary, setSummary] = useState<SessionSummaryData | null>(null);
  const [teachBackActive, setTeachBackActive] = useState(false);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const recentAttempts = useRef<AttemptRecord[]>([]);
  const initialized = useRef(false);
  const teachBackTriggeredSkills = useRef(new Set<string>());
  const sessionDbId = useRef<string | null>(null);

  // Fix #2: Track when question was shown for time measurement
  const questionShownAt = useRef<number | null>(null);

  // Fix #6: Track whether hint was used for current question
  const hintUsedForCurrent = useRef(false);

  // Fix #4: Integrate session pacing module
  const pacingState = useRef(createPacingState(new Date()));

  // Deferred question: after teaching, wait for student to respond before showing MC question

  // Track recently shown question texts for deduplication (capped at 20)
  const recentQuestionTexts = useRef<string[]>([]);

  // Use refs for state values accessed in callbacks to avoid stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  const addMessages = useCallback(
    (...msgs: ChatMessageDisplay[]) => {
      setState((s) => ({ ...s, messages: [...s.messages, ...msgs] }));
    },
    []
  );

  /**
   * Add a streaming tutor message that updates progressively.
   * Returns the message ID so the caller can finalize it.
   */
  const addStreamingMessage = useCallback(
    (type: ChatMessageDisplay["type"]): { id: string; appendDelta: (delta: string) => void } => {
      const id = makeId();
      const msg: ChatMessageDisplay = {
        id,
        role: "tutor",
        content: "",
        type,
        timestamp: Date.now(),
      };
      setState((s) => ({ ...s, messages: [...s.messages, msg] }));

      const appendDelta = (delta: string) => {
        setState((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + delta } : m
          ),
        }));
      };

      return { id, appendDelta };
    },
    []
  );

  const setLoading = useCallback((loading: boolean) => {
    setState((s) => ({
      ...s,
      phase: loading ? "loading" : "ready",
    }));
  }, []);

  const getHistory = useCallback((): ConversationMessage[] => {
    return stateRef.current.messages.slice(-10).map((m) => ({
      role: m.role === "tutor" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  }, []);

  // Persist mastery for the current skill.
  // Loads stored data dynamically so it works correctly after mid-session
  // skill switches (where priorMastery would be stale).
  const persistMastery = useCallback(() => {
    const s = stateRef.current;
    const stored = loadSkillMastery(s.currentSkillId);
    const update = calculateMasteryUpdate(recentAttempts.current, s.difficultyTier);
    const skillQCount = recentAttempts.current.length;
    const skillCCount = recentAttempts.current.filter((a) => a.isCorrect).length;
    const sessionAccuracy = skillQCount > 0 ? skillCCount / skillQCount : 0;

    const base = {
      skillId: s.currentSkillId,
      masteryLevel: update.newMasteryLevel,
      attemptsCount: (stored?.attemptsCount ?? 0) + skillQCount,
      correctCount: (stored?.correctCount ?? 0) + skillCCount,
      lastPracticed: new Date().toISOString(),
      confidenceTrend: update.newConfidenceTrend,
      // Carry forward existing SM-2 fields for the schedule computation
      interval: stored?.interval,
      easeFactor: stored?.easeFactor,
      nextReviewDate: stored?.nextReviewDate,
      repetitions: stored?.repetitions,
    };

    const schedule = computeSkillReviewSchedule(base, sessionAccuracy);
    saveSkillMastery({ ...base, ...schedule });
  }, []);

  // End session — defined first so submitAnswer can reference it via ref
  const doEndSession = useCallback(
    async (qCount?: number, cCount?: number) => {
      const s = stateRef.current;
      const questionsAnswered = qCount ?? s.questionCount;
      const correctCount = cCount ?? s.correctCount;
      const elapsedMinutes = Math.round(
        (Date.now() - s.startTime) / 60000
      );
      const accuracy =
        questionsAnswered > 0
          ? Math.round((correctCount / questionsAnswered) * 100)
          : 0;

      setLoading(true);

      // Compute progress diff before persisting (so we still have the "before" state).
      // Load stored mastery dynamically — after a mid-session skill switch,
      // priorMastery (from mount) would be for the original skill, not the current one.
      let progressDiff: SessionSummaryData["progressDiff"];
      if (questionsAnswered > 0) {
        const stored = loadSkillMastery(s.currentSkillId);
        const beforeMastery = stored?.masteryLevel ?? 0.5;
        const afterUpdate = calculateMasteryUpdate(recentAttempts.current, s.difficultyTier);
        const afterMastery = afterUpdate.newMasteryLevel;
        const tBefore = masteryToTier(beforeMastery);
        const tAfter = masteryToTier(afterMastery);
        const skill = getSkillById(s.currentSkillId);
        progressDiff = {
          skillName: skill?.name ?? s.currentSkillId,
          masteryBefore: beforeMastery,
          masteryAfter: afterMastery,
          tierBefore: tBefore,
          tierAfter: tAfter,
          tierLabelAfter: tierLabel(tAfter),
        };
      }

      // Persist mastery before ending
      persistMastery();

      // Auto-complete daily plan task
      autoCompleteDailyTask(s.currentSkillId, isRetentionCheck ? "retention_check" : "skill_practice");

      // Check and award badges
      const ctx = buildBadgeContext({
        sessionQuestions: questionsAnswered,
        sessionCorrect: correctCount,
      });
      checkAndAwardBadges(ctx);

      // Close the DB session with final skills covered
      if (sessionDbId.current) {
        void fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "end",
            sessionId: sessionDbId.current,
            skillsCovered: s.skillsCovered,
          }),
        }).catch((err: unknown) => console.error("[session] end error:", err));
      }

      const nextSkill = pickNextSkill(s.currentSkillId);

      try {
        const res = await callApi({
          type: "get_summary",
          questionsAnswered,
          correctCount,
          skillsCovered: s.skillsCovered as string[],
          elapsedMinutes,
        });

        setSummary({
          questionsAnswered,
          correctCount,
          accuracy,
          skillsCovered: s.skillsCovered,
          elapsedMinutes,
          tutorMessage: res.text,
          nextSkill: nextSkill ?? undefined,
          progressDiff,
        });
      } catch {
        setSummary({
          questionsAnswered,
          correctCount,
          accuracy,
          skillsCovered: s.skillsCovered,
          elapsedMinutes,
          tutorMessage: "Great effort today! Keep practicing!",
          nextSkill: nextSkill ?? undefined,
          progressDiff,
        });
      }

      setState((prev) => ({ ...prev, phase: "complete", activeQuestion: null }));
    },
    [setLoading, persistMastery, isRetentionCheck]
  );

  // Start session: teach concept (streamed), then generate first question
  const startSession = useCallback(async () => {
    const s = stateRef.current;
    try {
      setLoading(true);

      // Create a DB session in the background — don't block the teaching stream
      const domain = getDomainForSkill(skillId) ?? skillId;
      void fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", domain }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json() as { session?: { id: string } };
          sessionDbId.current = data.session?.id ?? null;
        }
      }).catch((err: unknown) => console.error("[session] create error:", err));

      if (isFirstSession) {
        // First session: warm welcome, then jump straight to a question
        const skill = getSkillById(skillId);
        const skillName = skill?.name ?? skillId;
        addMessages(makeTutorMsg(
          `Welcome! Let's try a few questions on **${skillName}** — your strongest area. Ready? Here we go!`,
          "text"
        ));

        const nextQ = await callApi({
          type: "generate_question",
          skillId,
          difficultyTier: s.difficultyTier,
          recentQuestions: recentQuestionTexts.current,
        });

        if (nextQ.question) {
          trackQuestion(recentQuestionTexts, nextQ.question.questionText);
          addMessages(makeTutorMsg(nextQ.question.questionText, "question"));
          questionShownAt.current = Date.now();
          setState((prev) => ({
            ...prev,
            activeQuestion: nextQ.question ?? null,
            phase: "ready",
          }));
        } else {
          setLoading(false);
        }
      } else {
        // Normal session: stream the teaching explanation
        const streaming = addStreamingMessage("teaching");
        await callApiStream(
          { type: "teach", skillId, mastery: s.mastery },
          streaming.appendDelta
        );

        // Generate MC question immediately after teaching — no deferral
        const nextQ = await callApi({
          type: "generate_question",
          skillId,
          difficultyTier: s.difficultyTier,
          recentQuestions: recentQuestionTexts.current,
        });

        if (nextQ.question) {
          trackQuestion(recentQuestionTexts, nextQ.question.questionText);
          addMessages(makeTutorMsg(nextQ.question.questionText, "question"));
          questionShownAt.current = Date.now();
          setState((prev) => ({
            ...prev,
            activeQuestion: nextQ.question ?? null,
            phase: "ready",
          }));
        } else {
          setLoading(false);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      addMessages(makeTutorMsg(`Sorry, I had trouble starting. ${errMsg}`, "text"));
      setLoading(false);
    }
  }, [skillId, isFirstSession, setLoading, addMessages, addStreamingMessage]);

  // Initialize on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void startSession();
    }
  }, [startSession]);

  // Submit answer (MC or free text)
  const submitAnswer = useCallback(
    async (answer: string) => {
      const s = stateRef.current;
      if (!s.activeQuestion || s.phase === "loading") return;

      // Resolve bare letter answers ("C") to the actual choice text.
      // This prevents comparison bugs when correctAnswer is stored as full text
      // (e.g., "Roosevelt High School") rather than letter-prefixed ("C) Roosevelt High School").
      let resolvedAnswer = answer;
      const bare = answer.trim();
      if (/^[A-Ea-e]$/i.test(bare) && s.activeQuestion.answerChoices.length > 0) {
        const idx = bare.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < s.activeQuestion.answerChoices.length) {
          resolvedAnswer = s.activeQuestion.answerChoices[idx];
        }
      }

      addMessages(makeUserMsg(answer));
      setLoading(true);

      try {
        // Record time spent before starting evaluation stream
        const now = Date.now();
        const timeSpent = questionShownAt.current !== null
          ? Math.round((now - questionShownAt.current) / 1000)
          : null;
        questionShownAt.current = null;

        // Stream the evaluation feedback
        const streaming = addStreamingMessage("feedback");
        const evalMeta = await callApiStream(
          {
            type: "evaluate_answer",
            questionText: s.activeQuestion.questionText,
            studentAnswer: resolvedAnswer,
            correctAnswer: s.activeQuestion.correctAnswer,
            history: getHistory(),
            sessionId: sessionDbId.current ?? undefined,
            skillId: s.currentSkillId,
            timeSpentSeconds: timeSpent ?? undefined,
            hintUsed: hintUsedForCurrent.current,
          },
          streaming.appendDelta
        );

        const isCorrect = (evalMeta.isCorrect as boolean) ?? false;

        // Fix #6: Record hint usage
        const attempt: AttemptRecord = {
          isCorrect,
          timeSpentSeconds: timeSpent,
          hintUsed: hintUsedForCurrent.current,
        };
        recentAttempts.current.push(attempt);
        hintUsedForCurrent.current = false;

        // Log wrong answers to mistake journal (non-blocking)
        if (!isCorrect && s.activeQuestion) {
          logMistakeInBackground(s.activeQuestion, resolvedAnswer);
        }

        const newQuestionCount = s.questionCount + 1;
        const newCorrectCount = s.correctCount + (isCorrect ? 1 : 0);
        const newStreak = isCorrect ? s.correctStreak + 1 : 0;

        const decision = adjustDifficulty(s.mastery, recentAttempts.current);

        // Fix #1: Update mastery in real-time using the formula
        const masteryUpdate = calculateMasteryUpdate(
          recentAttempts.current,
          decision.tier
        );

        // Level-up detection: compare old tier vs new tier
        const oldTier = masteryToTier(s.mastery);
        const newTier = masteryToTier(masteryUpdate.newMasteryLevel);
        if (newTier > oldTier) {
          const skill = getSkillById(s.currentSkillId);
          setLevelUpEvent({
            skillName: skill?.name ?? s.currentSkillId,
            newTier,
            newTierLabel: tierLabel(newTier),
          });
        }

        setState((prev) => ({
          ...prev,
          activeQuestion: null,
          questionCount: newQuestionCount,
          correctCount: newCorrectCount,
          correctStreak: newStreak,
          difficultyTier: decision.tier,
          mastery: masteryUpdate.newMasteryLevel,
          phase: "ready",
        }));

        // Fix #4: Use pacing module instead of hardcoded check
        pacingState.current = advancePacingAfterQuestion(
          pacingState.current,
          timeSpent ?? undefined
        );
        const pacingAction = getNextPacingAction(pacingState.current, new Date());

        if (pacingAction.action === "end_session") {
          addMessages(makeTutorMsg(pacingAction.reason, "text"));
          await doEndSession(newQuestionCount, newCorrectCount);
          return;
        }

        // First session: end after 3 questions
        if (isFirstSession && pacingState.current.totalQuestions >= 3) {
          await doEndSession(newQuestionCount, newCorrectCount);
          return;
        }

        // Fix #5: Handle rushing detection
        if (pacingAction.action === "slow_down") {
          addMessages(makeTutorMsg(pacingAction.reason, "text"));
          // Reset the streak so we don't nag every question
          pacingState.current = {
            ...pacingState.current,
            recentAnswerTimesSeconds: [],
          };
        }

        // ─── Mid-session skill switch ──────────────────────────────────
        // When the student has demonstrated strong mastery on the current
        // skill (high streak + high mastery), switch to a new skill in the
        // same domain rather than repeating the same topic.
        // Checked BEFORE teach-back so mastery triggers a topic change
        // instead of a teach-back exercise on an already-proven skill.
        if (
          isCorrect &&
          newStreak >= SKILL_SWITCH_STREAK &&
          masteryUpdate.newMasteryLevel >= SKILL_SWITCH_MASTERY &&
          decision.mode !== "teach"
        ) {
          const nextSkill = pickNextSkillInDomain(s.currentSkillId, s.skillsCovered);
          if (nextSkill) {
            // Persist mastery for the current skill before switching
            persistMastery();

            // Reset attempts for the new skill
            recentAttempts.current = [];
            recentQuestionTexts.current = [];

            // Load mastery for the new skill
            const stored = loadSkillMastery(nextSkill.skillId);
            const newMastery = stored?.masteryLevel ?? 0.5;
            const newTierForSkill = masteryToTier(newMastery);

            // Update state to the new skill
            setState((prev) => ({
              ...prev,
              currentSkillId: nextSkill.skillId,
              mastery: newMastery,
              difficultyTier: newTierForSkill,
              correctStreak: 0,
              skillsCovered: prev.skillsCovered.includes(nextSkill.skillId)
                ? prev.skillsCovered
                : [...prev.skillsCovered, nextSkill.skillId],
            }));

            // Transition message + teach the new concept
            addMessages(
              makeTutorMsg(
                `Great work on that topic! You're doing really well. Let's try something new — **${nextSkill.skillName}**.`,
                "text"
              )
            );

            const teachStreaming = addStreamingMessage("teaching");
            await callApiStream(
              {
                type: "teach",
                skillId: nextSkill.skillId,
                mastery: newMastery,
              },
              teachStreaming.appendDelta
            );
            pacingState.current = advancePacingAfterTeaching(pacingState.current);

            // Generate MC question immediately after teaching new skill
            const switchQ = await callApi({
              type: "generate_question",
              skillId: nextSkill.skillId,
              difficultyTier: newTierForSkill,
              recentQuestions: recentQuestionTexts.current,
            });

            if (switchQ.question) {
              trackQuestion(recentQuestionTexts, switchQ.question.questionText);
              addMessages(makeTutorMsg(switchQ.question.questionText, "question"));
              questionShownAt.current = Date.now();
              setState((prev) => ({
                ...prev,
                activeQuestion: switchQ.question ?? null,
                phase: "ready",
              }));
            } else {
              setLoading(false);
            }
            return;
          }
        }

        // Check if teach-it-back should trigger (Feynman technique)
        if (
          isCorrect &&
          shouldTriggerTeachBack(
            newQuestionCount,
            newCorrectCount,
            s.currentSkillId,
            teachBackTriggeredSkills.current
          )
        ) {
          teachBackTriggeredSkills.current.add(s.currentSkillId);
          setTeachBackActive(true);
          setLoading(false);
          return;
        }

        // If in teach mode or pacing says insert teaching, teach first (streamed)
        if (
          decision.mode === "teach" ||
          pacingAction.action === "insert_teaching"
        ) {
          const teachStreaming = addStreamingMessage("teaching");
          await callApiStream(
            {
              type: "teach",
              skillId: s.currentSkillId,
              mastery: masteryUpdate.newMasteryLevel,
            },
            teachStreaming.appendDelta
          );
          pacingState.current = advancePacingAfterTeaching(pacingState.current);

          // Generate MC question immediately after teaching — no deferral
          // (falls through to the generate_question block below)
        }

        // Generate next MC question (immediately after teaching, or directly)
        const nextQ = await callApi({
          type: "generate_question",
          skillId: s.currentSkillId,
          difficultyTier: decision.tier,
          recentQuestions: recentQuestionTexts.current,
        });

        if (nextQ.question) {
          trackQuestion(recentQuestionTexts, nextQ.question.questionText);
          addMessages(makeTutorMsg(nextQ.question.questionText, "question"));
          questionShownAt.current = Date.now();
          setState((prev) => ({
            ...prev,
            activeQuestion: nextQ.question ?? null,
            phase: "ready",
          }));
        } else {
          setLoading(false);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Something went wrong";
        addMessages(makeTutorMsg(`Hmm, I had some trouble there. ${errMsg}`, "text"));
        setLoading(false);
      }
    },
    [addMessages, addStreamingMessage, setLoading, getHistory, doEndSession, isFirstSession, persistMastery]
  );

  // Request hint (streamed) — Fix #6: Mark hint as used for current question
  const requestHint = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase === "loading") return;
    setLoading(true);
    hintUsedForCurrent.current = true;

    try {
      const context = s.activeQuestion
        ? `Student is stuck on: "${s.activeQuestion.questionText}". The correct answer is "${s.activeQuestion.correctAnswer}". Give a nudge without revealing the answer.`
        : "Student needs help with the current topic.";

      const streaming = addStreamingMessage("hint");
      await callApiStream(
        { type: "get_hint", context, history: getHistory() },
        streaming.appendDelta
      );
    } catch {
      addMessages(makeTutorMsg("Let me think... Try breaking the problem into smaller parts!", "hint"));
    }
    setLoading(false);
  }, [addMessages, addStreamingMessage, setLoading, getHistory]);

  // Explain more (streamed)
  const requestExplanation = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase === "loading") return;
    setLoading(true);

    try {
      const lastTutorMsg = [...s.messages]
        .reverse()
        .find((m) => m.role === "tutor");
      const streaming = addStreamingMessage("teaching");
      await callApiStream(
        {
          type: "explain_more",
          skillId: s.currentSkillId,
          mastery: s.mastery,
          context: lastTutorMsg?.content ?? "",
        },
        streaming.appendDelta
      );
    } catch {
      addMessages(makeTutorMsg("Let me explain that differently...", "teaching"));
    }
    setLoading(false);
  }, [addMessages, addStreamingMessage, setLoading]);

  // Continue session after teach-it-back (generate next question)
  const continueAfterTeachBack = useCallback(async () => {
    setTeachBackActive(false);
    const s = stateRef.current;
    setLoading(true);

    try {
      const nextQ = await callApi({
        type: "generate_question",
        skillId: s.currentSkillId,
        difficultyTier: s.difficultyTier,
        recentQuestions: recentQuestionTexts.current,
      });

      if (nextQ.question) {
        trackQuestion(recentQuestionTexts, nextQ.question.questionText);
        addMessages(makeTutorMsg(nextQ.question.questionText, "question"));
        questionShownAt.current = Date.now();
        setState((prev) => ({
          ...prev,
          activeQuestion: nextQ.question ?? null,
          phase: "ready",
        }));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [addMessages, setLoading]);

  // Handle teach-it-back completion
  const handleTeachBackComplete = useCallback(
    (explanation: string, evaluation: TeachingMomentEvaluation) => {
      const s = stateRef.current;
      const skill = getSkillById(s.currentSkillId);

      // Store teaching moment as evidence of mastery
      const moment = createTeachingMoment({
        skillId: s.currentSkillId,
        skillName: skill?.name ?? s.currentSkillId,
        studentExplanation: explanation,
        evaluation,
      });
      saveTeachingMoment(moment);

      // Add messages to chat
      addMessages(
        makeUserMsg(explanation),
        makeTutorMsg(evaluation.feedback, "teach_back_eval")
      );

      void continueAfterTeachBack();
    },
    [addMessages, continueAfterTeachBack]
  );

  // Handle teach-it-back skip
  const handleTeachBackSkip = useCallback(() => {
    setTeachBackActive(false);
    void continueAfterTeachBack();
  }, [continueAfterTeachBack]);

  const sendMessage = useCallback(
    async (text: string) => {
      // Bug 1 fix: check frustration BEFORE routing to submitAnswer —
      // a student typing "I give up" while a question is active must get
      // an emotional response, not have their words graded as an answer.
      if (detectFrustration(text)) {
        addMessages(makeUserMsg(text));
        setLoading(true);
        try {
          const streaming = addStreamingMessage("text");
          await callApiStream(
            { type: "emotional_response", message: text, history: getHistory() },
            streaming.appendDelta
          );
        } catch {
          addMessages(
            makeTutorMsg(
              "I hear you. It's okay to feel that way — this stuff is hard! Want to take a breather or try something different?",
              "text"
            )
          );
        }
        setLoading(false);
        return;
      }

      if (stateRef.current.activeQuestion) {
        void submitAnswer(text);
        return;
      }

      addMessages(makeUserMsg(text));

      // No active question — student is asking a free-form question.
      // Give a helpful response without Socratic probing.
      setLoading(true);
      try {
        const s = stateRef.current;
        const streaming = addStreamingMessage("text");
        await callApiStream(
          {
            type: "explain_more",
            skillId: s.currentSkillId,
            mastery: s.mastery,
            context: text,
          },
          streaming.appendDelta
        );
      } catch {
        addMessages(makeTutorMsg("Great question! Let me know if you'd like more help.", "text"));
      }

      setLoading(false);
    },
    [submitAnswer, addMessages, addStreamingMessage, setLoading, getHistory]
  );

  // Restart with same skill — Fix #1: Load from store
  const restart = useCallback(() => {
    recentAttempts.current = [];
    recentQuestionTexts.current = [];
    teachBackTriggeredSkills.current.clear();
    hintUsedForCurrent.current = false;
    questionShownAt.current = null;
    sessionDbId.current = null;
    pacingState.current = createPacingState(new Date());
    setSummary(null);
    setTeachBackActive(false);
    setLevelUpEvent(null);

    const stored = loadSkillMastery(skillId);
    const mastery = stored?.masteryLevel ?? 0.5;

    setState({
      phase: "initializing",
      messages: [],
      activeQuestion: null,
      currentSkillId: skillId,
      mastery,
      difficultyTier: masteryToTier(mastery),
      questionCount: 0,
      correctCount: 0,
      correctStreak: 0,
      skillsCovered: [skillId],
      startTime: Date.now(),
      estimatedQuestions: ESTIMATED_QUESTIONS,
    });
    initialized.current = false;
  }, [skillId]);

  // Re-trigger init after restart
  useEffect(() => {
    if (state.phase === "initializing" && !initialized.current) {
      initialized.current = true;
      void startSession();
    }
  }, [state.phase, startSession]);

  const clearLevelUp = useCallback(() => setLevelUpEvent(null), []);

  return {
    state,
    summary,
    teachBackActive,
    levelUpEvent,
    clearLevelUp,
    submitAnswer,
    sendMessage,
    requestHint,
    requestExplanation,
    endSession: () => void doEndSession(),
    restart,
    handleTeachBackComplete,
    handleTeachBackSkip,
  };
}
