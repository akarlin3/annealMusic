"""v6_1 lesson generation: spec, generation provenance, override, cache

Revision ID: 0019_v6_1_lesson_generation
Revises: 0018_v6_0_lessons
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019_v6_1_lesson_generation"
down_revision: str | None = "0018_v6_0_lessons"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()

    # --- ai_generations: nullable user + lesson-generation cache --------------
    if is_pg:
        op.alter_column("ai_generations", "user_id", existing_type=uuid_type, nullable=True)
    op.add_column("ai_generations", sa.Column("lesson_step_id", uuid_type, nullable=True))
    op.add_column("ai_generations", sa.Column("cache_key", sa.String(), nullable=True))
    op.create_index("idx_ai_gens_lesson_step", "ai_generations", ["lesson_step_id"], unique=False)
    op.create_index("uq_ai_gens_cache_key", "ai_generations", ["cache_key"], unique=True)

    # --- lessons: spec + generation status -----------------------------------
    op.add_column("lessons", sa.Column("spec", json_type, nullable=True))
    op.add_column(
        "lessons",
        sa.Column("generation_status", sa.String(), nullable=False, server_default="pending"),
    )
    op.add_column("lessons", sa.Column("generation_error", sa.String(), nullable=True))
    # Existing hand-authored lessons are complete — mark them ready.
    op.execute("UPDATE lessons SET generation_status = 'ready'")

    # --- lesson_steps: generation provenance + manual override ----------------
    op.add_column(
        "lesson_steps",
        sa.Column(
            "generation_id",
            uuid_type,
            sa.ForeignKey("ai_generations.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("lesson_steps", sa.Column("prompt_version", sa.String(), nullable=True))
    op.add_column("lesson_steps", sa.Column("model_id", sa.String(), nullable=True))
    op.add_column("lesson_steps", sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("lesson_steps", sa.Column("manual_override_content", json_type, nullable=True))


def downgrade() -> None:
    op.drop_column("lesson_steps", "manual_override_content")
    op.drop_column("lesson_steps", "generated_at")
    op.drop_column("lesson_steps", "model_id")
    op.drop_column("lesson_steps", "prompt_version")
    op.drop_column("lesson_steps", "generation_id")

    op.drop_column("lessons", "generation_error")
    op.drop_column("lessons", "generation_status")
    op.drop_column("lessons", "spec")

    op.drop_index("uq_ai_gens_cache_key", table_name="ai_generations")
    op.drop_index("idx_ai_gens_lesson_step", table_name="ai_generations")
    op.drop_column("ai_generations", "cache_key")
    op.drop_column("ai_generations", "lesson_step_id")
    if op.get_bind().dialect.name == "postgresql":
        op.alter_column("ai_generations", "user_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
