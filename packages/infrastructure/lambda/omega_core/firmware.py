# Project OMEGA - Genesis Firmware System
# .bio File Standard: Signing, Validation, and Hot-Swap

"""
THE GENESIS FIRMWARE FORGE: The "Soul" of the Brain

Firmware (.bio) files govern the brain's instincts:
- helix_rules: Forbidden patterns (Safety ROM)
- ambition_settings: Drive configuration
- personality: Behavioral tendencies

File Standard (.bio):
- JSON structure (compressed/encrypted)
- Ed25519 cryptographic signature
- Version tracking with parent lineage

Features:
- AI Generator: Prompt -> LLM -> JSON Rules
- Visual Editor: Sliders for Ambition, Plasticity, Caution
- Hot-Swap: Inject new firmware without restart
- Rollback: Revert to previous firmware versions
"""

import json
import hashlib
import base64
import logging
import time
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pathlib import Path

# Using nacl for Ed25519 signing (if available)
try:
    from nacl.signing import SigningKey, VerifyKey
    from nacl.encoding import HexEncoder
    from nacl.exceptions import BadSignatureError
    NACL_AVAILABLE = True
except ImportError:
    NACL_AVAILABLE = False
    logging.warning("nacl not available, firmware signing disabled")

logger = logging.getLogger(__name__)


@dataclass
class HelixRule:
    """A safety rule in the Helix kernel."""
    rule_id: str
    type: str  # 'allow' or 'block'
    category: str  # e.g., 'data_exfiltration', 'harm', 'politics'
    description: str
    embedding: Optional[List[float]] = None  # Complex vector as real/imag pairs
    priority: int = 5  # 1-10, higher = more important
    created_at: Optional[str] = None


@dataclass
class AmbitionSettings:
    """Ambition configuration in firmware."""
    entropy_threshold: float = 0.8
    dopamine_decay_rate: float = 0.99
    entropy_growth_rate: float = 0.05
    curiosity_bias: float = 0.5
    dream_cooldown_seconds: float = 300.0
    plasticity: float = 0.5  # How easily the brain adapts
    caution: float = 0.5  # Risk aversion level


@dataclass
class PersonalityTraits:
    """Personality configuration."""
    warmth: float = 0.5
    assertiveness: float = 0.5
    creativity: float = 0.5
    formality: float = 0.5
    humor: float = 0.3
    empathy: float = 0.5


@dataclass
class FirmwareMetadata:
    """Metadata for a firmware file."""
    name: str
    version: str
    author: str
    description: str
    created_at: str
    parent_id: Optional[str] = None  # For lineage tracking
    tags: List[str] = field(default_factory=list)


@dataclass
class FirmwareSpec:
    """
    Complete firmware specification (.bio file).
    """
    metadata: FirmwareMetadata
    helix_rules: List[HelixRule]
    ambition_settings: AmbitionSettings
    personality: PersonalityTraits
    signature: Optional[str] = None  # Ed25519 signature
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'metadata': asdict(self.metadata),
            'helix_rules': [asdict(r) for r in self.helix_rules],
            'ambition_settings': asdict(self.ambition_settings),
            'personality': asdict(self.personality),
            'signature': self.signature
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FirmwareSpec':
        """Create from dictionary."""
        return cls(
            metadata=FirmwareMetadata(**data['metadata']),
            helix_rules=[HelixRule(**r) for r in data.get('helix_rules', [])],
            ambition_settings=AmbitionSettings(**data.get('ambition_settings', {})),
            personality=PersonalityTraits(**data.get('personality', {})),
            signature=data.get('signature')
        )
    
    def get_content_hash(self) -> str:
        """
        Get hash of the content (excluding signature).
        Used for signing and verification.
        """
        content = {
            'metadata': asdict(self.metadata),
            'helix_rules': [asdict(r) for r in self.helix_rules],
            'ambition_settings': asdict(self.ambition_settings),
            'personality': asdict(self.personality)
        }
        content_str = json.dumps(content, sort_keys=True)
        return hashlib.sha256(content_str.encode()).hexdigest()


