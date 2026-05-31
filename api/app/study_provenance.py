"""v7.0 study provenance — the single audit write-path + snapshot materializer.

Every study mutation routes through :func:`record_audit`. Keeping one helper
(used by every mutating endpoint) is the heuristic-drift guard: provenance can
never be silently forgotten because the routes have no other way to mutate.

:func:`build_snapshot` materializes the full, dereferenced state of a study into
an immutable bundle (resolved resource metadata + content hash, never binary
payloads — see docs/v7.0-PLAN.md §4). Provenance ("what happened") and the
snapshot ("what was frozen") live together here on purpose.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Account,
    AudioClip,
    Experiment,
    ListeningSession,
    Patch,
    Piece,
    Study,
    StudyAuditLog,
    StudyInvestigator,
    StudyResource,
    UserScript,
)

ANNEAL_MUSIC_VERSION = "7.0.0"
SNAPSHOT_SCHEMA = "study-snapshot/v1"

# Resource kinds → (model, title attr, payload attr used for the content hash,
# owner attr). ``None`` payload/owner means "not hashable / unowned".
_RESOURCE_SPEC: dict[str, tuple[type, str, str | None, str | None]] = {
    "patch": (Patch, "title", "state", "user_id"),
    "piece": (Piece, "title", "defaults_state", "user_id"),
    "listening_session": (ListeningSession, "title", "bell_schedule", "user_id"),
    "experiment": (Experiment, "title", "definition", "user_id"),
    "user_script": (UserScript, "name", "source", "user_id"),
    "audio_clip": (AudioClip, "title", "storage_key", None),
}

# Enumerated action set — keep in sync with docs/v7.0-PLAN.md §5.
ACTIONS = {
    "study.create",
    "study.update",
    "study.archive",
    "study.publish",
    "study.export",
    "investigator.add",
    "investigator.role_change",
    "investigator.remove",
    "resource.link",
    "resource.unlink",
    "snapshot.create",
    "account.magic_link",
    "account.oauth_link",
    "account.oauth_unlink",
    "account.consent_change",
}


def record_audit(
    session: AsyncSession,
    *,
    study_id: uuid.UUID,
    account_id: uuid.UUID | None,
    action: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> StudyAuditLog:
    """Append a provenance row. Does **not** commit — the caller owns the
    transaction so the audit row lands atomically with the mutation it records.
    """
    entry = StudyAuditLog(
        study_id=study_id,
        account_id=account_id,
        action=action,
        before=before,
        after=after,
    )
    session.add(entry)
    return entry


def _content_hash(payload: Any) -> str:
    """Deterministic sha256 of a resource payload (JSON-canonicalized)."""
    if isinstance(payload, (dict, list)):
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    else:
        raw = str(payload).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


async def _resolve_resource(session: AsyncSession, link: StudyResource) -> dict[str, Any]:
    """Resolve a linked resource to title + content hash at freeze time so a
    later deletion of the source can't orphan a published version (§4)."""
    base: dict[str, Any] = {
        "resource_kind": link.resource_kind,
        "resource_id": str(link.resource_id),
        "role": link.role,
        "added_by": str(link.added_by) if link.added_by else None,
        "added_at": link.added_at.isoformat() if link.added_at else None,
        "title": None,
        "content_hash": None,
        "owner_user_id": None,
        "resolved": False,
    }
    spec = _RESOURCE_SPEC.get(link.resource_kind)
    if spec is None:
        # Opaque future kinds (dataset/sonification): recorded by reference only.
        return base
    model, title_attr, payload_attr, owner_attr = spec
    obj = await session.get(model, link.resource_id)
    if obj is None:
        return base  # source already gone; reference preserved, unresolved.
    base["title"] = getattr(obj, title_attr, None)
    if payload_attr is not None:
        base["content_hash"] = _content_hash(getattr(obj, payload_attr, None))
    if owner_attr is not None:
        owner = getattr(obj, owner_attr, None)
        base["owner_user_id"] = str(owner) if owner else None
    base["resolved"] = True
    return base


async def build_snapshot(
    session: AsyncSession, study: Study, version_label: str
) -> dict[str, Any]:
    """Materialize the full immutable bundle for a snapshot/version."""
    inv_rows = (
        await session.execute(
            select(StudyInvestigator, Account)
            .join(Account, Account.id == StudyInvestigator.account_id)
            .where(StudyInvestigator.study_id == study.id)
        )
    ).all()
    investigators = [
        {
            "account_id": str(inv.account_id),
            "display_name": acc.display_name,
            "orcid": acc.orcid,
            "affiliation_ror": acc.affiliation_ror,
            "role": inv.role,
        }
        for inv, acc in inv_rows
    ]

    link_rows = (
        await session.execute(
            select(StudyResource)
            .where(StudyResource.study_id == study.id)
            .order_by(StudyResource.added_at.asc())
        )
    ).scalars().all()
    resources = [await _resolve_resource(session, link) for link in link_rows]

    return {
        "schema": SNAPSHOT_SCHEMA,
        "snapshot_at": datetime.now(tz=timezone.utc).isoformat(),
        "snapshot_label": version_label,
        "anneal_music_version": ANNEAL_MUSIC_VERSION,
        "study": {
            "id": str(study.id),
            "slug": study.slug,
            "title": study.title,
            "description": study.description,
            "abstract": study.abstract,
            "status": study.status,
            "visibility": study.visibility,
            "preregistration_url": study.preregistration_url,
            "ethics_statement": study.ethics_statement,
            "funding_sources": list(study.funding_sources or []),
        },
        "investigators": investigators,
        "resources": resources,
    }

