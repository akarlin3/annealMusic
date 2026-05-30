"""v4_5 session history + curated library

Revision ID: 0015_v4_5_history_library
Revises: 0014_v4_4_breath
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0015_v4_5_history_library"
down_revision: str | None = "0014_v4_4_breath"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB() if is_pg else sa.JSON()

    # --- session_plays: private per-user practice history ---------------------
    op.create_table(
        "session_plays",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "listening_session_id",
            uuid_type,
            sa.ForeignKey("listening_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "duration_listened_ms",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("reflection", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_session_plays_user",
        "session_plays",
        ["user_id", sa.text("started_at DESC")],
    )

    # --- library_listings: editorial /listen catalog --------------------------
    op.create_table(
        "library_listings",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "listening_session_id",
            uuid_type,
            sa.ForeignKey("listening_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("intention", sa.Text(), nullable=True),
        sa.Column("length_category", sa.Text(), nullable=True),
        sa.Column(
            "character_tags",
            json_type,
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "editor_pick",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("editor_pick_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("curator_note", sa.Text(), nullable=True),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_library_listing_session",
        "library_listings",
        ["listening_session_id"],
    )

    if is_pg:
        # Partial indexes mirroring the active-listing / picks query shapes.
        op.create_index(
            "idx_library_active",
            "library_listings",
            ["intention", "length_category"],
            postgresql_where=sa.text("archived_at IS NULL"),
        )
        op.create_index(
            "idx_library_picks",
            "library_listings",
            [sa.text("editor_pick_at DESC")],
            postgresql_where=sa.text("editor_pick = TRUE AND archived_at IS NULL"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.drop_index("idx_library_picks", table_name="library_listings")
        op.drop_index("idx_library_active", table_name="library_listings")
    op.drop_index("idx_library_listing_session", table_name="library_listings")
    op.drop_table("library_listings")

    op.drop_index("idx_session_plays_user", table_name="session_plays")
    op.drop_table("session_plays")
