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
    like_count: int = 0
    liked_by_me: bool = False


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
    like_count: int = 0
    liked_by_me: bool = False


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
    like_count: int = 0
    liked_by_me: bool = False


# --- v0.8 gallery ------------------------------------------------------------

GallerySort = Literal["newest", "oldest", "most_loaded", "most_liked"]
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
    like_count: int = 0
    liked_by_me: bool = False


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


# --- v2.0 Social Schemas -----------------------------------------------------

class LikeCreate(BaseModel):
    target_kind: Literal["patch", "recording"]
    target_id: uuid.UUID


class LikeStatusOut(BaseModel):
    liked: bool


class FollowStatusOut(BaseModel):
    following: bool


class AccountSettingsUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=280)
    likes_public: bool | None = None
    follows_public: bool | None = None


class RelationshipItem(BaseModel):
    id: uuid.UUID
    display_name: str | None
    avatar_seed: str | None


class RelationshipListOut(BaseModel):
    items: list[RelationshipItem]


class FeedItemOut(BaseModel):
    kind: Literal["patch", "recording"]
    id: uuid.UUID
    short_slug: str
    title: str | None
    description: str | None
    created_at: datetime
    like_count: int
    liked_by_me: bool
    # Patch specific
    state: str | None = None
    engine: str | None = None
    mode: str | None = None
    has_captures: bool | None = None
    # Recording specific
    duration_ms: int | None = None
    format: str | None = None
    # Creator info
    creator_name: str | None = None
    creator_avatar_seed: str | None = None
    creator_id: uuid.UUID | None = None


class FeedListOut(BaseModel):
    items: list[FeedItemOut]
    next_cursor: str | None = None


class FeaturedPickCreate(BaseModel):
    patch_id: uuid.UUID
    position: int
    curator_note: str | None = None


class FeaturedPickOut(BaseModel):
    id: uuid.UUID
    week_starting: str
    patch_id: uuid.UUID
    position: int
    curator_note: str | None
    patch: GalleryItemOut | None = None


# --- v3.0 Pieces Schemas -----------------------------------------------------

class PieceSegmentCreate(BaseModel):
    type: Literal["fixed", "arc", "open", "transition"]
    duration_ms: int | None = None
    config: dict


class PieceCreate(BaseModel):
    schema_ver: int = 8
    defaults_state: dict
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility = "unlisted"
    segments: list[PieceSegmentCreate]


class PieceUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility | None = None
    defaults_state: dict | None = None
    segments: list[PieceSegmentCreate] | None = None


class PieceSegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    type: str
    duration_ms: int | None
    config: dict


class PieceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    schema_ver: int
    defaults_state: dict
    title: str | None
    description: str | None
    visibility: str
    ai_description: str | None = None
    total_duration_ms: int | None
    has_open_segment: bool
    created_at: datetime
    updated_at: datetime
    short_slug: str
    segments: list[PieceSegmentOut]


class PieceListOut(BaseModel):
    items: list[PieceOut]
    next_cursor: str | None = None




