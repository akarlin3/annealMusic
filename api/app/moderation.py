"""Lightweight publish-time screening of patch title/description.

This is the single home for the profanity/spam list (the heuristic-drift rule):
the publish path is its only caller today, and any future submission flow must
reference this module rather than re-declaring a list. No third-party moderation
API in v0.8 — a small static list plus an env-configurable extension
(``MODERATION_EXTRA_TERMS``), and two cheap spam heuristics.

It screens the *text* fields only; the patch payload has its own strict,
manifest-driven validator (``app.validation``). The two never overlap.
"""

from __future__ import annotations

import re
from functools import lru_cache

from app.config import get_settings

# Deliberately small and obvious. Extend in prod via MODERATION_EXTRA_TERMS rather
# than editing this file, so the deploy controls the policy.
_BASE_TERMS: frozenset[str] = frozenset(
    {
        "spam",
        "viagra",
        "casino",
        "porn",
        "fuck",
        "shit",
        "bitch",
        "asshole",
    }
)

# Spam heuristics.
_MAX_URLS = 1
_URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
_REPEAT_RUN_RE = re.compile(r"(.)\1{9,}")  # 10+ of the same char in a row


@lru_cache
def _banned_terms() -> frozenset[str]:
    extra = get_settings().moderation_extra_terms
    extras = {t.strip().lower() for t in extra.split(",") if t.strip()}
    return _BASE_TERMS | frozenset(extras)


def _has_banned_word(text: str) -> bool:
    lowered = text.lower()
    for term in _banned_terms():
        # Word-boundary match limits Scunthorpe-style false positives.
        if re.search(rf"\b{re.escape(term)}\b", lowered):
            return True
    return False


def _looks_spammy(text: str) -> bool:
    if len(_URL_RE.findall(text)) > _MAX_URLS:
        return True
    if _REPEAT_RUN_RE.search(text):
        return True
    return False


def screen_publish(title: str | None, description: str | None) -> str | None:
    """Return the offending field name (``'title'``/``'description'``) when the
    text should be auto-rejected, or ``None`` when it passes."""
    if title and (_has_banned_word(title) or _looks_spammy(title)):
        return "title"
    if description and (_has_banned_word(description) or _looks_spammy(description)):
        return "description"
    return None
