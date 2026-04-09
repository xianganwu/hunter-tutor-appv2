"""Tests for adaptive learning algorithms."""
import pytest
from datetime import datetime, timedelta
from app.lib.adaptive import (
    AttemptRecord,
    StudentSkillState,
    SessionPacingState,
    mastery_to_tier,
    adjust_difficulty,
    calculate_mastery_update,
    select_next_skills,
    get_next_pacing_action,
    advance_pacing_after_question,
    advance_pacing_after_teaching,
    create_pacing_state,
    MASTERY_PRIOR,
)


# ─── mastery_to_tier ────────────────────────────────────────────────

def test_mastery_to_tier_zero():
    assert mastery_to_tier(0.0) == 1

def test_mastery_to_tier_low():
    assert mastery_to_tier(0.1) == 1

def test_mastery_to_tier_boundary_2():
    assert mastery_to_tier(0.2) == 2

def test_mastery_to_tier_boundary_4():
    assert mastery_to_tier(0.4) == 3

def test_mastery_to_tier_boundary_6():
    assert mastery_to_tier(0.6) == 4

def test_mastery_to_tier_boundary_8():
    assert mastery_to_tier(0.8) == 5

def test_mastery_to_tier_one():
    assert mastery_to_tier(1.0) == 5


# ─── adjust_difficulty ──────────────────────────────────────────────

def _make_attempts(correct_list: list[bool], hint_list: list[bool] | None = None) -> list[AttemptRecord]:
    if hint_list is None:
        hint_list = [False] * len(correct_list)
    return [
        AttemptRecord(is_correct=c, time_spent_seconds=None, hint_used=h, tier=3)
        for c, h in zip(correct_list, hint_list)
    ]

def test_adjust_difficulty_no_attempts():
    result = adjust_difficulty(0.5, [])
    assert result.mode == "practice"
    assert result.tier == mastery_to_tier(0.5)

def test_adjust_difficulty_3_correct_advances():
    attempts = _make_attempts([True, True, True])
    result = adjust_difficulty(0.5, attempts)  # base tier = 3
    assert result.tier == 4
    assert result.mode == "practice"

def test_adjust_difficulty_2_wrong_drops():
    attempts = _make_attempts([False, False])
    result = adjust_difficulty(0.5, attempts)
    assert result.tier == 2
    assert result.mode == "teach"

def test_adjust_difficulty_mixed_stays():
    attempts = _make_attempts([True, False, True])
    result = adjust_difficulty(0.5, attempts)
    assert result.mode == "practice"
    assert result.tier == mastery_to_tier(0.5)

def test_adjust_difficulty_hint_breaks_streak():
    """Hint-assisted correct answers don't count toward advancement."""
    attempts = _make_attempts([True, True, True], hint_list=[False, True, False])
    result = adjust_difficulty(0.5, attempts)
    # Last 3: True(no-hint), True(hint=broken), True(no-hint)
    # Independent: [F, F, T] — no 3-streak
    assert result.tier == mastery_to_tier(0.5)

def test_adjust_difficulty_cannot_go_below_1():
    attempts = _make_attempts([False, False])
    result = adjust_difficulty(0.05, attempts)  # tier 1
    assert result.tier == 1

def test_adjust_difficulty_cannot_go_above_5():
    attempts = _make_attempts([True, True, True])
    result = adjust_difficulty(0.95, attempts)  # tier 5
    assert result.tier == 5


# ─── calculate_mastery_update ────────────────────────────────────────

def test_mastery_no_attempts_returns_zero():
    result = calculate_mastery_update([], 3)
    assert result.new_mastery_level == 0.0
    assert result.new_confidence_trend == "stable"

def test_mastery_single_correct_conservative():
    """Single correct answer should be conservative (blend with prior)."""
    attempts = _make_attempts([True])
    result = calculate_mastery_update(attempts, 3)
    # Very few attempts → should be conservative, above MASTERY_PRIOR but < 1
    assert MASTERY_PRIOR < result.new_mastery_level < 0.7

def test_mastery_all_correct_high():
    """Many correct answers should produce high mastery."""
    attempts = _make_attempts([True] * 12)
    result = calculate_mastery_update(attempts, 3)
    assert result.new_mastery_level > 0.7

def test_mastery_all_wrong_low():
    """Many wrong answers should produce low mastery."""
    attempts = _make_attempts([False] * 12)
    result = calculate_mastery_update(attempts, 3)
    assert result.new_mastery_level < 0.4

