from __future__ import annotations

import uuid

import pytest

from tests.conftest import VALID_PAYLOAD


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


async def test_create_and_get_by_id_and_slug(client):
    h = _hdr()
    r = await client.post(
        "/api/v1/patches",
        headers=h,
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "Calm"},
    )
    assert r.status_code == 201, r.text
    patch = r.json()
    assert patch["state"] == VALID_PAYLOAD
    assert patch["short_slug"]
    assert patch["visibility"] == "unlisted"

    # By id.
    g = await client.get(f"/api/v1/patches/{patch['id']}")
    assert g.status_code == 200
    assert g.json()["state"] == VALID_PAYLOAD

    # By slug (anonymous reader, no header).
    g2 = await client.get(f"/api/v1/patches/{patch['short_slug']}")
    assert g2.status_code == 200
    assert g2.json()["id"] == patch["id"]


async def test_invalid_state_rejected(client):
    r = await client.post(
        "/api/v1/patches",
        headers=_hdr(),
        json={"state": "rootFreq=99999&bogus=1", "schema_ver": 4},
    )
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_state"


async def test_list_only_my_patches(client):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    for i in range(3):
        await client.post(
            "/api/v1/patches",
            headers={"x-anon-id": a},
            json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": f"a{i}"},
        )
    await client.post(
        "/api/v1/patches",
        headers={"x-anon-id": b},
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "b0"},
    )
    r = await client.get("/api/v1/patches/me", headers={"x-anon-id": a})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 3
    assert all(p["title"].startswith("a") for p in items)


async def test_patch_metadata_state_immutable(client):
    h = _hdr()
    created = (
        await client.post(
            "/api/v1/patches",
            headers=h,
            json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "x"},
        )
    ).json()
    r = await client.patch(
        f"/api/v1/patches/{created['id']}",
        headers=h,
        json={"title": "renamed", "visibility": "public"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "renamed"
    assert r.json()["visibility"] == "public"
    assert r.json()["state"] == VALID_PAYLOAD  # unchanged


async def test_cannot_modify_others_patch(client):
    owner = _hdr()
    created = (
        await client.post(
            "/api/v1/patches",
            headers=owner,
            json={"state": VALID_PAYLOAD, "schema_ver": 4},
        )
    ).json()
    stranger = _hdr()
    r = await client.patch(
        f"/api/v1/patches/{created['id']}", headers=stranger, json={"title": "hijack"}
    )
    assert r.status_code == 403
    d = await client.delete(f"/api/v1/patches/{created['id']}", headers=stranger)
    assert d.status_code == 403


async def test_delete_is_real(client):
    h = _hdr()
    created = (
        await client.post(
            "/api/v1/patches",
            headers=h,
            json={"state": VALID_PAYLOAD, "schema_ver": 4},
        )
    ).json()
    d = await client.delete(f"/api/v1/patches/{created['id']}", headers=h)
    assert d.status_code == 204
    g = await client.get(f"/api/v1/patches/{created['id']}")
    assert g.status_code == 404


async def test_quota_exceeded(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("QUOTA_PATCHES", "2")
    get_settings.cache_clear()  # pick up the patched env
    h = _hdr()
    for _ in range(2):
        r = await client.post(
            "/api/v1/patches",
            headers=h,
            json={"state": VALID_PAYLOAD, "schema_ver": 4},
        )
        assert r.status_code == 201
    r = await client.post(
        "/api/v1/patches", headers=h, json={"state": VALID_PAYLOAD, "schema_ver": 4}
    )
    assert r.status_code == 409
    assert r.json()["error"] == "quota_exceeded"
    assert r.json()["resource"] == "patches"
