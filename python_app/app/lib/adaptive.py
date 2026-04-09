"""
Adaptive learning engine — ported from TypeScript src/lib/adaptive.ts.

Handles:
1. Skill selection and priority scoring
2. Difficulty adjustment (tier up/down based on streaks)
3. Session pacing (when to teach, end, slow down)
4. Mastery calculation (weighted rolling accuracy + time efficiency)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Literal, Optional
from app.lib.curriculum import get_all_skills

# ─── Types ────────────────────────────────────────────────────────────

ConfidenceTrend = Literal["improving", "stable", "declining"]
SessionMode = Literal["teach", "practice"]
DifficultyLevel = Literal[1, 2, 3, 4, 5]
SkillPriorityReason = Literal[
    "prerequisite_gap", "declining_confidence", "stale",
    "near_mastery", "low_mastery", "new_skill"
]
PacingActionType = Literal["continue_practice", "insert_teaching", "end_session", "slow_down"]


@dataclass(frozen=True)
class StudentSkillState:
    skill_id: str
    mastery_level: float  # 0.0 - 1.0
    attempts_count: int
    correct_count: int
    last_practiced: Optional[datetime]
    confidence_trend: ConfidenceTrend


@dataclass(frozen=True)
class AttemptRecord:
    is_correct: bool
    time_spent_seconds: Optional[float]
    hint_used: bool
    tier: int  # 1-5


@dataclass(frozen=True)
class SkillPriority:
    skill_id: str
    score: float
    reason: SkillPriorityReason


@dataclass(frozen=True)
class DifficultyDecision:
    tier: int  # 1-5
    mode: SessionMode


@dataclass
class SessionPacingState:
    questions_in_current_run: int = 0
    total_questions: int = 0
    session_start_time: datetime = field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))
    last_teaching_moment: int = 0
    recent_answer_times_seconds: list[float] = field(default_factory=list)


@dataclass(frozen=True)
class PacingAction:
    action: PacingActionType
    reason: str


@dataclass(frozen=True)
class MasteryUpdate:
    new_mastery_level: float
    new_confidence_trend: ConfidenceTrend


# ─── Tier Labels ─────────────────────────────────────────────────────

MASTERY_TIER_LABELS: dict[int, str] = {
    1: "Getting Started",
    2: "Building Up",
    3: "In Progress",
    4: "Almost There",
    5: "Mastered",
}


def tier_label(tier: int) -> str:
    return MASTERY_TIER_LABELS.get(tier, "Unknown")


# ─── Constants ────────────────────────────────────────────────────────

MASTERY_THRESHOLD_LOW = 0.6
MASTERY_NEAR_LOW = 0.7
MASTERY_NEAR_HIGH = 0.85
STALE_DAYS = 7
STREAK_TO_ADVANCE = 3
STREAK_TO_DROP = 2
MAX_QUESTIONS_BEFORE_TEACHING = 5
SESSION_MIN_MINUTES = 25
SESSION_MAX_MINUTES = 35
RECENT_WINDOW = 10
SESSION_MAX_QUESTIONS = 15
RUSHING_THRESHOLD_SECONDS = 5
RUSHING_STREAK = 3

WEIGHT_RECENT = 0.7
WEIGHT_OVERALL = 0.2
WEIGHT_TIME = 0.1

MIN_ATTEMPTS_FOR_CONFIDENCE = 8
MASTERY_PRIOR = 0.3

TIER_ACCURACY_WEIGHT: dict[int, float] = {
    1: 0.4,
    2: 0.6,
    3: 0.8,
    4: 1.0,
    5: 1.2,
}

PRIORITY_PREREQUISITE_GAP = 100
PRIORITY_DECLINING = 80
PRIORITY_STALE = 40
PRIORITY_STALE_CAP = 2
PRIORITY_NEAR_MASTERY = 50
PRIORITY_LOW_MASTERY = 65
PRIORITY_NEW_SKILL = 35

EXPECTED_SECONDS_BY_TIER: dict[int, float] = {
    1: 30,
    2: 45,
    3: 60,
    4: 90,
    5: 120,
}


# ─── 1. Skill Selection ──────────────────────────────────────────────

def _build_dependents_map(skills: dict[str, dict]) -> dict[str, list[str]]:
    """Build reverse dependency map: prereq_id -> [skill_ids that depend on it]."""
    dependents: dict[str, list[str]] = {}
    for skill_id, skill in skills.items():
        for prereq_id in skill.get("prerequisite_skills", []):
            dependents.setdefault(prereq_id, []).append(skill_id)
    return dependents


def _score_skill(
    skill_id: str,
    state: Optional[StudentSkillState],
    dependents: dict[str, list[str]],
    now: datetime,
) -> SkillPriority:
    """Compute priority score for a single skill."""
    if state is None or (state.attempts_count == 0 and state.mastery_level == 0):
        return SkillPriority(skill_id=skill_id, score=PRIORITY_NEW_SKILL, reason="new_skill")

    best_score: float = 0.0
    best_reason: SkillPriorityReason = "low_mastery"

    # Prerequisite gap
    dep_count = len(dependents.get(skill_id, []))
    if state.mastery_level < MASTERY_THRESHOLD_LOW and dep_count > 0:
        score = PRIORITY_PREREQUISITE_GAP + dep_count * 5
        if score > best_score:
            best_score = score
            best_reason = "prerequisite_gap"

    # Declining confidence
    if state.confidence_trend == "declining":
        score = PRIORITY_DECLINING + (1 - state.mastery_level) * 20
        if score > best_score:
            best_score = score
            best_reason = "declining_confidence"

    # Stale
    if state.last_practiced:
        lp = state.last_practiced
        if lp.tzinfo is None:
            lp = lp.replace(tzinfo=None)
        now_naive = now.replace(tzinfo=None) if now.tzinfo else now
        days_since = (now_naive - lp).days
        if days_since >= STALE_DAYS:
            staleness = min(days_since / STALE_DAYS, PRIORITY_STALE_CAP)
            mastery_damper = (
                1 - (state.mastery_level - MASTERY_NEAR_HIGH) / (1 - MASTERY_NEAR_HIGH)
                if state.mastery_level >= MASTERY_NEAR_HIGH
                else 1.0
            )
            score = PRIORITY_STALE * staleness * mastery_damper
            if score > best_score:
                best_score = score
                best_reason = "stale"

    # Near mastery
    if MASTERY_NEAR_LOW <= state.mastery_level <= MASTERY_NEAR_HIGH:
        score = PRIORITY_NEAR_MASTERY + (MASTERY_NEAR_HIGH - state.mastery_level) * 50
        if score > best_score:
            best_score = score
            best_reason = "near_mastery"

    # General low mastery
    if state.mastery_level < MASTERY_THRESHOLD_LOW and best_score == 0:
        score = PRIORITY_LOW_MASTERY + (1 - state.mastery_level) * 30
        if score > best_score:
            best_score = score
            best_reason = "low_mastery"

    return SkillPriority(skill_id=skill_id, score=best_score, reason=best_reason)


def select_next_skills(
    domain_skill_ids: list[str],
    student_states: dict[str, StudentSkillState],
    now: Optional[datetime] = None,
) -> list[SkillPriority]:
    """Return priority-sorted skills (highest first) for the given domain."""
    if now is None:
        now = datetime.now(UTC).replace(tzinfo=None)
    all_skills = get_all_skills()
    dependents = _build_dependents_map(all_skills)
    priorities = [
        _score_skill(skill_id, student_states.get(skill_id), dependents, now)
        for skill_id in domain_skill_ids
    ]
    return sorted(priorities, key=lambda p: p.score, reverse=True)


# ─── 2. Difficulty Adjustment ────────────────────────────────────────

def mastery_to_tier(mastery: float) -> int:
    """Map mastery level [0,1] to difficulty tier [1,5]."""
    if mastery < 0.2:
        return 1
    if mastery < 0.4:
        return 2
    if mastery < 0.6:
        return 3
    if mastery < 0.8:
        return 4
    return 5


def _count_tail_streak(attempts: list[AttemptRecord], match_correct: bool) -> int:
    """Count consecutive matching results from the end of the list."""
    count = 0
    for attempt in reversed(attempts):
        if attempt.is_correct == match_correct:
            count += 1
        else:
            break
    return count


def adjust_difficulty(
    current_mastery: float,
    recent_attempts: list[AttemptRecord],
) -> DifficultyDecision:
    """Determine tier and mode based on recent attempt streak."""
    base_tier = mastery_to_tier(current_mastery)

    if not recent_attempts:
        return DifficultyDecision(tier=base_tier, mode="practice")

    # For advancement: hint-assisted correct don't count
    independent_attempts = [
        AttemptRecord(
            is_correct=a.is_correct and not a.hint_used,
            time_spent_seconds=a.time_spent_seconds,
            hint_used=a.hint_used,
            tier=a.tier,
        )
        for a in recent_attempts
    ]

    tail_correct_streak = _count_tail_streak(independent_attempts, True)
    tail_wrong_streak = _count_tail_streak(recent_attempts, False)

    if tail_wrong_streak >= STREAK_TO_DROP:
        dropped_tier = max(1, base_tier - 1)
        return DifficultyDecision(tier=dropped_tier, mode="teach")

    if tail_correct_streak >= STREAK_TO_ADVANCE:
        advanced_tier = min(5, base_tier + 1)
        return DifficultyDecision(tier=advanced_tier, mode="practice")

    return DifficultyDecision(tier=base_tier, mode="practice")


# ─── 3. Session Pacing ───────────────────────────────────────────────

def create_pacing_state(start_time: Optional[datetime] = None) -> SessionPacingState:
    """Create initial pacing state."""
    if start_time is None:
        start_time = datetime.now(UTC).replace(tzinfo=None)
    return SessionPacingState(session_start_time=start_time)


def get_next_pacing_action(
    state: SessionPacingState,
    now: Optional[datetime] = None,
) -> PacingAction:
    """Determine the next pacing action."""
    if now is None:
        now = datetime.now(UTC).replace(tzinfo=None)

    start = state.session_start_time
    if start.tzinfo:
        start = start.replace(tzinfo=None)
    now_naive = now.replace(tzinfo=None) if now.tzinfo else now

    elapsed_minutes = (now_naive - start).total_seconds() / 60

    # Detect rushing
    recent_times = state.recent_answer_times_seconds[-RUSHING_STREAK:]
    if len(recent_times) >= RUSHING_STREAK and all(t < RUSHING_THRESHOLD_SECONDS for t in recent_times):
        return PacingAction(
            action="slow_down",
            reason=(
                "You're moving really fast! Take a moment to read each question "
                "carefully before answering — accuracy matters more than speed."
            ),
        )

    if elapsed_minutes >= SESSION_MAX_MINUTES:
        return PacingAction(
            action="end_session",
            reason=f"Session reached {SESSION_MAX_MINUTES} minutes — time for a break.",
        )

    if state.total_questions >= SESSION_MAX_QUESTIONS:
        return PacingAction(
            action="end_session",
            reason="Great effort! You've answered a lot of questions — let's wrap up and see how you did.",
        )

    if elapsed_minutes >= SESSION_MIN_MINUTES and state.questions_in_current_run >= 3:
        return PacingAction(
            action="end_session",
            reason="Great work! We've been at it for a while — let's wrap up with a summary.",
        )

    if state.questions_in_current_run >= MAX_QUESTIONS_BEFORE_TEACHING:
        return PacingAction(
            action="insert_teaching",
            reason="Time for a quick review! Let's make sure we understand the concepts before more practice.",
        )

    return PacingAction(action="continue_practice", reason="")


def advance_pacing_after_question(
    state: SessionPacingState,
    answer_time_seconds: Optional[float] = None,
) -> SessionPacingState:
    """Return new state after a practice question."""
    new_times = list(state.recent_answer_times_seconds)
    if answer_time_seconds is not None:
        new_times.append(answer_time_seconds)
    return SessionPacingState(
        questions_in_current_run=state.questions_in_current_run + 1,
        total_questions=state.total_questions + 1,
        session_start_time=state.session_start_time,
        last_teaching_moment=state.last_teaching_moment,
        recent_answer_times_seconds=new_times,
    )


def advance_pacing_after_teaching(state: SessionPacingState) -> SessionPacingState:
    """Reset question run counter after a teaching moment."""
    return SessionPacingState(
        questions_in_current_run=0,
        total_questions=state.total_questions,
        session_start_time=state.session_start_time,
        last_teaching_moment=state.total_questions,
        recent_answer_times_seconds=state.recent_answer_times_seconds,
    )


# ─── 4. Mastery Update ───────────────────────────────────────────────

def _compute_time_efficiency(attempts: list[AttemptRecord], tier: int) -> float:
    """Compute time efficiency score [0,1]."""
    expected = EXPECTED_SECONDS_BY_TIER.get(tier, 60)
    valid = [a for a in attempts if a.time_spent_seconds is not None and a.is_correct]
    if not valid:
        return 0.5  # neutral default

    total = sum(min(expected / max(a.time_spent_seconds, 1), 1.0) for a in valid)
    return total / len(valid)


def _rolling_accuracy(attempts: list[AttemptRecord], window: int) -> float:
    """Compute difficulty-weighted rolling accuracy over last `window` attempts."""
    if not attempts:
        return 0.0
    recent = attempts[-window:]
    earned = 0.0
    max_possible = 0.0
    for a in recent:
        w = TIER_ACCURACY_WEIGHT.get(a.tier, 0.8)
        max_possible += w
        if a.is_correct:
            earned += w * 0.5 if a.hint_used else w
    return earned / max_possible if max_possible > 0 else 0.0


def _compute_trend(recent_acc: float, overall_acc: float) -> ConfidenceTrend:
    delta = recent_acc - overall_acc
    if delta > 0.1:
        return "improving"
    if delta < -0.1:
        return "declining"
    return "stable"


def calculate_mastery_update(
    all_attempts: list[AttemptRecord],
    current_tier: int,
    weight_recent: float = WEIGHT_RECENT,
    weight_overall: float = WEIGHT_OVERALL,
    weight_time: float = WEIGHT_TIME,
) -> MasteryUpdate:
    """
    Calculate new mastery level and confidence trend.

    Formula:
        raw = 0.7 * weighted_rolling_accuracy_last_10
            + 0.2 * weighted_overall_accuracy
            + 0.1 * time_efficiency_score

        confidence = min(1, total_attempts / MIN_ATTEMPTS_FOR_CONFIDENCE)
        mastery = confidence * raw + (1 - confidence) * MASTERY_PRIOR
    """
    if not all_attempts:
        return MasteryUpdate(new_mastery_level=0.0, new_confidence_trend="stable")

    recent_acc = _rolling_accuracy(all_attempts, RECENT_WINDOW)
    overall_acc = _rolling_accuracy(all_attempts, len(all_attempts))
    time_eff = _compute_time_efficiency(all_attempts[-RECENT_WINDOW:], current_tier)

    raw = weight_recent * recent_acc + weight_overall * overall_acc + weight_time * time_eff

    confidence = min(1.0, len(all_attempts) / MIN_ATTEMPTS_FOR_CONFIDENCE)
    blended = confidence * raw + (1 - confidence) * MASTERY_PRIOR

    new_mastery = max(0.0, min(1.0, blended))
    new_mastery = round(new_mastery, 3)
    trend = _compute_trend(recent_acc, overall_acc)

    return MasteryUpdate(new_mastery_level=new_mastery, new_confidence_trend=trend)
