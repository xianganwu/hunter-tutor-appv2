"""Tests for SQLAlchemy models and database operations."""
import json
import pytest
from sqlalchemy.orm import Session
from app import models
from app.auth import hash_password


def _create_student(db: Session, suffix: str = "") -> models.Student:
    student = models.Student(
        name=f"Test{suffix}",
        email=f"test{suffix}@models.com",
        password_hash=hash_password("password"),
        mascot_type="penguin",
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def test_create_student(db: Session):
    student = _create_student(db, "1")
    assert student.id is not None
    assert student.name == "Test1"
    assert student.onboarding_complete is False
    assert student.mascot_type == "penguin"


def test_student_cuid_id(db: Session):
    """Student ID is a non-empty string (cuid)."""
    student = _create_student(db, "2")
    assert isinstance(student.id, str)
    assert len(student.id) > 0


def test_student_email_unique(db: Session):
    """Duplicate email raises an error."""
    _create_student(db, "3")
    from sqlalchemy.exc import IntegrityError
    with pytest.raises(IntegrityError):
        _create_student(db, "3")  # same suffix = same email


def test_create_tutoring_session(db: Session):
    student = _create_student(db, "4")
    session = models.TutoringSession(
        student_id=student.id,
        domain="math_achievement",
        skills_covered=json.dumps(["ma_arithmetic"]),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    assert session.id is not None
    assert session.domain == "math_achievement"
    assert session.ended_at is None
    assert session.skills_covered_list == ["ma_arithmetic"]


def test_skills_covered_list_property(db: Session):
    student = _create_student(db, "5")
    session = models.TutoringSession(
        student_id=student.id,
        domain="reading_comprehension",
        skills_covered=json.dumps(["rc_main_idea", "rc_inference"]),
    )
    db.add(session)
    db.commit()
    assert session.skills_covered_list == ["rc_main_idea", "rc_inference"]


def test_create_question_attempt(db: Session):
    student = _create_student(db, "6")
    session = models.TutoringSession(
        student_id=student.id,
        domain="math_achievement",
    )
    db.add(session)
    db.commit()
    attempt = models.QuestionAttempt(
        session_id=session.id,
        skill_id="ma_arithmetic",
        question_text="What is 3 + 4?",
        student_answer="A) 7",
        correct_answer="A) 7",
        is_correct=True,
        time_spent_seconds=12,
        hint_used=False,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    assert attempt.is_correct is True
    assert attempt.time_spent_seconds == 12


def test_create_skill_mastery(db: Session):
    student = _create_student(db, "7")
    mastery = models.SkillMastery(
        student_id=student.id,
        skill_id="ma_arithmetic",
        mastery_level=0.75,
        attempts_count=10,
        correct_count=8,
        confidence_trend="improving",
    )
    db.add(mastery)
    db.commit()
    db.refresh(mastery)
    assert mastery.mastery_level == 0.75
    assert mastery.confidence_trend == "improving"


def test_skill_mastery_unique_constraint(db: Session):
    """Cannot have two mastery records for the same student+skill."""
    student = _create_student(db, "8")
    from sqlalchemy.exc import IntegrityError
    for _ in range(2):
        db.add(models.SkillMastery(
            student_id=student.id,
            skill_id="ma_arithmetic",
            mastery_level=0.5,
        ))
    with pytest.raises(IntegrityError):
        db.commit()


def test_create_user_data(db: Session):
    student = _create_student(db, "9")
    ud = models.UserData(
        student_id=student.id,
        key="skill-mastery",
        value=json.dumps({"rc_main_idea": 0.7}),
    )
    db.add(ud)
    db.commit()
    db.refresh(ud)
    assert ud.key == "skill-mastery"
    assert json.loads(ud.value)["rc_main_idea"] == 0.7


def test_user_data_unique_constraint(db: Session):
    """Cannot have two UserData rows with same student+key."""
    student = _create_student(db, "10")
    from sqlalchemy.exc import IntegrityError
    for _ in range(2):
        db.add(models.UserData(
            student_id=student.id,
            key="skill-mastery",
            value="{}",
        ))
    with pytest.raises(IntegrityError):
        db.commit()


def test_cascade_delete_student_deletes_sessions(db: Session):
    """Deleting a student cascades to sessions (via user_data cascade)."""
    student = _create_student(db, "11")
    ud = models.UserData(
        student_id=student.id,
        key="skill-mastery",
        value="{}",
    )
    db.add(ud)
    db.commit()
    db.delete(student)
    db.commit()
    remaining = db.query(models.UserData).filter(models.UserData.student_id == student.id).count()
    assert remaining == 0


def test_writing_submission_creation(db: Session):
    student = _create_student(db, "12")
    session = models.TutoringSession(
        student_id=student.id,
        domain="math_achievement",
    )
    db.add(session)
    db.commit()
    submission = models.WritingSubmission(
        session_id=session.id,
        prompt="Tell me about a challenge you overcame.",
        essay_text="Once upon a time...",
        scores_json=json.dumps({"organization": 8, "mechanics": 7}),
        revision_number=0,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    assert submission.revision_number == 0
    assert json.loads(submission.scores_json)["organization"] == 8


def test_question_cache_creation(db: Session):
    cache = models.QuestionCache(
        skill_id="ma_arithmetic",
        difficulty_tier=2,
        question_text="What is 12 × 7?",
        answer_choices=json.dumps(["A) 74", "B) 84", "C) 94", "D) 82", "E) 72"]),
        correct_answer="B) 84",
    )
    db.add(cache)
    db.commit()
    db.refresh(cache)
    assert cache.answer_choices_list[1] == "B) 84"
    assert cache.used is False
