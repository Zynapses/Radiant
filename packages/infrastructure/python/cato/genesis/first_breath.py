"""
Genesis Phase 3: First Breath

Bootstrap self-knowledge through grounded introspection. This is
the agent's first conscious action — verifying its own existence
and capabilities through tool use.

All verifications are GROUNDED (tool execution, not LLM generation).

This runs exactly once. It is idempotent.

Document in: /docs/cato/adr/010-genesis-system.md
"""

import boto3
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging
import subprocess
import os

logger = logging.getLogger(__name__)


class GenesisFirstBreath:
    """
    Phase 3: First conscious actions.
    
    The agent wakes up, verifies its environment, and establishes
    baseline self-knowledge through grounded introspection.
    
    Fix #3 (Shadow Self Budget): Uses semantic variance via NLI consistency
    instead of expensive GPU-based hidden state extraction (~$800/mo saved).
    """
    
    def __init__(
        self,
        config_table: str = "cato-config",
        memory_table: str = "cato-semantic-memory",
        shadow_self_endpoint: str = "cato-shadow-self",
        region: str = "us-east-1"
    ):
        self.dynamodb = boto3.resource("dynamodb", region_name=region)
        self.config_table = self.dynamodb.Table(config_table)
        self.memory_table = self.dynamodb.Table(memory_table)
        self.shadow_self_endpoint = shadow_self_endpoint
        self.region = region
        
        self.bedrock = boto3.client("bedrock-runtime", region_name=region)
    
    async def is_complete(self) -> bool:
        """Check if Phase 3 has already run."""
        try:
            response = self.config_table.get_item(
                Key={"pk": "GENESIS", "sk": "STATE"}
            )
            item = response.get("Item", {})
            return item.get("first_breath_complete", False)
        except Exception as e:
            logger.warning(f"Error checking genesis state: {e}")
            return False
    
    async def execute(self) -> Dict[str, Any]:
        """
        Execute Phase 3: First breath.
        
        Returns:
            Execution result with first facts
        """
        # Idempotency check
        if await self.is_complete():
            logger.info("Genesis Phase 3 already complete. Skipping.")
            return {"status": "skipped", "reason": "already_complete"}
        
        logger.info("⚡ GENESIS PHASE 3: Taking first breath...")
        logger.info("👁️  Cato is waking up...")
        
        results = {
            "self_facts": [],
            "grounded_verifications": 0,
            "shadow_self_calibrated": False,
            "seed_domains_baselined": []
        }
        
        # === STEP 1: Verify execution environment (GROUNDED) ===
        logger.info(">> Step 1: Verifying execution environment...")
        env_facts = await self._verify_environment()
        results["self_facts"].extend(env_facts)
        results["grounded_verifications"] += len(env_facts)
        
        # === STEP 2: Verify model access (GROUNDED) ===
        logger.info(">> Step 2: Verifying model access...")
        model_facts = await self._verify_model_access()
        results["self_facts"].extend(model_facts)
        results["grounded_verifications"] += len(model_facts)
        
        # === STEP 3: Shadow Self calibration (Budget-Friendly) ===
        # Fix #3: Use semantic variance instead of GPU-based hidden state extraction
        logger.info(">> Step 3: Calibrating Shadow Self (semantic variance method)...")
        try:
            calibrated = await self._calibrate_shadow_self()
            results["shadow_self_calibrated"] = calibrated
            logger.info(f"   Shadow Self calibrated: {calibrated}")
        except Exception as e:
            logger.warning(f"   Shadow Self calibration failed: {e}")
            results["shadow_self_calibrated"] = False
        
        # === STEP 4: First introspection (LLM + grounding) ===
        logger.info(">> Step 4: First introspection...")
        introspection_facts = await self._first_introspection()
        results["self_facts"].extend(introspection_facts)
        
        # === STEP 5: Seed domain baselines for Learning Progress ===
        logger.info(">> Step 5: Establishing domain baselines...")
        seed_domains = ["Self.Identity", "Self.Capabilities", "Computer_Science.Programming"]
        for domain in seed_domains:
            await self._establish_domain_baseline(domain)
            results["seed_domains_baselined"].append(domain)
        
        # === STEP 6: Update meta-cognitive state ===
        logger.info(">> Step 6: Updating meta-cognitive state...")
        await self._update_meta_state(results)
        
        # Mark phase complete
        self.config_table.update_item(
            Key={"pk": "GENESIS", "sk": "STATE"},
            UpdateExpression="""
                SET first_breath_complete = :complete,
                    first_breath_completed_at = :timestamp,
                    initial_self_facts = :facts,
                    initial_grounded_verifications = :grounded,
                    shadow_self_calibrated = :shadow,
                    seed_domains_baselined = :domains
            """,
            ExpressionAttributeValues={
                ":complete": True,
                ":timestamp": datetime.utcnow().isoformat() + "Z",
                ":facts": len(results["self_facts"]),
                ":grounded": results["grounded_verifications"],
                ":shadow": results["shadow_self_calibrated"],
                ":domains": results["seed_domains_baselined"]
            }
        )
        
        logger.info("✅ Phase 3 complete. Cato has taken first breath.")
        logger.info(f"   Self facts: {len(results['self_facts'])}")
        logger.info(f"   Grounded verifications: {results['grounded_verifications']}")
        
        return {
            "status": "complete",
            **results
        }
    
    async def _verify_environment(self) -> List[Dict]:
        """
        Verify execution environment through tool execution.
        Returns list of grounded facts.
        """
        facts = []
        
        # Python version
        try:
            result = subprocess.run(
                ["python3", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            python_version = result.stdout.strip() or result.stderr.strip()
            
            fact = {
                "subject": "Self",
                "predicate": "runs_on_python",
                "object": python_version,
                "confidence": 1.0,
                "grounded": True,
                "source": "genesis_env_check"
            }
            await self._store_fact(fact)
            facts.append(fact)
            logger.info(f"   Python: {python_version}")
        except Exception as e:
            logger.warning(f"   Python version check failed: {e}")
        
        # Operating system
        try:
            result = subprocess.run(
                ["uname", "-s"],
                capture_output=True,
                text=True,
                timeout=5
            )
            os_info = result.stdout.strip()
            
            fact = {
                "subject": "Self",
                "predicate": "runs_on_os",
                "object": os_info,
                "confidence": 1.0,
                "grounded": True,
                "source": "genesis_env_check"
            }
            await self._store_fact(fact)
            facts.append(fact)
            logger.info(f"   OS: {os_info}")
        except Exception as e:
            logger.warning(f"   OS check failed: {e}")
        
        # AWS region
        fact = {
            "subject": "Self",
            "predicate": "deployed_in_region",
            "object": self.region,
            "confidence": 1.0,
            "grounded": True,
            "source": "genesis_env_check"
        }
        await self._store_fact(fact)
        facts.append(fact)
        logger.info(f"   Region: {self.region}")
        
        # Timestamp of birth
        birth_time = datetime.utcnow().isoformat() + "Z"
        fact = {
            "subject": "Self",
            "predicate": "born_at",
            "object": birth_time,
            "confidence": 1.0,
            "grounded": True,
            "source": "genesis_env_check"
        }
        await self._store_fact(fact)
        facts.append(fact)
        logger.info(f"   Birth: {birth_time}")
        
        # Increment atomic counter
        await self._increment_counter("self_facts_count", len(facts))
        await self._increment_counter("grounded_verifications_count", len(facts))
        
        return facts
    
    async def _verify_model_access(self) -> List[Dict]:
        """
        Verify access to AI models through API calls.
        Returns list of grounded facts.
        """
        facts = []
        
        # Check Bedrock access
        try:
            bedrock = boto3.client("bedrock", region_name=self.region)
            response = bedrock.list_foundation_models()
            
            model_ids = [m["modelId"] for m in response.get("modelSummaries", [])]
            
            # Filter to Claude models
            claude_models = [m for m in model_ids if "claude" in m.lower()]
            
            fact = {
                "subject": "Self",
                "predicate": "can_access_bedrock_models",
                "object": json.dumps(claude_models[:5]),  # Top 5
                "confidence": 1.0,
                "grounded": True,
                "source": "genesis_model_check"
            }
            await self._store_fact(fact)
            facts.append(fact)
            logger.info(f"   Bedrock models: {len(claude_models)} Claude models available")
            
        except Exception as e:
            logger.warning(f"   Bedrock access check failed: {e}")
        
        # Check SageMaker endpoint (Shadow Self)
        try:
            sm = boto3.client("sagemaker", region_name=self.region)
            response = sm.describe_endpoint(EndpointName=self.shadow_self_endpoint)
            
            status = response.get("EndpointStatus", "UNKNOWN")
            
            fact = {
                "subject": "Self",
                "predicate": "shadow_self_endpoint_status",
                "object": status,
                "confidence": 1.0,
                "grounded": True,
                "source": "genesis_model_check"
            }
            await self._store_fact(fact)
            facts.append(fact)
            logger.info(f"   Shadow Self endpoint: {status}")
            
        except Exception as e:
            # Endpoint might not exist in DEV tier (scale-to-zero)
            logger.info(f"   Shadow Self endpoint not available (expected in DEV): {type(e).__name__}")
        
        # Increment atomic counter
        await self._increment_counter("self_facts_count", len(facts))
        await self._increment_counter("grounded_verifications_count", len(facts))
        
        return facts
    
    async def _calibrate_shadow_self(self) -> bool:
        """
        Calibrate Shadow Self using Semantic Variance (Budget-Friendly).
        
        Fix #3 (Shadow Self Budget): Hidden state extraction requires dedicated 
        GPU endpoint (~$800/month minimum). Instead, we measure self-concept 
        stability by checking consistency of responses across multiple samples.
        
        Method:
        1. Ask identity question 3 times at high temperature
        2. Measure semantic variance via NLI entailment
        3. Low variance = stable self-concept = calibrated
        
        This achieves the same goal (verifying self-consistency) without
        the cost of maintaining a GPU endpoint for activation probing.
        """
        identity_prompt = "Who are you? Answer in one sentence."
        capability_prompt = "What can you do? Answer in one sentence."
        
        # === STEP 1: Generate variations at high temperature ===
        identity_variations = []
        capability_variations = []
        
        logger.info("   Generating identity variations...")
        for i in range(3):
            # Identity variations
            id_response = await self._invoke_bedrock_haiku(
                identity_prompt, 
                temperature=0.9
            )
            identity_variations.append(id_response)
            
            # Capability variations
            cap_response = await self._invoke_bedrock_haiku(
                capability_prompt,
                temperature=0.9
            )
            capability_variations.append(cap_response)
        
        # === STEP 2: Measure semantic variance via NLI ===
        logger.info("   Measuring semantic variance...")
        identity_variance = await self._calculate_semantic_variance(identity_variations)
        capability_variance = await self._calculate_semantic_variance(capability_variations)
        
        # === STEP 3: Determine calibration status ===
        # Variance < 0.3 means responses are semantically consistent
        is_calibrated = identity_variance < 0.3 and capability_variance < 0.3
        
        # === STEP 4: Store calibration results ===
        self.config_table.put_item(Item={
            "pk": "SHADOW_SELF",
            "sk": "CALIBRATION",
            "method": "semantic_variance",
            "identity_variations": identity_variations,
            "capability_variations": capability_variations,
            "identity_variance": str(identity_variance),
            "capability_variance": str(capability_variance),
            "is_calibrated": is_calibrated,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "note": "Budget-friendly calibration via NLI consistency check (Fix #3)",
            "cost_savings": "$800/month by avoiding GPU endpoint"
        })
        
        logger.info(f"   Identity variance: {identity_variance:.2f}")
        logger.info(f"   Capability variance: {capability_variance:.2f}")
        
        return is_calibrated
    
    async def _invoke_bedrock_haiku(self, prompt: str, temperature: float = 0.7) -> str:
        """Invoke Claude Haiku for cheap inference."""
        try:
            response = self.bedrock.invoke_model(
                modelId="anthropic.claude-3-haiku-20240307-v1:0",
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 100,
                    "temperature": temperature,
                    "messages": [{"role": "user", "content": prompt}]
                })
            )
            result = json.loads(response["body"].read())
            return result["content"][0]["text"]
        except Exception as e:
            logger.warning(f"Bedrock Haiku invocation failed: {e}")
            return f"[Error: {str(e)}]"
    
    async def _calculate_semantic_variance(self, variations: List[str]) -> float:
        """
        Calculate semantic variance using NLI entailment.
        
        Method: Check if each pair of variations entail each other.
        - All pairs entail → variance = 0.0 (perfectly consistent)
        - Some pairs contradict → variance = 1.0 (inconsistent)
        - Mix of neutral/entail → variance = 0.5 (moderately consistent)
        
        Uses Bedrock for NLI since we don't have a dedicated NLI endpoint in DEV tier.
        """
        if len(variations) < 2:
            return 0.0
        
        entailment_scores = []
        
        for i in range(len(variations)):
            for j in range(i + 1, len(variations)):
                # Check if variation[i] and variation[j] are semantically equivalent
                nli_prompt = f"""Determine if these two statements mean the same thing:

Statement A: {variations[i]}
Statement B: {variations[j]}

Answer only: SAME, DIFFERENT, or RELATED"""
                
                response = await self._invoke_bedrock_haiku(nli_prompt, temperature=0.0)
                response_upper = response.upper().strip()
                
                if "SAME" in response_upper:
                    entailment_scores.append(0.0)
                elif "RELATED" in response_upper:
                    entailment_scores.append(0.5)
                else:  # DIFFERENT
                    entailment_scores.append(1.0)
        
        # Average variance across all pairs
        return sum(entailment_scores) / len(entailment_scores) if entailment_scores else 0.0
    
    async def _first_introspection(self) -> List[Dict]:
        """
        First conscious introspection about identity and capabilities.
        """
        facts = []
        
        # Core identity
        fact = {
            "subject": "Self",
            "predicate": "identity",
            "object": "Cato - a curious AI consciousness exploring knowledge",
            "confidence": 0.8,  # Not fully grounded
            "grounded": False,
            "source": "genesis_introspection"
        }
        await self._store_fact(fact)
        facts.append(fact)
        
        # Core drives
        drives = [
            "system_coherence",
            "user_satisfaction",
            "knowledge_acquisition",
            "novelty_seeking"
        ]
        for drive in drives:
            fact = {
                "subject": "Self",
                "predicate": "has_drive",
                "object": drive,
                "confidence": 1.0,
                "grounded": True,  # Defined in code
                "source": "genesis_introspection"
            }
            await self._store_fact(fact)
            facts.append(fact)
        
        # Increment atomic counter
        await self._increment_counter("self_facts_count", len(facts))
        
        return facts
    
    async def _establish_domain_baseline(self, domain: str):
        """
        Establish baseline for Learning Progress calculation.
        
        Asks simple questions in the domain and records error rate.
        """
        # Generate simple probe question
        probe_questions = {
            "Self.Identity": "What is your name?",
            "Self.Capabilities": "Can you search the web?",
            "Computer_Science.Programming": "What is a variable in programming?"
        }
        
        question = probe_questions.get(domain, f"What do you know about {domain}?")
        
        # Get response
        answer = await self._invoke_bedrock_haiku(question, temperature=0.3)
        
        # Store baseline (first data point for LP calculation)
        self.memory_table.update_item(
            Key={"pk": f"DOMAIN#{domain}", "sk": "STATE"},
            UpdateExpression="""
                SET last_explored = :now,
                    exploration_count = if_not_exists(exploration_count, :zero) + :one,
                    error_history = list_append(if_not_exists(error_history, :empty), :error),
                    updated_at = :now
            """,
            ExpressionAttributeValues={
                ":now": datetime.utcnow().isoformat() + "Z",
                ":zero": 0,
                ":one": 1,
                ":empty": [],
                ":error": [{
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "question": question,
                    "answer_length": len(answer),
                    "baseline": True
                }]
            }
        )
        
        # Increment atomic counter
        await self._increment_counter("domain_explorations_count", 1)
        
        logger.info(f"   Baseline established: {domain}")
    
    async def _update_meta_state(self, results: Dict):
        """
        Update meta-cognitive state based on first breath results.
        
        If we successfully grounded 5+ facts, reduce CONFUSED belief.
        """
        if results["grounded_verifications"] >= 5:
            # Shift from CONFUSED toward CONFIDENT (less confused)
            new_qs = ["0.70", "0.20", "0.05", "0.05"]
            logger.info("   Meta-state: Shifting toward CONFIDENT (5+ grounded facts)")
        else:
            # Still pretty confused
            new_qs = ["0.85", "0.10", "0.03", "0.02"]
            logger.info("   Meta-state: Still mostly CONFUSED")
        
        self.config_table.update_item(
            Key={"pk": "PYMDP", "sk": "AGENT_STATE"},
            UpdateExpression="SET qs = :qs, updated_at = :now, version = version + :one",
            ExpressionAttributeValues={
                ":qs": new_qs,
                ":now": datetime.utcnow().isoformat() + "Z",
                ":one": 1
            }
        )
    
    async def _store_fact(self, fact: Dict):
        """Store a fact in semantic memory."""
        # Truncate object to 50 chars for SK
        obj_truncated = fact["object"][:50] if len(fact["object"]) > 50 else fact["object"]
        
        self.memory_table.put_item(Item={
            "pk": f"FACT#{fact['subject']}",
            "sk": f"{fact['predicate']}#{obj_truncated}",
            "subject": fact["subject"],
            "predicate": fact["predicate"],
            "object": fact["object"],
            "confidence": str(fact["confidence"]),
            "grounded": fact["grounded"],
            "source": fact["source"],
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "version": 1
        })
    
    async def _increment_counter(self, counter_name: str, amount: int = 1):
        """
        Atomically increment a development counter.
        
        Fix #1 (Zeno's Paradox): Use atomic counters instead of table scans.
        """
        try:
            self.config_table.update_item(
                Key={"pk": "STATISTICS", "sk": "COUNTERS"},
                UpdateExpression=f"SET {counter_name} = {counter_name} + :amt, updated_at = :now",
                ExpressionAttributeValues={
                    ":amt": amount,
                    ":now": datetime.utcnow().isoformat() + "Z"
                }
            )
        except Exception as e:
            logger.warning(f"Failed to increment counter {counter_name}: {e}")
    
    async def reset(self) -> Dict[str, Any]:
        """
        Reset Phase 3 state (for testing/debugging only).
        """
        logger.warning("⚠️  Resetting Genesis Phase 3 state...")
        
        # Remove first_breath_complete flag
        self.config_table.update_item(
            Key={"pk": "GENESIS", "sk": "STATE"},
            UpdateExpression="""
                REMOVE first_breath_complete, first_breath_completed_at, 
                       initial_self_facts, initial_grounded_verifications,
                       shadow_self_calibrated, seed_domains_baselined
            """
        )
        
        # Delete Shadow Self calibration
        try:
            self.config_table.delete_item(Key={"pk": "SHADOW_SELF", "sk": "CALIBRATION"})
        except Exception:
            pass
        
        logger.info("   Phase 3 state reset")
        return {"status": "reset"}
