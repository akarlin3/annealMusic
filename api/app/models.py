from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Date,
    ForeignKey,
    Integer,
    String,
    Numeric,
    func,
    event,
    text,
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
    mode: Mapped[str] = mapped_column(String, nullable=False, default="open")
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
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False) # 'text-to-patch' | 'mood-transfer' | 'description'
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


# SQLite trigger events for tests/local development when using SQLite
@event.listens_for(Base.metadata, "after_create")

def create_sqlite_triggers(target, connection, **kw):
    if connection.dialect.name == "sqlite":
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS likes_insert_trigger AFTER INSERT ON likes
            BEGIN
                UPDATE patches SET like_count = like_count + 1 WHERE id = NEW.target_id AND NEW.target_kind = 'patch';
                UPDATE recordings SET like_count = like_count + 1 WHERE id = NEW.target_id AND NEW.target_kind = 'recording';
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS likes_delete_trigger AFTER DELETE ON likes
            BEGIN
                UPDATE patches SET like_count = like_count - 1 WHERE id = OLD.target_id AND OLD.target_kind = 'patch';
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




