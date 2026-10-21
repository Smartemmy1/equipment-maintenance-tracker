"""Application settings, read from environment variables (or a .env file)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Equipment Maintenance Tracker API"
    database_url: str = "sqlite:///./maintenance.db"
    seed_demo_data: bool = True
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # An inspection is "due soon" when it falls within this many days.
    due_soon_days: int = 14


@lru_cache
def get_settings() -> Settings:
    return Settings()
