from functools import lru_cache
from datetime import datetime, timedelta, timezone

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore", validate_default=True)

    app_name: str = "Motion Hackathon API"
    environment: str = "development"
    log_level: str = "INFO"
    database_url: str = "postgresql+psycopg://hackathon:hackathon@localhost:5432/hackathon"
    backend_cors_origins: list[str] | str = ["http://localhost:5173"]
    jwt_secret: str = Field(min_length=32)
    jwt_expire_minutes: int = 480
    cookie_secure: bool = False
    admin_username: str = "admin"
    admin_password_hash: str
    registration_enabled: bool = True
    registration_deadline: datetime = datetime(2026, 10, 10, tzinfo=timezone(timedelta(hours=6)))

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("registration_deadline")
    @classmethod
    def validate_registration_deadline(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("REGISTRATION_DEADLINE must include a timezone offset")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
