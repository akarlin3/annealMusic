"""v7.0 — Studies: multi-investigator research collaboration.

A Study is a versioned, citable bundle of investigators + linked resources +
provenance. Studies require authenticated accounts; their linked resources are
owned by anon ``users`` claimed by those accounts (the accounts↔users bridge,
docs/v7.0-PLAN.md §11). Every mutation goes through :func:`require_study_role`
(permissions) and :func:`record_audit` (provenance) — the two heuristic-drift
guards. CP1 ships CRUD + investigators + resources + audit; snapshots,
citations and Zenodo publish land in CP2.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import Identity, SessionDep, get_identity, rate_limit, StorageDep
from app.errors import ApiError, forbidden, not_found, quota_exceeded, unauthorized
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
    StudyVersion,
    User,
    UserScript,
    StudyExport,
)
from app.schemas import (
    AuditEntryOut,
    AuditListOut,
    CitationOut,
    InvestigatorAdd,
    InvestigatorOut,
    InvestigatorRoleUpdate,
    PublishIn,
    PublishOut,
    ResourceLinkIn,
    ResourceListOut,
    ResourceOut,
    SnapshotIn,
    StudyCreate,
    StudyListOut,
    StudyOut,
    StudyUpdate,
    VersionDetailOut,
    VersionListOut,
    VersionOut,
    StudyExportCreate,
    StudyExportOut,
    ReproduceReport,
)
from app.services.citation import Author, CitationContext, render as render_citation
from app.services.zenodo import ZenodoError, get_zenodo_service
from app.slug import new_slug
from app.study_provenance import build_snapshot, record_audit
from app.services.study_export import create_study_export_bundle
from app.services.study_validation import validate_study_export_bundle, run_bundle_analysis_scripts

router = APIRouter(prefix="/api/v1/studies", tags=["studies"])

# ── roles & permissions ───────────────────────────────────────────────────────

_ROLE_RANK = {"viewer": 0, "analyst": 1, "co-investigator": 2, "pi": 3}

# Resource kinds backed by an owner table (verified + owned by an investigator).
_OWNED_KINDS: dict[str, type] = {
    "patch": Patch,
    "piece": Piece,
    "listening_session": ListeningSession,
    "experiment": Experiment,
    "user_script": UserScript,
}
# Kinds that must exist but have no per-user owner (curated/admin content).
_UNOWNED_KINDS: dict[str, type] = {"audio_clip": AudioClip}
# Future kinds (v7.1 sonification, v7.4 datasets) with no table yet — accepted
# as opaque references so the substrate is forward-compatible.
_OPAQUE_KINDS = {"dataset", "sonification"}


def _require_account(identity: Identity) -> uuid.UUID:
    if identity.account_id is None:
        raise unauthorized()
    return identity.account_id


async def _resolve_study(session: AsyncSession, id_or_slug: str) -> Study | None:
    try:
        sid = uuid.UUID(id_or_slug)
        study = await session.get(Study, sid)
        if study is not None:
            return study
    except ValueError:
        pass
    return (
        await session.execute(select(Study).where(Study.slug == id_or_slug))
    ).scalar_one_or_none()


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


async def require_study_role(
    session: AsyncSession,
    study: Study,
    identity: Identity,
    min_role: str,
) -> StudyInvestigator:
    """Return the caller's investigator row, or raise. ``min_role`` is the
    minimum rank required (viewer < analyst < co-investigator < pi)."""
    account_id = _require_account(identity)
    inv = await _get_investigator(session, study.id, account_id)
    if inv is None or _ROLE_RANK[inv.role] < _ROLE_RANK[min_role]:
        raise forbidden()
    return inv


async def _count_pis(session: AsyncSession, study_id: uuid.UUID) -> int:
    rows = (
        await session.execute(
            select(StudyInvestigator).where(
                StudyInvestigator.study_id == study_id,
                StudyInvestigator.role == "pi",
            )
        )
    ).scalars().all()
    return len(rows)


async def _owned_user_ids_for_study(session: AsyncSession, study_id: uuid.UUID) -> set[uuid.UUID]:
    """Union of all ``users.id`` claimed by the study's investigator accounts —
    the set whose resources any investigator may link (docs/v7.0-PLAN.md §11)."""
    inv_accounts = select(StudyInvestigator.account_id).where(
        StudyInvestigator.study_id == study_id
    )
    rows = (
        await session.execute(select(User.id).where(User.account_id.in_(inv_accounts)))
    ).scalars().all()
    return set(rows)


# ── serialization ──────────────────────────────────────────────────────────────

async def _investigator_outs(session: AsyncSession, study_id: uuid.UUID) -> list[InvestigatorOut]:
    rows = (
        await session.execute(
            select(StudyInvestigator, Account)
            .join(Account, Account.id == StudyInvestigator.account_id)
            .where(StudyInvestigator.study_id == study_id)
        )
    ).all()
    outs = [
        InvestigatorOut(
            account_id=inv.account_id,
            role=inv.role,
            added_at=inv.added_at,
            display_name=acc.display_name,
            orcid=acc.orcid,
            affiliation_ror=acc.affiliation_ror,
        )
        for inv, acc in rows
    ]
    # PIs first, then by join time — the citation author order (CP2 refines).
    outs.sort(key=lambda o: (-_ROLE_RANK[o.role], o.added_at))
    return outs


async def _study_out(session: AsyncSession, study: Study, my_role: str | None) -> StudyOut:
    return StudyOut(
        id=study.id,
        slug=study.slug,
        title=study.title,
        description=study.description,
        abstract=study.abstract,
        status=study.status,
        visibility=study.visibility,
        preregistration_url=study.preregistration_url,
        ethics_statement=study.ethics_statement,
        funding_sources=list(study.funding_sources or []),
        concept_doi=study.concept_doi,
        created_at=study.created_at,
        updated_at=study.updated_at,
        archived_at=study.archived_at,
        investigators=await _investigator_outs(session, study.id),
        my_role=my_role,  # type: ignore[arg-type]
    )


# ── studies CRUD ─────────────────────────────────────────────────────────────

@router.post("", response_model=StudyOut, status_code=201, dependencies=[Depends(rate_limit("scripts"))])
async def create_study(
    body: StudyCreate,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> StudyOut:
    account_id = _require_account(identity)
    settings = get_settings()

    # Quota: studies this account is the PI of.
    existing = (
        await session.execute(
            select(StudyInvestigator).where(
                StudyInvestigator.account_id == account_id,
                StudyInvestigator.role == "pi",
            )
        )
    ).scalars().all()
    if len(existing) >= settings.quota_studies:
        raise quota_exceeded("studies", settings.quota_studies)

    study = Study(
        slug=new_slug(),
        title=body.title,
        description=body.description,
        abstract=body.abstract,
        preregistration_url=body.preregistration_url,
        ethics_statement=body.ethics_statement,
        funding_sources=[f.model_dump() for f in (body.funding_sources or [])],
    )
    session.add(study)
    await session.flush()

    session.add(StudyInvestigator(study_id=study.id, account_id=account_id, role="pi"))
    record_audit(
        session,
        study_id=study.id,
        account_id=account_id,
        action="study.create",
        after={"title": study.title, "slug": study.slug},
    )
    await session.commit()
    await session.refresh(study)
    return await _study_out(session, study, my_role="pi")


@router.get("/me", response_model=StudyListOut, dependencies=[Depends(rate_limit("get"))])
async def list_my_studies(
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> StudyListOut:
    account_id = _require_account(identity)
    rows = (
        await session.execute(
            select(Study, StudyInvestigator.role)
            .join(StudyInvestigator, StudyInvestigator.study_id == Study.id)
            .where(StudyInvestigator.account_id == account_id)
            .order_by(Study.updated_at.desc())
        )
    ).all()
    items = [await _study_out(session, study, my_role=role) for study, role in rows]
    await session.commit()
    return StudyListOut(items=items)


@router.get("/{id_or_slug}", response_model=StudyOut, dependencies=[Depends(rate_limit("get"))])
async def get_study(
    id_or_slug: str,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> StudyOut:
    study = await _resolve_study(session, id_or_slug)
    if study is None:
        raise not_found("study")
    inv = await _get_investigator(session, study.id, identity.account_id)
    # Private studies 404 (not 403) to non-investigators to avoid leaking existence.
    if inv is None and study.visibility != "public":
        raise not_found("study")
    await session.commit()
    return await _study_out(session, study, my_role=inv.role if inv else None)


@router.patch("/{id}", response_model=StudyOut, dependencies=[Depends(rate_limit("scripts"))])
async def update_study(
    id: uuid.UUID,
    body: StudyUpdate,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> StudyOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    inv = await require_study_role(session, study, identity, "co-investigator")

    # 'published' and 'archived' are controlled transitions: 'published' is minted
    # only by the publish flow (CP2), 'archived' only by DELETE. Block them here so
    # a direct PATCH can't fake the study's lifecycle state.
    if body.status in ("published", "archived"):
        raise forbidden(f"Set status '{body.status}' via the dedicated endpoint, not PATCH.")

    before: dict = {}
    after: dict = {}
    fields = body.model_dump(exclude_unset=True)
    for key, value in fields.items():
        if key == "funding_sources" and value is not None:
            value = [f if isinstance(f, dict) else f.model_dump() for f in value]
        current = getattr(study, key)
        if current != value:
            before[key] = current
            after[key] = value
            setattr(study, key, value)

    if after:
        record_audit(
            session,
            study_id=study.id,
            account_id=identity.account_id,
            action="study.update",
            before=before,
            after=after,
        )
    await session.commit()
    await session.refresh(study)
    return await _study_out(session, study, my_role=inv.role)


@router.delete("/{id}", status_code=204, dependencies=[Depends(rate_limit("scripts"))])
async def archive_study(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> None:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    await require_study_role(session, study, identity, "pi")
    from datetime import datetime, timezone

    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="study.archive",
        before={"status": study.status, "archived_at": None},
        after={"status": "archived"},
    )
    study.status = "archived"
    study.archived_at = datetime.now(tz=timezone.utc)
    await session.commit()


# ── investigators (PI only) ─────────────────────────────────────────────────────

@router.post(
    "/{id}/investigators",
    response_model=list[InvestigatorOut],
    status_code=201,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def add_investigator(
    id: uuid.UUID,
    body: InvestigatorAdd,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> list[InvestigatorOut]:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    await require_study_role(session, study, identity, "pi")

    if body.account_id is not None:
        account = await session.get(Account, body.account_id)
    else:
        account = (
            await session.execute(
                select(Account).where(Account.email == (body.account_email or "").lower())
            )
        ).scalar_one_or_none()
    if account is None:
        raise not_found("account")

    existing = await _get_investigator(session, study.id, account.id)
    if existing is not None:
        raise ApiError(409, "already_investigator")

    session.add(StudyInvestigator(study_id=study.id, account_id=account.id, role=body.role))
    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="investigator.add",
        after={"account_id": str(account.id), "role": body.role},
    )
    await session.commit()
    return await _investigator_outs(session, study.id)


@router.patch(
    "/{id}/investigators/{account_id}",
    response_model=InvestigatorOut,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def change_investigator_role(
    id: uuid.UUID,
    account_id: uuid.UUID,
    body: InvestigatorRoleUpdate,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> InvestigatorOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    await require_study_role(session, study, identity, "pi")

    inv = await _get_investigator(session, study.id, account_id)
    if inv is None:
        raise not_found("investigator")

    old_role = inv.role
    if old_role == body.role:
        return (await _investigator_for(session, study.id, account_id))

    # Last-PI invariant: cannot downgrade the only PI.
    if old_role == "pi" and body.role != "pi" and await _count_pis(session, study.id) <= 1:
        raise ApiError(409, "last_pi")

    inv.role = body.role
    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="investigator.role_change",
        before={"account_id": str(account_id), "role": old_role},
        after={"account_id": str(account_id), "role": body.role},
    )
    await session.commit()
    return await _investigator_for(session, study.id, account_id)


@router.delete(
    "/{id}/investigators/{account_id}",
    status_code=204,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def remove_investigator(
    id: uuid.UUID,
    account_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> None:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    await require_study_role(session, study, identity, "pi")

    inv = await _get_investigator(session, study.id, account_id)
    if inv is None:
        raise not_found("investigator")

    # Last-PI invariant: cannot remove the only PI.
    if inv.role == "pi" and await _count_pis(session, study.id) <= 1:
        raise ApiError(409, "last_pi")

    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="investigator.remove",
        before={"account_id": str(account_id), "role": inv.role},
    )
    await session.delete(inv)
    await session.commit()


async def _investigator_for(
    session: AsyncSession, study_id: uuid.UUID, account_id: uuid.UUID
) -> InvestigatorOut:
    outs = await _investigator_outs(session, study_id)
    for o in outs:
        if o.account_id == account_id:
            return o
    raise not_found("investigator")


# ── resources ─────────────────────────────────────────────────────────────────

@router.get("/{id}/resources", response_model=ResourceListOut, dependencies=[Depends(rate_limit("get"))])
async def list_resources(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ResourceListOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    inv = await _get_investigator(session, study.id, identity.account_id)
    if inv is None and study.visibility != "public":
        raise not_found("study")

    rows = (
        await session.execute(
            select(StudyResource)
            .where(StudyResource.study_id == study.id)
            .order_by(StudyResource.added_at.asc())
        )
    ).scalars().all()
    await session.commit()
    return ResourceListOut(items=[ResourceOut.model_validate(r) for r in rows])


@router.post(
    "/{id}/resources",
    response_model=ResourceOut,
    status_code=201,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def link_resource(
    id: uuid.UUID,
    body: ResourceLinkIn,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ResourceOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    inv = await require_study_role(session, study, identity, "analyst")

    # Analyst lane: analysts may only link resources tagged role='analysis'.
    if inv.role == "analyst" and body.role != "analysis":
        raise forbidden("Analysts may only add analysis resources.")

    # Verify the resource per kind (docs/v7.0-PLAN.md §11).
    kind = body.resource_kind
    if kind in _OWNED_KINDS:
        model = _OWNED_KINDS[kind]
        resource = await session.get(model, body.resource_id)
        if resource is None:
            raise not_found("resource")
        owned = await _owned_user_ids_for_study(session, study.id)
        if resource.user_id not in owned:
            raise forbidden("Resource is not owned by any investigator.")
    elif kind in _UNOWNED_KINDS:
        if await session.get(_UNOWNED_KINDS[kind], body.resource_id) is None:
            raise not_found("resource")
    # _OPAQUE_KINDS (dataset/sonification): accepted as opaque future refs.

    existing = (
        await session.execute(
            select(StudyResource).where(
                StudyResource.study_id == study.id,
                StudyResource.resource_kind == kind,
                StudyResource.resource_id == body.resource_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ApiError(409, "already_linked")

    link = StudyResource(
        study_id=study.id,
        resource_kind=kind,
        resource_id=body.resource_id,
        role=body.role,
        added_by=identity.account_id,
    )
    session.add(link)
    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="resource.link",
        after={"resource_kind": kind, "resource_id": str(body.resource_id), "role": body.role},
    )
    await session.commit()
    await session.refresh(link)
    return ResourceOut.model_validate(link)


@router.delete(
    "/{id}/resources/{resource_id}",
    status_code=204,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def unlink_resource(
    id: uuid.UUID,
    resource_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> None:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    await require_study_role(session, study, identity, "co-investigator")

    # ``resource_id`` here is the study_resources row id (the link), not the
    # underlying resource — that is what the list endpoint exposes as ``id``.
    link = await session.get(StudyResource, resource_id)
    if link is None or link.study_id != study.id:
        raise not_found("resource")

    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="resource.unlink",
        before={
            "resource_kind": link.resource_kind,
            "resource_id": str(link.resource_id),
            "role": link.role,
        },
    )
    await session.delete(link)
    await session.commit()


# ── audit log (investigators) ───────────────────────────────────────────────────

@router.get("/{id}/audit", response_model=AuditListOut, dependencies=[Depends(rate_limit("get"))])
async def get_audit_log(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
    limit: int = Query(default=100, ge=1, le=500),
) -> AuditListOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    # Any investigator may read provenance; non-investigators cannot (even public).
    await require_study_role(session, study, identity, "viewer")

    rows = (
        await session.execute(
            select(StudyAuditLog)
            .where(StudyAuditLog.study_id == study.id)
            .order_by(StudyAuditLog.timestamp.desc())
            .limit(limit)
        )
    ).scalars().all()
    await session.commit()
    return AuditListOut(items=[AuditEntryOut.model_validate(r) for r in rows])


# ── snapshots / versions (CP2) ───────────────────────────────────────────────────

@router.post(
    "/{id}/snapshot",
    response_model=VersionDetailOut,
    status_code=201,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def create_snapshot(
    id: uuid.UUID,
    body: SnapshotIn,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> VersionDetailOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    await require_study_role(session, study, identity, "co-investigator")

    # Version labels are unique within a study.
    dup = (
        await session.execute(
            select(StudyVersion).where(
                StudyVersion.study_id == study.id,
                StudyVersion.version_label == body.version_label,
            )
        )
    ).scalar_one_or_none()
    if dup is not None:
        raise ApiError(409, "duplicate_version_label")

    snapshot = await build_snapshot(session, study, body.version_label)
    version = StudyVersion(
        study_id=study.id,
        version_label=body.version_label,
        snapshot_json=snapshot,
        created_by=identity.account_id,
    )
    session.add(version)
    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="snapshot.create",
        after={"version_label": body.version_label},
    )
    await session.commit()
    await session.refresh(version)
    return VersionDetailOut.model_validate(version)


@router.get("/{id}/versions", response_model=VersionListOut, dependencies=[Depends(rate_limit("get"))])
async def list_versions(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> VersionListOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    inv = await _get_investigator(session, study.id, identity.account_id)
    if inv is None and study.visibility != "public":
        raise not_found("study")

    rows = (
        await session.execute(
            select(StudyVersion)
            .where(StudyVersion.study_id == study.id)
            .order_by(StudyVersion.created_at.desc())
        )
    ).scalars().all()
    await session.commit()
    return VersionListOut(items=[VersionOut.model_validate(v) for v in rows])


@router.get(
    "/{id}/versions/{version_id}",
    response_model=VersionDetailOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def get_version(
    id: uuid.UUID,
    version_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> VersionDetailOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    inv = await _get_investigator(session, study.id, identity.account_id)
    if inv is None and study.visibility != "public":
        raise not_found("study")

    version = await session.get(StudyVersion, version_id)
    if version is None or version.study_id != study.id:
        raise not_found("version")
    await session.commit()
    return VersionDetailOut.model_validate(version)


# ── publish (DOI mint) — PI only ──────────────────────────────────────────────────

def _preflight(study: Study, investigators: list[InvestigatorOut]) -> list[str]:
    """Publication readiness — mirrors the UI checklist (docs/v7.0-PLAN.md §7)."""
    missing: list[str] = []
    if not (study.abstract or "").strip():
        missing.append("abstract")
    if not (study.ethics_statement or "").strip():
        missing.append("ethics_statement")
    if not any(i.role == "pi" for i in investigators):
        missing.append("principal_investigator")
    if any(not i.orcid for i in investigators):
        missing.append("investigator_orcid")
    return missing


@router.post("/{id}/publish", response_model=PublishOut, dependencies=[Depends(rate_limit("scripts"))])
async def publish_study(
    id: uuid.UUID,
    body: PublishIn,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> PublishOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    await require_study_role(session, study, identity, "pi")

    investigators = await _investigator_outs(session, study.id)
    missing = _preflight(study, investigators)
    if missing:
        raise ApiError(422, "preflight_failed", missing=missing)

    # Resolve (or create) the version to publish.
    if body.version_id is not None:
        version = await session.get(StudyVersion, body.version_id)
        if version is None or version.study_id != study.id:
            raise not_found("version")
    else:
        dup = (
            await session.execute(
                select(StudyVersion).where(
                    StudyVersion.study_id == study.id,
                    StudyVersion.version_label == body.version_label,
                )
            )
        ).scalar_one_or_none()
        if dup is not None:
            raise ApiError(409, "duplicate_version_label")
        snapshot = await build_snapshot(session, study, body.version_label or "published")
        version = StudyVersion(
            study_id=study.id,
            version_label=body.version_label or "published",
            snapshot_json=snapshot,
            created_by=identity.account_id,
        )
        session.add(version)
        record_audit(
            session,
            study_id=study.id,
            account_id=identity.account_id,
            action="snapshot.create",
            after={"version_label": version.version_label},
        )
        await session.flush()

    try:
        result = await get_zenodo_service().mint(version.snapshot_json)
    except ZenodoError as exc:
        # Leave the study un-published on failure (no partial state).
        raise ApiError(502, "zenodo_error", message=str(exc)[:200])

    version.doi = result.doi
    study.concept_doi = result.concept_doi
    study.status = "published"
    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="study.publish",
        before={"status": "analysis", "version_id": str(version.id)},
        after={"status": "published", "doi": result.doi},
    )
    await session.commit()
    return PublishOut(
        version_id=version.id, doi=result.doi, concept_doi=result.concept_doi, stub=result.stub
    )


# ── citation ──────────────────────────────────────────────────────────────────────

@router.get("/{id_or_slug}/citation", response_model=CitationOut, dependencies=[Depends(rate_limit("get"))])
async def get_citation(
    id_or_slug: str,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
    format: str = Query(default="bibtex"),
) -> CitationOut:
    if format not in ("bibtex", "apa", "chicago"):
        raise ApiError(422, "invalid_format", message="format must be bibtex|apa|chicago")
    study = await _resolve_study(session, id_or_slug)
    if study is None:
        raise not_found("study")
    inv = await _get_investigator(session, study.id, identity.account_id)
    if inv is None and study.visibility != "public":
        raise not_found("study")

    investigators = await _investigator_outs(session, study.id)
    authors = [
        Author(
            name=i.display_name or "Anonymous",
            orcid=i.orcid,
            affiliation_ror=i.affiliation_ror,
        )
        for i in investigators
    ]
    base = get_settings().public_base_url.rstrip("/")
    ctx = CitationContext(
        title=study.title,
        authors=authors,
        year=study.created_at.year,
        month=study.created_at.month,
        doi=study.concept_doi,
        url=(f"https://doi.org/{study.concept_doi}" if study.concept_doi else f"{base}/s/{study.slug}"),
        version_label=None,
        publisher="Zenodo" if study.concept_doi else "AnnealMusic (unpublished)",
    )
    await session.commit()
    return CitationOut(format=format, citation=render_citation(ctx, format))


# ── study export and reproduction endpoints ─────────────────────────────────────

@router.post("/{id}/export", response_model=StudyExportOut, dependencies=[Depends(rate_limit("scripts"))])
async def export_study(
    id: uuid.UUID,
    body: StudyExportCreate,
    session: SessionDep,
    storage: StorageDep,
    identity: Identity = Depends(get_identity),
) -> StudyExportOut:
    study = await session.get(Study, id)
    if study is None:
        raise not_found("study")
    await require_study_role(session, study, identity, "co-investigator")

    version = await session.get(StudyVersion, body.version_id)
    if version is None or version.study_id != study.id:
        raise not_found("version")

    db_export = await create_study_export_bundle(
        session,
        storage,
        study,
        version,
        body.reproducibility_level,
        includes_subject_data=body.includes_subject_data,
        differential_privacy=body.differential_privacy,
        pi_attestation=body.pi_attestation,
    )
    
    record_audit(
        session,
        study_id=study.id,
        account_id=identity.account_id,
        action="study.export",
        after={"version_label": version.version_label, "reproducibility_level": body.reproducibility_level},
    )
    await session.commit()
    return db_export


from pydantic import BaseModel
import re

class OrcidVerifyIn(BaseModel):
    orcid: str

class OrcidVerifyOut(BaseModel):
    orcid: str
    valid: bool

@router.post("/orcid-verify", response_model=OrcidVerifyOut, dependencies=[Depends(rate_limit("orcid_verify"))])
async def verify_orcid_endpoint(body: OrcidVerifyIn) -> OrcidVerifyOut:
    orcid = body.orcid.strip()
    match = re.match(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$", orcid)
    return OrcidVerifyOut(orcid=orcid, valid=bool(match))


study_exports_router = APIRouter(prefix="/api/v1/study-exports", tags=["studies"])

@study_exports_router.get("/{id}", response_model=StudyExportOut, dependencies=[Depends(rate_limit("get"))])
async def get_study_export(
    id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> StudyExportOut:
    export = await session.get(StudyExport, id)
    if export is None:
        raise not_found("export")
    
    study = await session.get(Study, export.study_id)
    if study is None:
        raise not_found("study")
    
    inv = await _get_investigator(session, study.id, identity.account_id)
    if inv is None and study.visibility != "public":
        raise not_found("study")
    
    await session.commit()
    return export


from fastapi.responses import StreamingResponse
import io

@study_exports_router.get("/{id}/download", dependencies=[Depends(rate_limit("get"))])
async def download_study_export(
    id: uuid.UUID,
    session: SessionDep,
    storage: StorageDep,
    identity: Identity = Depends(get_identity),
):
    export = await session.get(StudyExport, id)
    if export is None:
        raise not_found("export")
    
    study = await session.get(Study, export.study_id)
    if study is None:
        raise not_found("study")
    
    inv = await _get_investigator(session, study.id, identity.account_id)
    if inv is None and study.visibility != "public":
        raise not_found("study")
    
    zip_bytes = await storage.get(export.bundle_storage_key)
    if zip_bytes is None:
        raise not_found("zip")
    
    await session.commit()
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=study_{study.slug}_export_{export.id}.zip"},
    )


reproduce_router = APIRouter(prefix="/api/v1/reproduce", tags=["studies"])
from fastapi import UploadFile, File

@reproduce_router.post("/validate", response_model=ReproduceReport, dependencies=[Depends(rate_limit("scripts"))])
async def validate_bundle_endpoint(
    file: UploadFile = File(...),
) -> ReproduceReport:
    zip_bytes = await file.read()
    report = validate_study_export_bundle(zip_bytes)
    return report


@reproduce_router.post("/run", response_model=ReproduceReport, dependencies=[Depends(rate_limit("scripts"))])
async def run_bundle_endpoint(
    file: UploadFile = File(...),
) -> ReproduceReport:
    zip_bytes = await file.read()
    val_report = validate_study_export_bundle(zip_bytes)
    if not val_report["valid"]:
        return val_report
    
    run_report = run_bundle_analysis_scripts(zip_bytes)
    
    report = {
        "valid": val_report["valid"] and run_report["valid"],
        "errors": val_report["errors"] + run_report["errors"],
        "warnings": val_report["warnings"],
        "reproducibility_level": val_report["reproducibility_level"],
        "rendered_audio_hash_matches": val_report["rendered_audio_hash_matches"],
        "analysis_script_output": run_report["analysis_script_output"],
        "analysis_script_errors": run_report["analysis_script_errors"],
    }
    return report
