from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger("ai.embeddings")


class EmbeddingClient(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        """Generate a 1536-dimension embedding list of floats for the text."""
        pass


class OpenAIEmbeddingClient(EmbeddingClient):
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key

    @property
    def api_key(self) -> str | None:
        return self._api_key or get_settings().openai_api_key or os.environ.get("OPENAI_API_KEY")

    async def embed(self, text: str) -> list[float]:
        key = self.api_key
        if not key:
            raise ValueError("OpenAI API key is not configured.")

        logger.info("Requesting OpenAI embedding...")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "input": text,
                    "model": "text-embedding-3-small",
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]


class MockEmbeddingClient(EmbeddingClient):
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def embed(self, text: str) -> list[float]:
        self.calls.append(text)
        if "bells" in text.lower():
            return [1.0 if i % 2 == 0 else 0.0 for i in range(1536)]
        else:
            return [0.0 if i % 2 == 0 else 1.0 for i in range(1536)]
