"""
Cato Ray Serve Orchestration Layer

Replaces LiteLLM with stateful orchestration for 10MM+ user scale.
Provides model routing, context management, and circuit breaker patterns.

See: /docs/cato/adr/001-replace-litellm.md
"""

import ray
from ray import serve
from ray.serve.handle import DeploymentHandle
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
import asyncio
import time
import logging

logger = logging.getLogger(__name__)


class ModelTier(Enum):
    """Model tiers for routing decisions."""
    SHADOW_SELF = "shadow_self"      # Llama-3-8B for activation probing
    BEDROCK_SONNET = "bedrock_sonnet"  # Claude 3.5 Sonnet for complex reasoning
    BEDROCK_HAIKU = "bedrock_haiku"   # Claude 3 Haiku for simple queries
    NLI = "nli"                        # DeBERTa for entailment
    CACHED = "cached"                  # Semantic cache hit


@dataclass
class RoutingDecision:
    """Routing decision for a query."""
    primary_model: ModelTier
    fallback_chain: List[ModelTier]
    requires_grounding: bool
    cache_eligible: bool
    estimated_cost: float


@dataclass
class CircuitBreakerState:
    """Circuit breaker state for a model endpoint."""
    failure_count: int = 0
    last_failure_time: float = 0
    state: str = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    half_open_successes: int = 0


