"""v7_1 sonifications

Revision ID: 0019_v7_1_sonifications
Revises: 0018_v6_0_lessons
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019_v7_1_sonifications"
down_revision: str | None = "0018_v6_0_lessons"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB() if is_pg else sa.JSON()

    # Create sonifications table
    op.create_table(
        "sonifications",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("schema_ver", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("base_state", json_type, nullable=False),
        sa.Column("mapping_spec", json_type, nullable=False),
        sa.Column(
            "source_files",
            json_type,
            nullable=False,
            server_default=sa.text("'[]'") if not is_pg else sa.text("'[]'::jsonb"),
        ),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("visibility", sa.String(), nullable=False, server_default="unlisted"),
        sa.Column("short_slug", sa.String(), nullable=True, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "visibility IN ('unlisted','public','flagged')",
            name="ck_sonifications_visibility",
        ),
    )

    op.create_index(
        "idx_sonifications_user",
        "sonifications",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_sonifications_user", table_name="sonifications")
    op.drop_table("sonifications")
