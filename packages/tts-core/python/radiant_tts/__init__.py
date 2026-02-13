"""
radiant-tts — Reusable TTS streaming core for RADIANT.

Provider-agnostic interface with ElevenLabs implementation.
Supports streaming from async text generators, one-shot synthesis,
interrupt/cancel signals, and per-app language/voice configuration.

Usage:
    from radiant_tts import ElevenLabsStreamer, TTSConfig, VoicePreset

    config = TTSConfig(voice=VoicePreset.RACHEL)
    tts = ElevenLabsStreamer(config)

    # Streaming from LLM output
    async for audio_bytes in tts.stream(text_chunks, cancel=event):
        await send_audio(audio_bytes)

    # One-shot
    audio = await tts.synthesize("Hello!")
"""

from radiant_tts.config import TTSConfig, VoicePreset, VOICE_CATALOG
from radiant_tts.base import TTSProvider, TTSResult
from radiant_tts.elevenlabs import ElevenLabsStreamer

__all__ = [
    "TTSConfig",
    "VoicePreset",
    "VOICE_CATALOG",
    "TTSProvider",
    "TTSResult",
    "ElevenLabsStreamer",
]

__version__ = "1.0.0"
