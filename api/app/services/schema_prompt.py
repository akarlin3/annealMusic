from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.validation import load_manifest


def get_schema_for_prompt() -> str:
    """Load the manifest and return a clean, token-efficient JSON string

    specifically tailored for prompt injection.
    """
    manifest = load_manifest()
    return json.dumps(
        {
            "schemaVersion": manifest.get("schemaVersion"),
            "sharedKeys": manifest.get("sharedKeys"),
            "engineOrder": manifest.get("engineOrder"),
            "engines": manifest.get("engines"),
            "session": manifest.get("session"),
            "loop": {
                "slotIds": manifest.get("loop", {}).get("slotIds"),
                "flags": manifest.get("loop", {}).get("flags"),
                "grainFields": manifest.get("loop", {}).get("grainFields"),
            },
        },
        indent=2,
    )


def load_few_shot_examples() -> list[dict[str, Any]]:
    """Load handcrafted prompt-patch examples from the data folder."""
    path = Path(__file__).resolve().parents[2] / "data" / "ai_examples.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []
