from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Account, Patch, Session, User
from app.slug import new_slug


async def _mk_account(email: str, orcid: str | None = None) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    from app.db import get_sessionmaker

    sm = get_sessionmaker()
    acc_id, sess_id, user_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    async with sm() as s:
        s.add(
            Account(
                id=acc_id,
                email=email,
                email_verified=True,
                display_name=email.split("@")[0].title(),
                orcid=orcid,
            )
        )
        s.add(
            Session(
                id=sess_id,
                account_id=acc_id,
                expires_at=datetime.now(tz=timezone.utc) + timedelta(days=30),
            )
        )
        s.add(User(id=user_id, account_id=acc_id))
        await s.commit()
    return acc_id, sess_id, user_id


async def _mk_patch(user_id: uuid.UUID, title: str = "Stim") -> uuid.UUID:
    from app.db import get_sessionmaker

    sm = get_sessionmaker()
    pid = uuid.uuid4()
    async with sm() as s:
        s.add(
            Patch(
                id=pid,
                user_id=user_id,
                schema_ver=4,
                state={"e": "sine", "rootFreq": 110},
                short_slug=new_slug(),
                title=title,
            )
        )
        await s.commit()
    return pid


def _login(client, sess_id: uuid.UUID) -> None:
    client.cookies.set("am_session", str(sess_id))


@pytest.mark.asyncio
async def test_snapshot_freezes_resolved_resources(client):
    _, sess, user = await _mk_account("pi@example.com")
    _login(client, sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Snap"})).json()["id"]
    patch_id = await _mk_patch(user, "My Stimulus")
    await client.post(
        f"/api/v1/studies/{sid}/resources",
        json={"resource_kind": "patch", "resource_id": str(patch_id), "role": "stimulus"},
    )

    snap = await client.post(f"/api/v1/studies/{sid}/snapshot", json={"version_label": "v1.0"})
    assert snap.status_code == 201, snap.text
    body = snap.json()
    assert body["version_label"] == "v1.0"
    assert body["doi"] is None
    sj = body["snapshot_json"]
    assert sj["schema"] == "study-snapshot/v1"
    assert sj["study"]["title"] == "Snap"
    assert len(sj["investigators"]) == 1
    assert len(sj["resources"]) == 1
    res = sj["resources"][0]
    assert res["title"] == "My Stimulus"
    assert res["content_hash"].startswith("sha256:")
    assert res["owner_user_id"] == str(user)
    assert res["resolved"] is True


@pytest.mark.asyncio
async def test_snapshot_is_immutable_to_later_edits(client):
    _, sess, user = await _mk_account("pi@example.com")
    _login(client, sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Original"})).json()["id"]
    ver = (await client.post(f"/api/v1/studies/{sid}/snapshot", json={"version_label": "v1"})).json()

    # Mutate the live study after the snapshot.
    await client.patch(f"/api/v1/studies/{sid}", json={"title": "Renamed", "abstract": "new"})

    got = await client.get(f"/api/v1/studies/{sid}/versions/{ver['id']}")
    assert got.status_code == 200
    # The frozen snapshot still reflects the original title.
    assert got.json()["snapshot_json"]["study"]["title"] == "Original"


@pytest.mark.asyncio
async def test_version_label_unique(client):
    _, sess, _ = await _mk_account("pi@example.com")
    _login(client, sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Dup"})).json()["id"]
    assert (await client.post(f"/api/v1/studies/{sid}/snapshot", json={"version_label": "v1"})).status_code == 201
    dup = await client.post(f"/api/v1/studies/{sid}/snapshot", json={"version_label": "v1"})
    assert dup.status_code == 409
    assert dup.json()["error"] == "duplicate_version_label"


@pytest.mark.asyncio
async def test_list_versions(client):
    _, sess, _ = await _mk_account("pi@example.com")
    _login(client, sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Multi"})).json()["id"]
    await client.post(f"/api/v1/studies/{sid}/snapshot", json={"version_label": "pre-reg"})
    await client.post(f"/api/v1/studies/{sid}/snapshot", json={"version_label": "v2"})
    lst = await client.get(f"/api/v1/studies/{sid}/versions")
    assert lst.status_code == 200
    labels = {v["version_label"] for v in lst.json()["items"]}
    assert labels == {"pre-reg", "v2"}


@pytest.mark.asyncio
async def test_citation_formats_unpublished(client):
    _, sess, _ = await _mk_account("pi@example.com", orcid="0000-0002-1825-0097")
    _login(client, sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Consonance Study"})).json()["id"]
    slug = (await client.get(f"/api/v1/studies/{sid}")).json()["slug"]

    bib = await client.get(f"/api/v1/studies/{sid}/citation?format=bibtex")
    assert bib.status_code == 200
    cite = bib.json()["citation"]
    assert "@misc{" in cite
    assert "Consonance Study" in cite
    assert "0000-0002-1825-0097" in cite  # ORCID in note
    assert slug in cite  # unpublished → /s/<slug> URL

    apa = (await client.get(f"/api/v1/studies/{sid}/citation?format=apa")).json()["citation"]
    assert "(2026)" in apa
    assert "ORCID: 0000-0002-1825-0097" in apa

    chi = (await client.get(f"/api/v1/studies/{sid}/citation?format=chicago")).json()["citation"]
    assert '"Consonance Study."' in chi

    bad = await client.get(f"/api/v1/studies/{sid}/citation?format=mla")
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_public_study_citation_is_anonymous(client):
    _, sess, _ = await _mk_account("pi@example.com")
    _login(client, sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Open"})).json()["id"]
    await client.patch(f"/api/v1/studies/{sid}", json={"visibility": "public"})
    slug = (await client.get(f"/api/v1/studies/{sid}")).json()["slug"]

    client.cookies.clear()  # anonymous
    cite = await client.get(f"/api/v1/studies/{slug}/citation?format=bibtex")
    assert cite.status_code == 200
    # A private study, by contrast, 404s anonymously.
    _, sess2, _ = await _mk_account("p2@example.com")
    _login(client, sess2)
    sid2 = (await client.post("/api/v1/studies", json={"title": "Closed"})).json()["id"]
    client.cookies.clear()
    assert (await client.get(f"/api/v1/studies/{sid2}/citation")).status_code == 404
