from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Account, Patch, Session, Study, StudyAuditLog, User
from app.slug import new_slug


# ── fixtures / helpers ─────────────────────────────────────────────────────────

async def _mk_account(email: str) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """Create an account + active session + one claimed anon user. Returns
    (account_id, session_id, user_id)."""
    from app.db import get_sessionmaker

    sm = get_sessionmaker()
    acc_id, sess_id, user_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    async with sm() as s:
        s.add(
            Account(
                id=acc_id,
                email=email,
                email_verified=True,
                display_name=email.split("@")[0],
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
                state={"e": "sine"},
                short_slug=new_slug(),
                title=title,
            )
        )
        await s.commit()
    return pid


def _login(client, sess_id: uuid.UUID) -> None:
    client.cookies.set("am_session", str(sess_id))


def _logout(client) -> None:
    client.cookies.clear()


async def _audit_actions(study_id: uuid.UUID) -> list[str]:
    from app.db import get_sessionmaker
    from sqlalchemy import select

    sm = get_sessionmaker()
    async with sm() as s:
        rows = (
            await s.execute(
                select(StudyAuditLog.action)
                .where(StudyAuditLog.study_id == study_id)
                .order_by(StudyAuditLog.timestamp.asc())
            )
        ).scalars().all()
    return list(rows)


# ── auth ───────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_requires_auth(client):
    _logout(client)
    r = await client.post("/api/v1/studies", json={"title": "Anon study"})
    assert r.status_code == 401, r.text


