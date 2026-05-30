"""LLM-assisted lesson-spec scaffolding (v6.4).

Given a topic + a short outline, produce a *starting* :class:`LessonSpec` for a
human author to refine. This never publishes anything — it only fills the spec
form so the 10–15 min/lesson authoring step starts from a sensible draft.

Output is validated against the real ``LessonSpec`` pydantic model before being
returned; on invalid output we retry once with the validation errors fed back.
Framing-sensitive topics get the honest-framing directive injected and a
reflection step seeded that surfaces the evidence.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.schemas import LessonSpec
from app.services import framing_lexicon as fl
from app.services.llm import LLMClient

SPEC_PROMPT_VERSION = "v6.4.0"

_VALID_TYPES = ("text", "demo", "prompt", "reflection", "audio-clip")


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:48] or "lesson"


def _strip_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = re.sub(r"\n?```$", "", t)
    return t.strip()


def _parse_json_object(text: str) -> dict[str, Any]:
    body = _strip_fences(text)
    start, end = body.find("{"), body.rfind("}")
    if start != -1 and end != -1 and end > start:
        body = body[start : end + 1]
    return json.loads(body)


def _system(track: str, sensitive: bool) -> str:
    framing = f"\n\n{fl.FRAMING_DIRECTIVE}" if sensitive else ""
    return f"""You are scaffolding a lesson spec for AnnealMusic's "Learn" curriculum — a calm,
honest, ambient-music learning app. Produce a STARTING spec a human author will refine.

The lesson belongs to the track "{track}".

Output ONLY a single JSON object with these fields:
- "title": short lesson title (<=120 chars)
- "objectives": 2–5 short learning objectives (strings)
- "difficulty": one of "intro" | "intermediate" | "advanced"
- "step_outline": an ordered list of 4–7 steps. Each step is an object with:
    - "type": one of "text" | "demo" | "prompt" | "reflection" | "audio-clip"
    - text/reflection steps need "topic" (string)
    - demo steps need "patch_brief" (the target sonic character, string)
    - prompt steps need "task" (string)
    - audio-clip steps need "clip_topic" (what the clip should illustrate, string)
    - a text step MAY add "diagram": "svg" | "mermaid"
- "constraints_during_prompts": control keys the learner may adjust (e.g. ["drift","brightness"])

Rules:
- Start with a "text" step (orient the learner) and end with a "reflection" step.
- Include at least one "demo" or "audio-clip" step so the learner hears the concept.
- Keep it calm and plain-spoken. No hype, no gamification.{framing}

Output the JSON object and nothing else."""


def _seed_outline(sensitive: bool) -> list[dict[str, Any]]:
    base = [
        {"type": "text", "topic": "orient the learner to the concept"},
        {"type": "demo", "patch_brief": "a calm patch that demonstrates the concept"},
        {"type": "prompt", "task": "let the learner try adjusting one parameter"},
        {"type": "reflection", "topic": "what the learner noticed"},
    ]
    if sensitive:
        base.insert(3, {"type": "text", "topic": "the claims and the state of the evidence"})
    return base


def _coerce_spec(
    raw: dict[str, Any], *, topic: str, track: str, difficulty: str | None, sensitive: bool
) -> dict[str, Any]:
    """Fill required fields the LLM may have omitted; never trust it blindly."""
    title = str(raw.get("title") or topic)[:120]
    slug = _slugify(title)
    outline = raw.get("step_outline")
    if not isinstance(outline, list) or not outline:
        outline = _seed_outline(sensitive)
    # Drop malformed steps; keep the per-type required field present.
    clean_steps: list[dict[str, Any]] = []
    for s in outline:
        if not isinstance(s, dict) or s.get("type") not in _VALID_TYPES:
            continue
        clean_steps.append(s)
    if not clean_steps:
        clean_steps = _seed_outline(sensitive)
    objectives = [str(o) for o in (raw.get("objectives") or []) if str(o).strip()][:8]
    if not objectives:
        objectives = [f"Understand {topic}"]
    return {
        "id": f"{track}/{slug}",
        "track": track,
        "title": title,
        "objectives": objectives,
        "difficulty": (difficulty or raw.get("difficulty") or "intro"),
        "prerequisites": [],
        "step_outline": clean_steps,
        "constraints_during_prompts": list(raw.get("constraints_during_prompts") or []),
        "description": (str(raw.get("description"))[:2000] if raw.get("description") else None),
    }


async def generate_spec(
    llm: LLMClient,
    *,
    topic: str,
    track: str,
    outline: str | None = None,
    difficulty: str | None = None,
    model_id: str | None = None,
) -> LessonSpec:
    """Return a validated starting :class:`LessonSpec`. Raises ``ValueError`` on
    a track/topic that cannot be coerced into a valid spec after one retry."""
    sensitive = fl.is_framing_sensitive(topic, outline or "")
    system = _system(track, sensitive)
    user = f"Topic: {topic}"
    if outline:
        user += f"\nOutline: {outline}"

    last_err: list[str] = []
    for attempt in range(2):
        prompt = user
        if attempt and last_err:
            prompt += f"\n\nYour previous output was invalid: {'; '.join(last_err)}. Fix it."
        try:
            text, _p, _o = await llm.generate(system=system, prompt=prompt, model=model_id)
            raw = _parse_json_object(text)
        except (json.JSONDecodeError, Exception):  # noqa: BLE001 - fall back to seed
            raw = {}
        candidate = _coerce_spec(
            raw, topic=topic, track=track, difficulty=difficulty, sensitive=sensitive
        )
        try:
            spec = LessonSpec.model_validate(candidate)
        except Exception as e:  # pydantic ValidationError
            last_err = [str(e)[:200]]
            continue
        # Cross-field rules mirroring lesson_admin._validate_spec.
        errs = _validate_step_fields(spec)
        if errs:
            last_err = errs
            continue
        return spec

    raise ValueError(f"could not scaffold a valid spec: {'; '.join(last_err) or 'unknown'}")


def _validate_step_fields(spec: LessonSpec) -> list[str]:
    errs: list[str] = []
    for i, step in enumerate(spec.step_outline):
        if step.type == "demo" and not step.patch_brief:
            errs.append(f"step {i}: demo requires patch_brief")
        if step.type == "prompt" and not step.task:
            errs.append(f"step {i}: prompt requires task")
        if step.type in ("text", "reflection") and not step.topic:
            errs.append(f"step {i}: {step.type} requires topic")
        if step.type == "audio-clip" and not step.clip_topic:
            errs.append(f"step {i}: audio-clip requires clip_topic")
        if step.diagram and step.type != "text":
            errs.append(f"step {i}: diagram only valid on text steps")
    return errs
