"""Curriculum quality-check pipeline (v6.4).

Pure, network-free linting over generated lessons and the prerequisite graph.
Each rule returns :class:`QAFinding` objects; ``error`` findings block publish,
``warn`` findings are advisory. The same functions back the admin review badge,
the prerequisite-graph editor's cycle guard, and CI.

Rule set (see ``docs/v6.4-PLAN.md`` §4):

1. step-type coverage      (error)
2. audio clips exist       (error)
3. patch demos validate    (error)
4. svg/mermaid sanitize    (error)
5. word-count sanity       (warn)
6. prereqs form a DAG      (error)   -- graph-level, see ``check_prereq_graph``
7. spec / id integrity     (error)
8. framing compliance      (warn)
9. difficulty monotonicity (warn)    -- graph-level, see ``check_difficulty_monotonicity``
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.services import framing_lexicon as fl

# --- Result type -------------------------------------------------------------


@dataclass(frozen=True)
class QAFinding:
    rule: str
    level: str  # 'error' | 'warn'
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"rule": self.rule, "level": self.level, "message": self.message}


@dataclass
class LessonQAInput:
    """Everything a single-lesson QA pass needs, as plain data."""

    id: str  # spec id, "track/slug"
    title: str
    difficulty: str
    spec: dict[str, Any] | None
    # ordered steps: each {"type": str, "config": dict, "override": dict|None}
    steps: list[dict[str, Any]] = field(default_factory=list)


# Word-count bands per step type: (field, min_words, max_words).
_WORD_BANDS: dict[str, tuple[str, int, int]] = {
    "text": ("content", 60, 400),
    "reflection": ("prompt", 3, 60),
    "prompt": ("prompt", 3, 60),
    "demo": ("description", 2, 80),
    "audio-clip": ("intro_text", 3, 90),
}

_VALID_DIFFICULTY = ("intro", "intermediate", "advanced")


# --- Helpers -----------------------------------------------------------------


def effective_config(step: dict[str, Any]) -> dict[str, Any]:
    """Manual override wins over generated config (matches serving behavior)."""
    override = step.get("override")
    if override:
        return override
    return step.get("config") or {}


def _words(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def _all_text(config: dict[str, Any]) -> str:
    """Flatten the human-visible strings in a step config (for framing scan)."""
    out: list[str] = []

    def walk(v: Any) -> None:
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, dict):
            for vv in v.values():
                walk(vv)
        elif isinstance(v, (list, tuple)):
            for vv in v:
                walk(vv)

    walk(config)
    return " ".join(out)


# --- Single-lesson rules -----------------------------------------------------


def _rule_step_coverage(inp: LessonQAInput) -> list[QAFinding]:
    out: list[QAFinding] = []
    actual = [s.get("type") for s in inp.steps]
    if not actual:
        return [QAFinding("step-coverage", "error", "lesson has no steps")]
    # Declared types from spec must all be present.
    if inp.spec:
        declared = [s.get("type") for s in (inp.spec.get("step_outline") or [])]
        missing = [t for t in set(declared) if t and t not in actual]
        if missing:
            out.append(QAFinding(
                "step-coverage", "error",
                f"spec declares step types not present in output: {sorted(missing)}",
            ))
    # Every lesson must let you *hear* something and *reflect*.
    if not ({"demo", "audio-clip"} & set(actual)):
        out.append(QAFinding(
            "step-coverage", "error",
            "lesson has no 'demo' or 'audio-clip' step — nothing to hear",
        ))
    if "reflection" not in actual:
        out.append(QAFinding(
            "step-coverage", "warn",
            "lesson has no 'reflection' step",
        ))
    return out


def _rule_audio_clips_exist(inp: LessonQAInput, available: set[str]) -> list[QAFinding]:
    out: list[QAFinding] = []
    for i, step in enumerate(inp.steps):
        if step.get("type") != "audio-clip":
            continue
        cfg = effective_config(step)
        slug = cfg.get("clip_id") or cfg.get("clip_slug")
        if not slug:
            out.append(QAFinding("audio-clips", "error", f"step {i}: audio-clip has no clip_id"))
        elif slug not in available:
            out.append(QAFinding(
                "audio-clips", "error",
                f"step {i}: clip '{slug}' is missing or archived — author it or pick another",
            ))
    return out


def _rule_demos_validate(inp: LessonQAInput, manifest_version: int) -> list[QAFinding]:
    out: list[QAFinding] = []
    for i, step in enumerate(inp.steps):
        if step.get("type") != "demo":
            continue
        cfg = effective_config(step)
        payload = cfg.get("payload")
        if not payload and isinstance(cfg.get("patch"), dict):
            payload = "&".join(f"{k}={v}" for k, v in cfg["patch"].items())
        if not payload:
            out.append(QAFinding("demo-validate", "error", f"step {i}: demo has no patch/payload"))
            continue
        try:
            from app.validation import validate_payload
            errs = validate_payload(payload, manifest_version)
        except Exception as e:  # pragma: no cover - defensive
            errs = [str(e)]
        if errs:
            out.append(QAFinding(
                "demo-validate", "error",
                f"step {i}: demo patch invalid: {'; '.join(errs[:3])}",
            ))
    return out


def _rule_diagrams_sanitize(inp: LessonQAInput) -> list[QAFinding]:
    out: list[QAFinding] = []
    for i, step in enumerate(inp.steps):
        cfg = effective_config(step)
        diagram = cfg.get("diagram")
        if not isinstance(diagram, dict):
            continue
        kind, source = diagram.get("kind"), diagram.get("source") or ""
        if kind == "svg":
            from app.services.svg_sanitizer import sanitize_svg
            ok, errs, _ = sanitize_svg(source)
        elif kind == "mermaid":
            from app.services.lesson_generation import validate_mermaid
            ok, errs, _ = validate_mermaid(source)
        else:
            ok, errs = False, [f"unknown diagram kind '{kind}'"]
        if not ok:
            out.append(QAFinding(
                "diagram-sanitize", "error",
                f"step {i}: {kind} diagram rejected: {'; '.join(errs[:2])}",
            ))
    return out


def _rule_word_count(inp: LessonQAInput) -> list[QAFinding]:
    out: list[QAFinding] = []
    for i, step in enumerate(inp.steps):
        band = _WORD_BANDS.get(step.get("type", ""))
        if not band:
            continue
        field_name, lo, hi = band
        cfg = effective_config(step)
        n = _words(str(cfg.get(field_name, "")))
        if n < lo:
            out.append(QAFinding("word-count", "warn", f"step {i} ({step['type']}): too short ({n} words, want ≥{lo})"))
        elif n > hi:
            out.append(QAFinding("word-count", "warn", f"step {i} ({step['type']}): too long ({n} words, want ≤{hi})"))
    return out


def _rule_spec_integrity(inp: LessonQAInput, known_track_slugs: set[str] | None) -> list[QAFinding]:
    out: list[QAFinding] = []
    spec = inp.spec
    if not spec:
        return out  # hand-seeded lessons are exempt
    sid = spec.get("id", "")
    if "/" not in sid:
        out.append(QAFinding("spec-integrity", "error", "spec id must be 'track/slug'"))
    else:
        track_part = sid.split("/", 1)[0]
        if track_part != spec.get("track"):
            out.append(QAFinding("spec-integrity", "error", "spec id prefix must equal 'track'"))
        if known_track_slugs is not None and track_part not in known_track_slugs:
            out.append(QAFinding("spec-integrity", "error", f"unknown track '{track_part}'"))
    if spec.get("difficulty") not in _VALID_DIFFICULTY:
        out.append(QAFinding("spec-integrity", "error", f"invalid difficulty '{spec.get('difficulty')}'"))
    objectives = spec.get("objectives") or []
    if not (1 <= len(objectives) <= 8):
        out.append(QAFinding("spec-integrity", "error", f"objectives must number 1–8 (got {len(objectives)})"))
    return out


def _rule_framing(inp: LessonQAInput) -> list[QAFinding]:
    out: list[QAFinding] = []
    # Gather the lesson's intent text for sensitivity detection.
    intent_parts = [inp.title]
    if inp.spec:
        intent_parts += inp.spec.get("objectives") or []
        intent_parts += [s.get("topic") or s.get("task") or s.get("patch_brief") or ""
                         for s in (inp.spec.get("step_outline") or [])]
    body = " ".join(_all_text(effective_config(s)) for s in inp.steps)
    sensitive = fl.is_framing_sensitive(" ".join(intent_parts), body)

    # Prohibited phrases are never allowed, sensitive or not.
    bad = fl.find_prohibited_phrases(body)
    if bad:
        out.append(QAFinding("framing", "error", f"prohibited claim phrase(s): {bad}"))

    if sensitive:
        if not fl.has_honest_framing(body):
            out.append(QAFinding(
                "framing", "warn",
                "framing-sensitive topic but copy names no evidence/uncertainty — "
                "honor docs/FRAMING.md",
            ))
        # The dedicated debunk lesson must state the evidence is absent.
        if "432" in (inp.id or "") or "solfeggio" in (inp.id or ""):
            low = body.lower()
            if not (("evidence" in low) and any(w in low for w in ("absent", "lack", "not ", "unsupported", "no "))):
                out.append(QAFinding(
                    "framing", "warn",
                    "432/solfeggio lesson should explicitly state the clinical evidence is absent",
                ))
    return out


def check_lesson(
    inp: LessonQAInput,
    *,
    available_clip_slugs: set[str],
    manifest_version: int,
    known_track_slugs: set[str] | None = None,
) -> list[QAFinding]:
    """Run all single-lesson rules. Returns findings (possibly empty)."""
    findings: list[QAFinding] = []
    findings += _rule_step_coverage(inp)
    findings += _rule_audio_clips_exist(inp, available_clip_slugs)
    findings += _rule_demos_validate(inp, manifest_version)
    findings += _rule_diagrams_sanitize(inp)
    findings += _rule_word_count(inp)
    findings += _rule_spec_integrity(inp, known_track_slugs)
    findings += _rule_framing(inp)
    return findings


# --- Graph-level rules -------------------------------------------------------


def check_prereq_graph(
    edges: list[tuple[str, str]],
    known_ids: set[str] | None = None,
) -> list[QAFinding]:
    """Rule 6 — the prerequisite graph must be a DAG.

    ``edges`` are ``(prerequisite_id, lesson_id)`` pairs. Returns findings for
    self-edges, unknown ids, and cycles (with the offending cycle path).
    """
    out: list[QAFinding] = []
    adj: dict[str, list[str]] = {}
    for pre, lesson in edges:
        if pre == lesson:
            out.append(QAFinding("prereq-dag", "error", f"self-prerequisite on '{lesson}'"))
            continue
        if known_ids is not None:
            for node in (pre, lesson):
                if node not in known_ids:
                    out.append(QAFinding("prereq-dag", "error", f"edge references unknown lesson '{node}'"))
        adj.setdefault(lesson, []).append(pre)  # lesson depends-on pre
        adj.setdefault(pre, adj.get(pre, []))

    # DFS cycle detection (white/grey/black).
    WHITE, GREY, BLACK = 0, 1, 2
    color: dict[str, int] = {n: WHITE for n in adj}
    stack: list[str] = []
    reported: set[str] = set()

    def dfs(node: str) -> None:
        color[node] = GREY
        stack.append(node)
        for nxt in adj.get(node, []):
            if color.get(nxt, WHITE) == GREY:
                cyc = stack[stack.index(nxt):] + [nxt]
                key = frozenset(cyc)
                if key not in reported:
                    reported.add(key)
                    out.append(QAFinding("prereq-dag", "error", f"cycle: {' → '.join(cyc)}"))
            elif color.get(nxt, WHITE) == WHITE:
                dfs(nxt)
        stack.pop()
        color[node] = BLACK

    for n in list(adj.keys()):
        if color.get(n, WHITE) == WHITE:
            dfs(n)
    return out


def check_difficulty_monotonicity(
    difficulty_by_id: dict[str, str],
    edges: list[tuple[str, str]],
) -> list[QAFinding]:
    """Rule 9 — a lesson should not be easier than its hardest prerequisite."""
    rank = {"intro": 0, "intermediate": 1, "advanced": 2}
    out: list[QAFinding] = []
    for pre, lesson in edges:
        dl = rank.get(difficulty_by_id.get(lesson, "intro"), 0)
        dp = rank.get(difficulty_by_id.get(pre, "intro"), 0)
        if dl < dp:
            out.append(QAFinding(
                "difficulty", "warn",
                f"'{lesson}' ({difficulty_by_id.get(lesson)}) is gated behind harder "
                f"prerequisite '{pre}' ({difficulty_by_id.get(pre)})",
            ))
    return out


def summarize(findings: list[QAFinding]) -> dict[str, Any]:
    """Roll findings into a review badge: pass / warn / fail + counts."""
    errors = [f for f in findings if f.level == "error"]
    warns = [f for f in findings if f.level == "warn"]
    status = "fail" if errors else ("warn" if warns else "pass")
    return {
        "status": status,
        "errors": len(errors),
        "warnings": len(warns),
        "findings": [f.as_dict() for f in findings],
    }
