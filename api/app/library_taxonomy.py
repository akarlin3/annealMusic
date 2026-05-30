"""v4.5 editorial taxonomy — the single source of valid library vocabulary on
the server. Mirrored on the client in ``src/library/taxonomy.ts``; a drift test
keeps the two in sync. Adding a value here is a one-line change, no migration."""
from __future__ import annotations

# Length buckets (reuse the listening-session ``length_category`` vocabulary).
LENGTH_CATEGORIES: frozenset[str] = frozenset(
    {"short", "medium", "long", "extended"}
)

# Editorial intentions.
INTENTIONS: frozenset[str] = frozenset(
    {
        "morning",
        "evening",
        "sleep",
        "difficult_day",
        "focus",
        "open_practice",
        "closing_the_week",
    }
)

# Audio-character tags (multi-select).
CHARACTER_TAGS: frozenset[str] = frozenset(
    {
        "drone",
        "composed",
        "spoken_word_free",
        "with_bells",
        "with_tunings",
    }
)


def validate_taxonomy(
    intention: str | None,
    length_category: str | None,
    character_tags: list[str] | None,
) -> str | None:
    """Return an error message if any value is outside the vocabulary, else None."""
    if intention is not None and intention not in INTENTIONS:
        return f"Unknown intention: {intention!r}"
    if length_category is not None and length_category not in LENGTH_CATEGORIES:
        return f"Unknown length_category: {length_category!r}"
    if character_tags:
        for tag in character_tags:
            if tag not in CHARACTER_TAGS:
                return f"Unknown character tag: {tag!r}"
    return None
