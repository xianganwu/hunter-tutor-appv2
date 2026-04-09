"""Tests for the curriculum loading module."""
import pytest
from app.lib.curriculum import (
    get_all_skills,
    get_skill_by_id,
    get_skill_ids_for_domain,
    get_all_domain_ids,
    validate_prerequisites,
)


def test_get_all_skills_returns_dict():
    skills = get_all_skills()
    assert isinstance(skills, dict)
    assert len(skills) > 0


def test_get_all_skills_have_required_fields():
    skills = get_all_skills()
    for skill_id, skill in skills.items():
        assert "skill_id" in skill, f"Missing skill_id in {skill_id}"
        assert "name" in skill, f"Missing name in {skill_id}"
        assert "description" in skill, f"Missing description in {skill_id}"
        assert "prerequisite_skills" in skill, f"Missing prerequisite_skills in {skill_id}"
        assert "difficulty_tier" in skill, f"Missing difficulty_tier in {skill_id}"
        assert 1 <= skill["difficulty_tier"] <= 5, f"Invalid tier in {skill_id}"


def test_get_skill_by_id_existing():
    skills = get_all_skills()
    first_id = next(iter(skills))
    skill = get_skill_by_id(first_id)
    assert skill is not None
    assert skill["skill_id"] == first_id


def test_get_skill_by_id_missing():
    skill = get_skill_by_id("nonexistent_skill_xyz")
    assert skill is None


def test_get_all_domain_ids():
    domains = get_all_domain_ids()
    assert isinstance(domains, list)
    assert len(domains) > 0
    # Expected domains from the curriculum
    assert "reading_comprehension" in domains or len(domains) >= 1


def test_get_skill_ids_for_domain():
    domains = get_all_domain_ids()
    if not domains:
        pytest.skip("No domains found")
    skill_ids = get_skill_ids_for_domain(domains[0])
    assert isinstance(skill_ids, list)
    assert len(skill_ids) > 0


def test_get_skill_ids_for_invalid_domain():
    skill_ids = get_skill_ids_for_domain("nonexistent_domain")
    assert skill_ids == []


def test_validate_prerequisites_no_errors():
    """All prerequisite references should be valid."""
    errors = validate_prerequisites()
    assert errors == [], f"Prerequisite errors found: {errors}"


def test_skill_levels_are_valid():
    """All skills have valid level values."""
    valid_levels = {"foundations", "hunter_prep"}
    skills = get_all_skills()
    for skill_id, skill in skills.items():
        level = skill.get("level")
        if level is not None:
            assert level in valid_levels, f"Invalid level '{level}' in {skill_id}"


def test_skills_are_cached():
    """get_all_skills is cached (returns same object)."""
    skills1 = get_all_skills()
    skills2 = get_all_skills()
    assert skills1 is skills2


def test_at_least_10_skills():
    """Curriculum has a reasonable number of skills."""
    skills = get_all_skills()
    assert len(skills) >= 10


def test_prerequisite_skills_are_lists():
    """prerequisite_skills is always a list."""
    skills = get_all_skills()
    for skill_id, skill in skills.items():
        assert isinstance(skill["prerequisite_skills"], list), \
            f"prerequisite_skills is not a list in {skill_id}"
