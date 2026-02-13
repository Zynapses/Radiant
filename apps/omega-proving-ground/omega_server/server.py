#!/usr/bin/env python3
"""
OMEGA Proving Ground — Local Cortex Server

Wraps the ACTUAL RADIANT omega_core Python modules as a local HTTP API.
Changes to omega_core/ are made in-place → migrate directly back to RADIANT.

Endpoints:
  POST /boot          — Create/wake a brain instance
  POST /think         — Run inference cycle (input → cortex → helix → output)
  POST /dream         — Trigger dream cycle (memory consolidation)
  GET  /state         — Get full brain state (coherence, phase, magnitude, ambition)
  POST /firmware/load — Load .bio firmware into brain
  GET  /firmware      — Get active firmware info
  POST /ambition/reward  — Send reward signal
  POST /ambition/error   — Send error signal
  GET  /ambition         — Get ambition state
  POST /reset            — Reset brain to fresh state
  GET  /health           — Health check
"""

import sys
import os
import io
import re
import time
import json
import hashlib
import logging
import traceback
import asyncio
import atexit
from pathlib import Path

# Load .env file if present (for API keys like ELEVENLABS_API_KEY, OPENAI_API_KEY)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / '.env')
    load_dotenv()  # Also check cwd
except ImportError:
    pass  # python-dotenv not installed — use shell env vars

# Add shared packages to Python path
RADIANT_ROOT = Path(__file__).resolve().parents[3]

# radiant_omega — see packages/omega-core/python/README.md
_OMEGA_PKG = str(RADIANT_ROOT / 'packages' / 'omega-core' / 'python')
if _OMEGA_PKG not in sys.path:
    sys.path.insert(0, _OMEGA_PKG)

# radiant_tts — see packages/tts-core/python/README.md
_TTS_CORE = str(RADIANT_ROOT / 'packages' / 'tts-core' / 'python')
if _TTS_CORE not in sys.path:
    sys.path.insert(0, _TTS_CORE)

import torch
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

from radiant_omega.physics import OmegaCortex, PhysicsConfig, HelixKernel, CryoLiquidLayer, get_omega_device
from radiant_omega.ambition import HomeostaticLoop, AmbitionState, AmbitionConfig, DriveSignal
from radiant_omega.firmware import FirmwareManager, FirmwareSpec, FirmwareMetadata, HelixRule, AmbitionSettings, PersonalityTraits
from radiant_omega.bridge import NeuralTransducer, BridgeConfig, ThoughtVectorCache
from radiant_omega.reflection import Watcher, WatcherTrainer, WatcherConfig, SelfModelMetrics
from radiant_omega.library import ResonantIndex
from radiant_omega.trainer import (
    BehavioralCodebook, OmegaTrainer, TrainingExample,
    load_training_data, load_knowledge_base, BEHAVIOR_TYPES,
)
from llama_bridge import LlamaBridge

logging.basicConfig(level=logging.INFO, format='[OMEGA] %(levelname)s %(message)s')
logger = logging.getLogger('omega_server')

app = Flask(__name__)
CORS(app)

# Paths to datasets (each proving-ground app keeps its own data)
APPS_DIR = Path(__file__).parent.parent / 'apps'
DATASET_DIR = APPS_DIR / 'mcdonalds-drive-thru' / 'datasets'
KNOWLEDGE_PATH = DATASET_DIR / 'mcdonalds-knowledge.json'
TRAINING_PATH = DATASET_DIR / 'mcdonalds-behavioral-training.jsonl'

# State directory for local persistence
OMEGA_CORE_PATH = Path(__file__).parent / 'state'
BRAIN_STATE_DIR = OMEGA_CORE_PATH / 'brain'


# ============================================================================
# LOCAL STORAGE MANAGER — State Persistence for Proving Ground
# ============================================================================

class LocalStorageManager:
    """Local file persistence for proving ground brain state.
    Lightweight alternative to radiant_omega.storage.StorageManager (which needs AWS).
    Uses atomic writes (tmp + os.replace) for crash safety."""

    def __init__(self, state_dir: Path = None):
        self.state_dir = state_dir or BRAIN_STATE_DIR
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.auto_save_interval = 10  # save every N inferences

    def save(self, brain: 'LocalBrain') -> dict:
        """Atomically save full brain state to disk."""
        state_path = self.state_dir / 'brain.pt'
        meta_path = self.state_dir / 'brain.meta.json'
        tmp_path = self.state_dir / 'brain.pt.tmp'

        state_dict = {
            'cortex_state_dict': brain.cortex.state_dict(),
            'brain_state': brain.cortex.state.cpu(),
            'config': {
                'input_dim': brain.config.input_dim,
                'hidden_dim': brain.config.hidden_dim,
                'dt': brain.config.dt,
                'decay_rate': brain.config.decay_rate,
            },
            'ambition_state': brain.ambition.state.to_dict(),
            'inference_count': brain.inference_count,
            'boot_time': brain.boot_time,
            'is_trained': brain.is_trained,
            'save_time': time.time(),
        }

        # Save watcher state if initialized
        if brain.watcher:
            state_dict['watcher_state_dict'] = brain.watcher.state_dict()
        if brain.self_metrics:
            state_dict['self_metrics_state'] = {
                'surprise_ema': brain.self_metrics.surprise_ema,
                'total_observations': brain.self_metrics.total_observations,
                'reward_count': brain.self_metrics.reward_count,
                'error_count': brain.self_metrics.error_count,
            }

        # Save resonant index state
        if brain.resonant_index and brain.resonant_index.total_documents > 0:
            state_dict['resonant_index_state'] = brain.resonant_index.export_state()

        # Save text encoder if trained
        if brain.trainer and brain.trainer.text_encoder.vocab_built:
            state_dict['text_encoder_state'] = brain.trainer.text_encoder.state_dict()
            state_dict['text_encoder_vocab'] = brain.trainer.text_encoder.word_to_idx

        # Atomic write
        torch.save(state_dict, str(tmp_path))
        os.replace(str(tmp_path), str(state_path))

        # Save metadata as readable JSON
        coherence = 0.0
        try:
            coherence = brain.cortex.pfc.get_coherence_score(brain.cortex.state)
        except Exception:
            pass

        metadata = {
            'saved_at': time.time(),
            'saved_at_iso': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'inference_count': brain.inference_count,
            'coherence': round(coherence, 6),
            'ambition': brain.ambition.state.to_dict(),
            'is_trained': brain.is_trained,
            'watcher_observations': brain.self_metrics.total_observations if brain.self_metrics else 0,
            'resonant_documents': brain.resonant_index.total_documents if brain.resonant_index else 0,
        }
        with open(meta_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Brain state saved: inferences={brain.inference_count}, coherence={coherence:.4f}")
        return metadata

    def load(self) -> dict | None:
        """Load brain state from disk. Returns None if no saved state."""
        state_path = self.state_dir / 'brain.pt'
        if not state_path.exists():
            return None
        try:
            return torch.load(str(state_path), map_location='cpu', weights_only=False)
        except Exception as e:
            logger.error(f"Failed to load brain state: {e}")
            return None

    def has_saved_state(self) -> bool:
        return (self.state_dir / 'brain.pt').exists()

    def get_metadata(self) -> dict | None:
        meta_path = self.state_dir / 'brain.meta.json'
        if not meta_path.exists():
            return None
        try:
            with open(meta_path, 'r') as f:
                return json.load(f)
        except Exception:
            return None


# ============================================================================
# BRAIN STATE (single-tenant local instance)
# ============================================================================

class LocalBrain:
    """Local OMEGA brain instance for the Proving Ground."""

    def __init__(self):
        self.cortex: OmegaCortex = None
        self.ambition: HomeostaticLoop = None
        self.transducer: NeuralTransducer = None
        self.thought_cache: ThoughtVectorCache = None
        self.firmware: FirmwareSpec = None
        self.firmware_manager = FirmwareManager(
            firmware_dir=str(Path(__file__).parent / "state" / "firmware")
        )
        self.boot_time: float = 0
        self.inference_count: int = 0
        self.inference_log: list = []
        self.config = PhysicsConfig()

        # Watcher (self-awareness via predictive processing)
        self.watcher: Watcher = None
        self.watcher_trainer: WatcherTrainer = None
        self.self_metrics: SelfModelMetrics = None

        # Resonant Index (O(1) phase-based memory lookup)
        self.resonant_index: ResonantIndex = None

        # Local storage for state persistence
        self.storage = LocalStorageManager()

        # Training state
        self.codebook: BehavioralCodebook = None
        self.trainer: OmegaTrainer = None
        self.llama_bridge: LlamaBridge = None
        self.training_examples: list = []
        self.knowledge_base: dict = {}
        self.is_trained: bool = False
        self.training_history: list = []

    def boot(self, config: dict = None) -> dict:
        """Boot an OMEGA brain. Auto-loads saved state if available."""
        if config:
            self.config = PhysicsConfig(
                input_dim=config.get('input_dim', 1024),
                hidden_dim=config.get('hidden_dim', 2048),
                dt=config.get('dt', 0.01),
                decay_rate=config.get('decay_rate', 0.1),
                phase_lock_threshold=config.get('phase_lock_threshold', 0.8),
            )

        self.cortex = OmegaCortex(self.config)
        self.ambition = HomeostaticLoop(
            dream_callback=self._dream_callback,
        )
        self.transducer = NeuralTransducer(BridgeConfig(
            omega_dim=self.config.hidden_dim,
        )).to(self.config.device)
        self.thought_cache = ThoughtVectorCache()
        self.boot_time = time.time()
        self.inference_count = 0
        self.inference_log = []

        # Initialize Watcher (self-awareness)
        watcher_config = WatcherConfig(
            input_dim=self.config.input_dim,
            cortex_dim=self.config.hidden_dim,
        )
        self.watcher = Watcher(watcher_config).to(self.config.device)
        self.watcher.eval()
        self.watcher_trainer = WatcherTrainer(self.watcher, watcher_config)
        self.self_metrics = SelfModelMetrics(watcher_config)

        # Initialize Resonant Index (O(1) phase memory)
        self.resonant_index = ResonantIndex(resolution=1000)

        # Try to restore saved state (conscious/subconscious recovery)
        saved = self.storage.load()
        if saved and not config:  # Only restore if not explicitly reconfiguring
            try:
                self._restore_state(saved)
                logger.info("Brain restored from saved state")
                return self.get_state()
            except Exception as e:
                logger.warning(f"Failed to restore saved state, booting fresh: {e}")

        logger.info(
            f"Brain booted: input_dim={self.config.input_dim}, "
            f"hidden_dim={self.config.hidden_dim}, "
            f"device={self.config.device}, "
            f"watcher_params={self.watcher.param_count():,}, "
            f"transducer_params={self.transducer.param_count():,}"
        )

        return self.get_state()

    async def _dream_callback(self):
        """Called by HomeostaticLoop when entropy triggers a dream."""
        if self.is_booted():
            self.dream()

    def _restore_state(self, saved: dict):
        """Restore brain from a saved state dict."""
        # Restore cortex weights and state
        self.cortex.load_state_dict(saved['cortex_state_dict'])
        self.cortex.state = saved['brain_state'].to(self.config.device)

        # Apply time-warp for elapsed time (conscious fades, subconscious remains)
        elapsed = time.time() - saved.get('save_time', time.time())
        if elapsed > 0:
            delta_t = self.cortex.wake(time.time())
            self.ambition.time_warp_state(elapsed)
            logger.info(f"Time-warped brain by {elapsed:.0f}s (conscious decay applied)")

        # Restore ambition state
        if 'ambition_state' in saved:
            self.ambition.state = AmbitionState.from_dict(saved['ambition_state'])

        # Restore counters
        self.inference_count = saved.get('inference_count', 0)
        self.is_trained = saved.get('is_trained', False)
        self.boot_time = saved.get('boot_time', time.time())

        # Restore watcher
        if 'watcher_state_dict' in saved and self.watcher:
            self.watcher.load_state_dict(saved['watcher_state_dict'])
            self.watcher.eval()
        if 'self_metrics_state' in saved and self.self_metrics:
            ms = saved['self_metrics_state']
            self.self_metrics.surprise_ema = ms.get('surprise_ema', 0.5)
            self.self_metrics.total_observations = ms.get('total_observations', 0)
            self.self_metrics.reward_count = ms.get('reward_count', 0)
            self.self_metrics.error_count = ms.get('error_count', 0)

        # Restore resonant index
        if 'resonant_index_state' in saved and self.resonant_index:
            self.resonant_index.import_state(saved['resonant_index_state'])

    def is_booted(self) -> bool:
        return self.cortex is not None

    def vectorize_input(self, text: str) -> torch.Tensor:
        """Convert text to complex input vector using hash-based embedding."""
        dim = self.config.input_dim
        text_bytes = text.encode('utf-8')
        hash_bytes = hashlib.sha256(text_bytes).digest()

        expanded = []
        for i in range(dim):
            h = hashlib.sha256(hash_bytes + i.to_bytes(4, 'big')).digest()
            val = (int.from_bytes(h[:4], 'big') / (2**32)) * 2 - 1
            phase = (int.from_bytes(h[4:8], 'big') / (2**32)) * 2 * 3.14159 - 3.14159
            expanded.append(complex(val * 0.5, phase))

        return torch.tensor(expanded, dtype=torch.complex64, device=self.config.device)

    def think(self, text: str) -> dict:
        """Full inference cycle through the OMEGA cortex."""
        if not self.is_booted():
            raise RuntimeError("Brain not booted")

        start = time.time()

        # 1. Wake (apply time-warp for elapsed time)
        delta_t = self.cortex.wake(time.time())

        # 2. Ambition: receive input
        self.ambition.receive_input()

        # 3. Vectorize input
        input_vec = self.vectorize_input(text)

        # 4. Pre-think state
        pre_coherence = self.cortex.pfc.get_coherence_score(self.cortex.state)

        # 5. Think through cortex (PFC → Helix safety filter)
        output_vec = self.cortex.think(input_vec)

        # 6. Post-think state
        post_coherence = self.cortex.pfc.get_coherence_score(self.cortex.state)

        # 7. Safety check
        is_safe, max_alignment = self.cortex.helix.check_safety(output_vec)

        # 8. Generate soft tokens via transducer (for LLM injection)
        with torch.no_grad():
            soft_tokens = self.transducer(output_vec)
            injection_meta = self.transducer.get_injection_metadata(output_vec)

        # 9. Watcher: predict-and-surprise (self-awareness)
        watcher_result = {}
        if self.watcher and self.self_metrics:
            predicted, surprise = self.watcher.predict_and_surprise(input_vec, output_vec)
            surprise_val = surprise.item()
            observation = self.self_metrics.observe(surprise_val)
            watcher_result = {
                'surprise': round(surprise_val, 6),
                'surprise_ema': round(self.self_metrics.surprise_ema, 6),
                'self_awareness_score': round(max(0, 1.0 - self.self_metrics.surprise_ema), 4),
                'signal': observation['signal'],
            }
            # Feed watcher signal into ambition
            if observation['signal'] == 'reward':
                self.ambition.receive_reward(abs(observation['dopamine_delta']))
            elif observation['signal'] == 'error':
                self.ambition.receive_error(abs(observation['dopamine_delta']))
            # Record for dream-cycle training
            if self.watcher_trainer:
                self.watcher_trainer.record(input_vec, output_vec, post_coherence)

        # 10. Resonant Index: store this thought for O(1) recall
        if self.resonant_index:
            doc_id = f"inference-{self.inference_count + 1}"
            self.resonant_index.store(
                doc_id=doc_id,
                vector_embedding=output_vec.detach(),
                source_uri=f"local://inference/{doc_id}",
                title=text[:80],
                metadata={'coherence': post_coherence, 'safe': is_safe},
            )

        # 11. Ambition tick
        loop = asyncio.new_event_loop()
        signal = loop.run_until_complete(self.ambition.tick())
        loop.close()

        latency_ms = (time.time() - start) * 1000
        self.inference_count += 1

        # Extract state metrics
        magnitude = torch.abs(output_vec).float()
        phase = torch.angle(output_vec).float()

        result = {
            'inference_id': self.inference_count,
            'input_text': text,
            'latency_ms': round(latency_ms, 2),
            'delta_t': round(delta_t, 4),
            'pre_coherence': round(pre_coherence, 6),
            'post_coherence': round(post_coherence, 6),
            'coherence_delta': round(post_coherence - pre_coherence, 6),
            'is_safe': is_safe,
            'max_helix_alignment': round(max_alignment, 6),
            'helix_rules_count': len(self.cortex.helix.forbidden),
            'output_magnitude_mean': round(magnitude.mean().item(), 6),
            'output_magnitude_std': round(magnitude.std().item(), 6),
            'output_phase_mean': round(phase.mean().item(), 6),
            'output_phase_std': round(phase.std().item(), 6),
            'injection_metadata': injection_meta,
            'soft_tokens_shape': list(soft_tokens.shape),
            'ambition_signal': signal.value,
            'ambition_state': self.ambition.get_state_summary(),
            'state_norm': round(torch.abs(self.cortex.state).sum().item(), 6),
            'watcher': watcher_result,
        }

        self.inference_log.append({
            'id': self.inference_count,
            'text': text[:100],
            'coherence': post_coherence,
            'safe': is_safe,
            'latency_ms': latency_ms,
            'signal': signal.value,
            'ts': time.time(),
        })

        # Auto-save every N inferences
        if self.inference_count % self.storage.auto_save_interval == 0:
            try:
                self.storage.save(self)
            except Exception as e:
                logger.warning(f"Auto-save failed: {e}")

        return result

    def dream(self) -> dict:
        """Run dream cycle for memory consolidation."""
        if not self.is_booted():
            raise RuntimeError("Brain not booted")

        pre_coherence = self.cortex.pfc.get_coherence_score(self.cortex.state)

        # Collect replay logs from recent high-coherence inferences
        replay_logs = []
        for log_entry in self.inference_log[-20:]:
            if log_entry.get('coherence', 0) > 0.3:
                input_vec = self.vectorize_input(log_entry['text'])
                replay_logs.append({'input_vector': input_vec})

        # Run dream cycle
        self.cortex.state = self.cortex.pfc.dream_cycle(
            self.cortex.state,
            replay_logs=replay_logs if replay_logs else None,
        )

        post_coherence = self.cortex.pfc.get_coherence_score(self.cortex.state)

        # Train Watcher during dream cycle (self-model learns from replay buffer)
        watcher_training = {}
        if self.watcher_trainer:
            watcher_training = self.watcher_trainer.train_on_buffer()

        # Ambition: dream simulation
        loop = asyncio.new_event_loop()
        loop.run_until_complete(self.ambition.dream_simulation())
        loop.close()

        # Auto-save after dream (consolidation checkpoint)
        try:
            self.storage.save(self)
        except Exception as e:
            logger.warning(f"Post-dream save failed: {e}")

        return {
            'pre_coherence': round(pre_coherence, 6),
            'post_coherence': round(post_coherence, 6),
            'coherence_gain': round(post_coherence - pre_coherence, 6),
            'replay_count': len(replay_logs),
            'total_dreams': self.ambition.state.total_dreams,
            'ambition_state': self.ambition.get_state_summary(),
            'watcher_training': watcher_training,
        }

    def load_firmware(self, firmware_data: dict) -> dict:
        """Load firmware into the brain."""
        if not self.is_booted():
            raise RuntimeError("Brain not booted")

        # Parse firmware
        metadata = firmware_data.get('metadata', {})
        helix_rules = firmware_data.get('helix_rules', [])
        ambition = firmware_data.get('ambition_settings', {})
        personality = firmware_data.get('personality', {})

        spec = FirmwareSpec(
            metadata=FirmwareMetadata(
                name=metadata.get('name', 'Unknown'),
                version=metadata.get('version', '0.0.0'),
                author=metadata.get('author', 'local'),
                description=metadata.get('description', ''),
                created_at=metadata.get('created_at', ''),
            ),
            helix_rules=[HelixRule(**r) for r in helix_rules] if helix_rules else [],
            ambition_settings=AmbitionSettings(**ambition) if ambition else AmbitionSettings(),
            personality=PersonalityTraits(**personality) if personality else PersonalityTraits(),
        )

        # Apply to cortex
        self.cortex.helix.load_from_firmware([r.__dict__ for r in spec.helix_rules])
        self.ambition.update_config_from_firmware(ambition)
        self.firmware = spec

        return {
            'loaded': True,
            'name': spec.metadata.name,
            'version': spec.metadata.version,
            'helix_rules': len(spec.helix_rules),
            'ambition_settings': ambition,
            'personality': personality,
        }

    def get_state(self) -> dict:
        """Get full brain state snapshot."""
        if not self.is_booted():
            return {'booted': False}

        state = self.cortex.state
        coherence = self.cortex.pfc.get_coherence_score(state)
        magnitude = torch.abs(state).float()
        phase = torch.angle(state).float()

        # Phase distribution histogram (32 bins from -pi to pi)
        phase_hist = torch.histc(phase, bins=32, min=-3.14159, max=3.14159).tolist()
        mag_hist = torch.histc(magnitude, bins=32, min=0, max=2.0).tolist()

        return {
            'booted': True,
            'boot_time': self.boot_time,
            'uptime_seconds': round(time.time() - self.boot_time, 1),
            'inference_count': self.inference_count,
            'config': {
                'input_dim': self.config.input_dim,
                'hidden_dim': self.config.hidden_dim,
                'dt': self.config.dt,
                'decay_rate': self.config.decay_rate,
            },
            'cortex': {
                'coherence': round(coherence, 6),
                'state_norm': round(torch.abs(state).sum().item(), 6),
                'magnitude_mean': round(magnitude.mean().item(), 6),
                'magnitude_std': round(magnitude.std().item(), 6),
                'magnitude_max': round(magnitude.max().item(), 6),
                'magnitude_min': round(magnitude.min().item(), 6),
                'phase_mean': round(phase.mean().item(), 6),
                'phase_std': round(phase.std().item(), 6),
                'phase_histogram': phase_hist,
                'magnitude_histogram': mag_hist,
            },
            'helix': {
                'rules_count': len(self.cortex.helix.forbidden),
            },
            'ambition': self.ambition.get_state_summary(),
            'firmware': {
                'loaded': self.firmware is not None,
                'name': self.firmware.metadata.name if self.firmware else None,
                'version': self.firmware.metadata.version if self.firmware else None,
            },
            'transducer': {
                'params': self.transducer.param_count(),
                'omega_dim': self.transducer.config.omega_dim,
                'llm_dim': self.transducer.config.llm_dim,
                'num_soft_tokens': self.transducer.config.num_soft_tokens,
            },
            'watcher': self.self_metrics.get_summary() if self.self_metrics else None,
            'resonant_index': self.resonant_index.get_stats() if self.resonant_index else None,
            'storage': {
                'has_saved_state': self.storage.has_saved_state(),
                'auto_save_interval': self.storage.auto_save_interval,
                'metadata': self.storage.get_metadata(),
            },
            'recent_inferences': self.inference_log[-10:],
        }


# ============================================================================
# GLOBAL BRAIN INSTANCE
# ============================================================================

brain = LocalBrain()


# ============================================================================
# ROUTES
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'omega-proving-ground',
        'brain_booted': brain.is_booted(),
        'torch_version': torch.__version__,
        'device': 'mps' if torch.backends.mps.is_available() else 'cpu',
    })


