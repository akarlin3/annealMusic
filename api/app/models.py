from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Numeric,
    func,
    event,
    text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import GUID, Base, JSONType, UUIDArray, VectorType


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_seed: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    bio: Mapped[str | None] = mapped_column(String(280), nullable=True)
    likes_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    follows_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    suspended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    follower_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    following_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # v7.0 research-collaboration: researcher identity for citations.
    orcid: Mapped[str | None] = mapped_column(String, nullable=True)
    affiliation_ror: Mapped[str | None] = mapped_column(String, nullable=True)


class AccountProvider(Base):
    __tablename__ = "account_providers"

    account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String, primary_key=True)
    subject: Mapped[str] = mapped_column(String, primary_key=True)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String, nullable=True)


class MagicLink(Base):
    __tablename__ = "magic_links"

    token: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    intent: Mapped[str] = mapped_column(String, nullable=False)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    bytes_used: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    patch_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    piece_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    capture_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recording_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Patch(Base):
    __tablename__ = "patches"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('unlisted','public','flagged')",
            name="ck_patches_visibility",
        ),
        CheckConstraint(
            "preview_status IN ('none','rendering','ready','failed')",
            name="ck_patches_preview_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    schema_ver: Mapped[int] = mapped_column(Integer, nullable=False)
    state: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    visibility: Mapped[str] = mapped_column(
        String, nullable=False, default="unlisted"
    )
    capture_refs: Mapped[list[uuid.UUID]] = mapped_column(
        UUIDArray(), nullable=False, default=list
    )
    short_slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)

    # Derived-at-insert filter columns (state is immutable, so these never change).
    # Plain columns rather than JSON-path filters keep gallery filtering portable
    # across Postgres (prod) and SQLite (tests).
    engine: Mapped[str] = mapped_column(String, nullable=False, default="sine")
    mode: Mapped[str] = mapped_column(String, nullable=False, default="sketch")
    has_captures: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Gallery / preview (v0.8).
    load_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    preview_storage_key: Mapped[str | None] = mapped_column(String, nullable=True)
    preview_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview_status: Mapped[str] = mapped_column(
        String, nullable=False, default="none"
    )

    # AI Patches fields (v1.7)
    ai_description: Mapped[str | None] = mapped_column(String, nullable=True)
    ai_description_embedding: Mapped[list[float] | None] = mapped_column(
        VectorType(1536), nullable=True
    )
    ai_description_source: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Capture(Base):
    __tablename__ = "captures"
    __table_args__ = (
        CheckConstraint(
            "format IN ('opus','wav')", name="ck_captures_format"
        ),
        CheckConstraint(
            "duration_ms > 0 AND duration_ms <= 60000",
            name="ck_captures_duration",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    channels: Mapped[int] = mapped_column(Integer, nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    format: Mapped[str] = mapped_column(String, nullable=False)
    ref_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class UserSource(Base):
    __tablename__ = "user_sources"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('unlisted','shared','flagged')",
            name="ck_user_sources_visibility",
        ),
        CheckConstraint(
            "duration_ms > 0 AND duration_ms <= 60000",
            name="ck_user_sources_duration",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    channels: Mapped[int] = mapped_column(Integer, nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    visibility: Mapped[str] = mapped_column(
        String, nullable=False, default="unlisted"
    )
    ref_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Recording(Base):
    __tablename__ = "recordings"
    __table_args__ = (
        CheckConstraint(
            "format IN ('opus','wav')", name="ck_recordings_format"
        ),
        CheckConstraint(
            "visibility IN ('unlisted','public')",
            name="ck_recordings_visibility",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Public short link `/r/<short_slug>` (mirrors patch short links).
    short_slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    format: Mapped[str] = mapped_column(String, nullable=False)
    patch_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("patches.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    visibility: Mapped[str] = mapped_column(
        String, nullable=False, default="unlisted"
    )
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(
            "reason IN ('spam','inappropriate','other','source-content')", name="ck_reports_reason"
        ),
        CheckConstraint(
            "status IN ('open','dismissed','upheld')", name="ck_reports_status"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    patch_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("patches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("user_sources.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    detail: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AIGeneration(Base):
    __tablename__ = "ai_generations"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    # Nullable since v6.1: lesson-generation rows are admin/system-initiated and
    # have no end user. User-scoped queries (quota) always filter by a concrete
    # user_id, so NULL rows are naturally excluded.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False) # 'text-to-patch' | 'mood-transfer' | 'description' | 'lesson-*'
    prompt: Mapped[str] = mapped_column(String, nullable=False)
    input_patch_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("patches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    output_state: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    model: Mapped[str] = mapped_column(String, nullable=False)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_estimate_usd: Mapped[float | None] = mapped_column(Numeric(8, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    cached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # v6.1 lesson-generation cache. ``lesson_step_id`` is a plain backreference
    # (no FK) to avoid a circular table dependency with ``lesson_steps``.
    lesson_step_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    cache_key: Mapped[str | None] = mapped_column(String, nullable=True, unique=True, index=True)


class JamSession(Base):
    __tablename__ = "jam_sessions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    created_by: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    audit_log: Mapped[dict] = mapped_column(JSONType(), nullable=False, default=list)


class JamParticipant(Base):
    __tablename__ = "jam_participants"

    session_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("jam_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, server_default=func.now()
    )
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    color: Mapped[str] = mapped_column(String, nullable=False)


class PatchCollaborator(Base):
    __tablename__ = "patch_collaborators"

    patch_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("patches.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Like(Base):
    __tablename__ = "likes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    target_kind: Mapped[str] = mapped_column(String, primary_key=True)
    target_id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Follow(Base):
    __tablename__ = "follows"

    follower_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    followed_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Block(Base):
    __tablename__ = "blocks"

    blocker_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    blocked_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Mute(Base):
    __tablename__ = "mutes"

    muter_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    muted_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class FeaturedPick(Base):
    __tablename__ = "featured_picks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    week_starting: Mapped[date] = mapped_column(Date, nullable=False)
    patch_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("patches.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    curator_note: Mapped[str | None] = mapped_column(String, nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
class Piece(Base):
    __tablename__ = "pieces"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('unlisted','public','flagged')",
            name="ck_pieces_visibility",
        ),
        CheckConstraint(
            "preview_status IN ('none','rendering','ready','failed')",
            name="ck_pieces_preview_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    schema_ver: Mapped[int] = mapped_column(Integer, nullable=False)
    defaults_state: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    visibility: Mapped[str] = mapped_column(
        String, nullable=False, default="unlisted"
    )
    ai_description: Mapped[str | None] = mapped_column(String, nullable=True)
    total_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_open_segment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    bell_schedule: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    short_slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)

    # derived/social columns
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    load_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    preview_storage_key: Mapped[str | None] = mapped_column(String, nullable=True)
    preview_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview_status: Mapped[str] = mapped_column(
        String, nullable=False, default="none"
    )
    preview_slice_start_ms: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30000
    )
    ai_description_embedding: Mapped[list[float] | None] = mapped_column(
        VectorType(1536), nullable=True
    )
    ai_description_source: Mapped[str | None] = mapped_column(String, nullable=True)
    has_captures: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )


class PieceSegment(Base):
    __tablename__ = "piece_segments"
    __table_args__ = (
        CheckConstraint(
            "type IN ('fixed','arc','open','transition','meta-arc')",
            name="ck_piece_segments_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    piece_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("pieces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    config: Mapped[dict] = mapped_column(JSONType(), nullable=False)


class ListeningSession(Base):
    __tablename__ = "listening_sessions"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('unlisted','public','flagged')",
            name="ck_listening_sessions_visibility",
        ),
        CheckConstraint(
            "(piece_id IS NULL) OR (patch_id IS NULL)",
            name="ls_source_one_of",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    piece_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("pieces.id", ondelete="SET NULL"), nullable=True, index=True
    )
    patch_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("patches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    schema_ver: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    intention: Mapped[str | None] = mapped_column(String, nullable=True)
    length_category: Mapped[str | None] = mapped_column(String, nullable=True)
    recommended_environment: Mapped[str | None] = mapped_column(String, nullable=True)
    settle_in_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=30000)
    integration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=60000)
    bell_schedule: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)
    # Optional visual breath-pacing pattern (v4.4). Nullable; None = no overlay.
    breath_pattern: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    total_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    visibility: Mapped[str] = mapped_column(
        String, nullable=False, default="unlisted"
    )
    short_slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CustomTuning(Base):
    __tablename__ = "custom_tunings"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    scl_text: Mapped[str] = mapped_column(String, nullable=False)
    parsed_scale: Mapped[list] = mapped_column(JSONType(), nullable=False)
    reference_a4_hz: Mapped[float] = mapped_column(
        Numeric(8, 3), nullable=False, default=440.0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ListeningHistoryEntry(Base):
    __tablename__ = "listening_history"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    listening_session_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("listening_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    is_standalone_timer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class SessionPlay(Base):
    """v4.5 — a single private record of a user playing a Listening Session.

    Calm-by-design: stores only what's needed to let a user revisit their own
    practice (when, what, how long, an optional reflection). Never stores sculpt
    actions, audio, or biometrics. Strictly private — no public surface.
    """

    __tablename__ = "session_plays"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    listening_session_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("listening_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Actual time listened; may be < the session's full duration if ended early.
    duration_listened_ms: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    # Optional post-session reflection (≤500 chars, enforced in the schema layer).
    reflection: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class LibraryListing(Base):
    """v4.5 — an editorial entry in the curated ``/listen`` library.

    A listing curates an existing Listening Session with intention / length /
    audio-character metadata. Created only via admin endpoints (editorial-only).
    Soft-archived via ``archived_at`` so picks history survives removal.
    """

    __tablename__ = "library_listings"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    listening_session_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("listening_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    intention: Mapped[str | None] = mapped_column(String, nullable=True)
    length_category: Mapped[str | None] = mapped_column(String, nullable=True)
    character_tags: Mapped[list] = mapped_column(
        JSONType(), nullable=False, default=list
    )
    editor_pick: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    editor_pick_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    curator_note: Mapped[str | None] = mapped_column(String, nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class UserScript(Base):
    __tablename__ = "user_scripts"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('private','unlisted')",
            name="ck_user_scripts_visibility",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False, default="python")
    visibility: Mapped[str] = mapped_column(
        String, nullable=False, default="private"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    definition: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    short_slug: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        CheckConstraint(
            "difficulty IN ('intro', 'intermediate', 'advanced')",
            name="ck_lessons_difficulty",
        ),
        UniqueConstraint("track_id", "slug", name="uq_lessons_track_slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    track_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    difficulty: Mapped[str] = mapped_column(String, nullable=False, default="intro")  # 'intro' | 'intermediate' | 'advanced'
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prerequisites: Mapped[list[uuid.UUID]] = mapped_column(UUIDArray(), nullable=False, default=list)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    # v6.1 LLM generation. ``spec`` is the authored lesson spec; a NULL spec marks
    # a legacy/hand-authored lesson (always publicly visible). ``generation_status``
    # ∈ {'pending','generating','ready','generation_failed'}.
    spec: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    generation_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    generation_error: Mapped[str | None] = mapped_column(String, nullable=True)


class LessonStep(Base):
    __tablename__ = "lesson_steps"
    __table_args__ = (
        UniqueConstraint("lesson_id", "position", name="uq_lesson_steps_lesson_position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # 'text' | 'demo' | 'prompt' | 'reflection'
    config: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    # v6.1 LLM generation provenance. ``manual_override_content`` (if present)
    # wins over ``config`` everywhere it is served.
    generation_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("ai_generations.id", ondelete="SET NULL"), nullable=True
    )
    prompt_version: Mapped[str | None] = mapped_column(String, nullable=True)
    model_id: Mapped[str | None] = mapped_column(String, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    manual_override_content: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)


class Sonification(Base):
    __tablename__ = "sonifications"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('unlisted','public','flagged')",
            name="ck_sonifications_visibility",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    schema_ver: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    base_state: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    mapping_spec: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    source_files: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    visibility: Mapped[str] = mapped_column(String, nullable=False, default="unlisted")
    short_slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AudioClip(Base):
    """A short curated audio example (5–60 s) referenced by lessons via ``slug``
    (v6.2). License is non-negotiable: every clip carries one of four license
    kinds, and a non-``original-by-you`` clip must declare ``attribution``."""

    __tablename__ = "audio_clips"
    __table_args__ = (
        CheckConstraint(
            "license IN ('CC0', 'CC-BY', 'original-by-you', 'licensed-third-party')",
            name="ck_audio_clips_license",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    # ``public:clips/<slug>.opus`` for shipped (static) clips, else an object-store key.
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    track_affinity: Mapped[list[str]] = mapped_column(JSONType(), nullable=False, default=list)
    concept_tags: Mapped[list[str]] = mapped_column(JSONType(), nullable=False, default=list)
    license: Mapped[str] = mapped_column(String, nullable=False)
    attribution: Mapped[str | None] = mapped_column(String, nullable=True)
    description_embedding: Mapped[list[float] | None] = mapped_column(
        VectorType(1536), nullable=True
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class LessonProgress(Base):
    """v6.3 — per-user, cross-device lesson progress (one row per user+lesson).

    Strictly private: never shown to other users, never used to nudge. The stored
    ``state`` is the writable machine (``not_started`` / ``in_progress`` /
    ``completed``); ``abandoned`` is *computed* by the picker (>30d inactivity) and
    never written, so a user can always resume. Calm-by-design: progress is
    descriptive only — there is deliberately no streak / score / level field here,
    and ``reflection_text`` is private and is never sent to the LLM ranker. The
    single place effective-state and per-track aggregates are derived is
    ``app/services/progress_state.py`` (the ``compute_stats`` heuristic-drift rule).
    """

    __tablename__ = "lesson_progress"
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "lesson_id", name="pk_lesson_progress"),
        CheckConstraint(
            "state IN ('not_started', 'in_progress', 'completed')",
            name="ck_lesson_progress_state",
        ),
        CheckConstraint(
            "scroll_ratio >= 0 AND scroll_ratio <= 1",
            name="ck_lesson_progress_scroll",
        ),
        Index("idx_lesson_progress_user", "user_id", "last_active_at"),
        Index("idx_lesson_progress_state", "user_id", "state", "last_active_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    state: Mapped[str] = mapped_column(String, nullable=False, default="not_started")
    current_step_position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 0..1 ratio within the current step body, so resume survives layout/width changes.
    scroll_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Bounded per-step log (capped in the service): {step_position, action, ms, at}.
    # Metadata only — no free text, no PII. Feeds the next-lesson picker's signals.
    step_actions: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)
    # Private; collected from `reflection` steps. Never published, never sent to the LLM.
    reflection_text: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )



class Study(Base):
    """v7.0 — a versioned, citable bundle of investigators + resources.

    The unit of scientific work. A study requires authenticated ``accounts``
    (via ``study_investigators``); its linked resources are owned by ``users``
    (see ``StudyResource``). ``visibility='public'`` makes the study (and its
    citation) readable anonymously; the public gallery UI itself is deferred
    (v7.6). See docs/v7.0-PLAN.md.
    """

    __tablename__ = "studies"
    __table_args__ = (
        CheckConstraint(
            "status IN ('planning','pre-registered','active','data-collection',"
            "'analysis','published','archived')",
            name="ck_studies_status",
        ),
        CheckConstraint(
            "visibility IN ('private','public')",
            name="ck_studies_visibility",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    abstract: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="planning")
    visibility: Mapped[str] = mapped_column(String, nullable=False, default="private")
    preregistration_url: Mapped[str | None] = mapped_column(String, nullable=True)
    ethics_statement: Mapped[str | None] = mapped_column(String, nullable=True)
    # [{ source, grant_number, role }]
    funding_sources: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)
    concept_doi: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StudyInvestigator(Base):
    __tablename__ = "study_investigators"
    __table_args__ = (
        PrimaryKeyConstraint("study_id", "account_id", name="pk_study_investigators"),
        CheckConstraint(
            "role IN ('pi','co-investigator','analyst','viewer')",
            name="ck_study_investigators_role",
        ),
    )

    study_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class StudyResource(Base):
    """A polymorphic link from a study to an owned resource. ``resource_id`` is
    not a DB foreign key (it spans 8 owner tables); integrity is enforced at
    link time and snapshots capture content so later deletion can't corrupt
    history (see docs/v7.0-PLAN.md §4)."""

    __tablename__ = "study_resources"
    __table_args__ = (
        UniqueConstraint(
            "study_id", "resource_kind", "resource_id", name="uq_study_resources_link"
        ),
        CheckConstraint(
            "resource_kind IN ('patch','piece','listening_session','audio_clip',"
            "'experiment','user_script','dataset','sonification')",
            name="ck_study_resources_kind",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    study_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_kind: Mapped[str] = mapped_column(String, nullable=False)
    resource_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)
    role: Mapped[str | None] = mapped_column(String, nullable=True)  # stimulus|protocol|data|analysis
    added_by: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class StudyVersion(Base):
    """An immutable point-in-time snapshot of a study + its resources. Never
    edited or deleted after creation. ``doi`` is minted on publish (v7.0 CP2)."""

    __tablename__ = "study_versions"
    __table_args__ = (
        UniqueConstraint("study_id", "version_label", name="uq_study_versions_label"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    study_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_label: Mapped[str] = mapped_column(String, nullable=False)
    doi: Mapped[str | None] = mapped_column(String, nullable=True)
    snapshot_json: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class StudyAuditLog(Base):
    """Provenance: one row per study mutation (see docs/v7.0-PLAN.md §5).
    Written only through ``app.study_provenance.record_audit`` — the single
    write-path that makes provenance impossible to forget (heuristic-drift)."""

    __tablename__ = "study_audit_log"
    __table_args__ = (Index("idx_study_audit_study", "study_id", "timestamp"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    study_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    action: Mapped[str] = mapped_column(String, nullable=False)
    before: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    after: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)


class ClinicalProtocol(Base):
    __tablename__ = "clinical_protocols"
    __table_args__ = (
        CheckConstraint(
            "randomization_scheme IN ('simple', 'latin-square', 'block-random', 'custom')",
            name="ck_randomization_scheme",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    study_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    experiment_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("experiments.id", ondelete="SET NULL"), nullable=True
    )
    conditions: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)
    calibration_history: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)
    randomization_scheme: Mapped[str] = mapped_column(String, nullable=False, default="simple")
    randomization_seed: Mapped[str] = mapped_column(String, nullable=False)
    calibration_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    target_lufs: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=-23.0)
    adverse_event_capture: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ct_gov_nct: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ClinicalSessionRecord(Base):
    __tablename__ = "clinical_session_records"
    __table_args__ = (
        Index("idx_clinical_sessions_protocol", "protocol_id", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid)
    protocol_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("clinical_protocols.id", ondelete="CASCADE"), nullable=False
    )
    subject_id: Mapped[str] = mapped_column(String, nullable=False)
    condition_id: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stimulus_sha256: Mapped[str | None] = mapped_column(String, nullable=True)
    calibration_record: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    timing_report: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    adverse_events: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)
    withdrew: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    partial_data_disposition: Mapped[str | None] = mapped_column(String, nullable=True)
    client_audit_log: Mapped[list] = mapped_column(JSONType(), nullable=False, default=list)


# SQLite trigger events for tests/local development when using SQLite
@event.listens_for(Base.metadata, "after_create")

def create_sqlite_triggers(target, connection, **kw):
    if connection.dialect.name == "sqlite":
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS likes_insert_trigger AFTER INSERT ON likes
            BEGIN
                UPDATE patches SET like_count = like_count + 1 WHERE id = NEW.target_id AND NEW.target_kind = 'patch';
                UPDATE pieces SET like_count = like_count + 1 WHERE id = NEW.target_id AND NEW.target_kind = 'piece';
                UPDATE recordings SET like_count = like_count + 1 WHERE id = NEW.target_id AND NEW.target_kind = 'recording';
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS likes_delete_trigger AFTER DELETE ON likes
            BEGIN
                UPDATE patches SET like_count = like_count - 1 WHERE id = OLD.target_id AND OLD.target_kind = 'patch';
                UPDATE pieces SET like_count = like_count - 1 WHERE id = OLD.target_id AND OLD.target_kind = 'piece';
                UPDATE recordings SET like_count = like_count - 1 WHERE id = OLD.target_id AND OLD.target_kind = 'recording';
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS follows_insert_trigger AFTER INSERT ON follows
            BEGIN
                UPDATE accounts SET follower_count = follower_count + 1 WHERE id = NEW.followed_account_id;
                UPDATE accounts SET following_count = following_count + 1 WHERE id = NEW.follower_account_id;
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS follows_delete_trigger AFTER DELETE ON follows
            BEGIN
                UPDATE accounts SET follower_count = follower_count - 1 WHERE id = OLD.followed_account_id;
                UPDATE accounts SET following_count = following_count - 1 WHERE id = OLD.follower_account_id;
            END;
        """))




