"""v7_0 studies — research collaboration foundation

Revision ID: 0025_v7_0_studies
Revises: 0024_v6_5_lesson_analytics
Create Date: 2026-05-31

Adds the multi-investigator Study substrate: studies + investigators +
linked resources + immutable versions + a provenance audit log, plus
ORCID / ROR fields on accounts. See docs/v7.0-PLAN.md.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0025_v7_0_studies"
down_revision: str | None = "0024_v6_5_lesson_analytics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()
    empty_json_array = sa.text("'[]'::jsonb") if is_pg else sa.text("'[]'")

    # ── studies ──────────────────────────────────────────────────────────────
    op.create_table(
        "studies",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("abstract", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="planning"),
        sa.Column("visibility", sa.String(), nullable=False, server_default="private"),
        sa.Column("preregistration_url", sa.String(), nullable=True),
        sa.Column("ethics_statement", sa.String(), nullable=True),
        sa.Column("funding_sources", json_type, nullable=False, server_default=empty_json_array),
        sa.Column("concept_doi", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('planning','pre-registered','active','data-collection',"
            "'analysis','published','archived')",
            name="ck_studies_status",
        ),
        sa.CheckConstraint(
            "visibility IN ('private','public')",
            name="ck_studies_visibility",
        ),
    )
    op.create_index("idx_studies_visibility", "studies", ["visibility"], unique=False)

    # ── investigators ────────────────────────────────────────────────────────
    op.create_table(
        "study_investigators",
        sa.Column(
            "study_id", uuid_type, sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "account_id",
            uuid_type,
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column(
            "added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("study_id", "account_id", name="pk_study_investigators"),
        sa.CheckConstraint(
            "role IN ('pi','co-investigator','analyst','viewer')",
            name="ck_study_investigators_role",
        ),
    )

    # ── linked resources (polymorphic) ─────────────────────────────────────────
    op.create_table(
        "study_resources",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "study_id", uuid_type, sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("resource_kind", sa.String(), nullable=False),
        sa.Column("resource_id", uuid_type, nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column(
            "added_by",
            uuid_type,
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            "study_id", "resource_kind", "resource_id", name="uq_study_resources_link"
        ),
        sa.CheckConstraint(
            "resource_kind IN ('patch','piece','listening_session','audio_clip',"
            "'experiment','user_script','dataset','sonification')",
            name="ck_study_resources_kind",
        ),
    )
    op.create_index("idx_study_resources_study", "study_resources", ["study_id"], unique=False)

    # ── versions / snapshots ───────────────────────────────────────────────────
    op.create_table(
        "study_versions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "study_id", uuid_type, sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("version_label", sa.String(), nullable=False),
        sa.Column("doi", sa.String(), nullable=True),
        sa.Column("snapshot_json", json_type, nullable=False),
        sa.Column(
            "created_by",
            uuid_type,
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("study_id", "version_label", name="uq_study_versions_label"),
    )
    op.create_index("idx_study_versions_study", "study_versions", ["study_id"], unique=False)

    # ── provenance / audit ──────────────────────────────────────────────────────
    op.create_table(
        "study_audit_log",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "study_id", uuid_type, sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "account_id",
            uuid_type,
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("before", json_type, nullable=True),
        sa.Column("after", json_type, nullable=True),
    )
    op.create_index(
        "idx_study_audit_study", "study_audit_log", ["study_id", "timestamp"], unique=False
    )

    # ── account profile extensions ──────────────────────────────────────────────
    op.add_column("accounts", sa.Column("orcid", sa.String(), nullable=True))
    op.add_column("accounts", sa.Column("affiliation_ror", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "affiliation_ror")
    op.drop_column("accounts", "orcid")
    op.drop_index("idx_study_audit_study", table_name="study_audit_log")
    op.drop_table("study_audit_log")
    op.drop_index("idx_study_versions_study", table_name="study_versions")
    op.drop_table("study_versions")
    op.drop_index("idx_study_resources_study", table_name="study_resources")
    op.drop_table("study_resources")
    op.drop_table("study_investigators")
    op.drop_index("idx_studies_visibility", table_name="studies")
    op.drop_table("studies")
