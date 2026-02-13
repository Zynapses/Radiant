"""
TTS configuration — voice presets, language mapping, and provider settings.

Each host app can select a VoicePreset or build a custom TTSConfig with
language, voice_id, model, and streaming parameters.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict


class VoicePreset(str, Enum):
    """Pre-configured ElevenLabs voices with language + personality."""

    # English
    RACHEL = "rachel"           # Warm, female, American English — default drive-thru voice
    ADAM = "adam"                # Deep, male, American English
    BELLA = "bella"             # Soft, female, American English
    JOSH = "josh"               # Conversational, male, American English
    ARNOLD = "arnold"           # Authoritative, male, American English

    # Multilingual
    MATILDA = "matilda"         # Warm, female, multilingual
    GEORGE = "george"           # Warm, male, British English
    CHARLOTTE = "charlotte"     # Youthful, female, multilingual
    CALLUM = "callum"           # Transatlantic, male, multilingual

    # Custom
    CUSTOM = "custom"           # User provides voice_id directly


# ElevenLabs voice ID catalog
# Maps VoicePreset → ElevenLabs voice_id
VOICE_CATALOG: Dict[VoicePreset, str] = {
    VoicePreset.RACHEL: "21m00Tcm4TlvDq8ikWAM",
    VoicePreset.ADAM: "pNInz6obpgDQGcFmaJgB",
    VoicePreset.BELLA: "EXAVITQu4vr4xnSDxMaL",
    VoicePreset.JOSH: "TxGEqnHWrfWFTfGW9XjX",
    VoicePreset.ARNOLD: "VR6AewLTigWG4xSOukaG",
    VoicePreset.MATILDA: "XrExE9yKIg1WjnnlVkGX",
    VoicePreset.GEORGE: "JBFqnCBsd6RMkjVDRZzb",
    VoicePreset.CHARLOTTE: "XB0fDUnXU5powFXDhCwa",
    VoicePreset.CALLUM: "N2lVS1w4EtoT3dr4eOWO",
}


# Language → recommended voice preset
LANGUAGE_DEFAULTS: Dict[str, VoicePreset] = {
    "en": VoicePreset.RACHEL,
    "en-US": VoicePreset.RACHEL,
    "en-GB": VoicePreset.GEORGE,
    "es": VoicePreset.MATILDA,
    "es-MX": VoicePreset.MATILDA,
    "fr": VoicePreset.CHARLOTTE,
    "de": VoicePreset.CHARLOTTE,
    "it": VoicePreset.CHARLOTTE,
    "pt": VoicePreset.MATILDA,
    "pt-BR": VoicePreset.MATILDA,
    "ja": VoicePreset.CALLUM,
    "ko": VoicePreset.CALLUM,
    "zh": VoicePreset.CALLUM,
}


@dataclass
class TTSConfig:
    """
    TTS configuration for a single app/session.

    Priority for voice selection:
    1. Explicit voice_id (highest)
    2. VoicePreset (looked up in VOICE_CATALOG)
    3. Language code (looked up in LANGUAGE_DEFAULTS → VOICE_CATALOG)
    4. Default: Rachel (en-US)

    Priority for API key:
    1. Explicit api_key parameter
    2. ELEVENLABS_API_KEY environment variable
    """

    # Voice selection (use ONE of these)
    voice: VoicePreset = VoicePreset.RACHEL
    voice_id: Optional[str] = None        # Override: direct ElevenLabs voice_id
    language: Optional[str] = None         # Override: select voice by language code

    # API credentials
    api_key: Optional[str] = None          # Default: reads ELEVENLABS_API_KEY env var

    # ElevenLabs model
    model: str = "eleven_turbo_v2_5"       # Fastest streaming model

    # Streaming parameters
    output_format: str = "mp3_44100_128"   # mp3_22050_32, mp3_44100_64, mp3_44100_128, pcm_16000, pcm_24000
    chunk_length_schedule: list = field(default_factory=lambda: [80])  # Lower = faster first chunk
    stability: float = 0.5
    similarity_boost: float = 0.75
    style: float = 0.0                     # 0 = fast, higher = more expressive (slower)
    use_speaker_boost: bool = True

    # Timeout and retry
    connect_timeout: float = 10.0
    stream_timeout: float = 60.0

    def resolve_voice_id(self) -> str:
        """Resolve the final ElevenLabs voice_id from config priority chain."""
        # 1. Explicit voice_id
        if self.voice_id:
            return self.voice_id

        # 2. Language override → look up default preset for language
        if self.language:
            preset = LANGUAGE_DEFAULTS.get(self.language, VoicePreset.RACHEL)
            return VOICE_CATALOG.get(preset, VOICE_CATALOG[VoicePreset.RACHEL])

        # 3. VoicePreset
        return VOICE_CATALOG.get(self.voice, VOICE_CATALOG[VoicePreset.RACHEL])

    def resolve_api_key(self) -> Optional[str]:
        """Resolve API key from config or environment."""
        return self.api_key or os.environ.get("ELEVENLABS_API_KEY")

    def to_ws_params(self) -> dict:
        """Build ElevenLabs WebSocket query parameters."""
        return {
            "model_id": self.model,
            "output_format": self.output_format,
        }

    def to_voice_settings(self) -> dict:
        """Build ElevenLabs voice_settings payload."""
        return {
            "stability": self.stability,
            "similarity_boost": self.similarity_boost,
            "style": self.style,
            "use_speaker_boost": self.use_speaker_boost,
        }
