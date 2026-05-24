"""recordings: short_slug for /r/<slug> public links

Revision ID: 0003_recording_slug
Revises: 0002_gallery
Create Date: 2026-05-24
"""
from __future__ import annotations

import secrets
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_recording_slug"
down_revision: str | None = "0002_gallery"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"


def _slug() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(8))


def upgrade() -> None:
    # Add nullable first so existing rows survive, backfill unique slugs, then
    # enforce NOT NULL + UNIQUE.
    op.add_column("recordings", sa.Column("short_slug", sa.String(), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM recordings")).fetchall()
    for (rid,) in rows:
        bind.execute(
            sa.text("UPDATE recordings SET short_slug = :s WHERE id = :id"),
            {"s": _slug(), "id": rid},
        )

    op.alter_column("recordings", "short_slug", nullable=False)
    op.create_unique_constraint(
        "uq_recordings_short_slug", "recordings", ["short_slug"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_recordings_short_slug", "recordings", type_="unique")
    op.drop_column("recordings", "short_slug")
