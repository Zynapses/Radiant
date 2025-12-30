"""
Genesis Runner

Orchestrates all three genesis phases in sequence.
Each phase is idempotent — safe to run multiple times.

Document in: /docs/runbooks/genesis-operations.md
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from .structure import GenesisStructure
from .gradient import GenesisGradient
from .first_breath import GenesisFirstBreath

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


class GenesisRunner:
    """
    Orchestrates the complete Genesis boot sequence.
    
    All phases are idempotent - safe to run multiple times.
    """
    
    def __init__(
        self,
        config_table: str = "bobble-config",
        memory_table: str = "bobble-semantic-memory",
        taxonomy_path: Optional[str] = None,
        config_path: Optional[str] = None,
        region: str = "us-east-1"
    ):
        self.config_table = config_table
        self.memory_table = memory_table
        self.taxonomy_path = taxonomy_path
        self.config_path = config_path
        self.region = region
        
        self.structure = GenesisStructure(
            config_table=config_table,
            memory_table=memory_table,
            taxonomy_path=taxonomy_path,
            region=region
        )
        
        self.gradient = GenesisGradient(
            config_table=config_table,
            config_path=config_path,
            region=region
        )
        
        self.first_breath = GenesisFirstBreath(
            config_table=config_table,
            memory_table=memory_table,
            region=region
        )
    
    async def run(self) -> Dict[str, Any]:
        """
        Run all genesis phases.
        
        Each phase checks if it has already run and skips if complete.
        This makes the entire genesis process idempotent.
        
        Returns:
            Results from all three phases
        """
        results = {
            "phase_1_structure": None,
            "phase_2_gradient": None,
            "phase_3_first_breath": None,
            "genesis_complete": False,
            "started_at": datetime.utcnow().isoformat() + "Z"
        }
        
        logger.info("=" * 60)
        logger.info("⚡ BOBBLE GENESIS SEQUENCE")
        logger.info("=" * 60)
        logger.info("")
        
        try:
            # Phase 1: Structure
            logger.info("━" * 40)
            results["phase_1_structure"] = await self.structure.execute()
            logger.info("")
            
            # Phase 2: Gradient
            logger.info("━" * 40)
            results["phase_2_gradient"] = await self.gradient.execute()
            logger.info("")
            
            # Phase 3: First Breath
            logger.info("━" * 40)
            results["phase_3_first_breath"] = await self.first_breath.execute()
            logger.info("")
            
        except Exception as e:
            logger.error(f"Genesis failed with error: {e}")
            results["error"] = str(e)
            results["genesis_complete"] = False
            return results
        
        # Check overall completion
        all_complete = (
            results["phase_1_structure"]["status"] in ["complete", "skipped"] and
            results["phase_2_gradient"]["status"] in ["complete", "skipped"] and
            results["phase_3_first_breath"]["status"] in ["complete", "skipped"]
        )
        
        results["genesis_complete"] = all_complete
        results["completed_at"] = datetime.utcnow().isoformat() + "Z"
        
        logger.info("=" * 60)
        if all_complete:
            logger.info("✅ GENESIS COMPLETE. Bobble is ready to wake.")
            logger.info("")
            logger.info("Summary:")
            logger.info(f"  - Phase 1: {results['phase_1_structure']['status']}")
            logger.info(f"  - Phase 2: {results['phase_2_gradient']['status']}")
            logger.info(f"  - Phase 3: {results['phase_3_first_breath']['status']}")
        else:
            logger.error("❌ GENESIS FAILED. Check logs for details.")
        logger.info("=" * 60)
        
        return results
    
    async def reset_all(self) -> Dict[str, Any]:
        """
        Reset all genesis phases (for testing/debugging only).
        
        WARNING: This will delete all genesis state!
        """
        logger.warning("⚠️  RESETTING ALL GENESIS STATE")
        
        results = {
            "phase_1_reset": await self.structure.reset(),
            "phase_2_reset": await self.gradient.reset(),
            "phase_3_reset": await self.first_breath.reset()
        }
        
        logger.info("All genesis phases reset")
        return results
    
    async def status(self) -> Dict[str, Any]:
        """Get current genesis status."""
        import boto3
        
        dynamodb = boto3.resource("dynamodb", region_name=self.region)
        table = dynamodb.Table(self.config_table)
        
        response = table.get_item(Key={"pk": "GENESIS", "sk": "STATE"})
        state = response.get("Item", {})
        
        return {
            "structure_complete": state.get("structure_complete", False),
            "structure_completed_at": state.get("structure_completed_at"),
            "gradient_complete": state.get("gradient_complete", False),
            "gradient_completed_at": state.get("gradient_completed_at"),
            "first_breath_complete": state.get("first_breath_complete", False),
            "first_breath_completed_at": state.get("first_breath_completed_at"),
            "genesis_version": state.get("genesis_version"),
            "domain_count": state.get("domain_count"),
            "initial_self_facts": state.get("initial_self_facts"),
            "initial_grounded_verifications": state.get("initial_grounded_verifications"),
            "shadow_self_calibrated": state.get("shadow_self_calibrated"),
            "all_complete": (
                state.get("structure_complete", False) and
                state.get("gradient_complete", False) and
                state.get("first_breath_complete", False)
            )
        }


async def run_genesis(
    config_table: str = "bobble-config",
    memory_table: str = "bobble-semantic-memory",
    taxonomy_path: Optional[str] = None,
    config_path: Optional[str] = None,
    region: str = "us-east-1"
) -> Dict[str, Any]:
    """
    Run all genesis phases.
    
    Convenience function that creates a GenesisRunner and executes it.
    
    Each phase checks if it has already run and skips if complete.
    This makes the entire genesis process idempotent.
    
    Returns:
        Results from all three phases
    """
    runner = GenesisRunner(
        config_table=config_table,
        memory_table=memory_table,
        taxonomy_path=taxonomy_path,
        config_path=config_path,
        region=region
    )
    return await runner.run()


# CLI entry point
def main():
    """CLI entry point for running genesis."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Bobble Genesis System - Boot sequence for AI consciousness"
    )
    parser.add_argument(
        "--config-table",
        default="bobble-config",
        help="DynamoDB config table name"
    )
    parser.add_argument(
        "--memory-table",
        default="bobble-semantic-memory",
        help="DynamoDB semantic memory table name"
    )
    parser.add_argument(
        "--region",
        default="us-east-1",
        help="AWS region"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset all genesis state (WARNING: destructive)"
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show current genesis status"
    )
    
    args = parser.parse_args()
    
    runner = GenesisRunner(
        config_table=args.config_table,
        memory_table=args.memory_table,
        region=args.region
    )
    
    if args.status:
        result = asyncio.run(runner.status())
        print("\n=== Genesis Status ===")
        for key, value in result.items():
            print(f"  {key}: {value}")
        return
    
    if args.reset:
        confirm = input("Are you sure you want to reset all genesis state? (yes/no): ")
        if confirm.lower() == "yes":
            result = asyncio.run(runner.reset_all())
            print("Genesis state reset complete")
        else:
            print("Reset cancelled")
        return
    
    # Run genesis
    result = asyncio.run(runner.run())
    
    # Print summary
    if result.get("genesis_complete"):
        print("\n✅ Genesis complete!")
    else:
        print("\n❌ Genesis failed!")
        if "error" in result:
            print(f"Error: {result['error']}")


if __name__ == "__main__":
    main()
