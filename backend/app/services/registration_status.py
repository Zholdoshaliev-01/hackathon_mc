from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.registration_status import RegistrationStatusResponse

CLOSED_DETAIL = "Регистрация на хакатон уже завершена."


def registration_status(
    *,
    now: datetime | None = None,
    enabled: bool | None = None,
    deadline: datetime | None = None,
) -> RegistrationStatusResponse:
    configured_deadline = deadline or settings.registration_deadline
    if configured_deadline.tzinfo is None or configured_deadline.utcoffset() is None:
        raise ValueError("Registration deadline must be timezone-aware")

    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None or current_time.utcoffset() is None:
        raise ValueError("Current time must be timezone-aware")
    current_time = current_time.astimezone(configured_deadline.tzinfo)
    registration_enabled = settings.registration_enabled if enabled is None else enabled

    if not registration_enabled:
        reason = "manually_closed"
    elif current_time >= configured_deadline:
        reason = "deadline_passed"
    else:
        reason = "open"

    is_open = reason == "open"
    return RegistrationStatusResponse(
        is_open=is_open,
        deadline=configured_deadline,
        server_time=current_time,
        reason=reason,
        message=None if is_open else "Регистрация завершена.",
    )


def ensure_registration_open(*, now: datetime | None = None) -> None:
    if not registration_status(now=now).is_open:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=CLOSED_DETAIL)
