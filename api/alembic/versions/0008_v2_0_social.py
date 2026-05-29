"""feat v2.0 social

Revision ID: 0008_v2_0_social
Revises: 0007_jam_sessions
Create Date: 2026-05-29
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_v2_0_social"
down_revision: str | None = "0007_jam_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()

    # 1. Create likes table
    op.create_table(
        "likes",
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_kind", sa.String(), nullable=False),
        sa.Column("target_id", uuid_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("user_id", "target_kind", "target_id"),
    )
    op.create_index("idx_likes_target", "likes", ["target_kind", "target_id"])
    op.create_index("idx_likes_user", "likes", ["user_id", "created_at"])

    # 2. Create follows table
    op.create_table(
        "follows",
        sa.Column("follower_account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("followed_account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("follower_account_id", "followed_account_id"),
        sa.CheckConstraint("follower_account_id <> followed_account_id", name="chk_no_self_follow"),
    )
    op.create_index("idx_follows_followed", "follows", ["followed_account_id"])
    op.create_index("idx_follows_follower", "follows", ["follower_account_id"])

    # 3. Create blocks table
    op.create_table(
        "blocks",
        sa.Column("blocker_account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("blocked_account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("blocker_account_id", "blocked_account_id"),
        sa.CheckConstraint("blocker_account_id <> blocked_account_id", name="chk_no_self_block"),
    )
    op.create_index("idx_blocks_blocked", "blocks", ["blocked_account_id"])

    # 4. Create mutes table
    op.create_table(
        "mutes",
        sa.Column("muter_account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("muted_account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("muter_account_id", "muted_account_id"),
        sa.CheckConstraint("muter_account_id <> muted_account_id", name="chk_no_self_mute"),
    )

    # 5. Create featured_picks table
    op.create_table(
        "featured_picks",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("week_starting", sa.Date(), nullable=False),
        sa.Column("patch_id", uuid_type, sa.ForeignKey("patches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("curator_note", sa.String(), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_featured_week_position", "featured_picks", ["week_starting", "position"], unique=True)
    op.create_index("idx_featured_week", "featured_picks", ["week_starting"])

    # 6. Alter accounts table
    op.add_column("accounts", sa.Column("bio", sa.String(length=280), nullable=True))
    op.add_column("accounts", sa.Column("likes_public", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("accounts", sa.Column("follows_public", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("accounts", sa.Column("suspended", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("accounts", sa.Column("follower_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("accounts", sa.Column("following_count", sa.Integer(), nullable=False, server_default="0"))

    # 7. Alter patches and recordings tables for denormalized like count
    op.add_column("patches", sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("recordings", sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"))

    # 8. Triggers for denormalization
    if is_pg:
        # PostgreSQL trigger for likes
        op.execute(
            """
            CREATE OR REPLACE FUNCTION update_like_count() RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    IF NEW.target_kind = 'patch' THEN
                        UPDATE patches SET like_count = like_count + 1 WHERE id = NEW.target_id;
                    ELSIF NEW.target_kind = 'recording' THEN
                        UPDATE recordings SET like_count = like_count + 1 WHERE id = NEW.target_id;
                    END IF;
                    RETURN NEW;
                ELSIF TG_OP = 'DELETE' THEN
                    IF OLD.target_kind = 'patch' THEN
                        UPDATE patches SET like_count = like_count - 1 WHERE id = OLD.target_id;
                    ELSIF OLD.target_kind = 'recording' THEN
                        UPDATE recordings SET like_count = like_count - 1 WHERE id = OLD.target_id;
                    END IF;
                    RETURN OLD;
                END IF;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute(
            """
            CREATE TRIGGER likes_count_trigger
            AFTER INSERT OR DELETE ON likes
            FOR EACH ROW EXECUTE FUNCTION update_like_count();
            """
        )

        # PostgreSQL trigger for follows
        op.execute(
            """
            CREATE OR REPLACE FUNCTION update_follow_count() RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    UPDATE accounts SET follower_count = follower_count + 1 WHERE id = NEW.followed_account_id;
                    UPDATE accounts SET following_count = following_count + 1 WHERE id = NEW.follower_account_id;
                    RETURN NEW;
                ELSIF TG_OP = 'DELETE' THEN
                    UPDATE accounts SET follower_count = follower_count - 1 WHERE id = OLD.followed_account_id;
                    UPDATE accounts SET following_count = following_count - 1 WHERE id = OLD.follower_account_id;
                    RETURN OLD;
                END IF;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute(
            """
            CREATE TRIGGER follows_count_trigger
            AFTER INSERT OR DELETE ON follows
            FOR EACH ROW EXECUTE FUNCTION update_follow_count();
            """
        )
    else:
        # SQLite trigger for likes insert
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS likes_insert_trigger AFTER INSERT ON likes
            BEGIN
                UPDATE patches SET like_count = like_count + 1 WHERE id = NEW.target_id AND NEW.target_kind = 'patch';
                UPDATE recordings SET like_count = like_count + 1 WHERE id = NEW.target_id AND NEW.target_kind = 'recording';
            END;
            """
        )
        # SQLite trigger for likes delete
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS likes_delete_trigger AFTER DELETE ON likes
            BEGIN
                UPDATE patches SET like_count = like_count - 1 WHERE id = OLD.target_id AND OLD.target_kind = 'patch';
                UPDATE recordings SET like_count = like_count - 1 WHERE id = OLD.target_id AND OLD.target_kind = 'recording';
            END;
            """
        )
        # SQLite trigger for follows insert
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS follows_insert_trigger AFTER INSERT ON follows
            BEGIN
                UPDATE accounts SET follower_count = follower_count + 1 WHERE id = NEW.followed_account_id;
                UPDATE accounts SET following_count = following_count + 1 WHERE id = NEW.follower_account_id;
            END;
            """
        )
        # SQLite trigger for follows delete
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS follows_delete_trigger AFTER DELETE ON follows
            BEGIN
                UPDATE accounts SET follower_count = follower_count - 1 WHERE id = OLD.followed_account_id;
                UPDATE accounts SET following_count = following_count - 1 WHERE id = OLD.follower_account_id;
            END;
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("DROP TRIGGER IF EXISTS follows_count_trigger ON follows")
        op.execute("DROP FUNCTION IF EXISTS update_follow_count")
        op.execute("DROP TRIGGER IF EXISTS likes_count_trigger ON likes")
        op.execute("DROP FUNCTION IF EXISTS update_like_count")
    else:
        op.execute("DROP TRIGGER IF EXISTS follows_delete_trigger")
        op.execute("DROP TRIGGER IF EXISTS follows_insert_trigger")
        op.execute("DROP TRIGGER IF EXISTS likes_delete_trigger")
        op.execute("DROP TRIGGER IF EXISTS likes_insert_trigger")

    op.drop_column("recordings", "like_count")
    op.drop_column("patches", "like_count")

    op.drop_column("accounts", "following_count")
    op.drop_column("accounts", "follower_count")
    op.drop_column("accounts", "suspended")
    op.drop_column("accounts", "follows_public")
    op.drop_column("accounts", "likes_public")
    op.drop_column("accounts", "bio")

    op.drop_index("idx_featured_week", table_name="featured_picks")
    op.drop_index("idx_featured_week_position", table_name="featured_picks")
    op.drop_table("featured_picks")

    op.drop_table("mutes")
    op.drop_index("idx_blocks_blocked", table_name="blocks")
    op.drop_table("blocks")
    op.drop_index("idx_follows_follower", table_name="follows")
    op.drop_index("idx_follows_followed", table_name="follows")
    op.drop_table("follows")
    op.drop_index("idx_likes_user", table_name="likes")
    op.drop_index("idx_likes_target", table_name="likes")
    op.drop_table("likes")
