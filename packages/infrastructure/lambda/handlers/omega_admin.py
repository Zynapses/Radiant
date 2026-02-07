# Project OMEGA - Admin Handler (Cortex Explorer API)
# AWS Lambda Handler for Admin Operations

"""
THE CORTEX EXPLORER API: Admin Operations

Provides API endpoints for:
- Listing all brains with health status
- Triggering manual snapshots
- Restoring from S3 backups
- Factory reset (Lobotomy)
- Firmware management
- Real-time metrics

Base path: /api/admin/omega
"""

import os
import json
import time
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

import torch

from omega_core import OmegaCortex, PhysicsConfig
from omega_core.storage import StorageManager, StorageConfig, BrainMetadata
from omega_core.library import ResonantIndexManager
from omega_core.ambition import HomeostaticLoop, AmbitionState
from omega_core.firmware import FirmwareManager, FirmwareSpec, generate_keypair

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def get_storage() -> StorageManager:
    """Get the storage manager."""
    return StorageManager(StorageConfig(
        efs_mount_path=os.environ.get('EFS_MOUNT_PATH', '/mnt/omega_state'),
        s3_bucket=os.environ.get('S3_BACKUP_BUCKET', 'radiant-cortex-backups')
    ))


def get_firmware() -> FirmwareManager:
    """Get the firmware manager."""
    return FirmwareManager(
        firmware_dir=os.path.join(
            os.environ.get('EFS_MOUNT_PATH', '/mnt/omega_state'),
            'firmware'
        )
    )


def get_index_manager() -> ResonantIndexManager:
    """Get the index manager."""
    return ResonantIndexManager()


def get_thermal_status(metadata: BrainMetadata) -> str:
    """Determine thermal status from metadata."""
    now = time.time()
    age_hours = (now - metadata.last_awake_ts) / 3600
    
    if age_hours < 0.25:
        return 'warm'
    elif age_hours < 1:
        return 'cooling'
    elif age_hours < 24:
        return 'cold'
    else:
        return 'frozen'


