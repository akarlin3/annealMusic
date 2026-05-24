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


def forbidden() -> ApiError:
    return ApiError(403, "forbidden")


def invalid_state(errors: list[str]) -> ApiError:
    return ApiError(422, "invalid_state", errors=errors)


def bad_request(message: str) -> ApiError:
    return ApiError(400, "bad_request", message=message)
