"""Parent portal API routes — port of src/app/api/parent/route.ts."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_session_payload
from app.auth import verify_password
from app.lib.ai.client import get_anthropic_client
from app.lib.ai.tutor_agent import TutorAgent, MODEL_SONNET
from app import models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/parent", tags=["parent"])

_agent = TutorAgent()


@router.post("")
async def parent_action(body: dict, request: Request, db: Session = Depends(get_db)):
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")

    action_type = body.get("type")

    if action_type == "verify_pin":
        return await _handle_verify_pin(body, payload["sub"], db)
    elif action_type == "get_assessment":
        return await _handle_get_assessment(payload["sub"], db)
    elif action_type == "generate_weekly_digest":
        return await _handle_generate_weekly_digest(body, payload["sub"], db)
    elif action_type == "generate_narrative":
        return await _handle_generate_narrative(body, payload["sub"], db)
    else:
        raise HTTPException(400, f"Unknown parent action: {action_type}")


async def _handle_verify_pin(body: dict, student_id: str, db: Session) -> dict:
    parent_pin = body.get("parent_pin") or body.get("parentPin") or ""
    if not parent_pin:
        raise HTTPException(400, "parent_pin is required")

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student or not student.parent_pin_hash:
        raise HTTPException(401, "No parent PIN set")

    if not verify_password(parent_pin, student.parent_pin_hash):
        raise HTTPException(401, "Invalid PIN")

    return {"verified": True}


async def _handle_get_assessment(student_id: str, db: Session) -> dict:
    # Get skill masteries
    masteries = (
        db.query(models.SkillMastery)
        .filter(models.SkillMastery.student_id == student_id)
        .all()
    )

    # Get recent sessions
    sessions = (
        db.query(models.TutoringSession)
        .filter(models.TutoringSession.student_id == student_id)
        .order_by(models.TutoringSession.started_at.desc())
        .limit(10)
        .all()
    )

    mastery_data = [
        {
            "skill_id": m.skill_id,
            "mastery_level": m.mastery_level,
            "attempts_count": m.attempts_count,
            "correct_count": m.correct_count,
            "confidence_trend": m.confidence_trend,
            "last_practiced": m.last_practiced.isoformat() if m.last_practiced else None,
        }
        for m in masteries
    ]

    session_data = [
        {
            "id": s.id,
            "domain": s.domain,
            "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "skills_covered": s.skills_covered_list,
        }
        for s in sessions
    ]

    return {
        "mastery_data": mastery_data,
        "recent_sessions": session_data,
        "total_sessions": len(session_data),
    }


async def _handle_generate_weekly_digest(body: dict, student_id: str, db: Session) -> dict:
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    skill_data = body.get("skill_data") or {}
    session_data = body.get("session_data") or []

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_SONNET,
        max_tokens=1024,
        system=[{
            "type": "text",
            "text": "You are writing a weekly learning digest for a parent. Be warm, specific, and encouraging.",
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{
            "role": "user",
            "content": f"""Write a weekly learning digest for the parent of {student.name}.

Session summary: {len(session_data)} sessions this week
Skill data: {json.dumps(skill_data)[:1000] if skill_data else "Not provided"}

Include:
1. A brief summary of what was practiced
2. Notable strengths and improvements
3. Areas to focus on next week
4. An encouraging message for the student

Keep it warm, specific, and under 300 words.""",
        }],
    )
    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    return {"digest": text, "student_name": student.name}


async def _handle_generate_narrative(body: dict, student_id: str, db: Session) -> dict:
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    skill_data = body.get("skill_data") or {}

    # Calculate overall progress
    masteries = (
        db.query(models.SkillMastery)
        .filter(models.SkillMastery.student_id == student_id)
        .all()
    )

    if masteries:
        avg_mastery = sum(m.mastery_level for m in masteries) / len(masteries)
        improving = [m for m in masteries if m.confidence_trend == "improving"]
        declining = [m for m in masteries if m.confidence_trend == "declining"]
    else:
        avg_mastery = 0
        improving = []
        declining = []

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_SONNET,
        max_tokens=768,
        system=[{
            "type": "text",
            "text": "You are writing a narrative progress report for a parent about their child's exam preparation.",
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{
            "role": "user",
            "content": f"""Write a narrative progress summary for {student.name}'s Hunter College exam preparation.

Overall average mastery: {round(avg_mastery * 100)}%
Skills improving: {len(improving)}
Skills declining: {len(declining)}
Total skills tracked: {len(masteries)}

Write a 2-3 paragraph narrative that:
1. Summarizes overall progress in a positive, honest way
2. Highlights specific strengths
3. Notes areas for growth without being discouraging
4. Gives the parent context for what the exam requires

Be specific and avoid generic language.""",
        }],
    )
    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    return {
        "narrative": text,
        "stats": {
            "avg_mastery": round(avg_mastery * 100),
            "skills_tracked": len(masteries),
            "improving": len(improving),
            "declining": len(declining),
        },
    }
