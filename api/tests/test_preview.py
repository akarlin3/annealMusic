from __future__ import annotations

import uuid

from tests.conftest import VALID_PAYLOAD


def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}


async def _publish(client) -> dict:
    return (
        await client.post(
            "/api/v1/patches",
            headers=_hdr(),
            json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "p",
                  "visibility": "public"},
        )
    ).json()


GRANULAR_PAYLOAD = (
    "m=open&e=granular&rootFreq=110&spread=1.00&density=6&coupling=0.30&"
    "drift=0.50&brightness=0.50&space=0.40&gr.source=2&gr.size=120&"
    "gr.density=14&gr.posJitter=0.30&gr.pitchJitter=0&gr.posCenter=0.50"
)


async def test_preview_rendering_returns_202(client):
    p = await _publish(client)
    r = await client.get(f"/api/v1/patches/{p['short_slug']}/preview")
    assert r.status_code == 202
    assert r.json()["status"] == "rendering"
    assert r.headers["cache-control"] == "no-store"


async def test_granular_patch_publishes_and_previews(client):
    # A v5 granular payload must pass save-path validation and queue a render.
    created = (
        await client.post(
            "/api/v1/patches",
            headers=_hdr(),
            json={
                "state": GRANULAR_PAYLOAD,
                "schema_ver": 5,
                "title": "grain",
                "visibility": "public",
            },
        )
    ).json()
    assert "short_slug" in created, created
    r = await client.get(f"/api/v1/patches/{created['short_slug']}/preview")
    assert r.status_code == 202
    assert r.json()["status"] == "rendering"


async def test_preview_not_public_404(client):
    created = (
        await client.post(
            "/api/v1/patches", headers=_hdr(),
            json={"state": VALID_PAYLOAD, "schema_ver": 4},
        )
    ).json()
    r = await client.get(f"/api/v1/patches/{created['id']}/preview")
    assert r.status_code == 404


async def test_preview_ready_redirects_302(client):
    from app.db import get_sessionmaker
    from app.models import Patch

    p = await _publish(client)
    async with get_sessionmaker()() as s:
        row = await s.get(Patch, uuid.UUID(p["id"]))
        row.preview_status = "ready"
        row.preview_storage_key = f"previews/{p['id']}.opus"
        await s.commit()

    r = await client.get(f"/api/v1/patches/{p['short_slug']}/preview")
    assert r.status_code == 302
    assert r.headers["cache-control"] == "public, max-age=31536000, immutable"


async def test_preview_failed_returns_503(client):
    from app.db import get_sessionmaker
    from app.models import Patch

    p = await _publish(client)
    async with get_sessionmaker()() as s:
        row = await s.get(Patch, uuid.UUID(p["id"]))
        row.preview_status = "failed"
        await s.commit()

    r = await client.get(f"/api/v1/patches/{p['short_slug']}/preview")
    assert r.status_code == 503
    assert r.json()["error"] == "preview_failed"
