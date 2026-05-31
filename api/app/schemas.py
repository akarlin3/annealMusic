from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


# --- v4.6 Listening History Schemas ------------------------------------------

class ListeningHistoryCreate(BaseModel):
    listening_session_id: uuid.UUID | None = None
    started_at: datetime
    completed_at: datetime
    duration_seconds: float
    is_standalone_timer: bool = False


class ListeningHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    listening_session_id: uuid.UUID | None
    started_at: datetime
    completed_at: datetime
    duration_seconds: float
    is_standalone_timer: bool
    created_at: datetime


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


# --- v5.4 Python Scripting Schemas --------------------------------------------

class UserScriptCreate(BaseModel):
    name: str = Field(..., max_length=120)
    source: str
    language: str = "python"
    visibility: Literal["private", "unlisted"] = "private"


class UserScriptUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    source: str | None = None
    language: str | None = None
    visibility: Literal["private", "unlisted"] | None = None


class UserScriptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    source: str
    language: str
    visibility: Literal["private", "unlisted"]
    created_at: datetime
    updated_at: datetime


class UserScriptListOut(BaseModel):
    items: list[UserScriptOut]


# --- v5.6 Experiment Framework Schemas ----------------------------------------

class ExperimentCreate(BaseModel):
    title: str = Field(..., max_length=120)
    definition: dict
    description: str | None = Field(default=None, max_length=2000)


class ExperimentUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    definition: dict | None = None
    description: str | None = Field(default=None, max_length=2000)


class ExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    definition: dict
    description: str | None
    short_slug: str | None
    created_at: datetime
    updated_at: datetime


class ExperimentListOut(BaseModel):
    items: list[ExperimentOut]


# --- v6.0 Educational Curriculum Schemas -------------------------------------

class LessonStepCreate(BaseModel):
    position: int
    type: Literal["text", "demo", "prompt", "reflection", "audio-clip"]
    config: dict


class LessonStepUpdate(BaseModel):
    position: int | None = None
    type: Literal["text", "demo", "prompt", "reflection", "audio-clip"] | None = None
    config: dict | None = None


class LessonStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    position: int
    type: str
    config: dict


