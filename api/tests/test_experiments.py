from __future__ import annotations

import uuid
import pytest


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


async def test_create_and_get_by_id_or_slug(client):
    h = _hdr()
    definition = {"title": "Pitch Height", "steps": []}
    r = await client.post(
        "/api/v1/experiments",
        headers=h,
        json={"title": "Detuning Study", "definition": definition, "description": "Desc"},
    )
    assert r.status_code == 201, r.text
    exp = r.json()
    assert exp["title"] == "Detuning Study"
    assert exp["definition"] == definition
    assert exp["description"] == "Desc"
    assert exp["short_slug"]
    assert exp["id"]

    # Public get by ID
    g1 = await client.get(f"/api/v1/experiments/{exp['id']}")
    assert g1.status_code == 200
    assert g1.json()["title"] == "Detuning Study"

    # Public get by Slug
    g2 = await client.get(f"/api/v1/experiments/{exp['short_slug']}")
    assert g2.status_code == 200
    assert g2.json()["title"] == "Detuning Study"


async def test_list_only_my_experiments(client):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    definition = {"steps": []}
    for i in range(3):
        await client.post(
            "/api/v1/experiments",
            headers={"x-anon-id": a},
            json={"title": f"Exp {i}", "definition": definition},
        )
    await client.post(
        "/api/v1/experiments",
        headers={"x-anon-id": b},
        json={"title": "other", "definition": definition},
    )

    r = await client.get("/api/v1/experiments/me", headers={"x-anon-id": a})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 3
    assert all(e["title"].startswith("Exp") for e in items)


async def test_access_control_modify_and_delete(client):
    owner = _hdr()
    stranger = _hdr()
    definition = {"steps": []}

    r = await client.post(
        "/api/v1/experiments",
        headers=owner,
        json={"title": "Own", "definition": definition},
    )
    assert r.status_code == 201
    exp_id = r.json()["id"]

    # Stranger tries to update -> should fail 403
    patch_res = await client.patch(
        f"/api/v1/experiments/{exp_id}",
        headers=stranger,
        json={"title": "Hijacked"},
    )
    assert patch_res.status_code == 403

    # Stranger tries to delete -> should fail 403
    del_res = await client.delete(
        f"/api/v1/experiments/{exp_id}",
        headers=stranger,
    )
    assert del_res.status_code == 403

    # Owner updates successfully
    owner_patch = await client.patch(
        f"/api/v1/experiments/{exp_id}",
        headers=owner,
        json={"title": "Updated Title"},
    )
    assert owner_patch.status_code == 200
    assert owner_patch.json()["title"] == "Updated Title"

    # Owner deletes successfully
    owner_del = await client.delete(
        f"/api/v1/experiments/{exp_id}",
        headers=owner,
    )
    assert owner_del.status_code == 204


async def test_experiments_quota_exceeded(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("QUOTA_EXPERIMENTS", "2")
    get_settings.cache_clear()

    h = _hdr()
    definition = {"steps": []}
    for i in range(2):
        r = await client.post(
            "/api/v1/experiments",
            headers=h,
            json={"title": f"Exp {i}", "definition": definition},
        )
        assert r.status_code == 201

    # Third should fail with quota_exceeded
    r = await client.post(
        "/api/v1/experiments",
        headers=h,
        json={"title": "third", "definition": definition},
    )
    assert r.status_code == 409
    assert r.json()["error"] == "quota_exceeded"
    assert r.json()["resource"] == "experiments"
