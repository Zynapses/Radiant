"""
RADIANT v5.4.0 - Cognitive Architecture Flyte Workflows (PROMPT-40)

Implements the Active Inference cognitive routing system with:
- sniper_execute: Fast path for simple queries with Ghost Memory hit
- war_room_execute: Deep analysis with multi-model validation
- read_ghost_memory: Circuit breaker-protected Ghost Memory reads
- append_ghost_memory: Non-blocking write-back with retry logic

Architecture:
    ┌─────────────────────────────────────────────────────────────────┐
    │                    COGNITIVE WORKFLOW                            │
    ├─────────────────────────────────────────────────────────────────┤
    │                                                                  │
    │   User Query ──► Economic Governor ──► Route Decision            │
    │                         │                                        │
    │            ┌────────────┼────────────┐                          │
    │            │            │            │                          │
    │            ▼            ▼            ▼                          │
    │        Sniper       War Room       HITL                         │
    │            │            │            │                          │
    │            │            │            │                          │
    │            └────────────┼────────────┘                          │
    │                         │                                        │
    │                         ▼                                        │
    │                    Write-Back                                    │
    │                  (non-blocking)                                  │
    │                                                                  │
    └─────────────────────────────────────────────────────────────────┘
"""

import logging
import hashlib
import time
import json
from datetime import timedelta, datetime
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass

from flytekit import task, workflow, dynamic, wait_for_input, approve
from flytekit.types.file import FlyteFile
import boto3

from .circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitOpenError,
    get_ghost_memory_circuit_breaker,
    get_sniper_circuit_breaker,
    get_war_room_circuit_breaker,
)
from .metrics import CognitiveMetrics, emit_metric

logger = logging.getLogger(__name__)


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class CognitiveContext:
    """Context for cognitive workflow execution."""
    tenant_id: str
    user_id: str
    session_id: str
    query: str
    domain_hint: Optional[str] = None
    user_tier: str = "standard"
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class GhostMemoryEntry:
    """Ghost Memory entry with semantic key and TTL."""
    semantic_key: str
    content: str
    domain_hint: Optional[str] = None
    ttl_seconds: int = 86400  # 24 hours default
    confidence: float = 1.0
    source_workflow: Optional[str] = None
    metadata: Dict[str, Any] = None


@dataclass
class GhostReadResult:
    """Result from Ghost Memory read."""
    hit: bool
    content: Optional[str] = None
    semantic_key: Optional[str] = None
    confidence: float = 1.0
    domain_hint: Optional[str] = None
    ttl_remaining_seconds: Optional[int] = None
    circuit_breaker_fallback: bool = False
    latency_ms: float = 0


@dataclass
class RoutingDecision:
    """Economic Governor routing decision."""
    route_type: str  # 'sniper', 'war_room', 'hitl'
    complexity_score: float
    retrieval_confidence: float
    ghost_hit: bool
    selected_model: str
    reason: str
    estimated_cost_cents: float
    domain_hint: Optional[str] = None


@dataclass
class ExecutionResult:
    """Result from sniper or war room execution."""
    success: bool
    response: str
    model_used: str
    route_type: str
    latency_ms: float
    tokens_used: int = 0
    cost_cents: float = 0
    write_back_queued: bool = False
    metadata: Dict[str, Any] = None


# =============================================================================
# RADIANT Service Client (placeholder for actual service calls)
# =============================================================================

