"""v6.4 curriculum: seed the authored lesson specs + prerequisite graph

Revision ID: 0023_v6_4_curriculum_seed
Revises: 0022_v6_4_curriculum_tracks
Create Date: 2026-05-30

Seeds every authored lesson (from ``app.services.curriculum_content``) as a
spec-based lesson with ``generation_status='pending'`` — an admin runs batch
generation to fill in the per-step prose. Lesson UUIDs are deterministic
(uuid5 of the spec id) so prerequisites resolve and re-running is idempotent on
the (track_id, slug) unique constraint. The prerequisite edge list is applied as
a second pass over ``lessons.prerequisites``.
"""
from __future__ import annotations

import json
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.services import curriculum_content as cc

revision: str = "0023_v6_4_curriculum_seed"
down_revision: str | None = "0022_v6_4_curriculum_tracks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NS = uuid.NAMESPACE_URL


def _lesson_uuid(spec_id: str) -> str:
    return str(uuid.uuid5(_NS, f"annealmusic/lesson/{spec_id}"))


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"
    json_type = postgresql.JSONB if is_pg else sa.JSON()

    # Resolve track slug -> id from the already-seeded tracks.
    track_id_by_slug = {
        row[1]: str(row[0])
        for row in bind.execute(sa.text("SELECT id, slug FROM tracks")).all()
    }

    # Skip lessons that already exist (idempotent on track_id + slug).
    existing = {
        (str(r[0]), r[1])
        for r in bind.execute(sa.text("SELECT track_id, slug FROM lessons")).all()
    }

    spec_to_uuid = {l["id"]: _lesson_uuid(l["id"]) for l in cc.LESSONS}

    # Prerequisite uuids per lesson (applied after insert).
    prereqs_by_lesson: dict[str, list[str]] = {l["id"]: [] for l in cc.LESSONS}
    for pre, lesson in cc.PREREQ_EDGES:
        prereqs_by_lesson[lesson].append(spec_to_uuid[pre])

    # Track-local position counter.
    pos_by_track: dict[str, int] = {}

    lessons_data: list[dict] = []
    for lesson in cc.LESSONS:
        track_slug = lesson["track"]
        track_id = track_id_by_slug.get(track_slug)
        if track_id is None:
            continue  # track missing (shouldn't happen post-0022)
        slug = lesson["id"].split("/", 1)[1]
        pos = pos_by_track.get(track_slug, 0)
        pos_by_track[track_slug] = pos + 1
        if (track_id, slug) in existing:
            continue

        prereq_uuids = prereqs_by_lesson[lesson["id"]]
        spec_value = lesson if is_pg else json.dumps(lesson)
        lessons_data.append({
            "id": spec_to_uuid[lesson["id"]],
            "track_id": track_id,
            "slug": slug,
            "title": lesson["title"],
            "description": (lesson.get("objectives") or [None])[0],
            "difficulty": lesson["difficulty"],
            "estimated_minutes": lesson.get("estimated_minutes", 12),
            "position": pos,
            "prerequisites": prereq_uuids if is_pg else json.dumps(prereq_uuids),
            "spec": spec_value,
            "generation_status": "pending",
        })

    if not lessons_data:
        return

    lessons_table = sa.table(
        "lessons",
        sa.column("id", sa.String()),
        sa.column("track_id", sa.String()),
        sa.column("slug", sa.String()),
        sa.column("title", sa.String()),
        sa.column("description", sa.String()),
        sa.column("difficulty", sa.String()),
        sa.column("estimated_minutes", sa.Integer()),
        sa.column("position", sa.Integer()),
        sa.column("prerequisites", postgresql.ARRAY(postgresql.UUID(as_uuid=False)) if is_pg else sa.String()),
        sa.column("spec", json_type),
        sa.column("generation_status", sa.String()),
    )
    op.bulk_insert(lessons_table, lessons_data)


def downgrade() -> None:
    bind = op.get_bind()
    ids = [_lesson_uuid(l["id"]) for l in cc.LESSONS]
    if not ids:
        return
    # Delete steps first (FK), then lessons.
    placeholders = ", ".join(f":id{i}" for i in range(len(ids)))
    params = {f"id{i}": v for i, v in enumerate(ids)}
    bind.execute(
        sa.text(f"DELETE FROM lesson_steps WHERE lesson_id IN ({placeholders})"), params
    )
    bind.execute(
        sa.text(f"DELETE FROM lessons WHERE id IN ({placeholders})"), params
    )
