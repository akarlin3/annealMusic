from __future__ import annotations

import uuid

from tests.conftest import VALID_PAYLOAD


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


async def _make_patch(client) -> dict:
    return (
        await client.post(
            "/api/v1/patches",
            headers=_hdr(),
            json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "p"},
        )
    ).json()


async def test_create_report(client):
    p = await _make_patch(client)
    r = await client.post(
        "/api/v1/reports",
        json={"patch_id": p["id"], "reason": "spam", "detail": "junk"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "open"


async def test_report_anonymous_allowed(client):
    p = await _make_patch(client)
    # No x-anon-id header at all.
    r = await client.post(
        "/api/v1/reports", json={"patch_id": p["id"], "reason": "other"}
    )
    assert r.status_code == 201


async def test_report_unknown_patch_404(client):
    r = await client.post(
        "/api/v1/reports",
        json={"patch_id": str(uuid.uuid4()), "reason": "spam"},
    )
    assert r.status_code == 404


async def test_report_invalid_reason_422(client):
    p = await _make_patch(client)
    r = await client.post(
        "/api/v1/reports", json={"patch_id": p["id"], "reason": "nonsense"}
    )
    assert r.status_code == 422
