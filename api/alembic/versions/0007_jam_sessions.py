"""jam sessions migration

Revision ID: 0007_jam_sessions
Revises: 0006_ai_patches
Create Date: 2026-05-29
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_jam_sessions"
down_revision: str | None = "0006_ai_patches"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()

    # 1. Create jam_sessions table
    op.create_table(
        "jam_sessions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("created_by", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("audit_log", postgresql.JSONB() if is_pg else sa.Text(), nullable=False, server_default="[]" if is_pg else "'[]'"),
    )
    
    if is_pg:
        op.create_index(
            "idx_jam_sessions_active",
            "jam_sessions",
            ["last_active_at"],
            unique=False,
            postgresql_where=sa.text("ended_at IS NULL")
        )
    else:
        op.create_index(
            "idx_jam_sessions_active",
            "jam_sessions",
            ["last_active_at"],
            unique=False
        )

    # 2. Create jam_participants table
    op.create_table(
        "jam_participants",
        sa.Column("session_id", uuid_type, sa.ForeignKey("jam_sessions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), primary_key=True, server_default=sa.text("now()")),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("color", sa.String(), nullable=False),
    )

    # 3. Create patch_collaborators table
    op.create_table(
        "patch_collaborators",
        sa.Column("patch_id", uuid_type, sa.ForeignKey("patches.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("patch_collaborators")
    op.drop_table("jam_participants")
    op.drop_index("idx_jam_sessions_active", table_name="jam_sessions")
    op.drop_table("jam_sessions")
