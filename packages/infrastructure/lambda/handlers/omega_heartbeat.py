# Project OMEGA - Heartbeat Handler (The Pacemaker)
# AWS Lambda Handler for Scheduled Brain Maintenance

"""
THE PACEMAKER: Heartbeat Handler

Runs on a schedule (EventBridge) to:
1. Check entropy levels across all brains
2. Trigger dream cycles for high-entropy brains
3. Sync hot storage to cold storage (S3)
4. Clean up stale sessions
5. Generate health metrics for monitoring

This is the "Reticular Activating System" of the organism -
it keeps the brains healthy even when they're not actively thinking.
"""

import os
import json
import time
import logging
import asyncio
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

import torch

from omega_core import OmegaCortex, PhysicsConfig
from omega_core.storage import StorageManager, StorageConfig, BrainMetadata
from omega_core.ambition import HomeostaticLoop, AmbitionState, DriveSignal
from omega_core.firmware import FirmwareManager
from omega_core.bridge import get_trainer as get_bridge_trainer
from omega_core.reflection import get_watcher_trainer

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
ENTROPY_THRESHOLD = float(os.environ.get('ENTROPY_THRESHOLD', '0.8'))
DREAM_BATCH_SIZE = int(os.environ.get('DREAM_BATCH_SIZE', '5'))
COLD_SYNC_THRESHOLD = int(os.environ.get('COLD_SYNC_THRESHOLD', '50'))
STALE_SESSION_HOURS = int(os.environ.get('STALE_SESSION_HOURS', '24'))


def get_storage() -> StorageManager:
    """Get or create the storage manager."""
    return StorageManager(StorageConfig(
        efs_mount_path=os.environ.get('EFS_MOUNT_PATH', '/mnt/omega_state'),
        s3_bucket=os.environ.get('S3_BACKUP_BUCKET', 'radiant-cortex-backups')
    ))


def get_firmware() -> FirmwareManager:
    """Get or create the firmware manager."""
    return FirmwareManager(
        firmware_dir=os.path.join(
            os.environ.get('EFS_MOUNT_PATH', '/mnt/omega_state'),
            'firmware'
        )
    )


async def check_brain_health(
    metadata: BrainMetadata,
    storage: StorageManager
) -> Dict[str, Any]:
    """
    Check the health of a single brain.
    
    Returns health report with recommendations.
    """
    now = time.time()
    
    # Calculate age since last activity
    age_seconds = now - metadata.last_awake_ts
    age_hours = age_seconds / 3600
    
    # Determine status
    if age_hours < 0.25:  # 15 minutes
        thermal_status = 'warm'
    elif age_hours < 1:
        thermal_status = 'cooling'
    elif age_hours < 24:
        thermal_status = 'cold'
    else:
        thermal_status = 'frozen'
    
    # Check if dream is needed
    needs_dream = metadata.entropy_level > ENTROPY_THRESHOLD
    
    # Check if cold sync is needed
    needs_sync = metadata.version % COLD_SYNC_THRESHOLD == 0 and not metadata.s3_backup_ts
    
    return {
        'tenant_id': metadata.tenant_id,
        'thermal_status': thermal_status,
        'age_hours': age_hours,
        'entropy_level': metadata.entropy_level,
        'coherence_score': metadata.coherence_score,
        'version': metadata.version,
        'total_cycles': metadata.total_cycles,
        'neural_density_mb': metadata.neural_density_mb,
        'firmware': metadata.firmware_name,
        'needs_dream': needs_dream,
        'needs_sync': needs_sync,
        'last_backup_hours': (now - metadata.s3_backup_ts) / 3600 if metadata.s3_backup_ts else None
    }


