"""auth_claim: accounts, providers, sessions, magic_links, and users.account_id

Revision ID: 0005_auth_claim
Revises: 0004_user_sources
Create Date: 2026-05-29
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_auth_claim"
down_revision: str | None = "0004_user_sources"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. Create citext extension if on PostgreSQL
    if is_pg:
        op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    email_type = postgresql.CITEXT() if is_pg else sa.String()
    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()

    # 2. Create accounts table
    op.create_table(
        "accounts",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("email", email_type, nullable=False, unique=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("avatar_seed", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_accounts_email", "accounts", ["email"])

    # 3. Create account_providers table
    op.create_table(
        "account_providers",
        sa.Column("account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("provider", "subject", name="pk_account_providers"),
    )
    op.create_index("idx_account_providers_account", "account_providers", ["account_id"])

    # 4. Create sessions table
    op.create_table(
        "sessions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip_hash", sa.Text(), nullable=True),
    )
    op.create_index("idx_sessions_account", "sessions", ["account_id"])
    op.create_index("idx_sessions_expires", "sessions", ["expires_at"])

    # 5. Create magic_links table
    op.create_table(
        "magic_links",
        sa.Column("token", uuid_type, primary_key=True),
        sa.Column("email", email_type, nullable=False),
        sa.Column("intent", sa.Text(), nullable=False),
        sa.Column("account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_magic_links_email", "magic_links", ["email"])

    # 6. Add account_id to users table
    op.add_column(
        "users",
        sa.Column("account_id", uuid_type, sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    )
    op.create_index("idx_users_account", "users", ["account_id"])


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Drop column and indexes from users
    op.drop_index("idx_users_account", table_name="users")
    op.drop_column("users", "account_id")

    # Drop magic_links table and index
    op.drop_index("idx_magic_links_email", table_name="magic_links")
    op.drop_table("magic_links")

    # Drop sessions table and indexes
    op.drop_index("idx_sessions_expires", table_name="sessions")
    op.drop_index("idx_sessions_account", table_name="sessions")
    op.drop_table("sessions")

    # Drop account_providers table and index
    op.drop_index("idx_account_providers_account", table_name="account_providers")
    op.drop_table("account_providers")

    # Drop accounts table and index
    op.drop_index("idx_accounts_email", table_name="accounts")
    op.drop_table("accounts")

    # We do NOT drop the citext extension because other features might use it,
    # or database level extensions are typically managed outside regular flow.