class CircuitBreaker:
    """
    Circuit breaker for model endpoint protection.
    
    States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_requests: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests
        self._state = CircuitBreakerState()
    
    def can_execute(self) -> bool:
        if self._state.state == "CLOSED":
            return True
        elif self._state.state == "OPEN":
            if time.time() - self._state.last_failure_time > self.recovery_timeout:
                self._state.state = "HALF_OPEN"
                self._state.half_open_successes = 0
                return True
            return False
        else:  # HALF_OPEN
            return True
    
    def record_success(self):
        if self._state.state == "HALF_OPEN":
            self._state.half_open_successes += 1
            if self._state.half_open_successes >= self.half_open_requests:
                self._state.state = "CLOSED"
                self._state.failure_count = 0
        else:
            self._state.failure_count = 0
    
    def record_failure(self):
        self._state.failure_count += 1
        self._state.last_failure_time = time.time()
        
        if self._state.failure_count >= self.failure_threshold:
            self._state.state = "OPEN"
        elif self._state.state == "HALF_OPEN":
            self._state.state = "OPEN"


@dataclass
class ConversationContext:
    """Conversation context for a session."""
    session_id: str
    messages: List[Dict[str, str]] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    
    def add_turn(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        self.last_accessed = time.time()
        # Prune to last 10 turns (20 messages)
        if len(self.messages) > 20:
            self.messages = self.messages[-20:]


@serve.deployment(
    num_replicas=10,
    ray_actor_options={"num_cpus": 2, "memory": 4 * 1024 * 1024 * 1024}
)
class CatoOrchestrator:
    """
    Main orchestration deployment replacing LiteLLM.
    
    Handles:
    - Semantic cache lookup
    - Model routing based on query type
    - Context management via stateful actors
    - Circuit breaker for graceful degradation
    """
    
    def __init__(self):
        # Circuit breakers per model
        self.circuit_breakers: Dict[ModelTier, CircuitBreaker] = {
            ModelTier.SHADOW_SELF: CircuitBreaker(),
            ModelTier.BEDROCK_SONNET: CircuitBreaker(),
            ModelTier.BEDROCK_HAIKU: CircuitBreaker(),
            ModelTier.NLI: CircuitBreaker(),
        }
        
        # Conversation contexts (stateful)
        self.contexts: Dict[str, ConversationContext] = {}
        
        # Handles to other deployments (set via reconfigure)
        self.shadow_self_handle: Optional[DeploymentHandle] = None
        self.bedrock_handle: Optional[DeploymentHandle] = None
        self.nli_handle: Optional[DeploymentHandle] = None
        self.cache_handle: Optional[DeploymentHandle] = None
        
        logger.info("CatoOrchestrator initialized")
    
    def reconfigure(self, config: Dict[str, Any]):
        """Reconfigure with deployment handles."""
        # In production, handles would be injected here
        pass
    
    async def route_query(
        self,
        query: str,
        session_id: str,
        query_type: str = "general",
        user_id: Optional[str] = None,
        require_grounding: bool = False
    ) -> Dict[str, Any]:
        """
        Route query to appropriate model(s).
        
        Fallback chain: Sonnet → Haiku → Cache → Static
        """
        start_time = time.time()
        
        # 1. Check semantic cache first (if cache handle available)
        if self.cache_handle:
            try:
                cache_result = await self.cache_handle.lookup.remote(query)
                if cache_result and cache_result.get("hit"):
                    return {
                        "response": cache_result["response"],
                        "model": ModelTier.CACHED.value,
                        "cached": True,
                        "latency_ms": (time.time() - start_time) * 1000
                    }
            except Exception as e:
                logger.warning(f"Cache lookup failed: {e}")
        
        # 2. Determine routing
        routing = self._determine_routing(query, query_type, require_grounding)
        
        # 3. Execute with fallback chain
        models_to_try = [routing.primary_model] + routing.fallback_chain
        
        for model_tier in models_to_try:
            cb = self.circuit_breakers.get(model_tier)
            
            if cb and not cb.can_execute():
                logger.info(f"Circuit breaker open for {model_tier.value}")
                continue
            
            try:
                result = await self._execute_model(
                    model_tier, query, session_id
                )
                
                if cb:
                    cb.record_success()
                
                # Cache if eligible
                if routing.cache_eligible and self.cache_handle:
                    try:
                        await self.cache_handle.store.remote(query, result["response"])
                    except Exception as e:
                        logger.warning(f"Cache store failed: {e}")
                
                result["latency_ms"] = (time.time() - start_time) * 1000
                return result
                
            except Exception as e:
                logger.error(f"Model {model_tier.value} failed: {e}")
                if cb:
                    cb.record_failure()
                continue
        
        # All models failed — return static response
        return {
            "response": "I'm experiencing high demand. Please try again shortly.",
            "model": "static_fallback",
            "error": True,
            "latency_ms": (time.time() - start_time) * 1000
        }
    
    def _determine_routing(
        self,
        query: str,
        query_type: str,
        require_grounding: bool
    ) -> RoutingDecision:
        """Determine routing based on query characteristics."""
        
        # Introspection queries → Shadow Self + Sonnet
        if query_type == "introspection":
            return RoutingDecision(
                primary_model=ModelTier.BEDROCK_SONNET,
                fallback_chain=[ModelTier.BEDROCK_HAIKU],
                requires_grounding=True,
                cache_eligible=False,
                estimated_cost=0.01
            )
        
        # Simple factual queries → Haiku first
        if len(query.split()) < 20 and "?" in query:
            return RoutingDecision(
                primary_model=ModelTier.BEDROCK_HAIKU,
                fallback_chain=[ModelTier.BEDROCK_SONNET],
                requires_grounding=require_grounding,
                cache_eligible=True,
                estimated_cost=0.001
            )
        
        # Complex reasoning → Sonnet
        return RoutingDecision(
            primary_model=ModelTier.BEDROCK_SONNET,
            fallback_chain=[ModelTier.BEDROCK_HAIKU],
            requires_grounding=require_grounding,
            cache_eligible=True,
            estimated_cost=0.005
        )
    
    async def _execute_model(
        self,
        model_tier: ModelTier,
        query: str,
        session_id: str
    ) -> Dict[str, Any]:
        """Execute query on specific model."""
        
        # Get or create context
        if session_id not in self.contexts:
            self.contexts[session_id] = ConversationContext(session_id=session_id)
        context = self.contexts[session_id]
        
        # Build messages with context
        messages = context.messages.copy()
        messages.append({"role": "user", "content": query})
        
        # Route to appropriate model
        if model_tier == ModelTier.SHADOW_SELF:
            if self.shadow_self_handle:
                result = await self.shadow_self_handle.invoke.remote(query, messages)
            else:
                raise RuntimeError("Shadow Self handle not configured")
                
        elif model_tier in [ModelTier.BEDROCK_SONNET, ModelTier.BEDROCK_HAIKU]:
            if self.bedrock_handle:
                result = await self.bedrock_handle.invoke.remote(
                    query, messages, model_tier.value
                )
            else:
                # Fallback to direct Bedrock call
                result = await self._call_bedrock_direct(query, messages, model_tier)
                
        elif model_tier == ModelTier.NLI:
            if self.nli_handle:
                result = await self.nli_handle.classify.remote(query)
            else:
                raise RuntimeError("NLI handle not configured")
        else:
            raise ValueError(f"Unknown model tier: {model_tier}")
        
        # Update context
        context.add_turn("user", query)
        context.add_turn("assistant", result.get("response", ""))
        
        return {
            "response": result.get("response"),
            "model": model_tier.value,
            "cached": False
        }
    
    async def _call_bedrock_direct(
        self,
        query: str,
        messages: List[Dict[str, str]],
        model_tier: ModelTier
    ) -> Dict[str, Any]:
        """Direct Bedrock call as fallback."""
        import boto3
        import json
        
        client = boto3.client("bedrock-runtime", region_name="us-east-1")
        
        model_id = (
            "anthropic.claude-3-5-sonnet-20241022-v2:0"
            if model_tier == ModelTier.BEDROCK_SONNET
            else "anthropic.claude-3-haiku-20240307-v1:0"
        )
        
        # Format messages for Claude
        claude_messages = []
        for msg in messages:
            claude_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        response = client.invoke_model(
            modelId=model_id,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "messages": claude_messages
            })
        )
        
        result = json.loads(response["body"].read())
        
        return {
            "response": result["content"][0]["text"]
        }
    
    async def get_context(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get conversation context for a session."""
        if session_id in self.contexts:
            ctx = self.contexts[session_id]
            return {
                "session_id": ctx.session_id,
                "message_count": len(ctx.messages),
                "created_at": ctx.created_at,
                "last_accessed": ctx.last_accessed
            }
        return None
    
    async def clear_context(self, session_id: str) -> bool:
        """Clear conversation context for a session."""
        if session_id in self.contexts:
            del self.contexts[session_id]
            return True
        return False
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for the orchestrator."""
        return {
            "status": "healthy",
            "active_contexts": len(self.contexts),
            "circuit_breakers": {
                tier.value: {
                    "state": self.circuit_breakers[tier]._state.state,
                    "failure_count": self.circuit_breakers[tier]._state.failure_count
                }
                for tier in self.circuit_breakers
            }
        }


# Deployment configuration
def get_deployment_config(environment: str = "production") -> Dict[str, Any]:
    """Get deployment configuration based on environment."""
    configs = {
        "development": {
            "num_replicas": 1,
            "ray_actor_options": {"num_cpus": 1, "memory": 2 * 1024 * 1024 * 1024}
        },
        "staging": {
            "num_replicas": 5,
            "ray_actor_options": {"num_cpus": 2, "memory": 4 * 1024 * 1024 * 1024}
        },
        "production": {
            "num_replicas": 50,
            "ray_actor_options": {"num_cpus": 2, "memory": 4 * 1024 * 1024 * 1024},
            "autoscaling_config": {
                "min_replicas": 10,
                "max_replicas": 100,
                "target_num_ongoing_requests_per_replica": 10
            }
        }
    }
    return configs.get(environment, configs["production"])


# Application entrypoint
app = CatoOrchestrator.bind()
