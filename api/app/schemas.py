from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

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


class QuotaOut(BaseModel):
    patches: int
    captures: int
    recordings: int
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


class PatchUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility | None = None


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


class RecordingCreate(BaseModel):
    storage_key: str
    duration_ms: int
    bytes: int
    format: Literal["opus", "wav"]
    patch_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=120)
    visibility: Visibility = "unlisted"


class RecordingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    duration_ms: int
    bytes: int
    format: str
    patch_id: uuid.UUID | None
    title: str | None
    visibility: Visibility
    created_at: datetime


class RecordingListOut(BaseModel):
    items: list[RecordingOut]


# --- v0.8 gallery ------------------------------------------------------------

GallerySort = Literal["newest", "oldest", "most_loaded"]
PreviewStatus = Literal["none", "rendering", "ready", "failed"]
AdminVisibility = Literal["unlisted", "public", "flagged"]
ReportReason = Literal["spam", "inappropriate", "other"]
ReportStatus = Literal["open", "dismissed", "upheld"]


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


class GalleryListOut(BaseModel):
    items: list[GalleryItemOut]
    next_cursor: str | None = None


class LoadOut(BaseModel):
    load_count: int


class ReportCreate(BaseModel):
    patch_id: uuid.UUID
    reason: ReportReason
    detail: str | None = Field(default=None, max_length=2000)


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


class AdminReportListOut(BaseModel):
    items: list[AdminReportItem]


class AdminReportUpdate(BaseModel):
    status: Literal["dismissed", "upheld"]


class AdminVisibilityUpdate(BaseModel):
    visibility: AdminVisibility
