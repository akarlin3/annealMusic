"""v7_5_study_export

Revision ID: 0029_v7_5_study_export
Revises: 0028_v7_4_biofeedback
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0029_v7_5_study_export"
down_revision: str | None = "0028_v7_4_biofeedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()

    op.create_table(
        "study_exports",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "study_id",
            uuid_type,
            sa.ForeignKey("studies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "version_id",
            uuid_type,
            sa.ForeignKey("study_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("bundle_storage_key", sa.String(), nullable=False),
        sa.Column("bundle_bytes", sa.Integer(), nullable=False),
        sa.Column("bundle_sha256", sa.String(), nullable=False),
        sa.Column("reproducibility_level", sa.String(), nullable=False),
        sa.Column("includes_subject_data", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("manifest", json_type, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("study_exports")
