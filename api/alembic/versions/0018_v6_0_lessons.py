"""v6_0 lessons curriculum

Revision ID: 0018_v6_0_lessons
Revises: 0017_v5_6_experiments
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_v6_0_lessons"
down_revision: str | None = "0017_v5_6_experiments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _seed_uuid(is_pg: bool):
    """Bind type for id/fk columns in seed ``sa.table()`` helpers.

    The real columns are ``uuid`` on Postgres; a bare ``sa.String()`` makes
    asyncpg bind VARCHAR and Postgres rejects ``uuid = varchar``. Declaring the
    proper type lets the same string literals bind cleanly on both dialects.
    """
    return postgresql.UUID(as_uuid=False) if is_pg else sa.String()


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()
    array_type = postgresql.ARRAY(postgresql.UUID(as_uuid=True)) if is_pg else sa.String()

    # Create tracks table
    op.create_table(
        "tracks",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("slug", name="uq_tracks_slug"),
    )
    op.create_index("idx_tracks_slug", "tracks", ["slug"], unique=True)

    # Create lessons table
    op.create_table(
        "lessons",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "track_id",
            uuid_type,
            sa.ForeignKey("tracks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=False, server_default="intro"),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prerequisites", array_type, nullable=False, server_default=sa.text("'{}'") if is_pg else sa.text("'[]'")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("track_id", "slug", name="uq_lessons_track_slug"),
        sa.CheckConstraint(
            "difficulty IN ('intro', 'intermediate', 'advanced')",
            name="ck_lessons_difficulty",
        ),
    )
    op.create_index("idx_lessons_track", "lessons", ["track_id"], unique=False)

    # Create lesson_steps table
    op.create_table(
        "lesson_steps",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "lesson_id",
            uuid_type,
            sa.ForeignKey("lessons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("config", json_type, nullable=False),
        sa.UniqueConstraint("lesson_id", "position", name="uq_lesson_steps_lesson_position"),
    )
    op.create_index("idx_lesson_steps_lesson", "lesson_steps", ["lesson_id"], unique=False)

    # --- Seeding curriculum data ---------------------------------------------
    import json

    # 1. Seed tracks
    tracks_data = [
        {
            "id": "a1f3c3a4-8f64-4e4b-9721-c16e7ab9b231",
            "slug": "synthesis-fundamentals",
            "title": "Synthesis Fundamentals",
            "description": "Master the physics of phase coupling, analogue drift, and oscillator synchronization.",
            "position": 0,
            "color": "#6366f1",
        },
        {
            "id": "b2f4d4b5-9a75-4f5c-8832-d27e8bc0c342",
            "slug": "composition-technique",
            "title": "Composition Technique",
            "description": "Explore ambient composition, microtonal movements, and spatial placement.",
            "position": 1,
            "color": "#ec4899",
        },
        {
            "id": "c3f5e5c6-0b86-5f6d-9943-e38f9cd1d453",
            "slug": "music-science-crossover",
            "title": "Music + Science Crossover",
            "description": "Examine historical tuning temperaments and the mathematics of consonance.",
            "position": 2,
            "color": "#10b981",
        },
    ]
    tracks_table = sa.table(
        "tracks",
        sa.column("id", _seed_uuid(is_pg)),
        sa.column("slug", sa.String()),
        sa.column("title", sa.String()),
        sa.column("description", sa.String()),
        sa.column("position", sa.Integer()),
        sa.column("color", sa.String()),
    )
    op.bulk_insert(tracks_table, tracks_data)

    # 2. Seed lessons
    lessons_data = [
        {
            "id": "d4f6f6d7-1c97-6f7e-aa54-f490ade2d564",
            "track_id": "a1f3c3a4-8f64-4e4b-9721-c16e7ab9b231",
            "slug": "drift-coupling",
            "title": "Drift and Coupling",
            "description": "Learn how phase-coupling creates emergent order out of chaotic analogue drift.",
            "difficulty": "intro",
            "estimated_minutes": 5,
            "position": 0,
            "prerequisites": "[]" if not is_pg else [],
        },
        {
            "id": "e5f7a7e8-2da8-7f8f-bb65-05a1bdf3e675",
            "track_id": "b2f4d4b5-9a75-4f5c-8832-d27e8bc0c342",
            "slug": "exploring-movements",
            "title": "Exploring Movements",
            "description": "Sculpt ambient tension with slow spatial parameters and LFO modulations.",
            "difficulty": "intermediate",
            "estimated_minutes": 8,
            "position": 0,
            "prerequisites": "[]" if not is_pg else [],
        },
        {
            "id": "f6f8b8f9-3eb9-8faf-cc76-16b2cef4f786",
            "track_id": "c3f5e5c6-0b86-5f6d-9943-e38f9cd1d453",
            "slug": "physics-of-tuning",
            "title": "The Physics of Tuning",
            "description": "Mathematically decode consonant intervals through Pythagorean and Just Intonation ratios.",
            "difficulty": "advanced",
            "estimated_minutes": 10,
            "position": 0,
            "prerequisites": "[]" if not is_pg else [],
        },
    ]
    lessons_table = sa.table(
        "lessons",
        sa.column("id", _seed_uuid(is_pg)),
        sa.column("track_id", _seed_uuid(is_pg)),
        sa.column("slug", sa.String()),
        sa.column("title", sa.String()),
        sa.column("description", sa.String()),
        sa.column("difficulty", sa.String()),
        sa.column("estimated_minutes", sa.Integer()),
        sa.column("position", sa.Integer()),
        sa.column(
            "prerequisites",
            postgresql.ARRAY(postgresql.UUID(as_uuid=False)) if is_pg else sa.String(),
        ),
    )
    op.bulk_insert(lessons_table, lessons_data)

    # 3. Seed lesson steps
    steps_data = [
        # Drift & Coupling
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "lesson_id": "d4f6f6d7-1c97-6f7e-aa54-f490ade2d564",
            "position": 0,
            "type": "text",
            "config": {
                "title": "Phase Synchronization & Coupling",
                "content": "When two sound oscillators are close in frequency, we hear a beating effect. In physical instruments, coupling can cause them to align and phase-lock, syncing their frequencies. In AnnealMusic, coupling bridges the gap between chaos and harmony.\n\nDrift represents the natural, slow thermal frequency drift of analogue circuits, adding subtle pitch instability.",
                "key_points": [
                    "Coupling forces oscillators to sync frequencies.",
                    "Drift introduces subtle organic pitch instability.",
                    "When drift exceeds coupling, the oscillators break synchronization.",
                ],
            },
        },
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "lesson_id": "d4f6f6d7-1c97-6f7e-aa54-f490ade2d564",
            "position": 1,
            "type": "demo",
            "config": {
                "title": "Hearing Synchronization",
                "description": "Listen to this high-coupling patch. The oscillators are completely locked in frequency, producing a clean, unified harmonic drone with minimal drift beating.",
                "patch": {
                    "coupling": 0.8,
                    "drift": 0.1,
                    "brightness": 0.5,
                    "space": 0.4,
                    "speed": 0.3,
                },
                "highlights": ["coupling", "drift"],
            },
        },
        {
            "id": "33333333-3333-3333-3333-333333333333",
            "lesson_id": "d4f6f6d7-1c97-6f7e-aa54-f490ade2d564",
            "position": 2,
            "type": "prompt",
            "config": {
                "title": "Break the Lock",
                "prompt": "Adjust the drift parameter up and observe how the sync breaks, introducing complex, pulsing frequency beats. You will only be allowed to modify drift and brightness.",
                "constraints": ["drift", "brightness"],
                "hint": "Keep coupling at 0.8, and turn drift up to 0.9. You will hear the clean sync dissolve into rich beatings.",
            },
        },
        {
            "id": "44444444-4444-4444-4444-444444444444",
            "lesson_id": "d4f6f6d7-1c97-6f7e-aa54-f490ade2d564",
            "position": 3,
            "type": "reflection",
            "config": {
                "title": "Analysing the Friction",
                "prompt": "How does the tone change when the system is on the verge of breaking synchronization?",
                "placeholder": "Describe the beating speed and harmonic tension...",
            },
        },
        # Exploring Movements
        {
            "id": "55555555-5555-5555-5555-555555555555",
            "lesson_id": "e5f7a7e8-2da8-7f8f-bb65-05a1bdf3e675",
            "position": 0,
            "type": "text",
            "config": {
                "title": "The Power of Slow Shifts",
                "content": "In ambient synthesis, the finest details lie in the slowest movements. Instead of rapid adjustments, microtonal drift and slow spatial parameter updates allow the mind to map the full acoustic space.\n\nBy adjusting space (reverb size) and speed (LFO modulation), we create deep cinematic soundscapes.",
                "key_points": [
                    "Slow adjustments allow ears to hear tiny frequency modulations.",
                    "Space and Speed determine the acoustic dimensions of the piece.",
                ],
            },
        },
        {
            "id": "66666666-6666-6666-6666-666666666666",
            "lesson_id": "e5f7a7e8-2da8-7f8f-bb65-05a1bdf3e675",
            "position": 1,
            "type": "prompt",
            "config": {
                "title": "Sculpting Space",
                "prompt": "Unlock the spatial fields and create a slow, expanding room by carefully increasing the space parameter while keeping speed low.",
                "constraints": ["space", "speed"],
                "hint": "Move space from 0.2 to 0.8, and set speed to 0.1.",
            },
        },
        # The Physics of Tuning
        {
            "id": "77777777-7777-7777-7777-777777777777",
            "lesson_id": "f6f8b8f9-3eb9-8faf-cc76-16b2cef4f786",
            "position": 0,
            "type": "text",
            "config": {
                "title": "Consonance and Ratios",
                "content": "Tuning is the foundation of musical mathematics. For thousands of years, musicians tuned their instruments using pure integer frequency ratios (e.g. 3:2 for a perfect fifth), known as Just Intonation or Pythagorean tuning. This contrasts with modern Equal Temperament, which compromises ratios to allow playing in any key.",
                "key_points": [
                    "Pure ratios produce perfectly clean, beating-free intervals.",
                    "Equal Temperament compromises pure intervals for modulation flexibility.",
                ],
            },
        },
        {
            "id": "88888888-8888-8888-8888-888888888888",
            "lesson_id": "f6f8b8f9-3eb9-8faf-cc76-16b2cef4f786",
            "position": 1,
            "type": "demo",
            "config": {
                "title": "Pure Just Intonation",
                "description": "Listen to this pure 5-limit Just Intonation chord. Notice the complete absence of muddy microtonal beats when the harmonics line up.",
                "patch": {
                    "tuning": "just-intonation",
                    "coupling": 0.5,
                    "drift": 0.0,
                },
                "highlights": ["tuning"],
            },
        },
    ]

    if not is_pg:
        for s in steps_data:
            s["config"] = json.dumps(s["config"])

    steps_table = sa.table(
        "lesson_steps",
        sa.column("id", _seed_uuid(is_pg)),
        sa.column("lesson_id", _seed_uuid(is_pg)),
        sa.column("position", sa.Integer()),
        sa.column("type", sa.String()),
        sa.column("config", json_type),
    )
    op.bulk_insert(steps_table, steps_data)



def downgrade() -> None:
    op.drop_index("idx_lesson_steps_lesson", table_name="lesson_steps")
    op.drop_table("lesson_steps")
    op.drop_index("idx_lessons_track", table_name="lessons")
    op.drop_table("lessons")
    op.drop_index("idx_tracks_slug", table_name="tracks")
    op.drop_table("tracks")
