from fastapi import APIRouter, Query, Response, status

from app.api.deps import AdminUser, DbSession
from app.core.config import settings
from app.core.security import COOKIE_NAME, create_access_token, verify_admin
from app.models import Organization
from app.schemas.admin import AdminLogin, AdminStats, AdminTeamDetail, AdminTeamList
from app.services import admin as service
from app.services.registration import get_registration

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/auth/login", status_code=status.HTTP_204_NO_CONTENT)
def login(payload: AdminLogin, response: Response) -> None:
    if not verify_admin(payload.username, payload.password):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Неверный логин или пароль.")
    response.set_cookie(COOKIE_NAME, create_access_token(), httponly=True, secure=settings.cookie_secure, samesite="strict", max_age=settings.jwt_expire_minutes * 60, path="/")


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/auth/me")
def me(admin: AdminUser) -> dict[str, str]:
    return {"username": admin}


@router.get("/teams", response_model=AdminTeamList)
def teams(db: DbSession, admin: AdminUser, q: str | None = None, organization: Organization | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200)) -> AdminTeamList:
    return service.list_teams(db, q, organization, page, page_size)


@router.get("/teams/{team_id}", response_model=AdminTeamDetail)
def team(team_id: int, db: DbSession, admin: AdminUser) -> AdminTeamDetail:
    return get_registration(db, team_id)


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team(team_id: int, db: DbSession, admin: AdminUser) -> None:
    service.delete_team(db, team_id)


@router.get("/stats", response_model=AdminStats)
def stats(db: DbSession, admin: AdminUser) -> AdminStats:
    return service.get_stats(db)


@router.get("/export/csv")
def export(db: DbSession, admin: AdminUser) -> Response:
    return Response(service.export_csv(db), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=hackathon-teams.csv"})

