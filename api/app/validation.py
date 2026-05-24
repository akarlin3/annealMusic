"""Strict validation of a saved patch payload against the generated schema
manifest (``schema/manifest.v<N>.json``).

The client's ``decodeState`` is deliberately *lenient* — it clamps out-of-range
values and drops unknown keys so old share links keep loading. Saving is a
write, not a tolerant read, so this validator is the opposite: it **rejects**
anything that isn't exactly in-schema, returning every problem at once.

The manifest is the single source of truth, generated from the TypeScript
definitions; a CI contract test fails the build if it drifts.
"""

from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_MANIFEST_DIR = Path(__file__).resolve().parents[2] / "schema"

_LOOP_KEY_RE = re.compile(r"^L([A-Za-z])\.(.+)$")
_NS_KEY_RE = re.compile(r"^([A-Za-z0-9]+)\.(.+)$")


@lru_cache
def load_manifest(version: int | None = None) -> dict[str, Any]:
    """Load the manifest for ``version`` (defaults to the newest on disk)."""
    if version is None:
        candidates = sorted(_MANIFEST_DIR.glob("manifest.v*.json"))
        if not candidates:
            raise FileNotFoundError("no schema manifest found")
        path = candidates[-1]
    else:
        path = _MANIFEST_DIR / f"manifest.v{version}.json"
    return json.loads(path.read_text())


def _num_in_bounds(raw: str, bound: dict[str, Any], label: str, errors: list[str]) -> None:
    try:
        value = float(raw)
    except (ValueError, TypeError):
        errors.append(f"{label}: non-numeric value '{raw}'")
        return
    if not math.isfinite(value):
        errors.append(f"{label}: non-finite value '{raw}'")
        return
    if value < bound["min"] or value > bound["max"]:
        errors.append(
            f"{label}: {value} out of range [{bound['min']}, {bound['max']}]"
        )


def validate_payload(payload: str, version: int) -> list[str]:
    """Return a list of validation errors (empty == valid)."""
    manifest = load_manifest()
    errors: list[str] = []

    if version not in manifest["supportedVersions"]:
        errors.append(f"unsupported schema version {version}")
        return errors
    if len(payload) > manifest["maxPayloadChars"]:
        errors.append(
            f"payload too long ({len(payload)} > {manifest['maxPayloadChars']})"
        )
        return errors

    shared = manifest["sharedKeys"]
    engines = manifest["engines"]
    session = manifest["session"]
    loop = manifest["loop"]

    seen: set[str] = set()

    for pair in payload.split("&"):
        if pair == "":
            continue
        if "=" not in pair:
            errors.append(f"malformed pair (no '='): {pair}")
            continue
        key, _, raw = pair.partition("=")

        if key in seen:
            errors.append(f"duplicate key: {key}")
            continue
        seen.add(key)

        # Session mode.
        if key == "m":
            if raw not in session["modes"]:
                errors.append(f"unknown mode '{raw}'")
            continue
        if key == "arc":
            if raw not in session["arcIds"]:
                errors.append(f"unknown arc '{raw}'")
            continue
        if key == "dur":
            _num_in_bounds(raw, {**session["duration"]}, "dur", errors)
            continue

        # Engine selector.
        if key == "e":
            if raw not in engines:
                errors.append(f"unknown engine '{raw}'")
            continue

        # Loop slot config: L<id>.<field>.
        loop_match = _LOOP_KEY_RE.match(key)
        if loop_match:
            slot_id, field = loop_match.group(1), loop_match.group(2)
            if slot_id not in loop["slotIds"]:
                errors.append(f"unknown loop slot: {key}")
            elif field in loop["flags"]:
                if raw not in ("0", "1"):
                    errors.append(f"{key}: flag must be 0 or 1, got '{raw}'")
            elif field in loop["grainFields"]:
                _num_in_bounds(raw, loop["grainFields"][field], key, errors)
            else:
                errors.append(f"unknown loop field: {key}")
            continue

        # Namespaced engine param: <engine>.<param>.
        ns_match = _NS_KEY_RE.match(key)
        if ns_match:
            ns, param = ns_match.group(1), ns_match.group(2)
            if ns not in engines:
                errors.append(f"unknown engine namespace: {key}")
            elif param not in engines[ns]:
                errors.append(f"unknown engine param: {key}")
            else:
                _num_in_bounds(raw, engines[ns][param], key, errors)
            continue

        # Shared param.
        if key not in shared:
            errors.append(f"unknown key: {key}")
            continue
        _num_in_bounds(raw, shared[key], key, errors)

    return errors
