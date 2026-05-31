"""v7_4 biofeedback

Revision ID: 0028_v7_4_biofeedback
Revises: 0027_v7_3_mapping_templates
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028_v7_4_biofeedback"
down_revision: str | None = "0027_v7_3_mapping_templates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()

    # 1. Add biosignal_channels column to clinical_protocols
    op.add_column(
        "clinical_protocols",
        sa.Column("biosignal_channels", json_type, nullable=False, server_default="'[]'"),
    )

    # 2. Create biosignal_streams table
    op.create_table(
        "biosignal_streams",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "session_record_id",
            uuid_type,
            sa.ForeignKey("clinical_session_records.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("device_id", sa.String(), nullable=False),
        sa.Column("channel_name", sa.String(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("sample_rate_hz", sa.Numeric(8, 2), nullable=True),
        sa.Column("bytes", sa.Integer(), nullable=True),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    op.create_index(
        "idx_biosignal_streams_session",
        "biosignal_streams",
        ["session_record_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_biosignal_streams_session", table_name="biosignal_streams")
    op.drop_table("biosignal_streams")
    op.drop_column("clinical_protocols", "biosignal_channels")