async def run_dream_cycle(tenant_id: str, storage: StorageManager) -> Dict[str, Any]:
    """
    Run a dream cycle for a high-entropy brain.
    
    This loads the brain, processes dream simulation, and saves.
    """
    logger.info(f"Starting dream cycle for {tenant_id}")
    
    try:
        # Load brain state
        state_dict, metadata = storage.load_hot(tenant_id)
        
        if not state_dict:
            return {'tenant_id': tenant_id, 'success': False, 'error': 'Brain not found'}
        
        # Reconstruct cortex
        cortex = OmegaCortex(PhysicsConfig(
            **state_dict.get('config', {})
        ))
        cortex.load_state_dict_from_persistence(state_dict)
        
        # Reconstruct ambition loop
        ambition_state = AmbitionState()
        if 'ambition_state' in state_dict:
            ambition_state = AmbitionState.from_dict(state_dict['ambition_state'])
        
        ambition = HomeostaticLoop(state=ambition_state)
        
        # Run ambition dream simulation (legacy)
        await ambition.dream_simulation()
        
        # PHASE 1: Selective Dreaming (Reverse Entropy)
        # Collect replay logs from inference handler's accumulator
        from handlers.omega_inference import _replay_log
        replay_logs = _replay_log.get(tenant_id, [])
        
        pre_coherence = cortex.pfc.get_coherence_score(cortex.state)
        
        # Run the 3-stage dream cycle:
        #   Stage 1: Magnitude Gate (amplify strong, dampen weak)
        #   Stage 2: Phase Sharpening (snap to resonant poles)
        #   Stage 3: Experience Replay (replay high-coherence interactions)
        dreamed_state = cortex.pfc.dream_cycle(
            state=cortex.state,
            replay_logs=replay_logs,
        )
        cortex.state = dreamed_state
        
        post_coherence = cortex.pfc.get_coherence_score(cortex.state)
        
        # Clear replay logs after dream cycle
        if tenant_id in _replay_log:
            _replay_log[tenant_id] = []
        
        # PHASE 2: Watcher Training (Self-Model Improvement)
        # Train the Watcher on accumulated (input, output) pairs from inference
        watcher_result = {'steps': 0, 'avg_loss': 0.0}
        try:
            watcher_trainer = get_watcher_trainer()
            watcher_result = watcher_trainer.train_on_buffer(max_steps=100)
            watcher_trainer.clear_buffer()
        except Exception as wt_err:
            logger.warning(f"Watcher training failed (non-fatal): {wt_err}")
        
        # PHASE 3: Bridge Training (Transducer Improvement)
        # Train the Neural Transducer using Shadow Mode coherence data
        bridge_result = {'steps': 0, 'avg_loss': 0.0}
        try:
            bridge_trainer = get_bridge_trainer()
            bridge_result = bridge_trainer.get_training_summary()
        except Exception as bt_err:
            logger.warning(f"Bridge training check failed (non-fatal): {bt_err}")
        
        # Get new coherence
        coherence_score = post_coherence
        
        # Save updated state
        state_dict = cortex.get_state_dict_for_persistence()
        state_dict['ambition_state'] = ambition.state.to_dict()
        
        storage.save_hot(
            tenant_id=tenant_id,
            state_dict=state_dict,
            coherence_score=coherence_score,
            firmware_version=metadata.firmware_version,
            firmware_name=metadata.firmware_name
        )
        
        logger.info(
            f"Dream cycle complete for {tenant_id}: "
            f"coherence {pre_coherence:.3f} -> {post_coherence:.3f}, "
            f"replay_logs={len(replay_logs)}, "
            f"watcher_steps={watcher_result['steps']}"
        )
        
        return {
            'tenant_id': tenant_id,
            'success': True,
            'old_entropy': metadata.entropy_level,
            'new_entropy': ambition.state.entropy,
            'pre_coherence': pre_coherence,
            'post_coherence': post_coherence,
            'replay_logs_processed': len(replay_logs),
            'watcher_training': watcher_result,
            'bridge_training': bridge_result,
        }
        
    except Exception as e:
        logger.exception(f"Dream cycle failed for {tenant_id}: {e}")
        return {'tenant_id': tenant_id, 'success': False, 'error': str(e)}


