from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import Identity, SessionDep, get_identity, rate_limit, StorageDep
from app.errors import ApiError, forbidden, not_found, unauthorized
from app.models import (
    ClinicalProtocol,
    ClinicalSessionRecord,
    BiosignalStream,
    Study,
    StudyInvestigator,
    Experiment,
)
from app.schemas import (
    ClinicalProtocolCreate,
    ClinicalProtocolUpdate,
    ClinicalProtocolOut,
    ClinicalSessionRecordEnroll,
    ClinicalSessionRecordCreate,
    ClinicalSessionRecordOut,
    BiosignalStreamOut,
    BiosignalStreamUploadIn,
)
from app.services.randomization import assign_condition
from app.study_provenance import record_audit

router = APIRouter(prefix="/api/v1/clinical-protocols", tags=["clinical"])


# ── permission helpers ────────────────────────────────────────────────────────

_ROLE_RANK = {"viewer": 0, "analyst": 1, "co-investigator": 2, "pi": 3}


def _require_account(identity: Identity) -> uuid.UUID:
    if identity.account_id is None:
        raise unauthorized()
    return identity.account_id


async def _get_investigator(
    session: AsyncSession, study_id: uuid.UUID, account_id: uuid.UUID | None
) -> StudyInvestigator | None:
    if account_id is None:
        return None
    return (
        await session.execute(
            select(StudyInvestigator).where(
                StudyInvestigator.study_id == study_id,
                StudyInvestigator.account_id == account_id,
            )
        )
    ).scalar_one_or_none()


async def require_study_role_for_study(
    session: AsyncSession,
    study: Study,
    identity: Identity,
    min_role: str,
) -> StudyInvestigator:
    account_id = _require_account(identity)
    inv = await _get_investigator(session, study.id, account_id)
    if inv is None or _ROLE_RANK[inv.role] < _ROLE_RANK[min_role]:
        raise forbidden()
    return inv


# ── clinical protocols endpoints ──────────────────────────────────────────────

