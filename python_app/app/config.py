from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    anthropic_api_key: str
    jwt_secret: str
    database_url: str = "sqlite:///./dev.db"
    app_name: str = "Hunter Tutor"
    app_url: str = "http://localhost:8000"
    parent_pin: str = "1234"
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache
def get_settings() -> Settings:
    return Settings()
