import json
from datetime import datetime, UTC
from typing import Optional
from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, UniqueConstraint, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from cuid2 import Cuid as _Cuid
from app.database import Base

_cuid_generator = _Cuid()

def new_cuid() -> str:
    return _cuid_generator.generate()

def now_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_cuid)
    name: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    parent_pin_hash: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    mascot_type: Mapped[str] = mapped_column(String(20), default="penguin")
    mascot_name: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    current_session_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    skill_masteries: Mapped[list["SkillMastery"]] = relationship("SkillMastery", back_populates="student", cascade="all, delete-orphan")
    tutoring_sessions: Mapped[list["TutoringSession"]] = relationship("TutoringSession", back_populates="student", cascade="all, delete-orphan")
    user_data: Mapped[list["UserData"]] = relationship("UserData", back_populates="student", cascade="all, delete-orphan")

class UserData(Base):
    __tablename__ = "user_data"
    __table_args__ = (
        UniqueConstraint("student_id", "key", name="uq_userdata_student_key"),
        Index("ix_userdata_student_id", "student_id"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_cuid)
    student_id: Mapped[str] = mapped_column(String(32), ForeignKey("students.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(Text)  # JSON blob
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    student: Mapped["Student"] = relationship("Student", back_populates="user_data")

class SkillMastery(Base):
    __tablename__ = "skill_masteries"
    __table_args__ = (
        UniqueConstraint("student_id", "skill_id", name="uq_skillmastery_student_skill"),
        Index("ix_skillmastery_student_id", "student_id"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_cuid)
    student_id: Mapped[str] = mapped_column(String(32), ForeignKey("students.id"))
    skill_id: Mapped[str] = mapped_column(String(100))
    mastery_level: Mapped[float] = mapped_column(Float, default=0.0)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    last_practiced: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    confidence_trend: Mapped[str] = mapped_column(String(20), default="stable")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    student: Mapped["Student"] = relationship("Student", back_populates="skill_masteries")

class TutoringSession(Base):
    __tablename__ = "tutoring_sessions"
    __table_args__ = (Index("ix_tutoringsession_student_id", "student_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_cuid)
    student_id: Mapped[str] = mapped_column(String(32), ForeignKey("students.id"))
    domain: Mapped[str] = mapped_column(String(100))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    skills_covered: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    session_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    student: Mapped["Student"] = relationship("Student", back_populates="tutoring_sessions")
    question_attempts: Mapped[list["QuestionAttempt"]] = relationship("QuestionAttempt", back_populates="session", cascade="all, delete-orphan")
    writing_submissions: Mapped[list["WritingSubmission"]] = relationship("WritingSubmission", back_populates="session", cascade="all, delete-orphan")

    @property
    def skills_covered_list(self) -> list:
        try:
            return json.loads(self.skills_covered)
        except Exception:
            return []

class QuestionAttempt(Base):
    __tablename__ = "question_attempts"
    __table_args__ = (
        Index("ix_questionattempt_session_id", "session_id"),
        Index("ix_questionattempt_skill_id", "skill_id"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_cuid)
    session_id: Mapped[str] = mapped_column(String(32), ForeignKey("tutoring_sessions.id"))
    skill_id: Mapped[str] = mapped_column(String(100))
    question_text: Mapped[str] = mapped_column(Text)
    student_answer: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    time_spent_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hint_used: Mapped[bool] = mapped_column(Boolean, default=False)
    explanation_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    session: Mapped["TutoringSession"] = relationship("TutoringSession", back_populates="question_attempts")

class WritingSubmission(Base):
    __tablename__ = "writing_submissions"
    __table_args__ = (Index("ix_writingsubmission_session_id", "session_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_cuid)
    session_id: Mapped[str] = mapped_column(String(32), ForeignKey("tutoring_sessions.id"))
    prompt: Mapped[str] = mapped_column(Text)
    essay_text: Mapped[str] = mapped_column(Text)
    ai_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    scores_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    revision_of: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    revision_number: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    session: Mapped["TutoringSession"] = relationship("TutoringSession", back_populates="writing_submissions")

class QuestionCache(Base):
    __tablename__ = "question_cache"
    __table_args__ = (Index("ix_questioncache_skill_tier_used", "skill_id", "difficulty_tier", "used"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_cuid)
    skill_id: Mapped[str] = mapped_column(String(100))
    difficulty_tier: Mapped[int] = mapped_column(Integer)
    question_text: Mapped[str] = mapped_column(Text)
    answer_choices: Mapped[str] = mapped_column(Text)  # JSON array
    correct_answer: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text, default="")
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    @property
    def answer_choices_list(self) -> list:
        try:
            return json.loads(self.answer_choices)
        except Exception:
            return []
