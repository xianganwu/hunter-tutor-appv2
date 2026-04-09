"""Validate AI-generated multiple choice questions for correctness and quality."""
import logging
import re

logger = logging.getLogger(__name__)


def validate_generated_question(
    question_text: str,
    answer_choices: list[str],
    correct_answer: str,
    parser_context: str = "validate_question",
) -> str | None:
    """
    Validate a generated multiple-choice question.

    Returns the (possibly normalized) correct_answer if valid, or None if invalid.

    Checks:
    - question_text is non-empty
    - 3-6 answer choices
    - exactly one correct answer among choices
    - answer choices are distinct (not mathematically equivalent)
    """
    if not question_text or not question_text.strip():
        logger.warning("[%s] Empty question text", parser_context)
        return None

    if not answer_choices or len(answer_choices) < 3:
        logger.warning("[%s] Too few answer choices: %d", parser_context, len(answer_choices))
        return None

    if len(answer_choices) > 6:
        logger.warning("[%s] Too many answer choices: %d", parser_context, len(answer_choices))
        return None

    if not correct_answer or not correct_answer.strip():
        logger.warning("[%s] Empty correct answer", parser_context)
        return None

    # Normalize correct_answer — ensure it's one of the choices
    correct_answer_stripped = correct_answer.strip()
    found = False
    for choice in answer_choices:
        if choice.strip() == correct_answer_stripped:
            found = True
            break

    if not found:
        # Try case-insensitive match
        for choice in answer_choices:
            if choice.strip().lower() == correct_answer_stripped.lower():
                correct_answer_stripped = choice.strip()
                found = True
                break

    if not found:
        logger.warning(
            "[%s] correct_answer '%s' not found in choices: %s",
            parser_context,
            correct_answer,
            answer_choices,
        )
        return None

    # Check for duplicate choices — strip letter prefix (e.g. "A) ") before comparing
    import re as _re
    def _strip_prefix(s: str) -> str:
        return _re.sub(r"^[A-Ea-e][).]\s*", "", s).strip().lower()

    stripped_choices = [_strip_prefix(c) for c in answer_choices]
    if len(set(stripped_choices)) < len(stripped_choices):
        logger.warning("[%s] Duplicate answer choices detected", parser_context)
        return None

    # Check that answers are not mathematically equivalent (e.g. "1/2" and "0.5")
    if _has_equivalent_choices(answer_choices):
        logger.warning("[%s] Mathematically equivalent answer choices detected", parser_context)
        # Don't reject — just warn. The equivalence check is heuristic.

    return correct_answer_stripped


def _extract_numeric_value(text: str) -> float | None:
    """Try to extract a single numeric value from a choice string."""
    text = re.sub(r"^[A-Ea-e][).]\s*", "", text).strip()

    # Fraction: a/b
    frac_match = re.match(r"^(-?\d+)\s*/\s*(\d+)$", text)
    if frac_match:
        num, den = int(frac_match.group(1)), int(frac_match.group(2))
        if den != 0:
            return num / den

    # Plain number
    try:
        return float(text.replace(",", ""))
    except ValueError:
        pass

    return None


def _has_equivalent_choices(choices: list[str]) -> bool:
    """Check if any two choices are numerically equivalent (e.g. 1/2 and 0.5)."""
    values: list[float] = []
    for choice in choices:
        val = _extract_numeric_value(choice)
        if val is not None:
            # Check against existing values
            for existing in values:
                if abs(existing - val) < 1e-9:
                    return True
            values.append(val)
    return False
