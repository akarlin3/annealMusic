"""v4_1 custom tunings migration

Revision ID: 0011_v4_1_custom_tunings
Revises: ("0010_v3_7_piece_parity", "0010_v4_0_listening_sessions")
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_v4_1_custom_tunings"
down_revision: tuple[str, str] | None = ("0010_v3_7_piece_parity", "0010_v4_0_listening_sessions")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()

    # Create custom_tunings table
    op.create_table(
        "custom_tunings",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("scl_text", sa.String(), nullable=False),
        sa.Column("parsed_scale", json_type, nullable=False),
        sa.Column("reference_a4_hz", sa.Numeric(8, 3), nullable=False, server_default="440.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index(
        "idx_custom_tunings_user",
        "custom_tunings",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_custom_tunings_user", table_name="custom_tunings")
    op.drop_table("custom_tunings")
