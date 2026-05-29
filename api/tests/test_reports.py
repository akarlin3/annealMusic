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


async def test_report_source_content(client):
    from tests.test_user_sources import make_tone_wav, _upload

    h = _hdr()
    src_res = await _upload(client, h)
    assert src_res.status_code == 201
    src_id = src_res.json()["id"]

    p = await _make_patch(client)

    # 1. Report with valid source_id and reason source-content
    r = await client.post(
        "/api/v1/reports",
        json={
            "patch_id": p["id"],
            "reason": "source-content",
            "source_id": src_id,
            "detail": "copyright violation",
        },
    )
    assert r.status_code == 201
    assert r.json()["status"] == "open"

    # 2. Report with non-existent source_id should fail with 404
    r_bad = await client.post(
        "/api/v1/reports",
        json={
            "patch_id": p["id"],
            "reason": "source-content",
            "source_id": str(uuid.uuid4()),
            "detail": "not found",
        },
    )
    assert r_bad.status_code == 404
