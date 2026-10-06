from fastapi import APIRouter

from app.schemas.registration_status import RegistrationStatusResponse
from app.services.registration_status import registration_status

router = APIRouter(tags=["registrations"])


@router.get("/registration-status", response_model=RegistrationStatusResponse)
def status() -> RegistrationStatusResponse:
    return registration_status()
