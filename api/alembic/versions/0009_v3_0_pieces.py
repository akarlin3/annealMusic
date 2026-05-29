"""v3_0 pieces migration

Revision ID: 0009_v3_0_pieces
Revises: 0008_v2_0_social
Create Date: 2026-05-29
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_v3_0_pieces"
down_revision: str | None = "0008_v2_0_social"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB() if is_pg else sa.Text()

    # 1. Create pieces table
    op.create_table(
        "pieces",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("schema_ver", sa.Integer(), nullable=False),
        sa.Column("defaults_state", json_type, nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("visibility", sa.String(), nullable=False, server_default="unlisted"),
        sa.Column("ai_description", sa.String(), nullable=True),
        sa.Column("total_duration_ms", sa.Integer(), nullable=True),
        sa.Column("has_open_segment", sa.Boolean(), nullable=False, server_default="false" if is_pg else "0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("short_slug", sa.String(), nullable=False, unique=True),
    )

    # 2. Create piece_segments table
    op.create_table(
        "piece_segments",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("piece_id", uuid_type, sa.ForeignKey("pieces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("config", json_type, nullable=False),
        sa.UniqueConstraint("piece_id", "position", name="uq_piece_segments_piece_position"),
    )

    op.create_index(
        "idx_piece_segments_piece",
        "piece_segments",
        ["piece_id", "position"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_piece_segments_piece", table_name="piece_segments")
    op.drop_table("piece_segments")
    op.drop_table("pieces")
