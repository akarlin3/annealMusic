"""Tests for v6.5 admin lesson-analytics endpoints + pure helpers.

The repo uses pytest-asyncio in ``asyncio_mode = "auto"`` (see pyproject), so
async tests need no marker; ``client`` comes from ``tests/conftest.py``.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.config import get_settings
from app.db import get_sessionmaker
from app.models import Lesson, LessonProgress, LessonStep, Track, User
from app.services import analytics


@pytest.fixture
def admin_headers(monkeypatch):
    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return {"x-admin-key": "secret"}


NOW = datetime(2026, 5, 30, tzinfo=timezone.utc)


async def _seed():
    """Two lessons in one track; L1 has four steps (prompt @2, audio-clip @3),
    three learners (complete / in-progress / abandoned) and an L1->L2 path."""
    sm = get_sessionmaker()
    async with sm() as session:
        track = Track(slug="synthesis-fundamentals", title="Synthesis", position=0)
        session.add(track)
        await session.flush()

        l1 = Lesson(track_id=track.id, slug="fm-engine", title="FM", difficulty="intro", position=0)
        l2 = Lesson(track_id=track.id, slug="granular-engine", title="Granular", difficulty="intermediate", position=1)
        session.add_all([l1, l2])
        await session.flush()
        l2.prerequisites = [l1.id]

        session.add_all(
            [
                LessonStep(lesson_id=l1.id, position=0, type="text", config={}),
                LessonStep(lesson_id=l1.id, position=1, type="text", config={}),
                LessonStep(lesson_id=l1.id, position=2, type="prompt", config={"prompt": "try it"}),
                LessonStep(lesson_id=l1.id, position=3, type="audio-clip", config={"clip_id": "clipA"}),
            ]
        )

        users = [User() for _ in range(3)]
        session.add_all(users)
        await session.flush()
        ua, ub, uc = users

        # userA: completed L1, reflected, reached every step, tried the prompt, played the clip.
        session.add(
            LessonProgress(
                user_id=ua.id, lesson_id=l1.id, state="completed",
                current_step_position=3, started_at=NOW - timedelta(minutes=5),
                completed_at=NOW, last_active_at=NOW, reflection_text="nice",
                step_actions=[
                    {"step_position": 0, "action": "started", "ms": 1000},
                    {"step_position": 1, "action": "started", "ms": 2000},
                    {"step_position": 2, "action": "started", "ms": 3000},
                    {"step_position": 3, "action": "completed", "ms": 4000},
                    {"step_position": 2, "action": "prompt_tried"},
                    {"step_position": 3, "action": "clip_play"},
                ],
            )
        )
        # userB: in-progress, reached step 1.
        session.add(
            LessonProgress(
                user_id=ub.id, lesson_id=l1.id, state="in_progress",
                current_step_position=1, started_at=NOW, last_active_at=NOW,
                step_actions=[
                    {"step_position": 0, "action": "started", "ms": 1500},
                    {"step_position": 1, "action": "started", "ms": 500},
                ],
            )
        )
        # userC: in-progress but inactive 40 days -> abandoned (computed).
        session.add(
            LessonProgress(
                user_id=uc.id, lesson_id=l1.id, state="in_progress",
                current_step_position=0, started_at=NOW - timedelta(days=41),
                last_active_at=NOW - timedelta(days=40),
                step_actions=[{"step_position": 0, "action": "started", "ms": 800}],
            )
        )
        # userA also started L2 after L1 -> observed path L1 -> L2.
        session.add(
            LessonProgress(
                user_id=ua.id, lesson_id=l2.id, state="in_progress",
                current_step_position=0, started_at=NOW, last_active_at=NOW,
                step_actions=[],
            )
        )
        await session.commit()
        return track.id, l1.id, l2.id


# --------------------------------------------------------------------------- #
# Pure helpers — no DB.
# --------------------------------------------------------------------------- #
def test_compute_dropoff():
    actions = [
        [{"step_position": p, "action": "started", "ms": 1} for p in range(4)],
        [{"step_position": p, "action": "started", "ms": 1} for p in range(2)],
        [{"step_position": 0, "action": "started", "ms": 1}],
    ]
    assert analytics.compute_dropoff(actions, 4) == [1.0, 0.6667, 0.3333, 0.3333]
    assert analytics.compute_dropoff([], 0) == []


def test_compute_step_times_discards_walkaways():
    actions = [[{"step_position": 0, "action": "started", "ms": 99 * 60 * 1000}]]
    assert analytics.compute_step_times(actions, 1)[0]["count"] == 0


def test_compute_prompt_stats():
    actions = [
        [{"step_position": 2, "action": "prompt_tried"}],
        [{"step_position": 2, "action": "prompt_skipped"}],
    ]
    stats = analytics.compute_prompt_stats(actions, {2})
    assert stats["tried"] == 1 and stats["skipped"] == 1
    assert stats["tried_ratio"] == 0.5


# --------------------------------------------------------------------------- #
# Endpoints.
# --------------------------------------------------------------------------- #
async def test_requires_admin_key(client):
    # ADMIN_KEY unset -> surface looks absent (404).
    r = await client.get("/api/v1/admin/analytics/lessons")
    assert r.status_code == 404


async def test_lessons_rollup(client, admin_headers):
    _track, l1, _l2 = await _seed()
    r = await client.get("/api/v1/admin/analytics/lessons", headers=admin_headers)
    assert r.status_code == 200
    row = {i["lesson_id"]: i for i in r.json()["items"]}[str(l1)]
    assert row["views"] == 3
    assert row["completions"] == 1
    assert row["completion_rate"] == 0.3333
    assert row["avg_completion_ms"] == 300000
    assert row["abandonments"] == 1
    assert row["reflections"] == 1
    assert row["slug"] == "fm-engine"


async def test_lesson_detail(client, admin_headers):
    _track, l1, _l2 = await _seed()
    r = await client.get(f"/api/v1/admin/analytics/lessons/{l1}", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_steps"] == 4
    assert body["dropoff"] == [1.0, 0.6667, 0.3333, 0.3333]
    assert body["prompt_stats"]["tried"] == 1
    clip = {c["clip_slug"]: c for c in body["clip_stats"]}["clipA"]
    assert clip["plays"] == 1 and clip["exposures"] == 1 and clip["skips"] == 0


async def test_lesson_detail_404(client, admin_headers):
    r = await client.get(f"/api/v1/admin/analytics/lessons/{uuid.uuid4()}", headers=admin_headers)
    assert r.status_code == 404


async def test_tracks_rollup_path_popularity(client, admin_headers):
    _track, _l1, _l2 = await _seed()
    r = await client.get("/api/v1/admin/analytics/tracks", headers=admin_headers)
    assert r.status_code == 200
    track = r.json()["items"][0]
    assert track["slug"] == "synthesis-fundamentals"
    assert track["lessons"] == 2
    assert track["completions"] == 1
    paths = {(p["from"], p["to"]): p for p in track["top_paths"]}
    assert ("fm-engine", "granular-engine") in paths
    assert paths[("fm-engine", "granular-engine")]["on_graph"] is True


async def test_clips_rollup(client, admin_headers):
    await _seed()
    r = await client.get("/api/v1/admin/analytics/clips", headers=admin_headers)
    assert r.status_code == 200
    clip = {c["clip_slug"]: c for c in r.json()["items"]}["clipA"]
    assert clip["plays"] == 1
    assert clip["exposures"] == 1


async def test_refresh_noop_on_sqlite(client, admin_headers):
    r = await client.post("/api/v1/admin/analytics/refresh", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["refreshed"] is False


async def test_no_user_ids_in_any_payload(client, admin_headers):
    _track, l1, _l2 = await _seed()
    sm = get_sessionmaker()
    async with sm() as session:
        from sqlalchemy import select

        user_ids = {str(u) for u in (await session.execute(select(User.id))).scalars().all()}
    for path in [
        "/api/v1/admin/analytics/lessons",
        f"/api/v1/admin/analytics/lessons/{l1}",
        "/api/v1/admin/analytics/tracks",
        "/api/v1/admin/analytics/clips",
    ]:
        blob = json.dumps((await client.get(path, headers=admin_headers)).json())
        assert "user_id" not in blob
        for uid in user_ids:
            assert uid not in blob
