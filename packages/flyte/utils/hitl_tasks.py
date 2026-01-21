"""
HITL Task Utilities for Flyte Workflows

Provides Python wrappers for the MCP Elicitation HITL pattern within Flyte workflows.
These utilities integrate with RADIANT's HITL Orchestration services (VOI, batching,
rate limiting, deduplication) via the Mission Control API.

Usage:
    from radiant.flyte.utils.hitl_tasks import ask_confirmation, ask_choice, ask_batch

    @task
    def my_task():
        if ask_confirmation("Deploy to production?", domain="technical"):
            deploy()

@see PROMPT-37 HITL Orchestration Enhancements
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, TypeVar
from dataclasses import dataclass, field
from enum import Enum

import requests
from flytekit import current_context, wait_for_input

# ============================================================================
# CONFIGURATION
# ============================================================================

MISSION_CONTROL_URL = os.environ.get("MISSION_CONTROL_URL", "http://localhost:8080")
DEFAULT_TIMEOUT_SECONDS = 1800  # 30 minutes

DOMAIN_TIMEOUTS = {
    "medical": 300,
    "financial": 600,
    "legal": 900,
    "bioinformatics": 1200,
    "general": 1800,
}


# ============================================================================
# TYPES
# ============================================================================

class QuestionType(Enum):
    YES_NO = "yes_no"
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    FREE_TEXT = "free_text"
    NUMERIC = "numeric"
    DATE = "date"
    CONFIRMATION = "confirmation"
    STRUCTURED = "structured"


class Urgency(Enum):
    BLOCKING = "blocking"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


@dataclass
class VOIComponents:
    """Value-of-Information scoring components."""
    impact: float = 0.5  # 0-1: How much this affects outcome
    uncertainty: float = 0.5  # 0-1: How uncertain we are
    reversibility: float = 0.5  # 0-1: How reversible is the action


@dataclass
class QuestionOption:
    """Option for choice-based questions."""
    id: str
    label: str
    description: Optional[str] = None


@dataclass
class HITLResponse:
    """Response from a HITL question."""
    status: str  # "answered", "skipped", "expired", "cached"
    value: Any
    answered_by: Optional[str] = None
    answered_at: Optional[str] = None
    assumption_made: Optional[str] = None
    voi_score: Optional[float] = None
    from_cache: bool = False


@dataclass
class BatchQuestion:
    """A question within a batch."""
    id: str
    question: str
    question_type: QuestionType
    options: Optional[List[QuestionOption]] = None
    voi_components: Optional[VOIComponents] = None
    aspect: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _get_flyte_context() -> Dict[str, str]:
    """Extract Flyte execution context."""
    try:
        ctx = current_context()
        return {
            "execution_id": ctx.execution_id.name if ctx.execution_id else "",
            "node_id": ctx.node_id if hasattr(ctx, "node_id") else "",
        }
    except Exception:
        return {"execution_id": "", "node_id": ""}


def _compute_question_hash(question: str, options: Optional[List[QuestionOption]] = None) -> str:
    """Compute hash for deduplication."""
    data = {"question": question.lower().strip()}
    if options:
        data["options"] = [o.id for o in options]
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:16]


def _call_hitl_api(
    endpoint: str,
    payload: Dict[str, Any],
    tenant_id: str,
    timeout: int = 30,
) -> Dict[str, Any]:
    """Call HITL API endpoint."""
    response = requests.post(
        f"{MISSION_CONTROL_URL}/api/hitl/{endpoint}",
        headers={
            "Content-Type": "application/json",
            "X-Tenant-ID": tenant_id,
            "X-Internal-Call": "true",
        },
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def _check_voi_threshold(
    voi_components: VOIComponents,
    domain: str,
    tenant_id: str,
) -> Dict[str, Any]:
    """Check if question meets VOI threshold."""
    try:
        return _call_hitl_api(
            "voi/evaluate",
            {
                "impact": voi_components.impact,
                "uncertainty": voi_components.uncertainty,
                "reversibility": voi_components.reversibility,
                "domain": domain,
            },
            tenant_id,
        )
    except Exception:
        # Default to asking if VOI check fails
        return {"decision": "ask_question", "score": 0.5}


def _check_dedup_cache(
    question_hash: str,
    session_id: str,
    tenant_id: str,
) -> Optional[Dict[str, Any]]:
    """Check if question was already answered."""
    try:
        response = _call_hitl_api(
            "cache/check",
            {
                "question_hash": question_hash,
                "session_id": session_id,
            },
            tenant_id,
        )
        if response.get("cached"):
            return response.get("cached_response")
    except Exception:
        pass
    return None


def _store_in_cache(
    question_hash: str,
    session_id: str,
    response: HITLResponse,
    tenant_id: str,
    ttl_seconds: int = 3600,
) -> None:
    """Store response in deduplication cache."""
    try:
        _call_hitl_api(
            "cache/store",
            {
                "question_hash": question_hash,
                "session_id": session_id,
                "response": {
                    "status": response.status,
                    "value": response.value,
                    "answered_by": response.answered_by,
                    "answered_at": response.answered_at,
                },
                "ttl_seconds": ttl_seconds,
            },
            tenant_id,
        )
    except Exception:
        pass  # Non-blocking


# ============================================================================
# MAIN HITL FUNCTIONS
# ============================================================================

def ask_confirmation(
    question: str,
    tenant_id: str,
    session_id: str,
    *,
    domain: str = "general",
    urgency: Urgency = Urgency.NORMAL,
    voi_components: Optional[VOIComponents] = None,
    context: Optional[Dict[str, Any]] = None,
    default_on_timeout: bool = False,
    timeout_seconds: Optional[int] = None,
    agent_reasoning: Optional[str] = None,
) -> bool:
    """
    Ask the user for yes/no confirmation.
    
    This is the simplest HITL pattern - a blocking yes/no question.
    
    Args:
        question: The question to ask (will be PHI-sanitized if needed)
        tenant_id: Tenant ID for multi-tenancy
        session_id: Session ID for context
        domain: Domain for timeout/urgency defaults ("medical", "financial", etc.)
        urgency: Question urgency level
        voi_components: Value-of-Information scoring components
        context: Additional context for the human reviewer
        default_on_timeout: Value to return if question times out
        timeout_seconds: Custom timeout (uses domain default if not specified)
        agent_reasoning: Why the agent is asking this question
        
    Returns:
        bool: True if confirmed, False if denied
        
    Example:
        if ask_confirmation("Execute this trade?", tenant_id, session_id, domain="financial"):
            execute_trade()
    """
    voi = voi_components or VOIComponents(impact=0.7, uncertainty=0.5, reversibility=0.5)
    
    # Check VOI threshold
    voi_result = _check_voi_threshold(voi, domain, tenant_id)
    if voi_result.get("decision") == "skip_question":
        return True  # Assume yes for low-VOI questions
    
    # Check dedup cache
    question_hash = _compute_question_hash(question)
    cached = _check_dedup_cache(question_hash, session_id, tenant_id)
    if cached:
        return cached.get("value", default_on_timeout)
    
    # Get Flyte context
    flyte_ctx = _get_flyte_context()
    timeout = timeout_seconds or DOMAIN_TIMEOUTS.get(domain, DEFAULT_TIMEOUT_SECONDS)
    
    # Create decision in Mission Control
    try:
        decision_response = _call_hitl_api(
            "question",
            {
                "session_id": session_id,
                "question": question,
                "question_type": QuestionType.CONFIRMATION.value,
                "domain": domain,
                "urgency": urgency.value,
                "voi_components": {
                    "impact": voi.impact,
                    "uncertainty": voi.uncertainty,
                    "reversibility": voi.reversibility,
                },
                "context": context or {},
                "flyte_execution_id": flyte_ctx["execution_id"],
                "flyte_node_id": flyte_ctx["node_id"],
                "timeout_seconds": timeout,
                "agent_reasoning": agent_reasoning,
            },
            tenant_id,
        )
        
        decision_id = decision_response.get("id", "")
        
        # Wait for human input using Flyte's wait_for_input
        try:
            human_input = wait_for_input(
                name=f"confirmation_{decision_id}",
                timeout=timedelta(seconds=timeout),
                expected_type=dict,
            )
            
            result = human_input.get("confirmed", default_on_timeout)
            
            # Cache the response
            _store_in_cache(
                question_hash,
                session_id,
                HITLResponse(
                    status="answered",
                    value=result,
                    answered_by=human_input.get("answered_by"),
                    answered_at=human_input.get("answered_at"),
                ),
                tenant_id,
            )
            
            return result
            
        except TimeoutError:
            return default_on_timeout
            
    except Exception as e:
        print(f"HITL confirmation failed: {e}")
        return default_on_timeout


def ask_choice(
    question: str,
    options: List[QuestionOption],
    tenant_id: str,
    session_id: str,
    *,
    domain: str = "general",
    urgency: Urgency = Urgency.NORMAL,
    allow_multiple: bool = False,
    voi_components: Optional[VOIComponents] = None,
    context: Optional[Dict[str, Any]] = None,
    default_on_timeout: Optional[str] = None,
    timeout_seconds: Optional[int] = None,
    agent_reasoning: Optional[str] = None,
) -> Union[str, List[str], None]:
    """
    Ask the user to choose from predefined options.
    
    Args:
        question: The question to ask
        options: List of QuestionOption choices
        tenant_id: Tenant ID
        session_id: Session ID
        domain: Domain for defaults
        urgency: Question urgency
        allow_multiple: Allow selecting multiple options
        voi_components: VOI scoring
        context: Additional context
        default_on_timeout: Default selection if timed out
        timeout_seconds: Custom timeout
        agent_reasoning: Why the agent is asking
        
    Returns:
        str or List[str]: Selected option ID(s), or None if timed out with no default
        
    Example:
        choice = ask_choice(
            "Which model should I use?",
            [
                QuestionOption("gpt4", "GPT-4", "Best quality"),
                QuestionOption("gpt35", "GPT-3.5", "Faster"),
            ],
            tenant_id, session_id
        )
    """
    voi = voi_components or VOIComponents(impact=0.6, uncertainty=0.6, reversibility=0.7)
    
    # Check VOI threshold
    voi_result = _check_voi_threshold(voi, domain, tenant_id)
    if voi_result.get("decision") == "skip_question" and default_on_timeout:
        return default_on_timeout
    
    # Check dedup cache
    question_hash = _compute_question_hash(question, options)
    cached = _check_dedup_cache(question_hash, session_id, tenant_id)
    if cached:
        return cached.get("value", default_on_timeout)
    
    flyte_ctx = _get_flyte_context()
    timeout = timeout_seconds or DOMAIN_TIMEOUTS.get(domain, DEFAULT_TIMEOUT_SECONDS)
    question_type = QuestionType.MULTIPLE_CHOICE if allow_multiple else QuestionType.SINGLE_CHOICE
    
    try:
        decision_response = _call_hitl_api(
            "question",
            {
                "session_id": session_id,
                "question": question,
                "question_type": question_type.value,
                "options": [{"id": o.id, "label": o.label, "description": o.description} for o in options],
                "domain": domain,
                "urgency": urgency.value,
                "voi_components": {
                    "impact": voi.impact,
                    "uncertainty": voi.uncertainty,
                    "reversibility": voi.reversibility,
                },
                "context": context or {},
                "flyte_execution_id": flyte_ctx["execution_id"],
                "flyte_node_id": flyte_ctx["node_id"],
                "timeout_seconds": timeout,
                "agent_reasoning": agent_reasoning,
            },
            tenant_id,
        )
        
        decision_id = decision_response.get("id", "")
        
        try:
            human_input = wait_for_input(
                name=f"choice_{decision_id}",
                timeout=timedelta(seconds=timeout),
                expected_type=dict,
            )
            
            result = human_input.get("selection", default_on_timeout)
            
            _store_in_cache(
                question_hash,
                session_id,
                HITLResponse(
                    status="answered",
                    value=result,
                    answered_by=human_input.get("answered_by"),
                    answered_at=human_input.get("answered_at"),
                ),
                tenant_id,
            )
            
            return result
            
        except TimeoutError:
            return default_on_timeout
            
    except Exception as e:
        print(f"HITL choice failed: {e}")
        return default_on_timeout


def ask_batch(
    questions: List[BatchQuestion],
    tenant_id: str,
    session_id: str,
    *,
    domain: str = "general",
    urgency: Urgency = Urgency.NORMAL,
    batch_strategy: str = "correlation",  # "time_window", "correlation", "semantic"
    context: Optional[Dict[str, Any]] = None,
    timeout_seconds: Optional[int] = None,
) -> Dict[str, HITLResponse]:
    """
    Ask multiple related questions in a single batch.
    
    This is more efficient than asking questions one-by-one and provides
    better UX by presenting related questions together.
    
    Args:
        questions: List of BatchQuestion objects
        tenant_id: Tenant ID
        session_id: Session ID
        domain: Domain for defaults
        urgency: Batch urgency
        batch_strategy: How questions are grouped ("time_window", "correlation", "semantic")
        context: Shared context for all questions
        timeout_seconds: Custom timeout for entire batch
        
    Returns:
        Dict mapping question ID to HITLResponse
        
    Example:
        responses = ask_batch([
            BatchQuestion("q1", "Patient age?", QuestionType.NUMERIC),
            BatchQuestion("q2", "Has allergies?", QuestionType.YES_NO),
        ], tenant_id, session_id, domain="medical")
        
        age = responses["q1"].value
        has_allergies = responses["q2"].value
    """
    flyte_ctx = _get_flyte_context()
    timeout = timeout_seconds or DOMAIN_TIMEOUTS.get(domain, DEFAULT_TIMEOUT_SECONDS)
    
    # Filter questions by VOI
    filtered_questions = []
    skipped_responses: Dict[str, HITLResponse] = {}
    
    for q in questions:
        voi = q.voi_components or VOIComponents()
        voi_result = _check_voi_threshold(voi, domain, tenant_id)
        
        if voi_result.get("decision") == "skip_question":
            # Generate assumption for skipped question
            assumption = f"Proceeding with default for: {q.aspect or q.id}"
            skipped_responses[q.id] = HITLResponse(
                status="skipped",
                value=None,
                assumption_made=assumption,
                voi_score=voi_result.get("score", 0),
            )
        else:
            filtered_questions.append(q)
    
    # Check cache for each question
    questions_to_ask = []
    for q in filtered_questions:
        question_hash = _compute_question_hash(q.question)
        cached = _check_dedup_cache(question_hash, session_id, tenant_id)
        if cached:
            skipped_responses[q.id] = HITLResponse(
                status="cached",
                value=cached.get("value"),
                answered_by=cached.get("answered_by"),
                from_cache=True,
            )
        else:
            questions_to_ask.append(q)
    
    if not questions_to_ask:
        return skipped_responses
    
    # Create batch in Mission Control
    try:
        batch_response = _call_hitl_api(
            "batch",
            {
                "session_id": session_id,
                "questions": [
                    {
                        "id": q.id,
                        "question": q.question,
                        "question_type": q.question_type.value,
                        "options": [{"id": o.id, "label": o.label} for o in (q.options or [])],
                        "voi_components": {
                            "impact": (q.voi_components or VOIComponents()).impact,
                            "uncertainty": (q.voi_components or VOIComponents()).uncertainty,
                            "reversibility": (q.voi_components or VOIComponents()).reversibility,
                        },
                        "aspect": q.aspect,
                    }
                    for q in questions_to_ask
                ],
                "domain": domain,
                "urgency": urgency.value,
                "batch_strategy": batch_strategy,
                "context": context or {},
                "flyte_execution_id": flyte_ctx["execution_id"],
                "flyte_node_id": flyte_ctx["node_id"],
                "timeout_seconds": timeout,
            },
            tenant_id,
        )
        
        batch_id = batch_response.get("batch_id", "")
        
        try:
            human_input = wait_for_input(
                name=f"batch_{batch_id}",
                timeout=timedelta(seconds=timeout),
                expected_type=dict,
            )
            
            # Parse batch responses
            answers = human_input.get("answers", {})
            for q in questions_to_ask:
                if q.id in answers:
                    answer = answers[q.id]
                    response = HITLResponse(
                        status="answered",
                        value=answer.get("value"),
                        answered_by=human_input.get("answered_by"),
                        answered_at=human_input.get("answered_at"),
                    )
                    skipped_responses[q.id] = response
                    
                    # Cache individual responses
                    question_hash = _compute_question_hash(q.question)
                    _store_in_cache(question_hash, session_id, response, tenant_id)
                else:
                    skipped_responses[q.id] = HITLResponse(
                        status="skipped",
                        value=None,
                        assumption_made=f"Not answered in batch for: {q.aspect or q.id}",
                    )
            
            return skipped_responses
            
        except TimeoutError:
            # All unanswered questions get expired status
            for q in questions_to_ask:
                if q.id not in skipped_responses:
                    skipped_responses[q.id] = HITLResponse(
                        status="expired",
                        value=None,
                        assumption_made=f"Timed out waiting for: {q.aspect or q.id}",
                    )
            return skipped_responses
            
    except Exception as e:
        print(f"HITL batch failed: {e}")
        # Return all as skipped with error
        for q in questions_to_ask:
            if q.id not in skipped_responses:
                skipped_responses[q.id] = HITLResponse(
                    status="skipped",
                    value=None,
                    assumption_made=f"API error: {str(e)[:100]}",
                )
        return skipped_responses


def ask_free_text(
    question: str,
    tenant_id: str,
    session_id: str,
    *,
    domain: str = "general",
    urgency: Urgency = Urgency.NORMAL,
    placeholder: Optional[str] = None,
    max_length: Optional[int] = None,
    voi_components: Optional[VOIComponents] = None,
    context: Optional[Dict[str, Any]] = None,
    default_on_timeout: Optional[str] = None,
    timeout_seconds: Optional[int] = None,
    agent_reasoning: Optional[str] = None,
) -> Optional[str]:
    """
    Ask the user for free-form text input.
    
    Args:
        question: The question to ask
        tenant_id: Tenant ID
        session_id: Session ID
        domain: Domain for defaults
        urgency: Question urgency
        placeholder: Placeholder text for input field
        max_length: Maximum response length
        voi_components: VOI scoring
        context: Additional context
        default_on_timeout: Default text if timed out
        timeout_seconds: Custom timeout
        agent_reasoning: Why the agent is asking
        
    Returns:
        str: User's text response, or default/None if timed out
    """
    voi = voi_components or VOIComponents(impact=0.5, uncertainty=0.7, reversibility=0.8)
    
    # Check VOI threshold
    voi_result = _check_voi_threshold(voi, domain, tenant_id)
    if voi_result.get("decision") == "skip_question" and default_on_timeout:
        return default_on_timeout
    
    flyte_ctx = _get_flyte_context()
    timeout = timeout_seconds or DOMAIN_TIMEOUTS.get(domain, DEFAULT_TIMEOUT_SECONDS)
    
    try:
        decision_response = _call_hitl_api(
            "question",
            {
                "session_id": session_id,
                "question": question,
                "question_type": QuestionType.FREE_TEXT.value,
                "domain": domain,
                "urgency": urgency.value,
                "voi_components": {
                    "impact": voi.impact,
                    "uncertainty": voi.uncertainty,
                    "reversibility": voi.reversibility,
                },
                "validation": {
                    "max_length": max_length,
                },
                "placeholder": placeholder,
                "context": context or {},
                "flyte_execution_id": flyte_ctx["execution_id"],
                "flyte_node_id": flyte_ctx["node_id"],
                "timeout_seconds": timeout,
                "agent_reasoning": agent_reasoning,
            },
            tenant_id,
        )
        
        decision_id = decision_response.get("id", "")
        
        try:
            human_input = wait_for_input(
                name=f"text_{decision_id}",
                timeout=timedelta(seconds=timeout),
                expected_type=dict,
            )
            
            return human_input.get("text", default_on_timeout)
            
        except TimeoutError:
            return default_on_timeout
            
    except Exception as e:
        print(f"HITL free text failed: {e}")
        return default_on_timeout
