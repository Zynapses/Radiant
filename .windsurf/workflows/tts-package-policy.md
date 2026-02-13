---
description: Policy - All TTS implementations MUST use the radiant-tts package. No local TTS code allowed. Changes to the package require extra warning.
---

# TTS Package Policy — `radiant-tts`

**Package location**: `packages/tts-core/python/radiant_tts/`
**Status**: IMMUTABLE SHARED PACKAGE — changes affect ALL consumers

## Core Rules

### 1. NO LOCAL TTS CODE — EVER

All text-to-speech functionality in ANY RADIANT app or service MUST use `radiant-tts`.

**FORBIDDEN** (in any app, Lambda, service, or script):
- ❌ Direct imports of `elevenlabs` SDK
- ❌ Direct WebSocket connections to `wss://api.elevenlabs.io/`
- ❌ Direct REST calls to `https://api.elevenlabs.io/`
- ❌ Inline TTS streaming functions
- ❌ Any `pip install elevenlabs` in app-level requirements
- ❌ Copying TTS code from the package into local files
- ❌ Any other TTS provider (OpenAI, Google, Piper) without adding it as a TTSProvider in the package first

**REQUIRED**:
- ✅ `from radiant_tts import ElevenLabsStreamer, TTSConfig`
- ✅ Configure via `TTSConfig(language=..., voice=..., voice_id=...)`
- ✅ Use `tts.stream()` for streaming, `tts.synthesize()` for one-shot
- ✅ Pass interrupt signals via `cancel=asyncio.Event()`

### 2. PACKAGE CHANGES REQUIRE EXTRA WARNING

When modifying ANY file in `packages/tts-core/`:

⚠️ **STOP AND WARN THE USER** before making changes. Use this exact format:

```
⚠️ TTS PACKAGE CHANGE WARNING ⚠️
File: packages/tts-core/python/radiant_tts/<file>
Change: <description>
Impact: This change affects ALL apps and services using radiant-tts:
  - omega-proving-ground voice server (McDonald's drive-thru)
  - [any other consumers]
Proceed? (yes/no)
```

Do NOT auto-apply changes to the TTS package. Always wait for explicit user approval.

**Why**: The TTS package is a shared dependency. A breaking change in `elevenlabs.py` could silently break every app that uses TTS. The extra warning ensures the user understands the blast radius.

### 3. REFERENCE INJECTION

When implementing TTS in ANY new feature, page, service, or app:

1. **First**: Check if `radiant-tts` already covers the use case
2. **If yes**: Import and use it directly — reference `packages/tts-core/python/README.md` for API docs
3. **If no**: Add the capability TO THE PACKAGE (with the change warning above), then import it
4. **Always**: Add a reference comment at the import site:

```python
# TTS via radiant-tts shared package — see packages/tts-core/python/README.md
from radiant_tts import ElevenLabsStreamer, TTSConfig
```

```typescript
// TTS via @radiant/tts-core shared package — see packages/tts-core/README.md
import { ElevenLabsStreamer, TTSConfig } from '@radiant/tts-core';
```

### 4. NEW PROVIDER ADDITIONS

To add a new TTS provider (e.g., OpenAI TTS, Google Cloud TTS, local Piper):

1. Create `packages/tts-core/python/radiant_tts/<provider>.py`
2. Implement the `TTSProvider` abstract base class from `base.py`
3. Export from `__init__.py`
4. Update `README.md` with usage examples
5. **The change warning (Rule 2) applies**

### 5. LANGUAGE/VOICE CONFIGURATION

Voice selection MUST go through `TTSConfig`, never hardcoded:

```python
# ✅ Correct — configurable per app/locale
tts = ElevenLabsStreamer(TTSConfig(language=app.locale))

# ❌ Wrong — hardcoded voice ID in app code
ws_url = f"wss://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/..."
```

To add new voices or language mappings, modify `config.py` IN THE PACKAGE (with warning).

## Current Consumers

| App/Service | File | Usage |
|-------------|------|-------|
| OMEGA Voice Pipeline | `apps/omega-proving-ground/omega_server/voice_server.py` | Streaming drive-thru TTS |
| OMEGA Cortex Server | `apps/omega-proving-ground/omega_server/server.py` | One-shot /tts endpoint |

### Pending Migration (needs TypeScript package)

| App/Service | File | Status |
|-------------|------|--------|
| Voice-Video Lambda | `packages/infrastructure/lambda/shared/services/voice-video.ts` | Awaiting `@radiant/tts-core` TS package |

**Update this table when adding new consumers.**

## Quick Reference

```python
# Streaming from LLM output
from radiant_tts import ElevenLabsStreamer, TTSConfig

tts = ElevenLabsStreamer(TTSConfig(language="en-US"))
async for audio in tts.stream(llm_chunks, cancel=interrupt_event):
    await send(audio)

# One-shot
result = await tts.synthesize("Hello!")

# Check availability
available = await tts.is_available()
```

## Enforcement Checklist

When reviewing ANY PR or code change:

- [ ] No direct ElevenLabs imports outside `packages/tts-core/`
- [ ] No `wss://api.elevenlabs.io` URLs outside `packages/tts-core/`
- [ ] No `ELEVENLABS_API_KEY` reads outside `packages/tts-core/` and app config
- [ ] Any TTS package changes have explicit user approval
- [ ] New consumers are added to the consumers table above
- [ ] Reference comment present at import site
