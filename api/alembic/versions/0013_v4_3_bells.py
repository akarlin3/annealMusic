"""v4_3 bells schema changes

Revision ID: 0013_v4_3_bells
Revises: 0012_v4_2_drone_mode
Create Date: 2026-05-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
import json

revision: str = "0013_v4_3_bells"
down_revision: str | None = "0012_v4_2_drone_mode"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. Add bell_schedule column
    if is_pg:
        op.add_column(
            "listening_sessions",
            sa.Column(
                "bell_schedule",
                postgresql.JSONB(),
                nullable=False,
                server_default="[]",
            ),
        )
        op.add_column(
            "pieces",
            sa.Column(
                "bell_schedule",
                postgresql.JSONB(),
                nullable=False,
                server_default="[]",
            ),
        )
    else:
        with op.batch_alter_table("listening_sessions") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "bell_schedule",
                    sa.JSON(),
                    nullable=False,
                    server_default="[]",
                )
            )
        with op.batch_alter_table("pieces") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "bell_schedule",
                    sa.JSON(),
                    nullable=False,
                    server_default="[]",
                )
            )

    # 2. Data migration from opening_tone/closing_tone booleans to bell_schedule arrays
    connection = op.get_bind()
    metadata = sa.MetaData()
    
    # Reflect tables
    ls_table = sa.Table(
        "listening_sessions",
        metadata,
        sa.Column("id", postgresql.UUID(as_uuid=True) if is_pg else sa.String(), primary_key=True),
        sa.Column("opening_tone", sa.Boolean()),
        sa.Column("closing_tone", sa.Boolean()),
        sa.Column("bell_schedule", postgresql.JSONB() if is_pg else sa.JSON()),
    )
    
    # Query all sessions
    sessions = connection.execute(sa.select(ls_table.c.id, ls_table.c.opening_tone, ls_table.c.closing_tone)).all()
    for row in sessions:
        sched = []
        if row.opening_tone:
            sched.append({
                "bellId": "zen_bell_rin",
                "trigger": "at-start",
                "volume": 0.7,
            })
        if row.closing_tone:
            sched.append({
                "bellId": "zen_bell_rin",
                "trigger": "at-end",
                "volume": 0.7,
            })
        
        # Save schedule
        connection.execute(
            ls_table.update()
            .where(ls_table.c.id == row.id)
            .values(bell_schedule=sched if is_pg else json.dumps(sched))
        )

    # 3. Drop legacy columns
    if is_pg:
        op.drop_column("listening_sessions", "opening_tone")
        op.drop_column("listening_sessions", "closing_tone")
    else:
        with op.batch_alter_table("listening_sessions") as batch_op:
            batch_op.drop_column("opening_tone")
            batch_op.drop_column("closing_tone")


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Re-add columns
    if is_pg:
        op.add_column(
            "listening_sessions",
            sa.Column(
                "opening_tone",
                sa.Boolean(),
                nullable=False,
                server_default="false",
            ),
        )
        op.add_column(
            "listening_sessions",
            sa.Column(
                "closing_tone",
                sa.Boolean(),
                nullable=False,
                server_default="false",
            ),
        )
    else:
        with op.batch_alter_table("listening_sessions") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "opening_tone",
                    sa.Boolean(),
                    nullable=False,
                    server_default="0",
                )
            )
            batch_op.add_column(
                sa.Column(
                    "closing_tone",
                    sa.Boolean(),
                    nullable=False,
                    server_default="0",
                )
            )

    # Data migration back to booleans
    connection = op.get_bind()
    metadata = sa.MetaData()
    ls_table = sa.Table(
        "listening_sessions",
        metadata,
        sa.Column("id", postgresql.UUID(as_uuid=True) if is_pg else sa.String(), primary_key=True),
        sa.Column("opening_tone", sa.Boolean()),
        sa.Column("closing_tone", sa.Boolean()),
        sa.Column("bell_schedule", postgresql.JSONB() if is_pg else sa.JSON()),
    )
    
    sessions = connection.execute(sa.select(ls_table.c.id, ls_table.c.bell_schedule)).all()
    for row in sessions:
        sched = row.bell_schedule
        if isinstance(sched, str):
            try:
                sched = json.loads(sched)
            except Exception:
                sched = []
        
        has_open = any(isinstance(x, dict) and x.get("trigger") == "at-start" for x in sched)
        has_close = any(isinstance(x, dict) and x.get("trigger") == "at-end" for x in sched)
        
        connection.execute(
            ls_table.update()
            .where(ls_table.c.id == row.id)
            .values(opening_tone=has_open, closing_tone=has_close)
        )

    # Drop bell_schedule columns
    if is_pg:
        op.drop_column("listening_sessions", "bell_schedule")
        op.drop_column("pieces", "bell_schedule")
    else:
        with op.batch_alter_table("listening_sessions") as batch_op:
            batch_op.drop_column("bell_schedule")
        with op.batch_alter_table("pieces") as batch_op:
            batch_op.drop_column("bell_schedule")
