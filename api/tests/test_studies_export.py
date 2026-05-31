from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Account, Patch, Session, Study, StudyVersion, User, ClinicalProtocol, ClinicalSessionRecord, UserScript


async def _mk_account(email: str) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
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
                short_slug=str(uuid.uuid4())[:8],
                title=title,
            )
        )
        await s.commit()
    return pid


def _login(client, sess_id: uuid.UUID) -> None:
    client.cookies.set("am_session", str(sess_id))


@pytest.mark.asyncio
async def test_export_endpoints_flow(client):
    # 1. Create a PI account and a Study
    pi_acc, pi_sess, pi_user = await _mk_account("pi_export@example.com")
    _login(client, pi_sess)
    
    study_r = await client.post("/api/v1/studies", json={"title": "Export Test", "abstract": "Reproducible science"})
    assert study_r.status_code == 201, study_r.text
    study = study_r.json()
    study_id = study["id"]

    # 2. Add a patch and link it
    patch_id = await _mk_patch(pi_user, "Core Stimulus")
    link_r = await client.post(
        f"/api/v1/studies/{study_id}/resources",
        json={"resource_kind": "patch", "resource_id": str(patch_id), "role": "stimulus"},
    )
    assert link_r.status_code == 201, link_r.text

    # 3. Create a snapshot version
    snap_r = await client.post(
        f"/api/v1/studies/{study_id}/snapshot",
        json={"version_label": "v1.0.0"},
    )
    assert snap_r.status_code == 201, snap_r.text
    version = snap_r.json()
    version_id = version["id"]

    # 4. Trigger study export
    export_r = await client.post(
        f"/api/v1/studies/{study_id}/export",
        json={
            "version_id": version_id,
            "reproducibility_level": "bytes-identical",
            "includes_subject_data": False,
            "pi_attestation": False
        }
    )
    assert export_r.status_code == 200, export_r.text
    export = export_r.json()
    assert export["reproducibility_level"] == "bytes-identical"
    assert export["includes_subject_data"] is False
    assert "manifest" in export
    
    export_id = export["id"]

    # 5. Get export metadata
    meta_r = await client.get(f"/api/v1/study-exports/{export_id}")
    assert meta_r.status_code == 200
    assert meta_r.json()["id"] == export_id

    # 6. Download export ZIP
    dl_r = await client.get(f"/api/v1/study-exports/{export_id}/download")
    assert dl_r.status_code == 200
    assert dl_r.headers["content-type"] == "application/zip"
    zip_bytes = dl_r.content

    # Unpack and verify ZIP structure
    zip_io = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(zip_io) as zf:
        namelist = zf.namelist()
        assert "manifest.json" in namelist
        assert "README.md" in namelist
        assert "CITATION.bib" in namelist
        assert f"stimuli/patch_{patch_id}.json" in namelist

        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert manifest["reproducibility_level"] == "bytes-identical"
        assert len(manifest["files"]) > 0

    # 7. Validate bundle via validation endpoint
    val_r = await client.post(
        "/api/v1/reproduce/validate",
        files={"file": ("export.zip", zip_bytes, "application/zip")}
    )
    assert val_r.status_code == 200, val_r.text
    report = val_r.json()
    assert report["valid"] is True
    assert report["reproducibility_level"] == "bytes-identical"
    assert report["rendered_audio_hash_matches"] is True


