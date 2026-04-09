"""Reading passage generation API — port of src/app/api/reading/route.ts."""
import json
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_session_payload
from app.lib.ai.client import get_anthropic_client
from app.lib.ai.tutor_agent import TutorAgent, MODEL_SONNET

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reading", tags=["reading"])

_agent = TutorAgent()


@router.post("")
async def reading_action(body: dict, request: Request, db: Session = Depends(get_db)):
    action_type = body.get("type")

    if action_type == "generate_passage":
        return await _handle_generate_passage(body)
    elif action_type == "speed_feedback":
        return await _handle_speed_feedback(body)
    else:
        raise HTTPException(400, f"Unknown reading action: {action_type}")


async def _handle_generate_passage(body: dict) -> dict:
    grade_level = body.get("grade_level") or body.get("gradeLevel") or "foundations"
    topic = body.get("topic") or ""

    if grade_level == "hunter_prep":
        reading_level = "6th grade (Lexile 900-1100)"
        word_count = "200-250"
    else:
        reading_level = "4th-5th grade (Lexile 700-900)"
        word_count = "150-200"

    topic_hint = f"Topic: {topic}" if topic else "Choose an engaging, age-appropriate topic (nature, history, science, culture)."

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_SONNET,
        max_tokens=2048,
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""Generate a reading comprehension passage for a student preparing for the Hunter College High School entrance exam.

Reading level: {reading_level}
Length: {word_count} words
{topic_hint}

Then generate 5 comprehension questions about the passage.
Question types to include: main idea, inference, vocabulary in context, detail, author's purpose.

Format your response as JSON:
{{
  "title": "passage title",
  "passage": "full passage text...",
  "questions": [
    {{
      "question": "...",
      "type": "main_idea|inference|vocabulary|detail|author_purpose",
      "answer_choices": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
      "correct_answer": "C) ..."
    }}
  ]
}}

Ensure the passage is engaging, informative, and appropriate for the age group.""",
        }],
    )

    text = response.content[0].text if response.content and response.content[0].type == "text" else ""

    # Parse JSON
    try:
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            data = json.loads(json_match.group(0))
            return {
                "passage": {
                    "title": data.get("title", "Reading Passage"),
                    "text": data.get("passage", ""),
                    "grade_level": grade_level,
                },
                "questions": data.get("questions", []),
            }
    except (json.JSONDecodeError, KeyError) as e:
        logger.error("[reading] Failed to parse passage JSON: %s", e)

    return {
        "passage": {"title": "Reading Passage", "text": text, "grade_level": grade_level},
        "questions": [],
    }


async def _handle_speed_feedback(body: dict) -> dict:
    words_per_minute = float(body.get("words_per_minute") or body.get("wordsPerMinute") or 0)
    target_wpm = float(body.get("target_wpm") or body.get("targetWpm") or 150)

    if words_per_minute <= 0:
        raise HTTPException(400, "words_per_minute is required")

    if words_per_minute >= target_wpm * 1.1:
        feedback = f"Excellent reading speed! At {round(words_per_minute)} words per minute, you're reading faster than the target of {round(target_wpm)} wpm. Keep up the great work!"
        rating = "excellent"
    elif words_per_minute >= target_wpm * 0.85:
        feedback = f"Good reading speed! At {round(words_per_minute)} words per minute, you're close to the target of {round(target_wpm)} wpm. A little more practice and you'll be there!"
        rating = "good"
    elif words_per_minute >= target_wpm * 0.65:
        feedback = f"You're at {round(words_per_minute)} words per minute. The target is {round(target_wpm)} wpm. Try to read a bit faster while still understanding what you read."
        rating = "developing"
    else:
        feedback = f"You're at {round(words_per_minute)} words per minute. The target is {round(target_wpm)} wpm. Practice reading daily to build your speed — it'll improve with time!"
        rating = "needs_practice"

    return {"feedback": feedback, "rating": rating, "wpm": words_per_minute, "target_wpm": target_wpm}
