"""Anthropic client singleton."""
import anthropic
from functools import lru_cache
from app.config import get_settings


@lru_cache(maxsize=1)
def get_anthropic_client() -> anthropic.Anthropic:
    settings = get_settings()
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)
