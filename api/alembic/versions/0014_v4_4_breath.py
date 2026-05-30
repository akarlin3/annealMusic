"""v4_4 breath pacing — add nullable breath_pattern to listening_sessions

Revision ID: 0014_v4_4_breath
Revises: 0013_v4_3_bells
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014_v4_4_breath"
down_revision: str | None = "0013_v4_3_bells"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Nullable — NULL means "no breath overlay" (identical to a pre-v4.4 row),
    # so no backfill is needed.
    if is_pg:
        op.add_column(
            "listening_sessions",
            sa.Column("breath_pattern", postgresql.JSONB(), nullable=True),
        )
    else:
        with op.batch_alter_table("listening_sessions") as batch_op:
            batch_op.add_column(sa.Column("breath_pattern", sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.drop_column("listening_sessions", "breath_pattern")
    else:
        with op.batch_alter_table("listening_sessions") as batch_op:
            batch_op.drop_column("breath_pattern")
