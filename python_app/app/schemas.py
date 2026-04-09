from __future__ import annotations
from typing import Optional, Any, Literal, Union
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

# ─── Auth schemas ─────────────────────────────────────────────────────

class StudentOut(BaseModel):
    id: str
    name: str
    email: str
    mascot_type: str
    mascot_name: Optional[str]
    onboarding_complete: bool

    class Config:
        from_attributes = True

class SignupRequest(BaseModel):
    action: Literal["signup"]
    name: str = Field(..., min_length=1, max_length=20)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    parent_pin: Optional[str] = None
    mascot_type: Literal["penguin", "monkey", "phoenix", "dragon"] = "penguin"

    @field_validator("parent_pin")
    @classmethod
    def validate_parent_pin(cls, v):
        if v is not None and not re.match(r"^\d{4,6}$", v):
            raise ValueError("parentPin must be 4-6 digits")
        return v

class LoginRequest(BaseModel):
    action: Literal["login"]
    email: EmailStr
    password: str = Field(..., min_length=1)

class LogoutRequest(BaseModel):
    action: Literal["logout"]

class SetPinRequest(BaseModel):
    action: Literal["set_pin"]
    parent_pin: str

    @field_validator("parent_pin")
    @classmethod
    def validate_pin(cls, v):
        if not re.match(r"^\d{4,6}$", v):
            raise ValueError("parentPin must be 4-6 digits")
        return v

class ResetPasswordRequest(BaseModel):
    action: Literal["reset_password"]
    email: EmailStr
    parent_pin: str
    new_password: str = Field(..., min_length=6, max_length=100)

class CompleteOnboardingRequest(BaseModel):
    action: Literal["complete_onboarding"]

class UpdateMascotRequest(BaseModel):
    action: Literal["update_mascot"]
    mascot_type: Literal["penguin", "monkey", "phoenix", "dragon"]

class UpdateMascotNameRequest(BaseModel):
    action: Literal["update_mascot_name"]
    mascot_name: str = Field(..., min_length=1, max_length=20)

    @field_validator("mascot_name")
    @classmethod
    def validate_name(cls, v):
        if not re.match(r"^[a-zA-Z0-9 ]+$", v):
            raise ValueError("mascot_name must be alphanumeric")
        return v

AuthRequest = Union[
    SignupRequest, LoginRequest, LogoutRequest, SetPinRequest,
    ResetPasswordRequest, CompleteOnboardingRequest, UpdateMascotRequest, UpdateMascotNameRequest
]

# ─── Chat schemas ─────────────────────────────────────────────────────

DifficultyLevel = Literal[1, 2, 3, 4, 5]

class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class TeachAction(BaseModel):
    type: Literal["teach"]
    skill_id: str = Field(..., min_length=1)
    mastery: float = Field(..., ge=0, le=1)
    stream: bool = False

class GenerateQuestionAction(BaseModel):
    type: Literal["generate_question"]
    skill_id: str = Field(..., min_length=1)
    difficulty_tier: int = Field(..., ge=1, le=5)
    recent_questions: list[str] = Field(default_factory=list, max_length=20)
    stream: bool = False

class EvaluateAnswerAction(BaseModel):
    type: Literal["evaluate_answer"]
    question_text: str = Field(..., min_length=1)
    student_answer: str
    correct_answer: str = Field(..., min_length=1)
    history: list[ConversationMessage] = Field(default_factory=list)
    evaluation_mode: Literal["chat", "study"] = "chat"
    session_id: Optional[str] = None
    skill_id: Optional[str] = None
    time_spent_seconds: Optional[float] = None
    hint_used: bool = False
    stream: bool = False

class GetHintAction(BaseModel):
    type: Literal["get_hint"]
    context: str = Field(..., min_length=1)
    history: list[ConversationMessage] = Field(default_factory=list)
    stream: bool = False

class ExplainMoreAction(BaseModel):
    type: Literal["explain_more"]
    skill_id: str = Field(..., min_length=1)
    mastery: float = Field(..., ge=0, le=1)
    context: str = ""
    stream: bool = False

class GetSummaryAction(BaseModel):
    type: Literal["get_summary"]
    questions_answered: int = Field(..., ge=0)
    correct_count: int = Field(..., ge=0)
    skills_covered: list[str] = Field(default_factory=list)
    elapsed_minutes: float = Field(..., ge=0)
    stream: bool = False

