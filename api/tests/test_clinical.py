from __future__ import annotations

import uuid
from datetime import datetime, timezone
import pytest

from app.models import Account, Session, Study, ClinicalProtocol, ClinicalSessionRecord, User


# ── fixtures / helpers ─────────────────────────────────────────────────────────

async def _mk_account(email: str) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    from app.db import get_sessionmaker
    import datetime as dt

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
                expires_at=datetime.now(tz=timezone.utc) + dt.timedelta(days=30),
            )
        )
        s.add(User(id=user_id, account_id=acc_id))
        await s.commit()
    return acc_id, sess_id, user_id


def _login(client, sess_id: uuid.UUID) -> None:
    client.cookies.set("am_session", str(sess_id))


def _logout(client) -> None:
    client.cookies.clear()


# ── tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_protocol_crud_role_permissions(client):
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com")
    co_acc, co_sess, _ = await _mk_account("co@example.com")
    stranger_acc, stranger_sess, _ = await _mk_account("stranger@example.com")

    # 1. PI creates a study
    _login(client, pi_sess)
    study_r = await client.post("/api/v1/studies", json={"title": "Clinical Study"})
    assert study_r.status_code == 201, study_r.text
    study_id = study_r.json()["id"]

    # Add co-investigator to study
    add_co = await client.post(
        f"/api/v1/studies/{study_id}/investigators",
        json={"account_id": str(co_acc), "role": "co-investigator"},
    )
    assert add_co.status_code == 201

    # 2. Create Protocol: Stranger should be blocked
    _login(client, stranger_sess)
    err_post = await client.post(
        "/api/v1/clinical-protocols",
        json={
            "study_id": study_id,
            "conditions": [{"id": "cond-1", "name": "Condition A"}, {"id": "cond-2", "name": "Condition B"}],
            "randomization_scheme": "latin-square",
            "ct_gov_nct": "NCT12345678",
        },
    )
    assert err_post.status_code == 403

    # PI creates protocol successfully
    _login(client, pi_sess)
    ok_post = await client.post(
        "/api/v1/clinical-protocols",
        json={
            "study_id": study_id,
            "conditions": [
                {"id": "cond-a", "params": {"rootFreq": 200}},
                {"id": "cond-b", "params": {"rootFreq": 300}},
            ],
            "randomization_scheme": "latin-square",
            "ct_gov_nct": "NCT12345678",
        },
    )
    assert ok_post.status_code == 201, ok_post.text
    proto = ok_post.json()
    proto_id = proto["id"]
    assert proto["randomization_scheme"] == "latin-square"
    assert len(proto["conditions"]) == 2
    assert proto["ct_gov_nct"] == "NCT12345678"

    # 3. Read Protocol: stranger blocked on private study, co-investigator allowed
    _login(client, stranger_sess)
    assert (await client.get(f"/api/v1/clinical-protocols/{proto_id}")).status_code == 404

    _login(client, co_sess)
    get_ok = await client.get(f"/api/v1/clinical-protocols/{proto_id}")
    assert get_ok.status_code == 200
    assert get_ok.json()["ct_gov_nct"] == "NCT12345678"

    # 4. Update Protocol: co-investigator allowed
    update_ok = await client.patch(
        f"/api/v1/clinical-protocols/{proto_id}",
        json={"target_lufs": -18.0, "calibration_required": False},
    )
    assert update_ok.status_code == 200
    assert update_ok.json()["target_lufs"] == -18.0
    assert update_ok.json()["calibration_required"] is False

    # 5. Delete Protocol: co-investigator blocked, PI allowed
    _login(client, co_sess)
    assert (await client.delete(f"/api/v1/clinical-protocols/{proto_id}")).status_code == 403

    _login(client, pi_sess)
    assert (await client.delete(f"/api/v1/clinical-protocols/{proto_id}")).status_code == 204


