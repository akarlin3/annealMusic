"""v6.4 CP1 — curriculum quality-check rules (pure, no network)."""

from __future__ import annotations

from app.services import curriculum_qa as qa
from app.services.curriculum_qa import LessonQAInput


_GOOD_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">'
    '<rect x="10" y="10" width="80" height="40" fill="#f59e0b"/></svg>'
)

_LONG = "This calm string engine models a plucked tone using a delay line. " * 8


def _text_step(content=_LONG, diagram=None):
    cfg = {"title": "Intro", "content": content, "key_points": []}
    if diagram:
        cfg["diagram"] = diagram
    return {"type": "text", "config": cfg, "override": None}


def _demo_step(patch=None):
    patch = patch or {"m": "open", "e": "sine", "rootFreq": 440}
    payload = "&".join(f"{k}={v}" for k, v in patch.items())
    return {"type": "demo", "config": {"description": "a calm sine", "patch": patch, "payload": payload}, "override": None}


def _reflection_step():
    return {"type": "reflection", "config": {"prompt": "What did you notice about the decay?"}, "override": None}


def _clip_step(slug="pluck-bright"):
    return {"type": "audio-clip", "config": {"clip_id": slug, "intro_text": "Listen to this bright pluck and its slow decay."}, "override": None}


def _spec(types, track="synthesis-fundamentals", slug="karplus", difficulty="intro"):
    return {
        "id": f"{track}/{slug}", "track": track, "title": "How the String Engine Works",
        "objectives": ["Understand Karplus-Strong"], "difficulty": difficulty,
        "step_outline": [{"type": t} for t in types],
    }


def _input(steps, spec=None, title="How the String Engine Works", difficulty="intro", sid="synthesis-fundamentals/karplus"):
    return LessonQAInput(id=sid, title=title, difficulty=difficulty, spec=spec, steps=steps)


# --- Rule 1: step coverage ---------------------------------------------------

def test_clean_lesson_passes():
    inp = _input(
        [_text_step(), _demo_step(), _reflection_step()],
        spec=_spec(["text", "demo", "reflection"]),
    )
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7,
                              known_track_slugs={"synthesis-fundamentals"})
    assert qa.summarize(findings)["status"] == "pass", findings


def test_missing_hearable_step_is_error():
    inp = _input([_text_step(), _reflection_step()], spec=_spec(["text", "reflection"]))
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7)
    assert any(f.rule == "step-coverage" and f.level == "error" for f in findings)


def test_spec_declared_type_missing_is_error():
    # spec promises an audio-clip but output has none
    inp = _input([_text_step(), _demo_step(), _reflection_step()],
                 spec=_spec(["text", "demo", "audio-clip", "reflection"]))
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7)
    assert any(f.rule == "step-coverage" and "not present" in f.message for f in findings)


# --- Rule 2: audio clips exist ----------------------------------------------

def test_audio_clip_missing_from_library_is_error():
    inp = _input([_text_step(), _clip_step("ghost-clip"), _reflection_step()],
                 spec=_spec(["text", "audio-clip", "reflection"]))
    findings = qa.check_lesson(inp, available_clip_slugs={"other-clip"}, manifest_version=7)
    assert any(f.rule == "audio-clips" and f.level == "error" for f in findings)


def test_audio_clip_present_passes():
    inp = _input([_text_step(), _clip_step("pluck-bright"), _reflection_step()],
                 spec=_spec(["text", "audio-clip", "reflection"]))
    findings = qa.check_lesson(inp, available_clip_slugs={"pluck-bright"}, manifest_version=7)
    assert not any(f.rule == "audio-clips" for f in findings)


# --- Rule 3: demos validate --------------------------------------------------

def test_demo_without_payload_is_error():
    bad = {"type": "demo", "config": {"description": "x"}, "override": None}
    inp = _input([_text_step(), bad, _reflection_step()], spec=_spec(["text", "demo", "reflection"]))
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7)
    assert any(f.rule == "demo-validate" and f.level == "error" for f in findings)


# --- Rule 4: diagram sanitize ------------------------------------------------

