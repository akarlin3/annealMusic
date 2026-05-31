"""v7_3 mapping templates

Revision ID: 0027_v7_3_mapping_templates
Revises: 0026_v7_2_clinical
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0027_v7_3_mapping_templates"
down_revision: str | None = "0026_v7_2_clinical"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()

    op.create_table(
        "mapping_templates",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("slug", sa.String(), unique=True, nullable=False, index=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("domain_family", sa.String(), nullable=False),
        sa.Column("source_schema", json_type, nullable=False),
        sa.Column("mapping_spec", json_type, nullable=False),
        sa.Column("calibration_recommendation", sa.Text(), nullable=True),
        sa.Column("citation", sa.Text(), nullable=True),
        sa.Column("recipe_content", sa.Text(), nullable=False),
        sa.Column("example_data_path", sa.String(), nullable=True),
        sa.Column("example_audio_path", sa.String(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "domain_family IN ('time-series', 'scalar-field', 'network', 'structured-event')",
            name="ck_mapping_templates_domain_family",
        ),
    )

    if is_pg:
        op.create_index(
            "idx_mapping_templates_domain",
            "mapping_templates",
            ["domain_family"],
            postgresql_where=sa.text("archived_at IS NULL"),
        )
    else:
        op.create_index(
            "idx_mapping_templates_domain",
            "mapping_templates",
            ["domain_family"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    op.drop_index("idx_mapping_templates_domain", table_name="mapping_templates")
    op.drop_table("mapping_templates")