def test_mastery_improving_trend():
    """Recent correct after past wrong → improving trend.
    Need >10 total so recent window (last 10) differs from overall.
    """
    old = _make_attempts([False] * 10)   # first 10: all wrong
    recent = _make_attempts([True] * 10)  # last 10: all correct (these fill the window)
    result = calculate_mastery_update(old + recent, 3)
    assert result.new_confidence_trend == "improving"

def test_mastery_declining_trend():
    """Recent wrong after past correct → declining trend."""
    old = _make_attempts([True] * 10)    # first 10: all correct
    recent = _make_attempts([False] * 10) # last 10: all wrong (fill the window)
    result = calculate_mastery_update(old + recent, 3)
    assert result.new_confidence_trend == "declining"

def test_mastery_clamped_to_0_1():
    """Mastery is always in [0, 1]."""
    extreme_attempts = _make_attempts([True] * 50)
    result = calculate_mastery_update(extreme_attempts, 5)
    assert 0.0 <= result.new_mastery_level <= 1.0

def test_mastery_rounded_to_3_decimals():
    attempts = _make_attempts([True] * 5)
    result = calculate_mastery_update(attempts, 3)
    assert result.new_mastery_level == round(result.new_mastery_level, 3)


# ─── Session pacing ──────────────────────────────────────────────────

def test_pacing_initial_state():
    state = create_pacing_state()
    assert state.questions_in_current_run == 0
    assert state.total_questions == 0

def test_pacing_continue_at_start():
    state = create_pacing_state()
    action = get_next_pacing_action(state)
    assert action.action == "continue_practice"

def test_pacing_insert_teaching_after_5_questions():
    state = create_pacing_state()
    for _ in range(5):
        state = advance_pacing_after_question(state, 30.0)
    action = get_next_pacing_action(state)
    assert action.action == "insert_teaching"

def test_pacing_after_teaching_resets_run():
    state = create_pacing_state()
    for _ in range(5):
        state = advance_pacing_after_question(state, 30.0)
    state = advance_pacing_after_teaching(state)
    assert state.questions_in_current_run == 0
    assert state.total_questions == 5

def test_pacing_end_session_at_15_questions():
    state = create_pacing_state()
    for _ in range(15):
        state = advance_pacing_after_question(state, 60.0)
    action = get_next_pacing_action(state)
    assert action.action == "end_session"

def test_pacing_end_session_at_max_time():
    past = datetime(2026, 1, 1, 0, 0, 0)  # ancient start
    state = SessionPacingState(session_start_time=past)
    action = get_next_pacing_action(state, now=datetime(2026, 1, 1, 1, 0, 0))  # 60 min later
    assert action.action == "end_session"

def test_pacing_slow_down_on_rushing():
    state = create_pacing_state()
    # Answer 3 questions all in under 5 seconds
    for _ in range(3):
        state = advance_pacing_after_question(state, 2.0)
    action = get_next_pacing_action(state)
    assert action.action == "slow_down"


# ─── select_next_skills ──────────────────────────────────────────────

def test_select_next_skills_returns_sorted_by_score():
    """Skills are returned sorted descending by priority score."""
    from app.lib.curriculum import get_skill_ids_for_domain
    skill_ids = get_skill_ids_for_domain("reading_comprehension")
    if not skill_ids:
        pytest.skip("No reading skills found in curriculum")
    result = select_next_skills(skill_ids, {})
    assert len(result) == len(skill_ids)
    # Should be sorted descending
    scores = [r.score for r in result]
    assert scores == sorted(scores, reverse=True)

def test_select_next_skills_new_skill_gets_new_reason():
    skill_ids = ["rc_main_idea"]
    result = select_next_skills(skill_ids, {})
    assert result[0].reason == "new_skill"

def test_select_next_skills_declining_high_priority():
    skill_ids = ["rc_main_idea"]
    states = {
        "rc_main_idea": StudentSkillState(
            skill_id="rc_main_idea",
            mastery_level=0.7,  # above MASTERY_THRESHOLD_LOW so prerequisite_gap doesn't fire
            attempts_count=10,
            correct_count=7,
            last_practiced=None,
            confidence_trend="declining",
        )
    }
    result = select_next_skills(skill_ids, states)
    assert result[0].reason == "declining_confidence"
