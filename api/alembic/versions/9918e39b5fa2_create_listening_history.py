"""create_listening_history

Revision ID: 9918e39b5fa2
Revises: 0013_v4_3_bells
Create Date: 2026-05-30 00:56:06.536404
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: sa.UnicodeText = '9918e39b5fa2'
down_revision: str | None = '0013_v4_3_bells'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()

    op.create_table(
        "listening_history",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("listening_session_id", uuid_type, sa.ForeignKey("listening_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Numeric(10, 3), nullable=False),
        sa.Column("is_standalone_timer", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index(
        "idx_listening_history_user",
        "listening_history",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "idx_listening_history_session",
        "listening_history",
        ["listening_session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_listening_history_session", table_name="listening_history")
    op.drop_index("idx_listening_history_user", table_name="listening_history")
    op.drop_table("listening_history")

