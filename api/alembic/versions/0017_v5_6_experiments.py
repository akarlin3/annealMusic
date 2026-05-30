"""v5_6 experiments persistence

Revision ID: 0017_v5_6_experiments
Revises: 0016_v5_4_user_scripts
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017_v5_6_experiments"
down_revision: str | None = "0016_v5_4_user_scripts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()

    # Create experiments table
    op.create_table(
        "experiments",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("definition", json_type, nullable=False),
        sa.Column("description", sa.String(), nullable=True),
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
    )

    op.create_index(
        "idx_experiments_user",
        "experiments",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_experiments_user", table_name="experiments")
    op.drop_table("experiments")
