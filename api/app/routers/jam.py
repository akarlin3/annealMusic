from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel

from app.deps import (
    CurrentUser,
    CurrentWriter,
    SessionDep,
    rate_limit,
)
from app.errors import forbidden, invalid_state, not_found
from app.models import Account, JamParticipant, JamSession, Patch, PatchCollaborator, User
from app.schemas import (
    JamParticipantOut,
    JamSessionDetailOut,
    JamSessionJoinOut,
    JamSessionOut,
    PatchOut,
)
from app.share import parse_engine, parse_mode
from app.slug import new_slug

logger = logging.getLogger("jam")
router = APIRouter(prefix="/api/v1/jam-sessions", tags=["jam"])

# Curated HSL colors assigned to participants for premium cursors
COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"]



class JamConnectionManager:
    def __init__(self) -> None:
        # maps session_id -> list of active websockets
        self.active_connections: dict[uuid.UUID, list[WebSocket]] = {}

    async def connect(self, session_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, session_id: uuid.UUID, websocket: WebSocket) -> None:
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(
        self, session_id: uuid.UUID, message: Any, sender: WebSocket | None = None
    ) -> None:
        if session_id not in self.active_connections:
            return
        for connection in self.active_connections[session_id]:
            if connection == sender:
                continue
            try:
                if isinstance(message, bytes):
                    await connection.send_bytes(message)
                elif isinstance(message, str):
                    await connection.send_text(message)
                else:
                    await connection.send_json(message)
            except Exception:
                # ignore connection drop errors on send
                pass


manager = JamConnectionManager()


async def get_participant_details(
    session_id: uuid.UUID, session: AsyncSession
) -> list[JamParticipantOut]:
    stmt = (
        select(JamParticipant, Account.display_name, Account.avatar_seed)
        .where(JamParticipant.session_id == session_id)
        .outerjoin(User, User.id == JamParticipant.user_id)
        .outerjoin(Account, Account.id == User.account_id)
        .order_by(JamParticipant.joined_at.asc())
    )
    res = await session.execute(stmt)
    rows = res.all()
    out = []
    for p, name, seed in rows:
        out.append(
            JamParticipantOut(
                user_id=p.user_id,
                joined_at=p.joined_at,
                left_at=p.left_at,
                color=p.color,
                display_name=name or "Anonymous",
                avatar_seed=seed,
            )
        )
    return out


@router.post(
    "",
    response_model=JamSessionDetailOut,
    status_code=201,
    dependencies=[Depends(rate_limit("jams"))],
)
async def create_session(
    user: CurrentWriter, session: SessionDep, request: Request
) -> JamSessionDetailOut:
    session_id = uuid.uuid4()

    # Create the jam session
    jam = JamSession(
        id=session_id,
        created_by=user.id,
        created_at=datetime.now(tz=timezone.utc),
        last_active_at=datetime.now(tz=timezone.utc),
        audit_log=[
            {
                "event": "created",
                "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                "user_id": str(user.id),
            }
        ],
    )
    session.add(jam)

    # Automatically join the host as the first participant
    host_participant = JamParticipant(
        session_id=session_id,
        user_id=user.id,
        color=COLORS[0],
        joined_at=datetime.now(tz=timezone.utc),
    )
    session.add(host_participant)

    await session.commit()
    await session.refresh(jam)

    # Build WebSocket signaling URL
    ws_scheme = "wss" if request.url.scheme == "https" else "ws"
    ws_url = f"{ws_scheme}://{request.url.netloc}/api/v1/jam-sessions/{session_id}/signal"

    participants = await get_participant_details(session_id, session)

    return JamSessionDetailOut(
        session=JamSessionOut.from_orm(jam),
        participants=participants,
        ws_url=ws_url,
    )


@router.post(
    "/{id}/join",
    response_model=JamSessionJoinOut,
    dependencies=[Depends(rate_limit("jams"))],
)
async def join_session(
    id: uuid.UUID, user: CurrentWriter, session: SessionDep, request: Request
) -> JamSessionJoinOut:
    jam = await session.get(JamSession, id)
    if jam is None:
        raise not_found("session")
    if jam.ended_at is not None:
        raise invalid_state("This jam session has ended.")

    # Get active participants
    active_stmt = select(JamParticipant).where(
        JamParticipant.session_id == id, JamParticipant.left_at.is_(None)
    )
    active_res = await session.execute(active_stmt)
    active_participants = list(active_res.scalars().all())

    # Limit to 2 participants for v1.8
    if len(active_participants) >= 2 and not any(
        p.user_id == user.id for p in active_participants
    ):
        raise forbidden("This jam session is currently full (2 player limit).")

    # If the user is already joined and active, return existing registration details
    existing = next((p for p in active_participants if p.user_id == user.id), None)
    if existing is not None:
        ws_scheme = "wss" if request.url.scheme == "https" else "ws"
        ws_url = f"{ws_scheme}://{request.url.netloc}/api/v1/jam-sessions/{id}/signal"
        return JamSessionJoinOut(color=existing.color, ws_url=ws_url)

    # Determine assigned color
    used_colors = {p.color for p in active_participants}
    color = COLORS[0]
    for c in COLORS:
        if c not in used_colors:
            color = c
            break

    # Add participant
    participant = JamParticipant(
        session_id=id,
        user_id=user.id,
        color=color,
        joined_at=datetime.now(tz=timezone.utc),
    )
    session.add(participant)

    # Update audit log
    log = list(jam.audit_log)
    log.append(
        {
            "event": "joined",
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "user_id": str(user.id),
        }
    )
    jam.audit_log = log
    jam.last_active_at = datetime.now(tz=timezone.utc)
    jam.ended_at = None  # Clear end marker in case of rejoin within grace

    await session.commit()

    ws_scheme = "wss" if request.url.scheme == "https" else "ws"
    ws_url = f"{ws_scheme}://{request.url.netloc}/api/v1/jam-sessions/{id}/signal"

    return JamSessionJoinOut(color=color, ws_url=ws_url)


