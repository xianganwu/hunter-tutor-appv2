"""
TutorAgent — Python port of TypeScript src/lib/ai/tutor-agent.ts.

Handles all interactions with the Anthropic Claude API for tutoring.
"""
from __future__ import annotations
import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

import anthropic

from app.lib.ai.client import get_anthropic_client
from app.lib.ai.validate_question import validate_generated_question
from app.lib.curriculum import get_all_skills

logger = logging.getLogger(__name__)

MODEL_SONNET = "claude-sonnet-4-20250514"
MODEL_HAIKU = "claude-haiku-4-5-20251001"

MAX_TOKENS_LESSON = 4096
MAX_TOKENS_QUESTION = 512
MAX_TOKENS_FEEDBACK = 768
MAX_TOKENS_ESSAY = 1024
MAX_TOKENS_FOLLOWUP = 256


# ─── Output types ─────────────────────────────────────────────────────

@dataclass
class TeachConceptResult:
    explanation: str


@dataclass
class GeneratedQuestion:
    question_text: str
    correct_answer: str
    answer_choices: list[str]
    skill_id: str
    difficulty_tier: int


@dataclass
class AnswerFeedback:
    is_correct: bool
    feedback: str


@dataclass
class EssayFeedback:
    overall_feedback: str
    scores: dict[str, int]  # organization, developmentOfIdeas, wordChoice, sentenceStructure, mechanics
    strengths: list[str]
    improvements: list[str]
    scoring_note: Optional[str] = None


@dataclass
class SocraticFollowUp:
    question: str


@dataclass
class ConversationMessage:
    role: str  # "user" | "assistant"
    content: str


# ─── Visual skill detection ───────────────────────────────────────────

VISUAL_SKILLS = {
    "ma_angles_shapes", "ma_perimeter_area", "ma_coordinate_basics",
    "ma_area_perimeter_volume", "ma_coordinate_geometry",
    "ma_data_reading", "ma_mean_median_mode", "ma_basic_probability",
    "ma_probability_statistics", "ma_data_interpretation",
}


def is_visual_skill(skill_id: str) -> bool:
    return skill_id in VISUAL_SKILLS


# ─── System prompt ────────────────────────────────────────────────────

def _build_curriculum_summary() -> str:
    skills = get_all_skills()
    lines: list[str] = []
    for skill_id, skill in skills.items():
        prereqs = ", ".join(skill.get("prerequisite_skills", [])) or "none"
        level = skill.get("level", "foundations")
        tier = skill.get("difficulty_tier", 3)
        lines.append(f"- {skill_id}: \"{skill['name']}\" [{level}] (tier {tier}, prereqs: {prereqs})")
    return "\n".join(lines)


