from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import CHAR, String, TypeDecorator
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


class GUID(TypeDecorator[uuid.UUID]):
    """Platform-independent UUID: native on Postgres, CHAR(36) elsewhere."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, uuid.UUID):
            value = uuid.UUID(str(value))
        if dialect.name == "postgresql":
            return value
        return str(value)

    def process_result_value(self, value: Any, dialect: Any) -> uuid.UUID | None:
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


class JSONType(TypeDecorator[dict[str, Any]]):
    """JSONB on Postgres, generic JSON elsewhere."""

    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        from sqlalchemy import JSON

        return dialect.type_descriptor(JSON())


class UUIDArray(TypeDecorator[list[uuid.UUID]]):
    """UUID[] on Postgres; JSON-encoded list of strings elsewhere."""

    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(PG_UUID(as_uuid=True)))
        return dialect.type_descriptor(String())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return [] if dialect.name == "postgresql" else "[]"
        ids = [v if isinstance(v, uuid.UUID) else uuid.UUID(str(v)) for v in value]
        if dialect.name == "postgresql":
            return ids
        return json.dumps([str(v) for v in ids])

    def process_result_value(self, value: Any, dialect: Any) -> list[uuid.UUID]:
        if value is None:
            return []
        if dialect.name == "postgresql":
            return list(value)
        return [uuid.UUID(v) for v in json.loads(value)]


class VectorType(TypeDecorator[list[float]]):
    """pgvector Vector on Postgres; JSON-encoded list of floats elsewhere."""

    impl = String
    cache_ok = True

    def __init__(self, dimensions: int):
        super().__init__()
        self.dimensions = dimensions

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            from pgvector.sqlalchemy import Vector
            return dialect.type_descriptor(Vector(self.dimensions))
        from sqlalchemy import String

        return dialect.type_descriptor(String())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        return json.dumps(list(value))

    def process_result_value(self, value: Any, dialect: Any) -> list[float] | None:
        if value is None:
            return None
        if dialect.name == "postgresql":
            return list(value)
        return [float(v) for v in json.loads(value)]


_engine = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine():
    global _engine, _sessionmaker
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(settings.database_url, future=True)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    if _sessionmaker is None:
        get_engine()
    assert _sessionmaker is not None
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    sm = get_sessionmaker()
    async with sm() as session:
        yield session
