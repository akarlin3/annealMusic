from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_social_checkpoint1 import _create_test_account


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


async def _make_track(client, admin_key, slug="synth-fundamentals") -> dict:
    r = await client.post(
        "/api/v1/admin/tracks",
        headers={"x-admin-key": admin_key},
        json={"slug": slug, "title": slug.title(), "position": 1},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _make_lesson(
    client, admin_key, track_id, slug, *, difficulty="intro", position=1, prereqs=None
) -> dict:
    r = await client.post(
        "/api/v1/admin/lessons",
        headers={"x-admin-key": admin_key},
        json={
            "track_id": track_id,
            "slug": slug,
            "title": slug.replace("-", " ").title(),
            "difficulty": difficulty,
            "estimated_minutes": 8,
            "position": position,
            "prerequisites": prereqs or [],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _signed_in(client, email: str) -> tuple[dict, uuid.UUID]:
    from app.db import get_sessionmaker

    sm = get_sessionmaker()
    sess_id, acc_id = uuid.uuid4(), uuid.uuid4()
    anon = str(uuid.uuid4())
    await _create_test_account(sm, email, sess_id, acc_id)
    client.cookies.set("am_session", str(sess_id))
    await client.post("/api/v1/account/me/claim", json={"anon_id": anon})
    return _hdr(anon), sess_id


# --- Basic upsert / resume ---------------------------------------------------


async def test_upsert_and_resume_progress(client, admin_key):
    track = await _make_track(client, admin_key)
    lesson = await _make_lesson(client, admin_key, track["id"], "drift")
    h, sess = await _signed_in(client, "prog1@example.com")
    client.cookies.set("am_session", str(sess))

    # Open + heartbeat at step 2 with a scroll position.
    r = await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={
            "lesson_id": lesson["id"],
            "state": "in_progress",
            "current_step_position": 2,
            "scroll_ratio": 0.4,
            "step_actions": [{"step_position": 2, "action": "started", "ms": 1200}],
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "in_progress"
    assert body["current_step_position"] == 2
    assert body["scroll_ratio"] == pytest.approx(0.4)
    assert body["started_at"] is not None

    # Resume fetch returns the saved step + scroll.
    g = await client.get(f"/api/v1/lesson-progress/{lesson['id']}", headers=h)
    assert g.status_code == 200
    assert g.json()["current_step_position"] == 2
    assert g.json()["scroll_ratio"] == pytest.approx(0.4)


async def test_unopened_lesson_reads_not_started(client, admin_key):
    track = await _make_track(client, admin_key)
    lesson = await _make_lesson(client, admin_key, track["id"], "intro-lesson")
    h, sess = await _signed_in(client, "prog2@example.com")
    client.cookies.set("am_session", str(sess))

    g = await client.get(f"/api/v1/lesson-progress/{lesson['id']}", headers=h)
    assert g.status_code == 200
    assert g.json()["state"] == "not_started"
    assert g.json()["current_step_position"] == 0


async def test_completion_never_downgrades(client, admin_key):
    track = await _make_track(client, admin_key)
    lesson = await _make_lesson(client, admin_key, track["id"], "complete-me")
    h, sess = await _signed_in(client, "prog3@example.com")
    client.cookies.set("am_session", str(sess))

    await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={"lesson_id": lesson["id"], "state": "completed", "current_step_position": 5},
    )
    # Re-reading (a later in_progress heartbeat) must not un-complete it.
    r = await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={"lesson_id": lesson["id"], "state": "in_progress", "current_step_position": 0},
    )
    assert r.json()["state"] == "completed"
    assert r.json()["completed_at"] is not None


async def test_step_actions_are_bounded(client, admin_key):
    from app.services.progress_state import STEP_ACTIONS_CAP
    from app.db import get_sessionmaker
    from app.models import LessonProgress
    from sqlalchemy import select

    track = await _make_track(client, admin_key)
    lesson = await _make_lesson(client, admin_key, track["id"], "noisy")
    h, sess = await _signed_in(client, "prog4@example.com")
    client.cookies.set("am_session", str(sess))

    # Push more actions than the cap across several requests.
    for batch in range(3):
        actions = [
            {"step_position": i % 6, "action": "started", "ms": 10}
            for i in range(100)
        ]
        await client.post(
            "/api/v1/lesson-progress",
            headers=h,
            json={"lesson_id": lesson["id"], "step_actions": actions},
        )

    sm = get_sessionmaker()
    async with sm() as s:
        row = (
            await s.execute(
                select(LessonProgress).where(LessonProgress.lesson_id == uuid.UUID(lesson["id"]))
            )
        ).scalar_one()
        assert len(row.step_actions) == STEP_ACTIONS_CAP


# --- Track summary -----------------------------------------------------------


async def test_track_summary_counts(client, admin_key):
    track = await _make_track(client, admin_key)
    l1 = await _make_lesson(client, admin_key, track["id"], "a", position=1)
    l2 = await _make_lesson(client, admin_key, track["id"], "b", position=2)
    await _make_lesson(client, admin_key, track["id"], "c", position=3)
    h, sess = await _signed_in(client, "prog5@example.com")
    client.cookies.set("am_session", str(sess))

    await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={"lesson_id": l1["id"], "state": "completed"},
    )
    await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={"lesson_id": l2["id"], "state": "in_progress"},
    )

    r = await client.get(f"/api/v1/lesson-progress/me/track/{track['slug']}", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_lessons"] == 3
    assert body["completed_lessons"] == 1
    assert body["in_progress_lessons"] == 1
    # Calm-by-design: descriptive counts only — no streak/score/percentage field.
    assert "streak" not in body and "score" not in body and "percent" not in body


# --- Cross-device ------------------------------------------------------------


async def test_progress_is_cross_device(client, admin_key):
    from app.db import get_sessionmaker

    track = await _make_track(client, admin_key)
    lesson = await _make_lesson(client, admin_key, track["id"], "xdev")

    sm = get_sessionmaker()
    sess_id, acc_id = uuid.uuid4(), uuid.uuid4()
    anon_a, anon_b = str(uuid.uuid4()), str(uuid.uuid4())
    await _create_test_account(sm, "xdev@example.com", sess_id, acc_id)
    client.cookies.set("am_session", str(sess_id))
    await client.post("/api/v1/account/me/claim", json={"anon_id": anon_a})
    await client.post("/api/v1/account/me/claim", json={"anon_id": anon_b})

    # Device A makes progress.
    client.cookies.set("am_session", str(sess_id))
    await client.post(
        "/api/v1/lesson-progress",
        headers=_hdr(anon_a),
        json={"lesson_id": lesson["id"], "state": "in_progress", "current_step_position": 3},
    )

    # Device B (same account) sees it.
    client.cookies.set("am_session", str(sess_id))
    g = await client.get(f"/api/v1/lesson-progress/{lesson['id']}", headers=_hdr(anon_b))
    assert g.status_code == 200
    assert g.json()["current_step_position"] == 3


# --- Anon → authed import merge ----------------------------------------------


async def test_import_merge_preserves_completion(client, admin_key):
    track = await _make_track(client, admin_key)
    l_done = await _make_lesson(client, admin_key, track["id"], "done", position=1)
    l_mid = await _make_lesson(client, admin_key, track["id"], "mid", position=2)
    h, sess = await _signed_in(client, "import1@example.com")
    client.cookies.set("am_session", str(sess))

    # Server already has l_done completed.
    await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={"lesson_id": l_done["id"], "state": "completed"},
    )

    # Imported localStorage tries to downgrade l_done and add l_mid in_progress.
    r = await client.post(
        "/api/v1/lesson-progress/import",
        headers=h,
        json={
            "items": [
                {"lesson_id": l_done["id"], "state": "in_progress", "current_step_position": 1},
                {"lesson_id": l_mid["id"], "state": "in_progress", "current_step_position": 4},
            ]
        },
    )
    assert r.status_code == 200, r.text
    by_id = {item["lesson_id"]: item for item in r.json()["items"]}
    # Completion is never downgraded.
    assert by_id[l_done["id"]]["state"] == "completed"
    # New in-progress lesson imported with its step position.
    assert by_id[l_mid["id"]]["state"] == "in_progress"
    assert by_id[l_mid["id"]]["current_step_position"] == 4


