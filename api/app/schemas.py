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
    piece_count: int
    capture_count: int
    recording_count: int
    source_count: int


class QuotaOut(BaseModel):
    patches: int
    pieces: int
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
    mode: Literal["sketch", "drone"] | None = "sketch"


class PatchUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility | None = None
    acknowledge_source_visibility: bool = False
    mode: Literal["sketch", "drone"] | None = None


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
    mode: str = "sketch"
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
    target_kind: Literal["patch", "recording", "piece"]
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
    kind: Literal["patch", "recording", "piece"]
    id: uuid.UUID
    short_slug: str
    title: str | None
    description: str | None
    created_at: datetime
    like_count: int
    liked_by_me: bool
    # Patch / Piece specific
    state: str | None = None
    engine: str | None = None
    mode: str | None = None
    has_captures: bool | None = None
    # Piece specific
    movements_count: int | None = None
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
    type: Literal["fixed", "arc", "open", "transition", "meta-arc"]
    duration_ms: int | None = None
    config: dict
    variations: list[dict] | None = None


class PieceCreate(BaseModel):
    schema_ver: int = 19
    defaults_state: dict
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility = "unlisted"
    segments: list[PieceSegmentCreate]
    movements: list[dict] | None = None
    tempo_bpm: int | None = None
    notation: list[dict] | None = None
    variation_seed: int | None = None
    variations: list[dict] | None = None
    automation_tracks: list[dict] | None = None
    bell_schedule: list[dict] = Field(default_factory=list)
    acknowledge_source_visibility: bool = False


class PieceUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Visibility | None = None
    defaults_state: dict | None = None
    segments: list[PieceSegmentCreate] | None = None
    movements: list[dict] | None = None
    tempo_bpm: int | None = None
    notation: list[dict] | None = None
    variation_seed: int | None = None
    variations: list[dict] | None = None
    automation_tracks: list[dict] | None = None
    bell_schedule: list[dict] | None = None
    acknowledge_source_visibility: bool = False


class PieceSegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    type: str
    duration_ms: int | None
    config: dict
    variations: list[dict] | None = None


class PieceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    schema_ver: int
    defaults_state: dict
    title: str | None
    description: str | None
    visibility: PatchVisibility
    ai_description: str | None = None
    ai_description_source: str | None = None
    total_duration_ms: int | None
    has_open_segment: bool
    created_at: datetime
    updated_at: datetime
    short_slug: str
    segments: list[PieceSegmentOut]
    movements: list[dict] | None = None
    tempo_bpm: int | None = None
    notation: list[dict] | None = None
    variation_seed: int | None = None
    variations: list[dict] | None = None
    automation_tracks: list[dict] | None = None
    bell_schedule: list[dict] = Field(default_factory=list)
    # derived/social columns
    like_count: int = 0
    liked_by_me: bool = False
    load_count: int = 0
    preview_status: PreviewStatus = "none"
    preview_duration_ms: int | None = None
    preview_slice_start_ms: int = 30000
    has_captures: bool = False



class PieceListOut(BaseModel):
    items: list[PieceOut]
    next_cursor: str | None = None


# --- v4.0 Listening Sessions Schemas -----------------------------------------

class ListeningSessionCreate(BaseModel):
    piece_id: uuid.UUID | None = None
    patch_id: uuid.UUID | None = None
    schema_ver: int = 20
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    intention: str | None = Field(default=None, max_length=120)
    length_category: str | None = Field(default=None, max_length=50)
    recommended_environment: str | None = Field(default=None, max_length=120)
    settle_in_ms: int = Field(default=30000, ge=0)
    integration_ms: int = Field(default=60000, ge=0)
    bell_schedule: list[dict] = Field(default_factory=list)
    breath_pattern: dict | None = None
    visibility: Visibility = "unlisted"


class ListeningSessionUpdate(BaseModel):
    piece_id: uuid.UUID | None = None
    patch_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    intention: str | None = Field(default=None, max_length=120)
    length_category: str | None = Field(default=None, max_length=50)
    recommended_environment: str | None = Field(default=None, max_length=120)
    settle_in_ms: int | None = Field(default=None, ge=0)
    integration_ms: int | None = Field(default=None, ge=0)
    bell_schedule: list[dict] | None = None
    breath_pattern: dict | None = None
    visibility: Visibility | None = None


class ListeningSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    piece_id: uuid.UUID | None
    patch_id: uuid.UUID | None = None
    schema_ver: int
    title: str | None
    description: str | None
    intention: str | None
    length_category: str | None
    recommended_environment: str | None
    settle_in_ms: int
    integration_ms: int
    bell_schedule: list[dict] = Field(default_factory=list)
    breath_pattern: dict | None = None
    total_duration_ms: int | None
    visibility: str
    short_slug: str
    created_at: datetime
    updated_at: datetime

    
    piece: PieceOut | None = None
    patch: PatchOut | None = None
    creator_name: str | None = None
    creator_avatar_seed: str | None = None
    piece_creator_name: str | None = None


class ListeningSessionListOut(BaseModel):
    items: list[ListeningSessionOut]
    next_cursor: str | None = None


# --- v4.1 Custom Tunings Schemas ---------------------------------------------

class CustomTuningCreate(BaseModel):
    name: str = Field(..., max_length=120)
    scl_text: str
    parsed_scale: list[float]
    reference_a4_hz: float = Field(default=440.0, ge=20.0, le=4200.0)


class CustomTuningOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    scl_text: str
    parsed_scale: list[float]
    reference_a4_hz: float
    created_at: datetime


class CustomTuningListOut(BaseModel):
    items: list[CustomTuningOut]


# --- v4.5 Session History Schemas --------------------------------------------
# Calm-by-design: these shapes deliberately contain NO engagement-signal fields
# (no streak, no rank, no daily-goal progress, no consecutive-day count). The
# omission is intentional and asserted in tests.


class SessionPlayCreate(BaseModel):
    """Logged on session start. The play is finalized later via PATCH."""

    listening_session_id: uuid.UUID
    started_at: datetime | None = None  # defaults to server now() when absent


class SessionPlayUpdate(BaseModel):
    """Finalize a play (on completion/end) and/or add or edit a reflection."""

    completed_at: datetime | None = None
    duration_listened_ms: int | None = Field(default=None, ge=0)
    reflection: str | None = Field(default=None, max_length=500)


class SessionPlayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    listening_session_id: uuid.UUID
    started_at: datetime
    completed_at: datetime | None
    duration_listened_ms: int
    reflection: str | None
    created_at: datetime

    # Lightweight source-session info for rendering the list (title + thumbnail).
    session_title: str | None = None
    session_slug: str | None = None
    session_length_category: str | None = None


class SessionPlayListOut(BaseModel):
    items: list[SessionPlayOut]
    next_cursor: str | None = None


class SessionStatsOut(BaseModel):
    """Minimal, descriptive stats. Single computation site (compute_stats)."""

    total_sessions: int
    total_listened_ms: int
    average_length_ms: int
    this_month_sessions: int
    this_month_listened_ms: int


# --- v4.5 Curated Library Schemas --------------------------------------------


class LibraryListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    listening_session_id: uuid.UUID
    intention: str | None
    length_category: str | None
    character_tags: list[str] = Field(default_factory=list)
    editor_pick: bool
    editor_pick_at: datetime | None
    curator_note: str | None
    added_at: datetime
    archived_at: datetime | None = None

    # Joined source-session presentation + derived preview state.
    session_title: str | None = None
    session_slug: str | None = None
    total_duration_ms: int | None = None
    preview_status: str = "none"  # 'none' | 'rendering' | 'ready' | 'failed'
    preview_url: str | None = None


class LibraryListOut(BaseModel):
    items: list[LibraryListingOut]


class AdminLibraryCreate(BaseModel):
    listening_session_id: uuid.UUID
    intention: str | None = Field(default=None, max_length=50)
    length_category: str | None = Field(default=None, max_length=50)
    character_tags: list[str] = Field(default_factory=list)
    curator_note: str | None = Field(default=None, max_length=1000)


class AdminLibraryUpdate(BaseModel):
    intention: str | None = Field(default=None, max_length=50)
    length_category: str | None = Field(default=None, max_length=50)
    character_tags: list[str] | None = None
    editor_pick: bool | None = None
    curator_note: str | None = Field(default=None, max_length=1000)