def handle_list_brains(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    GET /api/admin/omega/cortex/list
    
    List all brains with health status.
    """
    storage = get_storage()
    brains = storage.list_brains()
    
    now = time.time()
    result = []
    
    for brain in brains:
        age_seconds = now - brain.last_awake_ts
        
        result.append({
            'tenant_id': brain.tenant_id,
            'thermal_status': get_thermal_status(brain),
            'age_seconds': age_seconds,
            'entropy_level': brain.entropy_level,
            'coherence_score': brain.coherence_score,
            'neural_density_mb': brain.neural_density_mb,
            'firmware_name': brain.firmware_name,
            'firmware_version': brain.firmware_version,
            'total_cycles': brain.total_cycles,
            'version': brain.version,
            'last_awake': brain.last_awake_iso,
            'created_at': brain.created_at,
            's3_backup_key': brain.s3_backup_key,
            's3_backup_ts': brain.s3_backup_ts
        })
    
    # Sort by last activity (most recent first)
    result.sort(key=lambda x: x['age_seconds'])
    
    return {
        'success': True,
        'count': len(result),
        'brains': result
    }


def handle_get_brain(tenant_id: str) -> Dict[str, Any]:
    """
    GET /api/admin/omega/cortex/{tenant_id}
    
    Get detailed info for a single brain.
    """
    storage = get_storage()
    state_dict, metadata = storage.load_hot(tenant_id)
    
    if not metadata:
        return {'success': False, 'error': 'Brain not found'}
    
    # Get phase distribution for visualization
    phase_dist = None
    magnitude_dist = None
    if state_dict and 'state' in state_dict:
        state = state_dict['state']
        phase_dist = torch.angle(state).tolist()
        magnitude_dist = torch.abs(state).tolist()
    
    # Get ambition state
    ambition_state = None
    if state_dict and 'ambition_state' in state_dict:
        ambition_state = state_dict['ambition_state']
    
    return {
        'success': True,
        'tenant_id': tenant_id,
        'thermal_status': get_thermal_status(metadata),
        'metadata': {
            'entropy_level': metadata.entropy_level,
            'coherence_score': metadata.coherence_score,
            'neural_density_mb': metadata.neural_density_mb,
            'firmware_name': metadata.firmware_name,
            'firmware_version': metadata.firmware_version,
            'total_cycles': metadata.total_cycles,
            'version': metadata.version,
            'last_awake': metadata.last_awake_iso,
            'created_at': metadata.created_at,
            's3_backup_key': metadata.s3_backup_key
        },
        'ambition_state': ambition_state,
        'visualization': {
            'phase_distribution': phase_dist[:100] if phase_dist else None,
            'magnitude_distribution': magnitude_dist[:100] if magnitude_dist else None
        }
    }


def handle_snapshot(tenant_id: str) -> Dict[str, Any]:
    """
    POST /api/admin/omega/cortex/{tenant_id}/snapshot
    
    Force an immediate S3 backup.
    """
    storage = get_storage()
    state_dict, metadata = storage.load_hot(tenant_id)
    
    if not state_dict or not metadata:
        return {'success': False, 'error': 'Brain not found'}
    
    s3_key = storage.sync_to_cold(tenant_id, state_dict, metadata)
    
    return {
        'success': True,
        'tenant_id': tenant_id,
        's3_key': s3_key,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }


def handle_list_snapshots(tenant_id: str) -> Dict[str, Any]:
    """
    GET /api/admin/omega/cortex/{tenant_id}/snapshots
    
    List all S3 snapshots for a brain.
    """
    storage = get_storage()
    snapshots = storage.list_s3_snapshots(tenant_id)
    
    return {
        'success': True,
        'tenant_id': tenant_id,
        'count': len(snapshots),
        'snapshots': snapshots
    }


def handle_restore(tenant_id: str, s3_key: str) -> Dict[str, Any]:
    """
    POST /api/admin/omega/cortex/{tenant_id}/restore
    
    Restore brain from a specific S3 snapshot.
    """
    storage = get_storage()
    
    try:
        state_dict, metadata = storage.restore_from_snapshot(tenant_id, s3_key)
        
        return {
            'success': True,
            'tenant_id': tenant_id,
            'restored_from': s3_key,
            'new_version': metadata.version,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_lobotomy(tenant_id: str) -> Dict[str, Any]:
    """
    POST /api/admin/omega/cortex/{tenant_id}/lobotomy
    
    Factory reset - reinitialize brain to random state.
    """
    storage = get_storage()
    
    try:
        metadata = storage.lobotomy(tenant_id)
        
        return {
            'success': True,
            'tenant_id': tenant_id,
            'action': 'lobotomy',
            'new_version': metadata.version,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_list_firmware(tenant_id: str) -> Dict[str, Any]:
    """
    GET /api/admin/omega/firmware/{tenant_id}
    
    List all firmware for a tenant.
    """
    firmware = get_firmware()
    firmware_list = firmware.list_firmware(tenant_id)
    
    active = firmware.get_active_firmware(tenant_id)
    active_id = active.get_content_hash()[:16] if active else None
    
    return {
        'success': True,
        'tenant_id': tenant_id,
        'active_id': active_id,
        'count': len(firmware_list),
        'firmware': firmware_list
    }


def handle_create_firmware(tenant_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    POST /api/admin/omega/firmware/{tenant_id}
    
    Create and save new firmware.
    """
    firmware_mgr = get_firmware()
    
    # Create firmware spec
    spec = firmware_mgr.create_firmware(
        name=body.get('name', 'custom'),
        author=body.get('author', 'admin'),
        description=body.get('description', ''),
        helix_rules=body.get('helix_rules', []),
        ambition_settings=body.get('ambition_settings', {}),
        personality=body.get('personality', {}),
        tags=body.get('tags', [])
    )
    
    # Sign if key provided
    if 'private_key' in body:
        spec = firmware_mgr.sign_firmware(spec, body['private_key'])
    
    # Save
    firmware_id = firmware_mgr.save_firmware(tenant_id, spec)
    
    return {
        'success': True,
        'tenant_id': tenant_id,
        'firmware_id': firmware_id,
        'name': spec.metadata.name,
        'has_signature': bool(spec.signature)
    }


def handle_activate_firmware(tenant_id: str, firmware_id: str) -> Dict[str, Any]:
    """
    POST /api/admin/omega/firmware/{tenant_id}/{firmware_id}/activate
    
    Activate (hot-swap) a firmware.
    """
    firmware_mgr = get_firmware()
    
    spec = firmware_mgr.load_firmware(tenant_id, firmware_id)
    if not spec:
        return {'success': False, 'error': 'Firmware not found'}
    
    firmware_mgr.activate_firmware(tenant_id, spec)
    
    return {
        'success': True,
        'tenant_id': tenant_id,
        'firmware_id': firmware_id,
        'name': spec.metadata.name,
        'activated': True
    }


def handle_generate_keypair() -> Dict[str, Any]:
    """
    POST /api/admin/omega/keypair
    
    Generate a new Ed25519 keypair for firmware signing.
    """
    try:
        private_key, public_key = generate_keypair()
        
        return {
            'success': True,
            'private_key': private_key,
            'public_key': public_key,
            'warning': 'Store the private key securely. It cannot be recovered.'
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_dashboard() -> Dict[str, Any]:
    """
    GET /api/admin/omega/dashboard
    
    Get full dashboard data.
    """
    storage = get_storage()
    brains = storage.list_brains()
    
    now = time.time()
    
    # Calculate stats
    total = len(brains)
    warm = sum(1 for b in brains if get_thermal_status(b) == 'warm')
    cooling = sum(1 for b in brains if get_thermal_status(b) == 'cooling')
    cold = sum(1 for b in brains if get_thermal_status(b) == 'cold')
    frozen = sum(1 for b in brains if get_thermal_status(b) == 'frozen')
    
    high_entropy = sum(1 for b in brains if b.entropy_level > 0.8)
    low_coherence = sum(1 for b in brains if b.coherence_score < 0.3)
    
    total_cycles = sum(b.total_cycles for b in brains)
    total_storage_mb = sum(b.neural_density_mb for b in brains)
    avg_coherence = sum(b.coherence_score for b in brains) / max(total, 1)
    avg_entropy = sum(b.entropy_level for b in brains) / max(total, 1)
    
    return {
        'success': True,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'summary': {
            'total_brains': total,
            'thermal': {
                'warm': warm,
                'cooling': cooling,
                'cold': cold,
                'frozen': frozen
            },
            'health': {
                'high_entropy': high_entropy,
                'low_coherence': low_coherence,
                'avg_coherence': avg_coherence,
                'avg_entropy': avg_entropy
            },
            'usage': {
                'total_cycles': total_cycles,
                'total_storage_mb': total_storage_mb
            }
        }
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for OMEGA admin API.
    
    Routes requests to appropriate handlers based on path and method.
    """
    try:
        # Parse request
        http_method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'GET'))
        path = event.get('path', event.get('rawPath', ''))
        path_params = event.get('pathParameters', {}) or {}
        query_params = event.get('queryStringParameters', {}) or {}
        
        body = {}
        if event.get('body'):
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        
        # Route handling
        result: Dict[str, Any] = {'success': False, 'error': 'Unknown route'}
        
        # Dashboard
        if path.endswith('/dashboard'):
            result = handle_dashboard()
        
        # Keypair generation
        elif path.endswith('/keypair') and http_method == 'POST':
            result = handle_generate_keypair()
        
        # Brain list
        elif path.endswith('/cortex/list'):
            result = handle_list_brains(query_params)
        
        # Single brain operations
        elif '/cortex/' in path:
            parts = path.split('/cortex/')[-1].split('/')
            tenant_id = parts[0] if parts else None
            
            if not tenant_id:
                result = {'success': False, 'error': 'tenant_id required'}
            elif len(parts) == 1:
                # GET brain details
                result = handle_get_brain(tenant_id)
            elif parts[1] == 'snapshot':
                if http_method == 'POST':
                    result = handle_snapshot(tenant_id)
                else:
                    result = handle_list_snapshots(tenant_id)
            elif parts[1] == 'snapshots':
                result = handle_list_snapshots(tenant_id)
            elif parts[1] == 'restore' and http_method == 'POST':
                s3_key = body.get('s3_key')
                if not s3_key:
                    result = {'success': False, 'error': 's3_key required'}
                else:
                    result = handle_restore(tenant_id, s3_key)
            elif parts[1] == 'lobotomy' and http_method == 'POST':
                result = handle_lobotomy(tenant_id)
        
        # Firmware operations
        elif '/firmware/' in path:
            parts = path.split('/firmware/')[-1].split('/')
            tenant_id = parts[0] if parts else None
            
            if not tenant_id:
                result = {'success': False, 'error': 'tenant_id required'}
            elif len(parts) == 1:
                if http_method == 'GET':
                    result = handle_list_firmware(tenant_id)
                elif http_method == 'POST':
                    result = handle_create_firmware(tenant_id, body)
            elif len(parts) >= 2:
                firmware_id = parts[1]
                if len(parts) >= 3 and parts[2] == 'activate' and http_method == 'POST':
                    result = handle_activate_firmware(tenant_id, firmware_id)
        
        status_code = 200 if result.get('success') else 400
        
        return {
            'statusCode': status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        logger.exception(f"Admin handler error: {e}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'type': type(e).__name__
            })
        }
