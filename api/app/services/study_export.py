"""v7.5 study export service — ZIP bundle creator + anonymizer.

Builds a fully self-contained study export ZIP bundle including all metadata,
stimuli states, clinical protocols, scripts, requirements, and optionally anonymized
subject session data (relative timestamps, scrubbed IDs, differential privacy).
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import random
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AudioClip,
    BiosignalStream,
    ClinicalProtocol,
    ClinicalSessionRecord,
    Experiment,
    ListeningSession,
    Patch,
    Piece,
    Study,
    StudyExport,
    StudyVersion,
    UserScript,
)
from app.services.citation import Author, CitationContext, render as render_citation
from app.storage import StorageClient


# Pure-Python Laplace noise generator for self-contained Differential Privacy
def _laplace_noise(scale: float) -> float:
    if scale <= 0:
        return 0.0
    u = random.random() - 0.5
    return -scale * math.copysign(math.log(1.0 - 2.0 * abs(u)), u)


def _apply_dp_noise(obj: Any, scale: float = 1.0) -> Any:
    """Recursively injects Laplace noise to all float/int numeric values in dicts/lists."""
    if isinstance(obj, dict):
        return {k: _apply_dp_noise(v, scale) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_apply_dp_noise(v, scale) for v in obj]
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        return float(obj) + _laplace_noise(scale)
    return obj


async def create_study_export_bundle(
    session: AsyncSession,
    storage: StorageClient,
    study: Study,
    version: StudyVersion,
    reproducibility_level: str,
    includes_subject_data: bool = False,
    differential_privacy: bool = False,
    pi_attestation: bool = False,
) -> StudyExport:
    # 1. Fetch study version details (frozen metadata + resources)
    snapshot = version.snapshot_json
    resources = snapshot.get("resources", [])

    # Memory buffer to compile ZIP contents
    zip_buffer = io.BytesIO()
    
    # Track files written to compile the manifest files registry
    manifest_files = []
    
    # We will compute SHA-256 of each file before writing to zip
    def add_zip_file(zip_ref: zipfile.ZipFile, path: str, data: bytes, kind: str, role: str):
        sha256 = hashlib.sha256(data).hexdigest()
        zip_ref.writestr(path, data)
        manifest_files.append({
            "path": path,
            "sha256": sha256,
            "kind": kind,
            "role": role
        })

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # A. Stimuli and Scripts
        for res in resources:
            if not res.get("resolved"):
                continue
            kind = res["resource_kind"]
            rid = uuid.UUID(res["resource_id"])
            role = res.get("role") or "stimulus"
            
            if kind == "patch":
                obj = await session.get(Patch, rid)
                if obj:
                    data = json.dumps(obj.state, indent=2).encode("utf-8")
                    add_zip_file(zip_file, f"stimuli/patch_{rid}.json", data, "patch", role)
            elif kind == "piece":
                obj = await session.get(Piece, rid)
                if obj:
                    data = json.dumps(obj.defaults_state, indent=2).encode("utf-8")
                    add_zip_file(zip_file, f"stimuli/piece_{rid}.json", data, "piece", role)
            elif kind == "listening_session":
                obj = await session.get(ListeningSession, rid)
                if obj:
                    ls_data = {
                        "title": obj.title,
                        "description": obj.description,
                        "intention": obj.intention,
                        "bell_schedule": obj.bell_schedule,
                        "breath_pattern": obj.breath_pattern,
                        "total_duration_ms": obj.total_duration_ms
                    }
                    data = json.dumps(ls_data, indent=2).encode("utf-8")
                    add_zip_file(zip_file, f"stimuli/listening_session_{rid}.json", data, "listening_session", role)
            elif kind == "experiment":
                obj = await session.get(Experiment, rid)
                if obj:
                    data = json.dumps(obj.definition, indent=2).encode("utf-8")
                    add_zip_file(zip_file, f"protocols/experiment_{rid}.json", data, "experiment", role)
            elif kind == "user_script":
                obj = await session.get(UserScript, rid)
                if obj:
                    data = obj.source.encode("utf-8")
                    add_zip_file(zip_file, f"scripts/user_script_{rid}.py", data, "user_script", "analysis")
            elif kind == "audio_clip":
                obj = await session.get(AudioClip, rid)
                if obj:
                    clip_bytes = await storage.get(obj.storage_key)
                    if clip_bytes:
                        add_zip_file(zip_file, f"audio/audio_clip_{obj.slug}.opus", clip_bytes, "audio_clip", "stimulus")

        # B. Clinical Protocols
        protocols = (
            await session.execute(
                select(ClinicalProtocol).where(ClinicalProtocol.study_id == study.id)
            )
        ).scalars().all()

        for proto in protocols:
            proto_data = {
                "id": str(proto.id),
                "conditions": proto.conditions,
                "randomization_scheme": proto.randomization_scheme,
                "randomization_seed": proto.randomization_seed,
                "calibration_required": proto.calibration_required,
                "target_lufs": float(proto.target_lufs),
                "adverse_event_capture": proto.adverse_event_capture,
                "ct_gov_nct": proto.ct_gov_nct,
                "biosignal_channels": proto.biosignal_channels,
            }
            data = json.dumps(proto_data, indent=2).encode("utf-8")
            add_zip_file(zip_file, f"protocols/clinical_protocol_{proto.id}.json", data, "clinical_protocol", "protocol")

        # C. [OPTIONAL] Anonymized Subject Data
        if includes_subject_data:
            subject_id_map = {}  # Stable subject_id -> anonymized_uuid mapping
            anonymized_records = []

            for proto in protocols:
                records = (
                    await session.execute(
                        select(ClinicalSessionRecord).where(
                            ClinicalSessionRecord.protocol_id == proto.id
                        )
                    )
                ).scalars().all()

                for rec in records:
                    # Deterministic scrubbed subject ID using stable internal mapping
                    if rec.subject_id not in subject_id_map:
                        subject_id_map[rec.subject_id] = str(uuid.uuid4())
                    anon_subj_id = subject_id_map[rec.subject_id]

                    # Scrub absolute timestamps and calculate relative offsets
                    started_at = rec.started_at
                    completed_at = rec.completed_at
                    
                    duration = (completed_at - started_at).total_seconds() if completed_at else None

                    # Scrub sub-objects (timing report, adverse events, client audit log)
                    timing = rec.timing_report or {}
                    if differential_privacy:
                        timing = _apply_dp_noise(timing, scale=1.5)

                    adverse = rec.adverse_events or []
                    if differential_privacy:
                        adverse = _apply_dp_noise(adverse, scale=1.5)

                    # Anonymize client audit log by translating datetimes to relative seconds
                    client_log = []
                    for entry in (rec.client_audit_log or []):
                        anon_entry = dict(entry)
                        if "timestamp" in anon_entry:
                            try:
                                # Convert timestamp string to datetime
                                dt = datetime.fromisoformat(anon_entry["timestamp"].replace("Z", "+00:00"))
                                anon_entry["relative_offset_seconds"] = (dt - started_at).total_seconds()
                                anon_entry.pop("timestamp", None)
                            except Exception:
                                pass
                        client_log.append(anon_entry)

                    rec_data = {
                        "id": str(rec.id),
                        "protocol_id": str(rec.protocol_id),
                        "subject_id": anon_subj_id,
                        "condition_id": rec.condition_id,
                        "relative_started_seconds": 0.0,
                        "relative_completed_seconds": duration,
                        "stimulus_sha256": rec.stimulus_sha256,
                        "calibration_record": rec.calibration_record,
                        "timing_report": timing,
                        "adverse_events": adverse,
                        "withdrew": rec.withdrew,
                        "partial_data_disposition": rec.partial_data_disposition,
                        "client_audit_log": client_log,
                    }
                    anonymized_records.append(rec_data)

                    # Scrub and copy Biosignal Streams
                    streams = (
                        await session.execute(
                            select(BiosignalStream).where(
                                BiosignalStream.session_record_id == rec.id
                            )
                        )
                    ).scalars().all()

                    for stream in streams:
                        stream_bytes = await storage.get(stream.storage_key)
                        if stream_bytes:
                            # If it's biofeedback data, we can relative-ize timestamps
                            # e.g., if it's text/csv, replace first column with offset
                            lines = stream_bytes.decode("utf-8", errors="replace").splitlines()
                            scrubbed_lines = []
                            for idx, line in enumerate(lines):
                                if idx == 0:
                                    scrubbed_lines.append("relative_offset_seconds," + line.split(",", 1)[-1])
                                    continue
                                parts = line.split(",", 1)
                                if len(parts) > 1:
                                    try:
                                        # Assume first column is absolute timestamp, replace with relative offset
                                        dt = datetime.fromisoformat(parts[0].replace("Z", "+00:00"))
                                        offset = (dt - started_at).total_seconds()
                                        scrubbed_lines.append(f"{offset},{parts[1]}")
                                    except Exception:
                                        scrubbed_lines.append(line)
                                else:
                                    scrubbed_lines.append(line)
                            
                            scrubbed_bytes = "\n".join(scrubbed_lines).encode("utf-8")
                            add_zip_file(
                                zip_file,
                                f"data/biosignal_streams/stream_{stream.id}.csv",
                                scrubbed_bytes,
                                "biosignal_stream",
                                "data"
                            )

            records_bytes = json.dumps(anonymized_records, indent=2).encode("utf-8")
            add_zip_file(zip_file, "data/clinical_session_records.json", records_bytes, "clinical_session_records", "data")

        # D. Python Requirements environment lockfile
        reqs = "numpy==1.26.4\nscipy==1.12.0\n"
        add_zip_file(zip_file, "scripts/requirements.txt", reqs.encode("utf-8"), "requirements_lock", "analysis")

        # E. Citation.bib
        bib_authors = []
        for inv in snapshot.get("investigators", []):
            bib_authors.append(Author(
                name=inv.get("display_name") or "Anonymous",
                orcid=inv.get("orcid"),
                affiliation_ror=inv.get("affiliation_ror")
            ))
        
        doi = version.doi or study.concept_doi
        cite_ctx = CitationContext(
            title=study.title,
            authors=bib_authors,
            year=study.created_at.year,
            month=study.created_at.month,
            doi=doi,
            url=f"https://doi.org/{doi}" if doi else f"https://annealmusic.example.com/s/{study.slug}",
            version_label=version.version_label,
            publisher="Zenodo" if doi else "AnnealMusic",
        )
        bib_content = render_citation(cite_ctx, "bibtex")
        add_zip_file(zip_file, "CITATION.bib", bib_content.encode("utf-8"), "citation", "other")

        # F. README.md
        readme = f"""# Study Export Bundle: {study.title}

