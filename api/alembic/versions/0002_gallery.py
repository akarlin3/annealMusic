"""gallery: patch preview/load columns, reports table, flagged visibility

Revision ID: 0002_gallery
Revises: 0001_initial
Create Date: 2026-05-24
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_gallery"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # --- new patch columns ---------------------------------------------------
    op.add_column("patches", sa.Column("engine", sa.Text(), nullable=False,
                                       server_default="sine"))
    op.add_column("patches", sa.Column("mode", sa.Text(), nullable=False,
                                       server_default="open"))
    op.add_column("patches", sa.Column("has_captures", sa.Boolean(), nullable=False,
                                       server_default=sa.text("false")))
    op.add_column("patches", sa.Column("load_count", sa.Integer(), nullable=False,
                                       server_default="0"))
    op.add_column("patches", sa.Column("published_at", sa.DateTime(timezone=True),
                                       nullable=True))
    op.add_column("patches", sa.Column("preview_storage_key", sa.Text(),
                                       nullable=True))
    op.add_column("patches", sa.Column("preview_duration_ms", sa.Integer(),
                                       nullable=True))
    op.add_column("patches", sa.Column("preview_status", sa.Text(), nullable=False,
                                       server_default="none"))

    # --- relax visibility CHECK to admit 'flagged'; add preview_status CHECK --
    if is_pg:
        op.drop_constraint("ck_patches_visibility", "patches", type_="check")
    op.create_check_constraint(
        "ck_patches_visibility", "patches",
        "visibility IN ('unlisted','public','flagged')",
    )
    op.create_check_constraint(
        "ck_patches_preview_status", "patches",
        "preview_status IN ('none','rendering','ready','failed')",
    )

    # --- backfill existing public patches (Postgres prod only) ---------------
    if is_pg:
        op.execute(
            "UPDATE patches SET published_at = created_at "
            "WHERE visibility = 'public' AND published_at IS NULL"
        )
        op.execute(
            "UPDATE patches SET engine = "
            "CASE WHEN state->>'payload' LIKE '%e=fm%' THEN 'fm' ELSE 'sine' END"
        )
        op.execute(
            "UPDATE patches SET mode = "
            "CASE WHEN state->>'payload' LIKE '%m=arc%' THEN 'arc' ELSE 'open' END"
        )
        op.execute(
            "UPDATE patches SET has_captures = "
            "(state->>'payload' LIKE '%.cap=1%')"
        )

    # --- gallery indexes -----------------------------------------------------
    op.create_index(
        "idx_patches_gallery", "patches", ["published_at", "id"],
        postgresql_where=sa.text("visibility = 'public'"),
    )
    op.create_index(
        "idx_patches_loads", "patches", ["load_count", "published_at", "id"],
        postgresql_where=sa.text("visibility = 'public'"),
    )
    if is_pg:
        # Full-text search over title+description; Postgres-only (GIN tsvector).
        op.execute(
            "CREATE INDEX idx_patches_search ON patches USING GIN "
            "(to_tsvector('english', coalesce(title,'') || ' ' || "
            "coalesce(description,''))) WHERE visibility = 'public'"
        )

    # --- reports table -------------------------------------------------------
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patch_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("patches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.CheckConstraint("reason IN ('spam','inappropriate','other')",
                           name="ck_reports_reason"),
        sa.CheckConstraint("status IN ('open','dismissed','upheld')",
                           name="ck_reports_status"),
    )
    op.create_index("idx_reports_patch", "reports", ["patch_id"])
    op.create_index("idx_reports_open", "reports", ["status", "created_at"],
                    postgresql_where=sa.text("status = 'open'"))


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    op.drop_table("reports")
    if is_pg:
        op.execute("DROP INDEX IF EXISTS idx_patches_search")
    op.drop_index("idx_patches_loads", table_name="patches")
    op.drop_index("idx_patches_gallery", table_name="patches")

    op.drop_constraint("ck_patches_preview_status", "patches", type_="check")
    if is_pg:
        op.drop_constraint("ck_patches_visibility", "patches", type_="check")
        op.create_check_constraint(
            "ck_patches_visibility", "patches",
            "visibility IN ('unlisted','public')",
        )
        op.execute("UPDATE patches SET visibility = 'unlisted' WHERE visibility = 'flagged'")

    for col in ("preview_status", "preview_duration_ms", "preview_storage_key",
                "published_at", "load_count", "has_captures", "mode", "engine"):
        op.drop_column("patches", col)