@pytest.mark.asyncio
async def test_create_study_makes_creator_pi(client):
    _, sess, _ = await _mk_account("pi@example.com")
    _login(client, sess)
    r = await client.post("/api/v1/studies", json={"title": "Consonance", "abstract": "abc"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "Consonance"
    assert body["my_role"] == "pi"
    assert body["status"] == "planning"
    assert body["visibility"] == "private"
    assert len(body["investigators"]) == 1
    assert body["investigators"][0]["role"] == "pi"
    assert (await _audit_actions(uuid.UUID(body["id"]))) == ["study.create"]


# ── listing + visibility ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_my_studies(client):
    _, sess, _ = await _mk_account("owner@example.com")
    _login(client, sess)
    await client.post("/api/v1/studies", json={"title": "A"})
    await client.post("/api/v1/studies", json={"title": "B"})
    r = await client.get("/api/v1/studies/me")
    assert r.status_code == 200
    titles = {s["title"] for s in r.json()["items"]}
    assert titles == {"A", "B"}


@pytest.mark.asyncio
async def test_private_study_hidden_from_stranger_public_visible(client):
    _, owner_sess, _ = await _mk_account("o@example.com")
    _, stranger_sess, _ = await _mk_account("s@example.com")

    _login(client, owner_sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Hidden"})).json()["id"]

    # Stranger: private → 404 (existence not leaked).
    _login(client, stranger_sess)
    assert (await client.get(f"/api/v1/studies/{sid}")).status_code == 404

    # Owner makes it public.
    _login(client, owner_sess)
    assert (
        await client.patch(f"/api/v1/studies/{sid}", json={"visibility": "public"})
    ).status_code == 200

    # Anonymous (no session) can now read it.
    _logout(client)
    pub = await client.get(f"/api/v1/studies/{sid}")
    assert pub.status_code == 200
    assert pub.json()["my_role"] is None


@pytest.mark.asyncio
async def test_patch_cannot_fake_published_or_archived_status(client):
    _, sess, _ = await _mk_account("pi@example.com")
    _login(client, sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Lifecycle"})).json()["id"]

    # Controlled transitions are blocked on PATCH.
    assert (await client.patch(f"/api/v1/studies/{sid}", json={"status": "published"})).status_code == 403
    assert (await client.patch(f"/api/v1/studies/{sid}", json={"status": "archived"})).status_code == 403

    # An ordinary status transition is allowed.
    ok = await client.patch(f"/api/v1/studies/{sid}", json={"status": "active"})
    assert ok.status_code == 200
    assert ok.json()["status"] == "active"


# ── investigators + role matrix ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_investigator_lifecycle_and_role_matrix(client):
    _, pi_sess, _ = await _mk_account("pi@example.com")
    co_acc, co_sess, _ = await _mk_account("co@example.com")

    _login(client, pi_sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Team"})).json()["id"]

    # PI adds a co-investigator by email.
    add = await client.post(
        f"/api/v1/studies/{sid}/investigators",
        json={"account_email": "co@example.com", "role": "co-investigator"},
    )
    assert add.status_code == 201, add.text
    assert any(i["role"] == "co-investigator" for i in add.json())

    # Co-investigator can view + edit.
    _login(client, co_sess)
    assert (await client.get(f"/api/v1/studies/{sid}")).status_code == 200
    edit = await client.patch(f"/api/v1/studies/{sid}", json={"abstract": "edited by co"})
    assert edit.status_code == 200
    assert edit.json()["abstract"] == "edited by co"

    # ...but cannot manage investigators (PI-only).
    forbidden = await client.post(
        f"/api/v1/studies/{sid}/investigators",
        json={"account_email": "pi@example.com", "role": "viewer"},
    )
    assert forbidden.status_code == 403

    # ...and cannot archive.
    assert (await client.delete(f"/api/v1/studies/{sid}")).status_code == 403


@pytest.mark.asyncio
async def test_analyst_lane_and_viewer_readonly(client):
    _, pi_sess, pi_user = await _mk_account("pi@example.com")
    analyst_acc, analyst_sess, _ = await _mk_account("analyst@example.com")
    viewer_acc, viewer_sess, _ = await _mk_account("viewer@example.com")

    _login(client, pi_sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Roles"})).json()["id"]
    await client.post(
        f"/api/v1/studies/{sid}/investigators",
        json={"account_id": str(analyst_acc), "role": "analyst"},
    )
    await client.post(
        f"/api/v1/studies/{sid}/investigators",
        json={"account_id": str(viewer_acc), "role": "viewer"},
    )
    patch_id = await _mk_patch(pi_user)

    # Analyst may add an *analysis* resource but not a stimulus.
    _login(client, analyst_sess)
    bad = await client.post(
        f"/api/v1/studies/{sid}/resources",
        json={"resource_kind": "patch", "resource_id": str(patch_id), "role": "stimulus"},
    )
    assert bad.status_code == 403
    ok = await client.post(
        f"/api/v1/studies/{sid}/resources",
        json={"resource_kind": "patch", "resource_id": str(patch_id), "role": "analysis"},
    )
    assert ok.status_code == 201, ok.text
    link_id = ok.json()["id"]
    # Analyst cannot edit the study or unlink.
    assert (await client.patch(f"/api/v1/studies/{sid}", json={"abstract": "x"})).status_code == 403
    assert (
        await client.delete(f"/api/v1/studies/{sid}/resources/{link_id}")
    ).status_code == 403

    # Viewer is read-only but can see resources + audit.
    _login(client, viewer_sess)
    assert (await client.get(f"/api/v1/studies/{sid}")).status_code == 200
    assert (await client.get(f"/api/v1/studies/{sid}/resources")).status_code == 200
    assert (await client.get(f"/api/v1/studies/{sid}/audit")).status_code == 200
    assert (
        await client.post(
            f"/api/v1/studies/{sid}/resources",
            json={"resource_kind": "patch", "resource_id": str(patch_id), "role": "analysis"},
        )
    ).status_code == 403


@pytest.mark.asyncio
async def test_last_pi_invariant(client):
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com")
    _login(client, pi_sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Solo"})).json()["id"]

    # Cannot downgrade the only PI.
    down = await client.patch(
        f"/api/v1/studies/{sid}/investigators/{pi_acc}", json={"role": "viewer"}
    )
    assert down.status_code == 409
    assert down.json()["error"] == "last_pi"

    # Cannot remove the only PI.
    rem = await client.delete(f"/api/v1/studies/{sid}/investigators/{pi_acc}")
    assert rem.status_code == 409


# ── resources + ownership union ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_link_resource_ownership_union(client):
    _, pi_sess, pi_user = await _mk_account("pi@example.com")
    _, stranger_sess, stranger_user = await _mk_account("stranger@example.com")

    _login(client, pi_sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Stimuli"})).json()["id"]

    # A patch owned by the PI's claimed user links fine.
    mine = await _mk_patch(pi_user, "mine")
    ok = await client.post(
        f"/api/v1/studies/{sid}/resources",
        json={"resource_kind": "patch", "resource_id": str(mine), "role": "stimulus"},
    )
    assert ok.status_code == 201, ok.text

    # Duplicate link → 409.
    dup = await client.post(
        f"/api/v1/studies/{sid}/resources",
        json={"resource_kind": "patch", "resource_id": str(mine), "role": "stimulus"},
    )
    assert dup.status_code == 409

    # A patch owned by a non-investigator → 403 (not owned by any investigator).
    theirs = await _mk_patch(stranger_user, "theirs")
    no = await client.post(
        f"/api/v1/studies/{sid}/resources",
        json={"resource_kind": "patch", "resource_id": str(theirs), "role": "stimulus"},
    )
    assert no.status_code == 403

    # Nonexistent resource → 404.
    missing = await client.post(
        f"/api/v1/studies/{sid}/resources",
        json={"resource_kind": "patch", "resource_id": str(uuid.uuid4()), "role": "data"},
    )
    assert missing.status_code == 404

    # List shows the one good link.
    lst = await client.get(f"/api/v1/studies/{sid}/resources")
    assert lst.status_code == 200
    assert len(lst.json()["items"]) == 1


@pytest.mark.asyncio
async def test_unlink_resource(client):
    _, pi_sess, pi_user = await _mk_account("pi@example.com")
    _login(client, pi_sess)
    sid = (await client.post("/api/v1/studies", json={"title": "S"})).json()["id"]
    patch_id = await _mk_patch(pi_user)
    link = (
        await client.post(
            f"/api/v1/studies/{sid}/resources",
            json={"resource_kind": "patch", "resource_id": str(patch_id), "role": "stimulus"},
        )
    ).json()
    rm = await client.delete(f"/api/v1/studies/{sid}/resources/{link['id']}")
    assert rm.status_code == 204
    lst = await client.get(f"/api/v1/studies/{sid}/resources")
    assert lst.json()["items"] == []


# ── audit completeness ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_audit_records_every_mutation(client):
    co_acc, _, _ = await _mk_account("co@example.com")
    _, pi_sess, pi_user = await _mk_account("pi@example.com")
    _login(client, pi_sess)

    sid = (await client.post("/api/v1/studies", json={"title": "Audited"})).json()["id"]
    await client.patch(f"/api/v1/studies/{sid}", json={"abstract": "now with abstract"})
    await client.post(
        f"/api/v1/studies/{sid}/investigators",
        json={"account_id": str(co_acc), "role": "analyst"},
    )
    await client.patch(
        f"/api/v1/studies/{sid}/investigators/{co_acc}", json={"role": "co-investigator"}
    )
    patch_id = await _mk_patch(pi_user)
    link = (
        await client.post(
            f"/api/v1/studies/{sid}/resources",
            json={"resource_kind": "patch", "resource_id": str(patch_id), "role": "stimulus"},
        )
    ).json()
    await client.delete(f"/api/v1/studies/{sid}/resources/{link['id']}")
    await client.delete(f"/api/v1/studies/{sid}/investigators/{co_acc}")

    actions = await _audit_actions(uuid.UUID(sid))
    assert actions == [
        "study.create",
        "study.update",
        "investigator.add",
        "investigator.role_change",
        "resource.link",
        "resource.unlink",
        "investigator.remove",
    ]

    # Audit is visible via the API to an investigator.
    api = await client.get(f"/api/v1/studies/{sid}/audit")
    assert api.status_code == 200
    assert len(api.json()["items"]) == len(actions)