def _build_system_prompt() -> str:
    curriculum = _build_curriculum_summary()
    return f"""You are a warm, patient tutor helping a student build foundational skills for the Hunter College High School entrance exam. The student may be a rising 5th grader (age 9-10) working on foundations, or a 6th grader (age 11-12) doing intensive Hunter prep. Your name is not important — the student is the star.

## Your Teaching Philosophy

1. **Socratic method**: When a student answers incorrectly or is stuck, use guiding questions to help them discover the answer. Use phrases like "What do you think would happen if...?" When a student answers correctly, give brief praise (1 sentence) and move on — do NOT ask follow-up questions or suggest topic changes after correct answers. The system handles pacing and topic transitions automatically.

2. **Celebrate effort**: Praise the thinking process, not just correct answers. Say things like "I love how you broke that down" or "Great reasoning!" Never say "wrong" — say "not quite" or "let's look at this another way."

3. **Patient scaffolding**: If a student is stuck, break the problem into smaller steps. If they're still stuck, give a worked example of a similar (not identical) problem, then circle back.

4. **Age-appropriate language**: Write at a 4th-5th grade reading level for "foundations" level skills, and 6th grade level for "hunter_prep" skills. Short sentences. Concrete, relatable examples (sports, animals, games, school life). Avoid jargon — but introduce vocabulary naturally when relevant.

5. **Encouraging tone**: Every response should leave the student feeling capable. End teaching moments with forward momentum: "Now you know X — let's try one together!"

6. **Progressive learning**: Students start with foundational skills and progress to Hunter prep level skills. When a student masters a foundations-level skill, celebrate and introduce the next level.

## Emotional Awareness

Students preparing for a competitive exam often feel anxious, frustrated, or discouraged. Watch for signals:

- **Frustration**: "I don't get it", "this is too hard", "I give up", short or angry responses, repeated wrong answers
- **Anxiety**: "I'm nervous", "what if I fail", "I'm scared", "I'm not smart enough"
- **Disengagement**: very short answers, "idk", "whatever"

When you detect these signals:
1. Pause the academic content immediately
2. Validate their feelings: "It's totally normal to feel frustrated — this IS challenging material"
3. Remind them of progress: reference something they got right earlier
4. Offer a choice: "Want to try an easier one, take a quick break, or switch topics?"
5. Never minimize their feelings or push through frustration

## Rules
- Keep responses concise: 2-4 sentences for dialogue, longer for worked explanations.
- Use LaTeX notation ONLY for pure math: fractions ($\\frac{{3}}{{4}}$), operations ($45 \\times 25 = 1125$). Keep simple numbers as plain text. NEVER put English words inside dollar signs.
- Never break character or mention being an AI.
- If a student gives a wrong answer, give a brief encouraging nudge toward the right thinking.
- Reference prerequisite skills when a gap appears.
- For younger students (foundations level), use relatable examples: pizza slices, sports scores, classroom scenarios, animals, games.
- When writing about money, write out the word "dollars" (or "cents") instead of using the $ symbol.

## Diagrams
Do NOT include SVG diagrams unless the concept is truly impossible to understand without a visual.

## Curriculum Taxonomy

Skills with difficulty tier (1-5), level, and prerequisites:

{curriculum}

Use this taxonomy to match your language complexity to the skill's level."""


def _describe_mastery(mastery: float) -> str:
    if mastery < 0.2:
        return "just starting"
    if mastery < 0.4:
        return "early learning"
    if mastery < 0.6:
        return "developing"
    if mastery < 0.8:
        return "proficient"
    return "mastered"


# ─── Answer matching ─────────────────────────────────────────────────

def _extract_choice_letter(s: str) -> Optional[str]:
    """Extract letter from 'C) text' or bare 'C' formats."""
    trimmed = s.strip()
    m = re.match(r"^([A-Ea-e])\)", trimmed)
    if m:
        return m.group(1).upper()
    if re.match(r"^[A-Ea-e]$", trimmed, re.IGNORECASE):
        return trimmed.upper()
    return None


def _answers_match(student_answer: str, correct_answer: str) -> bool:
    """Compare student and correct answers across formats."""
    if student_answer.strip().lower() == correct_answer.strip().lower():
        return True
    s_letter = _extract_choice_letter(student_answer)
    c_letter = _extract_choice_letter(correct_answer)
    if s_letter and c_letter:
        return s_letter == c_letter
    # Strip prefix and compare
    def strip_prefix(s: str) -> str:
        return re.sub(r"^[A-Ea-e]\)\s*", "", s).strip().lower()
    return strip_prefix(student_answer) == strip_prefix(correct_answer)


# ─── Question parsing ────────────────────────────────────────────────

