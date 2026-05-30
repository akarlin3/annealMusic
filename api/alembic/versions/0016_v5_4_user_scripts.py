"""v5_4 user scripts persistence

Revision ID: 0016_v5_4_user_scripts
Revises: ("0015_v4_5_history_library", "9918e39b5fa2")
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016_v5_4_user_scripts"
down_revision: tuple[str, str] | None = ("0015_v4_5_history_library", "9918e39b5fa2")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()

    # Create user_scripts table
    op.create_table(
        "user_scripts",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("language", sa.String(), nullable=False, server_default="python"),
        sa.Column("visibility", sa.String(), nullable=False, server_default="private"),
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
        "idx_user_scripts_user",
        "user_scripts",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_user_scripts_user", table_name="user_scripts")
    op.drop_table("user_scripts")
