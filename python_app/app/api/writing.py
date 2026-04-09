"""Writing evaluation API routes — port of src/app/api/writing/route.ts."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_session_payload
from app.lib.ai.tutor_agent import TutorAgent
from app import models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/writing", tags=["writing"])

_agent = TutorAgent()


@router.get("")
def list_essays(request: Request, db: Session = Depends(get_db)) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")

    # Get sessions for student
    session_ids = [
        s.id for s in
        db.query(models.TutoringSession.id)
        .filter(models.TutoringSession.student_id == payload["sub"])
        .all()
    ]
    if not session_ids:
        return {"essays": []}

    submissions = (
        db.query(models.WritingSubmission)
        .filter(models.WritingSubmission.session_id.in_(session_ids))
        .order_by(models.WritingSubmission.created_at.desc())
        .all()
    )

    return {
        "essays": [
            {
                "id": s.id,
                "session_id": s.session_id,
                "prompt": s.prompt,
                "essay_text": s.essay_text,
                "ai_feedback": json.loads(s.ai_feedback) if s.ai_feedback else None,
                "scores": json.loads(s.scores_json) if s.scores_json else None,
                "revision_of": s.revision_of,
                "revision_number": s.revision_number,
                "created_at": s.created_at.isoformat(),
            }
            for s in submissions
        ]
    }


@router.post("")
async def writing_action(body: dict, request: Request, db: Session = Depends(get_db)):
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")

    action_type = body.get("type")

    if action_type == "brainstorm":
        return await _handle_brainstorm(body)
    elif action_type == "evaluate_essay":
        return await _handle_evaluate_essay(body, payload["sub"], db)
    elif action_type == "evaluate_revision":
        return await _handle_evaluate_revision(body, payload["sub"], db)
    elif action_type == "rewrite_feedback":
        return await _handle_rewrite_feedback(body)
    else:
        raise HTTPException(400, f"Unknown writing action: {action_type}")


async def _handle_brainstorm(body: dict) -> dict:
    from app.lib.ai.client import get_anthropic_client
    from app.lib.ai.tutor_agent import MODEL_SONNET
    prompt = body.get("prompt") or ""
    if not prompt:
        raise HTTPException(400, "prompt is required")

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_SONNET,
        max_tokens=1024,
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""Help me brainstorm ideas for this writing prompt:

Prompt: {prompt}

Give me 3-4 strong topic ideas with a brief explanation of each. For each idea:
1. State the main argument or story angle
2. List 2-3 key points or details to include
3. Explain why this would make a strong essay

Keep your language encouraging and appropriate for a student preparing for the Hunter College High School entrance exam.""",
        }],
    )
    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    return {"text": text}


async def _handle_evaluate_essay(body: dict, student_id: str, db: Session) -> dict:
    prompt = body.get("prompt") or ""
    essay_text = body.get("essay_text") or body.get("essayText") or ""
    session_id = body.get("session_id") or body.get("sessionId")

    if not prompt or not essay_text:
        raise HTTPException(400, "prompt and essay_text are required")

    feedback = await _agent.evaluate_essay(prompt, essay_text)

    # Persist to DB if session_id provided
    if session_id:
        session = db.query(models.TutoringSession).filter(
            models.TutoringSession.id == session_id,
            models.TutoringSession.student_id == student_id,
        ).first()
        if session:
            submission = models.WritingSubmission(
                session_id=session_id,
                prompt=prompt,
                essay_text=essay_text,
                ai_feedback=json.dumps({"overall": feedback.overall_feedback}),
                scores_json=json.dumps(feedback.scores),
                revision_number=0,
            )
            db.add(submission)
            db.commit()
            db.refresh(submission)
            return {
                "submission_id": submission.id,
                "feedback": feedback.overall_feedback,
                "scores": feedback.scores,
                "strengths": feedback.strengths,
                "improvements": feedback.improvements,
            }

    return {
        "feedback": feedback.overall_feedback,
        "scores": feedback.scores,
        "strengths": feedback.strengths,
        "improvements": feedback.improvements,
    }


async def _handle_evaluate_revision(body: dict, student_id: str, db: Session) -> dict:
    original_id = body.get("original_submission_id") or body.get("originalSubmissionId")
    essay_text = body.get("essay_text") or body.get("essayText") or ""
    session_id = body.get("session_id") or body.get("sessionId")

    if not essay_text:
        raise HTTPException(400, "essay_text is required")

    # Load original
    original = None
    if original_id:
        original = db.query(models.WritingSubmission).filter(
            models.WritingSubmission.id == original_id
        ).first()

    prompt = (original.prompt if original else body.get("prompt")) or ""
    feedback = await _agent.evaluate_essay(prompt, essay_text)

    # Check revision limit
    revision_number = 1
    if original:
        revision_number = original.revision_number + 1
    if revision_number > 2:
        raise HTTPException(400, "Maximum of 2 revisions allowed")

    if session_id and original:
        submission = models.WritingSubmission(
            session_id=session_id,
            prompt=prompt,
            essay_text=essay_text,
            ai_feedback=json.dumps({"overall": feedback.overall_feedback}),
            scores_json=json.dumps(feedback.scores),
            revision_of=original_id,
            revision_number=revision_number,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

    return {
        "feedback": feedback.overall_feedback,
        "scores": feedback.scores,
        "strengths": feedback.strengths,
        "improvements": feedback.improvements,
        "revision_number": revision_number,
    }


async def _handle_rewrite_feedback(body: dict) -> dict:
    from app.lib.ai.client import get_anthropic_client
    from app.lib.ai.tutor_agent import MODEL_HAIKU
    feedback = body.get("feedback") or ""
    essay_text = body.get("essay_text") or body.get("essayText") or ""
    if not feedback or not essay_text:
        raise HTTPException(400, "feedback and essay_text are required")

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_HAIKU,
        max_tokens=512,
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""Rewrite this feedback to be more student-friendly and actionable for a middle school student:

Original feedback: {feedback}

Make it:
- Encouraging and specific
- Break improvements into numbered steps
- Keep it under 150 words""",
        }],
    )
    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    return {"text": text}
