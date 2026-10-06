import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Organization(str, enum.Enum):
    motion_web_academy = "motion_web_academy"
    motion_college = "motion_college"


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (Index("uq_teams_name_lower", text("lower(name)"), unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    registration_number: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    organization: Mapped[Organization] = mapped_column(Enum(Organization, name="organization"), nullable=False)
    project_name: Mapped[str | None] = mapped_column(String(150))
    project_description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    participants: Mapped[list["Participant"]] = relationship(back_populates="team", cascade="all, delete-orphan", passive_deletes=True)


from app.models.participant import Participant  # noqa: E402
