"""Mistakes diagnosis API routes — port of src/app/api/mistakes/route.ts."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_session_payload
from app.lib.ai.client import get_anthropic_client
from app.lib.ai.tutor_agent import TutorAgent, MODEL_HAIKU, MODEL_SONNET

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mistakes", tags=["mistakes"])

_agent = TutorAgent()


@router.post("")
async def mistakes_action(body: dict, request: Request, db: Session = Depends(get_db)):
    action_type = body.get("type")

    if action_type == "diagnose":
        return await _handle_diagnose(body)
    elif action_type == "analyze_patterns":
        return await _handle_analyze_patterns(body)
    else:
        raise HTTPException(400, f"Unknown mistakes action: {action_type}")


async def _handle_diagnose(body: dict) -> dict:
    skill_id = body.get("skill_id") or body.get("skillId") or ""
    question_text = body.get("question_text") or body.get("questionText") or ""
    student_answer = body.get("student_answer") or body.get("studentAnswer") or ""
    correct_answer = body.get("correct_answer") or body.get("correctAnswer") or ""

    if not question_text or not student_answer or not correct_answer:
        raise HTTPException(400, "question_text, student_answer, and correct_answer are required")

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_HAIKU,
        max_tokens=256,
        system=[{
            "type": "text",
            "text": "You are an expert at diagnosing student mistakes. Categorize errors concisely.",
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{
            "role": "user",
            "content": f"""Categorize this student mistake:

Question: {question_text}
Student answered: {student_answer}
Correct answer: {correct_answer}

Respond with ONLY one of these category codes:
- conceptual_gap: Student doesn't understand the underlying concept
- careless_error: Student knows the concept but made a calculation or reading mistake
- misread_question: Student misunderstood what was being asked

CATEGORY: [code]
EXPLANATION: [one sentence explaining why]""",
        }],
    )

    text = response.content[0].text if response.content and response.content[0].type == "text" else ""

    import re
    category_m = re.search(r"CATEGORY:\s*(conceptual_gap|careless_error|misread_question)", text, re.IGNORECASE)
    explanation_m = re.search(r"EXPLANATION:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)

    category = category_m.group(1).lower() if category_m else "conceptual_gap"
    explanation = explanation_m.group(1).strip() if explanation_m else "Could not determine error type"

    return {
        "category": category,
        "explanation": explanation,
        "skill_id": skill_id,
    }


async def _handle_analyze_patterns(body: dict) -> dict:
    mistakes = body.get("mistakes") or []
    if not mistakes:
        return {"patterns": [], "recommendations": []}

    # Summarize mistake categories
    from collections import Counter
    categories = Counter(m.get("category", "unknown") for m in mistakes)
    skill_counts = Counter(m.get("skill_id", "unknown") for m in mistakes)
    top_skills = [skill for skill, _ in skill_counts.most_common(3)]

    client = get_anthropic_client()
    summary = json.dumps({
        "total_mistakes": len(mistakes),
        "categories": dict(categories),
        "top_weak_skills": top_skills,
    })

    response = client.messages.create(
        model=MODEL_HAIKU,
        max_tokens=512,
        system=[{
            "type": "text",
            "text": "You are a learning coach analyzing student mistake patterns. Be encouraging and specific.",
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{
            "role": "user",
            "content": f"""Analyze these student mistake patterns and give recommendations:

{summary}

Provide:
1. The main pattern you see (1 sentence)
2. 2-3 specific, actionable recommendations

Keep it encouraging and practical.""",
        }],
    )

    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    return {
        "patterns": dict(categories),
        "top_weak_skills": top_skills,
        "recommendations": text,
    }
