# AnnealMusic v6 Education Arc Retrospective

This retrospective closes the **v6 Education Arc** (v6.0 → v6.5). Over this cycle
AnnealMusic grew a full, LLM-generated curriculum and learning surface (`/learn`)
on top of the v5 research instrument — and, in v6.5, the admin analytics and
in-app discoverability that let the curriculum be iterated and found. It is
written at the close of v6.5; the honest verdict on pedagogical effectiveness
will only sharpen after a few months of production use.

---

## 1. The Original v6 Thesis

The v6 thesis was that **a calm generative-music instrument can teach the very
concepts it embodies — synthesis, composition, acoustics, and listening — using
LLM-generated lessons, without becoming an engagement product.**

Four design bets defined the arc:

1. **LLM-generated lessons.** Rather than hand-authoring dozens of multi-step
   lessons, an LLM (Claude Haiku) would generate per-step prose, demo patches,
   prompts, and diagrams from a compact authored **spec**, cached immutably by
   spec hash.
2. **Hybrid generation + personalization.** Content is generated once and cached;
   _personalization_ (which lesson next, paced to the learner) is a separate,
   lightweight LLM call over aggregate progress metadata — never a regeneration
   of content per user.
3. **Curated topology with LLM next-lesson selection.** The prerequisite graph is
   human-curated and acyclic; the LLM only ranks _within_ the deterministically
   filtered candidate set, so it can never send a learner somewhere ungated or
   nonsensical.
4. **AnnealMusic-paid.** Generation cost is borne by AnnealMusic, not the learner;
   the curriculum is free, with no certificates, paywalls, or upsell.

Underpinning all four: **calm-by-design carries into education.** No streaks, no
scores, no levels, no completion percentages-as-pressure, no outbound nudges.
A learning surface is exactly where a calm product is most tempted to grow a
habit loop, and the arc treated that as the primary risk throughout.

---

## 2. What Got Built (v6.0 – v6.5)

| Version  | Slice                      | Shipped                                                                                                                                                                                                                                                                                           |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v6.0** | Education surface + player | The `/learn` route as a decoupled bundle (<51 KB gzipped), the split-pane lesson player embedding the live instrument in a same-origin iframe over a JSON-RPC postMessage bridge, parameter-sandbox constraints, and five step types (text, demo, prompt, reflection — audio-clip lands in v6.2). |
| **v6.1** | LLM lesson generation      | Per-step generation pipeline with six system prompts + a few-shot library, SVG/mermaid sanitization, schema-valid demo patches, immutable per-step caching keyed by spec hash, manual per-step override, a monthly budget ceiling, and the admin generation console.                              |
| **v6.2** | Audio-clip library         | The `audio_clips` data model, the `audio-clip` step type, embedding + tag + track-affinity retrieval, the admin clip manager, and a hard license CI gate (every clip carries one of four license kinds).                                                                                          |
| **v6.3** | Progress + recommendations | The private, per-account `lesson_progress` table, cross-device pause/resume (with an anon→authed max-merge import), the two-stage next-lesson picker (deterministic filter → Haiku ranking), the onboarding picker, and `progress_state.py` as the single source of truth for effective state.    |
| **v6.4** | Curriculum content         | Five tracks, **55 authored lessons**, the curated prerequisite DAG, the authoring tooling (spec generator, batch generation, review dashboard, prerequisite-graph editor), and a nine-rule quality-check pipeline including automated framing compliance.                                         |
| **v6.5** | Closeout                   | Admin-only lesson analytics (aggregate, anonymized), in-app discoverability hints (the `LessonHintLink` primitive on engines / modes / controls + a first-time banner) with a global opt-out, this retrospective, and the release.                                                                |

---

## 3. LLM-Generation Cost: Reality vs Forecast

The v6.1 forecast was that whole-curriculum generation would land near **$1–$2**
on Haiku, dominated by the _first_ generation of each step, with re-runs of
unchanged specs free via the spec-hash cache.

That held. The 55-lesson curriculum (~6.5 LLM calls/lesson including diagram
sub-steps) generated for **≈ $0.80–$1.20** including review-driven regeneration,
because:

- **The cache did the heavy lifting.** Immutable keying by
  `(prompt_ver, schema_ver, spec_id, step_idx, type, model)` meant batch re-runs
  during review were almost entirely cache hits. The real cost was concentrated
  in the first pass and in steps whose specs actually changed.
- **Haiku was sufficient.** The few-shot library + deterministic spec format
  carried most of the quality; a larger model was never needed for the per-step
  body, only good prompts and good examples.

The honest caveat: **the dominant cost of the arc was never tokens — it was
human authoring and review time.** Specs are cheap to generate but must be
edited; the per-lesson human loop (author → generate → review → refine) is where
the hours went. The cost model was right about money and quiet about labor.

---

## 4. Pedagogical Effectiveness — Honest Assessment (Known So Far)

v6.5 ships before there is meaningful production usage, so this section is
deliberately provisional — and the admin analytics built in v6.5 exist precisely
to answer it later, not to assert an answer now.

What we can say with confidence:

- **The structure is sound.** A learner can walk a track from an ungated intro to
  advanced material without hitting a wall; the DAG guarantees prerequisites are
  reachable and depth stays ≤5.
- **"Hear it" is the right spine.** Every lesson is required (by QA) to let the
  learner _hear_ something (a demo or a clip) and _reflect_. Early walkthroughs
  suggest the embedded-instrument demos are the strongest moments — reading about
  FM is forgettable; turning the modulation index while it plays is not.

What we genuinely do not yet know:

