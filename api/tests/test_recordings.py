from __future__ import annotations

import uuid


def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}


async def test_recording_crud(client):
    h = _hdr()
    r = await client.post(
        "/api/v1/recordings",
        headers=h,
        json={
            "storage_key": "recordings/x/y.opus",
            "duration_ms": 30000,
            "bytes": 500000,
            "format": "opus",
            "title": "session 1",
        },
    )
    assert r.status_code == 201, r.text
    rec = r.json()
    assert rec["title"] == "session 1"

    lst = await client.get("/api/v1/recordings/me", headers=h)
    assert len(lst.json()["items"]) == 1

    me = (await client.get("/api/v1/users/me", headers=h)).json()["user"]
    assert me["recording_count"] == 1
    assert me["bytes_used"] == 500000

    d = await client.delete(f"/api/v1/recordings/{rec['id']}", headers=h)
    assert d.status_code == 204


async def test_recording_redirect(client):
    h = _hdr()
    rec = (
        await client.post(
            "/api/v1/recordings",
            headers=h,
            json={
                "storage_key": "recordings/x/z.opus",
                "duration_ms": 1000,
                "bytes": 100,
                "format": "opus",
            },
        )
    ).json()
    g = await client.get(f"/api/v1/recordings/{rec['id']}", follow_redirects=False)
    assert g.status_code == 302
