from __future__ import annotations

import secrets

# URL-safe, unambiguous alphabet (no 0/O/1/l/I).
_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
_SLUG_LEN = 8


def new_slug() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(_SLUG_LEN))
