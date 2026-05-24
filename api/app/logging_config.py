from __future__ import annotations

import logging

try:  # pythonjsonlogger>=3 moved the formatter into a submodule
    from pythonjsonlogger.json import JsonFormatter
except ImportError:  # pragma: no cover - older releases
    from pythonjsonlogger.jsonlogger import JsonFormatter  # pyright: ignore[reportPrivateImportUsage]

_configured = False


def configure_logging() -> None:
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(
        JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