class RadiantServiceClient:
    """
    Client for RADIANT internal services.
    
    In production, this connects to:
    - Ghost Manager Service (TypeScript Lambda)
    - LiteLLM Proxy
    - Economic Governor Service
    """
    
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self._lambda = boto3.client('lambda')
        self._sqs = boto3.client('sqs')
        self._api_base = "http://radiant-api.internal"
    
    def invoke_ghost_read(
        self,
        user_id: str,
        semantic_key: str
    ) -> GhostReadResult:
        """Read from Ghost Memory via Lambda."""
        try:
            response = self._lambda.invoke(
                FunctionName='radiant-ghost-memory',
                InvocationType='RequestResponse',
                Payload=json.dumps({
                    'action': 'read',
                    'tenantId': self.tenant_id,
                    'userId': user_id,
                    'semanticKey': semantic_key,
                })
            )
            
            result = json.loads(response['Payload'].read())
            
            if result.get('hit'):
                return GhostReadResult(
                    hit=True,
                    content=result.get('content'),
                    semantic_key=result.get('semanticKey'),
                    confidence=result.get('confidence', 1.0),
                    domain_hint=result.get('domainHint'),
                    ttl_remaining_seconds=result.get('ttlRemaining'),
                )
            else:
                return GhostReadResult(hit=False)
                
        except Exception as e:
            logger.warning(f"Ghost Memory read failed: {e}")
            return GhostReadResult(hit=False)
    
    def invoke_ghost_write(
        self,
        user_id: str,
        entry: GhostMemoryEntry
    ) -> bool:
        """Write to Ghost Memory via Lambda (non-blocking queue)."""
        try:
            self._sqs.send_message(
                QueueUrl=f"https://sqs.us-east-1.amazonaws.com/{self.tenant_id}/ghost-write-queue",
                MessageBody=json.dumps({
                    'tenantId': self.tenant_id,
                    'userId': user_id,
                    'semanticKey': entry.semantic_key,
                    'content': entry.content,
                    'domainHint': entry.domain_hint,
                    'ttlSeconds': entry.ttl_seconds,
                    'sourceWorkflow': entry.source_workflow,
                })
            )
            return True
        except Exception as e:
            logger.warning(f"Ghost Memory write queue failed: {e}")
            return False
    
    def invoke_llm(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7
    ) -> Tuple[str, int, float]:
        """
        Invoke LLM via LiteLLM proxy.
        
        Returns: (response_text, tokens_used, cost_cents)
        """
        import requests
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = requests.post(
            f"{self._api_base}/v1/chat/completions",
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            headers={"Authorization": f"Bearer {self.tenant_id}"},
            timeout=120,
        )
        response.raise_for_status()
        
        data = response.json()
        text = data['choices'][0]['message']['content']
        tokens = data.get('usage', {}).get('total_tokens', 0)
        cost = data.get('usage', {}).get('cost_cents', 0)
        
        return text, tokens, cost


# =============================================================================
# Flyte Tasks
# =============================================================================

@task(retries=2, timeout=timedelta(seconds=10))
def read_ghost_memory(
    context: CognitiveContext,
    semantic_key: str
) -> GhostReadResult:
    """
    Read from Ghost Memory with circuit breaker protection.
    
    If circuit breaker is open, returns fallback result indicating
    the request should be routed to War Room for validation.
    """
    start_time = time.time()
    metrics = CognitiveMetrics(context.tenant_id)
    cb = get_ghost_memory_circuit_breaker()
    
    def _read():
        client = RadiantServiceClient(context.tenant_id)
        return client.invoke_ghost_read(context.user_id, semantic_key)
    
    def _fallback():
        return GhostReadResult(
            hit=False,
            circuit_breaker_fallback=True,
        )
    
    try:
        # Check circuit breaker
        if not cb.can_execute():
            logger.info(f"Ghost Memory circuit breaker open, using fallback")
            result = _fallback()
            metrics.record_ghost_miss(
                user_id=context.user_id,
                reason="circuit_open",
                latency_ms=(time.time() - start_time) * 1000
            )
            return result
        
        result = _read()
        result.latency_ms = (time.time() - start_time) * 1000
        
        if result.hit:
            cb.record_success()
            metrics.record_ghost_hit(
                user_id=context.user_id,
                semantic_key=semantic_key,
                confidence=result.confidence,
                domain_hint=result.domain_hint,
                latency_ms=result.latency_ms
            )
        else:
            metrics.record_ghost_miss(
                user_id=context.user_id,
                reason="not_found",
                latency_ms=result.latency_ms
            )
        
        return result
        
    except Exception as e:
        cb.record_failure(e)
        logger.error(f"Ghost Memory read failed: {e}")
        metrics.record_ghost_miss(
            user_id=context.user_id,
            reason="error",
            latency_ms=(time.time() - start_time) * 1000
        )
        return _fallback()
    finally:
        metrics.flush()


