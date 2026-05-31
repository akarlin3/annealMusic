"""v7_2 clinical protocols and session records

Revision ID: 0026_v7_2_clinical
Revises: 0025_v7_0_studies, 0019_v7_1_sonifications
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026_v7_2_clinical"
down_revision: tuple[str, str] | None = ("0025_v7_0_studies", "0019_v7_1_sonifications")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.String()
    json_type = postgresql.JSONB if is_pg else sa.JSON()
    empty_json_array = sa.text("'[]'::jsonb") if is_pg else sa.text("'[]'")

    # ── clinical_protocols ────────────────────────────────────────────────────
    op.create_table(
        "clinical_protocols",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "study_id", uuid_type, sa.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "experiment_id", uuid_type, sa.ForeignKey("experiments.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("conditions", json_type, nullable=False, server_default=empty_json_array),
        sa.Column("calibration_history", json_type, nullable=False, server_default=empty_json_array),
        sa.Column("randomization_scheme", sa.String(), nullable=False, server_default="simple"),
        sa.Column("randomization_seed", sa.String(), nullable=False),
        sa.Column("calibration_required", sa.Boolean(), nullable=False, server_default=sa.text("1") if not is_pg else sa.text("true")),
        sa.Column("target_lufs", sa.Numeric(5, 2), nullable=False, server_default="-23.0"),
        sa.Column("adverse_event_capture", sa.Boolean(), nullable=False, server_default=sa.text("1") if not is_pg else sa.text("true")),
        sa.Column("ct_gov_nct", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "randomization_scheme IN ('simple', 'latin-square', 'block-random', 'custom')",
            name="ck_randomization_scheme",
        ),
    )
    op.create_index("idx_clinical_protocols_study", "clinical_protocols", ["study_id"], unique=False)

    # ── clinical_session_records ──────────────────────────────────────────────
    op.create_table(
        "clinical_session_records",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "protocol_id", uuid_type, sa.ForeignKey("clinical_protocols.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("subject_id", sa.String(), nullable=False),
        sa.Column("condition_id", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stimulus_sha256", sa.String(), nullable=True),
        sa.Column("calibration_record", json_type, nullable=True),
        sa.Column("timing_report", json_type, nullable=True),
        sa.Column("adverse_events", json_type, nullable=False, server_default=empty_json_array),
        sa.Column("withdrew", sa.Boolean(), nullable=False, server_default=sa.text("0") if not is_pg else sa.text("false")),
        sa.Column("partial_data_disposition", sa.String(), nullable=True),
        sa.Column("client_audit_log", json_type, nullable=False, server_default=empty_json_array),
    )
    op.create_index(
        "idx_clinical_sessions_protocol", "clinical_session_records", ["protocol_id", "started_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("idx_clinical_sessions_protocol", table_name="clinical_session_records")
    op.drop_table("clinical_session_records")
    op.drop_index("idx_clinical_protocols_study", table_name="clinical_protocols")
    op.drop_table("clinical_protocols")
