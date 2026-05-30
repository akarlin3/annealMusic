from __future__ import annotations

import uuid
import pytest


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


async def test_create_and_get_by_id(client):
    h = _hdr()
    r = await client.post(
        "/api/v1/scripts",
        headers=h,
        json={"name": "Sweep", "source": "print('hello')", "language": "python", "visibility": "private"},
    )
    assert r.status_code == 201, r.text
    script = r.json()
    assert script["name"] == "Sweep"
    assert script["source"] == "print('hello')"
    assert script["visibility"] == "private"
    assert script["id"]

    # Get by id
    g = await client.get(f"/api/v1/scripts/{script['id']}", headers=h)
    assert g.status_code == 200
    assert g.json()["name"] == "Sweep"


async def test_list_only_my_scripts(client):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    for i in range(3):
        await client.post(
            "/api/v1/scripts",
            headers={"x-anon-id": a},
            json={"name": f"s{i}", "source": "pass"},
        )
    await client.post(
        "/api/v1/scripts",
        headers={"x-anon-id": b},
        json={"name": "other", "source": "pass"},
    )

    r = await client.get("/api/v1/scripts/me", headers={"x-anon-id": a})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 3
    assert all(s["name"].startswith("s") for s in items)


async def test_access_control_private_vs_unlisted(client):
    owner = _hdr()
    stranger = _hdr()

    # Create private script
    r1 = await client.post(
        "/api/v1/scripts",
        headers=owner,
        json={"name": "Private", "source": "pass", "visibility": "private"},
    )
    assert r1.status_code == 201
    private_id = r1.json()["id"]

    # Create unlisted script
    r2 = await client.post(
        "/api/v1/scripts",
        headers=owner,
        json={"name": "Unlisted", "source": "pass", "visibility": "unlisted"},
    )
    assert r2.status_code == 201
    unlisted_id = r2.json()["id"]

    # Stranger tries to fetch private script -> should fail with 403
    g1 = await client.get(f"/api/v1/scripts/{private_id}", headers=stranger)
    assert g1.status_code == 403

    # Stranger tries to fetch unlisted script -> should succeed
    g2 = await client.get(f"/api/v1/scripts/{unlisted_id}", headers=stranger)
    assert g2.status_code == 200
    assert g2.json()["name"] == "Unlisted"


async def test_cannot_modify_or_delete_others_script(client):
    owner = _hdr()
    stranger = _hdr()

    script = (
        await client.post(
            "/api/v1/scripts",
            headers=owner,
            json={"name": "Orig", "source": "pass"},
        )
    ).json()

    # Update script as stranger -> should fail
    r = await client.patch(
        f"/api/v1/scripts/{script['id']}",
        headers=stranger,
        json={"name": "Hijack"},
    )
    assert r.status_code == 403

    # Delete script as stranger -> should fail
    d = await client.delete(f"/api/v1/scripts/{script['id']}", headers=stranger)
    assert d.status_code == 403


async def test_update_and_delete_is_real(client):
    h = _hdr()
    script = (
        await client.post(
            "/api/v1/scripts",
            headers=h,
            json={"name": "Orig", "source": "pass", "visibility": "private"},
        )
    ).json()

    # Update
    r = await client.patch(
        f"/api/v1/scripts/{script['id']}",
        headers=h,
        json={"name": "New Name", "source": "print(123)", "visibility": "unlisted"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"
    assert r.json()["source"] == "print(123)"
    assert r.json()["visibility"] == "unlisted"

    # Delete
    d = await client.delete(f"/api/v1/scripts/{script['id']}", headers=h)
    assert d.status_code == 204

    # Verify gone
    g = await client.get(f"/api/v1/scripts/{script['id']}", headers=h)
    assert g.status_code == 404


async def test_quota_exceeded(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("QUOTA_SCRIPTS", "2")
    get_settings.cache_clear()

    h = _hdr()
    for i in range(2):
        r = await client.post(
            "/api/v1/scripts",
            headers=h,
            json={"name": f"s{i}", "source": "pass"},
        )
        assert r.status_code == 201

    # Third should fail
    r = await client.post(
        "/api/v1/scripts",
        headers=h,
        json={"name": "third", "source": "pass"},
    )
    assert r.status_code == 409
    assert r.json()["error"] == "quota_exceeded"
    assert r.json()["resource"] == "scripts"
