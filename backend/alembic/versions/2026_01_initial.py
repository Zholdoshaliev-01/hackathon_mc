"""Initial teams and participants schema."""
from alembic import op
import sqlalchemy as sa

revision = "2026_01_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    organization = sa.Enum("motion_web_academy", "motion_college", name="organization")
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("registration_number", sa.String(16), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("organization", organization, nullable=False),
        sa.Column("project_name", sa.String(150), nullable=True),
        sa.Column("project_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("uq_teams_name_lower", "teams", [sa.text("lower(name)")], unique=True)
    op.create_table(
        "participants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("first_name", sa.String(80), nullable=False),
        sa.Column("last_name", sa.String(80), nullable=False),
        sa.Column("phone", sa.String(13), nullable=False, unique=True),
        sa.Column("telegram", sa.String(33), nullable=True),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("is_captain", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(phone) = 13", name="ck_participant_phone_length"),
    )
    op.create_index("ix_participants_team_id", "participants", ["team_id"])


def downgrade() -> None:
    op.drop_table("participants")
    op.drop_index("uq_teams_name_lower", table_name="teams")
    op.drop_table("teams")
    sa.Enum(name="organization").drop(op.get_bind())
