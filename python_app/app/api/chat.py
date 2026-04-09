"""
Chat / tutoring API routes — port of src/app/api/chat/route.ts.
Supports both streaming (SSE) and non-streaming responses.
"""
from __future__ import annotations
import json
import logging
import re
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.lib.ai.client import get_anthropic_client
from app.lib.ai.tutor_agent import TutorAgent, ConversationMessage, MODEL_SONNET, MODEL_HAIKU
from app.lib.ai.validate_question import validate_generated_question
from app.lib.curriculum import get_skill_by_id
from app import models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

# Singleton agent — system prompt built once
_agent = TutorAgent()


def _sanitize_input(text: str, max_len: int = 10000) -> str:
    """Basic input sanitization."""
    if not text:
        return ""
    text = text[:max_len]
    text = re.sub(r"<[^>]+>", "", text)  # strip HTML/XML tags
    return text


# ─── SSE Streaming helper ─────────────────────────────────────────────

async def _sse_stream(
    model: str,
    max_tokens: int,
    system: list[dict],
    messages: list[dict],
    meta: dict | None = None,
) -> AsyncGenerator[str, None]:
    """Yield SSE events from an Anthropic streaming call."""
    client = get_anthropic_client()
    try:
        with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'delta': text})}\n\n"
        done_payload = {"done": True}
        if meta:
            done_payload.update(meta)
        yield f"data: {json.dumps(done_payload)}\n\n"
    except Exception as e:
        logger.error("[chat] SSE stream error: %s", e)
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


