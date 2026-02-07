# Project OMEGA - Radiant Storage Manager
# EFS Hot Storage + S3 Cold Storage with Atomic Writes

"""
THE STORAGE CORTEX: Persistence Layer for Cryogenic Brains

The Brain is a File on EFS. It must be crash-proof.

Architecture:
- Hot Storage (EFS): Fast access for Lambda execution
- Cold Storage (S3): Backups, snapshots, and admin visibility

File Structure:
- /mnt/omega_state/{tenant_id}/brain.pt - The Heavy Tensor State
- /mnt/omega_state/{tenant_id}/brain.meta - Lightweight JSON sidecar

Atomic Writes:
- Save to brain.pt.tmp first
- os.replace() to brain.pt (atomic on POSIX)
- Prevents corruption during Lambda timeouts

Metadata Sidecar:
- Allows Admin Dashboard to scan 1000s of brains instantly
- Without loading massive tensor files into memory
"""

import os
import json
import time
import hashlib
import logging
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

import torch
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


@dataclass
class BrainMetadata:
    """
    Lightweight metadata sidecar for brain state.
    Stored as JSON for fast scanning by Admin Dashboard.
    """
    tenant_id: str
    last_awake_ts: float  # Unix timestamp
    last_awake_iso: str   # ISO 8601 for readability
    entropy_level: float  # 0.0 = fresh, 1.0 = maximum decay
    neural_density_mb: float  # File size in MB
    coherence_score: float  # 0.0 = scattered, 1.0 = phase-locked
    firmware_version: str  # Hash of active .bio file
    firmware_name: str  # Human-readable firmware name
    total_cycles: int  # Number of inference cycles run
    created_at: str  # ISO timestamp
    version: int  # Incremented on each save
    s3_backup_key: Optional[str] = None  # Latest S3 backup location
    s3_backup_ts: Optional[float] = None  # When last backed up


@dataclass 
class StorageConfig:
    """Configuration for the storage manager."""
    efs_mount_path: str = "/mnt/omega_state"
    s3_bucket: str = "radiant-cortex-backups"
    backup_interval: int = 100  # Backup every N saves
    max_local_versions: int = 5  # Keep N versions on EFS


