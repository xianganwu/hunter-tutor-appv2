"""Vocabulary API routes — port of src/app/api/vocab/route.ts."""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_session_payload
from app.lib.ai.client import get_anthropic_client
from app.lib.ai.tutor_agent import TutorAgent, MODEL_HAIKU, MODEL_SONNET

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/vocab", tags=["vocab"])

_agent = TutorAgent()


@router.post("")
async def vocab_action(body: dict, request: Request, db: Session = Depends(get_db)):
    action_type = body.get("type")

    if action_type == "generate_context":
        return await _handle_generate_context(body)
    elif action_type == "evaluate_usage":
        return await _handle_evaluate_usage(body)
    elif action_type == "extract_vocab":
        return await _handle_extract_vocab(body)
    else:
        raise HTTPException(400, f"Unknown vocab action: {action_type}")


async def _handle_generate_context(body: dict) -> dict:
    word = body.get("word") or ""
    if not word:
        raise HTTPException(400, "word is required")

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_HAIKU,
        max_tokens=512,
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""Help a student learn this vocabulary word: "{word}"

Provide:
1. A simple, clear definition (1-2 sentences)
2. The word used in TWO example sentences (age-appropriate, grades 5-6 level)
3. A memory tip or word root hint if helpful

Keep it concise and engaging.""",
        }],
    )
    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    return {"text": text, "word": word}


async def _handle_evaluate_usage(body: dict) -> dict:
    word = body.get("word") or ""
    sentence = body.get("sentence") or ""
    if not word or not sentence:
        raise HTTPException(400, "word and sentence are required")

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_HAIKU,
        max_tokens=256,
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""A student used the word "{word}" in this sentence:
"{sentence}"

Is the word used correctly? Respond:
CORRECT: [yes/no]
FEEDBACK: [1-2 sentences — if incorrect, gently explain why and give an example of correct usage]""",
        }],
    )
    text = response.content[0].text if response.content and response.content[0].type == "text" else ""

    import re
    correct_m = re.search(r"CORRECT:\s*(yes|no)", text, re.IGNORECASE)
    feedback_m = re.search(r"FEEDBACK:\s*([\s\S]+?)$", text, re.IGNORECASE)

    is_correct = (correct_m.group(1).lower() == "yes") if correct_m else True
    feedback = feedback_m.group(1).strip() if feedback_m else text

    return {"is_correct": is_correct, "feedback": feedback}


async def _handle_extract_vocab(body: dict) -> dict:
    passage = body.get("passage") or ""
    if not passage:
        raise HTTPException(400, "passage is required")

    client = get_anthropic_client()
    response = client.messages.create(
        model=MODEL_HAIKU,
        max_tokens=512,
        system=_agent.get_cached_system_block(),
        messages=[{
            "role": "user",
            "content": f"""Extract 5-8 vocabulary words from this passage that would be good for a 5th-6th grader to learn:

{passage[:3000]}

For each word, provide:
- The word
- Its definition as used in context
- The sentence from the passage where it appears

Format as a simple list. Focus on words that are challenging but learnable.""",
        }],
    )
    text = response.content[0].text if response.content and response.content[0].type == "text" else ""
    return {"text": text}