@router.post("", response_model=ClinicalProtocolOut, status_code=201, dependencies=[Depends(rate_limit("scripts"))])
async def create_protocol(
    body: ClinicalProtocolCreate,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ClinicalProtocolOut:
    account_id = _require_account(identity)
    study = await session.get(Study, body.study_id)
    if study is None:
        raise not_found("study")

    await require_study_role_for_study(session, study, identity, "co-investigator")

    # If experiment is linked, verify it exists
    if body.experiment_id is not None:
        exp = await session.get(Experiment, body.experiment_id)
        if exp is None:
            raise not_found("experiment")

    protocol = ClinicalProtocol(
        study_id=body.study_id,
        experiment_id=body.experiment_id,
        conditions=[c for c in body.conditions],
        randomization_scheme=body.randomization_scheme,
        randomization_seed=os.urandom(16).hex(),
        calibration_required=body.calibration_required,
        target_lufs=body.target_lufs,
        adverse_event_capture=body.adverse_event_capture,
        ct_gov_nct=body.ct_gov_nct,
        biosignal_channels=body.biosignal_channels,
    )
    session.add(protocol)
    await session.flush()

    record_audit(
        session,
        study_id=study.id,
        account_id=account_id,
        action="clinical_protocol.create",
        after={
            "id": str(protocol.id),
            "scheme": protocol.randomization_scheme,
            "target_lufs": float(protocol.target_lufs),
            "conditions_count": len(protocol.conditions),
        },
    )
    await session.commit()
    await session.refresh(protocol)
    return protocol


@router.get("", response_model=list[ClinicalProtocolOut], dependencies=[Depends(rate_limit("get"))])
async def list_protocols(
    study_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> list[ClinicalProtocolOut]:
    study = await session.get(Study, study_id)
    if study is None:
        raise not_found("study")

    await require_study_role_for_study(session, study, identity, "viewer")

    stmt = select(ClinicalProtocol).where(ClinicalProtocol.study_id == study_id).order_by(ClinicalProtocol.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()
    return list(rows)


@router.get("/{id}", response_model=ClinicalProtocolOut, dependencies=[Depends(rate_limit("get"))])
async def get_protocol(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ClinicalProtocolOut:
    protocol = await session.get(ClinicalProtocol, id)
    if protocol is None:
        raise not_found("clinical_protocol")

    study = await session.get(Study, protocol.study_id)
    if study is None:
        raise not_found("study")

    # Access control: public studies readable by anyone; private require investigator role
    inv = await _get_investigator(session, study.id, identity.account_id)
    if inv is None and study.visibility != "public":
        raise not_found("clinical_protocol")

    await session.commit()
    return protocol


@router.patch("/{id}", response_model=ClinicalProtocolOut, dependencies=[Depends(rate_limit("scripts"))])
async def update_protocol(
    id: uuid.UUID,
    body: ClinicalProtocolUpdate,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ClinicalProtocolOut:
    account_id = _require_account(identity)
    protocol = await session.get(ClinicalProtocol, id)
    if protocol is None:
        raise not_found("clinical_protocol")

    study = await session.get(Study, protocol.study_id)
    if study is None:
        raise not_found("study")

    await require_study_role_for_study(session, study, identity, "co-investigator")

    before = {}
    after = {}
    fields = body.model_dump(exclude_unset=True)
    for key, value in fields.items():
        if key == "experiment_id" and value is not None:
            exp = await session.get(Experiment, value)
            if exp is None:
                raise not_found("experiment")

        current = getattr(protocol, key)
        from decimal import Decimal
        if isinstance(current, Decimal):
            current = float(current)
        if isinstance(value, Decimal):
            value = float(value)

        if current != value:
            before[key] = current
            after[key] = value
            setattr(protocol, key, value)

    if after:
        record_audit(
            session,
            study_id=study.id,
            account_id=account_id,
            action="clinical_protocol.update",
            before=before,
            after=after,
        )
    await session.commit()
    await session.refresh(protocol)
    return protocol


@router.delete("/{id}", status_code=204, dependencies=[Depends(rate_limit("scripts"))])
async def delete_protocol(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> None:
    account_id = _require_account(identity)
    protocol = await session.get(ClinicalProtocol, id)
    if protocol is None:
        raise not_found("clinical_protocol")

    study = await session.get(Study, protocol.study_id)
    if study is None:
        raise not_found("study")

    await require_study_role_for_study(session, study, identity, "pi")

    record_audit(
        session,
        study_id=study.id,
        account_id=account_id,
        action="clinical_protocol.delete",
        before={
            "id": str(protocol.id),
            "scheme": protocol.randomization_scheme,
        },
    )
    await session.delete(protocol)
    await session.commit()


# ── enrollment & participant sessions ─────────────────────────────────────────

@router.post("/{id}/enroll", status_code=201, dependencies=[Depends(rate_limit("scripts"))])
async def enroll_subject(
    id: uuid.UUID,
    body: ClinicalSessionRecordEnroll,
    session: SessionDep,
) -> dict:
    # Public subject enrollment: accessible without authentication to let subjects enroll.
    # Enrollment is checked against Study state.
    protocol = await session.get(ClinicalProtocol, id)
    if protocol is None:
        raise not_found("clinical_protocol")

    study = await session.get(Study, protocol.study_id)
    if study is None:
        raise not_found("study")

    # Strict constraint: Enrollment only allowed if the study is active/collecting (or planning for testing)
    if study.status not in ("planning", "active", "data-collection"):
        raise ApiError(403, "study_not_recruiting", message=f"Enrollment blocked; study status is '{study.status}'")

    # Enrollment rank: Number of existing sessions pre-enrolled or completed
    stmt = select(func.count(ClinicalSessionRecord.id)).where(
        ClinicalSessionRecord.protocol_id == protocol.id
    )
    enrollment_rank = (await session.execute(stmt)).scalar_one()

    # CSPRNG assignment
    assigned_cond = assign_condition(
        scheme=protocol.randomization_scheme,
        seed=protocol.randomization_seed,
        subject_id=body.subject_id,
        enrollment_rank=enrollment_rank,
        conditions=protocol.conditions,
    )
    if assigned_cond is None:
        raise ApiError(500, "randomization_failed", "Failed to assign randomized condition")

    session_id = uuid.uuid4()
    session_record = ClinicalSessionRecord(
        id=session_id,
        protocol_id=protocol.id,
        subject_id=body.subject_id,
        condition_id=str(assigned_cond.get("id", "0")),
        started_at=datetime.now(tz=timezone.utc),
        withdrew=False,
    )
    session.add(session_record)

    record_audit(
        session,
        study_id=study.id,
        account_id=None,  # Anonymous subject action
        action="session.enroll",
        after={
            "session_id": str(session_id),
            "subject_id": body.subject_id,
            "condition_id": session_record.condition_id,
            "enrollment_rank": enrollment_rank,
        },
    )
    await session.commit()

    return {
        "session_id": session_id,
        "condition_id": session_record.condition_id,
        "condition": assigned_cond,
        "calibration_required": protocol.calibration_required,
        "target_lufs": float(protocol.target_lufs),
        "adverse_event_capture": protocol.adverse_event_capture,
        "biosignal_channels": protocol.biosignal_channels,
    }


@router.post("/sessions", response_model=ClinicalSessionRecordOut, status_code=201, dependencies=[Depends(rate_limit("scripts"))])
async def create_or_finalize_session(
    body: ClinicalSessionRecordCreate,
    session: SessionDep,
    storage: StorageDep,
) -> ClinicalSessionRecordOut:
    # Subject device pushes session completion / withdraw telemetry
    record = await session.get(ClinicalSessionRecord, body.id)
    if record is None:
        raise not_found("session_record")

    protocol = await session.get(ClinicalProtocol, record.protocol_id)
    if protocol is None:
        raise not_found("clinical_protocol")

    study = await session.get(Study, protocol.study_id)
    if study is None:
        raise not_found("study")

    # IRB Dispose Compliance: Withdraw is real
    if body.withdrew:
        record.withdrew = True
        record.partial_data_disposition = body.partial_data_disposition or "discarded"
        
        if record.partial_data_disposition == "discarded":
            # Strip all response values to complete erase but retain timing jitter/consent logs for safety
            record.calibration_record = None
            record.timing_report = None
            record.client_audit_log = [
                log for log in (body.client_audit_log or [])
                if log.get("event") in ("consent", "withdraw", "flag_issue")
            ]
            # Delete physical files from storage client for all associated biosignal streams (GDPR Shred)
            from app.models import BiosignalStream
            from sqlalchemy import select
            streams_res = await session.execute(
                select(BiosignalStream).where(BiosignalStream.session_record_id == body.id)
            )
            streams = streams_res.scalars().all()
            for stream in streams:
                try:
                    await storage.delete(stream.storage_key)
                except Exception as e:
                    print(f"Failed to delete storage key {stream.storage_key}: {e}")
                await session.delete(stream)
        else:
            record.calibration_record = body.calibration_record
            record.timing_report = body.timing_report
            record.client_audit_log = body.client_audit_log
    else:
        record.completed_at = body.completed_at or datetime.now(tz=timezone.utc)
        record.stimulus_sha256 = body.stimulus_sha256
        record.calibration_record = body.calibration_record
        record.timing_report = body.timing_report
        record.client_audit_log = body.client_audit_log
        record.partial_data_disposition = "kept"

    record.adverse_events = body.adverse_events

    record_audit(
        session,
        study_id=study.id,
        account_id=None,
        action="session.withdraw" if record.withdrew else "session.complete",
        after={
            "session_id": str(record.id),
            "subject_id": record.subject_id,
            "disposition": record.partial_data_disposition,
            "adverse_events_count": len(record.adverse_events),
        },
    )
    await session.commit()
    await session.refresh(record)
    return record


@router.get("/sessions/{id}", response_model=ClinicalSessionRecordOut, dependencies=[Depends(rate_limit("get"))])
async def get_session_record(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ClinicalSessionRecordOut:
    # Requires investigator role to read clinical dataset outputs
    record = await session.get(ClinicalSessionRecord, id)
    if record is None:
        raise not_found("session_record")

    protocol = await session.get(ClinicalProtocol, record.protocol_id)
    if protocol is None:
        raise not_found("clinical_protocol")

    study = await session.get(Study, protocol.study_id)
    if study is None:
        raise not_found("study")

    await require_study_role_for_study(session, study, identity, "viewer")

    await session.commit()
    return record


# ── calibration history endpoints ─────────────────────────────────────────────

@router.post("/{id}/calibrate", response_model=ClinicalProtocolOut, status_code=200, dependencies=[Depends(rate_limit("scripts"))])
async def record_calibration(
    id: uuid.UUID,
    body: dict,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ClinicalProtocolOut:
    account_id = _require_account(identity)
    protocol = await session.get(ClinicalProtocol, id)
    if protocol is None:
        raise not_found("clinical_protocol")

    study = await session.get(Study, protocol.study_id)
    if study is None:
        raise not_found("study")

    await require_study_role_for_study(session, study, identity, "co-investigator")

    # Add calibration event to protocol history
    cal_record = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "account_id": str(account_id),
        "device_name": body.get("device_name", "Unknown SPL Device"),
        "measured_spl": body.get("measured_spl", 0.0),
        "target_spl": body.get("target_spl", 70.0),
        "gain_offset_db": body.get("gain_offset_db", 0.0),
    }

    # Append to existing history
    history = list(protocol.calibration_history or [])
    history.append(cal_record)
    protocol.calibration_history = history

    record_audit(
        session,
        study_id=study.id,
        account_id=account_id,
        action="clinical_protocol.calibrate",
        after={
            "id": str(protocol.id),
            "measured_spl": cal_record["measured_spl"],
            "gain_offset_db": cal_record["gain_offset_db"],
        },
    )
    await session.commit()
    await session.refresh(protocol)
    return protocol


@router.get("/{id}/calibration-history", response_model=list[dict], dependencies=[Depends(rate_limit("get"))])
async def get_calibration_history(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> list[dict]:
    protocol = await session.get(ClinicalProtocol, id)
    if protocol is None:
        raise not_found("clinical_protocol")

    study = await session.get(Study, protocol.study_id)
    if study is None:
        raise not_found("study")

    await require_study_role_for_study(session, study, identity, "viewer")

    await session.commit()
    return protocol.calibration_history or []


session_record_router = APIRouter(tags=["clinical"])

@session_record_router.post("/api/v1/clinical-session-records/{id}/biosignal-stream", response_model=BiosignalStreamOut, status_code=201, dependencies=[Depends(rate_limit("scripts"))])
async def upload_biosignal_stream(
    id: uuid.UUID,
    body: BiosignalStreamUploadIn,
    session: SessionDep,
    storage: StorageDep,
):
    # Verify session record exists
    record = await session.get(ClinicalSessionRecord, id)
    if record is None:
        raise not_found("clinical_session_record")

    stream_id = uuid.uuid4()
    storage_key = f"biosignal_streams/{id}/{stream_id}.parquet"
    
    # Serialize frames array to represent the Parquet stream
    import json
    payload_bytes = json.dumps(body.frames).encode("utf-8")
    
    # Write payload to Storage client
    await storage.put(storage_key, payload_bytes, "application/octet-stream")
    
    from datetime import timedelta
    stream = BiosignalStream(
        id=stream_id,
        session_record_id=id,
        device_id=body.device_id,
        channel_name=body.channel_name,
        storage_key=storage_key,
        sample_rate_hz=body.sample_rate_hz,
        bytes=len(payload_bytes),
        consented_at=body.consented_at,
        retention_until=datetime.now(tz=timezone.utc) + timedelta(days=365)
    )
    session.add(stream)
    await session.commit()
    await session.refresh(stream)
    return stream

@session_record_router.delete("/api/v1/biosignal-streams/{id}", status_code=204, dependencies=[Depends(rate_limit("scripts"))])
async def delete_biosignal_stream(
    id: uuid.UUID,
    session: SessionDep,
    storage: StorageDep,
):
    stream = await session.get(BiosignalStream, id)
    if stream is None:
        raise not_found("biosignal_stream")

    # Delete physical file from storage client
    await storage.delete(stream.storage_key)
    
    # Remove database record
    await session.delete(stream)
    await session.commit()
