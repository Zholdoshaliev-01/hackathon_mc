from datetime import datetime

from pydantic import BaseModel, Field

from app.models.team import Organization
from app.schemas.registration import RegistrationResponse


class AdminLogin(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class AdminTeamListItem(BaseModel):
    id: int
    registration_number: str
    name: str
    organization: Organization
    captain_name: str
    captain_phone: str
    participant_count: int
    created_at: datetime


class AdminTeamList(BaseModel):
    items: list[AdminTeamListItem]
    total: int
    page: int
    page_size: int


class AdminStats(BaseModel):
    teams: int
    participants: int
    motion_web_academy: int
    motion_college: int


class AdminTeamDetail(RegistrationResponse):
    pass