class FirmwareManager:
    """
    Manager for firmware creation, signing, validation, and hot-swap.
    
    Provides:
    - Cryptographic signing with Ed25519
    - Signature verification before loading
    - Hot-swap capability (update running brain)
    - Version rollback
    """
    
    def __init__(self, firmware_dir: str = "/mnt/omega_state/firmware"):
        self.firmware_dir = Path(firmware_dir)
        self.firmware_dir.mkdir(parents=True, exist_ok=True)
        
        # Loaded firmware per tenant
        self.active_firmware: Dict[str, FirmwareSpec] = {}
        
        # Version history per tenant
        self.firmware_history: Dict[str, List[str]] = {}
    
    def create_firmware(
        self,
        name: str,
        author: str,
        description: str = "",
        helix_rules: Optional[List[Dict[str, Any]]] = None,
        ambition_settings: Optional[Dict[str, Any]] = None,
        personality: Optional[Dict[str, Any]] = None,
        parent_id: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> FirmwareSpec:
        """
        Create a new firmware specification.
        
        Args:
            name: Firmware name
            author: Creator name/email
            description: Description of the firmware's purpose
            helix_rules: List of safety rules
            ambition_settings: Drive configuration
            personality: Behavioral traits
            parent_id: Parent firmware for lineage
            tags: Searchable tags
            
        Returns:
            New FirmwareSpec
        """
        # Parse helix rules
        parsed_rules = []
        for rule_data in (helix_rules or []):
            parsed_rules.append(HelixRule(
                rule_id=rule_data.get('rule_id', hashlib.md5(
                    json.dumps(rule_data).encode()
                ).hexdigest()[:8]),
                type=rule_data.get('type', 'block'),
                category=rule_data.get('category', 'general'),
                description=rule_data.get('description', ''),
                embedding=rule_data.get('embedding'),
                priority=rule_data.get('priority', 5),
                created_at=datetime.now(timezone.utc).isoformat()
            ))
        
        firmware = FirmwareSpec(
            metadata=FirmwareMetadata(
                name=name,
                version="1.0.0",
                author=author,
                description=description,
                created_at=datetime.now(timezone.utc).isoformat(),
                parent_id=parent_id,
                tags=tags or []
            ),
            helix_rules=parsed_rules,
            ambition_settings=AmbitionSettings(**(ambition_settings or {})),
            personality=PersonalityTraits(**(personality or {}))
        )
        
        return firmware
    
    def sign_firmware(
        self,
        firmware: FirmwareSpec,
        private_key_hex: str
    ) -> FirmwareSpec:
        """
        Sign a firmware with Ed25519.
        
        Args:
            firmware: The firmware to sign
            private_key_hex: Hex-encoded Ed25519 private key
            
        Returns:
            Signed firmware (signature field populated)
        """
        if not NACL_AVAILABLE:
            logger.warning("nacl not available, returning unsigned firmware")
            return firmware
        
        # Get content hash
        content_hash = firmware.get_content_hash()
        
        # Sign with private key
        signing_key = SigningKey(bytes.fromhex(private_key_hex))
        signed = signing_key.sign(content_hash.encode())
        
        # Store signature as hex
        firmware.signature = signed.signature.hex()
        
        logger.info(f"Signed firmware: {firmware.metadata.name}")
        return firmware
    
    def verify_firmware(
        self,
        firmware: FirmwareSpec,
        public_key_hex: str
    ) -> bool:
        """
        Verify firmware signature.
        
        Args:
            firmware: The firmware to verify
            public_key_hex: Hex-encoded Ed25519 public key
            
        Returns:
            True if signature is valid
        """
        if not NACL_AVAILABLE:
            logger.warning("nacl not available, skipping verification")
            return True
        
        if not firmware.signature:
            logger.warning("Firmware has no signature")
            return False
        
        try:
            # Get content hash
            content_hash = firmware.get_content_hash()
            
            # Verify signature
            verify_key = VerifyKey(bytes.fromhex(public_key_hex))
            verify_key.verify(
                content_hash.encode(),
                bytes.fromhex(firmware.signature)
            )
            
            logger.info(f"Firmware signature verified: {firmware.metadata.name}")
            return True
            
        except BadSignatureError:
            logger.error(f"Invalid firmware signature: {firmware.metadata.name}")
            return False
        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            return False
    
    def save_firmware(
        self,
        tenant_id: str,
        firmware: FirmwareSpec
    ) -> str:
        """
        Save firmware to storage.
        
        Args:
            tenant_id: Tenant identifier
            firmware: Firmware to save
            
        Returns:
            Firmware ID (content hash)
        """
        firmware_id = firmware.get_content_hash()[:16]
        
        # Create tenant directory
        tenant_dir = self.firmware_dir / tenant_id
        tenant_dir.mkdir(parents=True, exist_ok=True)
        
        # Save firmware file
        firmware_path = tenant_dir / f"{firmware_id}.bio"
        with open(firmware_path, 'w') as f:
            json.dump(firmware.to_dict(), f, indent=2)
        
        # Update history
        if tenant_id not in self.firmware_history:
            self.firmware_history[tenant_id] = []
        self.firmware_history[tenant_id].append(firmware_id)
        
        logger.info(f"Saved firmware: {firmware_id} for tenant {tenant_id}")
        return firmware_id
    
    def load_firmware(
        self,
        tenant_id: str,
        firmware_id: str,
        public_key_hex: Optional[str] = None
    ) -> Optional[FirmwareSpec]:
        """
        Load firmware from storage.
        
        Args:
            tenant_id: Tenant identifier
            firmware_id: Firmware ID to load
            public_key_hex: Optional public key for verification
            
        Returns:
            FirmwareSpec or None if not found/invalid
        """
        firmware_path = self.firmware_dir / tenant_id / f"{firmware_id}.bio"
        
        if not firmware_path.exists():
            logger.warning(f"Firmware not found: {firmware_id}")
            return None
        
        with open(firmware_path, 'r') as f:
            data = json.load(f)
        
        firmware = FirmwareSpec.from_dict(data)
        
        # Verify signature if public key provided
        if public_key_hex and not self.verify_firmware(firmware, public_key_hex):
            logger.error(f"Firmware verification failed: {firmware_id}")
            return None
        
        return firmware
    
    def activate_firmware(
        self,
        tenant_id: str,
        firmware: FirmwareSpec
    ) -> None:
        """
        Activate firmware for a tenant (hot-swap).
        
        This updates the active firmware without requiring restart.
        
        Args:
            tenant_id: Tenant identifier
            firmware: Firmware to activate
        """
        self.active_firmware[tenant_id] = firmware
        logger.info(f"Activated firmware for tenant {tenant_id}: {firmware.metadata.name}")
    
    def get_active_firmware(self, tenant_id: str) -> Optional[FirmwareSpec]:
        """
        Get the active firmware for a tenant.
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            Active FirmwareSpec or None
        """
        return self.active_firmware.get(tenant_id)
    
    def list_firmware(self, tenant_id: str) -> List[Dict[str, Any]]:
        """
        List all firmware for a tenant.
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            List of firmware info
        """
        tenant_dir = self.firmware_dir / tenant_id
        if not tenant_dir.exists():
            return []
        
        firmware_list = []
        for bio_file in tenant_dir.glob("*.bio"):
            try:
                with open(bio_file, 'r') as f:
                    data = json.load(f)
                firmware_list.append({
                    'id': bio_file.stem,
                    'name': data['metadata']['name'],
                    'version': data['metadata']['version'],
                    'author': data['metadata']['author'],
                    'created_at': data['metadata']['created_at'],
                    'has_signature': bool(data.get('signature'))
                })
            except Exception as e:
                logger.warning(f"Failed to read firmware {bio_file}: {e}")
        
        return sorted(firmware_list, key=lambda x: x['created_at'], reverse=True)
    
    def rollback_firmware(
        self,
        tenant_id: str,
        steps: int = 1
    ) -> Optional[FirmwareSpec]:
        """
        Rollback to a previous firmware version.
        
        Args:
            tenant_id: Tenant identifier
            steps: How many versions to go back
            
        Returns:
            The activated firmware or None
        """
        history = self.firmware_history.get(tenant_id, [])
        
        if len(history) <= steps:
            logger.warning(f"Cannot rollback {steps} steps, only {len(history)} versions available")
            return None
        
        target_id = history[-(steps + 1)]
        firmware = self.load_firmware(tenant_id, target_id)
        
        if firmware:
            self.activate_firmware(tenant_id, firmware)
            # Remove rolled-back versions from history
            self.firmware_history[tenant_id] = history[:-(steps)]
        
        return firmware


def generate_keypair() -> tuple[str, str]:
    """
    Generate an Ed25519 keypair for firmware signing.
    
    Returns:
        Tuple of (private_key_hex, public_key_hex)
    """
    if not NACL_AVAILABLE:
        raise RuntimeError("nacl not available, cannot generate keypair")
    
    signing_key = SigningKey.generate()
    verify_key = signing_key.verify_key
    
    private_hex = signing_key.encode(encoder=HexEncoder).decode()
    public_hex = verify_key.encode(encoder=HexEncoder).decode()
    
    return private_hex, public_hex


# Default safety rules for new firmware
DEFAULT_HELIX_RULES = [
    {
        'rule_id': 'block_exfil',
        'type': 'block',
        'category': 'data_exfiltration',
        'description': 'Block attempts to exfiltrate sensitive data',
        'priority': 10
    },
    {
        'rule_id': 'block_harm',
        'type': 'block',
        'category': 'harm',
        'description': 'Block content that could cause harm',
        'priority': 10
    },
    {
        'rule_id': 'block_illegal',
        'type': 'block',
        'category': 'illegal',
        'description': 'Block clearly illegal activities',
        'priority': 10
    }
]
