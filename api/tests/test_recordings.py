from __future__ import annotations

import uuid


def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}


async def _upload(client, h, *, visibility: str = "unlisted", fmt: str = "opus") -> dict:
    r = await client.post(
        "/api/v1/recordings",
        headers=h,
        files={"file": ("session.webm", b"\x00" * 4096, "audio/webm")},
        data={
            "format": fmt,
            "duration_ms": "30000",
            "title": "session 1",
            "visibility": visibility,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_recording_upload_crud(client):
    h = _hdr()
    rec = await _upload(client, h)
    assert rec["title"] == "session 1"
    assert rec["format"] == "opus"
    assert rec["bytes"] == 4096
    assert rec["short_slug"]

    lst = await client.get("/api/v1/recordings/me", headers=h)
    assert len(lst.json()["items"]) == 1

    me = (await client.get("/api/v1/users/me", headers=h)).json()["user"]
    assert me["recording_count"] == 1
    assert me["bytes_used"] == 4096

    d = await client.delete(f"/api/v1/recordings/{rec['id']}", headers=h)
    assert d.status_code == 204

    me = (await client.get("/api/v1/users/me", headers=h)).json()["user"]
    assert me["recording_count"] == 0
    assert me["bytes_used"] == 0


async def test_recording_audio_redirect(client):
    h = _hdr()
    rec = await _upload(client, h, visibility="public")
    g = await client.get(
        f"/api/v1/recordings/{rec['short_slug']}", follow_redirects=False
    )
    assert g.status_code == 302
    assert g.headers["location"].startswith("memory://recordings/")


async def test_public_meta_visible_to_anyone(client):
    owner = _hdr()
    rec = await _upload(client, owner, visibility="public")

    # A different (anonymous) viewer can read public metadata via the slug.
    meta = await client.get(f"/api/v1/recordings/{rec['short_slug']}/meta")
    assert meta.status_code == 200
    body = meta.json()
    assert body["short_slug"] == rec["short_slug"]
    assert body["title"] == "session 1"
    assert "storage_key" not in body


async def test_private_recording_gated_from_others(client):
    owner = _hdr()
    rec = await _upload(client, owner, visibility="unlisted")

    # Owner can read meta.
    assert (
        await client.get(
            f"/api/v1/recordings/{rec['short_slug']}/meta", headers=owner
        )
    ).status_code == 200

    # A stranger cannot (404, not 403 — don't leak existence).
    stranger = _hdr()
    r = await client.get(
        f"/api/v1/recordings/{rec['short_slug']}/meta", headers=stranger
    )
    assert r.status_code == 404


async def test_rejects_bad_format(client):
    h = _hdr()
    r = await client.post(
        "/api/v1/recordings",
        headers=h,
        files={"file": ("x.mp3", b"\x00" * 16, "audio/mpeg")},
        data={"format": "mp3", "duration_ms": "1000"},
    )
    assert r.status_code == 400
