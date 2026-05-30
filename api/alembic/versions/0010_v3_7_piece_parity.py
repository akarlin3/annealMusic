"""piece parity: columns, triggers and piece_count to users

Revision ID: 0010_v3_7_piece_parity
Revises: 0009_v3_0_pieces
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_v3_7_piece_parity"
down_revision: str | None = "0009_v3_0_pieces"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. Add columns to pieces table
    op.add_column("pieces", sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("pieces", sa.Column("load_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("pieces", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("pieces", sa.Column("preview_status", sa.String(), nullable=False, server_default="none"))
    op.add_column("pieces", sa.Column("preview_storage_key", sa.String(), nullable=True))
    op.add_column("pieces", sa.Column("preview_duration_ms", sa.Integer(), nullable=True))
    op.add_column("pieces", sa.Column("preview_slice_start_ms", sa.Integer(), nullable=False, server_default="30000"))
    op.add_column("pieces", sa.Column("ai_description_source", sa.String(), nullable=True))
    op.add_column("pieces", sa.Column("has_captures", sa.Boolean(), nullable=False, server_default="false" if is_pg else "0"))

    if is_pg:
        from pgvector.sqlalchemy import Vector
        op.add_column("pieces", sa.Column("ai_description_embedding", Vector(1536), nullable=True))
        # Embeddings index
        op.execute(
            "CREATE INDEX idx_pieces_embedding ON pieces USING ivfflat (ai_description_embedding vector_cosine_ops) WHERE visibility = 'public'"
        )
    else:
        op.add_column("pieces", sa.Column("ai_description_embedding", sa.Text(), nullable=True))

    # Index for gallery queries
    op.create_index("idx_pieces_published", "pieces", ["published_at"])

    # 2. Add piece_count to users table
    op.add_column("users", sa.Column("piece_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Drop users columns
    op.drop_column("users", "piece_count")

    # Drop index
    op.drop_index("idx_pieces_published", table_name="pieces")
    if is_pg:
        op.drop_index("idx_pieces_embedding", table_name="pieces")

    # Drop pieces columns
    op.drop_column("pieces", "ai_description_embedding")
    op.drop_column("pieces", "ai_description_source")
    op.drop_column("pieces", "has_captures")
    op.drop_column("pieces", "preview_slice_start_ms")
    op.drop_column("pieces", "preview_duration_ms")
    op.drop_column("pieces", "preview_storage_key")
    op.drop_column("pieces", "preview_status")
    op.drop_column("pieces", "published_at")
    op.drop_column("pieces", "load_count")
    op.drop_column("pieces", "like_count")