async def test_import_is_idempotent(client, admin_key):
    track = await _make_track(client, admin_key)
    lesson = await _make_lesson(client, admin_key, track["id"], "idem")
    h, sess = await _signed_in(client, "import2@example.com")
    client.cookies.set("am_session", str(sess))

    payload = {
        "items": [
            {"lesson_id": lesson["id"], "state": "in_progress", "current_step_position": 2}
        ]
    }
    r1 = await client.post("/api/v1/lesson-progress/import", headers=h, json=payload)
    r2 = await client.post("/api/v1/lesson-progress/import", headers=h, json=payload)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r2.json()["items"][0]["current_step_position"] == 2

    # Exactly one row exists for this (account, lesson).
    listing = await client.get("/api/v1/lesson-progress", headers=h)
    rows = [i for i in listing.json()["items"] if i["lesson_id"] == lesson["id"]]
    assert len(rows) == 1


async def test_import_requires_account(client, admin_key):
    track = await _make_track(client, admin_key)
    lesson = await _make_lesson(client, admin_key, track["id"], "anon-import")
    r = await client.post(
        "/api/v1/lesson-progress/import",
        headers=_hdr(),
        json={"items": [{"lesson_id": lesson["id"], "state": "in_progress"}]},
    )
    assert r.status_code == 401


# --- Abandonment is computed, not stored -------------------------------------


async def test_abandoned_is_derived_after_30_days(client, admin_key):
    from app.db import get_sessionmaker
    from app.models import LessonProgress
    from sqlalchemy import select

    track = await _make_track(client, admin_key)
    lesson = await _make_lesson(client, admin_key, track["id"], "stale")
    h, sess = await _signed_in(client, "stale@example.com")
    client.cookies.set("am_session", str(sess))

    await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={"lesson_id": lesson["id"], "state": "in_progress", "current_step_position": 1},
    )

    # Backdate last_active_at by 40 days.
    sm = get_sessionmaker()
    async with sm() as s:
        row = (
            await s.execute(
                select(LessonProgress).where(
                    LessonProgress.lesson_id == uuid.UUID(lesson["id"])
                )
            )
        ).scalar_one()
        row.last_active_at = datetime.now(tz=timezone.utc) - timedelta(days=40)
        # The stored state stays 'in_progress' (never written as abandoned).
        assert row.state == "in_progress"
        await s.commit()

    g = await client.get(f"/api/v1/lesson-progress/{lesson['id']}", headers=h)
    assert g.json()["state"] == "abandoned"
