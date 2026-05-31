"""v7.0 study provenance — the single audit write-path.

Every study mutation routes through :func:`record_audit`. Keeping one helper
(used by every mutating endpoint) is the heuristic-drift guard: provenance can
never be silently forgotten because the routes have no other way to mutate.

The snapshot materializer (CP2) will also live here, alongside provenance, so
the "what happened" and "what was frozen" logic stay together.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StudyAuditLog

# Enumerated action set — keep in sync with docs/v7.0-PLAN.md §5.
ACTIONS = {
    "study.create",
    "study.update",
    "study.archive",
    "study.publish",
    "investigator.add",
    "investigator.role_change",
    "investigator.remove",
    "resource.link",
    "resource.unlink",
    "snapshot.create",
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
