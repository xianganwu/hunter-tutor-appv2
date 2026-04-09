"""Session management API routes — port of src/app/api/session/route.ts."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_session_payload
from app import models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/session", tags=["session"])


@router.get("")
def list_sessions(
    request: Request,
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")

    sessions = (
        db.query(models.TutoringSession)
        .filter(models.TutoringSession.student_id == payload["sub"])
        .order_by(models.TutoringSession.started_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for s in sessions:
        question_count = (
            db.query(models.QuestionAttempt)
            .filter(models.QuestionAttempt.session_id == s.id)
            .count()
        )
        result.append({
            "id": s.id,
            "domain": s.domain,
            "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "skills_covered": s.skills_covered_list,
            "session_summary": s.session_summary,
            "question_count": question_count,
        })

    return {"sessions": result}


@router.post("")
def session_action(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")

    action = body.get("action")
    if action == "create":
        return _create_session(body, payload["sub"], db)
    elif action == "end":
        return _end_session(body, payload["sub"], db)
    else:
        raise HTTPException(400, "Invalid action. Use 'create' or 'end'")


def _create_session(body: dict, student_id: str, db: Session) -> dict:
    domain = (body.get("domain") or "").strip()
    if not domain:
        raise HTTPException(400, "domain is required")
    skills_covered = body.get("skills_covered") or []

    session = models.TutoringSession(
        student_id=student_id,
        domain=domain,
        skills_covered=json.dumps(skills_covered),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session": {
            "id": session.id,
            "domain": session.domain,
            "started_at": session.started_at.isoformat(),
        }
    }


def _end_session(body: dict, student_id: str, db: Session) -> dict:
    session_id = body.get("session_id") or body.get("sessionId") or ""
    if not session_id:
        raise HTTPException(400, "session_id is required")

    session = (
        db.query(models.TutoringSession)
        .filter(
            models.TutoringSession.id == session_id,
            models.TutoringSession.student_id == student_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(404, "Session not found")

    from datetime import datetime, UTC
    updates: dict = {"ended_at": datetime.now(UTC).replace(tzinfo=None)}
    if body.get("summary"):
        updates["session_summary"] = body["summary"]
    if body.get("skills_covered") is not None:
        updates["skills_covered"] = json.dumps(body["skills_covered"])

    for k, v in updates.items():
        setattr(session, k, v)
    db.commit()
    db.refresh(session)

    return {
        "session": {
            "id": session.id,
            "domain": session.domain,
            "started_at": session.started_at.isoformat(),
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "session_summary": session.session_summary,
        }
    }