- **Completion and drop-off at scale.** The drop-off curve, time-on-step
  distribution, and per-clip replay counts are now _measurable_ (v6.5) but not yet
  _measured_ with real cohorts. The honest expectation is that some lessons are
  too long and will show a mid-lesson cliff; the analytics are how we will find
  and fix them, not a claim that they are already well-paced.
- **Whether the picker's "why this next" actually helps.** The rationale is calm
  and non-coercive by construction, but whether learners trust and follow it
  (vs. browsing freely) is an open question the path-popularity analytics will
  start to answer.

---

## 5. Honest Framing — Did the LLM Honor the Discipline?

A central worry of the arc was that an LLM asked to write _engaging_ lessons
about acoustically-charged topics (432 Hz, solfeggio, binaural beats,
entrainment, "healing frequencies") would drift into pseudo-scientific
overclaim — exactly what `docs/FRAMING.md` and calm-by-design forbid.

What worked:

- **Automating framing rather than eyeballing it.** The framing lexicon lives
  _once_ (`framing_lexicon.py`) and is shared by the spec generator (which
  injects the honest-framing directive for sensitive topics), the QA pipeline
  (which asserts the copy carries hedging language and contains no prohibited
  claim phrases), and CI. The `432-solfeggio` lesson is _required_ to state the
  clinical evidence is absent. This turned framing from a hope into a gate.
- **With the directive, Haiku was disciplined.** When the system prompt carried
  the framing directive, generated copy reliably described these topics as
  cultural / aesthetic / historical phenomena and declined to assert physiological
  effects.

Where it drifted (and was caught):

- **Without the directive, it drifted toward warmth that reads as endorsement.**
  Early generations of adjacent (non-flagged) lessons occasionally used softly
  affirming language ("many people find…") that edges toward implied efficacy.
  The lexicon's trigger set was widened so these adjacent lessons also get the
  directive — the drift was real, the automated gate is what surfaced it.
- **Enthusiasm creep in prompts.** The LLM's instinct is to motivate
  ("Keep going! You're doing great!"). That is calm-by-design poison. It was
  suppressed by explicit anti-motivational instructions in the system prompts and
  the calm-by-design CI lexical gate over `src/learn`, but it is a standing tension:
  the model wants to be a coach, and the product refuses to be one.

The lesson: **framing discipline survives only when it is mechanized.** A human
reviewer will miss drift across 55 lessons; a shared lexicon + a QA rule + a CI
gate will not.

---

## 6. What Didn't Work, or Was Harder Than Expected

- **The iframe bridge is powerful but fiddly.** Embedding the live instrument in
  the lesson player (rather than reimplementing audio) was the right call — it is
  what makes demos visceral — but the postMessage/JSON-RPC bridge, the
  parameter-sandbox constraints, and engine suspension during audio-clip playback
  were each more subtle than anticipated, especially around lifecycle (suspend
  only what _we_ suspended; release constraints on every navigation).
- **Authoring throughput, not generation, was the bottleneck.** As noted in §3,
  the spec→review loop is human time. The tooling (batch generation, review
  dashboard) helped, but 55 lessons is genuinely a lot of editorial work, and it
  is the part that does not parallelize cheaply.
- **The SQLite-tested / Postgres-production split.** Materialized views, JSONB
  operators, and `REFRESH … CONCURRENTLY` are Postgres-only, while the test
  harness runs SQLite without migrations. v6.5 resolved this by computing
  analytics live with portable queries and treating the materialized view as a
  production performance / external-BI artifact — but it is a reminder that the
  two-dialect setup quietly constrains what can live in a migration.
- **Calm-by-design is a continuous fight on a learning surface.** Every slice had
  a plausible "small" feature that would have added a habit loop — a streak, a
  completion %, a "you're 80% through this track!". Saying no repeatedly, and
  encoding the no in a CI lexical gate, was real ongoing work rather than a
  one-time decision.

---

## 7. Post-v6 Thesis Space

With education shipped, the remaining theses from the original ranking are:

- **Thesis A — Instrument company (hardware integration).** Eurorack, MIDI 2.0,
  high-fidelity MPE; bridging the software instrument to physical controllers.
- **Thesis C — Performance platform.** Real-time shared streaming + listening
  rooms where ambient soundscapes are sculpted collectively.
- **Thesis E — Platform (user-uploaded engines).** Letting users contribute their
  own synthesis engines — the largest scope-and-trust expansion.
- **Thesis F — Concert recording label.** A curated publishing surface for
  finished pieces.

And the perennial v5+ candidate:

- **AnnealMusic at scale.** Distribution, partnerships, growth, app-store
  optimization, and — newly credible now that a real curriculum exists — school
  district / institutional outreach.

There is also an honest fifth option: **maintenance as thesis.** After six
versions the product spans synthesis, composition, drone, research, and now
education. Deepening and stewarding what exists — rather than opening a seventh
surface — may itself be the most valuable v7.

The v6 deferred list also flags interesting near-adjacencies that were
_intentionally not built_: A/B testing of lesson variants, author-facing "was
this helpful?" widgets (engagement-loop adjacent — design discipline required),
and an LLM that analyzes the new aggregate analytics to _suggest_ curriculum
improvements (a genuinely interesting v7 direction). Per-user analytics for the
learner themselves, and user lesson-ratings, remain on the permanent **never**
list — they are in direct tension with calm-by-design.

---

## 8. Closing

The v6 arc set out to prove that a calm instrument could teach itself —
generatively, affordably, and without becoming a Skinner box. The generation was
affordable, the topology held, the framing discipline survived because it was
mechanized, and the calm line held because it was CI-enforced. What remains
genuinely open — does it _teach well?_ — is now, for the first time,
**measurable** rather than merely hoped for. That is the right place for the arc
to close: not with a claim of pedagogical victory, but with the instruments in
place to earn or disprove one.
