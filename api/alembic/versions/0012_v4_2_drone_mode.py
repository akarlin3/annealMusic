"""v4_2 drone mode schema changes

Revision ID: 0012_v4_2_drone_mode
Revises: 0011_v4_1_custom_tunings
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012_v4_2_drone_mode"
down_revision: str | None = "0011_v4_1_custom_tunings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()

    # 1. Migrate patches.mode default and existing values
    op.alter_column("patches", "mode", server_default="sketch")
    op.execute("UPDATE patches SET mode = 'sketch'")

    # 2. Migrate listening_sessions to support patch_id alongside piece_id
    if is_pg:
        op.add_column(
            "listening_sessions",
            sa.Column(
                "patch_id",
                uuid_type,
                sa.ForeignKey("patches.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        # Drop old piece_id foreign key constraint and recreate with ON DELETE CASCADE
        op.drop_constraint(
            "listening_sessions_piece_id_fkey",
            "listening_sessions",
            type_="foreignkey",
        )
        op.create_foreign_key(
            "listening_sessions_piece_id_fkey",
            "listening_sessions",
            "pieces",
            ["piece_id"],
            ["id"],
            ondelete="SET NULL",
        )
        # Add Check Constraint to ensure exactly one of piece_id or patch_id is set
        op.create_check_constraint(
            "ls_source_one_of",
            "listening_sessions",
            "(piece_id IS NULL) OR (patch_id IS NULL)",
        )
        op.create_index(
            "idx_listening_sessions_patch",
            "listening_sessions",
            ["patch_id"],
            unique=False,
        )
    else:
        # SQLite batch mode
        with op.batch_alter_table("listening_sessions") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "patch_id",
                    uuid_type,
                    sa.ForeignKey("patches.id", ondelete="SET NULL"),
                    nullable=True,
                )
            )
            # Recreate foreign keys and check constraint in SQLite batch
            batch_op.create_check_constraint(
                "ls_source_one_of",
                "(piece_id IS NULL) OR (patch_id IS NULL)",
            )
            batch_op.create_index(
                "idx_listening_sessions_patch",
                ["patch_id"],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. Restore patches.mode default
    op.alter_column("patches", "mode", server_default="open")
    op.execute("UPDATE patches SET mode = 'open'")

    # 2. Downgrade listening_sessions
    if is_pg:
        op.drop_constraint("ls_source_one_of", "listening_sessions", type_="check")
        op.drop_index("idx_listening_sessions_patch", table_name="listening_sessions")
        op.drop_constraint(
            "listening_sessions_piece_id_fkey",
            "listening_sessions",
            type_="foreignkey",
        )
        op.create_foreign_key(
            "listening_sessions_piece_id_fkey",
            "listening_sessions",
            "pieces",
            ["piece_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.drop_column("listening_sessions", "patch_id")
    else:
        with op.batch_alter_table("listening_sessions") as batch_op:
            batch_op.drop_constraint("ls_source_one_of", type_="check")
            batch_op.drop_index("idx_listening_sessions_patch")
            batch_op.drop_column("patch_id")