@pytest.mark.asyncio
async def test_subject_enrollment_and_williams_randomization(client):
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com")
    _login(client, pi_sess)
    study_id = (await client.post("/api/v1/studies", json={"title": "Clinical Study"})).json()["id"]

    # Create protocol with 3 conditions under Latin Square Williams randomization
    proto_r = await client.post(
        "/api/v1/clinical-protocols",
        json={
            "study_id": study_id,
            "conditions": [
                {"id": "cond-a", "val": 1},
                {"id": "cond-b", "val": 2},
                {"id": "cond-c", "val": 3},
            ],
            "randomization_scheme": "latin-square",
            "calibration_required": True,
        },
    )
    assert proto_r.status_code == 201
    proto_id = proto_r.json()["id"]

    # Enroll subjects and verify Latin Square balance distributions
    # Since Williams Latin Square of size 3 generates a repeating sequence of size 2N = 6 rows,
    # enrolling 6 subjects should result in exactly 2 subjects assigned to each of the 3 conditions!
    condition_counts = {"cond-a": 0, "cond-b": 0, "cond-c": 0}
    session_ids = []

    _logout(client)  # Enroll endpoints do not require auth (anonymous subject runners)
    for i in range(6):
        enroll_r = await client.post(
            f"/api/v1/clinical-protocols/{proto_id}/enroll",
            json={"subject_id": f"subject-{i}"},
        )
        assert enroll_r.status_code == 201, enroll_r.text
        body = enroll_r.json()
        assert body["calibration_required"] is True
        assert body["target_lufs"] == -23.0

        cond_id = body["condition_id"]
        assert cond_id in condition_counts
        condition_counts[cond_id] += 1
        session_ids.append(body["session_id"])

    # Williams Latin Square requires equal distribution: exactly 2 of each condition
    assert condition_counts["cond-a"] == 2
    assert condition_counts["cond-b"] == 2
    assert condition_counts["cond-c"] == 2


@pytest.mark.asyncio
async def test_recruitment_bounds_block_enrollment(client):
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com")
    _login(client, pi_sess)
    study_id = (await client.post("/api/v1/studies", json={"title": "Recruitment Study"})).json()["id"]

    proto_r = await client.post(
        "/api/v1/clinical-protocols",
        json={
            "study_id": study_id,
            "conditions": [{"id": "cond-a", "val": 1}, {"id": "cond-b", "val": 2}],
            "randomization_scheme": "simple",
        },
    )
    proto_id = proto_r.json()["id"]

    # Transition study status to 'published' using studies.py API (published and archived block direct PATCH, archive is via DELETE)
    # Wait, let's just make the study 'analysis' or 'archived' status.
    # In studies PATCH, we block published/archived. So we can update status to 'analysis'.
    ok_patch = await client.patch(f"/api/v1/studies/{study_id}", json={"status": "analysis"})
    assert ok_patch.status_code == 200

    # Enroll subject should now be blocked
    _logout(client)
    err_enroll = await client.post(
        f"/api/v1/clinical-protocols/{proto_id}/enroll",
        json={"subject_id": "subject-blocked"},
    )
    assert err_enroll.status_code == 403
    assert err_enroll.json()["error"] == "study_not_recruiting"


