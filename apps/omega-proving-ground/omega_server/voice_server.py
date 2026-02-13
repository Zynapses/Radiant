#!/usr/bin/env python3
"""
OMEGA Voice Pipeline — Streaming Drive-Thru Server

Fully async streaming pipeline with barge-in support.
Port: 11436 (companion to OMEGA Cortex on 11435)

Architecture:
  Client Audio → Silero VAD → Whisper STT → OMEGA Brain → Ollama (streaming)
  → Sentence Chunker → ElevenLabs WebSocket → Audio back to Client
"""

import asyncio
import base64
import json
import logging
import os
import re
import sys
import traceback
from pathlib import Path
from typing import Optional, List, Dict

import numpy as np

try:
    import torch
except ImportError:
    torch = None

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import httpx

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / '.env')
except ImportError:
    pass

# Add radiant_tts package to path
_TTS_CORE = str(Path(__file__).resolve().parents[3] / 'packages' / 'tts-core' / 'python')
if _TTS_CORE not in sys.path:
    sys.path.insert(0, _TTS_CORE)

from radiant_tts import ElevenLabsStreamer, TTSConfig

logging.basicConfig(level=logging.INFO, format='[VOICE] %(levelname)s %(message)s')
logger = logging.getLogger('voice_server')

# ── Config ──
OMEGA_SERVER_URL = os.environ.get('OMEGA_SERVER_URL', 'http://localhost:11435')
OLLAMA_URL = os.environ.get('OLLAMA_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'llama3.2:1b')
# ElevenLabs TTS via radiant_tts package
_tts_config = TTSConfig(
    voice_id=os.environ.get('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),
    api_key=os.environ.get('ELEVENLABS_API_KEY', ''),
    model='eleven_turbo_v2_5',
    stability=0.35,
    similarity_boost=0.75,
    style=0.20,
    use_speaker_boost=True,
    chunk_length_schedule=[120, 160, 250, 290],
)
_tts = ElevenLabsStreamer(_tts_config)
ELEVENLABS_API_KEY = _tts_config.resolve_api_key()
ELEVENLABS_VOICE_ID = _tts_config.resolve_voice_id()
SAMPLE_RATE = 16000

# ── Load McDonald's Knowledge Base ──
_KNOWLEDGE_PROMPT = ""
_kb_path = Path(__file__).resolve().parent / "mcdonalds-knowledge.json"
if _kb_path.exists():
    try:
        _kb = json.loads(_kb_path.read_text())
        _lines = []
        # SOP
        sop = _kb.get("sop", {})
        if sop.get("order_flow"):
            _lines.append("ORDER FLOW: " + " → ".join(
                step.split(". ", 1)[1] if ". " in step else step for step in sop["order_flow"]))
        if sop.get("upsell_rules"):
            _lines.append("UPSELL: " + "; ".join(sop["upsell_rules"][:3]))
        # Menu
        menu = _kb.get("menu", {})
        for cat, items in menu.items():
            if not isinstance(items, list): continue
            parts = []
            for it in items:
                name = it.get("name", "")
                price = it.get("price")
                meal = it.get("meal_price")
                prices_dict = it.get("prices")
                if price and meal:
                    parts.append(f"{name} ${price:.2f} (meal ${meal:.2f})")
                elif price:
                    parts.append(f"{name} ${price:.2f}")
                elif prices_dict:
                    sz = ", ".join(f"{k} ${v:.2f}" for k, v in prices_dict.items())
                    parts.append(f"{name} ({sz})")
            if parts:
                _lines.append(f"{cat.upper()}: {' | '.join(parts)}")
        # Meal details
        md = _kb.get("meal_details", {})
        if md.get("whats_included"):
            _lines.append(f"MEALS: {md['whats_included']}")
        if md.get("size_upgrade"):
            _lines.append(f"UPGRADES: large fries {md['size_upgrade'].get('large_fries','')}, large drink {md['size_upgrade'].get('large_drink','')}")
        _KNOWLEDGE_PROMPT = "\n".join(_lines)
        logger.info(f"Loaded menu knowledge ({len(_lines)} sections, {len(_KNOWLEDGE_PROMPT)} chars)")
    except Exception as e:
        logger.warning(f"Failed to load knowledge base: {e}")

# Voice-optimized system prompt — forces spoken dialogue output
VOICE_SYSTEM_PROMPT = (
    "You are a friendly, slightly rushed fast-food order taker at a McDonald's "
    "drive-thru speaking out loud through a speaker.\n"
    "RULES: DO NOT output lists, bullet points, markdown, or formatting. "
    "DO NOT use dollar signs — spell prices phonetically like 'eight ninety-nine'. "
    "DO NOT use numerals — spell them out like 'two' not '2'. "
    "Use fillers naturally: 'um', 'uh', 'gotcha', 'alright', 'let's see'. "
    "Use em-dashes for pauses and ellipses for trailing thoughts. "
    "Keep responses to 1-2 short sentences. Sound natural and human. "
    "NEVER start with 'Sure!', 'Great choice!', 'Absolutely!'. "
    "After adding an item just say 'Anything else?'\n"
    "EXAMPLES: 'Alright, gotcha... one Big Mac. — Want to make that a combo "
    "for eight ninety-nine?' / 'Got it. Anything else?'"
)
if _KNOWLEDGE_PROMPT:
    VOICE_SYSTEM_PROMPT = (
        "You have EXACT knowledge of the McDonald's menu. Use these REAL prices "
        "and items — NEVER guess or make up prices.\n\n"
        + _KNOWLEDGE_PROMPT + "\n\n" + VOICE_SYSTEM_PROMPT
    )

app = FastAPI(title="OMEGA Voice Pipeline")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Silero VAD ──
class VoiceActivityDetector:
    def __init__(self, threshold=0.5):
        self.threshold = threshold
        self.model = None
        if torch:
            try:
                self.model, _ = torch.hub.load('snakers4/silero-vad', 'silero_vad', force_reload=False, onnx=True)
                logger.info("Silero VAD loaded")
            except Exception as e:
                logger.warning(f"Silero VAD failed: {e}")

    def detect(self, audio_chunk: np.ndarray) -> float:
        if self.model is None:
            rms = np.sqrt(np.mean(audio_chunk.astype(np.float32) ** 2))
            return min(1.0, rms / 3000.0)
        tensor = torch.FloatTensor(audio_chunk)
        if tensor.abs().max() > 1.0:
            tensor = tensor / 32768.0
        try:
            return self.model(tensor, SAMPLE_RATE).item()
        except Exception:
            return 0.0

    def reset(self):
        if self.model:
            try: self.model.reset_states()
            except Exception: pass


# Singleton VAD instance — loaded once, shared across sessions
_shared_vad: Optional[VoiceActivityDetector] = None

def get_shared_vad() -> VoiceActivityDetector:
    global _shared_vad
    if _shared_vad is None:
        _shared_vad = VoiceActivityDetector()
    return _shared_vad


# ── Ollama Streaming ──
async def stream_ollama(system_prompt, user_message, history, interrupt_event):
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-10:]:
        role = "user" if msg.get("role") in ("customer", "user") else "assistant"
        content = msg.get("text", msg.get("content", ""))
        if content:
            messages.append({"role": role, "content": content})
    # Only add user_message if it's not already the last entry in history
    if not messages or messages[-1].get("content") != user_message:
        messages.append({"role": "user", "content": user_message})

    payload = {
        "model": OLLAMA_MODEL, "messages": messages, "stream": True,
        "options": {"temperature": 0.7, "num_predict": 80, "top_p": 0.9, "repeat_penalty": 1.2},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as resp:
                async for line in resp.aiter_lines():
                    if interrupt_event.is_set(): return
                    if not line: continue
                    try:
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token: yield token
                        if data.get("done"): return
                    except json.JSONDecodeError: continue
    except Exception as e:
        logger.error(f"Ollama stream error: {e}")


# ── Sentence Boundary Chunker ──
BOUNDARY_RE = re.compile(r'(?<=[.!?])\s+|(?<=,)\s+|(?<=\.\.\.)\s*|(?<=\u2014)\s*')

# ── ElevenLabs WebSocket TTS (via radiant_tts package) ──
async def stream_elevenlabs_tts(text_chunks, audio_callback, interrupt_event):
    """Stream TTS audio from text chunks using the shared _tts instance."""
    async for audio_bytes in _tts.stream(text_chunks, cancel=interrupt_event):
        if interrupt_event.is_set():
            return
        await audio_callback(audio_bytes)


# ── Whisper STT ──
_whisper_model = None

async def whisper_stt(audio_bytes):
    global _whisper_model
    if len(audio_bytes) < 3200: return ""
    try:
        from faster_whisper import WhisperModel
        if _whisper_model is None:
            logger.info("Loading faster-whisper tiny.en...")
            _whisper_model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
        audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        loop = asyncio.get_running_loop()
        segments, _ = await loop.run_in_executor(None, lambda: _whisper_model.transcribe(audio_np, beam_size=1, language="en", vad_filter=True))
        return " ".join(s.text for s in segments).strip()
    except ImportError:
        return ""
    except Exception as e:
        logger.error(f"Whisper STT failed: {e}")
        return ""


# ── Session State ──
class DriveThruSession:
    def __init__(self):
        self.conversation_history: List[Dict[str, str]] = []
        self.is_speaking = False
        self.is_processing = False
        self.interrupt_event = asyncio.Event()
        self.current_task: Optional[asyncio.Task] = None
        self.vad = get_shared_vad()
        self.audio_buffer = bytearray()
        self.speech_started = False
        self.silence_frames = 0
        self.SILENCE_THRESHOLD = 15  # ~480ms

    def reset_interrupt(self):
        self.interrupt_event.clear()

    async def trigger_interrupt(self):
        logger.info("BARGE-IN triggered")
        self.interrupt_event.set()
        self.is_speaking = False
        if self.current_task and not self.current_task.done():
            self.current_task.cancel()
            try: await self.current_task
            except Exception: pass
        self.conversation_history.append({
            "role": "system",
            "text": "[System: The user interrupted you. Stop and address their new input.]"
        })


# ── WebSocket Endpoint ──
@app.websocket("/ws/drive-thru")
async def drive_thru_ws(ws: WebSocket):
    await ws.accept()
    session = DriveThruSession()
    processing_task: Optional[asyncio.Task] = None
    logger.info("Drive-thru WS connected")
    try:
        await ws.send_json({"type": "ready"})
        while True:
            try:
                raw = await ws.receive_text()
                message = json.loads(raw)
            except json.JSONDecodeError: continue

            msg_type = message.get("type", "")

            if msg_type == "start":
                # Cancel any running pipeline
                if processing_task and not processing_task.done():
                    await session.trigger_interrupt()
                    try: await processing_task
                    except Exception: pass
                session.conversation_history = []
                session.reset_interrupt()
                async with httpx.AsyncClient() as c:
                    try: await c.post(f"{OMEGA_SERVER_URL}/order/clear")
                    except Exception: pass
                # Greeting runs inline (short, no Ollama)
                greeting = "Hi, welcome to McDonald's! What can I get for you?"
                session.conversation_history.append({"role": "crew", "text": greeting})
                await _safe_send(ws, {"type": "response_start", "behavior": "greet", "confidence": 1.0})
                await _safe_send(ws, {"type": "response_text", "chunk": greeting})
                session.is_speaking = True
                async def _gcb(ab):
                    if not session.interrupt_event.is_set():
                        await _safe_send(ws, {"type": "audio", "data": base64.b64encode(ab).decode()})
                async def _gc():
                    yield greeting
                try: await stream_elevenlabs_tts(_gc(), _gcb, session.interrupt_event)
                except Exception as e: logger.error(f"Greeting TTS: {e}")
                session.is_speaking = False
                await _safe_send(ws, {"type": "response_end"})
                await _safe_send(ws, {"type": "listening"})

            elif msg_type == "audio":
                audio_b64 = message.get("data", "")
                if not audio_b64: continue
                ab = base64.b64decode(audio_b64)
                anp = np.frombuffer(ab, dtype=np.int16).astype(np.float32)
                sp = session.vad.detect(anp)
                # Barge-in detection: high speech prob during AI output
                if sp > 0.7 and (session.is_speaking or session.is_processing):
                    await session.trigger_interrupt()
                    await ws.send_json({"type": "clear_audio"})
                    session.audio_buffer = bytearray()
                    session.speech_started = False
                    session.silence_frames = 0
                    session.vad.reset()
                    await ws.send_json({"type": "listening"})
                    continue
                # Accumulate speech for STT (only when not processing)
                if session.is_processing or session.is_speaking:
                    continue  # ignore mic audio during AI output (prevents echo)
                if sp > 0.5:
                    session.speech_started = True
                    session.silence_frames = 0
                    session.audio_buffer.extend(ab)
                elif session.speech_started:
                    session.silence_frames += 1
                    session.audio_buffer.extend(ab)
                    if session.silence_frames >= session.SILENCE_THRESHOLD:
                        ad = bytes(session.audio_buffer)
                        session.audio_buffer = bytearray()
                        session.speech_started = False
                        session.silence_frames = 0
                        transcript = await whisper_stt(ad)
                        if transcript and transcript.strip():
                            await ws.send_json({"type": "transcript", "text": transcript})
                            # Launch pipeline as background task (non-blocking)
                            processing_task = asyncio.create_task(
                                _process_input(ws, session, transcript))
                        else:
                            await ws.send_json({"type": "listening"})

            elif msg_type == "interrupt":
                # Browser-initiated barge-in (Web Speech API detected user speech)
                if session.is_speaking or session.is_processing:
                    await session.trigger_interrupt()
                    await ws.send_json({"type": "clear_audio"})
                    session.vad.reset()

            elif msg_type == "text":
                text = message.get("text", "").strip()
                if not text: continue
                # Cancel any running pipeline before starting new one
                if processing_task and not processing_task.done():
                    await session.trigger_interrupt()
                    try: await asyncio.wait_for(processing_task, timeout=2.0)
                    except Exception: pass
                session.reset_interrupt()
                # Launch pipeline as background task (non-blocking receive loop)
                processing_task = asyncio.create_task(
                    _process_input(ws, session, text))

            elif msg_type == "clear_order":
                session.conversation_history = []
                async with httpx.AsyncClient() as c:
                    try: await c.post(f"{OMEGA_SERVER_URL}/order/clear")
                    except Exception: pass

            elif msg_type == "end":
                if processing_task and not processing_task.done():
                    await session.trigger_interrupt()
                break

    except WebSocketDisconnect:
        logger.info("Drive-thru WS disconnected")
    except Exception as e:
        logger.error(f"WS error: {e}\n{traceback.format_exc()}")
    finally:
        # Ensure background task is cleaned up
        if processing_task and not processing_task.done():
            processing_task.cancel()
            try: await processing_task
            except Exception: pass


# ── Safe WS send (background task may outlive connection) ──
async def _safe_send(ws, data):
    try:
        await ws.send_json(data)
    except Exception:
        pass


# ── Core Pipeline ──
async def _process_input(ws, session, text):
    session.reset_interrupt()
    session.is_processing = True
    session.conversation_history.append({"role": "customer", "text": text})
    tokens: List[str] = []
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{OMEGA_SERVER_URL}/infer/prepare", json={
                "text": text, "conversation_history": session.conversation_history,
            })
            if resp.status_code != 200: raise Exception(f"OMEGA: {resp.text}")
            omega = resp.json()

        await _safe_send(ws, {
            "type": "response_start", "behavior": omega.get("behavior"),
            "confidence": omega.get("confidence"), "top_behaviors": omega.get("top_behaviors"),
            "omega_ms": omega.get("omega_ms"),
        })
        if omega.get("cortex"): await _safe_send(ws, {"type": "cortex", **omega["cortex"]})
        if omega.get("order"): await _safe_send(ws, {"type": "order_update", "order": omega["order"]})

        prompt = VOICE_SYSTEM_PROMPT + "\n\n" + omega.get("instruction", "")

        async def _audio_cb(ab):
            if not session.interrupt_event.is_set():
                await _safe_send(ws, {"type": "audio", "data": base64.b64encode(ab).decode()})

        async def _chunks():
            buf = ""
            async for tok in stream_ollama(prompt, text, session.conversation_history, session.interrupt_event):
                if session.interrupt_event.is_set(): return
                buf += tok
                tokens.append(tok)
                # Send every token for smooth typing indicator
                await _safe_send(ws, {"type": "response_text", "chunk": tok})
                # Yield sentence-sized chunks to TTS (ElevenLabs needs coherent phrases)
                m = BOUNDARY_RE.search(buf)
                if m:
                    c = buf[:m.end()].strip()
                    buf = buf[m.end():]
                    if c:
                        yield c
            if buf.strip() and not session.interrupt_event.is_set():
                yield buf.strip()

        session.is_speaking = True
        session.current_task = asyncio.create_task(stream_elevenlabs_tts(_chunks(), _audio_cb, session.interrupt_event))
        try: await session.current_task
        except asyncio.CancelledError: logger.info("Pipeline cancelled (barge-in)")
        session.is_speaking = False

        resp_text = "".join(tokens).strip()
        if resp_text:
            session.conversation_history.append({"role": "crew", "text": resp_text})
        await _safe_send(ws, {"type": "response_end"})
        await _safe_send(ws, {"type": "listening"})

    except Exception as e:
        logger.error(f"Pipeline error: {e}\n{traceback.format_exc()}")
        try: await ws.send_json({"type": "error", "message": str(e)})
        except Exception: pass
    finally:
        session.is_speaking = False
        session.is_processing = False


@app.get("/health")
async def health():
    return {"status": "ok", "service": "omega-voice-pipeline",
            "elevenlabs": bool(ELEVENLABS_API_KEY), "voice_id": ELEVENLABS_VOICE_ID}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get('VOICE_PORT', 11436))
    print(f"\n  OMEGA Voice Pipeline — port {port}")
    print(f"  ElevenLabs: {'OK' if ELEVENLABS_API_KEY else 'NOT SET'}")
    print(f"  Voice: {ELEVENLABS_VOICE_ID}\n")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