class LessonCreate(BaseModel):
    track_id: uuid.UUID
    slug: str = Field(..., max_length=100)
    title: str = Field(..., max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    difficulty: Literal["intro", "intermediate", "advanced"] = "intro"
    estimated_minutes: int = Field(default=10, ge=1)
    position: int = 0
    prerequisites: list[uuid.UUID] = Field(default_factory=list)


class LessonUpdate(BaseModel):
    slug: str | None = Field(default=None, max_length=100)
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    difficulty: Literal["intro", "intermediate", "advanced"] | None = None
    estimated_minutes: int | None = Field(default=None, ge=1)
    position: int | None = None
    prerequisites: list[uuid.UUID] | None = None


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    track_id: uuid.UUID
    slug: str
    title: str
    description: str | None
    difficulty: str
    estimated_minutes: int
    position: int
    prerequisites: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    steps: list[LessonStepOut] = Field(default_factory=list)


class TrackCreate(BaseModel):
    slug: str = Field(..., max_length=100)
    title: str = Field(..., max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    position: int = 0
    color: str | None = Field(default=None, max_length=50)


class TrackUpdate(BaseModel):
    slug: str | None = Field(default=None, max_length=100)
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    position: int | None = None
    color: str | None = Field(default=None, max_length=50)


class TrackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    description: str | None
    position: int
    color: str | None
    created_at: datetime
    lessons: list[LessonOut] = Field(default_factory=list)


class TrackListOut(BaseModel):
    items: list[TrackOut]


# --- v7.1 Sonification Schemas -----------------------------------------------

class SonificationCreate(BaseModel):
    schema_ver: int
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    base_state: dict
    mapping_spec: dict
    source_files: list[dict] = Field(default_factory=list)
    duration_ms: int | None = None
    visibility: Visibility = "unlisted"


class SonificationUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    mapping_spec: dict | None = None
    source_files: list[dict] | None = None
    duration_ms: int | None = None
    visibility: Visibility | None = None


class SonificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    schema_ver: int
    title: str | None
    description: str | None
    base_state: dict
    mapping_spec: dict
    source_files: list[dict]
    duration_ms: int | None
    visibility: str
    short_slug: str
    created_at: datetime
    updated_at: datetime


class SonificationListOut(BaseModel):
    items: list[SonificationOut]
    next_cursor: str | None = None


# --- v6.1 Lesson generation --------------------------------------------------

StepType = Literal["text", "demo", "prompt", "reflection", "audio-clip"]


class LessonSpecStep(BaseModel):
    type: StepType
    topic: str | None = Field(default=None, max_length=400)
    patch_brief: str | None = Field(default=None, max_length=400)
    task: str | None = Field(default=None, max_length=400)
    diagram: Literal["svg", "mermaid"] | None = None
    # v6.2 — for an 'audio-clip' step, what the clip should illustrate. Retrieval
    # uses this to surface candidates; the LLM picks one and writes intro/outro.
    clip_topic: str | None = Field(default=None, max_length=400)


class LessonSpec(BaseModel):
    id: str = Field(..., max_length=200)  # "track_slug/lesson_slug"
    track: str = Field(..., max_length=100)
    title: str = Field(..., max_length=120)
    objectives: list[str] = Field(..., min_length=1, max_length=8)
    difficulty: Literal["intro", "intermediate", "advanced"] = "intro"
    prerequisites: list[str] = Field(default_factory=list)
    audience: str | None = Field(default=None, max_length=120)
    step_outline: list[LessonSpecStep] = Field(..., min_length=1, max_length=30)
    constraints_during_prompts: list[str] = Field(default_factory=list)
    estimated_minutes: int = Field(default=10, ge=1)
    position: int = 0
    description: str | None = Field(default=None, max_length=2000)


class LessonGenStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    type: str
    config: dict
    manual_override_content: dict | None = None
    generation_id: uuid.UUID | None = None
    prompt_version: str | None = None
    model_id: str | None = None
    generated_at: datetime | None = None


class LessonGenStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    track_id: uuid.UUID
    slug: str
    title: str
    difficulty: str
    generation_status: str
    generation_error: str | None = None
    spec: dict | None = None
    steps: list[LessonGenStepOut] = Field(default_factory=list)


class StepOverrideIn(BaseModel):
    content: dict


# --- v6.4 Curriculum authoring tooling ---------------------------------------


class SpecGenerateIn(BaseModel):
    """Request to scaffold a starting lesson spec from a topic + outline."""

    topic: str = Field(..., min_length=2, max_length=400)
    track: str = Field(..., min_length=1, max_length=100)
    outline: str | None = Field(default=None, max_length=2000)
    difficulty: Literal["intro", "intermediate", "advanced"] | None = None


class SpecGenerateOut(BaseModel):
    spec: LessonSpec


class BatchGenerateIn(BaseModel):
    """Kick off generation. Empty/omitted ``lesson_ids`` means 'all pending'."""

    lesson_ids: list[uuid.UUID] = Field(default_factory=list)
    include_failed: bool = True


class BatchGenerateItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    generation_status: str
    generation_error: str | None = None
    cached: bool = False


class BatchGenerateOut(BaseModel):
    requested: int
    results: list[BatchGenerateItem] = Field(default_factory=list)


class QAFindingOut(BaseModel):
    rule: str
    level: str
    message: str


class LessonQAOut(BaseModel):
    id: uuid.UUID
    spec_id: str | None = None
    slug: str
    title: str
    status: str  # 'pass' | 'warn' | 'fail'
    errors: int
    warnings: int
    findings: list[QAFindingOut] = Field(default_factory=list)


class CurriculumQAOut(BaseModel):
    status: str  # worst-of across lessons + graph
    graph_findings: list[QAFindingOut] = Field(default_factory=list)
    lessons: list[LessonQAOut] = Field(default_factory=list)


class PrereqEdge(BaseModel):
    prerequisite: str  # spec id "track/slug"
    lesson: str        # spec id "track/slug"


class PrereqNode(BaseModel):
    id: str            # spec id "track/slug"
    lesson_id: uuid.UUID
    track: str
    title: str
    difficulty: str


class PrereqGraphOut(BaseModel):
    nodes: list[PrereqNode] = Field(default_factory=list)
    edges: list[PrereqEdge] = Field(default_factory=list)


class PrereqGraphIn(BaseModel):
    edges: list[PrereqEdge] = Field(default_factory=list)


# --- v6.2 Audio clip library -------------------------------------------------

ClipLicense = Literal["CC0", "CC-BY", "original-by-you", "licensed-third-party"]


class AudioClipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    description: str
    duration_ms: int
    track_affinity: list[str] = Field(default_factory=list)
    concept_tags: list[str] = Field(default_factory=list)
    license: str
    attribution: str | None = None
    audio_url: str | None = None
    created_at: datetime


class AudioClipMeta(BaseModel):
    """Metadata for create/patch (the audio bytes arrive as a separate upload)."""

    slug: str = Field(..., max_length=100)
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=2000)
    duration_ms: int | None = Field(default=None, ge=1, le=120000)
    track_affinity: list[str] = Field(default_factory=list)
    concept_tags: list[str] = Field(default_factory=list)
    license: ClipLicense
    attribution: str | None = Field(default=None, max_length=2000)

    @field_validator("slug")
    @classmethod
    def _slug_urlsafe(cls, v: str) -> str:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", v):
            raise ValueError("slug must be lowercase URL-safe (a-z, 0-9, hyphens)")
        return v

    @model_validator(mode="after")
    def _attribution_required(self) -> "AudioClipMeta":
        if self.license != "original-by-you" and not (self.attribution or "").strip():
            raise ValueError(
                f"attribution is required for license '{self.license}'"
            )
        return self


class AudioClipPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    track_affinity: list[str] | None = None
    concept_tags: list[str] | None = None
    license: ClipLicense | None = None
    attribution: str | None = Field(default=None, max_length=2000)


class ClipSearchResult(BaseModel):
    slug: str
    title: str
    description: str
    duration_ms: int
    track_affinity: list[str] = Field(default_factory=list)
    concept_tags: list[str] = Field(default_factory=list)
    score: float


# --- v6.3 Lesson progress + next-lesson recommendations ----------------------

# The reader-facing state includes the *computed* 'abandoned'; only the first
# three are ever stored (see app/models.py::LessonProgress).
LessonProgressState = Literal["not_started", "in_progress", "completed", "abandoned"]


class StepActionIn(BaseModel):
    """A single per-step signal. Metadata only — no free text, no PII.

    Navigation actions (``started`` / ``completed`` / ``skipped``) carry the
    time-on-step in ``ms``. v6.5 adds, additively, the engagement-signal actions
    the admin analytics surface reads: ``clip_play`` / ``clip_replay`` (audio-clip
    steps) and ``prompt_tried`` / ``prompt_skipped`` (prompt steps). These remain
    aggregate, anonymized signals — never per-user-exposed."""

    step_position: int = Field(ge=0)
    action: Literal[
        "started",
        "completed",
        "skipped",
        "clip_play",
        "clip_replay",
        "prompt_tried",
        "prompt_skipped",
    ]
    ms: int = Field(default=0, ge=0)  # time-on-step in milliseconds
    at: datetime | None = None  # defaults to server now() when absent


class LessonProgressUpsert(BaseModel):
    """Heartbeat / pause / complete. ``step_actions`` is a delta that is appended
    to the bounded server-side log; ``state`` only ever advances (never downgrades
    a completed lesson)."""

    lesson_id: uuid.UUID
    state: Literal["in_progress", "completed"] | None = None
    current_step_position: int | None = Field(default=None, ge=0)
    scroll_ratio: float | None = Field(default=None, ge=0, le=1)
    step_actions: list[StepActionIn] = Field(default_factory=list)
    reflection_text: str | None = Field(default=None, max_length=2000)


class LessonProgressOut(BaseModel):
    lesson_id: uuid.UUID
    state: str  # may be the derived 'abandoned'
    current_step_position: int
    scroll_ratio: float
    started_at: datetime | None = None
    last_active_at: datetime | None = None
    completed_at: datetime | None = None
    reflection_text: str | None = None


class LessonProgressListOut(BaseModel):
    items: list[LessonProgressOut]


class TrackProgressOut(BaseModel):
    """Descriptive per-track counts only — no percentage-as-pressure, no streak."""

    track_slug: str
    track_title: str
    total_lessons: int
    completed_lessons: int
    in_progress_lessons: int


class ProgressImportItem(BaseModel):
    """One localStorage progress record uploaded on first sign-in (anon→authed)."""

    lesson_id: uuid.UUID
    state: Literal["not_started", "in_progress", "completed"] = "in_progress"
    current_step_position: int = Field(default=0, ge=0)
    scroll_ratio: float = Field(default=0, ge=0, le=1)
    started_at: datetime | None = None
    last_active_at: datetime | None = None
    completed_at: datetime | None = None
    step_actions: list[StepActionIn] = Field(default_factory=list)
    reflection_text: str | None = Field(default=None, max_length=2000)


class ProgressImportIn(BaseModel):
    items: list[ProgressImportItem] = Field(default_factory=list, max_length=500)


class RecommendationRequest(BaseModel):
    context: Literal["completion", "arrival"] = "arrival"
    just_completed_lesson_id: uuid.UUID | None = None


class RecommendationItem(BaseModel):
    lesson_id: uuid.UUID
    slug: str
    title: str
    difficulty: str
    track_slug: str
    rationale: str  # the LLM's one-sentence "why this next" (or a neutral fallback)


class RecommendationsOut(BaseModel):
    items: list[RecommendationItem]
    # 'onboarding' = brand-new user; 'empty' = nothing reachable; 'deterministic'
    # = LLM unavailable/invalid so Stage-1 order is used verbatim.
    source: Literal["llm", "deterministic", "onboarding", "empty"]


# --- v7.0 Research Collaboration (Studies) Schemas ----------------------------

StudyStatus = Literal[
    "planning",
    "pre-registered",
    "active",
    "data-collection",
    "analysis",
    "published",
    "archived",
]
StudyVisibility = Literal["private", "public"]
InvestigatorRole = Literal["pi", "co-investigator", "analyst", "viewer"]
ResourceKind = Literal[
    "patch",
    "piece",
    "listening_session",
    "audio_clip",
    "experiment",
    "user_script",
    "dataset",
    "sonification",
]
ResourceRole = Literal["stimulus", "protocol", "data", "analysis"]


class FundingSource(BaseModel):
    source: str = Field(..., max_length=200)
    grant_number: str | None = Field(default=None, max_length=120)
    role: str | None = Field(default=None, max_length=120)


class StudyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    abstract: str | None = Field(default=None, max_length=8000)
    preregistration_url: str | None = Field(default=None, max_length=500)
    ethics_statement: str | None = Field(default=None, max_length=8000)
    funding_sources: list[FundingSource] | None = None


class StudyUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    abstract: str | None = Field(default=None, max_length=8000)
    status: StudyStatus | None = None
    visibility: StudyVisibility | None = None
    preregistration_url: str | None = Field(default=None, max_length=500)
    ethics_statement: str | None = Field(default=None, max_length=8000)
    funding_sources: list[FundingSource] | None = None


class InvestigatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account_id: uuid.UUID
    role: InvestigatorRole
    added_at: datetime
    # Resolved (best-effort) from the account for display + citation.
    display_name: str | None = None
    orcid: str | None = None
    affiliation_ror: str | None = None


class StudyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    description: str | None
    abstract: str | None
    status: StudyStatus
    visibility: StudyVisibility
    preregistration_url: str | None
    ethics_statement: str | None
    funding_sources: list[dict]
    concept_doi: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
    investigators: list[InvestigatorOut] = []
    # The caller's role on this study, if any (None for public/anon readers).
    my_role: InvestigatorRole | None = None


class StudyListOut(BaseModel):
    items: list[StudyOut]


class InvestigatorAdd(BaseModel):
    # Add by account id or by email (resolved server-side); exactly one required.
    account_id: uuid.UUID | None = None
    account_email: str | None = Field(default=None, max_length=320)
    role: InvestigatorRole = "viewer"

    @model_validator(mode="after")
    def _one_identifier(self) -> "InvestigatorAdd":
        if (self.account_id is None) == (self.account_email is None):
            raise ValueError("Provide exactly one of account_id or account_email.")
        return self


class InvestigatorRoleUpdate(BaseModel):
    role: InvestigatorRole


class ResourceLinkIn(BaseModel):
    resource_kind: ResourceKind
    resource_id: uuid.UUID
    role: ResourceRole | None = None


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    resource_kind: ResourceKind
    resource_id: uuid.UUID
    role: ResourceRole | None
    added_by: uuid.UUID | None
    added_at: datetime


class ResourceListOut(BaseModel):
    items: list[ResourceOut]


class AuditEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID | None
    timestamp: datetime
    action: str
    before: dict | None
    after: dict | None


class AuditListOut(BaseModel):
    items: list[AuditEntryOut]


class SnapshotIn(BaseModel):
    version_label: str = Field(..., min_length=1, max_length=120)


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    study_id: uuid.UUID
    version_label: str
    doi: str | None
    created_by: uuid.UUID | None
    created_at: datetime


class VersionDetailOut(VersionOut):
    snapshot_json: dict


class VersionListOut(BaseModel):
    items: list[VersionOut]


class PublishIn(BaseModel):
    # Publish an existing version by id, or create + publish a new one by label.
    version_id: uuid.UUID | None = None
    version_label: str | None = Field(default=None, min_length=1, max_length=120)

    @model_validator(mode="after")
    def _one_target(self) -> "PublishIn":
        if (self.version_id is None) == (self.version_label is None):
            raise ValueError("Provide exactly one of version_id or version_label.")
        return self


class PublishOut(BaseModel):
    version_id: uuid.UUID
    doi: str
    concept_doi: str
    stub: bool


class CitationOut(BaseModel):
    format: Literal["bibtex", "apa", "chicago"]
    citation: str


class AccountResearchUpdate(BaseModel):
    orcid: str | None = Field(default=None, max_length=64)
    affiliation_ror: str | None = Field(default=None, max_length=200)


# --- v7.2 Clinical Stimulus-Grade Audio Schemas -------------------------------

class ClinicalProtocolCreate(BaseModel):
    study_id: uuid.UUID
    experiment_id: uuid.UUID | None = None
    conditions: list[dict] = Field(default_factory=list)
    randomization_scheme: Literal["simple", "latin-square", "block-random", "custom"] = "simple"
    calibration_required: bool = True
    target_lufs: float = -23.0
    adverse_event_capture: bool = True
    ct_gov_nct: str | None = Field(default=None, max_length=64)
    biosignal_channels: list[dict] = Field(default_factory=list)


class ClinicalProtocolUpdate(BaseModel):
    experiment_id: uuid.UUID | None = None
    conditions: list[dict] | None = None
    randomization_scheme: Literal["simple", "latin-square", "block-random", "custom"] | None = None
    calibration_required: bool | None = None
    target_lufs: float | None = None
    adverse_event_capture: bool | None = None
    ct_gov_nct: str | None = Field(default=None, max_length=64)
    biosignal_channels: list[dict] | None = None


class ClinicalProtocolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    study_id: uuid.UUID
    experiment_id: uuid.UUID | None
    conditions: list[dict]
    calibration_history: list[dict] = []
    randomization_scheme: str
    randomization_seed: str
    calibration_required: bool
    target_lufs: float
    adverse_event_capture: bool
    ct_gov_nct: str | None
    biosignal_channels: list[dict]
    created_at: datetime
    updated_at: datetime


class BiosignalStreamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_record_id: uuid.UUID
    device_id: str
    channel_name: str
    storage_key: str
    sample_rate_hz: float | None
    bytes: int | None
    consented_at: datetime
    retention_until: datetime | None
    created_at: datetime


class ClinicalSessionRecordEnroll(BaseModel):
    subject_id: str = Field(..., min_length=1, max_length=120)


class ClinicalSessionRecordCreate(BaseModel):
    id: uuid.UUID
    subject_id: str = Field(..., min_length=1, max_length=120)
    condition_id: str
    started_at: datetime
    completed_at: datetime | None = None
    stimulus_sha256: str | None = None
    calibration_record: dict | None = None
    timing_report: dict | None = None
    adverse_events: list[dict] = Field(default_factory=list)
    withdrew: bool = False
    partial_data_disposition: str | None = None
    client_audit_log: list[dict] = Field(default_factory=list)


class ClinicalSessionRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    protocol_id: uuid.UUID
    subject_id: str
    condition_id: str
    started_at: datetime
    completed_at: datetime | None
    stimulus_sha256: str | None
    calibration_record: dict | None
    timing_report: dict | None
    adverse_events: list[dict]
    withdrew: bool
    partial_data_disposition: str | None
    client_audit_log: list[dict]


# --- v7.3 Mapping Template Schemas --------------------------------------------

class MappingTemplateCreate(BaseModel):
    slug: str = Field(..., max_length=120)
    title: str = Field(..., max_length=120)
    description: str = Field(..., max_length=1000)
    domain_family: Literal["time-series", "scalar-field", "network", "structured-event"]
    source_schema: dict
    mapping_spec: dict
    calibration_recommendation: str | None = None
    citation: str | None = None
    recipe_content: str
    example_data_path: str | None = None
    example_audio_path: str | None = None
    position: int = 0


class MappingTemplateUpdate(BaseModel):
    slug: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    domain_family: Literal["time-series", "scalar-field", "network", "structured-event"] | None = None
    source_schema: dict | None = None
    mapping_spec: dict | None = None
    calibration_recommendation: str | None = None
    citation: str | None = None
    recipe_content: str | None = None
    example_data_path: str | None = None
    example_audio_path: str | None = None
    position: int | None = None


class MappingTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    description: str
    domain_family: str
    source_schema: dict
    mapping_spec: dict
    calibration_recommendation: str | None
    citation: str | None
    recipe_content: str
    example_data_path: str | None
    example_audio_path: str | None
    position: int
    created_at: datetime


class MappingTemplateListOut(BaseModel):
    items: list[MappingTemplateOut]


class SonificationFromTemplateIn(BaseModel):
    template_slug: str
    title: str | None = None
    description: str | None = None
    data_rows: list[dict] | None = None
    duration_ms: int = 15000


class BiosignalStreamUploadIn(BaseModel):
    device_id: str
    channel_name: str
    consented_at: datetime
    sample_rate_hz: float | None = None
    frames: list[dict] = Field(default_factory=list)