@task(retries=2, timeout=timedelta(seconds=5))
def append_ghost_memory(
    context: CognitiveContext,
    entry: GhostMemoryEntry
) -> bool:
    """
    Append to Ghost Memory (non-blocking write-back).
    
    This task queues the write to SQS and returns immediately.
    The actual write is processed asynchronously.
    
    Per PROMPT-40 spec: "Log but don't fail the task - memory write
    is important but not blocking"
    """
    metrics = CognitiveMetrics(context.tenant_id)
    
    try:
        client = RadiantServiceClient(context.tenant_id)
        success = client.invoke_ghost_write(context.user_id, entry)
        
        if success:
            metrics.record_ghost_write(
                user_id=context.user_id,
                semantic_key=entry.semantic_key,
                ttl_seconds=entry.ttl_seconds,
                domain_hint=entry.domain_hint,
                success=True
            )
        else:
            metrics.record_ghost_write_failure(
                user_id=context.user_id,
                error_type="queue_failed"
            )
        
        return success
        
    except Exception as e:
        logger.warning(f"Ghost Memory write failed (non-blocking): {e}")
        metrics.record_ghost_write_failure(
            user_id=context.user_id,
            error_type=type(e).__name__
        )
        emit_metric(
            context.tenant_id,
            "GhostMemoryWriteFailure",
            1,
            dimensions={"ErrorType": type(e).__name__}
        )
        return False
    finally:
        metrics.flush()


@task(timeout=timedelta(seconds=5))
def economic_governor_route(
    context: CognitiveContext,
    ghost_result: GhostReadResult
) -> RoutingDecision:
    """
    Economic Governor routing decision.
    
    Routes based on:
    1. retrieval_confidence < 0.7 → War Room (validation needed)
    2. complexity < 0.3 → Sniper (fast path)
    3. complexity > 0.7 → War Room (deep analysis)
    4. domain_hint = 'medical' → War Room + Precision Governor
    """
    start_time = time.time()
    metrics = CognitiveMetrics(context.tenant_id)
    
    # Default thresholds (would be loaded from config in production)
    RETRIEVAL_CONFIDENCE_THRESHOLD = 0.7
    SNIPER_COMPLEXITY_THRESHOLD = 0.3
    WAR_ROOM_COMPLEXITY_THRESHOLD = 0.7
    HIGH_RISK_DOMAINS = {'medical', 'financial', 'legal'}
    
    retrieval_confidence = ghost_result.confidence if ghost_result.hit else 1.0
    ghost_hit = ghost_result.hit and not ghost_result.circuit_breaker_fallback
    domain_hint = ghost_result.domain_hint or context.domain_hint
    
    # Circuit breaker fallback - always route to War Room
    if ghost_result.circuit_breaker_fallback:
        decision = RoutingDecision(
            route_type='war_room',
            complexity_score=-1,
            retrieval_confidence=0,
            ghost_hit=False,
            selected_model='claude-3-5-sonnet',
            reason='Circuit breaker open - routing to War Room for validation',
            estimated_cost_cents=1.5,
            domain_hint=domain_hint,
        )
    
    # Low retrieval confidence - needs validation
    elif retrieval_confidence < RETRIEVAL_CONFIDENCE_THRESHOLD:
        decision = RoutingDecision(
            route_type='war_room',
            complexity_score=-1,
            retrieval_confidence=retrieval_confidence,
            ghost_hit=ghost_hit,
            selected_model='claude-3-5-sonnet',
            reason=f'Low retrieval confidence ({retrieval_confidence:.1%}) - routing to War Room',
            estimated_cost_cents=1.5,
            domain_hint=domain_hint,
        )
    
    # High-risk domain - always War Room
    elif domain_hint in HIGH_RISK_DOMAINS:
        decision = RoutingDecision(
            route_type='war_room',
            complexity_score=-1,
            retrieval_confidence=retrieval_confidence,
            ghost_hit=ghost_hit,
            selected_model='claude-3-5-sonnet',
            reason=f"Domain '{domain_hint}' requires War Room + Precision Governor",
            estimated_cost_cents=1.5,
            domain_hint=domain_hint,
        )
    
    # Ghost hit with high confidence - Sniper path
    elif ghost_hit and retrieval_confidence >= 0.85:
        decision = RoutingDecision(
            route_type='sniper',
            complexity_score=2.0,
            retrieval_confidence=retrieval_confidence,
            ghost_hit=True,
            selected_model='gpt-4o-mini',
            reason=f'Ghost hit with high confidence ({retrieval_confidence:.1%}) - Sniper path',
            estimated_cost_cents=0.05,
            domain_hint=domain_hint,
        )
    
    # Analyze complexity for remaining cases
    else:
        complexity = _analyze_complexity(context.query)
        normalized_complexity = complexity / 10.0
        
        if normalized_complexity < SNIPER_COMPLEXITY_THRESHOLD:
            decision = RoutingDecision(
                route_type='sniper',
                complexity_score=complexity,
                retrieval_confidence=retrieval_confidence,
                ghost_hit=ghost_hit,
                selected_model='gpt-4o-mini',
                reason=f'Low complexity ({complexity}/10) - Sniper path',
                estimated_cost_cents=0.05,
                domain_hint=domain_hint,
            )
        elif normalized_complexity >= WAR_ROOM_COMPLEXITY_THRESHOLD:
            decision = RoutingDecision(
                route_type='war_room',
                complexity_score=complexity,
                retrieval_confidence=retrieval_confidence,
                ghost_hit=ghost_hit,
                selected_model='claude-3-5-sonnet',
                reason=f'High complexity ({complexity}/10) - War Room',
                estimated_cost_cents=1.5,
                domain_hint=domain_hint,
            )
        else:
            # Medium complexity - route based on ghost hit
            if ghost_hit:
                decision = RoutingDecision(
                    route_type='sniper',
                    complexity_score=complexity,
                    retrieval_confidence=retrieval_confidence,
                    ghost_hit=True,
                    selected_model='gpt-4o-mini',
                    reason=f'Medium complexity with Ghost hit - Sniper path',
                    estimated_cost_cents=0.05,
                    domain_hint=domain_hint,
                )
            else:
                decision = RoutingDecision(
                    route_type='war_room',
                    complexity_score=complexity,
                    retrieval_confidence=retrieval_confidence,
                    ghost_hit=False,
                    selected_model='claude-3-5-sonnet',
                    reason=f'Medium complexity without Ghost hit - War Room',
                    estimated_cost_cents=1.5,
                    domain_hint=domain_hint,
                )
    
    # Record metrics
    latency_ms = (time.time() - start_time) * 1000
    metrics.record_routing_decision(
        route_type=decision.route_type,
        complexity_score=decision.complexity_score,
        retrieval_confidence=decision.retrieval_confidence,
        ghost_hit=decision.ghost_hit,
        domain_hint=decision.domain_hint,
        latency_ms=latency_ms
    )
    metrics.flush()
    
    return decision


