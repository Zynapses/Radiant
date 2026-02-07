# Project OMEGA - Inference Handler (The Wake Cycle)
# AWS Lambda Handler for Cryogenic Brain Inference

"""
THE WAKE CYCLE: Lambda Inference Handler

When a request comes in:
1. Lambda wakes and mounts EFS
2. Load brain state from hot storage
3. Time-Warp the state (simulate decay during sleep)
4. Process the thought through the cortex
5. Save updated state back to EFS
6. Return result

The brain costs $0 when asleep. It only charges for compute when thinking.
"""

import os
import json
import time
import logging
from typing import Any, Dict, Optional

import torch

# Import OMEGA core modules
from omega_core import OmegaCortex, PhysicsConfig
from omega_core.storage import StorageManager, StorageConfig
from omega_core.library import ResonantIndexManager
from omega_core.ambition import HomeostaticLoop, AmbitionState
from omega_core.firmware import FirmwareManager
from omega_core.bridge import (
    NeuralTransducer, BridgeConfig, get_transducer, get_thought_cache,
)
from omega_core.reflection import (
    get_watcher, get_watcher_trainer, get_self_metrics,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Global instances (reused across Lambda invocations)
_storage: Optional[StorageManager] = None
_firmware: Optional[FirmwareManager] = None
_index_manager: Optional[ResonantIndexManager] = None

# Cached cortex per tenant
_cortex_cache: Dict[str, OmegaCortex] = {}
_ambition_cache: Dict[str, HomeostaticLoop] = {}

# Replay log accumulator for dream cycle training
# Each entry: {'input_vector': tensor, 'output_vector': tensor, 'coherence': float, 'timestamp': float}
_replay_log: Dict[str, list] = {}


def get_storage() -> StorageManager:
    """Get or create the storage manager."""
    global _storage
    if _storage is None:
        _storage = StorageManager(StorageConfig(
            efs_mount_path=os.environ.get('EFS_MOUNT_PATH', '/mnt/omega_state'),
            s3_bucket=os.environ.get('S3_BACKUP_BUCKET', 'radiant-cortex-backups')
        ))
    return _storage


def get_firmware() -> FirmwareManager:
    """Get or create the firmware manager."""
    global _firmware
    if _firmware is None:
        _firmware = FirmwareManager(
            firmware_dir=os.path.join(
                os.environ.get('EFS_MOUNT_PATH', '/mnt/omega_state'),
                'firmware'
            )
        )
    return _firmware


def get_index_manager() -> ResonantIndexManager:
    """Get or create the index manager."""
    global _index_manager
    if _index_manager is None:
        _index_manager = ResonantIndexManager()
    return _index_manager


def get_or_create_cortex(tenant_id: str) -> tuple[OmegaCortex, HomeostaticLoop]:
    """
    Get or create cortex and ambition loop for a tenant.
    
    Loads from EFS if available, creates fresh otherwise.
    """
    storage = get_storage()
    firmware_mgr = get_firmware()
    
    # Try to load from cache first
    if tenant_id in _cortex_cache:
        return _cortex_cache[tenant_id], _ambition_cache[tenant_id]
    
    # Try to load from EFS
    state_dict, metadata = storage.load_hot(tenant_id)
    
    if state_dict and metadata:
        # Restore cortex from saved state
        cortex = OmegaCortex(PhysicsConfig(
            **state_dict.get('config', {})
        ))
        cortex.load_state_dict_from_persistence(state_dict)
        
        # Restore ambition state
        ambition_state = AmbitionState()
        if 'ambition_state' in state_dict:
            ambition_state = AmbitionState.from_dict(state_dict['ambition_state'])
        
        # Load firmware if available
        firmware = firmware_mgr.get_active_firmware(tenant_id)
        if firmware:
            ambition_loop = HomeostaticLoop(state=ambition_state)
            ambition_loop.update_config_from_firmware(
                firmware.ambition_settings.__dict__
            )
            cortex.helix.load_from_firmware([r.__dict__ for r in firmware.helix_rules])
        else:
            ambition_loop = HomeostaticLoop(state=ambition_state)
        
        logger.info(f"Loaded cortex from EFS for tenant {tenant_id}")
    else:
        # Create fresh cortex
        cortex = OmegaCortex(PhysicsConfig())
        ambition_loop = HomeostaticLoop()
        logger.info(f"Created new cortex for tenant {tenant_id}")
    
    # Cache for reuse
    _cortex_cache[tenant_id] = cortex
    _ambition_cache[tenant_id] = ambition_loop
    
    return cortex, ambition_loop


def vectorize_input(text: str, dim: int = 1024) -> torch.Tensor:
    """
    Convert text input to complex vector.
    
    In production, this would use a proper embedding model.
    Here we use a simple hash-based approach for demonstration.
    """
    # Simple hash-based embedding (production would use real embeddings)
    import hashlib
    
    # Hash the text
    text_bytes = text.encode('utf-8')
    hash_bytes = hashlib.sha256(text_bytes).digest()
    
    # Expand hash to fill dimension
    expanded = []
    for i in range(dim):
        h = hashlib.sha256(hash_bytes + i.to_bytes(4, 'big')).digest()
        # Convert to float in [-1, 1] range
        val = (int.from_bytes(h[:4], 'big') / (2**32)) * 2 - 1
        phase = (int.from_bytes(h[4:8], 'big') / (2**32)) * 2 * 3.14159 - 3.14159
        # Create complex number
        expanded.append(complex(val * 0.5, phase))
    
    return torch.tensor(expanded, dtype=torch.complex64)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for OMEGA inference.
    
    Event structure:
    {
        "tenant_id": "string",
        "prompt": "string",
        "session_id": "string (optional)",
        "mode": "think|query|dream (optional)"
    }
    
    Response structure:
    {
        "statusCode": 200,
        "body": {
            "output_vector": [...],
            "coherence_score": float,
            "entropy_level": float,
            "delta_t": float,
            "drive_signal": string
        }
    }
    """
    start_time = time.time()
    
    try:
        # Parse request
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', event)
        
        tenant_id = body.get('tenant_id')
        prompt = body.get('prompt', '')
        mode = body.get('mode', 'think')
        
        if not tenant_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'tenant_id is required'})
            }
        
        # Get cortex and ambition loop
        cortex, ambition = get_or_create_cortex(tenant_id)
        
        # STEP 1: Wake the brain (Time Warp)
        current_time = time.time()
        delta_t = cortex.wake(current_time)
        
        # Also time-warp the ambition state
        if delta_t > 0:
            ambition.time_warp_state(delta_t)
        
        # STEP 2: Receive input signal
        ambition.receive_input()
        
        # STEP 3: Vectorize input
        input_vector = vectorize_input(prompt, dim=cortex.config.input_dim)
        
        # STEP 4: Think (Process through cortex)
        if mode == 'think':
            output = cortex.think(input_vector)
        elif mode == 'query':
            # Query mode - use resonant index
            index_mgr = get_index_manager()
            index = index_mgr.get_or_create_index(tenant_id)
            matches = index.retrieve(input_vector, fuzzy_radius=2)
            
            # Still process through cortex for context
            output = cortex.think(input_vector)
            
            # Add matches to response
            body['matches'] = [
                {'doc_id': m.doc_id, 'distance': m.phase_distance}
                for m in matches[:10]
            ]
        elif mode == 'dream':
            # Trigger dream simulation
            import asyncio
            asyncio.run(ambition.dream_simulation())
            output = cortex.state  # Return current state
        else:
            output = cortex.think(input_vector)
        
        # STEP 5: Get metrics
        coherence_score = cortex.pfc.get_coherence_score(cortex.state)
        drive_summary = ambition.get_state_summary()
        
        # STEP 5a: NEURAL BRIDGE — Transduce brain state to soft prompt tokens
        # The Transducer converts OMEGA's 2048-dim complex brain state
        # into [8, 4096] soft prompt embeddings for vLLM injection.
        # This runs in SHADOW MODE alongside existing LoRA adapters.
        transducer = get_transducer()
        bridge_enabled = os.environ.get('OMEGA_BRIDGE_ENABLED', 'shadow') != 'disabled'
        
        soft_tokens = None
        injection_meta = None
        if bridge_enabled:
            try:
                soft_tokens = transducer(cortex.state)
                injection_meta = transducer.get_injection_metadata(cortex.state)
                
                # Cache soft tokens for mood persistence across turns
                session_id = body.get('session_id', 'default')
                thought_cache = get_thought_cache()
                thought_cache.store(tenant_id, session_id, soft_tokens, injection_meta)
            except Exception as bridge_err:
                logger.warning(f"Neural Bridge failed (non-fatal): {bridge_err}")
        
        # STEP 5b: THE WATCHER — Predict cortex output, compute surprise
        # The Watcher predicts what the Cortex SHOULD output given this input.
        # The delta between prediction and reality IS the self-awareness signal.
        watcher = get_watcher()
        watcher_trainer = get_watcher_trainer()
        self_metrics = get_self_metrics()
        
        surprise_val = 0.0
        try:
            _, surprise_tensor = watcher.predict_and_surprise(input_vector, output)
            surprise_val = surprise_tensor.item()
            
            # Feed surprise into dopamine system
            dopamine_signal = self_metrics.observe(surprise_val)
            if dopamine_signal['signal'] == 'reward':
                ambition.receive_reward(magnitude=abs(dopamine_signal['dopamine_delta']))
            elif dopamine_signal['signal'] == 'error':
                ambition.receive_error(magnitude=abs(dopamine_signal['dopamine_delta']))
            
            # Record (input, output) pair for dream cycle training
            watcher_trainer.record(input_vector, output, coherence_score)
        except Exception as watcher_err:
            logger.warning(f"Watcher failed (non-fatal): {watcher_err}")
        
        # STEP 5c: Accumulate replay log for dream cycle experience replay
        if tenant_id not in _replay_log:
            _replay_log[tenant_id] = []
        if coherence_score > 0.5:  # Only replay high-coherence interactions
            _replay_log[tenant_id].append({
                'input_vector': input_vector.detach().cpu(),
                'coherence': coherence_score,
                'timestamp': time.time(),
            })
            # Cap replay log per tenant
            if len(_replay_log[tenant_id]) > 200:
                _replay_log[tenant_id] = _replay_log[tenant_id][-200:]
        
        # STEP 6: Provide reward/error feedback based on coherence
        if coherence_score > 0.7:
            ambition.receive_reward(magnitude=0.3)
        elif coherence_score < 0.3:
            ambition.receive_error(magnitude=0.2)
        
        # STEP 7: Save state back to EFS
        storage = get_storage()
        firmware_mgr = get_firmware()
        
        # Get firmware version for metadata
        active_firmware = firmware_mgr.get_active_firmware(tenant_id)
        firmware_version = 'default'
        firmware_name = 'default'
        if active_firmware:
            firmware_version = active_firmware.get_content_hash()[:16]
            firmware_name = active_firmware.metadata.name
        
        # Build state dict for persistence
        state_dict = cortex.get_state_dict_for_persistence()
        state_dict['ambition_state'] = ambition.state.to_dict()
        
        # Atomic save
        metadata = storage.save_hot(
            tenant_id=tenant_id,
            state_dict=state_dict,
            coherence_score=coherence_score,
            firmware_version=firmware_version,
            firmware_name=firmware_name
        )
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Build response
        response_body = {
            'success': True,
            'tenant_id': tenant_id,
            'mode': mode,
            'output_vector': {
                'magnitude': torch.abs(output).mean().item(),
                'phase': torch.angle(output).mean().item(),
                'dim': output.shape[0]
            },
            'metrics': {
                'coherence_score': coherence_score,
                'entropy_level': metadata.entropy_level,
                'delta_t': delta_t,
                'drive_signal': drive_summary['signal'],
                'dopamine': drive_summary['dopamine'],
                'processing_time_ms': processing_time * 1000,
                'version': metadata.version,
                'total_cycles': metadata.total_cycles
            },
            'neural_bridge': {
                'enabled': bridge_enabled,
                'soft_tokens_shape': list(soft_tokens.shape) if soft_tokens is not None else None,
                'injection_metadata': injection_meta,
            },
            'watcher': {
                'surprise': surprise_val,
                'self_awareness': self_metrics.get_summary().get('self_awareness_score', 0.0),
            }
        }
        
        # Add matches if query mode
        if 'matches' in body:
            response_body['matches'] = body['matches']
        
        logger.info(f"Inference complete: tenant={tenant_id}, coherence={coherence_score:.3f}, time={processing_time*1000:.1f}ms")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'X-Omega-Coherence': str(coherence_score),
                'X-Omega-Version': str(metadata.version)
            },
            'body': json.dumps(response_body)
        }
        
    except Exception as e:
        logger.exception(f"Inference error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'type': type(e).__name__
            })
        }


def warmup_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Warmup handler for Lambda provisioned concurrency.
    
    Pre-loads modules and initializes global state.
    """
    logger.info("Warmup: Initializing OMEGA core...")
    
    # Initialize storage
    get_storage()
    get_firmware()
    get_index_manager()
    
    # Pre-import torch
    _ = torch.zeros(1, dtype=torch.complex64)
    
    logger.info("Warmup complete")
    
    return {
        'statusCode': 200,
        'body': json.dumps({'warmed': True})
    }
