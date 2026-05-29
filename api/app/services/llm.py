from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from typing import Any, Optional

from app.config import get_settings

logger = logging.getLogger("ai.llm")


class LLMClient(ABC):
    @abstractmethod
    async def generate(
        self,
        system: str,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.0,
    ) -> tuple[str, int, int]:
        """Generate content given a system prompt and a user prompt.

        Returns: (output_text, prompt_tokens, output_tokens)
        """
        pass


class AnthropicClient(LLMClient):
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key
        self._client = None

    @property
    def api_key(self) -> str | None:
        return self._api_key or get_settings().anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")

    @property
    def client(self) -> Any:
        if self._client is None:
            key = self.api_key
            if not key:
                raise ValueError("Anthropic API key is not configured.")
            import anthropic
            self._client = anthropic.AsyncAnthropic(api_key=key)
        return self._client

    async def generate(
        self,
        system: str,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.0,
    ) -> tuple[str, int, int]:
        model = model or "claude-3-haiku-20240307"
        logger.info("Sending Anthropic API request (model=%s)", model)
        try:
            response = await self.client.messages.create(
                model=model,
                max_tokens=2000,
                temperature=temperature,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            output_text = "".join(
                block.text for block in response.content if hasattr(block, "text")
            )
            prompt_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            logger.info(
                "Anthropic API request successful. In tokens=%d, Out tokens=%d",
                prompt_tokens,
                output_tokens,
            )
            return output_text, prompt_tokens, output_tokens
        except Exception as e:
            logger.error("Anthropic API error: %s", e, exc_info=True)
            raise e


class MockLLMClient(LLMClient):
    def __init__(self) -> None:
        self.responses: list[tuple[str, int, int]] = []
        self.calls: list[dict[str, Any]] = []

    def add_response(self, text: str, prompt_tokens: int = 100, output_tokens: int = 100) -> None:
        self.responses.append((text, prompt_tokens, output_tokens))

    async def generate(
        self,
        system: str,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.0,
    ) -> tuple[str, int, int]:
        self.calls.append(
            {
                "system": system,
                "prompt": prompt,
                "model": model,
                "temperature": temperature,
            }
        )
        if not self.responses:
            return "{}", 0, 0
        return self.responses.pop(0)
