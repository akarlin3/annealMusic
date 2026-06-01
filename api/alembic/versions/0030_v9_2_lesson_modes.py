"""v9.2: add modes and onboarding_mode columns to lessons table

Revision ID: 0030_v9_2_lesson_modes
Revises: 0029_v7_5_study_export
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0030_v9_2_lesson_modes"
down_revision: str | None = "0029_v7_5_study_export"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. Add modes column
    modes_type = postgresql.ARRAY(sa.String()) if is_pg else sa.String()
    
    if is_pg:
        op.add_column(
            "lessons",
            sa.Column(
                "modes",
                modes_type,
                nullable=False,
                server_default=sa.text("ARRAY['musician']"),
            ),
        )
        # 2. Add onboarding_mode column
        op.add_column(
            "lessons",
            sa.Column("onboarding_mode", sa.String(), nullable=True, unique=True),
        )
    else:
        # SQLite raw SQL approach to bypass batch alter circular dependency issues
        try:
            op.execute("ALTER TABLE lessons ADD COLUMN modes VARCHAR NOT NULL DEFAULT '[\"musician\"]'")
        except Exception as e:
            if "duplicate column name" not in str(e):
                raise
        try:
            op.execute("ALTER TABLE lessons ADD COLUMN onboarding_mode VARCHAR")
        except Exception as e:
            if "duplicate column name" not in str(e):
                raise
        try:
            op.execute("CREATE UNIQUE INDEX uq_lessons_onboarding_mode ON lessons (onboarding_mode)")
        except Exception as e:
            if "already exists" not in str(e) and "duplicate" not in str(e):
                raise


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.drop_column("lessons", "onboarding_mode")
        op.drop_column("lessons", "modes")
    else:
        op.execute("DROP INDEX IF EXISTS uq_lessons_onboarding_mode")
        try:
            op.execute("ALTER TABLE lessons DROP COLUMN onboarding_mode")
        except Exception:
            pass
        try:
            op.execute("ALTER TABLE lessons DROP COLUMN modes")
        except Exception:
            pass