def _analyze_complexity(query: str) -> float:
    """
    Simple complexity analysis.
    
    In production, this calls the Economic Governor's System 0 classifier.
    """
    # Heuristic-based complexity estimation
    word_count = len(query.split())
    has_code = any(kw in query.lower() for kw in ['code', 'function', 'class', 'implement'])
    has_analysis = any(kw in query.lower() for kw in ['analyze', 'compare', 'explain'])
    has_simple = any(kw in query.lower() for kw in ['what is', 'define', 'list'])
    
    base_score = 5.0
    
    if word_count < 10:
        base_score -= 2
    elif word_count > 50:
        base_score += 2
    
    if has_simple:
        base_score -= 2
    if has_analysis:
        base_score += 1
    if has_code:
        base_score += 2
    
    return max(1, min(10, base_score))


@task(retries=1, timeout=timedelta(seconds=60))
def sniper_execute(
    context: CognitiveContext,
    routing: RoutingDecision,
    ghost_result: GhostReadResult
) -> ExecutionResult:
    """
    Sniper path execution - fast, cheap, single model.
    
    Includes write-back to Ghost Memory on success.
    """
    start_time = time.time()
    metrics = CognitiveMetrics(context.tenant_id)
    cb = get_sniper_circuit_breaker()
    
    try:
        if not cb.can_execute():
            raise CircuitOpenError("Sniper circuit breaker open")
        
        client = RadiantServiceClient(context.tenant_id)
        
        # Build prompt with ghost context if available
        system_prompt = "You are a helpful AI assistant."
        if ghost_result.hit and ghost_result.content:
            system_prompt += f"\n\nRelevant context from previous interactions:\n{ghost_result.content}"
        
        response_text, tokens, cost = client.invoke_llm(
            model=routing.selected_model,
            prompt=context.query,
            system_prompt=system_prompt,
            max_tokens=2048,
            temperature=0.7
        )
        
        cb.record_success()
        
        latency_ms = (time.time() - start_time) * 1000
        
        # Queue write-back (non-blocking)
        write_back_queued = False
        if response_text and len(response_text) > 50:
            semantic_key = _generate_semantic_key(context.query)
            entry = GhostMemoryEntry(
                semantic_key=semantic_key,
                content=response_text[:1000],  # Truncate for storage
                domain_hint=routing.domain_hint,
                ttl_seconds=86400,
                source_workflow='sniper',
            )
            write_back_queued = client.invoke_ghost_write(context.user_id, entry)
        
        metrics.record_sniper_execution(
            latency_ms=latency_ms,
            complexity_score=routing.complexity_score,
            success=True,
            model=routing.selected_model,
            write_back_queued=write_back_queued
        )
        metrics.flush()
        
        return ExecutionResult(
            success=True,
            response=response_text,
            model_used=routing.selected_model,
            route_type='sniper',
            latency_ms=latency_ms,
            tokens_used=tokens,
            cost_cents=cost,
            write_back_queued=write_back_queued,
        )
        
    except Exception as e:
        cb.record_failure(e)
        latency_ms = (time.time() - start_time) * 1000
        
        metrics.record_sniper_execution(
            latency_ms=latency_ms,
            complexity_score=routing.complexity_score,
            success=False,
            model=routing.selected_model
        )
        metrics.flush()
        
        logger.error(f"Sniper execution failed: {e}")
        return ExecutionResult(
            success=False,
            response=f"Sniper path failed: {e}",
            model_used=routing.selected_model,
            route_type='sniper',
            latency_ms=latency_ms,
            metadata={'error': str(e)}
        )


