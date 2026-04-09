"""Tests for the question validation module."""
import pytest
from app.lib.ai.validate_question import validate_generated_question, _has_equivalent_choices


def _choices():
    return ["A) 12", "B) 24", "C) 36", "D) 48", "E) 60"]


def test_valid_question_passes():
    result = validate_generated_question(
        "What is 4 × 6?",
        _choices(),
        "A) 12",
    )
    assert result == "A) 12"


def test_case_insensitive_match():
    """Correct answer matched case-insensitively."""
    result = validate_generated_question(
        "What is 4 × 6?",
        _choices(),
        "a) 12",
    )
    assert result == "A) 12"


def test_empty_question_returns_none():
    result = validate_generated_question("", _choices(), "A) 12")
    assert result is None


def test_empty_correct_answer_returns_none():
    result = validate_generated_question("What is 4 × 6?", _choices(), "")
    assert result is None


def test_too_few_choices_returns_none():
    result = validate_generated_question(
        "What is 4 × 6?",
        ["A) 12", "B) 24"],  # only 2
        "A) 12",
    )
    assert result is None


def test_too_many_choices_returns_none():
    result = validate_generated_question(
        "What is 4 × 6?",
        ["A) 12", "B) 24", "C) 36", "D) 48", "E) 60", "F) 72", "G) 84"],
        "A) 12",
    )
    assert result is None


def test_correct_answer_not_in_choices_returns_none():
    result = validate_generated_question(
        "What is 4 × 6?",
        _choices(),
        "C) 99",  # 99 not in choices
    )
    assert result is None


def test_duplicate_choices_returns_none():
    result = validate_generated_question(
        "What is 4 × 6?",
        ["A) 12", "B) 12", "C) 36", "D) 48", "E) 60"],  # A and B identical
        "A) 12",
    )
    assert result is None


def test_has_equivalent_choices_fraction_and_decimal():
    """0.5 and 1/2 are mathematically equivalent."""
    assert _has_equivalent_choices(["A) 0.5", "B) 1/2", "C) 0.75", "D) 0.25", "E) 1"]) is True


def test_has_equivalent_choices_all_distinct():
    assert _has_equivalent_choices(["A) 12", "B) 24", "C) 36", "D) 48", "E) 60"]) is False


def test_has_equivalent_choices_ignores_text():
    """Text-only choices don't trigger false positives."""
    choices = ["A) Roosevelt High", "B) Lincoln Middle", "C) Washington Elementary", "D) Jefferson Academy", "E) Adams School"]
    assert _has_equivalent_choices(choices) is False


def test_validate_returns_correct_normalized_choice():
    """Returns the exact choice string from the choices list."""
    choices = ["A) apple", "B) banana", "C) cherry", "D) date", "E) elderberry"]
    result = validate_generated_question(
        "What fruit starts with B?",
        choices,
        "B) banana",
    )
    assert result == "B) banana"


def test_minimum_3_choices_accepted():
    result = validate_generated_question(
        "True or false equivalent?",
        ["A) Yes", "B) No", "C) Maybe"],
        "A) Yes",
    )
    assert result == "A) Yes"
