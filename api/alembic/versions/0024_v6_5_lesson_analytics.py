"""v6.5 lesson_analytics materialized view.

Aggregate, anonymized rollup over ``lesson_progress`` for the admin analytics
surface. View-only derivation — no new base tables. Per-step drop-off,
time-on-step, clip, and prompt metrics are computed on demand from
``step_actions`` (see ``app/services/analytics.py``).

The materialized view is a Postgres production-performance / external-BI
artifact and is guarded behind ``is_pg``. SQLite (dev/test) skips it; the admin
endpoints compute their aggregates portably over the base tables, so they work
on both dialects. ``abandoned`` is never stored (it is computed >30d inactive
in ``progress_state``), so the view does not filter on it.

Revision ID: 0024_v6_5_lesson_analytics
Revises: 0023_v6_4_curriculum_seed
Create Date: 2026-05-30

"""

from __future__ import annotations

from alembic import op

revision = "0024_v6_5_lesson_analytics"
down_revision = "0023_v6_4_curriculum_seed"
branch_labels = None
depends_on = None


CREATE_VIEW = """
CREATE MATERIALIZED VIEW lesson_analytics AS
SELECT
  lesson_id,
  COUNT(*)                                              AS views,
  COUNT(*) FILTER (WHERE state = 'completed')           AS completions,
  COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)
           FILTER (WHERE state = 'completed'), 0)::INTEGER AS avg_completion_ms,
  COUNT(reflection_text) FILTER
    (WHERE reflection_text IS NOT NULL AND reflection_text <> '') AS reflections
FROM lesson_progress
GROUP BY lesson_id;
"""

# Unique index is required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE_INDEX = (
    "CREATE UNIQUE INDEX idx_lesson_analytics_lesson "
    "ON lesson_analytics(lesson_id);"
)


def upgrade() -> None:
    is_pg = op.get_bind().dialect.name == "postgresql"
    if is_pg:
        op.execute(CREATE_VIEW)
        op.execute(CREATE_INDEX)


def downgrade() -> None:
    is_pg = op.get_bind().dialect.name == "postgresql"
    if is_pg:
        op.execute("DROP MATERIALIZED VIEW IF EXISTS lesson_analytics;")
