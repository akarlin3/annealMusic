from __future__ import annotations

import uuid

from tests.conftest import VALID_PAYLOAD


def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}


async def test_publish_with_banned_word_rejected(client):
    r = await client.post(
        "/api/v1/patches",
        headers=_hdr(),
        json={"state": VALID_PAYLOAD, "schema_ver": 4,
              "title": "free casino now", "visibility": "public"},
    )
    assert r.status_code == 422
    assert r.json()["error"] == "content_rejected"
    assert r.json()["field"] == "title"


async def test_publish_clean_ok(client):
    r = await client.post(
        "/api/v1/patches",
        headers=_hdr(),
        json={"state": VALID_PAYLOAD, "schema_ver": 4,
              "title": "gentle morning", "visibility": "public"},
    )
    assert r.status_code == 201


async def test_unlisted_skips_screening(client):
    # Banned word is fine while unlisted; only publishing screens.
    r = await client.post(
        "/api/v1/patches",
        headers=_hdr(),
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "casino"},
    )
    assert r.status_code == 201


async def test_flip_to_public_screens(client):
    h = _hdr()
    created = (
        await client.post(
            "/api/v1/patches", headers=h,
            json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "buy viagra"},
        )
    ).json()
    r = await client.patch(
        f"/api/v1/patches/{created['id']}", headers=h,
        json={"visibility": "public"},
    )
    assert r.status_code == 422
    assert r.json()["error"] == "content_rejected"


async def test_spam_url_flood_rejected(client):
    r = await client.post(
        "/api/v1/patches",
        headers=_hdr(),
        json={"state": VALID_PAYLOAD, "schema_ver": 4,
              "title": "ok", "description": "http://a.com http://b.com http://c.com",
              "visibility": "public"},
    )
    assert r.status_code == 422
    assert r.json()["field"] == "description"
