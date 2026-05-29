"""ai patches: ai_generations and new patches columns

Revision ID: 0006_ai_patches
Revises: 0005_auth_claim
Create Date: 2026-05-29
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_ai_patches"
down_revision: str | None = "0005_auth_claim"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()

    # 1. Create pgvector extension if on Postgres
    if is_pg:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2. Add columns to patches table
    op.add_column("patches", sa.Column("ai_description", sa.Text(), nullable=True))

    if is_pg:
        from pgvector.sqlalchemy import Vector
        op.add_column("patches", sa.Column("ai_description_embedding", Vector(1536), nullable=True))
    else:
        op.add_column("patches", sa.Column("ai_description_embedding", sa.Text(), nullable=True))

    op.add_column("patches", sa.Column("ai_description_source", sa.String(), nullable=True))

    # 3. Create index for embeddings if on Postgres
    if is_pg:
        op.execute(
            "CREATE INDEX idx_patches_embedding ON patches USING ivfflat (ai_description_embedding vector_cosine_ops) WHERE visibility = 'public'"
        )

    # 4. Create ai_generations table
    op.create_table(
        "ai_generations",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("input_patch_id", uuid_type, sa.ForeignKey("patches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("output_state", postgresql.JSONB() if is_pg else sa.Text(), nullable=True),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_estimate_usd", sa.Numeric(8, 6), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("cached", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("idx_ai_gens_user", "ai_generations", ["user_id"])
    op.create_index("idx_ai_gens_kind", "ai_generations", ["kind"])


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Drop ai_generations indexes and table
    op.drop_index("idx_ai_gens_kind", table_name="ai_generations")
    op.drop_index("idx_ai_gens_user", table_name="ai_generations")
    op.drop_table("ai_generations")

    # Drop index on patches if on Postgres
    if is_pg:
        op.drop_index("idx_patches_embedding", table_name="patches")

    # Drop patches columns
    op.drop_column("patches", "ai_description_source")
    op.drop_column("patches", "ai_description_embedding")
    op.drop_column("patches", "ai_description")