def test_clean_svg_passes():
    inp = _input([_text_step(diagram={"kind": "svg", "source": _GOOD_SVG}), _demo_step(), _reflection_step()],
                 spec=_spec(["text", "demo", "reflection"]))
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7)
    assert not any(f.rule == "diagram-sanitize" for f in findings)


def test_script_svg_is_error():
    bad_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>'
    inp = _input([_text_step(diagram={"kind": "svg", "source": bad_svg}), _demo_step(), _reflection_step()],
                 spec=_spec(["text", "demo", "reflection"]))
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7)
    assert any(f.rule == "diagram-sanitize" and f.level == "error" for f in findings)


# --- Rule 5: word count ------------------------------------------------------

def test_too_short_text_warns():
    inp = _input([_text_step(content="too short"), _demo_step(), _reflection_step()],
                 spec=_spec(["text", "demo", "reflection"]))
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7)
    assert any(f.rule == "word-count" and f.level == "warn" for f in findings)


# --- Rule 6: prereq DAG ------------------------------------------------------

def test_acyclic_graph_passes():
    edges = [("t/a", "t/b"), ("t/b", "t/c"), ("t/a", "t/c")]
    findings = qa.check_prereq_graph(edges, known_ids={"t/a", "t/b", "t/c"})
    assert findings == []


def test_cycle_detected():
    edges = [("t/a", "t/b"), ("t/b", "t/c"), ("t/c", "t/a")]
    findings = qa.check_prereq_graph(edges, known_ids={"t/a", "t/b", "t/c"})
    assert any(f.rule == "prereq-dag" and "cycle" in f.message for f in findings)


def test_self_edge_detected():
    findings = qa.check_prereq_graph([("t/a", "t/a")], known_ids={"t/a"})
    assert any("self-prerequisite" in f.message for f in findings)


def test_unknown_node_detected():
    findings = qa.check_prereq_graph([("t/a", "t/ghost")], known_ids={"t/a"})
    assert any("unknown lesson" in f.message for f in findings)


# --- Rule 7: spec integrity --------------------------------------------------

def test_bad_track_prefix_is_error():
    spec = _spec(["text", "demo", "reflection"])
    spec["track"] = "wrong-track"  # id prefix no longer matches
    inp = _input([_text_step(), _demo_step(), _reflection_step()], spec=spec)
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7)
    assert any(f.rule == "spec-integrity" and f.level == "error" for f in findings)


# --- Rule 8: framing ---------------------------------------------------------

def test_prohibited_phrase_is_error():
    bad_text = _text_step(content="These solfeggio frequencies achieve DNA repair and are clinically proven. " * 4)
    inp = _input([bad_text, _demo_step(), _reflection_step()],
                 spec=_spec(["text", "demo", "reflection"], track="music-science-crossover", slug="432-solfeggio"),
                 title="The 432 Hz / Solfeggio Claims", sid="music-science-crossover/432-solfeggio")
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7,
                              known_track_slugs={"music-science-crossover"})
    assert any(f.rule == "framing" and f.level == "error" for f in findings)


def test_sensitive_topic_with_honest_framing_no_error():
    honest = _text_step(content=(
        "Solfeggio frequencies are often tied to healing claims. The peer-reviewed "
        "evidence for specific clinical effects is absent; we include them because "
        "they produce a distinct non-octave texture. This is a myth worth naming. " * 3
    ))
    inp = _input([honest, _demo_step(), _reflection_step()],
                 spec=_spec(["text", "demo", "reflection"], track="music-science-crossover", slug="432-solfeggio"),
                 title="The 432 Hz / Solfeggio Claims", sid="music-science-crossover/432-solfeggio")
    findings = qa.check_lesson(inp, available_clip_slugs=set(), manifest_version=7,
                              known_track_slugs={"music-science-crossover"})
    assert not any(f.rule == "framing" and f.level == "error" for f in findings)


# --- Rule 9: difficulty monotonicity ----------------------------------------

def test_intro_behind_advanced_warns():
    diff = {"t/easy": "intro", "t/hard": "advanced"}
    edges = [("t/hard", "t/easy")]  # easy depends on hard
    findings = qa.check_difficulty_monotonicity(diff, edges)
    assert any(f.rule == "difficulty" and f.level == "warn" for f in findings)
