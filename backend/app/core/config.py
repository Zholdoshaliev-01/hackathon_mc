from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

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

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

