import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pwdlib import PasswordHash

TEST_DB = Path(__file__).parent / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["JWT_SECRET"] = "test-secret-that-is-longer-than-thirty-two-characters"
os.environ["ADMIN_USERNAME"] = "organizer"
os.environ["ADMIN_PASSWORD_HASH"] = PasswordHash.recommended().hash("test-password")
os.environ["ENVIRONMENT"] = "testing"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Team  # noqa: E402
from app.services.registration_status import registration_status  # noqa: E402


def payload(name: str = "Code Masters") -> dict:
    return {
        "name": name,
        "organization": "motion_web_academy",
        "project_name": "City Flow",
        "project_description": "Умная городская навигация",
        "participants": [
            {"first_name": "Айбек", "last_name": "Асанов", "phone": "+996 555 111 111", "telegram": "@aibek_dev"},
            {"first_name": "Алина", "last_name": "Ким", "phone": "700222222", "email": "alina@example.com"},
            {"first_name": "Данияр", "last_name": "Токтосунов", "phone": "0777333333"},
        ],
        "consent": True,
    }


def setup_module() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


def teardown_module() -> None:
    Base.metadata.drop_all(engine)
    engine.dispose()
    TEST_DB.unlink(missing_ok=True)


client = TestClient(app)


def test_health_and_registration_flow() -> None:
    assert client.get("/api/v1/health").status_code == 200
    registration_state = client.get("/api/v1/registration-status")
    assert registration_state.status_code == 200
    assert registration_state.json()["is_open"] is True
    assert registration_state.json()["server_time"]
    assert registration_state.json()["deadline"]
    response = client.post("/api/v1/registrations", json=payload())
    assert response.status_code == 201
    result = response.json()
    assert result["registration_number"].startswith("MW-")

    detail = client.get(f"/api/v1/registrations/{result['id']}")
    assert detail.status_code == 200
    participants = detail.json()["participants"]
    assert len(participants) == 3
    assert sum(item["is_captain"] for item in participants) == 1


def test_duplicate_team_and_phone_are_rejected() -> None:
    duplicate_name = client.post("/api/v1/registrations", json=payload("code masters"))
    assert duplicate_name.status_code == 409

    duplicate_phone_payload = payload("New Team")
    duplicate_phone_payload["participants"][1]["phone"] = "+996555111111"
    duplicate_phone_payload["participants"][0]["phone"] = "+996500444444"
    response = client.post("/api/v1/registrations", json=duplicate_phone_payload)
    assert response.status_code == 409
    assert "номер" in str(response.json()["detail"])


def test_exactly_three_and_consent_are_required() -> None:
    invalid = payload("Invalid Team")
    invalid["participants"].pop()
    assert client.post("/api/v1/registrations", json=invalid).status_code == 422
    invalid = payload("No Consent")
    invalid["consent"] = False
    assert client.post("/api/v1/registrations", json=invalid).status_code == 422


def test_registration_status_deadline_and_manual_override() -> None:
    deadline = datetime(2026, 10, 10, tzinfo=timezone(timedelta(hours=6)))
    assert registration_status(now=deadline - timedelta(seconds=1), enabled=True, deadline=deadline).is_open is True

    exactly_at_deadline = registration_status(now=deadline, enabled=True, deadline=deadline)
    assert exactly_at_deadline.is_open is False
    assert exactly_at_deadline.reason == "deadline_passed"

    after_deadline = registration_status(now=deadline + timedelta(seconds=1), enabled=True, deadline=deadline)
    assert after_deadline.is_open is False
    assert after_deadline.reason == "deadline_passed"

    manually_closed = registration_status(now=deadline - timedelta(days=1), enabled=False, deadline=deadline)
    assert manually_closed.is_open is False
    assert manually_closed.reason == "manually_closed"


def test_registration_after_deadline_is_rejected_without_persistence() -> None:
    previous_enabled = settings.registration_enabled
    previous_deadline = settings.registration_deadline
    try:
        settings.registration_enabled = True
        settings.registration_deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
        with Session(engine) as session:
            before = session.scalar(select(func.count(Team.id)))

        response = client.post("/api/v1/registrations", json=payload("Late Team"))
        assert response.status_code == 410
        assert response.json() == {"detail": "Регистрация на хакатон уже завершена."}

        with Session(engine) as session:
            after = session.scalar(select(func.count(Team.id)))
        assert after == before
    finally:
        settings.registration_enabled = previous_enabled
        settings.registration_deadline = previous_deadline


def test_admin_auth_stats_export_and_delete() -> None:
    assert client.get("/api/v1/admin/stats").status_code == 401
    assert client.post("/api/v1/admin/auth/login", json={"username": "organizer", "password": "wrong"}).status_code == 401
    login = client.post("/api/v1/admin/auth/login", json={"username": "organizer", "password": "test-password"})
    assert login.status_code == 204
    assert client.get("/api/v1/admin/stats").json()["teams"] == 1
    teams = client.get("/api/v1/admin/teams?q=Айбек").json()
    assert teams["total"] == 1
    team_id = teams["items"][0]["id"]
    export = client.get("/api/v1/admin/export/csv")
    assert export.status_code == 200
    assert "Code Masters" in export.text
    assert client.delete(f"/api/v1/admin/teams/{team_id}").status_code == 204
    assert client.get("/api/v1/admin/stats").json()["teams"] == 0