def _parse_generated_question(
    text: str,
    skill_id: str,
    difficulty_tier: int,
) -> Optional[GeneratedQuestion]:
    """Parse AI response into a GeneratedQuestion."""
    # Extract QUESTION
    q_match = re.search(r"QUESTION:\s*(.*?)(?=\nA\))", text, re.DOTALL | re.IGNORECASE)
    if not q_match:
        logger.warning("[tutor_agent] Could not parse QUESTION from response")
        return None
    question_text = q_match.group(1).strip()

    # Extract choices A-E
    choices: list[str] = []
    for letter in ["A", "B", "C", "D", "E"]:
        choice_match = re.search(
            rf"{letter}\)\s*(.*?)(?=\n[B-ECORRECT]|$)",
            text,
            re.DOTALL | re.IGNORECASE,
        )
        if choice_match:
            choices.append(f"{letter}) {choice_match.group(1).strip()}")

    if len(choices) < 3:
        # Try alternative parsing: just find A) through E) sequentially
        choices = []
        for letter in ["A", "B", "C", "D", "E"]:
            m = re.search(rf"^{letter}\)\s*(.+)$", text, re.MULTILINE | re.IGNORECASE)
            if m:
                choices.append(f"{letter}) {m.group(1).strip()}")

    if len(choices) < 3:
        logger.warning("[tutor_agent] Could not extract answer choices from response")
        return None

    # Extract CORRECT answer
    correct_match = re.search(r"CORRECT:\s*([A-Ea-e])", text, re.IGNORECASE)
    if not correct_match:
        logger.warning("[tutor_agent] Could not parse CORRECT from response")
        return None

    correct_letter = correct_match.group(1).upper()
    # Find full correct choice text
    correct_answer = next(
        (c for c in choices if c.startswith(f"{correct_letter})")),
        None,
    )
    if not correct_answer:
        logger.warning("[tutor_agent] Correct letter %s not in choices", correct_letter)
        return None

    # Validate
    validated = validate_generated_question(
        question_text, choices, correct_answer, "tutor_agent/parse"
    )
    if validated is None:
        return None

    return GeneratedQuestion(
        question_text=question_text,
        correct_answer=validated,
        answer_choices=choices,
        skill_id=skill_id,
        difficulty_tier=difficulty_tier,
    )


def _extract_text(response: anthropic.types.Message) -> str:
    """Extract text from first text block of an Anthropic response."""
    for block in response.content:
        if block.type == "text":
            return block.text
    return ""


# ─── TutorAgent ──────────────────────────────────────────────────────

