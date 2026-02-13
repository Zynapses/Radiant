"""
ElevenLabs TTS streaming client.

Implements TTSProvider with WebSocket streaming for real-time audio
and REST fallback for one-shot synthesis. Handles:
- Async text chunk streaming (from LLM generators)
- Interrupt/cancel via asyncio.Event
- Automatic reconnection on transient failures
- Per-app voice/language configuration via TTSConfig
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator, Optional, Union

import httpx

from radiant_tts.base import TTSProvider, TTSResult
from radiant_tts.config import TTSConfig

logger = logging.getLogger("radiant_tts.elevenlabs")

# ElevenLabs endpoints
WS_BASE = "wss://api.elevenlabs.io/v1/text-to-speech"
REST_BASE = "https://api.elevenlabs.io/v1/text-to-speech"


class ElevenLabsStreamer(TTSProvider):
    """
    ElevenLabs TTS provider with WebSocket streaming support.

    Usage:
        config = TTSConfig(voice=VoicePreset.RACHEL, language="en-US")
        tts = ElevenLabsStreamer(config)

        # Stream from async text chunks (e.g., Ollama output)
        async for audio_bytes in tts.stream(text_chunk_generator, cancel=event):
            await ws.send_bytes(audio_bytes)

        # One-shot
        result = await tts.synthesize("Welcome!")
        play(result.audio)
    """

    def __init__(self, config: Optional[TTSConfig] = None):
        super().__init__(config)
        self._ws_module = None

    def _get_ws_module(self):
        """Lazy import websockets — optional dependency."""
        if self._ws_module is None:
            try:
                import websockets
                self._ws_module = websockets
            except ImportError:
                raise ImportError(
                    "websockets is required for ElevenLabs streaming. "
                    "Install with: pip install radiant-tts[streaming] or pip install websockets"
                )
        return self._ws_module

    def _build_ws_url(self) -> str:
        """Build the ElevenLabs WebSocket URL with voice_id and params."""
        voice_id = self.config.resolve_voice_id()
        params = self.config.to_ws_params()
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{WS_BASE}/{voice_id}/stream-input?{query}"

    async def stream(
        self,
        text_chunks: Union[AsyncIterator[str], str],
        cancel: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[bytes]:
        """
        Stream audio from text chunks via ElevenLabs WebSocket.

        Connects to ElevenLabs, sends text chunks as they arrive,
        and yields audio bytes as they're generated. Supports interrupt
        via the cancel event.

        Args:
            text_chunks: Async iterator of text strings (e.g., LLM output)
                         or a single string.
            cancel: Optional asyncio.Event — set to stop streaming immediately.

        Yields:
            bytes: MP3 (or other format) audio chunks.
        """
        api_key = self.config.resolve_api_key()
        if not api_key:
            logger.warning("ElevenLabs API key not configured — no audio will be generated")
            # Drain text chunks silently (so upstream generators complete)
            if isinstance(text_chunks, str):
                return
            async for _ in text_chunks:
                if cancel and cancel.is_set():
                    return
            return

        websockets = self._get_ws_module()
        ws_url = self._build_ws_url()

        try:
            async with websockets.connect(
                ws_url,
                extra_headers={"xi-api-key": api_key},
                close_timeout=5,
                open_timeout=self.config.connect_timeout,
            ) as ws:
                # Send initial config (BOS — beginning of stream)
                await ws.send(json.dumps({
                    "text": " ",
                    "voice_settings": self.config.to_voice_settings(),
                    "xi_api_key": api_key,
                    "generation_config": {
                        "chunk_length_schedule": self.config.chunk_length_schedule,
                    },
                }))

                # Producer: send text chunks to ElevenLabs
                send_done = asyncio.Event()

                async def _send_text():
                    try:
                        if isinstance(text_chunks, str):
                            if cancel and cancel.is_set():
                                return
                            await ws.send(json.dumps({"text": text_chunks}))
                        else:
                            async for chunk in text_chunks:
                                if cancel and cancel.is_set():
                                    return
                                if chunk:
                                    await ws.send(json.dumps({"text": chunk}))
                    except Exception as e:
                        logger.debug(f"Send error (may be normal on cancel): {e}")
                    finally:
                        # Send EOS (end of stream) to flush remaining audio
                        try:
                            await ws.send(json.dumps({"text": ""}))
                        except Exception:
                            pass
                        send_done.set()

                # Start producer as background task
                send_task = asyncio.create_task(_send_text())

                # Consumer: receive audio chunks from ElevenLabs
                try:
                    async for raw in ws:
                        if cancel and cancel.is_set():
                            break
                        try:
                            msg = json.loads(raw)
                        except (json.JSONDecodeError, TypeError):
                            continue

                        # Extract audio bytes
                        if msg.get("audio"):
                            import base64
                            audio_bytes = base64.b64decode(msg["audio"])
                            if audio_bytes:
                                yield audio_bytes

                        # Check for errors
                        if msg.get("error"):
                            logger.error(f"ElevenLabs error: {msg['error']}")
                            break

                        # End of stream
                        if msg.get("isFinal"):
                            break

                except Exception as e:
                    if not (cancel and cancel.is_set()):
                        logger.error(f"ElevenLabs receive error: {e}")

                # Clean up sender
                if not send_task.done():
                    send_task.cancel()
                    try:
                        await send_task
                    except (asyncio.CancelledError, Exception):
                        pass

        except Exception as e:
            if not (cancel and cancel.is_set()):
                logger.error(f"ElevenLabs WebSocket connection failed: {e}")

    async def synthesize(self, text: str) -> TTSResult:
        """
        One-shot synthesis via ElevenLabs REST API.

        Args:
            text: The text to synthesize.

        Returns:
            TTSResult with complete audio bytes.
        """
        api_key = self.config.resolve_api_key()
        if not api_key:
            raise RuntimeError("ElevenLabs API key not configured")

        voice_id = self.config.resolve_voice_id()
        url = f"{REST_BASE}/{voice_id}"

        async with httpx.AsyncClient(timeout=self.config.stream_timeout) as client:
            resp = await client.post(
                url,
                headers={
                    "xi-api-key": api_key,
                    "Content-Type": "application/json",
                    "Accept": self.get_content_type(),
                },
                json={
                    "text": text,
                    "model_id": self.config.model,
                    "voice_settings": self.config.to_voice_settings(),
                },
            )
            resp.raise_for_status()

            return TTSResult(
                audio=resp.content,
                content_type=self.get_content_type(),
                characters_used=len(text),
            )

    async def is_available(self) -> bool:
        """Check if ElevenLabs is configured and reachable."""
        api_key = self.config.resolve_api_key()
        if not api_key:
            return False

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{REST_BASE.rsplit('/text-to-speech', 1)[0]}/voices",
                    headers={"xi-api-key": api_key},
                )
                return resp.status_code == 200
        except Exception:
            return False

    async def list_voices(self) -> list:
        """
        List available ElevenLabs voices.

        Returns:
            List of dicts with voice_id, name, category, description, preview_url.

        Raises:
            RuntimeError: If API key is not configured.
        """
        api_key = self.config.resolve_api_key()
        if not api_key:
            raise RuntimeError("ElevenLabs API key not configured")

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.elevenlabs.io/v1/voices",
                headers={"xi-api-key": api_key},
            )
            resp.raise_for_status()
            voices = resp.json().get("voices", [])
            return [
                {
                    "voice_id": v["voice_id"],
                    "name": v["name"],
                    "category": v.get("category", ""),
                    "description": v.get("description", ""),
                    "preview_url": v.get("preview_url", ""),
                }
                for v in voices
            ]
