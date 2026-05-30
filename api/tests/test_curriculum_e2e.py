"""v6.4 CP2 — end-to-end curriculum coherence through the real API.

Seeds the authored content (mirroring migration 0023) into the test DB via the
ORM, then drives the admin prerequisite + QA endpoints to confirm the whole
curriculum loads, the graph resolves acyclically, and a learner could walk a
full track. This is the database-level analogue of "walk a complete track and
the lessons cohere".
"""

from __future__ import annotations

import uuid

import pytest

from app.services import curriculum_content as cc


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


def _ah() -> dict[str, str]:
    return {"x-admin-key": "secret"}


def _lesson_uuid(spec_id: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"annealmusic/lesson/{spec_id}")


async def _seed(app) -> None:
    """Insert tracks + lessons exactly as migration 0023 would (spec-based,
    pending), including the prerequisite edges."""
    from app.db import get_sessionmaker
    from app.models import Lesson, Track

    spec_to_uuid = {l["id"]: _lesson_uuid(l["id"]) for l in cc.LESSONS}
    prereqs: dict[str, list[uuid.UUID]] = {l["id"]: [] for l in cc.LESSONS}
    for pre, lesson in cc.PREREQ_EDGES:
        prereqs[lesson].append(spec_to_uuid[pre])

    sm = get_sessionmaker()
    async with sm() as session:
        track_ids: dict[str, uuid.UUID] = {}
        for i, t in enumerate(cc.TRACKS):
            tid = uuid.uuid5(uuid.NAMESPACE_URL, f"annealmusic/track/{t['slug']}")
            track_ids[t["slug"]] = tid
            session.add(Track(id=tid, slug=t["slug"], title=t["title"], position=i))
        pos: dict[str, int] = {}
        for lesson in cc.LESSONS:
            track = lesson["track"]
            p = pos.get(track, 0)
            pos[track] = p + 1
            session.add(Lesson(
                id=spec_to_uuid[lesson["id"]],
                track_id=track_ids[track],
                slug=lesson["id"].split("/", 1)[1],
                title=lesson["title"],
                description=(lesson.get("objectives") or [None])[0],
                difficulty=lesson["difficulty"],
                estimated_minutes=lesson.get("estimated_minutes", 12),
                position=p,
                prerequisites=prereqs[lesson["id"]],
                spec=lesson,
                generation_status="pending",
            ))
        await session.commit()


async def test_full_curriculum_seeds_and_graph_resolves(app, client, admin_key):
    await _seed(app)

    # The prerequisite graph endpoint returns every lesson as a node and the
    # authored edges, with no cycle (PUT would reject one).
    r = await client.get("/api/v1/admin/curriculum/prereqs", headers=_ah())
    assert r.status_code == 200, r.text
    graph = r.json()
    assert len(graph["nodes"]) == len(cc.LESSONS)
    assert len(graph["edges"]) == len(cc.PREREQ_EDGES)

    # Re-applying the same edge set is accepted (still a DAG).
    r = await client.put("/api/v1/admin/curriculum/prereqs", headers=_ah(),
                         json={"edges": graph["edges"]})
    assert r.status_code == 200, r.text


async def test_curriculum_qa_runs_over_full_set(app, client, admin_key):
    await _seed(app)
    r = await client.get("/api/v1/admin/curriculum/qa", headers=_ah())
    assert r.status_code == 200, r.text
    body = r.json()
    # Pending lessons have no steps yet, so step-coverage fails per lesson — but
    # the *graph* must be clean (no cycle, no unknown id, no difficulty inversion).
    assert not any(f["rule"] == "prereq-dag" for f in body["graph_findings"]), body["graph_findings"]
    assert not any(f["level"] == "error" for f in body["graph_findings"]), body["graph_findings"]
    assert len(body["lessons"]) == len(cc.LESSONS)


async def test_public_curriculum_lists_all_tracks(app, client, admin_key):
    await _seed(app)
    r = await client.get("/api/v1/tracks")
    assert r.status_code == 200, r.text
    slugs = {t["slug"] for t in r.json()["items"]}
    assert {t["slug"] for t in cc.TRACKS} <= slugs