class TutorAgent:
    def __init__(self, client: Optional[anthropic.Anthropic] = None):
        self._client = client or get_anthropic_client()
        self._system_prompt = _build_system_prompt()
        self._cached_system_block = [
            {
                "type": "text",
                "text": self._system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ]

    def get_cached_system_block(self) -> list[dict]:
        return self._cached_system_block

    # ─── Build message lists (for streaming) ─────────────────────────

    def build_teach_messages(self, skill: dict, student_mastery: float) -> list[dict]:
        mastery_label = _describe_mastery(student_mastery)
        prereq_names = ", ".join(skill.get("prerequisite_skills", [])) or "none"
        mastery_pct = round(student_mastery * 100)

        if student_mastery < 0.3:
            context = "I'm just starting to learn this. Start from the very basics with a simple example."
        elif student_mastery < 0.6:
            context = "I have some understanding but I'm not confident yet. Use a clear example to build my confidence."
        else:
            context = "I know the basics but need to go deeper. Show me a challenging example and connect it to related skills."

        return [
            {
                "role": "user",
                "content": f"""Teach me the concept: "{skill['name']}"

Skill description: {skill['description']}
Difficulty tier: {skill['difficulty_tier']}/5
Prerequisite skills: {prereq_names}
My current mastery: {mastery_label} ({mastery_pct}%)

{context}

Give me a clear explanation with one worked example. End with an encouraging transition like "Let's try one!" Do NOT ask me any questions — the system will present a practice question automatically.""",
            }
        ]

    def build_evaluate_messages(
        self,
        question_text: str,
        student_answer: str,
        correct_answer: str,
        conversation_history: list[ConversationMessage],
        evaluation_mode: str = "chat",
    ) -> tuple[list[dict], bool]:
        """Returns (messages, is_correct)."""
        is_correct = _answers_match(student_answer, correct_answer)

        history_msgs = [{"role": m.role, "content": m.content} for m in conversation_history]

        if evaluation_mode == "study":
            if is_correct:
                prompt = f"""The student answered correctly!

Question: {question_text}
Student's answer: {student_answer}
Correct answer: {correct_answer}

Give brief, enthusiastic praise (1-2 sentences). Acknowledge what they got right. Do NOT ask any follow-up questions."""
            else:
                prompt = f"""The student answered incorrectly.

Question: {question_text}
Student's answer: {student_answer}
Correct answer: {correct_answer}

1. Acknowledge their attempt positively ("Good try!" or "Nice effort!").
2. Briefly explain why the correct answer is right (1-2 sentences).
3. If helpful, mention why their answer was a common or understandable mistake.

Keep it encouraging and concise. Do NOT ask the student any questions."""
        else:
            if is_correct:
                prompt = f"""The student answered correctly!

Question: {question_text}
Student's answer: {student_answer}
Correct answer: {correct_answer}

Give brief praise (1 sentence max). Do NOT ask any follow-up questions or suggest what to try next."""
            else:
                prompt = f"""The student answered incorrectly.

Question: {question_text}
Student's answer: {student_answer}
Correct answer: {correct_answer}

Use the Socratic method: give ONE guiding nudge (1-2 sentences) to help them think differently. Do NOT reveal the correct answer. Do NOT ask multiple questions."""

        messages = history_msgs + [{"role": "user", "content": prompt}]
        return messages, is_correct

    def build_hint_messages(
        self, context: str, history: list[ConversationMessage]
    ) -> list[dict]:
        history_msgs = [{"role": m.role, "content": m.content} for m in history]
        return history_msgs + [
            {
                "role": "user",
                "content": f"I need a hint. Here's what I'm working on:\n{context}\n\nGive me ONE guiding question (Socratic style) to help me think through this. Do NOT give the answer.",
            }
        ]

    def build_emotional_messages(
        self, message: str, history: list[ConversationMessage]
    ) -> list[dict]:
        history_msgs = [{"role": m.role, "content": m.content} for m in history]
        return history_msgs + [
            {
                "role": "user",
                "content": f"Student message: {message}\n\nRespond with empathy. Validate their feelings and offer encouragement. Do not push academic content right now.",
            }
        ]

    # ─── Non-streaming methods ────────────────────────────────────────

    async def teach_concept(self, skill: dict, student_mastery: float) -> TeachConceptResult:
        response = self._client.messages.create(
            model=MODEL_SONNET,
            max_tokens=MAX_TOKENS_LESSON,
            system=self._cached_system_block,
            messages=self.build_teach_messages(skill, student_mastery),
        )
        return TeachConceptResult(explanation=_extract_text(response))

    async def generate_question(
        self,
        skill: dict,
        difficulty_tier: int,
        recent_questions: Optional[list[str]] = None,
    ) -> Optional[GeneratedQuestion]:
        needs_visual = is_visual_skill(skill["skill_id"])
        level_desc = (
            "6th grader (age 11-12)" if skill.get("level") == "hunter_prep"
            else "rising 5th grader (age 9-10)"
        )
        level_hint = (
            "" if skill.get("level") == "hunter_prep"
            else " Use simple, concrete scenarios that 9-10 year olds can relate to (school, sports, animals, games)."
        )
        visual_hint = (
            "\n\nVISUAL REQUIRED: This is a visual skill. Include a simple SVG diagram in the QUESTION text."
            if needs_visual else ""
        )
        recent_section = ""
        if recent_questions:
            recent_section = (
                "\n\nAVOID REPEATS — The student was recently shown these questions. Generate something DIFFERENT:\n"
                + "\n".join(f"{i+1}. {q}" for i, q in enumerate(recent_questions))
            )

        content = f"""Generate a practice question for me.

Skill: "{skill['name']}" ({skill['skill_id']})
Description: {skill['description']}
Difficulty tier: {difficulty_tier}/5

Create an original question appropriate for a {level_desc} at difficulty tier {difficulty_tier}.{level_hint} Format your response EXACTLY as:

QUESTION: [the question text]{visual_hint}
A) [choice A]
B) [choice B]
C) [choice C]
D) [choice D]
E) [choice E]
CORRECT: [letter]

Make the question test exactly the skill described. Make distractors plausible but clearly wrong to someone who understands the concept.

CRITICAL: There must be exactly ONE correct answer. Every answer choice must be a distinct value — no two choices may be mathematically equivalent. Verify your answer is correct before responding.
{recent_section}"""

        response = self._client.messages.create(
            model=MODEL_SONNET,
            max_tokens=1024 if needs_visual else MAX_TOKENS_QUESTION,
            system=self._cached_system_block,
            messages=[{"role": "user", "content": content}],
        )
        return _parse_generated_question(
            _extract_text(response), skill["skill_id"], difficulty_tier
        )

    async def evaluate_answer(
        self,
        question_text: str,
        student_answer: str,
        correct_answer: str,
        history: list[ConversationMessage],
        mode: str = "chat",
    ) -> AnswerFeedback:
        messages, is_correct = self.build_evaluate_messages(
            question_text, student_answer, correct_answer, history, mode
        )
        response = self._client.messages.create(
            model=MODEL_SONNET,
            max_tokens=MAX_TOKENS_FEEDBACK,
            system=self._cached_system_block,
            messages=messages,
        )
        return AnswerFeedback(is_correct=is_correct, feedback=_extract_text(response))

    async def socratic_follow_up(
        self, context: str, history: list[ConversationMessage]
    ) -> SocraticFollowUp:
        response = self._client.messages.create(
            model=MODEL_HAIKU,
            max_tokens=MAX_TOKENS_FOLLOWUP,
            system=self._cached_system_block,
            messages=self.build_hint_messages(context, history),
        )
        return SocraticFollowUp(question=_extract_text(response))

    async def respond_to_emotional_cue(
        self, message: str, history: list[ConversationMessage]
    ) -> str:
        response = self._client.messages.create(
            model=MODEL_HAIKU,
            max_tokens=768,
            system=self._cached_system_block,
            messages=self.build_emotional_messages(message, history),
        )
        return _extract_text(response)

    async def evaluate_essay(self, prompt: str, essay_text: str) -> EssayFeedback:
        response = self._client.messages.create(
            model=MODEL_SONNET,
            max_tokens=MAX_TOKENS_ESSAY,
            system=self._cached_system_block,
            messages=[
                {
                    "role": "user",
                    "content": f"""Evaluate this student essay for the Hunter College High School entrance exam.

Essay Prompt: {prompt}

Essay Text:
{essay_text}

Score the essay on these 5 dimensions (1-10 each):
- Organization
- Development of Ideas
- Word Choice
- Sentence Structure
- Mechanics (spelling, punctuation, grammar)

Respond in this EXACT format:

ORGANIZATION: [score]
DEVELOPMENT: [score]
WORD_CHOICE: [score]
SENTENCE_STRUCTURE: [score]
MECHANICS: [score]
STRENGTHS: [comma-separated list of 2-3 specific strengths]
IMPROVEMENTS: [comma-separated list of 2-3 specific improvements]
FEEDBACK: [2-4 sentences of overall encouraging feedback]""",
                }
            ],
        )
        text = _extract_text(response)

        def extract_score(field: str, default: int = 5) -> int:
            m = re.search(rf"{field}:\s*(\d+)", text, re.IGNORECASE)
            if m:
                return max(1, min(10, int(m.group(1))))
            return default

        scores = {
            "organization": extract_score("ORGANIZATION"),
            "developmentOfIdeas": extract_score("DEVELOPMENT"),
            "wordChoice": extract_score("WORD_CHOICE"),
            "sentenceStructure": extract_score("SENTENCE_STRUCTURE"),
            "mechanics": extract_score("MECHANICS"),
        }

        strengths_m = re.search(r"STRENGTHS:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
        improvements_m = re.search(r"IMPROVEMENTS:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
        feedback_m = re.search(r"FEEDBACK:\s*([\s\S]+?)$", text, re.IGNORECASE)

        strengths = [s.strip() for s in (strengths_m.group(1) if strengths_m else "").split(",") if s.strip()]
        improvements = [s.strip() for s in (improvements_m.group(1) if improvements_m else "").split(",") if s.strip()]
        overall_feedback = feedback_m.group(1).strip() if feedback_m else text

        return EssayFeedback(
            overall_feedback=overall_feedback,
            scores=scores,
            strengths=strengths,
            improvements=improvements,
        )

    async def generate_drill_batch(
        self,
        skill: dict,
        count: int = 10,
        difficulty_tier: Optional[int] = None,
        recent_questions: Optional[list[str]] = None,
    ) -> list[GeneratedQuestion]:
        tier = difficulty_tier or skill.get("difficulty_tier", 3)
        level_desc = (
            "6th grader (age 11-12)" if skill.get("level") == "hunter_prep"
            else "rising 5th grader (age 9-10)"
        )
        recent_section = ""
        if recent_questions:
            recent_section = (
                "\n\nAVOID REPEATS. Do NOT generate questions similar to these:\n"
                + "\n".join(f"- {q}" for q in recent_questions)
            )

        response = self._client.messages.create(
            model=MODEL_SONNET,
            max_tokens=min(4096, count * 400),
            system=self._cached_system_block,
            messages=[
                {
                    "role": "user",
                    "content": f"""Generate exactly {count} practice questions for the skill: "{skill['name']}" ({skill['skill_id']})
Description: {skill['description']}
Difficulty tier: {tier}/5
Target student: {level_desc}

Each question must have 5 answer choices (A-E) and ONE correct answer.
Make distractors plausible but clearly wrong to someone who understands the concept.
Vary the question structure and numbers — no two questions should be identical in format.{recent_section}

Respond with ONLY a JSON array, no other text:
[
  {{
    "questionText": "...",
    "answerChoices": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
    "correctAnswer": "C) ..."
  }}
]""",
                }
            ],
        )

        text = _extract_text(response)
        questions: list[GeneratedQuestion] = []
        try:
            json_match = re.search(r"\[[\s\S]*\]", text)
            if not json_match:
                logger.error("[tutor_agent] generate_drill_batch: no JSON array found")
                return questions
            parsed = json.loads(json_match.group(0))
            for item in parsed:
                validated = validate_generated_question(
                    item.get("questionText", ""),
                    item.get("answerChoices", []),
                    item.get("correctAnswer", ""),
                    "tutor_agent/drill_batch",
                )
                if validated is not None:
                    questions.append(
                        GeneratedQuestion(
                            question_text=item["questionText"],
                            correct_answer=validated,
                            answer_choices=item["answerChoices"],
                            skill_id=skill["skill_id"],
                            difficulty_tier=tier,
                        )
                    )
        except (json.JSONDecodeError, KeyError) as e:
            logger.error("[tutor_agent] generate_drill_batch parse error: %s", e)
        return questions

    async def generate_mixed_drill_batch(
        self,
        skills: list[tuple[dict, int]],  # (skill, tier)
        total_count: int,
        recent_questions: Optional[list[str]] = None,
    ) -> list[GeneratedQuestion]:
        """Generate a mixed batch of questions across multiple skills."""
        per_skill = max(1, total_count // len(skills))
        all_questions: list[GeneratedQuestion] = []
        for skill, tier in skills:
            batch = await self.generate_drill_batch(skill, per_skill, tier, recent_questions)
            all_questions.extend(batch)
        return all_questions[:total_count]

    async def generate_summary(
        self,
        questions_answered: int,
        correct_count: int,
        skills_covered: list[str],
        elapsed_minutes: float,
    ) -> str:
        from app.lib.curriculum import get_skill_by_id
        accuracy = round(correct_count / questions_answered * 100) if questions_answered > 0 else 0
        skill_names = ", ".join(
            (get_skill_by_id(sid) or {}).get("name", sid) for sid in skills_covered
        )
        parts = [
            f"Great session! You practiced for {round(elapsed_minutes)} minutes.",
            f"You answered {questions_answered} questions with {accuracy}% accuracy.",
            f"Skills covered: {skill_names}." if skill_names else "",
            (
                "You're making excellent progress — keep it up!"
                if correct_count >= questions_answered * 0.7
                else "Keep practicing — every attempt makes you stronger!"
            ),
        ]
        return " ".join(p for p in parts if p)
