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
from app.deps import Identity, SessionDep, get_identity, rate_limit
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
    User,
    UserScript,
)
from app.schemas import (
    AuditEntryOut,
    AuditListOut,
    InvestigatorAdd,
    InvestigatorOut,
    InvestigatorRoleUpdate,
    ResourceLinkIn,
    ResourceListOut,
    ResourceOut,
    StudyCreate,
    StudyListOut,
    StudyOut,
    StudyUpdate,
)
from app.slug import new_slug
from app.study_provenance import record_audit

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