class StorageManager:
    """
    The "File System Driver" for OMEGA brains.
    
    Handles:
    - Atomic saves to EFS (crash-proof)
    - Metadata sidecar management
    - Periodic sync to S3 cold storage
    - Recovery from S3 if EFS is empty
    """
    
    def __init__(self, config: Optional[StorageConfig] = None):
        self.config = config or StorageConfig()
        self.s3_client = boto3.client('s3')
        
        # Ensure mount path exists
        Path(self.config.efs_mount_path).mkdir(parents=True, exist_ok=True)
    
    def _tenant_path(self, tenant_id: str) -> Path:
        """Get the EFS path for a tenant's brain."""
        return Path(self.config.efs_mount_path) / tenant_id
    
    def _brain_path(self, tenant_id: str) -> Path:
        """Get the path to the brain tensor file."""
        return self._tenant_path(tenant_id) / "brain.pt"
    
    def _meta_path(self, tenant_id: str) -> Path:
        """Get the path to the metadata sidecar."""
        return self._tenant_path(tenant_id) / "brain.meta"
    
    def _tmp_path(self, tenant_id: str) -> Path:
        """Get the temporary path for atomic writes."""
        return self._tenant_path(tenant_id) / "brain.pt.tmp"
    
    def load_hot(self, tenant_id: str) -> tuple[Optional[dict], Optional[BrainMetadata]]:
        """
        Load brain state from hot storage (EFS).
        
        If EFS file is missing, attempts recovery from S3.
        
        Args:
            tenant_id: The tenant identifier
            
        Returns:
            Tuple of (state_dict, metadata) or (None, None) if not found
        """
        brain_path = self._brain_path(tenant_id)
        meta_path = self._meta_path(tenant_id)
        
        # Try EFS first (fast path)
        if brain_path.exists() and meta_path.exists():
            try:
                state_dict = torch.load(brain_path, map_location='cpu', weights_only=False)
                with open(meta_path, 'r') as f:
                    meta_dict = json.load(f)
                metadata = BrainMetadata(**meta_dict)
                
                logger.info(f"Loaded brain from EFS: {tenant_id}")
                return state_dict, metadata
                
            except Exception as e:
                logger.error(f"Failed to load from EFS: {e}")
        
        # Try S3 recovery (slow path)
        logger.info(f"Brain not on EFS, attempting S3 recovery: {tenant_id}")
        return self._recover_from_s3(tenant_id)
    
    def save_hot(
        self,
        tenant_id: str,
        state_dict: dict,
        coherence_score: float,
        firmware_version: str,
        firmware_name: str = "default"
    ) -> BrainMetadata:
        """
        Save brain state to hot storage (EFS) with atomic write.
        
        Uses tmp file + os.replace for crash safety.
        
        Args:
            tenant_id: The tenant identifier
            state_dict: PyTorch state dict to save
            coherence_score: Current coherence score
            firmware_version: Hash of active firmware
            firmware_name: Human-readable firmware name
            
        Returns:
            Updated metadata
        """
        tenant_path = self._tenant_path(tenant_id)
        tenant_path.mkdir(parents=True, exist_ok=True)
        
        brain_path = self._brain_path(tenant_id)
        meta_path = self._meta_path(tenant_id)
        tmp_path = self._tmp_path(tenant_id)
        
        # Load existing metadata or create new
        existing_meta = None
        if meta_path.exists():
            try:
                with open(meta_path, 'r') as f:
                    existing_meta = BrainMetadata(**json.load(f))
            except Exception:
                pass
        
        # Calculate entropy from time since last wake
        now = time.time()
        if existing_meta:
            delta_t = now - existing_meta.last_awake_ts
            # Entropy increases with time (max 1.0 after ~10 minutes)
            entropy_level = min(1.0, delta_t / 600.0)
            version = existing_meta.version + 1
            total_cycles = existing_meta.total_cycles + 1
            created_at = existing_meta.created_at
            s3_backup_key = existing_meta.s3_backup_key
            s3_backup_ts = existing_meta.s3_backup_ts
        else:
            entropy_level = 0.0
            version = 1
            total_cycles = 1
            created_at = datetime.now(timezone.utc).isoformat()
            s3_backup_key = None
            s3_backup_ts = None
        
        # Step 1: Save to temporary file
        torch.save(state_dict, tmp_path)
        
        # Step 2: Atomic replace (POSIX guarantees)
        os.replace(tmp_path, brain_path)
        
        # Get file size for metadata
        neural_density_mb = brain_path.stat().st_size / (1024 * 1024)
        
        # Create updated metadata
        metadata = BrainMetadata(
            tenant_id=tenant_id,
            last_awake_ts=now,
            last_awake_iso=datetime.fromtimestamp(now, timezone.utc).isoformat(),
            entropy_level=entropy_level,
            neural_density_mb=neural_density_mb,
            coherence_score=coherence_score,
            firmware_version=firmware_version,
            firmware_name=firmware_name,
            total_cycles=total_cycles,
            created_at=created_at,
            version=version,
            s3_backup_key=s3_backup_key,
            s3_backup_ts=s3_backup_ts
        )
        
        # Save metadata
        with open(meta_path, 'w') as f:
            json.dump(asdict(metadata), f, indent=2)
        
        logger.info(f"Saved brain to EFS: {tenant_id} (v{version})")
        
        # Check if we need to sync to cold storage
        if version % self.config.backup_interval == 0:
            self.sync_to_cold(tenant_id, state_dict, metadata)
        
        return metadata
    
    def sync_to_cold(
        self,
        tenant_id: str,
        state_dict: dict,
        metadata: BrainMetadata
    ) -> str:
        """
        Sync brain state to cold storage (S3).
        
        Called periodically or on explicit snapshot trigger.
        
        Args:
            tenant_id: The tenant identifier
            state_dict: PyTorch state dict to backup
            metadata: Current metadata
            
        Returns:
            S3 key of the backup
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        s3_key = f"{tenant_id}/{timestamp}_v{metadata.version}.pt"
        
        try:
            # Save to temporary file for upload
            tmp_path = self._tmp_path(tenant_id)
            torch.save(state_dict, tmp_path)
            
            # Upload to S3
            self.s3_client.upload_file(
                str(tmp_path),
                self.config.s3_bucket,
                s3_key,
                ExtraArgs={
                    'Metadata': {
                        'tenant_id': tenant_id,
                        'version': str(metadata.version),
                        'coherence_score': str(metadata.coherence_score),
                        'firmware_version': metadata.firmware_version
                    }
                }
            )
            
            # Update metadata with backup info
            metadata.s3_backup_key = s3_key
            metadata.s3_backup_ts = time.time()
            
            meta_path = self._meta_path(tenant_id)
            with open(meta_path, 'w') as f:
                json.dump(asdict(metadata), f, indent=2)
            
            # Cleanup temp file
            tmp_path.unlink(missing_ok=True)
            
            logger.info(f"Synced brain to S3: {s3_key}")
            return s3_key
            
        except ClientError as e:
            logger.error(f"Failed to sync to S3: {e}")
            raise
    
    def _recover_from_s3(self, tenant_id: str) -> tuple[Optional[dict], Optional[BrainMetadata]]:
        """
        Recover brain state from S3 cold storage.
        
        Gets the latest backup for the tenant.
        
        Args:
            tenant_id: The tenant identifier
            
        Returns:
            Tuple of (state_dict, metadata) or (None, None) if not found
        """
        try:
            # List objects in tenant's backup folder
            response = self.s3_client.list_objects_v2(
                Bucket=self.config.s3_bucket,
                Prefix=f"{tenant_id}/",
                MaxKeys=100
            )
            
            if 'Contents' not in response or not response['Contents']:
                logger.info(f"No S3 backups found for {tenant_id}")
                return None, None
            
            # Get latest backup (by key name which includes timestamp)
            latest = max(response['Contents'], key=lambda x: x['Key'])
            s3_key = latest['Key']
            
            # Download to EFS
            tenant_path = self._tenant_path(tenant_id)
            tenant_path.mkdir(parents=True, exist_ok=True)
            
            brain_path = self._brain_path(tenant_id)
            self.s3_client.download_file(
                self.config.s3_bucket,
                s3_key,
                str(brain_path)
            )
            
            # Load the state
            state_dict = torch.load(brain_path, map_location='cpu', weights_only=False)
            
            # Get metadata from S3 object
            head = self.s3_client.head_object(
                Bucket=self.config.s3_bucket,
                Key=s3_key
            )
            s3_meta = head.get('Metadata', {})
            
            # Create metadata from S3 info
            now = time.time()
            metadata = BrainMetadata(
                tenant_id=tenant_id,
                last_awake_ts=now,
                last_awake_iso=datetime.fromtimestamp(now, timezone.utc).isoformat(),
                entropy_level=1.0,  # Maximum entropy after S3 recovery
                neural_density_mb=brain_path.stat().st_size / (1024 * 1024),
                coherence_score=float(s3_meta.get('coherence_score', 0.5)),
                firmware_version=s3_meta.get('firmware_version', 'unknown'),
                firmware_name='recovered',
                total_cycles=int(s3_meta.get('version', 1)),
                created_at=datetime.fromtimestamp(
                    latest['LastModified'].timestamp(), timezone.utc
                ).isoformat(),
                version=int(s3_meta.get('version', 1)),
                s3_backup_key=s3_key,
                s3_backup_ts=latest['LastModified'].timestamp()
            )
            
            # Save metadata locally
            meta_path = self._meta_path(tenant_id)
            with open(meta_path, 'w') as f:
                json.dump(asdict(metadata), f, indent=2)
            
            logger.info(f"Recovered brain from S3: {s3_key}")
            return state_dict, metadata
            
        except ClientError as e:
            logger.error(f"Failed to recover from S3: {e}")
            return None, None
    
    def list_brains(self) -> List[BrainMetadata]:
        """
        List all brains on EFS by scanning .meta files.
        
        This is fast because we only read small JSON files,
        not the heavy tensor data.
        
        Returns:
            List of metadata for all brains
        """
        brains = []
        efs_path = Path(self.config.efs_mount_path)
        
        for tenant_dir in efs_path.iterdir():
            if tenant_dir.is_dir():
                meta_path = tenant_dir / "brain.meta"
                if meta_path.exists():
                    try:
                        with open(meta_path, 'r') as f:
                            meta_dict = json.load(f)
                        brains.append(BrainMetadata(**meta_dict))
                    except Exception as e:
                        logger.warning(f"Failed to read metadata: {meta_path}: {e}")
        
        return brains
    
    def list_s3_snapshots(self, tenant_id: str) -> List[Dict[str, Any]]:
        """
        List all S3 snapshots for a tenant.
        
        Args:
            tenant_id: The tenant identifier
            
        Returns:
            List of snapshot info dicts
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.config.s3_bucket,
                Prefix=f"{tenant_id}/",
                MaxKeys=100
            )
            
            snapshots = []
            for obj in response.get('Contents', []):
                snapshots.append({
                    'key': obj['Key'],
                    'size_mb': obj['Size'] / (1024 * 1024),
                    'last_modified': obj['LastModified'].isoformat(),
                    'timestamp': obj['LastModified'].timestamp()
                })
            
            return sorted(snapshots, key=lambda x: x['timestamp'], reverse=True)
            
        except ClientError as e:
            logger.error(f"Failed to list S3 snapshots: {e}")
            return []
    
    def restore_from_snapshot(self, tenant_id: str, s3_key: str) -> tuple[dict, BrainMetadata]:
        """
        Restore a brain from a specific S3 snapshot.
        
        Args:
            tenant_id: The tenant identifier
            s3_key: The S3 key of the snapshot to restore
            
        Returns:
            Tuple of (state_dict, metadata)
        """
        tenant_path = self._tenant_path(tenant_id)
        tenant_path.mkdir(parents=True, exist_ok=True)
        
        brain_path = self._brain_path(tenant_id)
        
        # Download from S3
        self.s3_client.download_file(
            self.config.s3_bucket,
            s3_key,
            str(brain_path)
        )
        
        # Load the state
        state_dict = torch.load(brain_path, map_location='cpu', weights_only=False)
        
        # Create fresh metadata
        now = time.time()
        metadata = BrainMetadata(
            tenant_id=tenant_id,
            last_awake_ts=now,
            last_awake_iso=datetime.fromtimestamp(now, timezone.utc).isoformat(),
            entropy_level=0.0,  # Fresh after restore
            neural_density_mb=brain_path.stat().st_size / (1024 * 1024),
            coherence_score=0.5,
            firmware_version='restored',
            firmware_name='restored',
            total_cycles=0,
            created_at=datetime.now(timezone.utc).isoformat(),
            version=1,
            s3_backup_key=s3_key,
            s3_backup_ts=now
        )
        
        # Save metadata
        meta_path = self._meta_path(tenant_id)
        with open(meta_path, 'w') as f:
            json.dump(asdict(metadata), f, indent=2)
        
        logger.info(f"Restored brain from snapshot: {s3_key}")
        return state_dict, metadata
    
    def _bridge_path(self, tenant_id: str) -> Path:
        """Get the path to the Neural Bridge (Transducer) weights."""
        return self._tenant_path(tenant_id) / "bridge.pt"
    
    def _watcher_path(self, tenant_id: str) -> Path:
        """Get the path to the Watcher (Self-Model) weights."""
        return self._tenant_path(tenant_id) / "watcher.pt"
    
    def save_bridge_weights(self, tenant_id: str, transducer_state_dict: dict) -> None:
        """
        Save Neural Transducer weights to EFS with atomic write.
        
        The Transducer (~33M params) is persisted separately from the brain
        state because it trains on a different schedule (during dream cycle)
        and has different backup requirements.
        
        Args:
            tenant_id: The tenant identifier
            transducer_state_dict: PyTorch state dict from transducer.state_dict()
        """
        tenant_path = self._tenant_path(tenant_id)
        tenant_path.mkdir(parents=True, exist_ok=True)
        
        bridge_path = self._bridge_path(tenant_id)
        tmp_path = tenant_path / "bridge.pt.tmp"
        
        torch.save(transducer_state_dict, tmp_path)
        os.replace(tmp_path, bridge_path)
        
        logger.info(f"Saved bridge weights for {tenant_id}")
    
    def load_bridge_weights(self, tenant_id: str) -> Optional[dict]:
        """
        Load Neural Transducer weights from EFS.
        
        Returns:
            State dict or None if not found
        """
        bridge_path = self._bridge_path(tenant_id)
        if not bridge_path.exists():
            return None
        
        try:
            state_dict = torch.load(bridge_path, map_location='cpu', weights_only=False)
            logger.info(f"Loaded bridge weights for {tenant_id}")
            return state_dict
        except Exception as e:
            logger.error(f"Failed to load bridge weights for {tenant_id}: {e}")
            return None
    
    def save_watcher_weights(self, tenant_id: str, watcher_state_dict: dict) -> None:
        """
        Save Watcher (Self-Model) weights to EFS with atomic write.
        
        The Watcher (~6M params) trains during dream cycle to improve
        self-prediction accuracy.
        
        Args:
            tenant_id: The tenant identifier
            watcher_state_dict: PyTorch state dict from watcher.state_dict()
        """
        tenant_path = self._tenant_path(tenant_id)
        tenant_path.mkdir(parents=True, exist_ok=True)
        
        watcher_path = self._watcher_path(tenant_id)
        tmp_path = tenant_path / "watcher.pt.tmp"
        
        torch.save(watcher_state_dict, tmp_path)
        os.replace(tmp_path, watcher_path)
        
        logger.info(f"Saved watcher weights for {tenant_id}")
    
    def load_watcher_weights(self, tenant_id: str) -> Optional[dict]:
        """
        Load Watcher (Self-Model) weights from EFS.
        
        Returns:
            State dict or None if not found
        """
        watcher_path = self._watcher_path(tenant_id)
        if not watcher_path.exists():
            return None
        
        try:
            state_dict = torch.load(watcher_path, map_location='cpu', weights_only=False)
            logger.info(f"Loaded watcher weights for {tenant_id}")
            return state_dict
        except Exception as e:
            logger.error(f"Failed to load watcher weights for {tenant_id}: {e}")
            return None
    
    def lobotomy(self, tenant_id: str) -> BrainMetadata:
        """
        Reset a brain to random initialization (Factory Reset).
        
        Creates a fresh brain with random phase parameters.
        
        Args:
            tenant_id: The tenant identifier
            
        Returns:
            Fresh metadata
        """
        from .physics import OmegaCortex, PhysicsConfig
        
        # Create fresh cortex
        cortex = OmegaCortex(PhysicsConfig())
        state_dict = cortex.get_state_dict_for_persistence()
        
        # Delete existing files
        brain_path = self._brain_path(tenant_id)
        meta_path = self._meta_path(tenant_id)
        brain_path.unlink(missing_ok=True)
        meta_path.unlink(missing_ok=True)
        
        # Save fresh state
        return self.save_hot(
            tenant_id=tenant_id,
            state_dict=state_dict,
            coherence_score=0.5,
            firmware_version='factory_reset',
            firmware_name='factory_reset'
        )
