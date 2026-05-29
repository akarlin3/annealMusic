from __future__ import annotations

from fastapi import HTTPException


class ApiError(HTTPException):
    """An HTTPException whose body is a typed `{ "error": <code>, ... }`."""

    def __init__(self, status_code: int, code: str, **extra: object) -> None:
        super().__init__(status_code=status_code, detail={"error": code, **extra})


def quota_exceeded(resource: str, limit: int) -> ApiError:
    return ApiError(409, "quota_exceeded", resource=resource, limit=limit)


def file_too_large() -> ApiError:
    return ApiError(413, "file_too_large")


def rate_limited() -> ApiError:
    return ApiError(429, "rate_limited")


def not_found(resource: str = "resource") -> ApiError:
    return ApiError(404, "not_found", resource=resource)


def forbidden(message: str | None = None) -> ApiError:
    if message:
        return ApiError(403, "forbidden", message=message)
    return ApiError(403, "forbidden")


def invalid_state(errors: list[str]) -> ApiError:
    return ApiError(422, "invalid_state", errors=errors)


def bad_request(message: str) -> ApiError:
    return ApiError(400, "bad_request", message=message)


def unauthorized() -> ApiError:
    return ApiError(401, "unauthorized")


def content_rejected(field: str) -> ApiError:
    return ApiError(422, "content_rejected", field=field)


def under_review() -> ApiError:
    return ApiError(403, "under_review")


def invalid_audio(message: str) -> ApiError:
    return ApiError(422, "invalid_audio", message=message)


def requires_source_consent() -> ApiError:
    return ApiError(409, "requires_source_consent")

