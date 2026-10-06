import csv
import io

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Organization, Participant, Team
from app.schemas.admin import AdminStats, AdminTeamList, AdminTeamListItem
from app.services.registration import get_registration


def list_teams(db: Session, query: str | None, organization: Organization | None, page: int, page_size: int) -> AdminTeamList:
    statement = select(Team).options(selectinload(Team.participants)).order_by(Team.created_at.desc())
    count_statement = select(func.count(func.distinct(Team.id))).select_from(Team)
    if query:
        pattern = f"%{query.strip()}%"
        condition = or_(Team.name.ilike(pattern), Participant.first_name.ilike(pattern), Participant.last_name.ilike(pattern), Participant.phone.ilike(pattern))
        statement = statement.join(Team.participants).where(condition).distinct()
        count_statement = count_statement.join(Team.participants).where(condition)
    if organization:
        statement = statement.where(Team.organization == organization)
        count_statement = count_statement.where(Team.organization == organization)
    total = db.scalar(count_statement) or 0
    teams = db.scalars(statement.offset((page - 1) * page_size).limit(page_size)).unique().all()
    items = []
    for team in teams:
        captain = next((p for p in team.participants if p.is_captain), team.participants[0])
        items.append(AdminTeamListItem(
            id=team.id, registration_number=team.registration_number, name=team.name,
            organization=team.organization, captain_name=f"{captain.first_name} {captain.last_name}",
            captain_phone=captain.phone, participant_count=len(team.participants), created_at=team.created_at,
        ))
    return AdminTeamList(items=items, total=total, page=page, page_size=page_size)


def get_stats(db: Session) -> AdminStats:
    teams = db.scalar(select(func.count(Team.id))) or 0
    participants = db.scalar(select(func.count(Participant.id))) or 0
    academy = db.scalar(select(func.count(Team.id)).where(Team.organization == Organization.motion_web_academy)) or 0
    college = db.scalar(select(func.count(Team.id)).where(Team.organization == Organization.motion_college)) or 0
    return AdminStats(teams=teams, participants=participants, motion_web_academy=academy, motion_college=college)


def export_csv(db: Session) -> str:
    teams = db.scalars(select(Team).options(selectinload(Team.participants)).order_by(Team.created_at)).all()
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(["Рег. номер", "Команда", "Организация", "Проект", "Участник", "Роль", "Телефон", "Telegram", "Email", "Дата"])
    for team in teams:
        for participant in sorted(team.participants, key=lambda item: not item.is_captain):
            writer.writerow([team.registration_number, team.name, team.organization.value, team.project_name or "", f"{participant.first_name} {participant.last_name}", "Капитан" if participant.is_captain else "Участник", participant.phone, participant.telegram or "", participant.email or "", team.created_at.isoformat()])
    return output.getvalue()


def delete_team(db: Session, team_id: int) -> None:
    team = get_registration(db, team_id)
    db.delete(team)
    db.commit()

