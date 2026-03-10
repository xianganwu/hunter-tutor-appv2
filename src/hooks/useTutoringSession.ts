"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type {
  ChatAction,
  ChatApiResponse,
  ChatMessageDisplay,
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
import { loadSkillMastery, saveSkillMastery } from "@/lib/skill-mastery-store";

const ESTIMATED_QUESTIONS = 12;

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

// ─── Helpers ──────────────────────────────────────────────────────────

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

export function useTutoringSession(skillId: string) {
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
    skillsCovered: [skillId],
    startTime: Date.now(),
    estimatedQuestions: ESTIMATED_QUESTIONS,
  });

  const [summary, setSummary] = useState<SessionSummaryData | null>(null);
  const [teachBackActive, setTeachBackActive] = useState(false);
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

  // Persist mastery at session end
  const persistMastery = useCallback(() => {
    const s = stateRef.current;
    const update = calculateMasteryUpdate(recentAttempts.current, s.difficultyTier);
    saveSkillMastery({
      skillId: s.currentSkillId,
      masteryLevel: update.newMasteryLevel,
      attemptsCount: (priorMastery?.attemptsCount ?? 0) + s.questionCount,
      correctCount: (priorMastery?.correctCount ?? 0) + s.correctCount,
      lastPracticed: new Date().toISOString(),
      confidenceTrend: update.newConfidenceTrend,
    });
  }, [priorMastery]);

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

      // Persist mastery before ending
      persistMastery();

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
        });
      } catch {
        setSummary({
          questionsAnswered,
          correctCount,
          accuracy,
          skillsCovered: s.skillsCovered,
          elapsedMinutes,
          tutorMessage: "Great effort today! Keep practicing!",
        });
      }

      setState((prev) => ({ ...prev, phase: "complete", activeQuestion: null }));
    },
    [setLoading, persistMastery]
  );

  // Start session: teach concept (streamed), then generate first question
  const startSession = useCallback(async () => {
    const s = stateRef.current;
    try {
      setLoading(true);

      // Create a DB session so question attempts can be persisted
      const domain = getDomainForSkill(skillId) ?? skillId;
      const sessionRes = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", domain }),
      });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json() as { session?: { id: string } };
        sessionDbId.current = sessionData.session?.id ?? null;
      }

      // Stream the teaching explanation
      const streaming = addStreamingMessage("teaching");
      await callApiStream(
        { type: "teach", skillId, mastery: s.mastery },
        streaming.appendDelta
      );

      // Generate first question (non-streamed — needs structured data)
      const qRes = await callApi({
        type: "generate_question",
        skillId,
        difficultyTier: s.difficultyTier,
      });

      if (qRes.question) {
        addMessages(makeTutorMsg(qRes.question.questionText, "question"));
        questionShownAt.current = Date.now();
        setState((prev) => ({
          ...prev,
          activeQuestion: qRes.question ?? null,
          phase: "ready",
        }));
      } else {
        setLoading(false);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      addMessages(makeTutorMsg(`Sorry, I had trouble starting. ${errMsg}`, "text"));
      setLoading(false);
    }
  }, [skillId, setLoading, addMessages, addStreamingMessage]);

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
            studentAnswer: answer,
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
          logMistakeInBackground(s.activeQuestion, answer);
        }

        const newQuestionCount = s.questionCount + 1;
        const newCorrectCount = s.correctCount + (isCorrect ? 1 : 0);

        const decision = adjustDifficulty(s.mastery, recentAttempts.current);

        // Fix #1: Update mastery in real-time using the formula
        const masteryUpdate = calculateMasteryUpdate(
          recentAttempts.current,
          decision.tier
        );

        setState((prev) => ({
          ...prev,
          activeQuestion: null,
          questionCount: newQuestionCount,
          correctCount: newCorrectCount,
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

        // Fix #5: Handle rushing detection
        if (pacingAction.action === "slow_down") {
          addMessages(makeTutorMsg(pacingAction.reason, "text"));
          // Reset the streak so we don't nag every question
          pacingState.current = {
            ...pacingState.current,
            recentAnswerTimesSeconds: [],
          };
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
        }

        // Generate next question
        const nextQ = await callApi({
          type: "generate_question",
          skillId: s.currentSkillId,
          difficultyTier: decision.tier,
        });

        if (nextQ.question) {
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
    [addMessages, addStreamingMessage, setLoading, getHistory, doEndSession]
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
      });

      if (nextQ.question) {
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

      // Bug 2 fix: no active question and not frustrated — respond with a
      // Socratic follow-up instead of going silent.
      setLoading(true);
      try {
        const streaming = addStreamingMessage("text");
        await callApiStream(
          { type: "get_hint", context: text, history: getHistory() },
          streaming.appendDelta
        );
      } catch {
        addMessages(makeTutorMsg("That's a great thought! Let's keep exploring.", "text"));
      }
      setLoading(false);
    },
    [submitAnswer, addMessages, addStreamingMessage, setLoading, getHistory]
  );

  // Restart with same skill — Fix #1: Load from store
  const restart = useCallback(() => {
    recentAttempts.current = [];
    teachBackTriggeredSkills.current.clear();
    hintUsedForCurrent.current = false;
    questionShownAt.current = null;
    sessionDbId.current = null;
    pacingState.current = createPacingState(new Date());
    setSummary(null);
    setTeachBackActive(false);

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

  return {
    state,
    summary,
    teachBackActive,
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
