from __future__ import annotations

import uuid

import pytest

from tests.conftest import VALID_PAYLOAD


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


async def _public_patch(client) -> dict:
    return (
        await client.post(
            "/api/v1/patches",
            headers=_hdr(),
            json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "p",
                  "visibility": "public"},
        )
    ).json()


async def test_admin_disabled_without_key_env(client):
    # ADMIN_KEY unset → endpoints behave as absent (404), even with a header.
    r = await client.get("/api/v1/admin/reports", headers={"x-admin-key": "x"})
    assert r.status_code == 404


async def test_admin_requires_key(client, admin_key):
    r = await client.get("/api/v1/admin/reports")
    assert r.status_code == 401
    r2 = await client.get("/api/v1/admin/reports", headers={"x-admin-key": "wrong"})
    assert r2.status_code == 401
    r3 = await client.get("/api/v1/admin/reports", headers={"x-admin-key": admin_key})
    assert r3.status_code == 200


async def test_admin_uphold_flags_patch(client, admin_key):
    p = await _public_patch(client)
    await client.post("/api/v1/reports", json={"patch_id": p["id"], "reason": "spam"})

    listed = await client.get("/api/v1/admin/reports", headers={"x-admin-key": admin_key})
    items = listed.json()["items"]
    assert len(items) == 1
    report_id = items[0]["id"]
    assert items[0]["patch_title"] == "p"

    upheld = await client.patch(
        f"/api/v1/admin/reports/{report_id}",
        headers={"x-admin-key": admin_key},
        json={"status": "upheld"},
    )
    assert upheld.status_code == 200
    assert upheld.json()["patch_visibility"] == "flagged"

    # Patch is now flagged → gone from gallery.
    g = await client.get("/api/v1/gallery")
    assert g.json()["items"] == []


async def test_admin_dismiss_keeps_public(client, admin_key):
    p = await _public_patch(client)
    await client.post("/api/v1/reports", json={"patch_id": p["id"], "reason": "other"})
    report_id = (
        await client.get("/api/v1/admin/reports", headers={"x-admin-key": admin_key})
    ).json()["items"][0]["id"]
    r = await client.patch(
        f"/api/v1/admin/reports/{report_id}",
        headers={"x-admin-key": admin_key},
        json={"status": "dismissed"},
    )
    assert r.status_code == 200
    g = await client.get("/api/v1/gallery")
    assert len(g.json()["items"]) == 1


async def test_admin_restore_visibility(client, admin_key):
    p = await _public_patch(client)
    # Flag then restore.
    await client.patch(f"/api/v1/admin/patches/{p['id']}/visibility",
                       headers={"x-admin-key": admin_key},
                       json={"visibility": "flagged"})
    r = await client.patch(f"/api/v1/admin/patches/{p['id']}/visibility",
                           headers={"x-admin-key": admin_key},
                           json={"visibility": "public"})
    assert r.status_code == 200
    assert r.json()["visibility"] == "public"
    g = await client.get("/api/v1/gallery")
    assert len(g.json()["items"]) == 1