@task(retries=2, timeout=timedelta(seconds=120))
def war_room_execute(
    context: CognitiveContext,
    routing: RoutingDecision,
    ghost_result: GhostReadResult
) -> ExecutionResult:
    """
    War Room path execution - thorough, multi-model validation.
    
    For high-complexity or low-confidence queries.
    """
    start_time = time.time()
    metrics = CognitiveMetrics(context.tenant_id)
    cb = get_war_room_circuit_breaker()
    
    try:
        if not cb.can_execute():
            raise CircuitOpenError("War Room circuit breaker open")
        
        client = RadiantServiceClient(context.tenant_id)
        
        # Build comprehensive prompt
        system_prompt = """You are a thorough AI assistant performing deep analysis.
Take your time to think through the problem carefully.
Provide detailed, well-reasoned responses."""
        
        if ghost_result.hit and ghost_result.content:
            system_prompt += f"\n\nRelevant context (confidence: {ghost_result.confidence:.1%}):\n{ghost_result.content}"
        
        if routing.domain_hint:
            system_prompt += f"\n\nDomain: {routing.domain_hint} - Apply appropriate caution and precision."
        
        response_text, tokens, cost = client.invoke_llm(
            model=routing.selected_model,
            prompt=context.query,
            system_prompt=system_prompt,
            max_tokens=4096,
            temperature=0.5  # Lower temperature for more precise responses
        )
        
        cb.record_success()
        
        latency_ms = (time.time() - start_time) * 1000
        
        # Queue write-back for War Room results too
        write_back_queued = False
        if response_text and len(response_text) > 100:
            semantic_key = _generate_semantic_key(context.query)
            entry = GhostMemoryEntry(
                semantic_key=semantic_key,
                content=response_text[:2000],
                domain_hint=routing.domain_hint,
                ttl_seconds=172800,  # 48 hours for War Room results
                confidence=0.95,  # High confidence for validated results
                source_workflow='war_room',
            )
            write_back_queued = client.invoke_ghost_write(context.user_id, entry)
        
        metrics.record_war_room_execution(
            latency_ms=latency_ms,
            complexity_score=routing.complexity_score,
            success=True,
            models_used=1,
            fallback_triggered=False
        )
        metrics.flush()
        
        return ExecutionResult(
            success=True,
            response=response_text,
            model_used=routing.selected_model,
            route_type='war_room',
            latency_ms=latency_ms,
            tokens_used=tokens,
            cost_cents=cost,
            write_back_queued=write_back_queued,
        )
        
    except Exception as e:
        cb.record_failure(e)
        latency_ms = (time.time() - start_time) * 1000
        
        metrics.record_war_room_execution(
            latency_ms=latency_ms,
            complexity_score=routing.complexity_score,
            success=False,
            fallback_triggered=True
        )
        metrics.flush()
        
        logger.error(f"War Room execution failed: {e}")
        return ExecutionResult(
            success=False,
            response=f"War Room path failed: {e}",
            model_used=routing.selected_model,
            route_type='war_room',
            latency_ms=latency_ms,
            metadata={'error': str(e)}
        )


