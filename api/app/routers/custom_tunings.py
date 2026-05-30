from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.deps import CurrentWriter, SessionDep, rate_limit
from app.errors import forbidden, not_found
from app.models import CustomTuning
from app.schemas import CustomTuningCreate, CustomTuningOut, CustomTuningListOut

router = APIRouter(prefix="/api/v1/custom_tunings", tags=["custom_tunings"])


def _to_out(c: CustomTuning) -> CustomTuningOut:
    return CustomTuningOut.model_validate(c)


@router.post("", response_model=CustomTuningOut, status_code=201,
             dependencies=[Depends(rate_limit("captures"))])
async def create_custom_tuning(
    data: CustomTuningCreate,
    user: CurrentWriter,
    session: SessionDep,
) -> CustomTuningOut:
    tuning_id = uuid.uuid4()
    tuning = CustomTuning(
        id=tuning_id,
        user_id=user.id,
        name=data.name,
        scl_text=data.scl_text,
        parsed_scale=data.parsed_scale,
        reference_a4_hz=data.reference_a4_hz,
    )
    session.add(tuning)
    await session.commit()
    await session.refresh(tuning)
    return _to_out(tuning)


@router.get("", response_model=CustomTuningListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_custom_tunings(
    user: CurrentWriter,
    session: SessionDep,
) -> CustomTuningListOut:
    stmt = select(CustomTuning).where(CustomTuning.user_id == user.id).order_by(CustomTuning.created_at.desc())
    res = await session.execute(stmt)
    tunings = res.scalars().all()
    return CustomTuningListOut(items=[_to_out(t) for t in tunings])


@router.delete("/{id}", status_code=204,
               dependencies=[Depends(rate_limit("captures"))])
async def delete_custom_tuning(
    id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
) -> None:
    tuning = await session.get(CustomTuning, id)
    if tuning is None:
        raise not_found("custom tuning")
    if tuning.user_id != user.id:
        raise forbidden()
    await session.delete(tuning)
    await session.commit()
