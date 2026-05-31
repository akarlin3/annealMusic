"""v6.4 curriculum: seed the two new tracks (ambient history, production/DAW)

Revision ID: 0022_v6_4_curriculum_tracks
Revises: 0021_v6_3_lesson_progress
Create Date: 2026-05-30

Adds the two tracks the v6.4 curriculum introduces alongside the three seeded in
0018. Lessons themselves are authored as specs and seeded in a later migration
(CP2); this migration only establishes the track rows so specs can attach.
Idempotent on slug — skips a track that already exists.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0022_v6_4_curriculum_tracks"
down_revision: str | None = "0021_v6_3_lesson_progress"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _seed_uuid(is_pg: bool):
    """Bind ``uuid`` columns correctly for seed inserts (see 0018)."""
    return postgresql.UUID(as_uuid=False) if is_pg else sa.String()


_NEW_TRACKS = [
    {
        "id": "d4f6f6d7-1c97-4a7e-8a54-f49f0de2e564",
        "slug": "ambient-history-listening",
        "title": "Ambient History & Listening",
        "description": "From Satie and Eno to Japanese ambient and hauntology — the lineage and how to listen.",
        "position": 2,
        "color": "#f59e0b",
    },
    {
        "id": "e5f7f7e8-2da8-4b8f-9b65-05a01ef3f675",
        "slug": "production-daw",
        "title": "Production & DAW",
        "description": "Stems, mixing, spatial reverb, mastering, and getting AnnealMusic into your DAW.",
        "position": 3,
        "color": "#0ea5e9",
    },
]


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    tracks_table = sa.table(
        "tracks",
        sa.column("id", _seed_uuid(is_pg)),
        sa.column("slug", sa.String()),
        sa.column("title", sa.String()),
        sa.column("description", sa.String()),
        sa.column("position", sa.Integer()),
        sa.column("color", sa.String()),
    )

    # Push the existing music-science-crossover track to the end so the two new
    # mid-curriculum tracks read in pedagogical order. Position is display-only.
    op.execute(
        sa.text("UPDATE tracks SET position = 4 WHERE slug = 'music-science-crossover'")
    )

    existing = set(
        bind.execute(sa.text("SELECT slug FROM tracks")).scalars().all()
    )
    to_insert = [t for t in _NEW_TRACKS if t["slug"] not in existing]
    if to_insert:
        op.bulk_insert(tracks_table, to_insert)


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM tracks WHERE slug IN "
            "('ambient-history-listening', 'production-daw')"
        )
    )
    op.execute(
        sa.text("UPDATE tracks SET position = 2 WHERE slug = 'music-science-crossover'")
    )
