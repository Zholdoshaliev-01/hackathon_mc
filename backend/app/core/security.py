from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, HTTPException, status
from pwdlib import PasswordHash

from app.core.config import settings

password_hash = PasswordHash.recommended()
COOKIE_NAME = "mw_admin_session"


def verify_admin(username: str, password: str) -> bool:
    if username != settings.admin_username:
        return False
    try:
        return password_hash.verify(password, settings.admin_password_hash)
    except Exception:
        return False


def create_access_token() -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": settings.admin_username, "iat": now, "exp": now + timedelta(minutes=settings.jwt_expire_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def require_admin(session: str | None = Cookie(default=None, alias=COOKIE_NAME)) -> str:
    credentials_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация администратора.")
    if not session:
        raise credentials_error
    try:
        payload = jwt.decode(session, settings.jwt_secret, algorithms=["HS256"])
        username = payload.get("sub")
        if username != settings.admin_username:
            raise credentials_error
        return username
    except jwt.PyJWTError as exc:
        raise credentials_error from exc

