from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import (
    CurrentUser,
    CurrentWriter,
    OptionalUser,
    SessionDep,
    StorageDep,
    rate_limit,
    require_admin,
)
from app.errors import bad_request, forbidden, not_found
from app.models import MappingTemplate, Sonification
from app.schemas import (
    MappingTemplateCreate,
    MappingTemplateUpdate,
    MappingTemplateOut,
    MappingTemplateListOut,
    SonificationFromTemplateIn,
    SonificationOut,
)
from app.slug import new_slug

# Base user-facing router
router = APIRouter(prefix="/api/v1/mapping-templates", tags=["mapping-templates"])

# Admin router
admin_router = APIRouter(
    prefix="/api/v1/admin/mapping-templates",
    tags=["admin-mapping-templates"],
    dependencies=[Depends(require_admin)],
)

# Instantiate router
instantiate_router = APIRouter(prefix="/api/v1/sonifications", tags=["sonifications"])


@router.get("", response_model=MappingTemplateListOut)
async def list_mapping_templates(
    session: SessionDep,
    domain_family: str | None = Query(default=None),
) -> MappingTemplateListOut:
    stmt = select(MappingTemplate).where(MappingTemplate.archived_at.is_(None))
    if domain_family:
        stmt = stmt.where(MappingTemplate.domain_family == domain_family)
    stmt = stmt.order_by(MappingTemplate.position.asc(), MappingTemplate.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()
    return MappingTemplateListOut(items=[MappingTemplateOut.model_validate(r) for r in rows])


@router.get("/{slug}", response_model=MappingTemplateOut)
async def get_mapping_template(
    slug: str,
    session: SessionDep,
) -> MappingTemplateOut:
    stmt = select(MappingTemplate).where(
        (MappingTemplate.slug == slug) & (MappingTemplate.archived_at.is_(None))
    )
    template = (await session.execute(stmt)).scalar_one_or_none()
    await session.commit()
    if template is None:
        raise not_found("mapping_template")
    return MappingTemplateOut.model_validate(template)


# --- Admin Mappings Management -----------------------------------------------

@admin_router.post("", response_model=MappingTemplateOut, status_code=201)
async def create_mapping_template(
    body: MappingTemplateCreate,
    session: SessionDep,
) -> MappingTemplateOut:
    # Check if slug unique
    existing = (
        await session.execute(
            select(MappingTemplate).where(MappingTemplate.slug == body.slug)
        )
    ).scalar_one_or_none()
    if existing:
        raise bad_request("Slug already exists")

    template = MappingTemplate(
        slug=body.slug,
        title=body.title,
        description=body.description,
        domain_family=body.domain_family,
        source_schema=body.source_schema,
        mapping_spec=body.mapping_spec,
        calibration_recommendation=body.calibration_recommendation,
        citation=body.citation,
        recipe_content=body.recipe_content,
        example_data_path=body.example_data_path,
        example_audio_path=body.example_audio_path,
        position=body.position,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return MappingTemplateOut.model_validate(template)


@admin_router.patch("/{id}", response_model=MappingTemplateOut)
async def update_mapping_template(
    id: uuid.UUID,
    body: MappingTemplateUpdate,
    session: SessionDep,
) -> MappingTemplateOut:
    template = await session.get(MappingTemplate, id)
    if template is None:
        raise not_found("mapping_template")

    if body.slug is not None:
        template.slug = body.slug
    if body.title is not None:
        template.title = body.title
    if body.description is not None:
        template.description = body.description
    if body.domain_family is not None:
        template.domain_family = body.domain_family
    if body.source_schema is not None:
        template.source_schema = body.source_schema
    if body.mapping_spec is not None:
        template.mapping_spec = body.mapping_spec
    if body.calibration_recommendation is not None:
        template.calibration_recommendation = body.calibration_recommendation
    if body.citation is not None:
        template.citation = body.citation
    if body.recipe_content is not None:
        template.recipe_content = body.recipe_content
    if body.example_data_path is not None:
        template.example_data_path = body.example_data_path
    if body.example_audio_path is not None:
        template.example_audio_path = body.example_audio_path
    if body.position is not None:
        template.position = body.position

    await session.commit()
    await session.refresh(template)
    return MappingTemplateOut.model_validate(template)


@admin_router.delete("/{id}", status_code=204)
async def delete_mapping_template(
    id: uuid.UUID,
    session: SessionDep,
) -> None:
    template = await session.get(MappingTemplate, id)
    if template is None:
        raise not_found("mapping_template")
    template.archived_at = datetime.now(timezone.utc)
    await session.commit()


# --- Instantiation endpoint --------------------------------------------------

def _calibrate_mapping_spec(mapping_spec: dict, data_rows: list[dict]) -> dict:
    if not data_rows:
        return mapping_spec

    # Work on a deep copy of the mapping spec
    import copy
    spec = copy.deepcopy(mapping_spec)

    # 1. Update first source with the full dataset
    if spec.get("sources"):
        spec["sources"][0]["data"] = data_rows

    # 2. Perform auto-calibration on linear/log/exp transforms
    rules = spec.get("rules", [])
    for rule in rules:
        col = rule.get("column")
        if not col:
            continue

        # Extract numeric values
        vals = []
        for r in data_rows:
            v = r.get(col)
            if v is not None:
                try:
                    vals.append(float(v))
                except (ValueError, TypeError):
                    pass

        if vals:
            cmin = min(vals)
            cmax = max(vals)
            # Prevent zero division division
            if cmin == cmax:
                cmin = cmin - 1
                cmax = cmax + 1

            transform = rule.get("transform", {})
            if transform:
                transform["rawMin"] = cmin
                transform["rawMax"] = cmax
            
            rule["calibrated"] = True
            rule["calibrationBounds"] = {"min": cmin, "max": cmax}

    return spec


@instantiate_router.post("/from-template", response_model=SonificationOut, status_code=201)
async def instantiate_sonification_from_template(
    body: SonificationFromTemplateIn,
    user: CurrentWriter,
    session: SessionDep,
) -> SonificationOut:
    # 1. Resolve mapping template
    stmt = select(MappingTemplate).where(
        (MappingTemplate.slug == body.template_slug) & (MappingTemplate.archived_at.is_(None))
    )
    template = (await session.execute(stmt)).scalar_one_or_none()
    if template is None:
        raise not_found("mapping_template")

    # 2. Calibrate and merge user data
    mapping_spec = template.mapping_spec
    if body.data_rows:
        mapping_spec = _calibrate_mapping_spec(mapping_spec, body.data_rows)

    # 3. Create Sonification record
    title = body.title or f"{template.title} (Instantiated)"
    description = body.description or f"Instantiated from template: {template.title}. {template.description}"
    
    # Pack inline source details if data rows are provided
    source_files = []
    if body.data_rows:
        cols = list(body.data_rows[0].keys()) if body.data_rows else []
        source_files.append({
            "storage_key": f"inline://{new_slug()}",
            "filename": "uploaded_data.json",
            "columns": cols,
            "row_count": len(body.data_rows),
            "sample": body.data_rows[:10]
        })

    sonification = Sonification(
        user_id=user.id,
        schema_ver=21,
        title=title,
        description=description,
        base_state={},
        mapping_spec=mapping_spec,
        source_files=source_files,
        duration_ms=body.duration_ms,
        visibility="unlisted",
        short_slug=new_slug(),
    )
    session.add(sonification)
    await session.commit()
    await session.refresh(sonification)
    return sonification