def _streaming_response(
    model: str,
    max_tokens: int,
    system: list[dict],
    messages: list[dict],
    meta: dict | None = None,
) -> StreamingResponse:
    return StreamingResponse(
        _sse_stream(model, max_tokens, system, messages, meta),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ─── POST /api/chat ───────────────────────────────────────────────────

@router.post("")
async def chat(body: dict, request: Request, db: Session = Depends(get_db)):
    action_type = body.get("type")
    want_stream = body.get("stream", False)

    try:
        if action_type == "teach":
            return await _handle_teach(body, want_stream)

        elif action_type == "generate_question":
            return await _handle_generate_question(body, want_stream)

        elif action_type == "evaluate_answer":
            return await _handle_evaluate_answer(body, want_stream, db)

        elif action_type == "get_hint":
            return await _handle_get_hint(body, want_stream)

        elif action_type == "explain_more":
            return await _handle_explain_more(body, want_stream)

        elif action_type == "evaluate_teach_back":
            return await _handle_evaluate_teach_back(body, want_stream)

        elif action_type == "emotional_response":
            return await _handle_emotional_response(body, want_stream)

        elif action_type == "generate_drill_batch":
            return await _handle_generate_drill_batch(body)

        elif action_type == "generate_mixed_drill_batch":
            return await _handle_generate_mixed_drill_batch(body)

        elif action_type == "generate_diagnostic":
            return await _handle_generate_diagnostic(body)

        elif action_type == "get_summary":
            return await _handle_get_summary(body)

        else:
            raise HTTPException(400, f"Unknown action type: {action_type}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[chat] Error in action %s: %s", action_type, e)
        raise HTTPException(500, str(e))


# ─── Handlers ────────────────────────────────────────────────────────

async def _handle_teach(body: dict, want_stream: bool):
    skill_id = body.get("skill_id") or body.get("skillId") or ""
    mastery = float(body.get("mastery", 0.5))
    skill = get_skill_by_id(skill_id)
    if not skill:
        raise HTTPException(400, f"Unknown skill: {skill_id}")

    messages = _agent.build_teach_messages(skill, mastery)
    if want_stream:
        return _streaming_response(MODEL_SONNET, 4096, _agent.get_cached_system_block(), messages)

    result = await _agent.teach_concept(skill, mastery)
    return {"text": result.explanation}


async def _handle_generate_question(body: dict, want_stream: bool):
    skill_id = body.get("skill_id") or body.get("skillId") or ""
    difficulty_tier = int(body.get("difficulty_tier") or body.get("difficultyTier") or 3)
    recent_questions = body.get("recent_questions") or body.get("recentQuestions") or []
    skill = get_skill_by_id(skill_id)
    if not skill:
        raise HTTPException(400, f"Unknown skill: {skill_id}")

    question = await _agent.generate_question(skill, difficulty_tier, recent_questions)
    if not question:
        raise HTTPException(500, "Failed to generate a valid question. Please try again.")

    return {
        "text": question.question_text,
        "question": {
            "question_text": question.question_text,
            "answer_choices": list(question.answer_choices),
            "correct_answer": question.correct_answer,
            "skill_id": question.skill_id,
            "difficulty_tier": question.difficulty_tier,
        },
    }


async def _handle_evaluate_answer(body: dict, want_stream: bool, db: Session):
    question_text = body.get("question_text") or body.get("questionText") or ""
    student_answer = body.get("student_answer") or body.get("studentAnswer") or ""
    correct_answer = body.get("correct_answer") or body.get("correctAnswer") or ""
    history_raw = body.get("history") or []
    history = [ConversationMessage(role=m["role"], content=m["content"]) for m in history_raw]
    mode = body.get("evaluation_mode") or body.get("evaluationMode") or "chat"
    session_id = body.get("session_id") or body.get("sessionId")
    skill_id = body.get("skill_id") or body.get("skillId")
    time_spent = body.get("time_spent_seconds") or body.get("timeSpentSeconds")
    hint_used = bool(body.get("hint_used") or body.get("hintUsed"))

    messages, is_correct = _agent.build_evaluate_messages(
        question_text, student_answer, correct_answer, history, mode
    )

    # Persist attempt (fire-and-forget)
    if session_id and skill_id:
        try:
            attempt = models.QuestionAttempt(
                session_id=session_id,
                skill_id=skill_id,
                question_text=question_text,
                student_answer=student_answer,
                correct_answer=correct_answer,
                is_correct=is_correct,
                time_spent_seconds=int(time_spent) if time_spent else None,
                hint_used=hint_used,
            )
            db.add(attempt)
            db.commit()
        except Exception as e:
            logger.warning("[chat] Failed to persist question attempt: %s", e)

    if want_stream:
        return _streaming_response(
            MODEL_SONNET, 768, _agent.get_cached_system_block(), messages, {"isCorrect": is_correct}
        )

    feedback = await _agent.evaluate_answer(question_text, student_answer, correct_answer, history, mode)
    return {"text": feedback.feedback, "is_correct": feedback.is_correct}


async def _handle_get_hint(body: dict, want_stream: bool):
    context = body.get("context") or ""
    history_raw = body.get("history") or []
    history = [ConversationMessage(role=m["role"], content=m["content"]) for m in history_raw]

    messages = _agent.build_hint_messages(context, history)
    if want_stream:
        return _streaming_response(MODEL_HAIKU, 256, _agent.get_cached_system_block(), messages)

    result = await _agent.socratic_follow_up(context, history)
    return {"text": result.question}


async def _handle_explain_more(body: dict, want_stream: bool):
    skill_id = body.get("skill_id") or body.get("skillId") or ""
    mastery = float(body.get("mastery", 0.5))
    skill = get_skill_by_id(skill_id)
    if not skill:
        raise HTTPException(400, f"Unknown skill: {skill_id}")

    messages = _agent.build_teach_messages(skill, mastery)
    if want_stream:
        return _streaming_response(MODEL_SONNET, 4096, _agent.get_cached_system_block(), messages)

    result = await _agent.teach_concept(skill, mastery)
    return {"text": result.explanation}


async def _handle_evaluate_teach_back(body: dict, want_stream: bool):
    skill_id = body.get("skill_id") or body.get("skillId") or ""
    skill_name = body.get("skill_name") or body.get("skillName") or ""
    student_explanation = _sanitize_input(
        body.get("student_explanation") or body.get("studentExplanation") or "", 5000
    )
    skill = get_skill_by_id(skill_id)
    if not skill:
        raise HTTPException(400, f"Unknown skill: {skill_id}")

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_HAIKU,
        max_tokens=512,
        system=[{
            "type": "text",
            "text": (
                "You are a warm tutor evaluating a student's explanation of a concept. "
                "The student may be a rising 5th grader (age 9-10) or a 6th grader (age 11-12). "
                "They are trying to 'teach it back' — explaining the concept as if teaching a friend. "
                "Evaluate their explanation for completeness and accuracy, then respond in a structured format."
            ),
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{
            "role": "user",
            "content": f"""The student was asked to explain this concept in their own words:

Skill: "{skill_name}" ({skill_id})
Description: {skill.get('description', '')}

Student's explanation (evaluate ONLY what the student wrote below):
<student_text>
{student_explanation}
</student_text>

Evaluate their explanation. Respond in this EXACT format:

COMPLETENESS: [complete|partial|missing_key_concepts]
ACCURACY: [accurate|minor_errors|misconception]
MISSING: [comma-separated list of missing concepts, or "none"]
FEEDBACK: [2-3 sentences — start with specific praise for what they got right, then gently note any gaps. Be warm and encouraging.]""",
        }],
    )

    text = response.content[0].text if response.content and response.content[0].type == "text" else ""

    completeness_m = re.search(r"COMPLETENESS:\s*(complete|partial|missing_key_concepts)", text, re.IGNORECASE)
    accuracy_m = re.search(r"ACCURACY:\s*(accurate|minor_errors|misconception)", text, re.IGNORECASE)
    missing_m = re.search(r"MISSING:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    feedback_m = re.search(r"FEEDBACK:\s*([\s\S]+?)$", text, re.IGNORECASE)

    completeness = (completeness_m.group(1).lower() if completeness_m else "partial")
    accuracy = (accuracy_m.group(1).lower() if accuracy_m else "accurate")
    missing_raw = missing_m.group(1).strip() if missing_m else "none"
    missing_concepts = (
        [] if missing_raw.lower() == "none"
        else [s.strip() for s in missing_raw.split(",") if s.strip()]
    )
    feedback = feedback_m.group(1).strip() if feedback_m else text

    return {
        "text": feedback,
        "teach_back_evaluation": {
            "completeness": completeness,
            "accuracy": accuracy,
            "feedback": feedback,
            "missing_concepts": missing_concepts,
        },
    }


async def _handle_emotional_response(body: dict, want_stream: bool):
    message = body.get("message") or ""
    history_raw = body.get("history") or []
    history = [ConversationMessage(role=m["role"], content=m["content"]) for m in history_raw]

    messages = _agent.build_emotional_messages(message, history)
    if want_stream:
        return _streaming_response(MODEL_HAIKU, 768, _agent.get_cached_system_block(), messages)

    text = await _agent.respond_to_emotional_cue(message, history)
    return {"text": text}


async def _handle_generate_drill_batch(body: dict):
    skill_id = body.get("skill_id") or body.get("skillId") or ""
    count = int(body.get("count", 10))
    difficulty_tier = body.get("difficulty_tier") or body.get("difficultyTier")
    if difficulty_tier:
        difficulty_tier = int(difficulty_tier)
    recent_questions = body.get("recent_questions") or body.get("recentQuestions") or []
    skill = get_skill_by_id(skill_id)
    if not skill:
        raise HTTPException(400, f"Unknown skill: {skill_id}")

    questions = await _agent.generate_drill_batch(skill, count, difficulty_tier, recent_questions)
    return {
        "questions": [
            {
                "question_text": q.question_text,
                "answer_choices": list(q.answer_choices),
                "correct_answer": q.correct_answer,
                "skill_id": q.skill_id,
                "difficulty_tier": q.difficulty_tier,
            }
            for q in questions
        ]
    }


async def _handle_generate_mixed_drill_batch(body: dict):
    skills_raw = body.get("skills") or []
    total_count = int(body.get("total_count") or body.get("totalCount") or 10)
    recent_questions = body.get("recent_questions") or body.get("recentQuestions") or []

    skill_pairs = []
    for s in skills_raw:
        skill_id = s.get("skill_id") or s.get("skillId") or ""
        tier = int(s.get("tier", 3))
        skill = get_skill_by_id(skill_id)
        if skill:
            skill_pairs.append((skill, tier))

    if not skill_pairs:
        return {"questions": []}

    questions = await _agent.generate_mixed_drill_batch(skill_pairs, total_count, recent_questions)
    return {
        "questions": [
            {
                "question_text": q.question_text,
                "answer_choices": list(q.answer_choices),
                "correct_answer": q.correct_answer,
                "skill_id": q.skill_id,
                "difficulty_tier": q.difficulty_tier,
            }
            for q in questions
        ]
    }


async def _handle_generate_diagnostic(body: dict):
    skill_ids = body.get("skill_ids") or body.get("skillIds") or []
    skill_ids = skill_ids[:20]  # cap at 20

    skill_entries = []
    for sid in skill_ids:
        skill = get_skill_by_id(sid)
        if skill:
            skill_entries.append(skill)

    if not skill_entries:
        return {"questions": []}

    target = (
        "6th grader (age 11-12)"
        if skill_entries[0].get("level") == "hunter_prep"
        else "rising 5th grader (age 9-10)"
    )
    skill_list = "\n".join(
        f'{i+1}. skill_id: "{s["skill_id"]}" — {s["name"]}: {s["description"]}'
        for i, s in enumerate(skill_entries)
    )

    client = get_anthropic_client()
    max_tokens = min(8192, max(2048, len(skill_entries) * 400))
    response = client.messages.create(
        model=MODEL_SONNET,
        max_tokens=max_tokens,
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""Generate exactly {len(skill_entries)} diagnostic placement questions, one per skill listed below.
Target student: {target}
Difficulty: Medium (tier 3/5)

Skills:
{skill_list}

Each question should have 5 multiple choice answers (A through E).
Vary which letter is the correct answer across questions.

Respond with ONLY a JSON array, no other text:
[
  {{
    "skillId": "the_skill_id",
    "questionText": "...",
    "answerChoices": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
    "correctAnswer": "C) ..."
  }}
]""",
        }],
    )

    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    questions = []
    try:
        json_match = re.search(r"\[[\s\S]*\]", text)
        if not json_match:
            logger.error("[chat] generate_diagnostic: no JSON array found")
            return {"questions": []}
        parsed = json.loads(json_match.group(0))
        for q in parsed:
            validated = validate_generated_question(
                q.get("questionText", ""),
                q.get("answerChoices", []),
                q.get("correctAnswer", ""),
                "chat/generate_diagnostic",
            )
            if validated is not None:
                questions.append({
                    "skill_id": q.get("skillId", ""),
                    "question_text": q["questionText"],
                    "answer_choices": q["answerChoices"],
                    "correct_answer": validated,
                })
    except (json.JSONDecodeError, KeyError) as e:
        logger.error("[chat] generate_diagnostic parse error: %s", e)

    return {"questions": questions}


async def _handle_get_summary(body: dict):
    questions_answered = int(body.get("questions_answered") or body.get("questionsAnswered") or 0)
    correct_count = int(body.get("correct_count") or body.get("correctCount") or 0)
    skills_covered = body.get("skills_covered") or body.get("skillsCovered") or []
    elapsed_minutes = float(body.get("elapsed_minutes") or body.get("elapsedMinutes") or 0)

    text = await _agent.generate_summary(questions_answered, correct_count, skills_covered, elapsed_minutes)
    return {"text": text}