class EvaluateTeachBackAction(BaseModel):
    type: Literal["evaluate_teach_back"]
    skill_id: str = Field(..., min_length=1)
    skill_name: str = Field(..., min_length=1)
    student_explanation: str = Field(..., min_length=1)
    stream: bool = False

class EmotionalResponseAction(BaseModel):
    type: Literal["emotional_response"]
    message: str = Field(..., min_length=1)
    history: list[ConversationMessage] = Field(default_factory=list)
    stream: bool = False

class GenerateDrillBatchAction(BaseModel):
    type: Literal["generate_drill_batch"]
    skill_id: str = Field(..., min_length=1)
    count: int = Field(default=10, ge=1, le=20)
    difficulty_tier: Optional[int] = Field(default=None, ge=1, le=5)
    recent_questions: list[str] = Field(default_factory=list, max_length=20)
    stream: bool = False

class SkillTierPair(BaseModel):
    skill_id: str = Field(..., min_length=1)
    tier: int = Field(..., ge=1, le=5)

class GenerateMixedDrillBatchAction(BaseModel):
    type: Literal["generate_mixed_drill_batch"]
    skills: list[SkillTierPair] = Field(..., min_length=1, max_length=20)
    total_count: int = Field(..., ge=1, le=50)
    recent_questions: list[str] = Field(default_factory=list, max_length=20)
    stream: bool = False

class GenerateDiagnosticAction(BaseModel):
    type: Literal["generate_diagnostic"]
    domain: str = Field(..., min_length=1)
    skill_ids: list[str] = Field(..., min_length=1, max_length=30)
    stream: bool = False

# ─── Session schemas ──────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    action: Literal["create"]
    domain: str = Field(..., min_length=1)
    skills_covered: list[str] = Field(default_factory=list)

class EndSessionRequest(BaseModel):
    action: Literal["end"]
    session_id: str = Field(..., min_length=1)
    summary: Optional[str] = None
    skills_covered: Optional[list[str]] = None

# ─── Progress schemas ─────────────────────────────────────────────────

class ProgressSyncRequest(BaseModel):
    progress: dict[str, Any]
    timestamps: Optional[dict[str, str]] = None

# ─── Writing schemas ──────────────────────────────────────────────────

class WritingRequest(BaseModel):
    type: Literal["brainstorm", "evaluate_essay", "evaluate_revision", "rewrite_feedback"]
    prompt: Optional[str] = None
    essay_text: Optional[str] = None
    session_id: Optional[str] = None
    original_submission_id: Optional[str] = None
    feedback: Optional[str] = None

# ─── Mistakes schemas ─────────────────────────────────────────────────

class MistakesRequest(BaseModel):
    type: Literal["diagnose", "analyze_patterns"]
    skill_id: Optional[str] = None
    question_text: Optional[str] = None
    student_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    mistakes: Optional[list[dict]] = None

# ─── Vocab schemas ────────────────────────────────────────────────────

class VocabRequest(BaseModel):
    type: Literal["generate_context", "evaluate_usage", "extract_vocab"]
    word: Optional[str] = None
    sentence: Optional[str] = None
    passage: Optional[str] = None

# ─── Reading schemas ──────────────────────────────────────────────────

class ReadingRequest(BaseModel):
    type: Literal["generate_passage", "speed_feedback"]
    grade_level: Optional[Literal["foundations", "hunter_prep"]] = "foundations"
    topic: Optional[str] = None
    words_per_minute: Optional[float] = None
    target_wpm: Optional[float] = None

# ─── Simulation schemas ───────────────────────────────────────────────

class SimulationRequest(BaseModel):
    type: Literal["generate_math_questions", "evaluate_essay", "generate_recommendations"]
    skill_ids: Optional[list[str]] = None
    count: Optional[int] = Field(default=10, ge=1, le=30)
    prompt: Optional[str] = None
    essay_text: Optional[str] = None
    scores: Optional[dict] = None
    weak_skills: Optional[list[str]] = None

# ─── Parent schemas ───────────────────────────────────────────────────

class ParentRequest(BaseModel):
    type: Literal["verify_pin", "get_assessment", "generate_weekly_digest", "generate_narrative"]
    parent_pin: Optional[str] = None
    student_id: Optional[str] = None
    skill_data: Optional[dict] = None
    session_data: Optional[list[dict]] = None
