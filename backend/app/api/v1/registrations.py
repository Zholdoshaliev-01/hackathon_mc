from fastapi import APIRouter, status

from app.api.deps import DbSession
from app.schemas.registration import RegistrationCreate, RegistrationCreated, RegistrationResponse
from app.services.registration import create_registration, get_registration

router = APIRouter(prefix="/registrations", tags=["registrations"])


@router.post("", response_model=RegistrationCreated, status_code=status.HTTP_201_CREATED)
def register(payload: RegistrationCreate, db: DbSession) -> RegistrationCreated:
    return create_registration(db, payload)


@router.get("/{team_id}", response_model=RegistrationResponse)
def registration(team_id: int, db: DbSession) -> RegistrationResponse:
    return get_registration(db, team_id)

