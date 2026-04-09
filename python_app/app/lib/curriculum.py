"""Load and query the curriculum taxonomy."""
import json
import logging
from pathlib import Path
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# Curriculum JSON structure mirrors TypeScript types
CURRICULUM_PATH = Path(__file__).parent.parent.parent / "content" / "curriculum-taxonomy.json"


@lru_cache(maxsize=1)
def _load_taxonomy() -> dict:
    with open(CURRICULUM_PATH, "r") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def get_all_skills() -> dict[str, dict]:
    """Return a flat map of skill_id -> skill dict for all skills in all domains.

    The JSON structure is: domains → skill_categories → skills
    """
    taxonomy = _load_taxonomy()
    skills: dict[str, dict] = {}
    for domain in taxonomy.get("domains", []):
        for category in domain.get("skill_categories", []):
            for skill in category.get("skills", []):
                skill_id = skill["skill_id"]
                skills[skill_id] = skill
    return skills


def get_skill_by_id(skill_id: str) -> Optional[dict]:
    """Look up a single skill by ID. Returns None if not found."""
    return get_all_skills().get(skill_id)


def get_skill_ids_for_domain(domain_id: str) -> list[str]:
    """Return all skill IDs for a given domain."""
    taxonomy = _load_taxonomy()
    for domain in taxonomy.get("domains", []):
        if domain.get("domain_id") == domain_id:
            ids: list[str] = []
            for category in domain.get("skill_categories", []):
                for skill in category.get("skills", []):
                    ids.append(skill["skill_id"])
            return ids
    return []


def get_all_domain_ids() -> list[str]:
    """Return all domain IDs."""
    taxonomy = _load_taxonomy()
    return [d["domain_id"] for d in taxonomy.get("domains", [])]


def validate_prerequisites() -> list[str]:
    """Validate that all prerequisite_skills references exist. Returns list of errors."""
    skills = get_all_skills()
    errors: list[str] = []
    for skill_id, skill in skills.items():
        for prereq_id in skill.get("prerequisite_skills", []):
            if prereq_id not in skills:
                errors.append(f"Skill '{skill_id}' references unknown prereq '{prereq_id}'")
    return errors
