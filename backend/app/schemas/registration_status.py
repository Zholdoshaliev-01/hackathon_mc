from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class RegistrationStatusResponse(BaseModel):
    is_open: bool
    deadline: datetime
    server_time: datetime
    reason: Literal["open", "deadline_passed", "manually_closed"]
    message: str | None = None
