import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.team import Organization

PHONE_DIGITS = re.compile(r"\D+")
TELEGRAM_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]{4,31}$")


def normalize_phone(value: str) -> str:
    digits = PHONE_DIGITS.sub("", value)
    if digits.startswith("0") and len(digits) == 10:
        digits = "996" + digits[1:]
    elif len(digits) == 9:
        digits = "996" + digits
    if not (digits.startswith("996") and len(digits) == 12):
        raise ValueError("Введите номер Кыргызстана в формате +996XXXXXXXXX.")
    return f"+{digits}"


def normalize_telegram(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    username = value.strip().removeprefix("https://t.me/").removeprefix("t.me/").lstrip("@")
    if not TELEGRAM_PATTERN.fullmatch(username):
        raise ValueError("Введите корректный Telegram username.")
    return f"@{username}"


class ParticipantCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone: str
    telegram: str | None = None
    email: EmailStr | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Поле обязательно.")
        return cleaned

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, value: str) -> str:
        return normalize_phone(value)

    @field_validator("telegram")
    @classmethod
    def clean_telegram(cls, value: str | None) -> str | None:
        return normalize_telegram(value)

    @field_validator("email", mode="before")
    @classmethod
    def empty_email(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value


class RegistrationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    organization: Organization
    project_name: str | None = Field(default=None, max_length=150)
    project_description: str | None = Field(default=None, max_length=3000)
    participants: list[ParticipantCreate] = Field(min_length=3, max_length=3)
    consent: bool

    @field_validator("name")
    @classmethod
    def clean_team_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Введите название команды.")
        return cleaned

    @field_validator("project_name", "project_description", mode="before")
    @classmethod
    def empty_optional(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @model_validator(mode="after")
    def validate_registration(self) -> "RegistrationCreate":
        if not self.consent:
            raise ValueError("Подтвердите правильность введённых данных.")
        phones = [participant.phone for participant in self.participants]
        if len(set(phones)) != 3:
            raise ValueError("Участники команды должны иметь разные номера телефонов.")
        return self


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    first_name: str
    last_name: str
    phone: str
    telegram: str | None
    email: EmailStr | None
    is_captain: bool


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    registration_number: str
    name: str
    organization: Organization
    project_name: str | None
    project_description: str | None
    created_at: datetime
    participants: list[ParticipantResponse]


class RegistrationCreated(BaseModel):
    id: int
    registration_number: str
    name: str
    created_at: datetime

