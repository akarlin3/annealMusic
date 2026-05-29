"""user_sources: table, indexes, quota, and report reason

Revision ID: 0004_user_sources
Revises: 0003_recording_slug
Create Date: 2026-05-29
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_user_sources"
down_revision: str | None = "0003_recording_slug"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. Create user_sources table
    op.create_table(
        "user_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True) if is_pg else sa.String(), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True) if is_pg else sa.String(),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("sample_rate", sa.Integer(), nullable=False),
        sa.Column("channels", sa.Integer(), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("visibility", sa.Text(), nullable=False, server_default="unlisted"),
        sa.Column("ref_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.CheckConstraint("visibility IN ('unlisted','shared','flagged')",
                           name="ck_user_sources_visibility"),
        sa.CheckConstraint("duration_ms > 0 AND duration_ms <= 60000",
                           name="ck_user_sources_duration"),
    )

    # 2. Indexes for user_sources
    op.create_index("idx_user_sources_owner", "user_sources", ["user_id", "created_at"])
    op.create_index(
        "idx_user_sources_shared", "user_sources", ["visibility"],
        postgresql_where=sa.text("visibility = 'shared'")
    )

    # 3. Add column source_count to users
    op.add_column("users", sa.Column("source_count", sa.Integer(), nullable=False, server_default="0"))

    # 4. Modify reports table: add source_id and recreate check constraint
    op.add_column("reports", sa.Column("source_id", postgresql.UUID(as_uuid=True) if is_pg else sa.String(),
                                        sa.ForeignKey("user_sources.id", ondelete="SET NULL"), nullable=True))
    op.create_index("idx_reports_source", "reports", ["source_id"])

    # Relax reports reason check constraint
    if is_pg:
        op.drop_constraint("ck_reports_reason", "reports", type_="check")
    op.create_check_constraint(
        "ck_reports_reason", "reports",
        "reason IN ('spam','inappropriate','other','source-content')",
    )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Drop index and constraints on reports
    op.drop_constraint("ck_reports_reason", "reports", type_="check")
    if is_pg:
        op.create_check_constraint(
            "ck_reports_reason", "reports",
            "reason IN ('spam','inappropriate','other')",
        )
    
    op.drop_index("idx_reports_source", table_name="reports")
    op.drop_column("reports", "source_id")

    # Drop source_count on users
    op.drop_column("users", "source_count")

    # Drop user_sources table and index
    op.drop_index("idx_user_sources_shared", table_name="user_sources")
    op.drop_index("idx_user_sources_owner", table_name="user_sources")
    op.drop_table("user_sources")
