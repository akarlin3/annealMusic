from __future__ import annotations

import uuid
import pytest


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


async def test_curriculum_end_to_end(client, admin_key):
    # 1. Create a track
    track_payload = {
        "slug": "synth-fundamentals",
        "title": "Synthesis Fundamentals",
        "description": "How the engines work",
        "position": 1,
        "color": "#f59e0b",
    }
    r = await client.post(
        "/api/v1/admin/tracks",
        headers={"x-admin-key": admin_key},
        json=track_payload,
    )
    assert r.status_code == 201, r.text
    track = r.json()
    assert track["slug"] == "synth-fundamentals"
    assert track["title"] == "Synthesis Fundamentals"
    assert track["position"] == 1
    assert track["color"] == "#f59e0b"
    assert track["id"]

    # 2. Duplicate track slug should fail
    dup_track = await client.post(
        "/api/v1/admin/tracks",
        headers={"x-admin-key": admin_key},
        json=track_payload,
    )
    assert dup_track.status_code == 400

    # 3. Create a lesson in that track
    lesson_payload = {
        "track_id": track["id"],
        "slug": "understanding-drift",
        "title": "Understanding Drift",
        "description": "Explore organic beatings",
        "difficulty": "intro",
        "estimated_minutes": 8,
        "position": 1,
        "prerequisites": [],
    }
    r = await client.post(
        "/api/v1/admin/lessons",
        headers={"x-admin-key": admin_key},
        json=lesson_payload,
    )
    assert r.status_code == 201, r.text
    lesson = r.json()
    assert lesson["slug"] == "understanding-drift"
    assert lesson["title"] == "Understanding Drift"
    assert lesson["difficulty"] == "intro"
    assert lesson["estimated_minutes"] == 8
    assert lesson["position"] == 1
    assert lesson["id"]

    # 4. Duplicate lesson slug in the same track should fail
    dup_lesson = await client.post(
        "/api/v1/admin/lessons",
        headers={"x-admin-key": admin_key},
        json=lesson_payload,
    )
    assert dup_lesson.status_code == 400

    # 5. Add a step to the lesson
    step_payload = {
        "position": 1,
        "type": "text",
        "config": {"header": "Drift intro", "body": "Drift makes it warm."},
    }
    r = await client.post(
        f"/api/v1/admin/lesson-steps?lesson_id={lesson['id']}",
        headers={"x-admin-key": admin_key},
        json=step_payload,
    )
    assert r.status_code == 201, r.text
    step = r.json()
    assert step["position"] == 1
    assert step["type"] == "text"
    assert step["config"]["header"] == "Drift intro"
    assert step["id"]

    # 6. Duplicate step position in same lesson should fail
    dup_step = await client.post(
        f"/api/v1/admin/lesson-steps?lesson_id={lesson['id']}",
        headers={"x-admin-key": admin_key},
        json=step_payload,
    )
    assert dup_step.status_code == 400

    # 7. List public tracks (Public API)
    tracks_res = await client.get("/api/v1/tracks")
    assert tracks_res.status_code == 200
    tracks = tracks_res.json()["items"]
    assert len(tracks) == 1
    assert tracks[0]["slug"] == "synth-fundamentals"
    assert len(tracks[0]["lessons"]) == 1
    assert tracks[0]["lessons"][0]["slug"] == "understanding-drift"
    assert len(tracks[0]["lessons"][0]["steps"]) == 1
    assert tracks[0]["lessons"][0]["steps"][0]["config"]["header"] == "Drift intro"

    # 8. Retrieve track details by slug
    track_res = await client.get("/api/v1/tracks/synth-fundamentals")
    assert track_res.status_code == 200
    assert track_res.json()["slug"] == "synth-fundamentals"

    # 9. Retrieve specific lesson steps by slugs
    lesson_res = await client.get("/api/v1/lessons/synth-fundamentals/understanding-drift")
    assert lesson_res.status_code == 200
    res_lesson = lesson_res.json()
    assert res_lesson["slug"] == "understanding-drift"
    assert len(res_lesson["steps"]) == 1
    assert res_lesson["steps"][0]["position"] == 1

    # 10. Update track/lesson/step parameters
    up_track = await client.patch(
        f"/api/v1/admin/tracks/{track['id']}",
        headers={"x-admin-key": admin_key},
        json={"title": "Synth Fundamentals V2"},
    )
    assert up_track.status_code == 200
    assert up_track.json()["title"] == "Synth Fundamentals V2"

    up_lesson = await client.patch(
        f"/api/v1/admin/lessons/{lesson['id']}",
        headers={"x-admin-key": admin_key},
        json={"estimated_minutes": 15},
    )
    assert up_lesson.status_code == 200
    assert up_lesson.json()["estimated_minutes"] == 15

    up_step = await client.patch(
        f"/api/v1/admin/lesson-steps/{step['id']}",
        headers={"x-admin-key": admin_key},
        json={"config": {"header": "Drift intro V2", "body": "Super warm."}},
    )
    assert up_step.status_code == 200
    assert up_step.json()["config"]["header"] == "Drift intro V2"


async def test_auth_gates(client, admin_key):
    # If x-admin-key is missing or wrong, return 401 when ADMIN_KEY is configured
    r1 = await client.post("/api/v1/admin/tracks", json={"slug": "no", "title": "No"})
    assert r1.status_code == 401

    r2 = await client.patch(f"/api/v1/admin/tracks/{uuid.uuid4()}", json={"title": "No"}, headers={"x-admin-key": "wrong"})
    assert r2.status_code == 401

    r3 = await client.post(f"/api/v1/admin/lesson-steps?lesson_id={uuid.uuid4()}", json={"position": 1, "type": "text", "config": {}}, headers={"x-admin-key": "wrong"})
    assert r3.status_code == 401


async def test_auth_disabled_without_key(client):
    # ADMIN_KEY unset -> returns 404
    r1 = await client.post("/api/v1/admin/tracks", json={"slug": "no", "title": "No"})
    assert r1.status_code == 404

