# Lesson Generation (LLM pipeline)

_How AnnealMusic turns an authored lesson **spec** into validated, cached lesson
content — text, demo patches, prompts, reflections, and diagrams._

Introduced in **v6.1**. Builds on the v6.0 lesson foundation (`/learn`, lesson
player) and the v1.7 LLM infrastructure (`LLMClient`, schema-in-prompt,
validate-and-retry).

---

## The idea

You (an admin/curator) author a **spec** — what a lesson should cover, not its
words. Claude fills in the actual content, one LLM call per step. Output is
validated (markdown, schema-valid patches, sanitized SVG, lintable mermaid) and
cached immutably, so the whole curriculum costs ~$1–2 to generate once and serves
forever from cache.

```
spec  ──►  per-step generation  ──►  validate  ──►  persist  ──►  lesson 'ready'
            (cache hit short-circuits the LLM call)
```

## Authoring a spec

See **[CURRICULUM_AUTHORING.md](./CURRICULUM_AUTHORING.md)** for the full field
guide. In brief, POST a spec to `/api/v1/admin/lessons/generate` (admin-gated via
`x-admin-key`):

```json
{
  "id": "synthesis-fundamentals/karplus-strong",
  "track": "synthesis-fundamentals",
  "title": "How the String Engine Works",
  "objectives": ["Understand Karplus-Strong", "Hear damping"],
  "difficulty": "intro",
  "prerequisites": ["synthesis-fundamentals/intro"],
  "step_outline": [
    { "type": "text", "topic": "What physical modeling is", "diagram": "svg" },
    { "type": "demo", "patch_brief": "A bright Karplus pluck, brightness high" },
    { "type": "prompt", "task": "Try adjusting damping while listening" },
    { "type": "reflection", "topic": "the effect of damping" }
  ],
  "constraints_during_prompts": ["damping", "brightness"]
}
```

The lesson `id` must be `"{track_slug}/{lesson_slug}"`, and `track` must already
exist. `demo` steps require `patch_brief`; `prompt` steps require `task`;
`text`/`reflection` require `topic`; `diagram` (`svg`|`mermaid`) is valid only on
`text` steps.

## What each step type produces

| Step | LLM output | Validation |
| --- | --- | --- |
| `text` | Markdown body (200–400 words) + optional diagram | markdown lint (no h1, no raw HTML, word budget) |
| `demo` | One JSON patch | clamp + `validate_payload` against the schema manifest (v1.7) |
| `prompt` | `{prompt, hint}` | JSON shape, length, references allowed controls |
| `reflection` | `{prompt}` | open question ending in `?` |
| `svg` (sub-step) | inline `<svg>` | allowlist sanitizer (`svg_sanitizer.py`) |
| `mermaid` (sub-step) | mermaid source | server-side lint + client-side compile |

Each step has up to **2 retries** with the validation errors fed back to the
model (same pattern as v1.7 patch generation). If a step still fails, the lesson
is marked `generation_failed` with the error and the admin can fix the spec or
hand-author that step.

## Diagrams & safety

- **SVG** is sanitized deny-by-default: allowlisted elements/attributes only;
  `<script>`, `<image>`, `<foreignObject>`, external `href`/`url()`, `on*`
  handlers, and `DOCTYPE`/`ENTITY` are hard-rejected (no silent stripping →
  retry). viewBox is capped at 800×400. Warm-amber monochrome palette. The
  client re-checks on render as defence-in-depth.
- **Mermaid** is validated server-side with a lightweight lint (allowlisted
  diagram types: `flowchart`, `graph`, `sequenceDiagram`, `stateDiagram-v2`;
  injection guards). The full compile happens client-side in the player. _A
  headless-Node compile was deferred_ — generation is offline/cached, the lint
  catches the failure modes that matter, and it keeps Node off the API image.

## Caching

Cache key (per **step**):

```
sha256(prompt_version | schema_version | spec_id | step_index | step_type | model_id | diagram)
```

> The brief's per-lesson formula collides across steps (generation is one call
> per step), so `step_index`/`step_type`/`diagram` disambiguate. Whole-lesson
> identity is still fixed by `(spec_id, prompt_version, schema_version, model)`.

- Cache rows live in `ai_generations` (`cache_key` unique, `lesson_step_id`
  backref, `kind = lesson-{type}`). Lesson-generation rows have `user_id = NULL`.
- **Immutable per key.** A cache hit reuses the stored output, re-points the
  step at the existing generation, and spends **nothing** (no quota, no cost).
- A **prompt-version bump** invalidates the cache for _new_ generations only;
  already-generated lessons keep serving their old content.

## Prompt versions

`LESSON_PROMPT_VERSION` lives in `api/app/services/lesson_generation.py` and is
stamped onto every generated step (`lesson_steps.prompt_version`).

| Version | Date | Notes |
| --- | --- | --- |
| `v6.1.0` | 2026-05 | Initial release. Six system prompts (text, demo, prompt, reflection, svg, mermaid) sharing a common warm/precise preamble. Few-shot examples in `api/data/lesson_examples.json` (4 text, 5 demo, 3 prompt, 3 reflection, 3 svg, 3 mermaid). |

**Bump the version** whenever you edit a system prompt _or_ the few-shot
examples — both change generated output and must invalidate the cache for new
runs. Document the change in the table above.

## Cost

Per Haiku-class pricing (`estimate_haiku_cost`, logged to
`ai_generations.cost_estimate_usd`):

| Step | ≈ cost |
| --- | --- |
| text | $0.002 |
| demo | $0.003 |
| svg / mermaid | $0.004 |
| prompt / reflection | $0.001 |

A typical 6-step lesson is **$0.01–0.02** once; the full ~100-lesson curriculum
is **~$1–2 total**. A soft monthly ceiling
(`lesson_gen_monthly_budget_usd`, default `$10`) refuses fresh generation once
trailing-30-day lesson spend exceeds it. Cost scales with **curriculum size, not
user count** — that's the whole point of caching.

## Manual override

Any step can be overridden: `PUT /api/v1/admin/lesson-steps/{id}/override` stores
`manual_override_content`, which wins over the generated config everywhere the
step is served. Overridden steps are **never regenerated**, so re-running a lesson
preserves hand-fixes. Demo overrides are re-validated against the schema. Clear
with `DELETE .../override`.

## Manual smoke (requires an API key)

Real-LLM iteration and the 3-lesson cross-track smoke from the plan need
`ANTHROPIC_API_KEY` set on the API. With a key configured, author three specs
across different tracks, POST them to `/admin/lessons/generate`, and review the
generated steps in the admin status dashboard. (The automated test-suite uses a
`MockLLMClient`, so it runs without a key.)
