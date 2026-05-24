from __future__ import annotations

import uuid

from tests.conftest import VALID_PAYLOAD


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


async def _publish(client, *, title: str, payload: str = VALID_PAYLOAD,
                   description: str | None = None) -> dict:
    r = await client.post(
        "/api/v1/patches",
        headers=_hdr(),
        json={
            "state": payload,
            "schema_ver": 4,
            "title": title,
            "description": description,
            "visibility": "public",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_only_public_patches_appear(client):
    await _publish(client, title="Public one")
    # An unlisted patch must not show.
    await client.post(
        "/api/v1/patches",
        headers=_hdr(),
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "secret"},
    )
    r = await client.get("/api/v1/gallery")
    assert r.status_code == 200
    titles = [i["title"] for i in r.json()["items"]]
    assert titles == ["Public one"]
    assert r.headers["cache-control"].startswith("public, max-age=30")


async def test_publish_sets_rendering_status(client):
    p = await _publish(client, title="Rendering")
    r = await client.get("/api/v1/gallery")
    item = r.json()["items"][0]
    assert item["preview_status"] == "rendering"
    assert item["short_slug"] == p["short_slug"]


async def test_sort_newest_oldest(client):
    a = await _publish(client, title="first")
    b = await _publish(client, title="second")
    newest = await client.get("/api/v1/gallery?sort=newest")
    assert [i["title"] for i in newest.json()["items"]] == ["second", "first"]
    oldest = await client.get("/api/v1/gallery?sort=oldest")
    assert [i["title"] for i in oldest.json()["items"]] == ["first", "second"]
    assert {a["short_slug"], b["short_slug"]}


async def test_filter_engine_and_mode(client):
    await _publish(client, title="sine-open", payload="e=sine&m=open")
    await _publish(client, title="fm-arc", payload="e=fm&m=arc&arc=bell&dur=600")
    r = await client.get("/api/v1/gallery?engine=fm")
    assert [i["title"] for i in r.json()["items"]] == ["fm-arc"]
    r2 = await client.get("/api/v1/gallery?mode=open")
    assert [i["title"] for i in r2.json()["items"]] == ["sine-open"]


async def test_search(client):
    await _publish(client, title="Calm ocean drift")
    await _publish(client, title="Bright forest")
    r = await client.get("/api/v1/gallery?q=ocean")
    assert [i["title"] for i in r.json()["items"]] == ["Calm ocean drift"]


async def test_cursor_pagination_through_pages(client):
    for i in range(5):
        await _publish(client, title=f"p{i}")
    seen: list[str] = []
    cursor = None
    pages = 0
    while True:
        q = "/api/v1/gallery?sort=newest&limit=2"
        if cursor:
            q += f"&cursor={cursor}"
        r = await client.get(q)
        body = r.json()
        seen += [i["title"] for i in body["items"]]
        pages += 1
        cursor = body["next_cursor"]
        if not cursor:
            break
        assert pages < 10
    assert sorted(seen) == sorted([f"p{i}" for i in range(5)])
    assert len(seen) == 5  # no dupes across pages


async def test_cursor_rejects_sort_mismatch(client):
    for i in range(3):
        await _publish(client, title=f"p{i}")
    r = await client.get("/api/v1/gallery?sort=newest&limit=1")
    cursor = r.json()["next_cursor"]
    bad = await client.get(f"/api/v1/gallery?sort=oldest&limit=1&cursor={cursor}")
    assert bad.status_code == 400


async def test_load_increments_and_rate_limited(client):
    p = await _publish(client, title="loadme")
    slug = p["short_slug"]
    # First load from an IP increments.
    r1 = await client.post(f"/api/v1/patches/{slug}/load",
                           headers={"x-forwarded-for": "1.1.1.1"})
    assert r1.status_code == 200
    assert r1.json()["load_count"] == 1
    # Same IP again: silent no-op (still 1).
    r2 = await client.post(f"/api/v1/patches/{slug}/load",
                           headers={"x-forwarded-for": "1.1.1.1"})
    assert r2.json()["load_count"] == 1
    # Different IP increments.
    r3 = await client.post(f"/api/v1/patches/{slug}/load",
                           headers={"x-forwarded-for": "2.2.2.2"})
    assert r3.json()["load_count"] == 2


async def test_most_loaded_sort(client):
    low = await _publish(client, title="low")
    high = await _publish(client, title="high")
    for ip in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):
        await client.post(f"/api/v1/patches/{high['short_slug']}/load",
                          headers={"x-forwarded-for": ip})
    await client.post(f"/api/v1/patches/{low['short_slug']}/load",
                      headers={"x-forwarded-for": "9.9.9.9"})
    r = await client.get("/api/v1/gallery?sort=most_loaded")
    assert [i["title"] for i in r.json()["items"]] == ["high", "low"]


async def test_flagged_hidden_from_gallery_and_403_on_get(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "k")
    get_settings.cache_clear()
    p = await _publish(client, title="willflag")
    # Flag via admin.
    fr = await client.patch(
        f"/api/v1/admin/patches/{p['id']}/visibility",
        headers={"x-admin-key": "k"},
        json={"visibility": "flagged"},
    )
    assert fr.status_code == 200
    # Gone from gallery.
    g = await client.get("/api/v1/gallery")
    assert g.json()["items"] == []
    # Short-link read → under review.
    sr = await client.get(f"/api/v1/patches/{p['short_slug']}")
    assert sr.status_code == 403
    assert sr.json()["error"] == "under_review"


async def test_has_captures_filter(client):
    # Upload a capture, reference it in a public patch.
    from tests.conftest import make_wav

    anon = str(uuid.uuid4())
    up = await client.post(
        "/api/v1/captures",
        headers={"x-anon-id": anon},
        files={"file": ("loop.wav", make_wav(1.0), "audio/wav")},
    )
    cap_id = up.json()["id"]
    await client.post(
        "/api/v1/patches",
        headers={"x-anon-id": anon},
        json={
            "state": VALID_PAYLOAD + "&LA.cap=1",
            "schema_ver": 4,
            "title": "with-cap",
            "visibility": "public",
            "capture_refs": [cap_id],
        },
    )
    await _publish(client, title="no-cap")
    r = await client.get("/api/v1/gallery?has_captures=true")
    assert [i["title"] for i in r.json()["items"]] == ["with-cap"]
    assert r.json()["items"][0]["has_captures"] is True
