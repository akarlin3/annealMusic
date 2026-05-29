from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Visibility = Literal["unlisted", "public"]
# A patch's stored visibility can also be 'flagged' (moderator action); only the
# first two are client-settable on create/update.
PatchVisibility = Literal["unlisted", "public", "flagged"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    bytes_used: int
    patch_count: int
    capture_count: int
    recording_count: int
    source_count: int


class QuotaOut(BaseModel):
    patches: int
    captures: int
    recordings: int
    user_sources: int
    bytes: int


class UserMeOut(BaseModel):
    user: UserOut
    quota: QuotaOut


class PatchCreate(BaseModel):
    state: str = Field(..., description="The encoded URL payload (no #s=N: prefix).")
    schema_ver: int
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility = "unlisted"
    capture_refs: list[uuid.UUID] = Field(default_factory=list)
    acknowledge_source_visibility: bool = False


class PatchUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility | None = None
    acknowledge_source_visibility: bool = False


class PatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    schema_ver: int
    state: str
    title: str | None
    description: str | None
    visibility: PatchVisibility
    capture_refs: list[uuid.UUID]
    short_slug: str
    created_at: datetime
    updated_at: datetime
    ai_description: str | None = None
    ai_description_source: str | None = None


class PatchListOut(BaseModel):
    items: list[PatchOut]
    next_cursor: str | None = None


class CaptureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    duration_ms: int
    sample_rate: int
    channels: int
    bytes: int
    format: str
    created_at: datetime


class UserSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    duration_ms: int
    sample_rate: int
    channels: int
    bytes: int
    display_name: str | None
    visibility: str
    ref_count: int
    created_at: datetime



class UserSourceListOut(BaseModel):
    items: list[UserSourceOut]


class UserSourceUpdate(BaseModel):
    display_name: str = Field(..., max_length=120)


class RecordingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    short_slug: str
    duration_ms: int
    bytes: int
    format: str
    patch_id: uuid.UUID | None
    title: str | None
    visibility: Visibility
    created_at: datetime


class RecordingListOut(BaseModel):
    items: list[RecordingOut]


class RecordingMetaOut(BaseModel):
    """Public-facing metadata for the `/r/<slug>` player (no storage key)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    short_slug: str
    duration_ms: int
    format: str
    title: str | None
    patch_id: uuid.UUID | None
    created_at: datetime
    creator_name: str | None = None
    creator_avatar_seed: str | None = None
    creator_id: uuid.UUID | None = None


# --- v0.8 gallery ------------------------------------------------------------

GallerySort = Literal["newest", "oldest", "most_loaded"]
PreviewStatus = Literal["none", "rendering", "ready", "failed"]
AdminVisibility = Literal["unlisted", "public", "flagged"]
ReportReason = Literal["spam", "inappropriate", "other", "source-content"]
ReportStatus = Literal["open", "dismissed", "upheld"]
AdminSourceVisibility = Literal["unlisted", "shared", "flagged"]


class GalleryItemOut(BaseModel):
    id: uuid.UUID
    short_slug: str
    title: str | None
    description: str | None
    state: str
    engine: str
    mode: str
    has_captures: bool
    load_count: int
    published_at: datetime | None
    preview_status: PreviewStatus
    preview_duration_ms: int | None
    creator_name: str | None = None
    creator_avatar_seed: str | None = None
    creator_id: uuid.UUID | None = None
    ai_description: str | None = None
    ai_description_source: str | None = None


class GalleryListOut(BaseModel):
    items: list[GalleryItemOut]
    next_cursor: str | None = None


class LoadOut(BaseModel):
    load_count: int


class ReportCreate(BaseModel):
    patch_id: uuid.UUID
    reason: ReportReason
    detail: str | None = Field(default=None, max_length=2000)
    source_id: uuid.UUID | None = None


class ReportOut(BaseModel):
    id: uuid.UUID
    status: ReportStatus


class AdminReportItem(BaseModel):
    id: uuid.UUID
    patch_id: uuid.UUID
    patch_title: str | None
    patch_slug: str
    patch_visibility: AdminVisibility
    preview_status: PreviewStatus
    reason: ReportReason
    detail: str | None
    reporter: str | None
    status: ReportStatus
    created_at: datetime
    source_id: uuid.UUID | None = None


class AdminReportListOut(BaseModel):
    items: list[AdminReportItem]


class AdminReportUpdate(BaseModel):
    status: Literal["dismissed", "upheld"]


class AdminVisibilityUpdate(BaseModel):
    visibility: AdminVisibility


class AdminSourceVisibilityUpdate(BaseModel):
    visibility: AdminSourceVisibility


# --- v1.7 AI Assisted Patches schemas ----------------------------------------

class AIGeneratedPatchOut(BaseModel):
    state: str
    generation_id: uuid.UUID


class AIChange(BaseModel):
    key: str
    oldValue: Any
    newValue: Any
    label: str
    direction: str


class AIModifyPatchOut(BaseModel):
    state: str
    changes: list[AIChange]


class AIDescribePatchOut(BaseModel):
    description: str


class AIQuotaOut(BaseModel):
    hour_limit: int
    hour_used: int
    day_limit: int
    day_used: int


# --- v1.8 Collaborative Jam schemas ------------------------------------------

class JamSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    last_active_at: datetime
    ended_at: datetime | None


class JamParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    joined_at: datetime
    left_at: datetime | None
    color: str
    display_name: str | None = None
    avatar_seed: str | None = None


class JamSessionDetailOut(BaseModel):
    session: JamSessionOut
    participants: list[JamParticipantOut]
    ws_url: str


class JamSessionJoinOut(BaseModel):
    color: str
    ws_url: str


