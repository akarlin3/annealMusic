from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.models import Account, Session, User
from app.services.zenodo import MintResult, ZenodoError, ZenodoService, set_zenodo_service


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


def _login(client, sess_id: uuid.UUID) -> None:
    client.cookies.set("am_session", str(sess_id))


# ── account research-identity fields ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_account_orcid_ror_update_and_validation(client):
    _, sess, _ = await _mk_account("r@example.com")
    _login(client, sess)

    ok = await client.patch(
        "/api/v1/account/me",
        json={"orcid": "0000-0002-1825-0097", "affiliation_ror": "https://ror.org/03t748b94"},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["orcid"] == "0000-0002-1825-0097"
    assert ok.json()["affiliation_ror"] == "https://ror.org/03t748b94"

    # Malformed ORCID / ROR rejected.
    assert (await client.patch("/api/v1/account/me", json={"orcid": "not-an-orcid"})).status_code == 400
    assert (
        await client.patch("/api/v1/account/me", json={"affiliation_ror": "http://example.com"})
    ).status_code == 400

    # Empty string clears.
    cleared = await client.patch("/api/v1/account/me", json={"orcid": ""})
    assert cleared.json()["orcid"] is None


# ── publish pre-flight + stub mint ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_publish_preflight_enumerates_missing(client):
    _, sess, _ = await _mk_account("pi@example.com")  # no ORCID, no abstract/ethics
    _login(client, sess)
    sid = (await client.post("/api/v1/studies", json={"title": "Bare"})).json()["id"]

    r = await client.post(f"/api/v1/studies/{sid}/publish", json={"version_label": "published"})
    assert r.status_code == 422
    body = r.json()
    assert body["error"] == "preflight_failed"
    assert set(body["missing"]) == {"abstract", "ethics_statement", "investigator_orcid"}


@pytest.mark.asyncio
async def test_publish_stub_mints_doi_and_marks_published(client):
    set_zenodo_service(None)  # ensure default (stub mode: no token configured)
    _, sess, _ = await _mk_account("pi@example.com", orcid="0000-0002-1825-0097")
    _login(client, sess)
    sid = (
        await client.post(
            "/api/v1/studies",
            json={"title": "Ready", "abstract": "An abstract.", "ethics_statement": "IRB ok."},
        )
    ).json()["id"]

    pub = await client.post(f"/api/v1/studies/{sid}/publish", json={"version_label": "published"})
    assert pub.status_code == 200, pub.text
    body = pub.json()
    assert body["stub"] is True
    assert body["doi"].startswith("10.5281/zenodo.")
    assert body["concept_doi"].startswith("10.5281/zenodo.")

    # Study is now published with a concept DOI, and a version carries the DOI.
    study = (await client.get(f"/api/v1/studies/{sid}")).json()
    assert study["status"] == "published"
    assert study["concept_doi"] == body["concept_doi"]
    versions = (await client.get(f"/api/v1/studies/{sid}/versions")).json()["items"]
    assert versions[0]["doi"] == body["doi"]

    # The publish action is in the audit trail.
    actions = [a["action"] for a in (await client.get(f"/api/v1/studies/{sid}/audit")).json()["items"]]
    assert "study.publish" in actions

    # A published study cites with the DOI (not the /s/ URL).
    cite = (await client.get(f"/api/v1/studies/{sid}/citation?format=apa")).json()["citation"]
    assert f"https://doi.org/{body['concept_doi']}" in cite


@pytest.mark.asyncio
async def test_publish_only_pi(client):
    set_zenodo_service(None)
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com", orcid="0000-0002-1825-0097")
    co_acc, co_sess, _ = await _mk_account("co@example.com", orcid="0000-0002-1825-0098")
    _login(client, pi_sess)
    sid = (
        await client.post(
            "/api/v1/studies",
            json={"title": "Gated", "abstract": "a", "ethics_statement": "e"},
        )
    ).json()["id"]
    await client.post(
        f"/api/v1/studies/{sid}/investigators",
        json={"account_id": str(co_acc), "role": "co-investigator"},
    )
    _login(client, co_sess)
    r = await client.post(f"/api/v1/studies/{sid}/publish", json={"version_label": "v1"})
    assert r.status_code == 403


# ── retry / robustness (unit) ──────────────────────────────────────────────────────

class _FakeResp:
    def __init__(self, status_code: int, headers: dict | None = None, json_body=None):
        self.status_code = status_code
        self.headers = headers or {}
        self._json = json_body or {}
        self.text = ""

    def json(self):
        return self._json


@pytest.mark.asyncio
async def test_retry_backs_off_on_5xx_then_succeeds(monkeypatch):
    svc = ZenodoService(api_url="https://x/api", token="t")
    calls = {"n": 0}

    async def fake_request(method, url, **kwargs):
        calls["n"] += 1
        if calls["n"] < 3:
            return _FakeResp(503)
        return _FakeResp(200, json_body={"ok": True})

    async def no_sleep(_):
        return None

    monkeypatch.setattr(svc.client, "request", fake_request)
    monkeypatch.setattr("app.services.zenodo.asyncio.sleep", no_sleep)

    resp = await svc._request("GET", "https://x/api/thing")
    assert resp.status_code == 200
    assert calls["n"] == 3


@pytest.mark.asyncio
async def test_retry_does_not_retry_4xx(monkeypatch):
    svc = ZenodoService(api_url="https://x/api", token="t")
    calls = {"n": 0}

    async def fake_request(method, url, **kwargs):
        calls["n"] += 1
        return _FakeResp(400)

    monkeypatch.setattr(svc.client, "request", fake_request)
    resp = await svc._request("GET", "https://x/api/thing")
    assert resp.status_code == 400
    assert calls["n"] == 1  # no retry on client error


@pytest.mark.asyncio
async def test_retry_exhausts_and_raises(monkeypatch):
    svc = ZenodoService(api_url="https://x/api", token="t")

    async def always_503(method, url, **kwargs):
        return _FakeResp(503)

    async def no_sleep(_):
        return None

    monkeypatch.setattr(svc.client, "request", always_503)
    monkeypatch.setattr("app.services.zenodo.asyncio.sleep", no_sleep)
    with pytest.raises(ZenodoError):
        await svc._request("GET", "https://x/api/thing")


@pytest.mark.asyncio
async def test_publish_surfaces_zenodo_error(client):
    class _FailingService(ZenodoService):
        async def mint(self, snapshot_json):
            raise ZenodoError("boom")

    set_zenodo_service(_FailingService(api_url="https://x/api", token="t"))
    try:
        _, sess, _ = await _mk_account("pi@example.com", orcid="0000-0002-1825-0097")
        _login(client, sess)
        sid = (
            await client.post(
                "/api/v1/studies",
                json={"title": "Fails", "abstract": "a", "ethics_statement": "e"},
            )
        ).json()["id"]
        r = await client.post(f"/api/v1/studies/{sid}/publish", json={"version_label": "v1"})
        assert r.status_code == 502
        assert r.json()["error"] == "zenodo_error"
        # Study stays unpublished on failure.
        assert (await client.get(f"/api/v1/studies/{sid}")).json()["status"] != "published"
    finally:
        set_zenodo_service(None)