@task(timeout=timedelta(hours=24))
def hitl_escalate(
    context: CognitiveContext,
    routing: RoutingDecision,
    reason: str
) -> ExecutionResult:
    """
    HITL escalation for queries requiring human review.
    
    Uses Flyte's wait_for_input for external signal.
    """
    metrics = CognitiveMetrics(context.tenant_id)
    start_time = time.time()
    
    metrics.record_hitl_escalation(
        reason=reason,
        domain_hint=routing.domain_hint,
        timeout_seconds=86400
    )
    
    # In production, this would:
    # 1. Create a pending_decision record
    # 2. Notify via WebSocket
    # 3. Wait for external input via Flyte signal
    
    # For now, return a placeholder
    # Real implementation would use: wait_for_input("human_response", timeout=timedelta(hours=24))
    
    latency_ms = (time.time() - start_time) * 1000
    
    return ExecutionResult(
        success=False,
        response="Query escalated to human review. Please wait for a response.",
        model_used="human",
        route_type='hitl',
        latency_ms=latency_ms,
        metadata={
            'escalation_reason': reason,
            'timeout_hours': 24,
        }
    )


def _generate_semantic_key(query: str) -> str:
    """Generate semantic key for Ghost Memory deduplication."""
    normalized = query.lower().strip()
    return hashlib.sha256(normalized.encode()).hexdigest()[:32]


# =============================================================================
# Main Cognitive Workflow
# =============================================================================

@workflow
def cognitive_workflow(
    tenant_id: str,
    user_id: str,
    session_id: str,
    query: str,
    domain_hint: Optional[str] = None,
    user_tier: str = "standard"
) -> ExecutionResult:
    """
    Main cognitive workflow implementing PROMPT-40 Active Inference architecture.
    
    Flow:
    1. Read Ghost Memory (with circuit breaker)
    2. Economic Governor routing decision
    3. Execute via Sniper or War Room path
    4. Write-back to Ghost Memory (non-blocking)
    
    Args:
        tenant_id: Tenant identifier
        user_id: User identifier
        session_id: Session identifier
        query: User query
        domain_hint: Optional domain hint (medical, financial, legal, general)
        user_tier: User tier (free, standard, premium)
        
    Returns:
        ExecutionResult with response and metadata
    """
    # Build context
    context = CognitiveContext(
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
        query=query,
        domain_hint=domain_hint,
        user_tier=user_tier,
    )
    
    # Generate semantic key for Ghost lookup
    semantic_key = _generate_semantic_key(query)
    
    # Step 1: Read Ghost Memory
    ghost_result = read_ghost_memory(context=context, semantic_key=semantic_key)
    
    # Step 2: Economic Governor routing
    routing = economic_governor_route(context=context, ghost_result=ghost_result)
    
    # Step 3: Execute based on route
    if routing.route_type == 'sniper':
        result = sniper_execute(
            context=context,
            routing=routing,
            ghost_result=ghost_result
        )
    elif routing.route_type == 'war_room':
        result = war_room_execute(
            context=context,
            routing=routing,
            ghost_result=ghost_result
        )
    else:  # hitl
        result = hitl_escalate(
            context=context,
            routing=routing,
            reason=routing.reason
        )
    
    return result


# =============================================================================
# Convenience Functions for External Calls
# =============================================================================

def run_cognitive_query(
    tenant_id: str,
    user_id: str,
    session_id: str,
    query: str,
    domain_hint: Optional[str] = None,
    user_tier: str = "standard"
) -> Dict[str, Any]:
    """
    Convenience function to run cognitive workflow synchronously.
    
    For use in Lambda handlers or synchronous contexts.
    """
    # In production, this would launch the Flyte workflow
    # For now, execute tasks directly
    
    context = CognitiveContext(
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
        query=query,
        domain_hint=domain_hint,
        user_tier=user_tier,
    )
    
    semantic_key = _generate_semantic_key(query)
    
    # Execute tasks
    ghost_result = read_ghost_memory(context=context, semantic_key=semantic_key)
    routing = economic_governor_route(context=context, ghost_result=ghost_result)
    
    if routing.route_type == 'sniper':
        result = sniper_execute(context=context, routing=routing, ghost_result=ghost_result)
    else:
        result = war_room_execute(context=context, routing=routing, ghost_result=ghost_result)
    
    return {
        'success': result.success,
        'response': result.response,
        'route_type': result.route_type,
        'model_used': result.model_used,
        'latency_ms': result.latency_ms,
        'cost_cents': result.cost_cents,
        'ghost_hit': routing.ghost_hit,
        'complexity_score': routing.complexity_score,
        'retrieval_confidence': routing.retrieval_confidence,
    }


# =============================================================================
# Polymorphic UI Tasks (PROMPT-41)
# =============================================================================

@dataclass
class PolymorphicViewDecision:
    """Polymorphic UI view routing decision."""
    view_type: str  # terminal_simple, mindmap, diff_editor, dashboard, decision_cards, chat
    execution_mode: str  # sniper, war_room
    rationale: str
    estimated_cost_cents: int
    domain_hint: Optional[str] = None


