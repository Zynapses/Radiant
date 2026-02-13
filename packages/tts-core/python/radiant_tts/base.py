"""
Abstract TTS provider interface.

All TTS implementations (ElevenLabs, OpenAI, Google, local Piper, etc.)
implement this interface so consumer code never couples to a specific provider.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional, Union

from radiant_tts.config import TTSConfig


@dataclass
class TTSResult:
    """Result from a one-shot synthesis call."""
    audio: bytes                     # Complete audio data
    content_type: str = "audio/mpeg" # MIME type
    duration_ms: Optional[float] = None
    characters_used: int = 0


class TTSProvider(ABC):
    """
    Abstract base class for TTS providers.

    Subclasses must implement:
    - stream(): Streaming synthesis from an async text generator
    - synthesize(): One-shot synthesis of a complete string
    - is_available(): Check if the provider is configured and reachable
    """

    def __init__(self, config: Optional[TTSConfig] = None):
        self.config = config or TTSConfig()

    @abstractmethod
    async def stream(
        self,
        text_chunks: Union[AsyncIterator[str], str],
        cancel: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[bytes]:
        """
        Stream audio bytes from text chunks.

        Args:
            text_chunks: Either an async iterator yielding text chunks (e.g., LLM tokens)
                         or a single string to stream.
            cancel: Optional asyncio.Event — when set, the stream stops immediately.

        Yields:
            bytes: Audio chunks (format determined by config.output_format)
        """
        ...

    @abstractmethod
    async def synthesize(self, text: str) -> TTSResult:
        """
        One-shot synthesis: text → complete audio.

        Args:
            text: The text to synthesize.

        Returns:
            TTSResult with complete audio bytes.
        """
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """
        Check if this provider is configured and reachable.

        Returns:
            True if the provider can accept synthesis requests.
        """
        ...

    def get_content_type(self) -> str:
        """Return the MIME type for the configured output format."""
        fmt = self.config.output_format
        if fmt.startswith("mp3"):
            return "audio/mpeg"
        elif fmt.startswith("pcm"):
            return "audio/pcm"
        elif fmt.startswith("opus"):
            return "audio/opus"
        elif fmt.startswith("ulaw"):
            return "audio/basic"
        return "audio/mpeg"