@pytest.mark.asyncio
async def test_session_finalize_and_irb_discard_policy(client):
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com")
    _login(client, pi_sess)
    study_id = (await client.post("/api/v1/studies", json={"title": "Data Study"})).json()["id"]

    proto_r = await client.post(
        "/api/v1/clinical-protocols",
        json={
            "study_id": study_id,
            "conditions": [{"id": "cond-1", "val": 100}],
            "randomization_scheme": "simple",
        },
    )
    proto_id = proto_r.json()["id"]

    # 1. Subject enrolls
    _logout(client)
    enroll = (await client.post(
        f"/api/v1/clinical-protocols/{proto_id}/enroll",
        json={"subject_id": "subject-1"},
    )).json()
    session_id = enroll["session_id"]

    # 2. Finalize Session: Subject completes study
    completed_r = await client.post(
        "/api/v1/clinical-protocols/sessions",
        json={
            "id": session_id,
            "subject_id": "subject-1",
            "condition_id": "cond-1",
            "started_at": datetime.now(tz=timezone.utc).isoformat(),
            "completed_at": datetime.now(tz=timezone.utc).isoformat(),
            "stimulus_sha256": "sha-abc-123",
            "calibration_record": {"headphones_spl": 70.0, "gain": 1.2},
            "timing_report": {"latency_ms": 2.5, "jitter_ms": 0.4},
            "adverse_events": [],
            "withdrew": False,
            "client_audit_log": [{"event": "consent", "timestamp": "2026-05-31T00:00:00Z"}],
        },
    )
    assert completed_r.status_code == 201, completed_r.text
    record = completed_r.json()
    assert record["withdrew"] is False
    assert record["partial_data_disposition"] == "kept"
    assert record["stimulus_sha256"] == "sha-abc-123"

    # 3. Withdraw Discard Policy Test
    enroll_withdrawn = (await client.post(
        f"/api/v1/clinical-protocols/{proto_id}/enroll",
        json={"subject_id": "subject-withdrawn"},
    )).json()
    sess_withdrawn_id = enroll_withdrawn["session_id"]

    withdrawn_r = await client.post(
        "/api/v1/clinical-protocols/sessions",
        json={
            "id": sess_withdrawn_id,
            "subject_id": "subject-withdrawn",
            "condition_id": "cond-1",
            "started_at": datetime.now(tz=timezone.utc).isoformat(),
            "adverse_events": [{"elapsed_ms": 5000, "text": "headache"}],
            "withdrew": True,
            "partial_data_disposition": "discarded",
            "calibration_record": {"spl": 70.0},
            "timing_report": {"latency": 2.0},
            "client_audit_log": [
                {"event": "consent", "timestamp": "2026-05-31T00:00:00Z"},
                {"event": "flag_issue", "text": "headache"},
                {"event": "withdraw", "timestamp": "2026-05-31T00:05:00Z"},
            ],
        },
    )
    assert withdrawn_r.status_code == 201
    withdrawn_record = withdrawn_r.json()
    assert withdrawn_record["withdrew"] is True
    assert withdrawn_record["partial_data_disposition"] == "discarded"
    # Ensure clinical measurement data is wiped
    assert withdrawn_record["calibration_record"] is None
    assert withdrawn_record["timing_report"] is None
    # Ensure audit consent log is retained
    assert len(withdrawn_record["client_audit_log"]) == 3
    assert withdrawn_record["adverse_events"][0]["text"] == "headache"


@pytest.mark.asyncio
async def test_spl_manual_calibration_history(client):
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com")
    _login(client, pi_sess)
    study_id = (await client.post("/api/v1/studies", json={"title": "SPL Study"})).json()["id"]

    proto_r = await client.post(
        "/api/v1/clinical-protocols",
        json={
            "study_id": study_id,
            "conditions": [{"id": "cond-a", "val": 1}],
            "randomization_scheme": "simple",
        },
    )
    proto_id = proto_r.json()["id"]

    # Post calibration verification
    cal_r = await client.post(
        f"/api/v1/clinical-protocols/{proto_id}/calibrate",
        json={
            "device_name": "Sennheiser HD 600 SPL Meter Check",
            "measured_spl": 68.5,
            "target_spl": 70.0,
            "gain_offset_db": 1.5,
        },
    )
    assert cal_r.status_code == 200, cal_r.text
    proto = cal_r.json()
    assert len(proto["calibration_history"]) == 1
    assert proto["calibration_history"][0]["measured_spl"] == 68.5

    # Get calibration history
    history_r = await client.get(f"/api/v1/clinical-protocols/{proto_id}/calibration-history")
    assert history_r.status_code == 200
    assert len(history_r.json()) == 1
    assert history_r.json()[0]["device_name"] == "Sennheiser HD 600 SPL Meter Check"


@pytest.mark.asyncio
async def test_list_protocols(client):
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com")
    co_acc, co_sess, _ = await _mk_account("co@example.com")
    stranger_acc, stranger_sess, _ = await _mk_account("stranger@example.com")

    # PI creates study
    _login(client, pi_sess)
    study_id = (await client.post("/api/v1/studies", json={"title": "List Study"})).json()["id"]

    # PI creates two protocols
    await client.post("/api/v1/clinical-protocols", json={"study_id": study_id, "conditions": [{"id": "c1"}], "randomization_seed": "s1"})
    await client.post("/api/v1/clinical-protocols", json={"study_id": study_id, "conditions": [{"id": "c2"}], "randomization_seed": "s2"})

    # Stranger blocked
    _login(client, stranger_sess)
    assert (await client.get(f"/api/v1/clinical-protocols?study_id={study_id}")).status_code == 403

    # PI can list
    _login(client, pi_sess)
    r = await client.get(f"/api/v1/clinical-protocols?study_id={study_id}")
    assert r.status_code == 200
    assert len(r.json()) == 2

