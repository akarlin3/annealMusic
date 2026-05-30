"""v6.3 progress tracking: lesson_progress table

Revision ID: 0021_v6_3_lesson_progress
Revises: 0020_v6_2_audio_clips
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021_v6_3_lesson_progress"
down_revision: str | None = "0020_v6_2_audio_clips"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB() if is_pg else sa.Text()

    op.create_table(
        "lesson_progress",
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("lesson_id", uuid_type, nullable=False),
        sa.Column("state", sa.String(), nullable=False, server_default="not_started"),
        sa.Column("current_step_position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scroll_ratio", sa.Float(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        # Bounded per-step log; truncated to a hard cap by the service on write.
        sa.Column("step_actions", json_type, nullable=False, server_default="[]"),
        sa.Column("reflection_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "lesson_id", name="pk_lesson_progress"),
        # 'abandoned' is intentionally absent: it is computed (>30d inactivity),
        # never stored, so a user can always resume an in_progress lesson.
        sa.CheckConstraint(
            "state IN ('not_started', 'in_progress', 'completed')",
            name="ck_lesson_progress_state",
        ),
        sa.CheckConstraint(
            "scroll_ratio >= 0 AND scroll_ratio <= 1",
            name="ck_lesson_progress_scroll",
        ),
    )
    op.create_index(
        "idx_lesson_progress_user",
        "lesson_progress",
        ["user_id", sa.text("last_active_at DESC")],
    )
    op.create_index(
        "idx_lesson_progress_state",
        "lesson_progress",
        ["user_id", "state", sa.text("last_active_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_lesson_progress_state", table_name="lesson_progress")
    op.drop_index("idx_lesson_progress_user", table_name="lesson_progress")
    op.drop_table("lesson_progress")
