"""Exam simulation API — port of src/app/api/simulate/route.ts."""
import json
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_session_payload
from app.lib.ai.client import get_anthropic_client
from app.lib.ai.tutor_agent import TutorAgent, MODEL_SONNET
from app.lib.curriculum import get_skill_by_id
from app.lib.ai.validate_question import validate_generated_question

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/simulate", tags=["simulate"])

_agent = TutorAgent()


@router.post("")
async def simulate_action(body: dict, request: Request, db: Session = Depends(get_db)):
    action_type = body.get("type")

    if action_type == "generate_math_questions":
        return await _handle_generate_math_questions(body)
    elif action_type == "evaluate_essay":
        return await _handle_evaluate_essay(body)
    elif action_type == "generate_recommendations":
        return await _handle_generate_recommendations(body)
    else:
        raise HTTPException(400, f"Unknown simulation action: {action_type}")


async def _handle_generate_math_questions(body: dict) -> dict:
    skill_ids = body.get("skill_ids") or body.get("skillIds") or []
    count = min(int(body.get("count", 10)), 30)

    if not skill_ids:
        raise HTTPException(400, "skill_ids is required")

    skills = [s for sid in skill_ids if (s := get_skill_by_id(sid)) is not None]
    if not skills:
        raise HTTPException(400, "No valid skills found")

    # Distribute questions across skills
    per_skill = max(1, count // len(skills))
    skill_list = "\n".join(
        f'{i+1}. "{s["name"]}" ({s["skill_id"]}): {s["description"]}'
        for i, s in enumerate(skills[:10])  # cap at 10 skill types
    )

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_SONNET,
        max_tokens=min(8192, count * 400),
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""Generate exactly {count} math questions for a practice exam simulation.
Target: 6th grader preparing for Hunter College High School entrance exam.
Difficulty: Exam-level (tiers 3-5), rigorous and challenging.

Distribute questions across these skills:
{skill_list}

Each question must have 5 answer choices (A-E), exactly one correct answer.
Vary difficulty and question types. No two questions should be identical.

Respond with ONLY a JSON array:
[
  {{
    "skillId": "skill_id",
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
        if json_match:
            parsed = json.loads(json_match.group(0))
            for q in parsed:
                validated = validate_generated_question(
                    q.get("questionText", ""),
                    q.get("answerChoices", []),
                    q.get("correctAnswer", ""),
                    "simulate/math",
                )
                if validated is not None:
                    questions.append({
                        "skill_id": q.get("skillId", ""),
                        "question_text": q["questionText"],
                        "answer_choices": q["answerChoices"],
                        "correct_answer": validated,
                    })
    except (json.JSONDecodeError, KeyError) as e:
        logger.error("[simulate] Math question parse error: %s", e)

    return {"questions": questions[:count]}


async def _handle_evaluate_essay(body: dict) -> dict:
    prompt = body.get("prompt") or ""
    essay_text = body.get("essay_text") or body.get("essayText") or ""
    if not prompt or not essay_text:
        raise HTTPException(400, "prompt and essay_text are required")

    feedback = await _agent.evaluate_essay(prompt, essay_text)
    total = sum(feedback.scores.values())
    max_total = len(feedback.scores) * 10
    percentage = round(total / max_total * 100)

    return {
        "feedback": feedback.overall_feedback,
        "scores": feedback.scores,
        "total_score": total,
        "percentage": percentage,
        "strengths": feedback.strengths,
        "improvements": feedback.improvements,
    }


async def _handle_generate_recommendations(body: dict) -> dict:
    weak_skills = body.get("weak_skills") or body.get("weakSkills") or []
    scores = body.get("scores") or {}

    if not weak_skills and not scores:
        return {"recommendations": []}

    skill_names = []
    for sid in weak_skills[:5]:
        skill = get_skill_by_id(sid)
        if skill:
            skill_names.append(skill["name"])

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_SONNET,
        max_tokens=512,
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""A student completed a practice exam simulation. Generate 3-5 specific study recommendations.

Weak skills: {", ".join(skill_names) if skill_names else "not specified"}
Scores: {json.dumps(scores) if scores else "not specified"}

Provide:
1. Prioritized list of what to study
2. Specific practice strategies for each weak area
3. Encouragement

Keep it actionable and age-appropriate for a 5th-6th grader.""",
        }],
    )
    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    return {"recommendations": text, "weak_skills": weak_skills}