VIEW_TYPE_PATTERNS = {
    'terminal_simple': [
        r'^(check|show|list|get|find|lookup|search|query)\s',
        r'^(what is|what\'s|who is|where is|when is)\s',
        r'(error|log|status|version|config)',
        r'^(run|execute|do|make|create)\s.*?(quick|fast|simple)',
    ],
    'mindmap': [
        r'(map|explore|research|investigate|analyze.*landscape)',
        r'(compare|versus|vs\.|difference|contrast|competitive)',
        r'(brainstorm|ideas|options|alternatives|possibilities)',
        r'(strategy|plan|roadmap|approach|framework)',
    ],
    'diff_editor': [
        r'(verify|validate|check|audit|review|ensure|confirm)',
        r'(compliance|regulation|guideline|policy|safety)',
        r'(contract|agreement|document|legal|terms)',
        r'(source|citation|reference|evidence|proof)',
    ],
    'dashboard': [
        r'(analytics|metrics|statistics|kpi|dashboard)',
        r'(chart|graph|visualization|report|summary)',
        r'(performance|usage|cost|spend|budget)',
    ],
}


@task
def determine_polymorphic_view(
    query: str,
    route_type: str,
    domain_hint: Optional[str] = None
) -> PolymorphicViewDecision:
    """
    PROMPT-41: Determines the optimal UI view type based on query intent.
    
    View Selection Logic:
    - Quick commands/lookups → terminal_simple (Sniper)
    - Research/exploration → mindmap (Scout)
    - Verification/compliance → diff_editor (Sage)
    - HITL escalation → decision_cards
    - Analytics queries → dashboard
    - Default conversation → chat
    """
    import re
    query_lower = query.lower()
    
    # HITL always gets decision_cards
    if route_type == 'hitl':
        return PolymorphicViewDecision(
            view_type='decision_cards',
            execution_mode='war_room',
            rationale='Human-in-the-loop escalation requires Mission Control decision interface',
            estimated_cost_cents=50,
            domain_hint=domain_hint,
        )
    
    # Compliance domains trigger diff_editor
    if domain_hint in ('medical', 'financial', 'legal'):
        return PolymorphicViewDecision(
            view_type='diff_editor',
            execution_mode='war_room',
            rationale=f'Compliance domain ({domain_hint}) requires verification view with source attribution',
            estimated_cost_cents=50,
            domain_hint=domain_hint,
        )
    
    # Check patterns for each view type
    for view_type, patterns in VIEW_TYPE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, query_lower, re.IGNORECASE):
                if view_type == 'terminal_simple':
                    return PolymorphicViewDecision(
                        view_type='terminal_simple',
                        execution_mode='sniper',
                        rationale='Quick command/lookup rendered as command center terminal',
                        estimated_cost_cents=1,
                        domain_hint=domain_hint,
                    )
                elif view_type == 'mindmap':
                    return PolymorphicViewDecision(
                        view_type='mindmap',
                        execution_mode='war_room',
                        rationale='Research/exploration query benefits from infinite canvas mind map',
                        estimated_cost_cents=50,
                        domain_hint=domain_hint,
                    )
                elif view_type == 'diff_editor':
                    return PolymorphicViewDecision(
                        view_type='diff_editor',
                        execution_mode='war_room',
                        rationale='Verification query requires split-screen diff editor',
                        estimated_cost_cents=50,
                        domain_hint=domain_hint,
                    )
                elif view_type == 'dashboard':
                    exec_mode = 'sniper' if route_type == 'sniper' else 'war_room'
                    return PolymorphicViewDecision(
                        view_type='dashboard',
                        execution_mode=exec_mode,
                        rationale='Analytics query rendered as interactive dashboard',
                        estimated_cost_cents=1 if exec_mode == 'sniper' else 50,
                        domain_hint=domain_hint,
                    )
    
    # Sniper route → terminal
    if route_type == 'sniper':
        return PolymorphicViewDecision(
            view_type='terminal_simple',
            execution_mode='sniper',
            rationale='Simple query uses fast terminal interface',
            estimated_cost_cents=1,
            domain_hint=domain_hint,
        )
    
    # Default to chat
    return PolymorphicViewDecision(
        view_type='chat',
        execution_mode='war_room',
        rationale='General query uses standard conversation interface',
        estimated_cost_cents=50,
        domain_hint=domain_hint,
    )


