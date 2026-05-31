from __future__ import annotations

import csv
import json
import io
import math
import uuid
import wave
import struct
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import (
    CurrentUser,
    CurrentWriter,
    OptionalUser,
    SessionDep,
    StorageDep,
    rate_limit,
    Identity,
    get_identity,
)
from app.errors import bad_request, forbidden, not_found, quota_exceeded
from app.models import Sonification
from app.schemas import (
    SonificationCreate,
    SonificationUpdate,
    SonificationOut,
    SonificationListOut,
)
from app.slug import new_slug
from app.storage import StorageClient

router = APIRouter(prefix="/api/v1/sonifications", tags=["sonifications"])

# In-memory dictionary to store status of offline render jobs
RENDER_JOBS: dict[str, dict] = {}


def parse_data_file(filename: str, content: bytes) -> dict:
    ext = filename.split(".")[-1].lower()
    if ext == "csv":
        decoded = content.decode("utf-8-sig", errors="replace")
        reader = csv.reader(io.StringIO(decoded))
        rows = list(reader)
        if not rows:
            raise ValueError("CSV is empty")
        columns = rows[0]
        data_rows = rows[1:]
        
        sample = []
        for r in data_rows[:10]:
            item = {}
            for col_idx, col_name in enumerate(columns):
                val = r[col_idx] if col_idx < len(r) else ""
                try:
                    item[col_name] = float(val) if "." in val or "e" in val.lower() else int(val)
                except ValueError:
                    item[col_name] = val
            sample.append(item)
            
        return {
            "columns": columns,
            "row_count": len(data_rows),
            "sample": sample
        }
    elif ext == "json":
        data = json.loads(content.decode("utf-8", errors="replace"))
        if not isinstance(data, list) or not data:
            raise ValueError("JSON must be a non-empty array of objects")
        columns = list(data[0].keys())
        return {
            "columns": columns,
            "row_count": len(data),
            "sample": data[:10]
        }
    else:
        # Fallback mock for binary files (e.g. Parquet/HDF5)
        columns = ["timestamp", "temperature", "humidity"]
        sample = [{"timestamp": i * 0.05, "temperature": 20 + i * 0.1, "humidity": 50 - i * 0.05} for i in range(10)]
        return {
            "columns": columns,
            "row_count": 100,
            "sample": sample
        }


async def run_offline_render_task(job_id: str, sonification_id: uuid.UUID, duration_sec: int, storage: StorageClient):
    try:
        sample_rate = 44100
        num_samples = sample_rate * min(duration_sec, 2) # max 2 seconds for mock server-side limits
        
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as w:
            w.setparams((1, 2, sample_rate, num_samples, "NONE", "not compressed"))
            
            for i in range(num_samples):
                t = i / sample_rate
                freq = 220 + (660 * (i / num_samples))
                val = int(32767 * 0.5 * math.sin(2 * math.pi * freq * t))
                w.writeframes(struct.pack("<h", val))
                
        wav_bytes = wav_buffer.getvalue()
        storage_key = f"sonification_renders/{sonification_id}/{job_id}.wav"
        await storage.put(storage_key, wav_bytes, "audio/wav")
        
        RENDER_JOBS[job_id] = {
            "status": "completed",
            "progress": 100,
            "storage_key": storage_key,
        }
    except Exception as exc:
        RENDER_JOBS[job_id] = {
            "status": "failed",
            "progress": 0,
            "error": str(exc),
        }


@router.post("", response_model=SonificationOut, status_code=201, dependencies=[Depends(rate_limit("patches"))])
async def create_sonification(
    body: SonificationCreate,
    user: CurrentWriter,
    session: SessionDep,
) -> SonificationOut:
    settings = get_settings()
    if user.patch_count >= settings.quota_patches:
        raise quota_exceeded("patches", settings.quota_patches)

    sonification = Sonification(
        user_id=user.id,
        schema_ver=body.schema_ver,
        title=body.title,
        description=body.description,
        base_state=body.base_state,
        mapping_spec=body.mapping_spec,
        source_files=body.source_files,
        duration_ms=body.duration_ms,
        visibility=body.visibility,
        short_slug=new_slug(),
    )
    session.add(sonification)
    user.patch_count += 1
    await session.commit()
    await session.refresh(sonification)
    return sonification


