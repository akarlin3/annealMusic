from __future__ import annotations

import uuid

from tests.conftest import VALID_PAYLOAD


def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}


async def _public_patch(client, h) -> dict:
    created = await client.post(
        "/api/v1/patches",
        headers=h,
        json={"state": VALID_PAYLOAD, "schema_ver": 5, "visibility": "public"},
    )
    assert created.status_code == 201, created.text
    return created.json()


async def test_embed_shell_is_framable(client):
    h = _hdr()
    patch = await _public_patch(client, h)
    r = await client.get(f"/embed/{patch['short_slug']}")
    assert r.status_code == 200
    # Framable: CSP allows any ancestor, and X-Frame-Options is NOT set.
    assert "frame-ancestors *" in r.headers.get("content-security-policy", "")
    assert "x-frame-options" not in {k.lower() for k in r.headers}
    assert "embed-root" in r.text
    assert "/assets/embed.js" in r.text


async def test_embed_gated_for_unlisted(client):
    h = _hdr()
    created = await client.post(
        "/api/v1/patches",
        headers=h,
        json={"state": VALID_PAYLOAD, "schema_ver": 5, "visibility": "unlisted"},
    )
    slug = created.json()["short_slug"]
    r = await client.get(f"/embed/{slug}")
    # Always 200 (the client renders the polite gated state), still framable.
    assert r.status_code == 200
    assert "frame-ancestors *" in r.headers.get("content-security-policy", "")
    assert "not public" in r.text


async def test_embed_missing_patch_is_gated(client):
    r = await client.get("/embed/doesnotexist")
    assert r.status_code == 200
    assert "not public" in r.text


async def test_non_embed_routes_deny_framing(client):
    r = await client.get("/healthz")
    assert r.headers.get("x-frame-options") == "DENY"
    assert "content-security-policy" not in {k.lower() for k in r.headers}
