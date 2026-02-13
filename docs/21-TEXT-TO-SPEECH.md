# RADIANT Text-to-Speech (TTS) — Complete Reference

> **Version**: 7.61.0 | **Date**: February 13, 2026
> **Classification**: RADIANT INTERNAL // ENGINEERING
> **Package**: `radiant-tts` v1.0.0
> **Maintainers**: Robert Long + AI Build Agents
> **Canonical Source**: `packages/tts-core/python/radiant_tts/`
> **Policy**: `.windsurf/workflows/tts-package-policy.md`

---

## Table of Contents

1. [Executive Summary](#part-i-executive-summary)
2. [Architecture Overview](#part-ii-architecture-overview)
3. [Package Structure — radiant-tts](#part-iii-package-structure)
4. [Configuration System (TTSConfig)](#part-iv-configuration-system)
5. [Voice Catalog & Language Mapping](#part-v-voice-catalog--language-mapping)
6. [Provider Interface (TTSProvider)](#part-vi-provider-interface)
7. [ElevenLabs Implementation](#part-vii-elevenlabs-implementation)
8. [Streaming Architecture](#part-viii-streaming-architecture)
9. [Interrupt & Barge-In Support](#part-ix-interrupt--barge-in-support)
10. [Integration Guide — OMEGA Proving Ground](#part-x-integration-guide--omega-proving-ground)
11. [Integration Guide — Voice Server (WebSocket)](#part-xi-integration-guide--voice-server)
12. [Adding New Providers](#part-xii-adding-new-providers)
13. [API Reference — Proving Ground Endpoints](#part-xiii-api-reference)
14. [Environment Variables & Secrets](#part-xiv-environment-variables--secrets)
15. [Troubleshooting & Error Handling](#part-xv-troubleshooting--error-handling)
16. [Package Policy & Governance](#part-xvi-package-policy--governance)
17. [Competitive Analysis — TTS Landscape](#part-xvii-competitive-analysis)
18. [Roadmap](#part-xviii-roadmap)

---

## Part I: Executive Summary

`radiant-tts` is RADIANT's **canonical, provider-agnostic Text-to-Speech package**. It provides a unified interface for streaming and one-shot speech synthesis across multiple TTS providers, with first-class support for ElevenLabs. The package is used by the OMEGA Proving Ground server, the voice-enabled WebSocket server, and any future RADIANT application that needs speech output.

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| **Streaming synthesis** | Receives async text chunks (e.g., from LLM token streaming) and yields audio bytes in real-time |
| **One-shot synthesis** | Converts a complete string to audio in a single call |
| **Interrupt/cancel** | Supports `asyncio.Event`-based interruption for barge-in scenarios |
| **Provider-agnostic** | Abstract `TTSProvider` base class — swap ElevenLabs for OpenAI, Google, or local Piper without changing consumer code |
| **Voice presets** | 9 named voice presets with personality descriptions |
| **Language mapping** | Automatic voice selection by locale (en-US, es-MX, fr, de, ja, ko, zh, etc.) |
| **Multiple output formats** | MP3 (44.1kHz/128kbps, 44.1kHz/64kbps, 22.05kHz/32kbps), PCM (16kHz, 24kHz) |
| **Voice catalog** | API to list all available ElevenLabs voices (including cloned voices) |
| **WebSocket streaming** | Native ElevenLabs WebSocket protocol for lowest-latency audio delivery |

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│              Consumer Application                     │
│  (OMEGA server, voice_server, future apps)            │
│                                                       │
│  ┌──────────────────────────────────────┐             │
│  │        radiant-tts Package            │             │
│  │                                        │             │
│  │  TTSConfig ─── VoicePreset             │             │
│  │      │         VOICE_CATALOG           │             │
│  │      │         LANGUAGE_DEFAULTS       │             │
│  │      ▼                                 │             │
│  │  TTSProvider (abstract)                │             │
│  │      │                                 │             │
│  │      ├── ElevenLabsStreamer            │             │
│  │      │     ├── stream() [WebSocket]    │             │
│  │      │     ├── synthesize() [REST]     │             │
│  │      │     ├── list_voices()           │             │
│  │      │     └── is_available()          │             │
│  │      │                                 │             │
│  │      └── (Future: OpenAITTS, PiperTTS) │             │
│  │                                        │             │
│  │  TTSResult ─── audio bytes + metadata  │             │
│  └──────────────────────────────────────┘             │
└─────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
  ElevenLabs WebSocket              ElevenLabs REST API
  (streaming, <100ms TTFB)          (one-shot synthesis)
```

---

## Part II: Architecture Overview

### Design Principles

1. **Provider Agnosticism**: Consumer code imports `TTSProvider` and programs to the interface. The concrete implementation (ElevenLabs today, OpenAI or local Piper tomorrow) is injected via configuration.

2. **Async-First**: All synthesis methods are async. Streaming uses `async for` iteration, enabling seamless integration with async web frameworks (FastAPI, Starlette) and WebSocket servers.

3. **Interrupt-Ready**: Every streaming call accepts an optional `asyncio.Event` cancel signal. When set, streaming stops immediately — critical for voice barge-in scenarios where the user interrupts the AI mid-sentence.

4. **Zero-Config Defaults**: Instantiate `ElevenLabsStreamer()` with no arguments and it works — reads `ELEVENLABS_API_KEY` from environment, uses Rachel voice, English language, MP3 44.1kHz/128kbps.

5. **No Local TTS Code**: Per package policy (`.windsurf/workflows/tts-package-policy.md`), ALL TTS logic lives in this package. No app may implement its own TTS code. Changes go INTO the package, never copied out.

### Dependency Graph

```
radiant-tts
├── httpx (REST API calls)
├── websockets (optional — for streaming, install via radiant-tts[streaming])
└── (no torch dependency — pure network I/O)
```

---

## Part III: Package Structure

```
packages/tts-core/python/
├── radiant_tts/
│   ├── __init__.py      # Public API: TTSConfig, VoicePreset, VOICE_CATALOG, TTSProvider, TTSResult, ElevenLabsStreamer
│   ├── base.py          # TTSProvider (ABC), TTSResult (@dataclass)
│   ├── config.py        # TTSConfig, VoicePreset (Enum), VOICE_CATALOG, LANGUAGE_DEFAULTS
│   └── elevenlabs.py    # ElevenLabsStreamer — WebSocket streaming + REST one-shot + voice listing
├── pyproject.toml       # Package metadata (Python ≥3.10)
└── README.md            # Quick start, streaming examples, language config, custom providers
```

### Module Exports

| Module | Exports | Purpose |
|--------|---------|---------|
| `__init__.py` | `TTSConfig`, `VoicePreset`, `VOICE_CATALOG`, `TTSProvider`, `TTSResult`, `ElevenLabsStreamer` | Public API surface |
| `base.py` | `TTSProvider` (ABC), `TTSResult` | Abstract interface + result container |
| `config.py` | `TTSConfig`, `VoicePreset`, `VOICE_CATALOG`, `LANGUAGE_DEFAULTS` | Voice selection, language mapping, streaming params |
| `elevenlabs.py` | `ElevenLabsStreamer` | Full ElevenLabs implementation |

---

## Part IV: Configuration System (TTSConfig)

### TTSConfig Dataclass

```python
@dataclass
class TTSConfig:
    # Voice selection (use ONE — priority: voice_id > language > voice)
    voice: VoicePreset = VoicePreset.RACHEL    # Named preset
    voice_id: Optional[str] = None              # Direct ElevenLabs voice_id override
    language: Optional[str] = None              # Auto-select by locale

    # API credentials
    api_key: Optional[str] = None               # Reads ELEVENLABS_API_KEY if None

    # ElevenLabs model
    model: str = "eleven_turbo_v2_5"            # Fastest streaming model

    # Streaming parameters
    output_format: str = "mp3_44100_128"        # Audio format
    chunk_length_schedule: list = [80]          # Lower = faster first chunk
    stability: float = 0.5                      # Voice stability
    similarity_boost: float = 0.75              # Voice similarity
    style: float = 0.0                          # 0 = fast, higher = expressive
    use_speaker_boost: bool = True              # Speaker clarity boost

    # Timeout
    connect_timeout: float = 10.0               # WebSocket connect timeout
    stream_timeout: float = 60.0                # REST synthesis timeout
```

### Voice Resolution Priority

When resolving which voice to use, TTSConfig follows a strict priority chain:

1. **`voice_id`** (highest priority) — If a direct ElevenLabs voice_id is provided (e.g., for cloned voices), use it directly. No catalog lookup needed.
2. **`language`** — If a language code is provided, look up the recommended preset in `LANGUAGE_DEFAULTS`, then resolve that preset via `VOICE_CATALOG`.
3. **`voice`** (VoicePreset enum) — Default path. Look up the preset in `VOICE_CATALOG` to get the ElevenLabs voice_id.
4. **Fallback** — If all else fails, use Rachel (en-US).

### Output Formats

| Format | Quality | Use Case |
|--------|---------|----------|
| `mp3_44100_128` | Best | Default — high quality streaming |
| `mp3_44100_64` | Good | Bandwidth-constrained environments |
| `mp3_22050_32` | Low | Minimal bandwidth (mobile, poor connections) |
| `pcm_16000` | Raw | Real-time audio pipelines (16kHz) |
| `pcm_24000` | Raw | Real-time audio pipelines (24kHz) |

---

## Part V: Voice Catalog & Language Mapping

### Voice Presets

| Preset | ElevenLabs Voice | Personality | Best For |
|--------|-----------------|-------------|----------|
| `RACHEL` | Rachel (21m00Tcm4TlvDq8ikWAM) | Warm, female, American English | Default drive-thru voice, general assistant |
| `ADAM` | Adam (pNInz6obpgDQGcFmaJgB) | Deep, male, American English | Authoritative responses, announcements |
| `BELLA` | Bella (EXAVITQu4vr4xnSDxMaL) | Soft, female, American English | Gentle interactions, emotional support |
| `JOSH` | Josh (TxGEqnHWrfWFTfGW9XjX) | Conversational, male, American English | Casual interactions, chat |
| `ARNOLD` | Arnold (VR6AewLTigWG4xSOukaG) | Authoritative, male, American English | Commands, instructions, formal |
| `MATILDA` | Matilda (XrExE9yKIg1WjnnlVkGX) | Warm, female, multilingual | Spanish, Portuguese content |
| `GEORGE` | George (JBFqnCBsd6RMkjVDRZzb) | Warm, male, British English | UK English content |
| `CHARLOTTE` | Charlotte (XB0fDUnXU5powFXDhCwa) | Youthful, female, multilingual | French, German, Italian content |
| `CALLUM` | Callum (N2lVS1w4EtoT3dr4eOWO) | Transatlantic, male, multilingual | Japanese, Korean, Chinese content |
| `CUSTOM` | (user-provided) | (user-defined) | Cloned voices, custom voice_id |

### Language Defaults

| Language | Code | Default Preset | Voice |
|----------|------|---------------|-------|
| English (US) | `en`, `en-US` | RACHEL | Warm female |
| English (UK) | `en-GB` | GEORGE | Warm male, British |
| Spanish | `es`, `es-MX` | MATILDA | Warm female, multilingual |
| French | `fr` | CHARLOTTE | Youthful female |
| German | `de` | CHARLOTTE | Youthful female |
| Italian | `it` | CHARLOTTE | Youthful female |
| Portuguese (BR) | `pt`, `pt-BR` | MATILDA | Warm female |
| Japanese | `ja` | CALLUM | Transatlantic male |
| Korean | `ko` | CALLUM | Transatlantic male |
| Chinese | `zh` | CALLUM | Transatlantic male |

### Usage Example — Language-Based Selection

```python
from radiant_tts import ElevenLabsStreamer, TTSConfig

# App passes its current locale
tts = ElevenLabsStreamer(TTSConfig(language="es-MX"))
# → Automatically selects Matilda voice (warm, female, multilingual)

# Or use named presets
tts = ElevenLabsStreamer(TTSConfig(voice=VoicePreset.ADAM))
# → Adam voice (deep, male, American English)

# Or direct voice_id for cloned voices
tts = ElevenLabsStreamer(TTSConfig(voice_id="your_custom_cloned_voice_id"))
```

---

## Part VI: Provider Interface (TTSProvider)

### Abstract Base Class

All TTS implementations must conform to the `TTSProvider` interface:

```python
class TTSProvider(ABC):
    def __init__(self, config: Optional[TTSConfig] = None):
        self.config = config or TTSConfig()

    @abstractmethod
    async def stream(
        self,
        text_chunks: Union[AsyncIterator[str], str],
        cancel: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[bytes]:
        """Stream audio bytes from text chunks."""
        ...

    @abstractmethod
    async def synthesize(self, text: str) -> TTSResult:
        """One-shot: text → complete audio."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if provider is configured and reachable."""
        ...

    def get_content_type(self) -> str:
        """Return MIME type for configured output format."""
        ...
```

### TTSResult

```python
@dataclass
class TTSResult:
    audio: bytes                      # Complete audio data
    content_type: str = "audio/mpeg"  # MIME type
    duration_ms: Optional[float] = None
    characters_used: int = 0
```

---

## Part VII: ElevenLabs Implementation

### ElevenLabsStreamer

The primary TTS implementation. Uses two ElevenLabs APIs:

1. **WebSocket Streaming** (`wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input`) — For real-time audio from LLM token streams. <100ms time-to-first-byte.

2. **REST API** (`https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`) — For one-shot synthesis of complete strings.

### Stream Method — Internal Architecture

The `stream()` method implements a **producer/consumer** architecture:

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│ LLM Token    │ text    │  ElevenLabs      │ audio   │  Consumer    │
│ Generator    │───────▶│  WebSocket       │───────▶│  (caller)    │
│ (async iter) │ chunks  │  Server          │ chunks  │              │
└──────────────┘         └──────────────────┘         └──────────────┘
       ▲                        ▲
       │                        │
  cancel.set()            cancel.set()
  (stops sending)         (stops receiving)
```

**Producer task** (`_send_text()`):
1. Iterates over incoming text chunks (from LLM or string)
2. Sends each chunk as JSON to ElevenLabs WebSocket
3. Sends empty string `""` as EOS (end-of-stream) to flush remaining audio
4. Respects cancel event — stops sending immediately when set

**Consumer loop**:
1. Receives JSON messages from ElevenLabs WebSocket
2. Extracts base64-encoded audio bytes
3. Yields audio chunks to the caller
4. Stops on cancel event, error, or `isFinal` message

### List Voices Method

```python
async def list_voices(self) -> list:
    """List available ElevenLabs voices.
    Returns: List of dicts with voice_id, name, category, description, preview_url."""
```

Uses the ElevenLabs `/v1/voices` REST endpoint. Returns both library voices and custom cloned voices associated with the API key.

### Availability Check

```python
async def is_available(self) -> bool:
    """Check if ElevenLabs is configured and reachable."""
```

Verifies API key exists and can successfully reach the ElevenLabs API.

---

## Part VIII: Streaming Architecture

### WebSocket Protocol

The ElevenLabs WebSocket protocol works as follows:

1. **Connect** with `xi-api-key` header and `model_id`/`output_format` query params
2. **BOS (Beginning of Stream)**: Send initial config with voice_settings and generation_config
3. **Text chunks**: Send `{"text": "chunk"}` for each text chunk
4. **EOS (End of Stream)**: Send `{"text": ""}` to flush remaining audio
5. **Receive**: Audio arrives as base64-encoded bytes in `{"audio": "base64..."}` messages
6. **Final**: Server sends `{"isFinal": true}` when complete

### Latency Optimization

| Parameter | Default | Effect |
|-----------|---------|--------|
| `chunk_length_schedule` | `[80]` | Characters before first audio chunk — lower = faster TTFB |
| `model` | `eleven_turbo_v2_5` | Fastest ElevenLabs model (vs `eleven_multilingual_v2`) |
| `style` | `0.0` | Zero style = fastest generation |
| `output_format` | `mp3_44100_128` | MP3 adds minimal encoding overhead |

### Graceful Degradation

If `ELEVENLABS_API_KEY` is not set:
- `stream()` drains text chunks silently (so upstream LLM generators complete) and yields nothing
- `synthesize()` raises `RuntimeError`
- `is_available()` returns `False`
- The server operates in **text-only mode** — all OMEGA intelligence works, just without audio

---

## Part IX: Interrupt & Barge-In Support

### Cancel Signal

Every streaming call accepts an `asyncio.Event` cancel parameter:

```python
cancel = asyncio.Event()

# In the streaming loop
async for audio_chunk in tts.stream(text_gen, cancel=cancel):
    await send_audio(audio_chunk)

# Somewhere else (e.g., VAD detects speech):
cancel.set()  # Immediately stops both sending and receiving
```

### Integration with Silero VAD

The OMEGA voice server (`voice_server.py`) uses Silero VAD for barge-in detection:

1. Client sends audio frames to the WebSocket server
2. Silero VAD computes speech probability
3. If probability > 0.7 and the AI is speaking → trigger interrupt
4. Cancel event stops TTS streaming immediately
5. New user input is processed

---

## Part X: Integration Guide — OMEGA Proving Ground

### Server Endpoints

The OMEGA proving ground server (`server.py`) exposes TTS via REST endpoints:

```
POST /tts          — Synthesize text to audio (one-shot)
GET  /tts/provider — Check TTS provider configuration
GET  /tts/voices   — List available ElevenLabs voices
```

### Example: TTS Synthesis

```bash
curl -X POST http://localhost:11435/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Welcome to McDonald'\''s!", "voice": "rachel"}'
```

### Server Integration Pattern

```python
from radiant_tts import ElevenLabsStreamer, TTSConfig, VoicePreset

# Initialize once at boot
_server_tts = ElevenLabsStreamer(TTSConfig(voice=VoicePreset.RACHEL))

# Endpoint handler
@app.route('/tts', methods=['POST'])
def tts_synthesize():
    text = request.json.get('text', '')
    result = asyncio.run(_server_tts.synthesize(text))
    return Response(result.audio, mimetype=result.content_type)
```

---

## Part XI: Integration Guide — Voice Server (WebSocket)

### Architecture

The voice-enabled WebSocket server (`voice_server.py`) chains:

```
Microphone → WebSocket → Silero VAD → Whisper STT → OMEGA → Ollama → radiant-tts → WebSocket → Speaker
```

### Streaming Integration

```python
from radiant_tts import ElevenLabsStreamer, TTSConfig

async def _process_input(ws, session, text):
    # 1. Get OMEGA's behavioral decision
    omega_result = brain.think(text)

    # 2. Stream Ollama response + TTS simultaneously
    tts = ElevenLabsStreamer()
    cancel = session.interrupt_event

    async def ollama_tokens():
        async for token in ollama_stream(instruction):
            yield token

    async for audio_chunk in tts.stream(ollama_tokens(), cancel=cancel):
        await ws.send_bytes(audio_chunk)
```

### Text-Only Fallback

When `ELEVENLABS_API_KEY` is not set, the voice server operates in text-only mode:
- Ollama tokens are streamed as text to the WebSocket client
- No audio is generated
- All OMEGA intelligence (behavior classification, menu lookup, order management) works normally
- The client can display text responses instead of playing audio

---

## Part XII: Adding New Providers

### Step 1: Create Provider Module

```python
# radiant_tts/openai_tts.py
from radiant_tts.base import TTSProvider, TTSResult
from radiant_tts.config import TTSConfig

class OpenAITTS(TTSProvider):
    async def stream(self, text_chunks, cancel=None):
        # Implement OpenAI TTS streaming
        ...

    async def synthesize(self, text: str) -> TTSResult:
        # Implement OpenAI TTS one-shot
        ...

    async def is_available(self) -> bool:
        return bool(os.environ.get("OPENAI_API_KEY"))
```

### Step 2: Add to Package Exports

```python
# radiant_tts/__init__.py
from radiant_tts.openai_tts import OpenAITTS
__all__ = [..., "OpenAITTS"]
```

### Step 3: Update TTSConfig

Add any provider-specific config fields to `TTSConfig` or create a provider-specific config subclass.

### Step 4: Update Documentation

- This document (Part VII equivalent for new provider)
- `docs/06-ARCHITECTURE-ENGINEERING.md` (if architectural change)
- `docs/17-GLOSSARY.md` (if new terms)
- `CHANGELOG.md`

---

## Part XIII: API Reference — Proving Ground Endpoints

### POST /tts

**Description**: One-shot text-to-speech synthesis.

**Request Body**:
```json
{
  "text": "Welcome to McDonald's!",
  "voice": "rachel",
  "language": "en-US",
  "output_format": "mp3_44100_128"
}
```

**Response**: Audio binary (Content-Type: audio/mpeg)

### GET /tts/provider

**Description**: Check TTS provider status and configuration.

**Response**:
```json
{
  "provider": "elevenlabs",
  "available": true,
  "model": "eleven_turbo_v2_5",
  "voice": "rachel",
  "output_format": "mp3_44100_128"
}
```

### GET /tts/voices

**Description**: List all available ElevenLabs voices.

**Response**:
```json
{
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "category": "premade",
      "description": "Warm, conversational",
      "preview_url": "https://..."
    }
  ],
  "count": 42
}
```

---

## Part XIV: Environment Variables & Secrets

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ELEVENLABS_API_KEY` | Yes (for audio) | None | ElevenLabs API key. Without it, TTS operates in text-only mode. |

### Security Best Practices

- **Never hardcode** the API key in source code
- Use `.env` files for local development (gitignored)
- Use AWS Secrets Manager or Parameter Store for production
- The `radiant-tts` package reads the key via `os.environ.get("ELEVENLABS_API_KEY")` or accepts it via `TTSConfig(api_key=...)`
- In the proving ground, `python-dotenv` loads `.env` files automatically

---

## Part XV: Troubleshooting & Error Handling

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| No audio generated | Missing `ELEVENLABS_API_KEY` | Set the env var or pass via `TTSConfig(api_key=...)` |
| WebSocket connection fails | Network issue or invalid API key | Check connectivity, verify API key at elevenlabs.io |
| `ImportError: websockets` | Missing optional dependency | `pip install radiant-tts[streaming]` or `pip install websockets` |
| Audio quality poor | Low output format | Use `mp3_44100_128` for best quality |
| High TTFB (time-to-first-byte) | Large `chunk_length_schedule` | Reduce to `[80]` or lower |
| Wrong voice/language | Config priority confusion | Remember: `voice_id` > `language` > `voice` preset |

### Error Handling in Streaming

The ElevenLabsStreamer handles errors gracefully:
- **Connection failure**: Logs error, yields nothing (text-only fallback)
- **Cancel during stream**: Cancels send task, closes WebSocket cleanly
- **ElevenLabs error response**: Logs error message, breaks stream
- **No API key**: Drains text chunks silently, returns immediately

---

## Part XVI: Package Policy & Governance

### Policy File

`.windsurf/workflows/tts-package-policy.md`

### Rules

1. **All TTS functionality MUST use `radiant-tts`** — No local TTS code allowed in any app
2. **Changes go INTO the package** — Never copy TTS code into apps
3. **Package changes require warning** — Blast radius analysis before modification
4. **Reference injection** — All TTS imports must trace back to `radiant_tts`
5. **New providers require documentation** — This document + CHANGELOG + Glossary

### Consumer Applications

| Consumer | File | Import Style |
|----------|------|-------------|
| OMEGA Proving Ground | `omega_server/server.py` | `from radiant_tts import ElevenLabsStreamer, TTSConfig, VoicePreset` |
| Voice Server | `omega_server/voice_server.py` | `from radiant_tts import ElevenLabsStreamer, TTSConfig` |
| Future apps | — | Same pattern |

---

## Part XVII: Competitive Analysis — TTS Landscape

### Provider Comparison

| Provider | Streaming | Latency | Quality | Multi-language | Price |
|----------|-----------|---------|---------|---------------|-------|
| **ElevenLabs** (current) | ✅ WebSocket | <100ms TTFB | Excellent | 29 languages | $0.30/1K chars |
| OpenAI TTS | ✅ | ~200ms | Very good | Limited | $0.015/1K chars |
| Google Cloud TTS | ✅ | ~300ms | Good | 50+ languages | $0.016/1K chars |
| Amazon Polly | ✅ | ~200ms | Good | 30+ languages | $0.004/1K chars |
| Piper (local) | ❌ | <50ms | Moderate | Limited | Free |
| Coqui XTTS | ✅ | Variable | Good | 17 languages | Free (self-hosted) |

### Why ElevenLabs First

ElevenLabs was chosen as the first implementation because:
1. **Best-in-class quality** — Most natural-sounding voices currently available
2. **WebSocket streaming** — Enables real-time audio from LLM token streams
3. **Low TTFB** — <100ms time-to-first-byte with turbo models
4. **Voice cloning** — Supports custom voice training (future RADIANT feature)
5. **Simple API** — Clean WebSocket protocol, well-documented

### Provider Roadmap

| Provider | Priority | Status | Notes |
|----------|----------|--------|-------|
| ElevenLabs | P0 | ✅ Implemented | Primary provider |
| OpenAI TTS | P1 | 🔵 Planned | Cheaper fallback |
| Piper (local) | P2 | 🔵 Planned | Offline/air-gapped environments |
| Google Cloud | P3 | 🔵 Planned | Enterprise customers |

---

## Part XVIII: Roadmap

### Short-Term

- **OpenAI TTS provider** — Implement `OpenAITTS` for cheaper fallback
- **Voice caching** — Cache frequently-used phrases (greetings, confirmations) to reduce API calls
- **Streaming metrics** — Track TTFB, total latency, characters synthesized per session

### Medium-Term

- **Piper local TTS** — For air-gapped deployments and zero-latency requirements
- **Voice cloning integration** — Use ElevenLabs voice cloning API for tenant-specific voices
- **SSML support** — Speech Synthesis Markup Language for emphasis, pauses, pronunciation
- **Pronunciation dictionary** — Custom pronunciation rules per tenant (brand names, technical terms)

### Long-Term

- **Multi-provider failover** — Automatic fallback chain: ElevenLabs → OpenAI → Piper
- **Adaptive quality** — Auto-adjust output format based on network conditions
- **Emotion injection** — Use OMEGA's ambition state to modulate TTS emotion parameters
- **Real-time voice morphing** — Change voice mid-stream based on conversational context

---

*Document generated: February 13, 2026 | Version: 7.61.0*
*This document is part of the RADIANT documentation set. See `docs/DOCUMENTATION-MANIFEST.json` for the complete document list.*
