from __future__ import annotations

import uuid


async def test_missing_header_mints_anon_id(client):
    r = await client.post("/api/v1/users")
    assert r.status_code == 200
    minted = r.headers.get("x-anon-id")
    assert minted is not None
    uuid.UUID(minted)  # valid UUID
    body = r.json()
    assert body["user"]["id"] == minted
    assert body["quota"]["patches"] == 100
    assert body["quota"]["bytes"] == 1024 * 1024 * 1024


async def test_provided_header_is_echoed(client):
    anon = str(uuid.uuid4())
    r = await client.post("/api/v1/users", headers={"x-anon-id": anon})
    assert r.status_code == 200
    assert r.headers["x-anon-id"] == anon
    assert r.json()["user"]["id"] == anon


async def test_me_surfaces_counts(client):
    anon = str(uuid.uuid4())
    r = await client.get("/api/v1/users/me", headers={"x-anon-id": anon})
    assert r.status_code == 200
    user = r.json()["user"]
    assert user["patch_count"] == 0
    assert user["capture_count"] == 0
    assert user["recording_count"] == 0
    assert user["bytes_used"] == 0


async def test_idempotent_on_anon_id(client):
    anon = str(uuid.uuid4())
    await client.post("/api/v1/users", headers={"x-anon-id": anon})
    r = await client.post("/api/v1/users", headers={"x-anon-id": anon})
    assert r.json()["user"]["id"] == anon
