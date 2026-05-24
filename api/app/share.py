"""Small server-side reads of the URL share payload.

These mirror the client helpers in ``src/share/hydrate.ts`` so the preview
renderer hydrates captures in the same slot order the client uses on load.
Slot ids come from the generated manifest (single source of truth).
"""

from __future__ import annotations

from app.validation import load_manifest


def capture_slots_from_payload(payload: str) -> list[str]:
    """Slots flagged ``L<id>.cap=1`` in slot order — matches ``capture_refs``."""
    slot_ids = load_manifest()["loop"]["slotIds"]
    return [sid for sid in slot_ids if f"L{sid}.cap=1" in payload]


def parse_engine(payload: str) -> str:
    for pair in payload.split("&"):
        if pair.startswith("e="):
            return pair[2:]
    return "sine"


def parse_mode(payload: str) -> str:
    for pair in payload.split("&"):
        if pair.startswith("m="):
            return pair[2:]
    return "open"
