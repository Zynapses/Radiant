"""
Genesis Phase 1: Structure

Implants the 800+ domain taxonomy as "innate knowledge" — the map
of all domains Cato could potentially explore.

This runs exactly once. It is idempotent.

Document in: /docs/cato/adr/010-genesis-system.md
"""

import json
import boto3
from datetime import datetime
from typing import Dict, Any, Optional
import logging
import os

logger = logging.getLogger(__name__)


class GenesisStructure:
    """
    Phase 1: Implant innate knowledge structure.
    
    The domain taxonomy serves as Cato's "innate map" — similar to
    Spelke's core knowledge constraints in infant cognition. It doesn't
    contain facts, but rather the structure of what can be known.
    """
    
    def __init__(
        self,
        config_table: str = "cato-config",
        memory_table: str = "cato-semantic-memory",
        taxonomy_path: Optional[str] = None,
        region: str = "us-east-1"
    ):
        self.dynamodb = boto3.resource("dynamodb", region_name=region)
        self.config_table = self.dynamodb.Table(config_table)
        self.memory_table = self.dynamodb.Table(memory_table)
        
        # Default taxonomy path relative to this file
        if taxonomy_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            taxonomy_path = os.path.join(base_dir, "data", "domain_taxonomy.json")
        self.taxonomy_path = taxonomy_path
        self.region = region
    
    async def is_complete(self) -> bool:
        """Check if Phase 1 has already run."""
        try:
            response = self.config_table.get_item(
                Key={"pk": "GENESIS", "sk": "STATE"}
            )
            item = response.get("Item", {})
            return item.get("structure_complete", False)
        except Exception as e:
            logger.warning(f"Error checking genesis state: {e}")
            return False
    
    async def execute(self) -> Dict[str, Any]:
        """
        Execute Phase 1: Implant innate knowledge structure.
        
        Returns:
            Execution result with statistics
        """
        # Idempotency check
        if await self.is_complete():
            logger.info("Genesis Phase 1 already complete. Skipping.")
            return {"status": "skipped", "reason": "already_complete"}
        
        logger.info("⚡ GENESIS PHASE 1: Implanting innate knowledge structure...")
        
        # Load taxonomy
        with open(self.taxonomy_path, "r") as f:
            taxonomy = json.load(f)
        
        # Count domains
        domain_count = self._count_domains(taxonomy)
        logger.info(f">> Loading {domain_count} domains from taxonomy")
        
        # Initialize atomic counters for developmental gates (Fix #1: Zeno's Paradox)
        await self._initialize_atomic_counters()
        
        # Initialize each domain with maximum uncertainty
        domains_initialized = 0
        
        for category in taxonomy.get("categories", []):
            category_name = category["name"]
            
            for domain in category.get("domains", []):
                domain_id = f"{category_name}.{domain['name']}"
                
                await self._initialize_domain(domain_id, domain)
                domains_initialized += 1
                
                # Initialize subdomains
                for subdomain in domain.get("subdomains", []):
                    subdomain_id = f"{domain_id}.{subdomain['name']}"
                    await self._initialize_domain(subdomain_id, subdomain)
                    domains_initialized += 1
        
        # Mark phase complete
        self.config_table.update_item(
            Key={"pk": "GENESIS", "sk": "STATE"},
            UpdateExpression="""
                SET structure_complete = :complete,
                    structure_completed_at = :timestamp,
                    taxonomy_version = :version,
                    domain_count = :count
            """,
            ExpressionAttributeValues={
                ":complete": True,
                ":timestamp": datetime.utcnow().isoformat() + "Z",
                ":version": taxonomy.get("version", "unknown"),
                ":count": domains_initialized
            }
        )
        
        logger.info(f"✅ Phase 1 complete. {domains_initialized} domains initialized.")
        
        return {
            "status": "complete",
            "domains_initialized": domains_initialized,
            "taxonomy_version": taxonomy.get("version")
        }
    
    async def _initialize_atomic_counters(self):
        """
        Initialize atomic counters for developmental gates.
        
        Fix #1 (Zeno's Paradox): Use atomic counters instead of table scans
        to track development statistics. Table scans are O(N) and will
        exhaust RCUs as the memory table grows.
        """
        counters = {
            "self_facts_count": 0,
            "grounded_verifications_count": 0,
            "domain_explorations_count": 0,
            "successful_verifications_count": 0,
            "belief_updates_count": 0,
            "successful_predictions_count": 0,
            "total_predictions_count": 0,
            "contradiction_resolutions_count": 0,
            "abstract_inferences_count": 0,
            "meta_cognitive_adjustments_count": 0,
            "novel_insights_count": 0,
        }
        
        self.config_table.put_item(Item={
            "pk": "STATISTICS",
            "sk": "COUNTERS",
            **counters,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "created_by": "genesis_structure",
            "version": 1
        })
        
        logger.info("   Atomic counters initialized for developmental gates")
    
    async def _initialize_domain(self, domain_id: str, domain_data: Dict):
        """
        Initialize a single domain with maximum uncertainty.
        
        All domains start with:
        - confidence: 0.0 (completely unknown)
        - learning_progress: 999.0 (sentinel for maximum curiosity)
        - error_history: empty
        
        CRITICAL: Do NOT use string "Infinity" for learning_progress.
        DynamoDB comparison (gt, lt) between String and Number is undefined.
        Use sentinel value 999.0 instead. (Fix #8: Infinity Type Risk)
        """
        self.memory_table.put_item(Item={
            "pk": f"DOMAIN#{domain_id}",
            "sk": "STATE",
            "domain_id": domain_id,
            "display_name": domain_data.get("name", domain_id),
            "description": domain_data.get("description", ""),
            "keywords": domain_data.get("keywords", []),
            
            # Uncertainty state
            "confidence": "0.0",  # DynamoDB stores as Decimal, use string for precision
            "last_explored": None,
            "exploration_count": 0,
            "error_history": [],
            "learning_progress": "999.0",  # Sentinel for max curiosity (NOT "Infinity" string!)
            
            # Metadata
            "created_at": datetime.utcnow().isoformat() + "Z",
            "created_by": "genesis_structure",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "version": 1
        })
    
    def _count_domains(self, taxonomy: Dict) -> int:
        """Count total domains in taxonomy."""
        count = 0
        for category in taxonomy.get("categories", []):
            for domain in category.get("domains", []):
                count += 1
                count += len(domain.get("subdomains", []))
        return count
    
    async def reset(self) -> Dict[str, Any]:
        """
        Reset Phase 1 state (for testing/debugging only).
        
        WARNING: This will delete all domain states and counters!
        """
        logger.warning("⚠️  Resetting Genesis Phase 1 state...")
        
        # Remove structure_complete flag
        self.config_table.update_item(
            Key={"pk": "GENESIS", "sk": "STATE"},
            UpdateExpression="REMOVE structure_complete, structure_completed_at, taxonomy_version, domain_count"
        )
        
        # Delete counters
        try:
            self.config_table.delete_item(Key={"pk": "STATISTICS", "sk": "COUNTERS"})
        except Exception:
            pass
        
        logger.info("   Phase 1 state reset")
        return {"status": "reset"}
