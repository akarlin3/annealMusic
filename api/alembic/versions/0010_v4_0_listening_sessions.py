"""v4_0 listening sessions migration

Revision ID: 0010_v4_0_listening_sessions
Revises: 0009_v3_0_pieces
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_v4_0_listening_sessions"
down_revision: str | None = "0009_v3_0_pieces"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()

    # Create listening_sessions table
    op.create_table(
        "listening_sessions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("piece_id", uuid_type, sa.ForeignKey("pieces.id", ondelete="SET NULL"), nullable=True),
        sa.Column("schema_ver", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("intention", sa.String(), nullable=True),
        sa.Column("length_category", sa.String(), nullable=True),
        sa.Column("recommended_environment", sa.String(), nullable=True),
        sa.Column("settle_in_ms", sa.Integer(), nullable=False, server_default="30000"),
        sa.Column("integration_ms", sa.Integer(), nullable=False, server_default="60000"),
        sa.Column("opening_tone", sa.Boolean(), nullable=False, server_default="false" if is_pg else "0"),
        sa.Column("closing_tone", sa.Boolean(), nullable=False, server_default="false" if is_pg else "0"),
        sa.Column("total_duration_ms", sa.Integer(), nullable=True),
        sa.Column("visibility", sa.String(), nullable=False, server_default="unlisted"),
        sa.Column("short_slug", sa.String(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index(
        "idx_listening_sessions_user",
        "listening_sessions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "idx_listening_sessions_piece",
        "listening_sessions",
        ["piece_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_listening_sessions_piece", table_name="listening_sessions")
    op.drop_index("idx_listening_sessions_user", table_name="listening_sessions")
    op.drop_table("listening_sessions")
