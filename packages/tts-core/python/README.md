# radiant-tts

Reusable TTS streaming core for RADIANT. Provider-agnostic interface with ElevenLabs implementation.

## Installation

```bash
# From monorepo (editable — changes are live)
cd packages/tts-core/python
pip install -e .

# From git (any external project)
pip install git+https://github.com/yourorg/radiant.git#subdirectory=packages/tts-core/python
```

## Quick Start

```python
from radiant_tts import ElevenLabsStreamer, TTSConfig, VoicePreset

# Default config (Rachel voice, English)
tts = ElevenLabsStreamer()

# Custom voice
tts = ElevenLabsStreamer(TTSConfig(voice=VoicePreset.ADAM))

# By language (auto-selects appropriate voice)
tts = ElevenLabsStreamer(TTSConfig(language="es-MX"))

# Direct voice_id override
tts = ElevenLabsStreamer(TTSConfig(voice_id="your_custom_voice_id"))
```

## Streaming from LLM Output

```python
import asyncio

async def llm_tokens():
    """Simulates an LLM streaming tokens."""
    for word in "Welcome to McDonald's! What can I get for you?".split():
        yield word + " "
        await asyncio.sleep(0.05)

async def main():
    tts = ElevenLabsStreamer()
    cancel = asyncio.Event()

    async for audio_chunk in tts.stream(llm_tokens(), cancel=cancel):
        # Send to WebSocket, play locally, write to file, etc.
        process_audio(audio_chunk)

asyncio.run(main())
```

## One-Shot Synthesis

```python
async def main():
    tts = ElevenLabsStreamer()
    result = await tts.synthesize("Hello, welcome!")
    
    with open("greeting.mp3", "wb") as f:
        f.write(result.audio)
```

## Interrupt Support

```python
cancel = asyncio.Event()

# In another coroutine (e.g., barge-in detection):
cancel.set()  # Immediately stops streaming

async for chunk in tts.stream(text_gen, cancel=cancel):
    await send(chunk)
```

## Language Configuration

The package maps language codes to recommended ElevenLabs voices:

| Language | Code | Default Voice |
|----------|------|---------------|
| English (US) | `en-US` | Rachel |
| English (UK) | `en-GB` | George |
| Spanish | `es` | Matilda |
| French | `fr` | Charlotte |
| German | `de` | Charlotte |
| Portuguese (BR) | `pt-BR` | Matilda |
| Japanese | `ja` | Callum |
| Korean | `ko` | Callum |
| Chinese | `zh` | Callum |

```python
# Host app passes its locale
tts = ElevenLabsStreamer(TTSConfig(language=app.current_locale))
```

## Custom Provider

Implement `TTSProvider` to add new backends:

```python
from radiant_tts.base import TTSProvider, TTSResult

class OpenAITTS(TTSProvider):
    async def stream(self, text_chunks, cancel=None):
        # Your implementation
        ...

    async def synthesize(self, text: str) -> TTSResult:
        # Your implementation
        ...

    async def is_available(self) -> bool:
        return bool(os.environ.get("OPENAI_API_KEY"))
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEVENLABS_API_KEY` | Yes (unless passed in TTSConfig) | ElevenLabs API key |

## Output Formats

Configure via `TTSConfig.output_format`:

- `mp3_44100_128` (default) — Best quality MP3
- `mp3_44100_64` — Smaller MP3
- `mp3_22050_32` — Lowest quality MP3
- `pcm_16000` — Raw PCM 16kHz (for real-time pipelines)
- `pcm_24000` — Raw PCM 24kHz
