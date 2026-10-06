import secrets

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Participant, Team
from app.schemas.registration import RegistrationCreate


def _registration_number() -> str:
    return f"MW-{secrets.randbelow(9000) + 1000}"


def create_registration(db: Session, payload: RegistrationCreate) -> Team:
    existing_name = db.scalar(select(Team.id).where(func.lower(Team.name) == payload.name.casefold()))
    if existing_name:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Команда с таким названием уже зарегистрирована.")

    existing_phone = db.scalar(select(Participant.phone).where(Participant.phone.in_([p.phone for p in payload.participants])))
    if existing_phone:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Участник с таким номером телефона уже зарегистрирован.", "phone": existing_phone})

    try:
        team = Team(
            registration_number=_unique_registration_number(db),
            name=payload.name,
            organization=payload.organization,
            project_name=payload.project_name,
            project_description=payload.project_description,
        )
        team.participants = [
            Participant(**participant.model_dump(), is_captain=index == 0)
            for index, participant in enumerate(payload.participants)
        ]
        db.add(team)
        db.commit()
        db.refresh(team)
        return get_registration(db, team.id)
    except IntegrityError as exc:
        db.rollback()
        constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", "")
        detail = "Регистрация с такими данными уже существует."
        if constraint == "participants_phone_key":
            detail = "Участник с таким номером телефона уже зарегистрирован."
        elif constraint == "uq_teams_name_lower":
            detail = "Команда с таким названием уже зарегистрирована."
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc


def _unique_registration_number(db: Session) -> str:
    for _ in range(20):
        candidate = _registration_number()
        if not db.scalar(select(Team.id).where(Team.registration_number == candidate)):
            return candidate
    raise HTTPException(status_code=503, detail="Не удалось создать регистрационный номер. Повторите попытку.")


def get_registration(db: Session, team_id: int) -> Team:
    team = db.scalar(select(Team).options(selectinload(Team.participants)).where(Team.id == team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Регистрация не найдена.")
    return team

