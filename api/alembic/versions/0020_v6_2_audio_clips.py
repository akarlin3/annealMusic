"""v6.2 audio clip library: audio_clips table

Revision ID: 0020_v6_2_audio_clips
Revises: 0019_v6_1_lesson_generation
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020_v6_2_audio_clips"
down_revision: str | None = "0019_v6_1_lesson_generation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB() if is_pg else sa.Text()

    if is_pg:
        # No-op if patches migration already created it; harmless to re-assert.
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    if is_pg:
        from pgvector.sqlalchemy import Vector

        embedding_col = sa.Column("description_embedding", Vector(1536), nullable=True)
    else:
        embedding_col = sa.Column("description_embedding", sa.Text(), nullable=True)

    op.create_table(
        "audio_clips",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        # String lists stored as JSON for portability (intersection scoring is
        # done in Python over a ≤60-row library, so SQL array ops aren't needed).
        sa.Column("track_affinity", json_type, nullable=False, server_default="[]"),
        sa.Column("concept_tags", json_type, nullable=False, server_default="[]"),
        sa.Column("license", sa.String(), nullable=False),
        sa.Column("attribution", sa.String(), nullable=True),
        embedding_col,
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "license IN ('CC0', 'CC-BY', 'original-by-you', 'licensed-third-party')",
            name="ck_audio_clips_license",
        ),
    )
    op.create_index("uq_audio_clips_slug", "audio_clips", ["slug"], unique=True)

    if is_pg:
        op.execute(
            "CREATE INDEX idx_clip_embeddings ON audio_clips "
            "USING ivfflat (description_embedding vector_cosine_ops) "
            "WHERE archived_at IS NULL"
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.drop_index("idx_clip_embeddings", table_name="audio_clips")
    op.drop_index("uq_audio_clips_slug", table_name="audio_clips")
    op.drop_table("audio_clips")