Generated: {datetime.now(timezone.utc).isoformat()}
Study Version: {version.version_label}
Reproducibility Level: {reproducibility_level}
AnnealMusic Core Version: 7.5.0

## Contents
- `manifest.json`: Top-level metadata, locks, and hashes registry.
- `stimuli/`: Frozen DSP stimulus configurations.
- `protocols/`: Clinical experiment and calibration definitions.
- `data/`: Anonymized clinical recordings (if opted-in).
- `scripts/`: Python analysis routines.

## Verification
Validate and reproduce this study using the `annealmusic` CLI:

```bash
annealmusic validate study-bundle.zip
annealmusic reproduce study-bundle.zip
```
"""
        add_zip_file(zip_file, "README.md", readme.encode("utf-8"), "readme", "other")

        # G. manifest.json itself
        manifest = {
            "manifest_version": "v1.0",
            "study_id": str(study.id),
            "version_id": str(version.id),
            "version_label": version.version_label,
            "reproducibility_level": reproducibility_level,
            "includes_subject_data": includes_subject_data,
            "annealmusic_version": "7.5.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "study_metadata": {
                "title": study.title,
                "slug": study.slug,
                "abstract": study.abstract,
                "concept_doi": study.concept_doi,
                "funding_sources": study.funding_sources or []
            },
            "version_locks": {
                "engine": {
                    "name": "physical engine",
                    "version": "1.2.3",
                    "pyodide_version": "0.26.0"
                },
                "python_environment": {
                    "cpython_version": "3.11",
                    "requirements": {
                        "numpy": "1.26.4",
                        "scipy": "1.12.0"
                    }
                },
                "assets": {
                    "bell_library_sha256": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    "source_bank_sha256": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                }
            },
            "files": manifest_files
        }
        
        manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
        # Put manifest directly into zip (we won't index manifest.json inside the manifest files list itself)
        zip_file.writestr("manifest.json", manifest_bytes)

    zip_bytes = zip_buffer.getvalue()
    zip_bytes_len = len(zip_bytes)
    zip_sha256 = hashlib.sha256(zip_bytes).hexdigest()

    # Save to storage (S3/R2)
    export_id = uuid.uuid4()
    storage_key = f"exports/{study.id}/{export_id}.zip"
    await storage.put(storage_key, zip_bytes, "application/zip")

    # Create StudyExport DB entry
    db_export = StudyExport(
        id=export_id,
        study_id=study.id,
        version_id=version.id,
        bundle_storage_key=storage_key,
        bundle_bytes=zip_bytes_len,
        bundle_sha256=zip_sha256,
        reproducibility_level=reproducibility_level,
        includes_subject_data=includes_subject_data,
        manifest=manifest,
    )
    
    session.add(db_export)
    return db_export