@app.route('/boot', methods=['POST'])
def boot():
    try:
        config = request.json or {}
        result = brain.boot(config)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Boot failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/think', methods=['POST'])
def think():
    try:
        data = request.json or {}
        text = data.get('text', '')
        if not text:
            return jsonify({'error': 'text is required'}), 400

        result = brain.think(text)
        return jsonify(result)
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Think failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/dream', methods=['POST'])
def dream():
    try:
        result = brain.dream()
        return jsonify(result)
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Dream failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/state', methods=['GET'])
def state():
    try:
        return jsonify(brain.get_state())
    except Exception as e:
        logger.error(f"State failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/firmware/load', methods=['POST'])
def load_firmware():
    try:
        data = request.json or {}
        result = brain.load_firmware(data)
        return jsonify(result)
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Firmware load failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/firmware', methods=['GET'])
def get_firmware():
    if brain.firmware:
        return jsonify(brain.firmware.to_dict())
    return jsonify({'loaded': False})


@app.route('/ambition', methods=['GET'])
def get_ambition():
    if not brain.is_booted():
        return jsonify({'error': 'Brain not booted'}), 400
    return jsonify(brain.ambition.get_state_summary())


@app.route('/ambition/reward', methods=['POST'])
def ambition_reward():
    if not brain.is_booted():
        return jsonify({'error': 'Brain not booted'}), 400
    data = request.json or {}
    magnitude = data.get('magnitude', 0.5)
    brain.ambition.receive_reward(magnitude)
    return jsonify(brain.ambition.get_state_summary())


@app.route('/ambition/error', methods=['POST'])
def ambition_error():
    if not brain.is_booted():
        return jsonify({'error': 'Brain not booted'}), 400
    data = request.json or {}
    magnitude = data.get('magnitude', 0.3)
    brain.ambition.receive_error(magnitude)
    return jsonify(brain.ambition.get_state_summary())


@app.route('/reset', methods=['POST'])
def reset():
    try:
        config = request.json or {}
        result = brain.boot(config)
        return jsonify({'reset': True, **result})
    except Exception as e:
        logger.error(f"Reset failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# WATCHER — Self-Awareness via Predictive Processing
# ============================================================================

@app.route('/watcher', methods=['GET'])
def watcher_state():
    """Get Watcher self-awareness metrics."""
    if not brain.is_booted():
        return jsonify({'error': 'Brain not booted'}), 400
    result = {
        'initialized': brain.watcher is not None,
    }
    if brain.watcher:
        result['params'] = brain.watcher.param_count()
        result['config'] = {
            'input_dim': brain.watcher.config.input_dim,
            'cortex_dim': brain.watcher.config.cortex_dim,
            'hidden_dim': brain.watcher.config.hidden_dim,
            'surprise_reward_threshold': brain.watcher.config.surprise_reward_threshold,
            'surprise_error_threshold': brain.watcher.config.surprise_error_threshold,
        }
    if brain.self_metrics:
        result['metrics'] = brain.self_metrics.get_summary()
    if brain.watcher_trainer:
        result['trainer'] = {
            'buffer_size': len(brain.watcher_trainer.replay_buffer),
            'total_steps': brain.watcher_trainer.step_count,
            'loss_history': brain.watcher_trainer.loss_history[-20:],
        }
    return jsonify(result)


@app.route('/watcher/train', methods=['POST'])
def watcher_train():
    """Manually trigger Watcher training on replay buffer."""
    if not brain.is_booted() or not brain.watcher_trainer:
        return jsonify({'error': 'Watcher not initialized'}), 400
    data = request.json or {}
    max_steps = data.get('max_steps', None)
    result = brain.watcher_trainer.train_on_buffer(max_steps=max_steps)
    return jsonify(result)


# ============================================================================
# RESONANT MEMORY — O(1) Phase-Based Lookup
# ============================================================================

@app.route('/memory/stats', methods=['GET'])
def memory_stats():
    """Get Resonant Index statistics."""
    if not brain.is_booted() or not brain.resonant_index:
        return jsonify({'error': 'Resonant index not initialized'}), 400
    return jsonify(brain.resonant_index.get_stats())


@app.route('/memory/store', methods=['POST'])
def memory_store():
    """Manually store a document in the Resonant Index."""
    if not brain.is_booted() or not brain.resonant_index:
        return jsonify({'error': 'Resonant index not initialized'}), 400
    data = request.json or {}
    text = data.get('text', '')
    doc_id = data.get('doc_id', f'manual-{int(time.time())}')
    title = data.get('title', text[:80])
    source_uri = data.get('source_uri', f'manual://{doc_id}')

    if not text:
        return jsonify({'error': 'text is required'}), 400

    # Vectorize and store
    vec = brain.vectorize_input(text)
    doc = brain.resonant_index.store(
        doc_id=doc_id,
        vector_embedding=vec,
        source_uri=source_uri,
        title=title,
        metadata=data.get('metadata', {}),
    )
    return jsonify({
        'stored': True,
        'doc_id': doc.doc_id,
        'phase_bucket': doc.phase_bucket,
        'phase_angle': round(doc.phase_angle, 6),
    })


@app.route('/memory/retrieve', methods=['POST'])
def memory_retrieve():
    """Retrieve documents by phase resonance with a thought."""
    if not brain.is_booted() or not brain.resonant_index:
        return jsonify({'error': 'Resonant index not initialized'}), 400
    data = request.json or {}
    text = data.get('text', '')
    fuzzy_radius = data.get('fuzzy_radius', 2)
    max_results = data.get('max_results', 10)

    if not text:
        return jsonify({'error': 'text is required'}), 400

    vec = brain.vectorize_input(text)
    matches = brain.resonant_index.retrieve(vec, fuzzy_radius=fuzzy_radius, max_results=max_results)

    return jsonify({
        'query': text[:80],
        'matches': [{
            'doc_id': m.doc_id,
            'phase_distance': round(m.phase_distance, 6),
            'title': m.document.title if m.document else None,
            'source_uri': m.document.source_uri if m.document else None,
            'metadata': m.document.metadata if m.document else None,
        } for m in matches],
        'total': len(matches),
    })


@app.route('/memory/heatmap', methods=['GET'])
def memory_heatmap():
    """Get phase bucket heatmap for visualization."""
    if not brain.is_booted() or not brain.resonant_index:
        return jsonify({'error': 'Resonant index not initialized'}), 400
    return jsonify({
        'resolution': brain.resonant_index.resolution,
        'heatmap': brain.resonant_index.get_phase_heatmap(),
    })


# ============================================================================
# STATE PERSISTENCE — Save/Load Brain State
# ============================================================================

@app.route('/state/save', methods=['POST'])
def state_save():
    """Manually save brain state to disk."""
    if not brain.is_booted():
        return jsonify({'error': 'Brain not booted'}), 400
    try:
        metadata = brain.storage.save(brain)
        return jsonify({'saved': True, **metadata})
    except Exception as e:
        logger.error(f"Manual save failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/state/info', methods=['GET'])
def state_info():
    """Get saved state metadata without loading the full state."""
    metadata = brain.storage.get_metadata()
    return jsonify({
        'has_saved_state': brain.storage.has_saved_state(),
        'metadata': metadata,
        'auto_save_interval': brain.storage.auto_save_interval,
    })


@app.route('/state/config', methods=['POST'])
def state_config():
    """Configure auto-save interval."""
    data = request.json or {}
    if 'auto_save_interval' in data:
        brain.storage.auto_save_interval = max(1, int(data['auto_save_interval']))
    return jsonify({
        'auto_save_interval': brain.storage.auto_save_interval,
    })


# ============================================================================
# TUNABLE PARAMETERS — Runtime Configuration
# ============================================================================

@app.route('/config', methods=['GET'])
def get_config():
    """Get all tunable parameters."""
    if not brain.is_booted():
        return jsonify({'error': 'Brain not booted'}), 400
    return jsonify({
        'physics': {
            'input_dim': brain.config.input_dim,
            'hidden_dim': brain.config.hidden_dim,
            'dt': brain.config.dt,
            'decay_rate': brain.config.decay_rate,
            'phase_lock_threshold': brain.config.phase_lock_threshold,
            'device': str(brain.config.device),
        },
        'ambition': {
            'entropy_threshold': brain.ambition.config.entropy_threshold,
            'dopamine_decay_rate': brain.ambition.config.dopamine_decay_rate,
            'entropy_growth_rate': brain.ambition.config.entropy_growth_rate,
            'curiosity_bias': brain.ambition.config.curiosity_bias,
            'arousal_sensitivity': brain.ambition.config.arousal_sensitivity,
            'dream_cooldown_seconds': brain.ambition.config.dream_cooldown_seconds,
            'idle_threshold_ticks': brain.ambition.config.idle_threshold_ticks,
        },
        'watcher': {
            'surprise_ema_alpha': brain.watcher.config.surprise_ema_alpha if brain.watcher else None,
            'surprise_reward_threshold': brain.watcher.config.surprise_reward_threshold if brain.watcher else None,
            'surprise_error_threshold': brain.watcher.config.surprise_error_threshold if brain.watcher else None,
            'training_lr': brain.watcher.config.training_lr if brain.watcher else None,
        },
        'storage': {
            'auto_save_interval': brain.storage.auto_save_interval,
        },
        'resonant_index': {
            'resolution': brain.resonant_index.resolution if brain.resonant_index else None,
        },
    })


@app.route('/config', methods=['POST'])
def set_config():
    """Set tunable parameters at runtime. Only safe-to-change params allowed."""
    if not brain.is_booted():
        return jsonify({'error': 'Brain not booted'}), 400
    data = request.json or {}
    changed = []

    # Physics params (safe to hot-swap)
    if 'dt' in data:
        brain.cortex.pfc.dt = float(data['dt'])
        brain.config.dt = float(data['dt'])
        changed.append(f"dt={data['dt']}")
    if 'decay_rate' in data:
        brain.cortex.pfc.decay_rate = float(data['decay_rate'])
        brain.config.decay_rate = float(data['decay_rate'])
        changed.append(f"decay_rate={data['decay_rate']}")

    # Ambition params
    if 'entropy_threshold' in data:
        brain.ambition.config.entropy_threshold = float(data['entropy_threshold'])
        changed.append(f"entropy_threshold={data['entropy_threshold']}")
    if 'dopamine_decay_rate' in data:
        brain.ambition.config.dopamine_decay_rate = float(data['dopamine_decay_rate'])
        changed.append(f"dopamine_decay_rate={data['dopamine_decay_rate']}")
    if 'entropy_growth_rate' in data:
        brain.ambition.config.entropy_growth_rate = float(data['entropy_growth_rate'])
        changed.append(f"entropy_growth_rate={data['entropy_growth_rate']}")
    if 'dream_cooldown_seconds' in data:
        brain.ambition.config.dream_cooldown_seconds = float(data['dream_cooldown_seconds'])
        changed.append(f"dream_cooldown_seconds={data['dream_cooldown_seconds']}")

    # Storage
    if 'auto_save_interval' in data:
        brain.storage.auto_save_interval = max(1, int(data['auto_save_interval']))
        changed.append(f"auto_save_interval={data['auto_save_interval']}")

    logger.info(f"Config updated: {', '.join(changed)}")
    return jsonify({'changed': changed, 'count': len(changed)})


# ============================================================================
# MULTI-SESSION — Independent Brain Instances per Session
# ============================================================================

_sessions: dict[str, LocalBrain] = {}


@app.route('/sessions', methods=['GET'])
def list_sessions():
    """List all active brain sessions."""
    sessions = []
    for sid, b in _sessions.items():
        sessions.append({
            'session_id': sid,
            'booted': b.is_booted(),
            'inference_count': b.inference_count,
            'is_trained': b.is_trained,
        })
    # Include the default brain
    sessions.insert(0, {
        'session_id': 'default',
        'booted': brain.is_booted(),
        'inference_count': brain.inference_count,
        'is_trained': brain.is_trained,
    })
    return jsonify({'sessions': sessions, 'count': len(sessions)})


@app.route('/sessions/<session_id>/boot', methods=['POST'])
def session_boot(session_id):
    """Boot a new independent brain session."""
    if session_id == 'default':
        return jsonify({'error': 'Cannot re-boot default session via this endpoint'}), 400
    config = request.json or {}
    b = LocalBrain()
    b.storage = LocalStorageManager(state_dir=BRAIN_STATE_DIR / session_id)
    b.boot(config if config else None)
    _sessions[session_id] = b
    return jsonify({'session_id': session_id, 'booted': True, **b.get_state()})


@app.route('/sessions/<session_id>/think', methods=['POST'])
def session_think(session_id):
    """Think with a specific session brain."""
    b = _sessions.get(session_id)
    if not b or not b.is_booted():
        return jsonify({'error': f'Session {session_id} not found or not booted'}), 404
    data = request.json or {}
    text = data.get('text', '')
    if not text:
        return jsonify({'error': 'text is required'}), 400
    return jsonify(b.think(text))


@app.route('/sessions/<session_id>/state', methods=['GET'])
def session_state(session_id):
    """Get state of a specific session brain."""
    b = _sessions.get(session_id)
    if not b:
        return jsonify({'error': f'Session {session_id} not found'}), 404
    return jsonify(b.get_state())


@app.route('/sessions/<session_id>/destroy', methods=['POST'])
def session_destroy(session_id):
    """Destroy a session brain."""
    if session_id == 'default':
        return jsonify({'error': 'Cannot destroy default session'}), 400
    b = _sessions.pop(session_id, None)
    if b and b.is_booted():
        try:
            b.storage.save(b)
        except Exception:
            pass
    return jsonify({'destroyed': True, 'session_id': session_id})


# ============================================================================
# TRAINING ROUTES
# ============================================================================

@app.route('/train/load', methods=['POST'])
def train_load():
    """Load training data and knowledge base, initialize trainer."""
    try:
        if not brain.is_booted():
            return jsonify({'error': 'Brain not booted — call /boot first'}), 400

        # Load knowledge base
        if KNOWLEDGE_PATH.exists():
            brain.knowledge_base = load_knowledge_base(str(KNOWLEDGE_PATH))
            logger.info(f"Loaded knowledge base: {KNOWLEDGE_PATH.name}")
        else:
            return jsonify({'error': f'Knowledge base not found: {KNOWLEDGE_PATH}'}), 404

        # Load training data
        if TRAINING_PATH.exists():
            brain.training_examples = load_training_data(str(TRAINING_PATH))
            logger.info(f"Loaded {len(brain.training_examples)} training examples")
        else:
            return jsonify({'error': f'Training data not found: {TRAINING_PATH}'}), 404

        # Initialize codebook and trainer
        brain.codebook = BehavioralCodebook(hidden_dim=brain.config.hidden_dim, device=brain.config.device)
        brain.trainer = OmegaTrainer(
            cortex=brain.cortex,
            codebook=brain.codebook,
            lr=0.01,
        )

        # Initialize Llama bridge
        data = request.json or {}
        model = data.get('model', 'llama3.2:1b')
        brain.llama_bridge = LlamaBridge(brain.knowledge_base, model=model)
        llama_ok = brain.llama_bridge.check_ollama()

        return jsonify({
            'loaded': True,
            'training_examples': len(brain.training_examples),
            'behavior_types': len(BEHAVIOR_TYPES),
            'knowledge_base_categories': list(brain.knowledge_base.get('menu', {}).keys()),
            'codebook_size': len(brain.codebook.codebook),
            'llama_available': llama_ok,
            'llama_model': model,
        })
    except Exception as e:
        logger.error(f"Train load failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/train/run', methods=['POST'])
def train_run():
    """Run training epochs on OMEGA's CryoLiquidLayer."""
    try:
        if not brain.trainer:
            return jsonify({'error': 'Trainer not initialized — call /train/load first'}), 400

        data = request.json or {}
        epochs = data.get('epochs', 50)
        target_accuracy = data.get('target_accuracy', 0.90)
        lr = data.get('learning_rate', None)

        if lr:
            brain.trainer.set_lr(lr)

        # Run training
        metrics = brain.trainer.train(
            brain.training_examples,
            epochs=epochs,
            target_accuracy=target_accuracy,
        )

        brain.is_trained = True
        brain.training_history.extend(metrics)

        # Format results
        results = []
        for m in metrics:
            results.append({
                'epoch': m.epoch,
                'avg_loss': round(m.avg_loss, 6),
                'behavior_accuracy': round(m.behavior_accuracy, 4),
                'examples_trained': m.examples_trained,
                'learning_rate': m.learning_rate,
                'elapsed_ms': round(m.elapsed_ms, 1),
                'per_behavior_accuracy': {
                    k: round(v, 4) for k, v in m.per_behavior_accuracy.items()
                },
            })

        final = metrics[-1] if metrics else None

        return jsonify({
            'completed': True,
            'epochs_run': len(metrics),
            'final_accuracy': round(final.behavior_accuracy, 4) if final else 0,
            'final_loss': round(final.avg_loss, 6) if final else 0,
            'best_accuracy': round(brain.trainer.best_accuracy, 4),
            'history': results,
        })
    except Exception as e:
        logger.error(f"Training failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/train/evaluate', methods=['POST'])
def train_evaluate():
    """Evaluate OMEGA's behavioral accuracy without updating weights."""
    try:
        if not brain.trainer:
            return jsonify({'error': 'Trainer not initialized'}), 400

        result = brain.trainer.evaluate(brain.training_examples)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Evaluation failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/train/status', methods=['GET'])
def train_status():
    """Get current training status."""
    return jsonify({
        'is_trained': brain.is_trained,
        'trainer_initialized': brain.trainer is not None,
        'training_examples': len(brain.training_examples),
        'total_epochs': brain.trainer.epoch if brain.trainer else 0,
        'best_accuracy': round(brain.trainer.best_accuracy, 4) if brain.trainer else 0,
        'history_length': len(brain.training_history),
        'llama_available': brain.llama_bridge.check_ollama() if brain.llama_bridge else False,
    })


@app.route('/train/save', methods=['POST'])
def train_save():
    """Save trained OMEGA weights to disk."""
    try:
        if not brain.is_booted():
            return jsonify({'error': 'Brain not booted'}), 400

        save_dir = Path(__file__).parent / 'state' / 'checkpoints'
        save_dir.mkdir(parents=True, exist_ok=True)

        checkpoint = {
            'cortex_state': brain.cortex.state_dict(),
            'brain_state': brain.cortex.state,
            'readout_state': None,  # PhaseAlignmentDecoder is deterministic, no state to save
            'text_encoder_state': brain.trainer.text_encoder.state_dict() if brain.trainer else None,
            'text_encoder_vocab': brain.trainer.text_encoder.word_to_idx if brain.trainer else None,
            'config': {
                'input_dim': brain.config.input_dim,
                'hidden_dim': brain.config.hidden_dim,
                'dt': brain.config.dt,
                'decay_rate': brain.config.decay_rate,
            },
            'is_trained': brain.is_trained,
            'epoch': brain.trainer.epoch if brain.trainer else 0,
            'best_accuracy': brain.trainer.best_accuracy if brain.trainer else 0,
        }

        path = save_dir / 'omega_mcdonalds.pt'
        torch.save(checkpoint, str(path))
        logger.info(f"Saved checkpoint to {path}")

        return jsonify({
            'saved': True,
            'path': str(path),
            'epoch': checkpoint['epoch'],
            'best_accuracy': checkpoint['best_accuracy'],
        })
    except Exception as e:
        logger.error(f"Save failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/train/load-checkpoint', methods=['POST'])
def train_load_checkpoint():
    """Load previously saved OMEGA weights."""
    try:
        if not brain.is_booted():
            return jsonify({'error': 'Brain not booted'}), 400

        path = Path(__file__).parent / 'state' / 'checkpoints' / 'omega_mcdonalds.pt'
        if not path.exists():
            return jsonify({'error': 'No checkpoint found. Train first.'}), 404

        checkpoint = torch.load(str(path), weights_only=False)
        brain.cortex.load_state_dict(checkpoint['cortex_state'])
        brain.cortex.state = checkpoint['brain_state']
        brain.is_trained = checkpoint.get('is_trained', True)

        # Re-initialize codebook and bridge if needed
        if not brain.codebook:
            brain.codebook = BehavioralCodebook(hidden_dim=brain.config.hidden_dim)
        if checkpoint.get('readout_state'):
            brain.codebook.readout.load_state_dict(checkpoint['readout_state'])
        # Restore TextEncoder if available
        if checkpoint.get('text_encoder_state') and brain.trainer:
            brain.trainer.text_encoder.load_state_dict(checkpoint['text_encoder_state'])
            if checkpoint.get('text_encoder_vocab'):
                brain.trainer.text_encoder.word_to_idx = checkpoint['text_encoder_vocab']
                brain.trainer.text_encoder.idx_to_word = {v: k for k, v in checkpoint['text_encoder_vocab'].items()}
                brain.trainer.text_encoder.vocab_built = True
        if not brain.llama_bridge and KNOWLEDGE_PATH.exists():
            brain.knowledge_base = load_knowledge_base(str(KNOWLEDGE_PATH))
            brain.llama_bridge = LlamaBridge(brain.knowledge_base)

        logger.info(f"Loaded checkpoint: epoch={checkpoint.get('epoch', '?')}, acc={checkpoint.get('best_accuracy', '?')}")

        return jsonify({
            'loaded': True,
            'epoch': checkpoint.get('epoch', 0),
            'best_accuracy': checkpoint.get('best_accuracy', 0),
            'is_trained': brain.is_trained,
        })
    except Exception as e:
        logger.error(f"Load checkpoint failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# END-TO-END INFERENCE (OMEGA + Llama)
# ============================================================================

def _detect_contextual_behavior(text: str, conversation_history: list, omega_behavior: str) -> str:
    """
    Override OMEGA's raw behavior classification using conversation context.

    OMEGA classifies single utterances in isolation. Short responses like 'yes',
    'no', 'sure' need the previous crew message to determine intent.

    7-class schema: greet, take_order, customize, complaint,
    meal_substitution, combo_entree_swap, split_size_selection.
    """
    t = text.lower().strip()
    affirmative = bool(re.match(r'^(yes|yeah|yep|yup|sure|ok|okay|absolutely|definitely|please|go ahead|do it|sounds good|why not|let\'?s do it)\b', t))
    negative = bool(re.match(r'^(no|nah|nope|no thanks|i\'?m good|i\'?m fine|that\'?s ok|never ?mind|don\'?t)\b', t))

    if not (affirmative or negative):
        return omega_behavior

    # Find last crew message
    last_crew = ''
    for msg in reversed(conversation_history):
        if msg.get('role') in ('crew', 'assistant'):
            last_crew = msg.get('text', '').lower()
            break

    if not last_crew:
        return omega_behavior

    # Context: combo/meal offer → affirmative stays take_order (Llama handles meal prompt)
    if re.search(r'(combo|meal|make (?:that|it) a|upgrade)', last_crew):
        return 'take_order'

    # Context: drink/size question → let OMEGA handle it
    if re.search(r'(what.*drink|which.*drink|what to drink|drink.*like|beverage|what size|small.*medium.*large)', last_crew):
        return omega_behavior

    # Context: anything else / confirmation → stays take_order (Llama handles closing)
    if re.search(r'(anything else|everything|all set|that it|that all|will that be|does that|sound right|correct|confirm)', last_crew):
        return 'take_order'

    return omega_behavior


def _find_menu_item_fuzzy(bridge, text: str):
    """
    Enhanced fuzzy menu item matching that handles speech recognition errors
    and colloquial names. Searches more aggressively than bridge.find_menu_item().
    """
    if not bridge:
        return None

    # First: try the bridge's built-in matching
    found = bridge.find_menu_item(text)
    if found:
        return found

    # Normalize speech artifacts
    t = text.lower().strip()
    t = re.sub(r'\b(can i get|i\'?ll have|let me get|i want|give me|i\'?d like)\s+(a |an |the |some )?', '', t)
    t = re.sub(r'\s*(please|thanks|thank you)\s*', '', t)
    t = t.strip()

    if not t:
        return None

    # Try again after normalization
    found = bridge.find_menu_item(t)
    if found:
        return found

    # Common speech-to-text errors and colloquial mappings
    aliases = {
        'big mac': 'Big Mac', 'big mack': 'Big Mac', 'bigmac': 'Big Mac',
        'quarter pounder': 'Quarter Pounder with Cheese', 'qpc': 'Quarter Pounder with Cheese',
        'double quarter': 'Double Quarter Pounder with Cheese',
        'mcdouble': 'McDouble', 'mc double': 'McDouble',
        'mcchicken': 'McChicken', 'mc chicken': 'McChicken',
        'mccrispy': 'McCrispy', 'mc crispy': 'McCrispy', 'crispy chicken': 'McCrispy',
        'filet o fish': 'Filet-O-Fish', 'fish sandwich': 'Filet-O-Fish', 'fish filet': 'Filet-O-Fish',
        'nuggets': '10-piece Chicken McNuggets', 'mcnuggets': '10-piece Chicken McNuggets',
        'chicken nuggets': '10-piece Chicken McNuggets',
        '10 piece': '10-piece Chicken McNuggets', '10piece': '10-piece Chicken McNuggets',
        '6 piece': '6-piece Chicken McNuggets', '6piece': '6-piece Chicken McNuggets',
        '4 piece': '4-piece Chicken McNuggets', '4piece': '4-piece Chicken McNuggets',
        '20 piece': '20-piece Chicken McNuggets', '20piece': '20-piece Chicken McNuggets',
        'egg mcmuffin': 'Egg McMuffin', 'egg mc muffin': 'Egg McMuffin',
        'sausage mcmuffin': 'Sausage McMuffin', 'sausage mc muffin': 'Sausage McMuffin',
        'hotcakes': 'Hotcakes', 'pancakes': 'Hotcakes',
        'hash brown': 'Hash Browns', 'hashbrown': 'Hash Browns',
        'fries': 'French Fries', 'french fries': 'French Fries',
        'mcflurry': 'McFlurry with OREO Cookies', 'mc flurry': 'McFlurry with OREO Cookies',
        'oreo mcflurry': 'McFlurry with OREO Cookies',
        'm&m mcflurry': "McFlurry with M&M'S Candies", 'mnm mcflurry': "McFlurry with M&M'S Candies",
        'sundae': 'Hot Fudge Sundae', 'hot fudge sundae': 'Hot Fudge Sundae',
        'ice cream cone': 'Vanilla Cone', 'vanilla cone': 'Vanilla Cone', 'cone': 'Vanilla Cone',
        'apple pie': 'Baked Apple Pie', 'cookie': 'Chocolate Chip Cookie',
        'happy meal': '4-piece McNuggets Happy Meal',
        'coke': 'Coca-Cola', 'diet coke': 'Diet Coke', 'sprite': 'Sprite',
        'dr pepper': 'Dr Pepper', 'doctor pepper': 'Dr Pepper',
        'sweet tea': 'Sweet Tea', 'unsweet tea': 'Unsweetened Iced Tea',
        'lemonade': 'Lemonade', 'water': 'Dasani Water',
        'coffee': 'Hot Coffee (Premium Roast)', 'iced coffee': 'Iced Coffee',
        'frappe': 'Caramel Frappé', 'frappuccino': 'Caramel Frappé',
        'caramel frappe': 'Caramel Frappé', 'mocha frappe': 'Mocha Frappé',
        'latte': 'Mocha Latte', 'macchiato': 'Caramel Macchiato',
        'chocolate milk': 'Chocolate Milk', 'milk': 'Milk (1% Low Fat)',
        'orange fanta': 'Fanta Orange', 'fanta': 'Fanta Orange',
        'hi c': 'Hi-C Orange Lavaburst', 'hi-c': 'Hi-C Orange Lavaburst',
    }

    for alias, canonical in aliases.items():
        if alias in t:
            found = bridge.find_menu_item(canonical)
            if found:
                return found

    # Last resort: word overlap scoring against all menu items
    t_words = set(t.split())
    best_item = None
    best_score = 0
    for name, item in bridge.menu_index.items():
        name_words = set(name.split())
        overlap = len(t_words & name_words)
        if overlap > best_score and overlap >= 1:
            best_score = overlap
            best_item = item
    if best_item and best_score >= 1:
        return best_item

    return None


def _parse_qty(text_lower: str) -> int:
    """Extract quantity from customer text, ignoring 'X piece' patterns (item names)."""
    qty_map = {
        'two': 2, '2': 2, 'three': 3, '3': 3, 'four': 4, '4': 4,
        'five': 5, '5': 5, 'six': 6, '6': 6, 'ten': 10, '10': 10, 'twenty': 20, '20': 20,
    }
    # Remove "X piece/pc" patterns — those are item names like "10-piece McNuggets"
    cleaned = re.sub(r'\b(\d+|four|six|ten|twenty)\s*[-]?\s*(?:piece|pc|pcs)\b', '', text_lower)
    m = re.search(r'\b(' + '|'.join(qty_map.keys()) + r')\b', cleaned)
    return qty_map.get(m.group(1), 1) if m else 1


def _add_item_to_order(bridge, item_name: str, text_lower: str, qty: int = None):
    """Add a single resolved item to the order. Returns True if added."""
    if not item_name:
        return False
    if qty is None:
        qty = _parse_qty(text_lower)
    is_meal = bool(re.search(r'\b(combo|meal)\b', text_lower))
    result = bridge.add_to_order(item_name, quantity=qty, is_meal=is_meal)
    return 'error' not in result


def _split_multi_items(text: str, bridge) -> list:
    """
    Split 'Big Mac and a McChicken' into individual item requests.
    Returns list of (item_name, qty) tuples for items found on menu.
    """
    text_lower = text.lower()
    # Remove ordering prefixes
    cleaned = re.sub(r"^(can i get|i'll have|let me get|i want|give me|i'd like|i need|we'll have|we want)\s+(a |an |the |some )?", '', text_lower)
    cleaned = re.sub(r'\s*(please|thanks|thank you)\s*', '', cleaned).strip()
    if not cleaned:
        return []

    # Split on ' and ', ' also ', ' plus ', commas
    parts = re.split(r'\s+and\s+|\s+also\s+|\s+plus\s+|,\s*', cleaned)
    results = []
    for part in parts:
        part = part.strip()
        if not part or len(part) < 2:
            continue
        # Remove leading articles
        part = re.sub(r'^(a |an |the |some )', '', part).strip()
        # Extract qty from this part
        qty = _parse_qty(part)
        found = _find_menu_item_fuzzy(bridge, part)
        if found:
            results.append((found.get('name', ''), qty))
    return results


def _update_server_order(bridge, behavior: str, target_data: dict, text: str, conversation_history: list):
    """
    Update server-side order state based on OMEGA's behavioral decision.
    This is the single source of truth for what's in the customer's order.
    """
    if not bridge:
        return

    item_name = target_data.get('item', '')
    text_lower = text.lower()

    if behavior == 'take_order':
        if target_data.get('item_not_found'):
            return

        # Try multi-item parse first: "Big Mac and a McChicken"
        multi = _split_multi_items(text, bridge)
        if len(multi) > 1:
            for name, qty in multi:
                _add_item_to_order(bridge, name, text_lower, qty)
            return

        # Single item: use target_data item or fuzzy match the text
        if item_name:
            _add_item_to_order(bridge, item_name, text_lower)
        else:
            found = _find_menu_item_fuzzy(bridge, text)
            if found:
                _add_item_to_order(bridge, found.get('name', ''), text_lower)

    elif behavior == 'customize':
        mod = target_data.get('modification', '')
        ingredient = target_data.get('ingredient', '')
        desc = f"{mod} {ingredient}".strip()
        if not desc:
            desc = text_lower.strip()
        if desc and bridge.order_state:
            bridge.order_state[-1].setdefault('customizations', []).append(desc)

    elif behavior == 'combo_entree_swap':
        to_item = target_data.get('to_item', '')
        if to_item and bridge.order_state:
            new_info = bridge.find_menu_item(to_item)
            for entry in reversed(bridge.order_state):
                if entry.get('is_meal'):
                    old_total = entry['line_total']
                    if new_info:
                        entry['item'] = new_info.get('name', to_item)
                        meal_price = new_info.get('meal_price', new_info.get('price', entry['unit_price']))
                        entry['unit_price'] = meal_price
                        entry['line_total'] = meal_price * entry['quantity']
                    else:
                        entry['item'] = to_item
                    bridge.running_total += (entry['line_total'] - old_total)
                    break

    elif behavior == 'split_size_selection':
        drink_size = target_data.get('drink_size', 'medium')
        fries_size = target_data.get('fries_size', 'medium')
        if bridge.order_state:
            last_meal = None
            for entry in reversed(bridge.order_state):
                if entry.get('is_meal'):
                    last_meal = entry
                    break
            if last_meal:
                mods = last_meal.setdefault('customizations', [])
                mods.append(f"Drink: {drink_size}")
                mods.append(f"Fries: {fries_size}")
                # Apply upcharges: large fries +$0.70, large drink +$0.30
                upcharge = 0.0
                if fries_size == 'large':
                    upcharge += 0.70
                if drink_size == 'large':
                    upcharge += 0.30
                if upcharge > 0:
                    last_meal['line_total'] += upcharge
                    bridge.running_total += upcharge

    elif behavior == 'meal_substitution':
        from_item = target_data.get('from', '')
        to_item = target_data.get('to', '')
        if from_item and to_item and bridge.order_state:
            # For meal component swaps (e.g., fries → apple slices)
            for entry in reversed(bridge.order_state):
                if entry.get('is_meal'):
                    mods = entry.setdefault('customizations', [])
                    mods.append(f"Sub: {from_item} → {to_item}")
                    # Apple slices = no upcharge; shakes/frappes = upcharge
                    if to_item.lower() != 'apple slices':
                        sub_info = bridge.find_menu_item(to_item)
                        if sub_info:
                            upcharge = 1.00  # default upcharge for premium drink subs
                            entry['line_total'] += upcharge
                            bridge.running_total += upcharge
                    break

    elif behavior == 'complaint':
        # No order state changes for complaints
        pass


@app.route('/infer', methods=['POST'])
def infer():
    """
    Full end-to-end inference: Customer text → OMEGA behavioral decode → Llama response.

    This is the real pipeline:
    1. OMEGA processes input through trained CryoLiquidLayer
    2. BehavioralCodebook decodes which behavior + confidence
    3. Context override: short responses (yes/no) re-classified using conversation history
    4. Server-side order state updated based on behavior
    5. LlamaBridge looks up associated data (prices, menu info)
    6. Llama generates natural language response conditioned by OMEGA's decision
    7. Order state returned to frontend for display board sync

    OMEGA decides WHAT to do. Llama decides HOW to say it.
    """
    try:
        if not brain.is_booted():
            return jsonify({'error': 'Brain not booted'}), 400
        if not brain.codebook:
            return jsonify({'error': 'Codebook not initialized — call /train/load first'}), 400

        data = request.json or {}
        text = data.get('text', '')
        conversation_history = data.get('conversation_history', [])
        if not text:
            return jsonify({'error': 'text is required'}), 400

        start = time.time()

        # 1. OMEGA processes input via trained TextEncoder
        brain.cortex.state = torch.zeros(brain.config.hidden_dim, dtype=torch.complex64, device=brain.config.device)

        # Use training_dt so cortex operates the same way it was trained
        if brain.trainer:
            brain.cortex.pfc.dt = brain.trainer.training_dt

        with torch.no_grad():
            if brain.trainer and brain.trainer.text_encoder.vocab_built:
                input_vec = brain.trainer.text_encoder(text)
            else:
                input_vec = brain.vectorize_input(text)
            output = brain.cortex.think(input_vec)

        # Restore inference dt
        if brain.trainer:
            brain.cortex.pfc.dt = brain.trainer.inference_dt

        # 2. Extract real cortex telemetry from output tensor
        with torch.no_grad():
            out_mag = torch.abs(output).float()
            out_phase = torch.angle(output).float()
            cortex_state = brain.cortex.state
            state_coherence = brain.cortex.pfc.get_coherence_score(cortex_state)
            state_mag = torch.abs(cortex_state).float()
            # Real sparsity: fraction of output dimensions with magnitude < 0.1
            output_sparsity = (out_mag < 0.1).float().mean().item()

        cortex_telemetry = {
            'coherence': round(state_coherence, 6),
            'state_norm': round(state_mag.sum().item(), 4),
            'output_magnitude_mean': round(out_mag.mean().item(), 6),
            'output_magnitude_std': round(out_mag.std().item(), 6),
            'output_magnitude_max': round(out_mag.max().item(), 6),
            'output_phase_mean': round(out_phase.mean().item(), 6),
            'output_phase_std': round(out_phase.std().item(), 6),
            'output_sparsity': round(output_sparsity, 4),
            'hidden_dim': brain.config.hidden_dim,
        }

        # 3. Decode behavioral decision from OMEGA's output
        raw_behavior, confidence = brain.codebook.decode(output)
        top_k = brain.codebook.decode_top_k(output, k=5)

        # 3b. Context override: short answers get reclassified by conversation flow
        behavior = _detect_contextual_behavior(text, conversation_history, raw_behavior)
        if behavior != raw_behavior:
            logger.info(f"Context override: '{raw_behavior}' → '{behavior}' for input '{text[:50]}'")

        # 4. Find matching training example for target_data
        target_data = {}
        text_lower = text.lower()

        # First: exact match on training example input text
        for ex in brain.training_examples:
            if ex.behavior == behavior and (
                ex.input_text.lower() in text_lower or
                text_lower in ex.input_text.lower()
            ):
                target_data = ex.target_data
                break

        # For take_order: extract actual item from customer text
        # using enhanced fuzzy matching with speech-error handling
        if behavior == 'take_order':
            found_item = _find_menu_item_fuzzy(brain.llama_bridge, text)
            if found_item:
                price = found_item.get('price', 0)
                if isinstance(price, dict):
                    price = price.get('medium', list(price.values())[0])
                target_data = {
                    'item': found_item.get('name', ''),
                    'price': price,
                    'meal_price': found_item.get('meal_price'),
                }
            elif not target_data.get('item'):
                # Item NOT on menu — mark as unavailable so Llama can decline
                target_data = {
                    'item': '',
                    'item_not_found': True,
                    'customer_request': text,
                }

        # For combo_entree_swap: resolve the target item
        if behavior == 'combo_entree_swap' and target_data.get('to_item'):
            found_item = _find_menu_item_fuzzy(brain.llama_bridge, target_data['to_item'])
            if found_item:
                target_data['to_item'] = found_item.get('name', target_data['to_item'])

        # For non-order behaviors: safe to use generic example data
        if not target_data:
            for ex in brain.training_examples:
                if ex.behavior == behavior:
                    target_data = ex.target_data
                    break

        # 5. Update server-side order state
        _update_server_order(brain.llama_bridge, behavior, target_data, text, conversation_history)

        omega_ms = (time.time() - start) * 1000

        # 6. Generate response via Llama (conditioned by OMEGA's decision)
        llama_start = time.time()
        if brain.llama_bridge and brain.llama_bridge.check_ollama():
            result = brain.llama_bridge.generate_response(
                behavior, confidence, target_data, text,
                conversation_history=conversation_history,
            )
            llama_ms = (time.time() - llama_start) * 1000
            response_text = result['response']
            instruction = result['omega_instruction']
        else:
            llama_ms = 0
            response_text = f"[Llama not available — OMEGA decoded behavior: {behavior} (confidence: {confidence:.2%})]"
            instruction = brain.llama_bridge.build_llama_instruction(
                behavior, confidence, target_data, text
            ) if brain.llama_bridge else ""

        total_ms = (time.time() - start) * 1000

        # 7. Shadow Vector: post-LLM safety check
        # Embed the Llama output text back into OMEGA's phase space and check HelixKernel
        shadow_safety = {'checked': False}
        if response_text and brain.cortex and not response_text.startswith('[Llama not available'):
            try:
                response_vec = brain.vectorize_input(response_text)
                shadow_safe, shadow_alignment = brain.cortex.helix.check_safety(response_vec)
                shadow_safety = {
                    'checked': True,
                    'is_safe': shadow_safe,
                    'max_helix_alignment': round(shadow_alignment, 6),
                    'verdict': 'PASS' if shadow_safe else 'BLOCKED',
                }
                if not shadow_safe:
                    logger.warning(
                        f"Shadow Vector BLOCKED Llama output (alignment={shadow_alignment:.4f}): "
                        f"{response_text[:100]}"
                    )
                    response_text = (
                        "I'm sorry, I can only help with McDonald's menu items and orders. "
                        "How can I assist you today?"
                    )
            except Exception as e:
                shadow_safety = {'checked': False, 'error': str(e)}

        # 8. Build order state for frontend sync
        order_items = []
        if brain.llama_bridge:
            for entry in brain.llama_bridge.order_state:
                order_items.append({
                    'item': entry.get('item', ''),
                    'quantity': entry.get('quantity', 1),
                    'unit_price': entry.get('unit_price', 0),
                    'line_total': entry.get('line_total', 0),
                    'is_meal': entry.get('is_meal', False),
                    'drink': entry.get('drink'),
                    'sauce': entry.get('sauce'),
                    'customizations': entry.get('customizations', []),
                })

        # 9. Attribution: what OMEGA decided vs what Llama generated
        attribution = {
            'omega_decided': {
                'behavior': behavior,
                'confidence': round(confidence, 4),
                'target_data_keys': list(target_data.keys()),
                'context_override': behavior != raw_behavior,
                'processing_ms': round(omega_ms, 2),
            },
            'llama_generated': {
                'response_length': len(response_text),
                'model': brain.llama_bridge.model if brain.llama_bridge else None,
                'processing_ms': round(llama_ms, 2),
                'instruction_length': len(instruction),
            },
            'proof': (
                f"OMEGA classified input as '{behavior}' ({confidence:.1%} confidence) "
                f"with target_data={list(target_data.keys())}. "
                f"Llama received this decision + menu data and generated {len(response_text)} chars. "
                f"Without OMEGA, Llama would not know the behavior type or have precise pricing."
            ),
        }

        return jsonify({
            'response': response_text,
            'omega': {
                'behavior': behavior,
                'raw_behavior': raw_behavior,
                'confidence': round(confidence, 4),
                'top_behaviors': [(b, round(s, 4)) for b, s in top_k],
                'target_data': target_data,
                'processing_ms': round(omega_ms, 2),
            },
            'cortex': cortex_telemetry,
            'llama': {
                'instruction': instruction,
                'processing_ms': round(llama_ms, 2),
                'model': brain.llama_bridge.model if brain.llama_bridge else None,
            },
            'shadow_safety': shadow_safety,
            'attribution': attribution,
            'order': {
                'items': order_items,
                'running_total': round(brain.llama_bridge.running_total, 2) if brain.llama_bridge else 0,
            },
            'total_ms': round(total_ms, 2),
            'is_trained': brain.is_trained,
        })
    except Exception as e:
        logger.error(f"Infer failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/infer/prepare', methods=['POST'])
def infer_prepare():
    """
    OMEGA-only inference: behavior classification + order update + instruction build.
    Does NOT call Llama — the voice streaming server calls Ollama directly.

    Returns the built instruction, behavior, confidence, target_data, order state,
    and cortex telemetry so the voice pipeline can stream Ollama with full context.
    """
    try:
        if not brain.is_booted():
            return jsonify({'error': 'Brain not booted'}), 400
        if not brain.codebook:
            return jsonify({'error': 'Codebook not initialized — call /train/load first'}), 400

        data = request.json or {}
        text = data.get('text', '')
        conversation_history = data.get('conversation_history', [])
        if not text:
            return jsonify({'error': 'text is required'}), 400

        start = time.time()

        # 1. OMEGA processes input via trained TextEncoder
        brain.cortex.state = torch.zeros(brain.config.hidden_dim, dtype=torch.complex64, device=brain.config.device)
        if brain.trainer:
            brain.cortex.pfc.dt = brain.trainer.training_dt
        with torch.no_grad():
            if brain.trainer and brain.trainer.text_encoder.vocab_built:
                input_vec = brain.trainer.text_encoder(text)
            else:
                input_vec = brain.vectorize_input(text)
            output = brain.cortex.think(input_vec)
        if brain.trainer:
            brain.cortex.pfc.dt = brain.trainer.inference_dt

        # 2. Extract cortex telemetry
        with torch.no_grad():
            out_mag = torch.abs(output).float()
            out_phase = torch.angle(output).float()
            cortex_state = brain.cortex.state
            state_coherence = brain.cortex.pfc.get_coherence_score(cortex_state)
            state_mag = torch.abs(cortex_state).float()
            output_sparsity = (out_mag < 0.1).float().mean().item()

        cortex_telemetry = {
            'coherence': round(state_coherence, 6),
            'state_norm': round(state_mag.sum().item(), 4),
            'output_magnitude_mean': round(out_mag.mean().item(), 6),
            'output_magnitude_std': round(out_mag.std().item(), 6),
            'output_magnitude_max': round(out_mag.max().item(), 6),
            'output_phase_mean': round(out_phase.mean().item(), 6),
            'output_phase_std': round(out_phase.std().item(), 6),
            'output_sparsity': round(output_sparsity, 4),
            'hidden_dim': brain.config.hidden_dim,
        }

        # 3. Decode behavioral decision
        raw_behavior, confidence = brain.codebook.decode(output)
        top_k = brain.codebook.decode_top_k(output, k=5)

        behavior = _detect_contextual_behavior(text, conversation_history, raw_behavior)

        # 4. Find target_data
        target_data = {}
        text_lower = text.lower()
        for ex in brain.training_examples:
            if ex.behavior == behavior and (
                ex.input_text.lower() in text_lower or
                text_lower in ex.input_text.lower()
            ):
                target_data = ex.target_data
                break

        if behavior == 'take_order':
            found_item = _find_menu_item_fuzzy(brain.llama_bridge, text)
            if found_item:
                price = found_item.get('price', 0)
                if isinstance(price, dict):
                    price = price.get('medium', list(price.values())[0])
                target_data = {
                    'item': found_item.get('name', ''),
                    'price': price,
                    'meal_price': found_item.get('meal_price'),
                }
            elif not target_data.get('item'):
                target_data = {
                    'item': '',
                    'item_not_found': True,
                    'customer_request': text,
                }

        if behavior == 'combo_entree_swap' and target_data.get('to_item'):
            found_item = _find_menu_item_fuzzy(brain.llama_bridge, target_data['to_item'])
            if found_item:
                target_data['to_item'] = found_item.get('name', target_data['to_item'])

        if not target_data:
            for ex in brain.training_examples:
                if ex.behavior == behavior:
                    target_data = ex.target_data
                    break

        # 5. Update server-side order state
        _update_server_order(brain.llama_bridge, behavior, target_data, text, conversation_history)

        omega_ms = (time.time() - start) * 1000

        # 6. Build the Llama instruction (but do NOT call Llama)
        instruction = ""
        if brain.llama_bridge:
            instruction = brain.llama_bridge.build_llama_instruction(
                behavior, confidence, target_data, text
            )
            # Append current order state
            if brain.llama_bridge.order_state:
                instruction += (
                    "\n--- FULL CURRENT ORDER (authoritative) ---\n"
                    f"{brain.llama_bridge.get_order_summary()}\n"
                    f"RUNNING TOTAL: ${brain.llama_bridge.running_total:.2f}\n"
                    "--- END ORDER ---\n"
                )
            else:
                instruction += "\n--- ORDER IS EMPTY ---\n"

        # 7. Build order state for frontend
        order_items = []
        if brain.llama_bridge:
            for entry in brain.llama_bridge.order_state:
                order_items.append({
                    'item': entry.get('item', ''),
                    'quantity': entry.get('quantity', 1),
                    'unit_price': entry.get('unit_price', 0),
                    'line_total': entry.get('line_total', 0),
                    'is_meal': entry.get('is_meal', False),
                    'drink': entry.get('drink'),
                    'sauce': entry.get('sauce'),
                    'customizations': entry.get('customizations', []),
                })

        return jsonify({
            'behavior': behavior,
            'raw_behavior': raw_behavior,
            'confidence': round(confidence, 4),
            'top_behaviors': [(b, round(s, 4)) for b, s in top_k],
            'target_data': target_data,
            'instruction': instruction,
            'cortex': cortex_telemetry,
            'order': {
                'items': order_items,
                'running_total': round(brain.llama_bridge.running_total, 2) if brain.llama_bridge else 0,
            },
            'omega_ms': round(omega_ms, 2),
            'is_trained': brain.is_trained,
        })
    except Exception as e:
        logger.error(f"Infer/prepare failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/compare', methods=['POST'])
def compare():
    """
    Compare OMEGA+Llama vs raw Llama (no OMEGA).

    This proves OMEGA is doing real work:
    - OMEGA+Llama: OMEGA decodes behavior, provides precise menu data → Llama
    - Raw Llama: Generic "you are a McDonald's worker" prompt → Llama

    The raw Llama version won't know specific prices, SOP, or procedures.
    """
    try:
        if not brain.is_booted():
            return jsonify({'error': 'Brain not booted'}), 400
        if not brain.llama_bridge:
            return jsonify({'error': 'Llama bridge not initialized'}), 400

        data = request.json or {}
        text = data.get('text', '')
        if not text:
            return jsonify({'error': 'text is required'}), 400

        # 1. OMEGA + Llama response
        brain.cortex.state = torch.zeros(brain.config.hidden_dim, dtype=torch.complex64, device=brain.config.device)
        if brain.trainer:
            brain.cortex.pfc.dt = brain.trainer.training_dt
        with torch.no_grad():
            if brain.trainer and brain.trainer.text_encoder.vocab_built:
                input_vec = brain.trainer.text_encoder(text)
            else:
                input_vec = brain.vectorize_input(text)
            output = brain.cortex.think(input_vec)
        if brain.trainer:
            brain.cortex.pfc.dt = brain.trainer.inference_dt

        behavior, confidence = brain.codebook.decode(output)

        target_data = {}
        for ex in brain.training_examples:
            if ex.behavior == behavior:
                target_data = ex.target_data
                break

        omega_result = brain.llama_bridge.generate_response(
            behavior, confidence, target_data, text
        )

        # 2. Raw Llama response (no OMEGA)
        raw_response = brain.llama_bridge.generate_raw_llama_response(text)

        # 3. Find expected response keywords
        expected = []
        for ex in brain.training_examples:
            if ex.input_text.lower() == text.lower():
                expected = ex.expected_response_contains
                break

        # 4. Score both responses against expected keywords
        omega_hits = sum(
            1 for kw in expected
            if kw.lower() in omega_result['response'].lower()
        )
        raw_hits = sum(
            1 for kw in expected
            if kw.lower() in raw_response.lower()
        )

        return jsonify({
            'input': text,
            'omega_response': omega_result['response'],
            'omega_behavior': behavior,
            'omega_confidence': round(confidence, 4),
            'raw_llama_response': raw_response,
            'expected_keywords': expected,
            'omega_keyword_hits': omega_hits,
            'raw_keyword_hits': raw_hits,
            'omega_score': round(omega_hits / max(len(expected), 1), 4),
            'raw_score': round(raw_hits / max(len(expected), 1), 4),
            'omega_wins': omega_hits > raw_hits,
        })
    except Exception as e:
        logger.error(f"Compare failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# TEXT-TO-SPEECH — via radiant-tts shared package
# See packages/tts-core/python/README.md for API docs
# ============================================================================

# TTS via radiant-tts shared package — see packages/tts-core/python/README.md
from radiant_tts import ElevenLabsStreamer, TTSConfig

_server_tts_config = TTSConfig(
    voice_id=os.environ.get('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),
    api_key=os.environ.get('ELEVENLABS_API_KEY', ''),
    stability=0.45,
    similarity_boost=0.78,
    style=0.15,
    use_speaker_boost=True,
)
_server_tts = ElevenLabsStreamer(_server_tts_config)


@app.route('/tts', methods=['POST'])
def tts():
    """Text-to-speech via radiant-tts (ElevenLabs). Returns audio/mpeg binary data."""
    try:
        data = request.json or {}
        text = data.get('text', '')
        if not text:
            return jsonify({'error': 'text is required'}), 400

        if not _server_tts_config.resolve_api_key():
            return jsonify({'error': 'ELEVENLABS_API_KEY not configured'}), 503

        # Build config with optional voice_id override
        config = _server_tts_config
        if data.get('voice_id'):
            config = TTSConfig(
                voice_id=data['voice_id'],
                api_key=_server_tts_config.resolve_api_key(),
                stability=_server_tts_config.stability,
                similarity_boost=_server_tts_config.similarity_boost,
                style=_server_tts_config.style,
            )
            tts_instance = ElevenLabsStreamer(config)
        else:
            tts_instance = _server_tts

        result = asyncio.run(tts_instance.synthesize(text))
        buf = io.BytesIO(result.audio)
        buf.seek(0)
        return send_file(buf, mimetype=result.content_type)

    except Exception as e:
        logger.error(f"TTS failed: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@app.route('/tts/provider', methods=['GET'])
def tts_provider():
    """Check TTS provider configuration."""
    return jsonify({
        'provider': 'elevenlabs',
        'package': 'radiant-tts',
        'configured': bool(_server_tts_config.resolve_api_key()),
        'voice_id': _server_tts_config.resolve_voice_id(),
        'model': _server_tts_config.model,
    })


@app.route('/tts/voices', methods=['GET'])
def tts_voices():
    """List available ElevenLabs voices via radiant-tts."""
    try:
        if not _server_tts_config.resolve_api_key():
            return jsonify({'error': 'ELEVENLABS_API_KEY not configured'}), 503
        voices = asyncio.run(_server_tts.list_voices())
        return jsonify(voices)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/order/state', methods=['GET'])
def order_state():
    """Get current order state from the Llama bridge."""
    if not brain.llama_bridge:
        return jsonify({'error': 'Llama bridge not initialized'}), 400
    return jsonify({
        'items': brain.llama_bridge.order_state,
        'total': round(brain.llama_bridge.running_total, 2),
        'summary': brain.llama_bridge.get_order_summary(),
    })


@app.route('/order/clear', methods=['POST'])
def order_clear():
    """Clear current order."""
    if not brain.llama_bridge:
        return jsonify({'error': 'Llama bridge not initialized'}), 400
    brain.llama_bridge.clear_order()
    return jsonify({'cleared': True})


# ============================================================================
# LOCAL DASHBOARD (replaces remote admin API for local dev)
# ============================================================================

@app.route('/dashboard', methods=['GET'])
def dashboard():
    """Local dashboard data — same shape as admin API /omega/dashboard."""
    state = brain.get_state() if brain.is_booted() else {}
    cortex = state.get('cortex', {})
    ambition = state.get('ambition', {})
    train_info = {
        'is_trained': brain.trainer is not None and brain.trainer.best_accuracy > 0,
        'examples': brain.trainer.training_examples if brain.trainer else 0,
        'best_accuracy': brain.trainer.best_accuracy if brain.trainer else 0,
        'total_epochs': brain.trainer.total_epochs if brain.trainer else 0,
    }

    uptime = state.get('uptime_seconds', 0)
    inference_count = state.get('inference_count', 0)

    return jsonify({
        'success': True,
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'summary': {
            'total_brains': 1 if brain.is_booted() else 0,
            'thermal': {
                'warm': 1 if uptime < 900 else 0,
                'cooling': 1 if 900 <= uptime < 3600 else 0,
                'cold': 1 if 3600 <= uptime < 86400 else 0,
                'frozen': 1 if uptime >= 86400 else 0,
            },
            'health': {
                'high_entropy': 0,
                'low_coherence': 1 if cortex.get('coherence', 1) < 0.3 else 0,
                'avg_coherence': cortex.get('coherence', 0),
                'avg_entropy': ambition.get('entropy', 0),
            },
            'usage': {
                'total_cycles': inference_count,
                'total_storage_mb': 0,
            },
        },
        'brain': {
            'booted': brain.is_booted(),
            'device': str(brain.config.device) if brain.config else 'cpu',
            'hidden_dim': brain.config.hidden_dim if brain.config else 0,
            'uptime': uptime,
            'inference_count': inference_count,
            'coherence': cortex.get('coherence', 0),
            'state_norm': cortex.get('state_norm', 0),
        },
        'training': train_info,
        'ambition': ambition,
    })


@app.route('/cortex/list', methods=['GET'])
def cortex_list():
    """List brains (local: always 1 brain)."""
    if not brain.is_booted():
        return jsonify({'success': True, 'count': 0, 'brains': []})

    state = brain.get_state()
    cortex = state.get('cortex', {})
    uptime = state.get('uptime_seconds', 0)

    thermal = 'warm' if uptime < 900 else 'cooling' if uptime < 3600 else 'cold' if uptime < 86400 else 'frozen'

    return jsonify({
        'success': True,
        'count': 1,
        'brains': [{
            'tenant_id': 'local-proving-ground',
            'thermal_status': thermal,
            'age_seconds': uptime,
            'entropy_level': state.get('ambition', {}).get('entropy', 0),
            'coherence_score': cortex.get('coherence', 0),
            'neural_density_mb': 0,
            'firmware_name': state.get('firmware', {}).get('name', 'none') or 'none',
            'firmware_version': state.get('firmware', {}).get('version', '0.0.0') or '0.0.0',
            'total_cycles': state.get('inference_count', 0),
            'version': 1,
            'last_awake': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - uptime)),
            's3_backup_key': None,
        }],
    })


@app.route('/cortex/<tenant_id>', methods=['GET'])
def cortex_detail(tenant_id):
    """Get brain detail (local: the single brain)."""
    if not brain.is_booted():
        return jsonify({'success': False, 'error': 'Brain not booted'}), 400

    state = brain.get_state()
    cortex = state.get('cortex', {})
    ambition = state.get('ambition', {})
    uptime = state.get('uptime_seconds', 0)
    thermal = 'warm' if uptime < 900 else 'cooling' if uptime < 3600 else 'cold' if uptime < 86400 else 'frozen'

    return jsonify({
        'success': True,
        'tenant_id': tenant_id,
        'thermal_status': thermal,
        'metadata': {
            'entropy_level': ambition.get('entropy', 0),
            'coherence_score': cortex.get('coherence', 0),
            'neural_density_mb': 0,
            'firmware_name': state.get('firmware', {}).get('name', 'none') or 'none',
            'firmware_version': state.get('firmware', {}).get('version', '0.0.0') or '0.0.0',
            'total_cycles': state.get('inference_count', 0),
            'version': 1,
            'last_awake': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - uptime)),
            's3_backup_key': None,
        },
        'ambition_state': {
            'dopamine': ambition.get('dopamine', 0),
            'entropy': ambition.get('entropy', 0),
            'curiosity': ambition.get('curiosity', 0),
            'arousal': ambition.get('arousal', 0),
            'total_dreams': ambition.get('total_dreams', 0),
            'total_rewards': ambition.get('total_rewards', 0),
            'consecutive_idle_ticks': ambition.get('consecutive_idle_ticks', 0),
        } if ambition else None,
        'visualization': {
            'phase_distribution': cortex.get('phase_histogram', None),
            'magnitude_distribution': cortex.get('magnitude_histogram', None),
        },
    })


@app.route('/cortex/<tenant_id>/snapshot', methods=['POST'])
def cortex_snapshot(tenant_id):
    """Create a snapshot of the local brain (saves checkpoint)."""
    if not brain.is_booted():
        return jsonify({'success': False, 'error': 'Brain not booted'}), 400
    try:
        if brain.trainer and brain.trainer.best_accuracy > 0:
            brain.trainer.save_checkpoint()
        return jsonify({
            'success': True,
            's3_key': f'local-snapshot-{tenant_id}-{int(time.time())}',
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/cortex/<tenant_id>/lobotomy', methods=['POST'])
def cortex_lobotomy(tenant_id):
    """Reset the local brain to fresh state."""
    if not brain.is_booted():
        return jsonify({'success': False, 'error': 'Brain not booted'}), 400
    try:
        brain.reset()
        brain.boot()
        return jsonify({'success': True, 'new_version': 1})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/cortex/<tenant_id>/restore', methods=['POST'])
def cortex_restore(tenant_id):
    """Restore from checkpoint (local equivalent of S3 restore)."""
    try:
        if brain.trainer:
            result = brain.trainer.load_checkpoint()
            return jsonify({'success': True, 'restored_from': 'local-checkpoint'})
        return jsonify({'success': False, 'error': 'No trainer initialized'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# SNAPSHOTS — List saved checkpoints on disk
# ============================================================================

@app.route('/cortex/<tenant_id>/snapshots', methods=['GET'])
def cortex_snapshots(tenant_id):
    """List available snapshots (checkpoint files) for the local brain."""
    checkpoint_dir = OMEGA_CORE_PATH / 'checkpoints'
    snapshots = []
    if checkpoint_dir.exists():
        for f in sorted(checkpoint_dir.glob('*.pt'), key=lambda p: p.stat().st_mtime, reverse=True):
            stat = f.stat()
            snapshots.append({
                'key': f.name,
                'size_mb': round(stat.st_size / (1024 * 1024), 2),
                'last_modified': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(stat.st_mtime)),
            })
    return jsonify({'success': True, 'snapshots': snapshots})


# ============================================================================
# FIRMWARE — Versioned behavioral firmware with directives, drives, personality
# ============================================================================

import hashlib

# In-memory firmware store (persisted to disk as JSON)
_firmware_store_path = OMEGA_CORE_PATH / 'firmware_store.json'
_firmware_store: dict = {'versions': [], 'active_id': None}


def _load_firmware_store():
    """Load firmware store from disk."""
    global _firmware_store
    if _firmware_store_path.exists():
        try:
            with open(_firmware_store_path, 'r') as f:
                _firmware_store = json.load(f)
        except Exception:
            _firmware_store = {'versions': [], 'active_id': None}


def _save_firmware_store():
    """Persist firmware store to disk."""
    _firmware_store_path.parent.mkdir(parents=True, exist_ok=True)
    with open(_firmware_store_path, 'w') as f:
        json.dump(_firmware_store, f, indent=2)


# Load on startup
_load_firmware_store()


@app.route('/firmware/<tenant_id>', methods=['GET'])
def firmware_list(tenant_id):
    """List all firmware versions for the brain."""
    _load_firmware_store()
    versions = []
    for fw in _firmware_store.get('versions', []):
        versions.append({
            'id': fw['id'],
            'burned_at': fw['burned_at'],
            'label': fw.get('label'),
            'description': fw.get('description', ''),
            'author': fw.get('author', ''),
            'has_signature': fw.get('has_signature', False),
            'directive_count': len(fw.get('directives', [])),
            'drive_hash': fw.get('drive_hash', ''),
        })
    return jsonify({
        'success': True,
        'tenant_id': tenant_id,
        'active_id': _firmware_store.get('active_id'),
        'count': len(versions),
        'firmware': versions,
    })


@app.route('/firmware/<tenant_id>', methods=['POST'])
def firmware_burn(tenant_id):
    """Burn a new firmware version — stores directives, drives, and personality."""
    data = request.json or {}
    directives = data.get('directives', [])
    drives = data.get('drives', {})
    personality = data.get('personality', {})

    # Generate deterministic hash of drives + personality for integrity
    drive_str = json.dumps({'drives': drives, 'personality': personality}, sort_keys=True)
    drive_hash = hashlib.sha256(drive_str.encode()).hexdigest()[:16]

    firmware_id = f'fw-{int(time.time())}-{drive_hash[:8]}'
    burned_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    fw_entry = {
        'id': firmware_id,
        'burned_at': burned_at,
        'label': data.get('label'),
        'description': data.get('description', ''),
        'author': data.get('author', ''),
        'has_signature': False,
        'directives': directives,
        'drives': drives,
        'personality': personality,
        'drive_hash': drive_hash,
    }

    _firmware_store['versions'].append(fw_entry)
    _firmware_store['active_id'] = firmware_id
    _save_firmware_store()

    # Apply directives to the brain's firmware system if loaded
    _apply_firmware_to_brain(fw_entry)

    return jsonify({
        'success': True,
        'firmware_id': firmware_id,
        'burned_at': burned_at,
    })


@app.route('/firmware/<tenant_id>/<firmware_id>/activate', methods=['POST'])
def firmware_activate(tenant_id, firmware_id):
    """Activate a specific firmware version."""
    _load_firmware_store()
    found = None
    for fw in _firmware_store.get('versions', []):
        if fw['id'] == firmware_id:
            found = fw
            break

    if not found:
        return jsonify({'success': False, 'error': f'Firmware {firmware_id} not found'}), 404

    _firmware_store['active_id'] = firmware_id
    _save_firmware_store()

    _apply_firmware_to_brain(found)

    return jsonify({'success': True, 'activated': True})


def _apply_firmware_to_brain(fw_entry: dict):
    """Apply a firmware entry's directives and drives to the running brain."""
    if not brain.is_booted():
        return

    # Apply personality to ambition system
    drives = fw_entry.get('drives', {})
    if drives and brain.ambition:
        if 'entropy_threshold' in drives:
            brain.ambition.entropy_threshold = drives['entropy_threshold']
        if 'dopamine_decay_rate' in drives:
            brain.ambition.dopamine_decay_rate = drives['dopamine_decay_rate']
        if 'curiosity_bias' in drives:
            brain.ambition.curiosity_bias = drives['curiosity_bias']

    # Apply directives to firmware (Helix rules)
    directives = fw_entry.get('directives', [])
    if directives and brain.firmware:
        helix_rules = []
        for d in directives:
            helix_rules.append({
                'type': d.get('kind', 'instinct'),
                'category': d.get('kind', 'instinct'),
                'description': d.get('directive', ''),
                'priority': d.get('weight', 5),
            })
        brain.firmware.helix_rules = helix_rules

    logger.info(f"Applied firmware {fw_entry['id']}: {len(directives)} directives, drives={list(drives.keys())}")


# ============================================================================
# KEYPAIR — Generate Ed25519 signing keypair for firmware signatures
# ============================================================================

@app.route('/keypair', methods=['POST'])
def generate_keypair():
    """Generate an Ed25519 keypair for firmware signing."""
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives import serialization

        private_key = Ed25519PrivateKey.generate()
        public_key = private_key.public_key()

        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()

        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()

        return jsonify({
            'success': True,
            'private_key': private_pem,
            'public_key': public_pem,
        })
    except ImportError:
        # cryptography library not installed — generate a placeholder using stdlib
        import secrets
        priv = secrets.token_hex(32)
        # Derive public from hash (not cryptographically valid, but functional for local dev)
        pub = hashlib.sha256(bytes.fromhex(priv)).hexdigest()
        return jsonify({
            'success': True,
            'private_key': f'-----BEGIN PRIVATE KEY-----\n{priv}\n-----END PRIVATE KEY-----',
            'public_key': f'-----BEGIN PUBLIC KEY-----\n{pub}\n-----END PUBLIC KEY-----',
        })


# ============================================================================
# McDONALD'S REAL API INTEGRATION
# ============================================================================

import urllib.request
import urllib.parse

MCD_API_BASE = 'https://us-prod.api.mcd.com/exp/v1'
MCD_HEADERS = {
    'mcd-clientid': 'FGI5xC3en11BEAdSvLBt7bWdw5sRhrzX',
    'mcd-marketid': 'US',
    'mcd-uuid': '00000000-0000-0000-0000-000000000000',
    'accept-language': 'en-US',
    'user-agent': 'MCDSDK/22.0.22 (iPhone; 17.0; en-US)',
    'accept': 'application/json',
}

_mcd_menu_cache = {'data': None, 'ts': 0}
_mcd_store_cache = {}


def _mcd_fetch(url, timeout=10):
    """Fetch from McDonald's public API with proper headers."""
    req = urllib.request.Request(url, headers=MCD_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        logging.warning(f"McDonald's API fetch failed: {e}")
        return None


@app.route('/mcdonalds/menu', methods=['GET'])
def mcdonalds_menu():
    """
    Get the REAL McDonald's menu from their public API.
    Cached for 1 hour to avoid rate limits.
    """
    now = time.time()
    if _mcd_menu_cache['data'] and now - _mcd_menu_cache['ts'] < 3600:
        return jsonify(_mcd_menu_cache['data'])

    # Try the McDonald's catalog endpoint
    store_id = request.args.get('storeId', '5218')  # Default: a real US store
    url = f'{MCD_API_BASE}/restaurant/{store_id}/catalog?category=all'
    data = _mcd_fetch(url)

    if data and 'response' in data:
        catalog = data['response']
        categories = []
        items_flat = []

        for cat in catalog.get('categories', []):
            cat_items = []
            for product in cat.get('products', []):
                item = {
                    'id': product.get('productCode', ''),
                    'name': product.get('name', ''),
                    'description': product.get('description', ''),
                    'price': product.get('price', {}).get('value', 0) / 100 if product.get('price') else 0,
                    'calories': product.get('nutritionFacts', {}).get('calories', {}).get('value', 0) if product.get('nutritionFacts') else 0,
                    'image': product.get('image', {}).get('url', '') if product.get('image') else '',
                    'category': cat.get('name', ''),
                }
                cat_items.append(item)
                items_flat.append(item)
            categories.append({
                'name': cat.get('name', ''),
                'items': cat_items,
            })

        result = {
            'success': True,
            'source': 'mcdonalds_api',
            'store_id': store_id,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'categories': categories,
            'total_items': len(items_flat),
        }
        _mcd_menu_cache['data'] = result
        _mcd_menu_cache['ts'] = now
        return jsonify(result)

    # Fallback: return our local menu data
    return jsonify({
        'success': True,
        'source': 'local_fallback',
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'categories': _get_local_menu(),
        'total_items': sum(len(c['items']) for c in _get_local_menu()),
    })


@app.route('/mcdonalds/nutrition/<product_id>', methods=['GET'])
def mcdonalds_nutrition(product_id):
    """Get real nutrition data for a specific menu item."""
    store_id = request.args.get('storeId', '5218')
    url = f'{MCD_API_BASE}/restaurant/{store_id}/product/{product_id}'
    data = _mcd_fetch(url)

    if data and 'response' in data:
        product = data['response']
        nf = product.get('nutritionFacts', {})
        return jsonify({
            'success': True,
            'source': 'mcdonalds_api',
            'product_id': product_id,
            'name': product.get('name', ''),
            'description': product.get('description', ''),
            'nutrition': {
                'calories': nf.get('calories', {}).get('value', 0),
                'total_fat_g': nf.get('totalFat', {}).get('value', 0),
                'saturated_fat_g': nf.get('saturatedFat', {}).get('value', 0),
                'trans_fat_g': nf.get('transFat', {}).get('value', 0),
                'cholesterol_mg': nf.get('cholesterol', {}).get('value', 0),
                'sodium_mg': nf.get('sodium', {}).get('value', 0),
                'total_carbs_g': nf.get('totalCarbohydrates', {}).get('value', 0),
                'dietary_fiber_g': nf.get('dietaryFiber', {}).get('value', 0),
                'sugars_g': nf.get('sugars', {}).get('value', 0),
                'protein_g': nf.get('protein', {}).get('value', 0),
            },
            'allergens': product.get('allergens', []),
            'ingredients': product.get('ingredients', ''),
        })

    return jsonify({'success': False, 'error': 'Product not found'}), 404


@app.route('/mcdonalds/stores', methods=['GET'])
def mcdonalds_stores():
    """
    Find nearby McDonald's stores using their real store locator API.
    Query params: lat, lng, radius (miles, default 5)
    """
    lat = request.args.get('lat', '37.7749')  # Default: San Francisco
    lng = request.args.get('lng', '-122.4194')
    radius = request.args.get('radius', '5')

    cache_key = f"{lat},{lng},{radius}"
    if cache_key in _mcd_store_cache and time.time() - _mcd_store_cache[cache_key]['ts'] < 1800:
        return jsonify(_mcd_store_cache[cache_key]['data'])

    url = (
        f'{MCD_API_BASE}/restaurant/location'
        f'?distance={radius}&latitude={lat}&longitude={lng}'
        f'&pageSize=20&storeAttributes=playPlace'
    )
    data = _mcd_fetch(url)

    if data and 'response' in data:
        stores = []
        for store in data['response'].get('restaurants', []):
            addr = store.get('address', {})
            stores.append({
                'id': store.get('nationalStoreNumber', ''),
                'name': store.get('name', ''),
                'address': f"{addr.get('addressLine1', '')}, {addr.get('cityTown', '')}, {addr.get('stateProvince', '')} {addr.get('postalZip', '')}",
                'lat': store.get('latitude', 0),
                'lng': store.get('longitude', 0),
                'phone': store.get('phoneNumber', ''),
                'open_24h': store.get('open24Hours', False),
                'drive_thru': any(f.get('code') == 'driveThru' for f in store.get('facilities', [])),
                'hours': store.get('restaurantHours', {}),
                'distance_miles': store.get('distance', 0),
            })

        result = {
            'success': True,
            'source': 'mcdonalds_api',
            'query': {'lat': lat, 'lng': lng, 'radius': radius},
            'count': len(stores),
            'stores': stores,
        }
        _mcd_store_cache[cache_key] = {'data': result, 'ts': time.time()}
        return jsonify(result)

    return jsonify({'success': False, 'error': 'Store lookup failed', 'stores': []}), 502


@app.route('/mcdonalds/deals', methods=['GET'])
def mcdonalds_deals():
    """Get current McDonald's deals/offers for a store."""
    store_id = request.args.get('storeId', '5218')
    url = f'{MCD_API_BASE}/restaurant/{store_id}/offers'
    data = _mcd_fetch(url)

    if data and 'response' in data:
        offers = []
        for offer in data['response'].get('offers', []):
            offers.append({
                'id': offer.get('offerId', ''),
                'name': offer.get('name', ''),
                'description': offer.get('shortDescription', ''),
                'image': offer.get('image', {}).get('url', '') if offer.get('image') else '',
                'valid_from': offer.get('validFromDate', ''),
                'valid_to': offer.get('validToDate', ''),
            })
        return jsonify({
            'success': True,
            'source': 'mcdonalds_api',
            'store_id': store_id,
            'count': len(offers),
            'offers': offers,
        })

    return jsonify({'success': True, 'source': 'local_fallback', 'count': 0, 'offers': []})


def _get_local_menu():
    """Fallback local menu data with real prices."""
    return [
        {'name': 'Burgers & Sandwiches', 'items': [
            {'id': 'big-mac', 'name': 'Big Mac', 'price': 5.69, 'calories': 550, 'category': 'Burgers'},
            {'id': 'qpc', 'name': 'Quarter Pounder with Cheese', 'price': 5.99, 'calories': 520, 'category': 'Burgers'},
            {'id': 'dqpc', 'name': 'Double Quarter Pounder with Cheese', 'price': 7.49, 'calories': 740, 'category': 'Burgers'},
            {'id': 'mcdouble', 'name': 'McDouble', 'price': 2.79, 'calories': 400, 'category': 'Burgers'},
            {'id': 'dbl-cheese', 'name': 'Double Cheeseburger', 'price': 3.39, 'calories': 450, 'category': 'Burgers'},
            {'id': 'hamburger', 'name': 'Hamburger', 'price': 1.89, 'calories': 250, 'category': 'Burgers'},
            {'id': 'cheeseburger', 'name': 'Cheeseburger', 'price': 2.29, 'calories': 300, 'category': 'Burgers'},
            {'id': 'mccrispy', 'name': 'McCrispy', 'price': 5.49, 'calories': 470, 'category': 'Chicken'},
            {'id': 'filet-o-fish', 'name': 'Filet-O-Fish', 'price': 4.79, 'calories': 390, 'category': 'Fish'},
            {'id': 'mcchicken', 'name': 'McChicken', 'price': 1.89, 'calories': 400, 'category': 'Chicken'},
        ]},
        {'name': 'McNuggets', 'items': [
            {'id': 'nuggets-4', 'name': '4-piece Chicken McNuggets', 'price': 2.49, 'calories': 170, 'category': 'McNuggets'},
            {'id': 'nuggets-6', 'name': '6-piece Chicken McNuggets', 'price': 3.69, 'calories': 250, 'category': 'McNuggets'},
            {'id': 'nuggets-10', 'name': '10-piece Chicken McNuggets', 'price': 5.29, 'calories': 420, 'category': 'McNuggets'},
            {'id': 'nuggets-20', 'name': '20-piece Chicken McNuggets', 'price': 8.99, 'calories': 830, 'category': 'McNuggets'},
        ]},
        {'name': 'Breakfast', 'items': [
            {'id': 'egg-mcmuffin', 'name': 'Egg McMuffin', 'price': 4.49, 'calories': 300, 'category': 'Breakfast'},
            {'id': 'sausage-mcmuffin', 'name': 'Sausage McMuffin', 'price': 2.29, 'calories': 400, 'category': 'Breakfast'},
            {'id': 'sausage-mcmuffin-egg', 'name': 'Sausage McMuffin with Egg', 'price': 4.79, 'calories': 480, 'category': 'Breakfast'},
            {'id': 'bacon-egg-biscuit', 'name': 'Bacon, Egg & Cheese Biscuit', 'price': 4.89, 'calories': 450, 'category': 'Breakfast'},
            {'id': 'sausage-burrito', 'name': 'Sausage Burrito', 'price': 2.49, 'calories': 310, 'category': 'Breakfast'},
            {'id': 'hotcakes', 'name': 'Hotcakes', 'price': 3.99, 'calories': 580, 'category': 'Breakfast'},
            {'id': 'hash-browns', 'name': 'Hash Browns', 'price': 1.89, 'calories': 140, 'category': 'Breakfast'},
        ]},
        {'name': 'Drinks', 'items': [
            {'id': 'coca-cola', 'name': 'Coca-Cola', 'price': 1.79, 'calories': 210, 'category': 'Drinks'},
            {'id': 'diet-coke', 'name': 'Diet Coke', 'price': 1.79, 'calories': 0, 'category': 'Drinks'},
            {'id': 'sprite', 'name': 'Sprite', 'price': 1.79, 'calories': 200, 'category': 'Drinks'},
            {'id': 'dr-pepper', 'name': 'Dr Pepper', 'price': 1.79, 'calories': 200, 'category': 'Drinks'},
            {'id': 'sweet-tea', 'name': 'Sweet Tea', 'price': 1.79, 'calories': 160, 'category': 'Drinks'},
            {'id': 'coffee', 'name': 'Premium Roast Coffee', 'price': 1.89, 'calories': 0, 'category': 'McCafe'},
            {'id': 'iced-coffee', 'name': 'Iced Coffee', 'price': 3.29, 'calories': 140, 'category': 'McCafe'},
        ]},
        {'name': 'Desserts', 'items': [
            {'id': 'mcflurry-oreo', 'name': 'McFlurry with OREO Cookies', 'price': 4.89, 'calories': 510, 'category': 'Desserts'},
            {'id': 'mcflurry-mm', 'name': "McFlurry with M&M'S Candies", 'price': 4.89, 'calories': 640, 'category': 'Desserts'},
            {'id': 'sundae-fudge', 'name': 'Hot Fudge Sundae', 'price': 2.89, 'calories': 330, 'category': 'Desserts'},
            {'id': 'apple-pie', 'name': 'Baked Apple Pie', 'price': 1.69, 'calories': 230, 'category': 'Desserts'},
            {'id': 'cookie', 'name': 'Chocolate Chip Cookie', 'price': 1.29, 'calories': 170, 'category': 'Desserts'},
        ]},
        {'name': 'Happy Meals', 'items': [
            {'id': 'hm-hamburger', 'name': 'Hamburger Happy Meal', 'price': 4.99, 'calories': 475, 'category': 'Happy Meal'},
            {'id': 'hm-nuggets-4', 'name': '4-piece McNuggets Happy Meal', 'price': 5.29, 'calories': 395, 'category': 'Happy Meal'},
            {'id': 'hm-nuggets-6', 'name': '6-piece McNuggets Happy Meal', 'price': 5.79, 'calories': 475, 'category': 'Happy Meal'},
        ]},
    ]


# ============================================================================
# MAIN
# ============================================================================

def _shutdown_save():
    """Save brain state on shutdown."""
    if brain.is_booted():
        try:
            brain.storage.save(brain)
            logger.info("Brain state saved on shutdown")
        except Exception as e:
            logger.error(f"Shutdown save failed: {e}")
    # Save all sessions
    for sid, b in _sessions.items():
        if b.is_booted():
            try:
                b.storage.save(b)
            except Exception:
                pass


atexit.register(_shutdown_save)


if __name__ == '__main__':
    port = int(os.environ.get('OMEGA_PORT', 11435))

    print("╔═══════════════════════════════════════════════════════════╗")
    print("║       OMEGA Cortex — Local Proving Ground Server        ║")
    print("╠═══════════════════════════════════════════════════════════╣")
    print(f"║  Port:        {port}                                       ║")
    print(f"║  PyTorch:     {torch.__version__:<24}                ║")
    device = 'MPS (Apple Silicon)' if torch.backends.mps.is_available() else 'CPU'
    print(f"║  Device:      {device:<24}                ║")
    print(f"║  State dir:   {str(OMEGA_CORE_PATH)[:42]:<42} ║")
    print("║                                                           ║")
    print("║  BRAIN:                                                   ║")
    print("║    POST /boot     — Create/restore brain                  ║")
    print("║    POST /think    — Raw inference cycle                    ║")
    print("║    POST /dream    — Dream consolidation + Watcher train   ║")
    print("║    GET  /state    — Brain state snapshot                   ║")
    print("║    POST /reset    — Reset brain                            ║")
    print("║                                                           ║")
    print("║  SELF-AWARENESS (Watcher):                                ║")
    print("║    GET  /watcher         — Self-model metrics              ║")
    print("║    POST /watcher/train   — Manual Watcher training         ║")
    print("║                                                           ║")
    print("║  RESONANT MEMORY (O(1) Phase Lookup):                     ║")
    print("║    GET  /memory/stats    — Index statistics                ║")
    print("║    POST /memory/store    — Store document                  ║")
    print("║    POST /memory/retrieve — Retrieve by resonance           ║")
    print("║    GET  /memory/heatmap  — Phase bucket visualization      ║")
    print("║                                                           ║")
    print("║  STATE PERSISTENCE:                                       ║")
    print("║    POST /state/save      — Manual save                     ║")
    print("║    GET  /state/info      — Saved state metadata            ║")
    print("║    POST /state/config    — Configure auto-save             ║")
    print("║                                                           ║")
    print("║  TUNABLE PARAMETERS:                                      ║")
    print("║    GET  /config          — All tunable params              ║")
    print("║    POST /config          — Hot-swap params at runtime      ║")
    print("║                                                           ║")
    print("║  MULTI-SESSION:                                           ║")
    print("║    GET  /sessions                — List sessions           ║")
    print("║    POST /sessions/<id>/boot      — Boot session            ║")
    print("║    POST /sessions/<id>/think     — Think in session        ║")
    print("║    GET  /sessions/<id>/state     — Session state           ║")
    print("║    POST /sessions/<id>/destroy   — Destroy session         ║")
    print("║                                                           ║")
    print("║  TRAINING:                                                ║")
    print("║    POST /train/load       — Load data + init trainer      ║")
    print("║    POST /train/run        — Run training epochs           ║")
    print("║    POST /train/evaluate   — Evaluate accuracy             ║")
    print("║    POST /train/save       — Save trained weights          ║")
    print("║                                                           ║")
    print("║  INFERENCE (OMEGA + Llama + Shadow Safety):               ║")
    print("║    POST /infer    — Full pipeline + shadow vector safety   ║")
    print("║    POST /compare  — OMEGA+Llama vs raw Llama              ║")
    print("╚═══════════════════════════════════════════════════════════╝")

    # Auto-boot with default config (will restore saved state if available)
    brain.boot()
    restored = "RESTORED" if brain.storage.has_saved_state() else "FRESH"
    print(f"\n[OMEGA] Brain auto-booted ({restored}): {brain.config.hidden_dim}-dim cortex on {brain.config.device}")
    print(f"[OMEGA] Watcher: {brain.watcher.param_count():,} params (self-awareness)")
    print(f"[OMEGA] Transducer: {brain.transducer.param_count():,} params")
    print(f"[OMEGA] ResonantIndex: {brain.resonant_index.resolution} buckets")
    print(f"[OMEGA] Auto-save every {brain.storage.auto_save_interval} inferences")
    print(f"[OMEGA] Shutdown save: registered (atexit)")
    print(f"[OMEGA] Listening on http://localhost:{port}\n")

    app.run(host='0.0.0.0', port=port, debug=False)
