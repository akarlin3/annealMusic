"""Honest-framing lexicon — defined **once**, shared by the spec generator, the
curriculum QA pipeline, and CI (v6.4).

The single source of truth for which topics touch framing-sensitive territory
(``docs/FRAMING.md``) and which phrases are forbidden anywhere in generated
lesson copy. Keeping this in one module is the heuristic-drift guard the v6.4
brief calls for: the LLM prompt, the linter, and the review badge all read the
same lists.
"""

from __future__ import annotations

import re

# Topics that, when present in a lesson's title/objectives/topics, require the
# honest-framing directive to be injected into generation and asserted by QA.
FRAMING_TRIGGER_TERMS: tuple[str, ...] = (
    "432",
    "solfeggio",
    "528",
    "963",
    "healing frequency",
    "healing frequencies",
    "binaural",
    "entrainment",
    "brainwave",
    "cosmic tuning",
    "miracle tone",
    "chakra",
    "manifestation",
    "vibrational healing",
    "dna repair",
)

# Phrases that must never appear in published lesson copy. Matched
# case-insensitively as substrings/word-boundaries. These are unsupported
# clinical/pseudo-scientific claims per FRAMING.md §1.3 / §3.2.
PROHIBITED_PHRASES: tuple[str, ...] = (
    "dna repair",
    "repairs dna",
    "clinically proven",
    "cure for",
    "cures anxiety",
    "cures depression",
    "medically proven",
    "brainwave entrainment",
    "cellular regeneration",
    "raises your vibration",
    "natural frequency of the universe",
    "cosmic frequency of the universe",
    "guaranteed to heal",
    "scientifically proven to heal",
)

# When a framing-sensitive lesson is generated, the copy is expected to carry at
# least one of these honest hedging signals (evidence is named, not asserted).
HONEST_FRAMING_SIGNALS: tuple[str, ...] = (
    "evidence",
    "not supported",
    "unsupported",
    "no peer-reviewed",
    "not clinically",
    "not well-established",
    "no specific clinical",
    "lack",
    "myth",
    "claim",
)

# The honest-framing directive injected into the spec generator / lesson
# generator system prompt for framing-sensitive topics.
FRAMING_DIRECTIVE = (
    "This topic touches claims about frequencies, tunings, or audio and health "
    "(see docs/FRAMING.md). Be honest and humble: name the claim, then state the "
    "state of the evidence plainly. AnnealMusic supports these options because "
    "they produce distinct audible textures, NOT because of any verified clinical "
    "effect. Never use phrases like 'DNA repair', 'clinically proven', "
    "'brainwave entrainment', or 'natural frequency of the universe'. For the "
    "432 Hz / Solfeggio material specifically, state clearly that the peer-reviewed "
    "evidence for specific clinical effects is absent."
)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").lower()


def is_framing_sensitive(*texts: str) -> bool:
    """True if any of the given texts mentions a framing-trigger term."""
    blob = _norm(" ".join(t for t in texts if t))
    return any(term in blob for term in FRAMING_TRIGGER_TERMS)


def find_prohibited_phrases(text: str) -> list[str]:
    """Return the prohibited phrases present in ``text`` (case-insensitive)."""
    blob = _norm(text)
    return [p for p in PROHIBITED_PHRASES if p in blob]


def has_honest_framing(text: str) -> bool:
    """True if the copy carries at least one honest hedging/evidence signal."""
    blob = _norm(text)
    return any(sig in blob for sig in HONEST_FRAMING_SIGNALS)
