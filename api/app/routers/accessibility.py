import uuid
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.deps import SessionDep, CurrentWriter
from app.models import AccessibilityDescription, Sonification, Piece, ListeningSession, Patch
from app.schemas import AccessibilityDescriptionOut, AccessibilityDescriptionCreate

router = APIRouter(prefix="/api/v1/accessibility-descriptions", tags=["accessibility"])


def generate_auto_description(kind: str, item) -> str:
    """Auto-generate descriptions based on canonical mapping specifications."""
    if not item:
        return "A custom generative audio artifact."

    title = getattr(item, "title", None) or "Untitled"

    if kind == "sonification":
        spec = getattr(item, "mapping_spec", {}) or {}
        domain = spec.get("domain", "scientific time-series")
        mappings = []
        # Support various mapping spec styles from v7.3 sonification specs
        raw_maps = spec.get("mappings", {}) or spec.get("channels", {})
        for param, mapping in raw_maps.items():
            source_field = mapping.get("field", mapping.get("source", "data"))
            dest_sound = mapping.get("sound", mapping.get("target", param))
            mappings.append(f"{source_field} mapped to {dest_sound}")
        
        mapping_str = "; ".join(mappings) if mappings else "frequency, amplitude, and orbit speed"
        return f"A {domain} sonification titled '{title}' representing visual data as sound. Parameter mappings include: {mapping_str}."

    elif kind == "piece":
        desc = getattr(item, "description", None) or "A structured ambient soundscape."
        duration = getattr(item, "total_duration_ms", None)
        dur_str = f" of {int(duration/1000)}s" if duration else ""
        return f"A generative musical piece{dur_str} titled '{title}'. {desc}"

    elif kind == "listening_session":
        intention = getattr(item, "intention", None) or "presence"
        settle = int(getattr(item, "settle_in_ms", 30000) / 1000)
        return f"A listening session titled '{title}' structured for calm meditation with intention '{intention}', starting with a {settle}s settle-in phase."

    elif kind == "patch":
        return f"A custom ambient synthesizer patch configuration titled '{title}'."

    return "A custom generative audio artifact."


@router.post("", response_model=AccessibilityDescriptionOut)
async def create_or_update_description(
    req: AccessibilityDescriptionCreate,
    session: SessionDep,
    current_user: CurrentWriter,
):
    """Create or manually override/curate a description for a published artifact."""
    # Check if a row already exists to support clean CRUD/updates
    stmt = (
        select(AccessibilityDescription)
        .where(
            AccessibilityDescription.artifact_kind == req.artifact_kind,
            AccessibilityDescription.artifact_id == req.artifact_id,
            AccessibilityDescription.language == req.language,
        )
    )
    res = await session.execute(stmt)
    desc = res.scalar_one_or_none()

    if desc:
        desc.description = req.description
        desc.source = req.source
    else:
        desc = AccessibilityDescription(
            artifact_kind=req.artifact_kind,
            artifact_id=req.artifact_id,
            description=req.description,
            language=req.language,
            source=req.source,
        )
        session.add(desc)

    await session.commit()
    await session.refresh(desc)
    return desc


@router.get("/{kind}/{id}", response_model=AccessibilityDescriptionOut)
async def get_description(
    kind: Literal["patch", "piece", "sonification", "listening_session"],
    id: uuid.UUID,
    session: SessionDep,
):
    """Retrieve the description transcript of an artifact, auto-generating it if no manual copy exists."""
    from sqlalchemy import select

    # 1. Look for existing manually written or auto-saved description
    stmt = (
        select(AccessibilityDescription)
        .where(
            AccessibilityDescription.artifact_kind == kind,
            AccessibilityDescription.artifact_id == id,
            AccessibilityDescription.language == "en",
        )
    )
    res = await session.execute(stmt)
    desc = res.scalar_one_or_none()

    if desc:
        return desc

    # 2. If not found, fetch the source item to auto-generate the canonical description
    item = None
    if kind == "patch":
        item = await session.get(Patch, id)
    elif kind == "piece":
        item = await session.get(Piece, id)
    elif kind == "sonification":
        item = await session.get(Sonification, id)
    elif kind == "listening_session":
        item = await session.get(ListeningSession, id)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source {kind} artifact not found"
        )

    # 3. Auto-generate on the fly
    auto_desc = generate_auto_description(kind, item)

    # Return as a transient/mock model for client convenience
    from datetime import datetime, timezone
    return AccessibilityDescription(
        artifact_kind=kind,
        artifact_id=id,
        description=auto_desc,
        language="en",
        source="auto",
        updated_at=datetime.now(timezone.utc),
    )