@router.post("/{id}/leave", status_code=204)
async def leave_session(id: uuid.UUID, user: CurrentWriter, session: SessionDep) -> None:
    jam = await session.get(JamSession, id)
    if jam is None:
        raise not_found("session")

    # Update left_at for the participant
    stmt = (
        update(JamParticipant)
        .where(
            JamParticipant.session_id == id,
            JamParticipant.user_id == user.id,
            JamParticipant.left_at.is_(None),
        )
        .values(left_at=datetime.now(tz=timezone.utc))
    )
    await session.execute(stmt)

    # Add leave to audit log
    log = list(jam.audit_log)
    log.append(
        {
            "event": "left",
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "user_id": str(user.id),
        }
    )
    jam.audit_log = log
    jam.last_active_at = datetime.now(tz=timezone.utc)

    # Check if there are any remaining active participants
    active_stmt = select(JamParticipant).where(
        JamParticipant.session_id == id, JamParticipant.left_at.is_(None)
    )
    active_res = await session.execute(active_stmt)
    active_count = len(active_res.scalars().all())

    # If no active participants remain, set ended_at to now
    if active_count == 0:
        jam.ended_at = datetime.now(tz=timezone.utc)
        log.append(
            {
                "event": "ended",
                "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                "reason": "last_participant_left",
            }
        )
        jam.audit_log = log

    await session.commit()


@router.get("/{id}", response_model=JamSessionDetailOut)
async def get_session_details(
    id: uuid.UUID, session: SessionDep, request: Request
) -> JamSessionDetailOut:
    jam = await session.get(JamSession, id)
    if jam is None:
        raise not_found("session")

    participants = await get_participant_details(id, session)

    ws_scheme = "wss" if request.url.scheme == "https" else "ws"
    ws_url = f"{ws_scheme}://{request.url.netloc}/api/v1/jam-sessions/{id}/signal"

    return JamSessionDetailOut(
        session=JamSessionOut.from_orm(jam),
        participants=participants,
        ws_url=ws_url,
    )


class PatchSaveIn(BaseModel):
    """Pydantic input schema for saving shared session patch."""

    state: str
    schema_ver: int
    title: str | None = None
    description: str | None = None
    visibility: str = "unlisted"


@router.post("/{id}/save-patch", response_model=PatchOut, status_code=201)
async def save_shared_patch(
    id: uuid.UUID,
    body: PatchSaveIn,
    user: CurrentWriter,
    session: SessionDep,
) -> PatchOut:
    jam = await session.get(JamSession, id)
    if jam is None:
        raise not_found("session")

    # Double check that the saving user participated in the session
    p_check = await session.execute(
        select(JamParticipant).where(
            JamParticipant.session_id == id, JamParticipant.user_id == user.id
        )
    )
    if p_check.scalar_one_or_none() is None:
        raise forbidden("Only session participants can save patches from it.")

    # Create the patch
    patch = Patch(
        user_id=user.id,
        schema_ver=body.schema_ver,
        state={"v": body.schema_ver, "payload": body.state},
        title=body.title,
        description=body.description,
        visibility=body.visibility,  # type: ignore[arg-type]
        engine=parse_engine(body.state),
        mode=parse_mode(body.state),
        short_slug=new_slug(),
    )
    session.add(patch)
    await session.flush()

    # Find all authenticated users who participated in this session and link them
    part_stmt = (
        select(User.id)
        .where(
            JamParticipant.session_id == id,
            User.account_id.is_not(None),
        )
        .join(JamParticipant, JamParticipant.user_id == User.id)
    )
    collaborator_ids = (await session.execute(part_stmt)).scalars().all()

    for col_id in collaborator_ids:
        collab = PatchCollaborator(patch_id=patch.id, user_id=col_id)
        session.add(collab)

    # Log the save in the session audit log
    log = list(jam.audit_log)
    log.append(
        {
            "event": "patch_saved",
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "patch_id": str(patch.id),
            "user_id": str(user.id),
        }
    )
    jam.audit_log = log
    jam.last_active_at = datetime.now(tz=timezone.utc)

    await session.commit()
    await session.refresh(patch)

    from app.routers.patches import to_out

    return to_out(patch)


@router.websocket("/{session_id}/signal")
async def ws_signaling_relay(websocket: WebSocket, session_id: uuid.UUID) -> None:
    # Accept connections anonymously or authenticated. 
    # Relays WebRTC SDP/ICE parameters or fallback CRDT updates.
    await manager.connect(session_id, websocket)
    try:
        while True:
            # Dual-protocol support: either binary Yjs messages or text-based signaling JSON
            message = await websocket.receive()
            if "bytes" in message:
                await manager.broadcast(session_id, message["bytes"], sender=websocket)
            elif "text" in message:
                await manager.broadcast(session_id, message["text"], sender=websocket)
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
    except Exception:
        manager.disconnect(session_id, websocket)
