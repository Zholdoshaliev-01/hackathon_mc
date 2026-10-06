from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db

DbSession = Annotated[Session, Depends(get_db)]
AdminUser = Annotated[str, Depends(require_admin)]

