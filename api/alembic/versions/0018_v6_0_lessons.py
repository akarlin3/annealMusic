"""v6_0 lessons curriculum

Revision ID: 0018_v6_0_lessons
Revises: 0017_v5_6_experiments
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_v6_0_lessons"
down_revision: str | None = "0017_v5_6_experiments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()
    array_type = postgresql.ARRAY(postgresql.UUID(as_uuid=True)) if is_pg else sa.String()

    # Create tracks table
    op.create_table(
        "tracks",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("slug", name="uq_tracks_slug"),
    )
    op.create_index("idx_tracks_slug", "tracks", ["slug"], unique=True)

    # Create lessons table
    op.create_table(
        "lessons",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "track_id",
            uuid_type,
            sa.ForeignKey("tracks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=False, server_default="intro"),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prerequisites", array_type, nullable=False, server_default=sa.text("'{}'") if is_pg else sa.text("'[]'")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("track_id", "slug", name="uq_lessons_track_slug"),
        sa.CheckConstraint(
            "difficulty IN ('intro', 'intermediate', 'advanced')",
            name="ck_lessons_difficulty",
        ),
    )
    op.create_index("idx_lessons_track", "lessons", ["track_id"], unique=False)

    # Create lesson_steps table
    op.create_table(
        "lesson_steps",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "lesson_id",
            uuid_type,
            sa.ForeignKey("lessons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("config", json_type, nullable=False),
        sa.UniqueConstraint("lesson_id", "position", name="uq_lesson_steps_lesson_position"),
    )
    op.create_index("idx_lesson_steps_lesson", "lesson_steps", ["lesson_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_lesson_steps_lesson", table_name="lesson_steps")
    op.drop_table("lesson_steps")
    op.drop_index("idx_lessons_track", table_name="lessons")
    op.drop_table("lessons")
    op.drop_index("idx_tracks_slug", table_name="tracks")
    op.drop_table("tracks")
