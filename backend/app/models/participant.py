from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Participant(Base):
    __tablename__ = "participants"
    __table_args__ = (CheckConstraint("length(phone) = 13", name="ck_participant_phone_length"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(13), unique=True)
    telegram: Mapped[str | None] = mapped_column(String(33))
    email: Mapped[str | None] = mapped_column(String(254))
    is_captain: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    team: Mapped["Team"] = relationship(back_populates="participants")


from app.models.team import Team  # noqa: E402