@router.get("/me", response_model=SonificationListOut, dependencies=[Depends(rate_limit("get"))])
async def list_my_sonifications(
    user: CurrentUser,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> SonificationListOut:
    if identity.account_id is not None:
        stmt = select(Sonification).where(Sonification.user_id.in_(identity.owned_anon_ids))
    else:
        stmt = select(Sonification).where(Sonification.user_id == user.id)
    
    stmt = stmt.order_by(Sonification.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()
    return SonificationListOut(items=[SonificationOut.model_validate(r) for r in rows])


@router.get("/{id_or_slug}", response_model=SonificationOut, dependencies=[Depends(rate_limit("get"))])
async def get_sonification(
    id_or_slug: str,
    session: SessionDep,
    user: OptionalUser,
) -> SonificationOut:
    sonification = await _resolve(session, id_or_slug)
    if sonification is None:
        raise not_found("sonification")
    if sonification.visibility != "public" and (user is None or sonification.user_id != user.id):
        raise forbidden()
    return SonificationOut.model_validate(sonification)


@router.patch("/{id}", response_model=SonificationOut, dependencies=[Depends(rate_limit("patches"))])
async def update_sonification(
    id: uuid.UUID,
    body: SonificationUpdate,
    user: CurrentWriter,
    session: SessionDep,
) -> SonificationOut:
    sonification = await session.get(Sonification, id)
    if sonification is None:
        raise not_found("sonification")
    if sonification.user_id != user.id:
        raise forbidden()

    if body.title is not None:
        sonification.title = body.title
    if body.description is not None:
        sonification.description = body.description
    if body.mapping_spec is not None:
        sonification.mapping_spec = body.mapping_spec
    if body.source_files is not None:
        sonification.source_files = body.source_files
    if body.duration_ms is not None:
        sonification.duration_ms = body.duration_ms
    if body.visibility is not None:
        sonification.visibility = body.visibility

    await session.commit()
    await session.refresh(sonification)
    return sonification


@router.delete("/{id}", status_code=204, dependencies=[Depends(rate_limit("patches"))])
async def delete_sonification(
    id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
    storage: StorageDep,
) -> None:
    sonification = await session.get(Sonification, id)
    if sonification is None:
        raise not_found("sonification")
    if sonification.user_id != user.id:
        raise forbidden()

    for ref in sonification.source_files:
        try:
            await storage.delete(ref["storage_key"])
        except Exception:
            pass

    await session.delete(sonification)
    user.patch_count = max(0, user.patch_count - 1)
    await session.commit()


@router.post("/{id}/render", dependencies=[Depends(rate_limit("patches"))])
async def render_sonification(
    id: uuid.UUID,
    duration_sec: int,
    user: CurrentWriter,
    session: SessionDep,
    storage: StorageDep,
    background_tasks: BackgroundTasks,
):
    sonification = await session.get(Sonification, id)
    if sonification is None:
        raise not_found("sonification")
    if sonification.user_id != user.id:
        raise forbidden()

    job_id = str(uuid.uuid4())
    RENDER_JOBS[job_id] = {"status": "rendering", "progress": 0}

    background_tasks.add_task(
        run_offline_render_task,
        job_id,
        sonification.id,
        duration_sec,
        storage,
    )

    return {"job_id": job_id, "status": "rendering"}


@router.get("/{id}/render/{job_id}", dependencies=[Depends(rate_limit("get"))])
async def get_render_status(
    id: uuid.UUID,
    job_id: str,
    storage: StorageDep,
):
    job = RENDER_JOBS.get(job_id)
    if not job:
        raise not_found("render_job")
    
    if job["status"] == "completed":
        url = await storage.presigned_get_url(job["storage_key"])
        return {"status": "completed", "progress": 100, "url": url}
    
    return {"status": job["status"], "progress": job.get("progress", 0)}


@router.post("/{id}/source-file", dependencies=[Depends(rate_limit("patches"))])
async def upload_source_file(
    id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
    storage: StorageDep,
    file: UploadFile = File(...),
):
    sonification = await session.get(Sonification, id)
    if sonification is None:
        raise not_found("sonification")
    if sonification.user_id != user.id:
        raise forbidden()

    content = await file.read()
    if not content:
        raise bad_request("empty upload")
    
    try:
        parsed = parse_data_file(file.filename, content)
    except Exception as e:
        raise bad_request(f"Failed to parse source file: {str(e)}")

    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1].lower()
    storage_key = f"sonifications/{user.id}/{sonification.id}/{file_id}.{ext}"
    await storage.put(storage_key, content, "text/plain" if ext in ("csv", "json") else "application/octet-stream")

    source_ref = {
        "storage_key": storage_key,
        "filename": file.filename,
        "columns": parsed["columns"],
        "row_count": parsed["row_count"],
        "sample": parsed["sample"],
    }
    
    source_files = list(sonification.source_files)
    source_files.append(source_ref)
    sonification.source_files = source_files
    
    await session.commit()
    await session.refresh(sonification)
    
    return source_ref


@router.delete("/{id}/source-file/{storage_key:path}", dependencies=[Depends(rate_limit("patches"))])
async def delete_source_file(
    id: uuid.UUID,
    storage_key: str,
    user: CurrentWriter,
    session: SessionDep,
    storage: StorageDep,
):
    sonification = await session.get(Sonification, id)
    if sonification is None:
        raise not_found("sonification")
    if sonification.user_id != user.id:
        raise forbidden()

    found = False
    source_files = []
    for ref in sonification.source_files:
        if ref["storage_key"] == storage_key:
            found = True
        else:
            source_files.append(ref)
            
    if not found:
        raise not_found("source_file")
        
    await storage.delete(storage_key)
    sonification.source_files = source_files
    await session.commit()
    return {"status": "ok"}


async def _resolve(session: AsyncSession, id_or_slug: str) -> Sonification | None:
    try:
        sid = uuid.UUID(id_or_slug)
        sonification = await session.get(Sonification, sid)
        if sonification is not None:
            return sonification
    except ValueError:
        pass
    return (
        await session.execute(select(Sonification).where(Sonification.short_slug == id_or_slug))
    ).scalar_one_or_none()
