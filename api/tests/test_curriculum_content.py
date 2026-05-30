"""v6.4 CP2 — the authored curriculum coheres.

Validates every authored spec against the real LessonSpec model + the spec
field rules, checks id uniqueness and track validity, and asserts the
prerequisite graph is an acyclic graph rooted at synthesis-fundamentals/intro
with every intro lesson reachable without gating.
"""

from __future__ import annotations

from app.schemas import LessonSpec
from app.services import curriculum_content as cc
from app.services import curriculum_qa as qa
from app.services.spec_generator import _validate_step_fields


_TRACK_SLUGS = {t["slug"] for t in cc.TRACKS}
_ALL_IDS = {l["id"] for l in cc.LESSONS}


def test_track_count_and_slugs():
    assert len(cc.TRACKS) == 5
    assert _TRACK_SLUGS == {
        "synthesis-fundamentals", "composition-technique",
        "ambient-history-listening", "production-daw", "music-science-crossover",
    }


def test_lesson_count_in_band():
    # Brief target: 50–80 lessons.
    assert 50 <= len(cc.LESSONS) <= 80


def test_ids_unique():
    ids = [l["id"] for l in cc.LESSONS]
    assert len(ids) == len(set(ids))


def test_every_spec_validates():
    for lesson in cc.LESSONS:
        spec = LessonSpec.model_validate(lesson)
        # id == track/slug and track is a real track
        assert spec.id == f"{spec.track}/{spec.id.split('/', 1)[1]}"
        assert spec.track in _TRACK_SLUGS
        # per-type required fields present
        errs = _validate_step_fields(spec)
        assert errs == [], f"{spec.id}: {errs}"


def test_every_lesson_has_a_hearable_step():
    for lesson in cc.LESSONS:
        types = {s["type"] for s in lesson["step_outline"]}
        assert types & {"demo", "audio-clip"}, f"{lesson['id']} has nothing to hear"


def test_prereq_edges_reference_known_lessons():
    for pre, lesson in cc.PREREQ_EDGES:
        assert pre in _ALL_IDS, f"unknown prerequisite {pre}"
        assert lesson in _ALL_IDS, f"unknown lesson {lesson}"


def test_prereq_graph_is_a_dag():
    findings = qa.check_prereq_graph(cc.PREREQ_EDGES, known_ids=_ALL_IDS)
    assert findings == [], findings


def test_single_root_intro_has_no_prereqs():
    root = "synthesis-fundamentals/intro"
    assert not any(lesson == root for _pre, lesson in cc.PREREQ_EDGES)


def test_difficulty_monotonicity_no_warnings():
    diff = {l["id"]: l["difficulty"] for l in cc.LESSONS}
    findings = qa.check_difficulty_monotonicity(diff, cc.PREREQ_EDGES)
    assert findings == [], [f.message for f in findings]


def test_every_track_has_at_least_one_intro_lesson():
    by_track: dict[str, set[str]] = {}
    for l in cc.LESSONS:
        by_track.setdefault(l["track"], set()).add(l["difficulty"])
    for track, diffs in by_track.items():
        assert "intro" in diffs, f"{track} has no intro lesson"


def test_reachability_from_root():
    # Every lesson is reachable from the root by following prereq edges backward
    # (i.e. the dependency graph is connected to the root).
    deps: dict[str, list[str]] = {}
    for pre, lesson in cc.PREREQ_EDGES:
        deps.setdefault(lesson, []).append(pre)
    root = "synthesis-fundamentals/intro"

    def roots_of(node: str, seen: set[str]) -> set[str]:
        if node in seen:
            return set()
        seen.add(node)
        if node not in deps:
            return {node}
        out: set[str] = set()
        for p in deps[node]:
            out |= roots_of(p, seen)
        return out

    for lesson_id in _ALL_IDS:
        assert root in roots_of(lesson_id, set()), f"{lesson_id} not rooted at intro"