async def sync_to_cold(tenant_id: str, storage: StorageManager) -> Dict[str, Any]:
    """
    Sync a brain to cold storage (S3).
    """
    logger.info(f"Syncing {tenant_id} to cold storage")
    
    try:
        state_dict, metadata = storage.load_hot(tenant_id)
        
        if not state_dict:
            return {'tenant_id': tenant_id, 'success': False, 'error': 'Brain not found'}
        
        s3_key = storage.sync_to_cold(tenant_id, state_dict, metadata)
        
        return {
            'tenant_id': tenant_id,
            'success': True,
            's3_key': s3_key
        }
        
    except Exception as e:
        logger.exception(f"Cold sync failed for {tenant_id}: {e}")
        return {'tenant_id': tenant_id, 'success': False, 'error': str(e)}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for OMEGA heartbeat.
    
    Triggered by EventBridge on a schedule (e.g., every 15 minutes).
    
    Event structure:
    {
        "mode": "full|health|dream|sync (optional, default: full)"
    }
    """
    start_time = time.time()
    
    try:
        mode = event.get('mode', 'full')
        storage = get_storage()
        
        # Step 1: List all brains
        brains = storage.list_brains()
        logger.info(f"Heartbeat: Found {len(brains)} brains")
        
        # Step 2: Check health of each brain
        health_reports = []
        needs_dream = []
        needs_sync = []
        
        async def check_all_health():
            for brain in brains:
                report = await check_brain_health(brain, storage)
                health_reports.append(report)
                if report['needs_dream']:
                    needs_dream.append(brain.tenant_id)
                if report['needs_sync']:
                    needs_sync.append(brain.tenant_id)
        
        asyncio.run(check_all_health())
        
        # Step 3: Run dream cycles for high-entropy brains
        dream_results = []
        if mode in ('full', 'dream') and needs_dream:
            async def run_dreams():
                # Limit batch size to prevent timeout
                batch = needs_dream[:DREAM_BATCH_SIZE]
                for tenant_id in batch:
                    result = await run_dream_cycle(tenant_id, storage)
                    dream_results.append(result)
            
            asyncio.run(run_dreams())
            logger.info(f"Completed {len(dream_results)} dream cycles")
        
        # Step 4: Sync to cold storage
        sync_results = []
        if mode in ('full', 'sync') and needs_sync:
            async def run_syncs():
                for tenant_id in needs_sync:
                    result = await sync_to_cold(tenant_id, storage)
                    sync_results.append(result)
            
            asyncio.run(run_syncs())
            logger.info(f"Completed {len(sync_results)} cold syncs")
        
        # Calculate summary stats
        total_brains = len(brains)
        warm_count = sum(1 for r in health_reports if r['thermal_status'] == 'warm')
        cold_count = sum(1 for r in health_reports if r['thermal_status'] in ('cold', 'frozen'))
        high_entropy_count = sum(1 for r in health_reports if r['entropy_level'] > ENTROPY_THRESHOLD)
        avg_coherence = sum(r['coherence_score'] for r in health_reports) / max(len(health_reports), 1)
        
        processing_time = time.time() - start_time
        
        response = {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'mode': mode,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'summary': {
                    'total_brains': total_brains,
                    'warm_count': warm_count,
                    'cold_count': cold_count,
                    'high_entropy_count': high_entropy_count,
                    'avg_coherence': avg_coherence,
                    'dreams_triggered': len(dream_results),
                    'syncs_completed': len(sync_results),
                    'processing_time_ms': processing_time * 1000
                },
                'health_reports': health_reports if mode == 'health' else None,
                'dream_results': dream_results if dream_results else None,
                'sync_results': sync_results if sync_results else None
            })
        }
        
        logger.info(f"Heartbeat complete: {total_brains} brains, {len(dream_results)} dreams, {processing_time*1000:.1f}ms")
        
        return response
        
    except Exception as e:
        logger.exception(f"Heartbeat error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'type': type(e).__name__
            })
        }


def alarm_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handler for CloudWatch Alarms.
    
    Triggered when brain health metrics exceed thresholds.
    """
    logger.warning(f"Alarm triggered: {json.dumps(event)}")
    
    # Extract alarm details
    alarm_name = event.get('alarmName', 'unknown')
    state = event.get('state', {})
    reason = state.get('reason', 'Unknown reason')
    
    # Could trigger PagerDuty, Slack, etc.
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'alarm_name': alarm_name,
            'reason': reason,
            'acknowledged': True
        })
    }
