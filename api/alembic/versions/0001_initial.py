"""initial schema: users, patches, captures, recordings

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-24
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("bytes_used", sa.BigInteger(), nullable=False,
                  server_default="0"),
        sa.Column("patch_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("capture_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recording_count", sa.Integer(), nullable=False,
                  server_default="0"),
    )

    op.create_table(
        "patches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("schema_ver", sa.Integer(), nullable=False),
        sa.Column("state", postgresql.JSONB(), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("visibility", sa.Text(), nullable=False,
                  server_default="unlisted"),
        sa.Column("capture_refs", postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
                  nullable=False, server_default="{}"),
        sa.Column("short_slug", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.CheckConstraint("visibility IN ('unlisted','public')",
                           name="ck_patches_visibility"),
        sa.UniqueConstraint("short_slug", name="uq_patches_short_slug"),
    )
    op.create_index("idx_patches_user", "patches", ["user_id", "created_at"])
    op.create_index("idx_patches_public", "patches", ["visibility", "created_at"],
                    postgresql_where=sa.text("visibility = 'public'"))

    op.create_table(
        "captures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("sample_rate", sa.Integer(), nullable=False),
        sa.Column("channels", sa.Integer(), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("format", sa.Text(), nullable=False),
        sa.Column("ref_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.CheckConstraint("format IN ('opus','wav')", name="ck_captures_format"),
        sa.CheckConstraint("duration_ms > 0 AND duration_ms <= 60000",
                           name="ck_captures_duration"),
    )
    op.create_index("idx_captures_user", "captures", ["user_id"])
    op.create_index("idx_captures_orphan", "captures", ["ref_count", "created_at"],
                    postgresql_where=sa.text("ref_count = 0"))

    op.create_table(
        "recordings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("format", sa.Text(), nullable=False),
        sa.Column("patch_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("patches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("visibility", sa.Text(), nullable=False,
                  server_default="unlisted"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.CheckConstraint("format IN ('opus','wav')", name="ck_recordings_format"),
        sa.CheckConstraint("visibility IN ('unlisted','public')",
                           name="ck_recordings_visibility"),
    )
    op.create_index("idx_recordings_user", "recordings", ["user_id"])


def downgrade() -> None:
    op.drop_table("recordings")
    op.drop_table("captures")
    op.drop_table("patches")
    op.drop_table("users")