@task
def render_interface(
    view_decision: PolymorphicViewDecision,
    data_payload: Dict[str, Any],
    session_id: str
) -> Dict[str, Any]:
    """
    PROMPT-41: Emit render_interface event for UI morphing.
    
    This task notifies the frontend to change the UI view type.
    The actual rendering happens client-side.
    """
    render_event = {
        'type': 'render_interface',
        'session_id': session_id,
        'view_type': view_decision.view_type,
        'execution_mode': view_decision.execution_mode,
        'rationale': view_decision.rationale,
        'estimated_cost_cents': view_decision.estimated_cost_cents,
        'domain_hint': view_decision.domain_hint,
        'data_payload': data_payload,
        'timestamp': datetime.utcnow().isoformat(),
    }
    
    logger.info(f"Emitting render_interface event: {view_decision.view_type}")
    
    # In production, publish to Redis pub/sub or WebSocket
    # For now, return the event for the caller to handle
    return render_event


@task
def log_escalation(
    context: CognitiveContext,
    sniper_response_id: str,
    escalation_reason: str,
    sniper_response: Optional[str] = None,
    sniper_cost_cents: Optional[int] = None,
    additional_context: Optional[str] = None
) -> str:
    """
    PROMPT-41: Log a Sniper → War Room escalation.
    
    Records the escalation in the database for analytics.
    """
    import uuid
    
    escalation_id = str(uuid.uuid4())
    
    logger.info(f"Logging escalation {escalation_id}: {escalation_reason}")
    
    # In production, insert into execution_escalations table
    # For now, log and return the escalation ID
    escalation_record = {
        'id': escalation_id,
        'tenant_id': context.tenant_id,
        'session_id': context.session_id,
        'sniper_response_id': sniper_response_id,
        'original_query': context.query,
        'escalation_reason': escalation_reason,
        'sniper_response': sniper_response,
        'sniper_cost_cents': sniper_cost_cents,
        'additional_context': additional_context,
        'escalated_at': datetime.utcnow().isoformat(),
    }
    
    logger.info(f"Escalation record: {json.dumps(escalation_record)}")
    
    return escalation_id


def run_polymorphic_query(
    tenant_id: str,
    user_id: str,
    session_id: str,
    query: str,
    domain_hint: Optional[str] = None,
    user_tier: str = "standard",
    user_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    PROMPT-41: Convenience function to run cognitive workflow with Polymorphic UI.
    
    Returns both the execution result AND the view decision.
    """
    context = CognitiveContext(
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
        query=query,
        domain_hint=domain_hint,
        user_tier=user_tier,
    )
    
    semantic_key = _generate_semantic_key(query)
    
    # Execute cognitive tasks
    ghost_result = read_ghost_memory(context=context, semantic_key=semantic_key)
    routing = economic_governor_route(context=context, ghost_result=ghost_result)
    
    # Apply user override if provided
    if user_override in ('sniper', 'war_room'):
        routing = RoutingDecision(
            route_type=user_override,
            reason=f'User manual override to {user_override} mode',
            complexity_score=routing.complexity_score,
            retrieval_confidence=routing.retrieval_confidence,
            ghost_hit=routing.ghost_hit,
            selected_model=routing.selected_model,
            domain_hint=routing.domain_hint,
        )
    
    # Determine view type
    view_decision = determine_polymorphic_view(
        query=query,
        route_type=routing.route_type,
        domain_hint=domain_hint
    )
    
    # Execute
    if routing.route_type == 'sniper':
        result = sniper_execute(context=context, routing=routing, ghost_result=ghost_result)
    else:
        result = war_room_execute(context=context, routing=routing, ghost_result=ghost_result)
    
    # Build render event
    render_event = render_interface(
        view_decision=view_decision,
        data_payload={'response': result.response},
        session_id=session_id
    )
    
    return {
        'success': result.success,
        'response': result.response,
        'route_type': result.route_type,
        'model_used': result.model_used,
        'latency_ms': result.latency_ms,
        'cost_cents': result.cost_cents,
        'ghost_hit': routing.ghost_hit,
        'complexity_score': routing.complexity_score,
        'retrieval_confidence': routing.retrieval_confidence,
        # Polymorphic UI additions
        'view_type': view_decision.view_type,
        'execution_mode': view_decision.execution_mode,
        'view_rationale': view_decision.rationale,
        'estimated_cost_cents': view_decision.estimated_cost_cents,
        'render_event': render_event,
    }