@pytest.mark.asyncio
async def test_export_with_anonymized_clinical_records(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    pi_acc, pi_sess, pi_user = await _mk_account("pi_clinical@example.com")
    _login(client, pi_sess)
    
    study_r = await client.post("/api/v1/studies", json={"title": "Clinical Export", "abstract": "Reproducible clinical data"})
    study_id = study_r.json()["id"]

    # Setup a clinical protocol and session records
    proto_id = uuid.uuid4()
    rec_id = uuid.uuid4()
    base_time = datetime.now(timezone.utc)

    async with sm() as s:
        # Create a clinical protocol
        s.add(
            ClinicalProtocol(
                id=proto_id,
                study_id=uuid.UUID(study_id),
                conditions=[{"id": "cond_a", "label": "Baseline"}],
                randomization_seed="seed42",
            )
        )
        # Create a private clinical session record with direct subject identifier
        s.add(
            ClinicalSessionRecord(
                id=rec_id,
                protocol_id=proto_id,
                subject_id="Patient-Avery-Karlin",
                condition_id="cond_a",
                started_at=base_time,
                completed_at=base_time + timedelta(minutes=5),
                timing_report={"latencies": [10, 15, 20]},
                adverse_events=[{"type": "headache", "severity": 3}],
            )
        )
        await s.commit()

    # Create snapshot version
    snap_r = await client.post(
        f"/api/v1/studies/{study_id}/snapshot",
        json={"version_label": "v2.0.0"},
    )
    version_id = snap_r.json()["id"]

    # Export with subject data & DP enabled (requires PI attestation)
    export_r = await client.post(
        f"/api/v1/studies/{study_id}/export",
        json={
            "version_id": version_id,
            "reproducibility_level": "statistically-equivalent",
            "includes_subject_data": True,
            "differential_privacy": True,
            "pi_attestation": True
        }
    )
    assert export_r.status_code == 200, export_r.text
    export = export_r.json()
    export_id = export["id"]

    # Download ZIP and verify clinical records anonymization
    dl_r = await client.get(f"/api/v1/study-exports/{export_id}/download")
    assert dl_r.status_code == 200
    zip_bytes = dl_r.content

    zip_io = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(zip_io) as zf:
        namelist = zf.namelist()
        assert "data/clinical_session_records.json" in namelist
        
        recs = json.loads(zf.read("data/clinical_session_records.json").decode("utf-8"))
        assert len(recs) == 1
        rec = recs[0]
        
        # 1. Subject ID should be scrubbed/replaced with a newly generated stable UUID
        assert rec["subject_id"] != "Patient-Avery-Karlin"
        assert len(rec["subject_id"]) == 36 # UUID format
        
        # 2. Timestamps must be relative offsets
        assert rec["relative_started_seconds"] == 0.0
        assert rec["relative_completed_seconds"] == 300.0 # 5 minutes in seconds
        assert "started_at" not in rec
        assert "completed_at" not in rec

        # 3. DP Noise applied to numeric arrays and adverse events
        assert rec["timing_report"]["latencies"] != [10, 15, 20]
        assert rec["adverse_events"][0]["severity"] != 3


@pytest.mark.asyncio
async def test_reproduce_run_endpoint(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    pi_acc, pi_sess, pi_user = await _mk_account("pi_runner@example.com")
    _login(client, pi_sess)
    
    study_r = await client.post("/api/v1/studies", json={"title": "Script Study"})
    study_id = study_r.json()["id"]

    # Add a user python script
    script_id = uuid.uuid4()
    script_src = """
import json
import os

print("Starting replication analysis...")
data_path = os.path.join("data", "clinical_session_records.json")
if os.path.exists(data_path):
    with open(data_path, "r") as f:
        records = json.load(f)
    print(f"Loaded {len(records)} anonymized subject records successfully.")
    for r in records:
        print(f"Record {r['id']} completed in {r['relative_completed_seconds']} seconds.")
else:
    print("No records found.")
"""
    async with sm() as s:
        s.add(
            UserScript(
                id=script_id,
                user_id=pi_user,
                name="analyze.py",
                source=script_src,
                language="python"
            )
        )
        await s.commit()

    # Link user script as analysis resource
    link_r = await client.post(
        f"/api/v1/studies/{study_id}/resources",
        json={"resource_kind": "user_script", "resource_id": str(script_id), "role": "analysis"},
    )
    assert link_r.status_code == 201, link_r.text

    # Setup some fake clinical records to run against
    proto_id = uuid.uuid4()
    rec_id = uuid.uuid4()
    base_time = datetime.now(timezone.utc)
    async with sm() as s:
        s.add(
            ClinicalProtocol(
                id=proto_id,
                study_id=uuid.UUID(study_id),
                conditions=[],
                randomization_seed="seed123",
            )
        )
        s.add(
            ClinicalSessionRecord(
                id=rec_id,
                protocol_id=proto_id,
                subject_id="Subj-1",
                condition_id="baseline",
                started_at=base_time,
                completed_at=base_time + timedelta(seconds=120),
            )
        )
        await s.commit()

    # Create snapshot and export
    snap_r = await client.post(f"/api/v1/studies/{study_id}/snapshot", json={"version_label": "v3.0.0"})
    version_id = snap_r.json()["id"]

    export_r = await client.post(
        f"/api/v1/studies/{study_id}/export",
        json={
            "version_id": version_id,
            "reproducibility_level": "bytes-identical",
            "includes_subject_data": True,
            "pi_attestation": True
        }
    )
    zip_bytes = (await client.get(f"/api/v1/study-exports/{export_r.json()['id']}/download")).content

    # Call POST /api/v1/reproduce/run
    run_r = await client.post(
        "/api/v1/reproduce/run",
        files={"file": ("export.zip", zip_bytes, "application/zip")}
    )
    assert run_r.status_code == 200, run_r.text
    report = run_r.json()
    assert report["valid"] is True
    assert "Starting replication analysis..." in report["analysis_script_output"]
    assert "Loaded 1 anonymized subject records successfully." in report["analysis_script_output"]
    assert f"Record {rec_id} completed in 120.0 seconds." in report["analysis_script_output"]
