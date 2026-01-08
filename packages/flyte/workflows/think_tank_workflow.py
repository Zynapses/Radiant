"""
Think Tank HITL Workflow - Flyte workflow for Human-in-the-Loop AI reasoning

RADIANT v5.0.2 - System Evolution

This workflow implements:
- True swarm parallelism with per-agent execution
- Non-blocking HITL via wait_for_input
- Domain-aware timeout handling
- PHI sanitization before human review
- Integration with Mission Control API
- The Grimoire integration (procedural memory)
- Economic Governor integration (cost optimization)
"""

import json
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import boto3
import requests
from flytekit import task, workflow, dynamic, wait_for_input, approve, current_context
from flytekit.types.file import FlyteFile
from dataclasses import dataclass

# v5.0.2 - The Grimoire Integration
from radiant.flyte.workflows.grimoire_tasks import consult_grimoire, librarian_review


# ============================================================================
# CONFIGURATION
# ============================================================================

LITELLM_PROXY_URL = os.environ.get("LITELLM_PROXY_URL", "http://localhost:4000")
LITELLM_API_KEY = os.environ.get("LITELLM_API_KEY", "")
MISSION_CONTROL_URL = os.environ.get("MISSION_CONTROL_URL", "http://localhost:8080")
S3_BUCKET = os.environ.get("RADIANT_DATA_BUCKET", "radiant-data")

# Domain-specific timeouts (seconds)
DOMAIN_TIMEOUTS = {
    "medical": 300,      # 5 minutes
    "financial": 600,    # 10 minutes
    "legal": 900,        # 15 minutes
    "general": 1800,     # 30 minutes
}


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class AgentConfig:
    agent_id: str
    role: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 2048
    tools: Optional[List[str]] = None


@dataclass
class SwarmTask:
    type: str
    prompt: str
    context: Dict[str, Any]
    system_prompt: Optional[str] = None


@dataclass
class AgentResult:
    agent_id: str
    status: str  # 'success', 'failed', 'timeout', 'rejected'
    response: Optional[str] = None
    error: Optional[str] = None
    latency_ms: int = 0
    tokens_used: int = 0
    safety_passed: bool = True


@dataclass
class HumanDecision:
    resolution: str  # 'approved', 'rejected', 'modified'
    guidance: str
    resolved_by: str
    resolved_at: str


@dataclass
class WorkflowResult:
    swarm_id: str
    status: str
    agent_results: List[Dict[str, Any]]
    synthesis: Optional[str] = None
    human_decision: Optional[Dict[str, Any]] = None
    final_response: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def load_input_from_s3(s3_uri: str) -> Dict[str, Any]:
    """Load swarm input data from S3."""
    s3_client = boto3.client("s3")
    
    # Parse S3 URI: s3://bucket/key
    parts = s3_uri.replace("s3://", "").split("/", 1)
    bucket = parts[0]
    key = parts[1] if len(parts) > 1 else ""
    
    response = s3_client.get_object(Bucket=bucket, Key=key)
    content = response["Body"].read().decode("utf-8")
    return json.loads(content)


def sanitize_phi(content: str) -> str:
    """Remove PHI/PII from content before human review."""
    patterns = [
        (r"\b\d{3}-\d{2}-\d{4}\b", "[SSN REDACTED]"),
        (r"\b\d{9}\b", "[SSN REDACTED]"),
        (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[EMAIL REDACTED]"),
        (r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", "[PHONE REDACTED]"),
        (r"\b\d{5}(-\d{4})?\b", "[ZIP REDACTED]"),
        (r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b", "[CC REDACTED]"),
        (r"\b(MRN|Patient ID|Medical Record)[:\s]*\w+\b", "[MRN REDACTED]"),
    ]
    
    sanitized = content
    for pattern, replacement in patterns:
        sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
    
    return sanitized


def call_litellm(
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    tenant_id: str = ""
) -> Dict[str, Any]:
    """Call LiteLLM proxy for model inference."""
    response = requests.post(
        f"{LITELLM_PROXY_URL}/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LITELLM_API_KEY}",
            "X-Tenant-ID": tenant_id,
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=120,
    )
    response.raise_for_status()
    return response.json()


def create_pending_decision(
    tenant_id: str,
    session_id: str,
    question: str,
    context: Dict[str, Any],
    domain: str,
    flyte_execution_id: str,
    node_id: str,
) -> str:
    """Create a pending decision in Mission Control."""
    timeout_seconds = DOMAIN_TIMEOUTS.get(domain, 1800)
    expires_at = (datetime.utcnow() + timedelta(seconds=timeout_seconds)).isoformat()
    
    response = requests.post(
        f"{MISSION_CONTROL_URL}/api/mission-control/decisions",
        headers={
            "Content-Type": "application/json",
            "X-Tenant-ID": tenant_id,
            "X-Internal-Call": "true",
        },
        json={
            "tenant_id": tenant_id,
            "session_id": session_id,
            "question": sanitize_phi(question),
            "context": {k: sanitize_phi(str(v)) if isinstance(v, str) else v for k, v in context.items()},
            "domain": domain,
            "urgency": "critical" if domain == "medical" else "high",
            "timeout_seconds": timeout_seconds,
            "expires_at": expires_at,
            "flyte_execution_id": flyte_execution_id,
            "flyte_node_id": node_id,
        },
        timeout=30,
    )
    response.raise_for_status()
    result = response.json()
    return result["id"]


# ============================================================================
# FLYTE TASKS
# ============================================================================

@task(cache=False)
def execute_agent(
    agent_config: Dict[str, Any],
    task_data: Dict[str, Any],
    tenant_id: str,
    coordinator_guidance: Optional[str] = None,
    domain: str = "general",
    swarm_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute a single agent and return its result.
    
    v5.0.2 Enhancement: Integrates with The Grimoire for procedural memory
    - Consults Grimoire for relevant heuristics before execution
    - Invokes Librarian to extract lessons after successful execution
    """
    import time
    start_time = time.time()
    
    agent_id = agent_config.get("agent_id", "unknown")
    model = agent_config.get("model", "gpt-3.5-turbo")
    temperature = agent_config.get("temperature", 0.7)
    max_tokens = agent_config.get("max_tokens", 2048)
    
    prompt = task_data.get("prompt", "")
    system_prompt = task_data.get("system_prompt", "")
    
    # v5.0.2: Consult The Grimoire for relevant heuristics
    try:
        grimoire_wisdom = consult_grimoire(
            tenant_id=tenant_id,
            domain=domain,
            prompt=prompt
        )
        if grimoire_wisdom:
            system_prompt = f"{system_prompt}\n{grimoire_wisdom}" if system_prompt else grimoire_wisdom
    except Exception as e:
        print(f"Grimoire consultation failed (non-blocking): {e}")
        grimoire_wisdom = ""
    
    if coordinator_guidance:
        prompt = f"{prompt}\n\nCoordinator guidance: {coordinator_guidance}"
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    try:
        response = call_litellm(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            tenant_id=tenant_id,
        )
        
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        tokens_used = response.get("usage", {}).get("total_tokens", 0)
        latency_ms = int((time.time() - start_time) * 1000)
        
        # v5.0.2: Librarian Review - Extract lessons from successful execution
        try:
            librarian_review(
                tenant_id=tenant_id,
                domain=domain,
                original_prompt=task_data.get("prompt", ""),
                final_response=content,
                execution_id=swarm_id
            )
        except Exception as e:
            print(f"Librarian review failed (non-blocking): {e}")
        
        return {
            "agent_id": agent_id,
            "status": "success",
            "response": content,
            "latency_ms": latency_ms,
            "tokens_used": tokens_used,
            "safety_passed": True,
            "grimoire_applied": bool(grimoire_wisdom),
        }
        
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "agent_id": agent_id,
            "status": "failed",
            "error": str(e),
            "latency_ms": latency_ms,
            "safety_passed": False,
            "grimoire_applied": bool(grimoire_wisdom),
        }


@task
def synthesize_results(
    agent_results: List[Dict[str, Any]],
    task_data: Dict[str, Any],
    tenant_id: str,
) -> Dict[str, Any]:
    """Synthesize results from multiple agents."""
    successful_results = [r for r in agent_results if r.get("status") == "success"]
    
    if not successful_results:
        return {
            "synthesis": "",
            "confidence": 0.0,
            "requires_human_review": True,
            "review_reason": "No successful agent responses",
        }
    
    if len(successful_results) == 1:
        return {
            "synthesis": successful_results[0].get("response", ""),
            "confidence": 0.7,
            "requires_human_review": False,
        }
    
    synthesis_prompt = f"""You are a synthesis expert. Combine the following expert responses into a single coherent answer.

Original question: {task_data.get('prompt', '')}

Expert responses:
{chr(10).join([f"Expert {i+1}: {r.get('response', '')}" for i, r in enumerate(successful_results)])}

Provide a synthesized answer that incorporates the best insights from all experts."""

    try:
        response = call_litellm(
            model="gpt-4-turbo-preview",
            messages=[{"role": "user", "content": synthesis_prompt}],
            temperature=0.3,
            max_tokens=4096,
            tenant_id=tenant_id,
        )
        
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        return {
            "synthesis": content,
            "confidence": 0.8,
            "requires_human_review": False,
        }
        
    except Exception as e:
        return {
            "synthesis": successful_results[0].get("response", ""),
            "confidence": 0.5,
            "requires_human_review": True,
            "review_reason": f"Synthesis failed: {str(e)}",
        }


@task
def perform_deep_reasoning(
    synthesis: str,
    human_decision: Dict[str, Any],
    task_data: Dict[str, Any],
    tenant_id: str,
) -> str:
    """Perform deep reasoning incorporating human guidance."""
    resolution = human_decision.get("resolution", "approved")
    guidance = human_decision.get("guidance", "")
    
    if resolution == "rejected":
        return f"The AI response was rejected by human review. Guidance: {guidance}"
    
    if not guidance:
        return synthesis
    
    refinement_prompt = f"""You previously provided this analysis:

{synthesis}

A human expert has reviewed this and provided the following guidance:
{guidance}

Please refine your response incorporating this expert guidance. Maintain accuracy while addressing their feedback."""

    try:
        response = call_litellm(
            model="gpt-4-turbo-preview",
            messages=[{"role": "user", "content": refinement_prompt}],
            temperature=0.3,
            max_tokens=4096,
            tenant_id=tenant_id,
        )
        
        return response.get("choices", [{}])[0].get("message", {}).get("content", synthesis)
        
    except Exception:
        return f"{synthesis}\n\n[Human guidance incorporated: {guidance}]"


# ============================================================================
# DYNAMIC TASK FOR SWARM EXECUTION
# ============================================================================

@dynamic(cache=False)
def execute_swarm(
    agents: List[Dict[str, Any]],
    task_data: Dict[str, Any],
    tenant_id: str,
    mode: str = "parallel",
    domain: str = "general",
    swarm_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Execute all agents in the swarm using true parallel execution.
    
    v5.0.2 Enhancement: Passes domain and swarm_id for Grimoire integration
    """
    results = []
    
    if mode == "sequential":
        previous_response = None
        for agent in agents:
            result = execute_agent(
                agent_config=agent,
                task_data=task_data,
                tenant_id=tenant_id,
                coordinator_guidance=previous_response,
                domain=domain,
                swarm_id=swarm_id,
            )
            results.append(result)
            if result.get("status") == "success":
                previous_response = result.get("response")
            else:
                break
                
    elif mode == "hierarchical" and len(agents) >= 2:
        coordinator = agents[0]
        workers = agents[1:]
        
        coord_result = execute_agent(
            agent_config=coordinator,
            task_data=task_data,
            tenant_id=tenant_id,
            domain=domain,
            swarm_id=swarm_id,
        )
        results.append(coord_result)
        
        if coord_result.get("status") == "success":
            coordinator_guidance = coord_result.get("response")
            for worker in workers:
                worker_result = execute_agent(
                    agent_config=worker,
                    task_data=task_data,
                    tenant_id=tenant_id,
                    coordinator_guidance=coordinator_guidance,
                    domain=domain,
                    swarm_id=swarm_id,
                )
                results.append(worker_result)
    else:
        for agent in agents:
            result = execute_agent(
                agent_config=agent,
                task_data=task_data,
                tenant_id=tenant_id,
                domain=domain,
                swarm_id=swarm_id,
            )
            results.append(result)
    
    return results


# ============================================================================
# MAIN HITL WORKFLOW
# ============================================================================

@workflow
def think_tank_hitl_workflow(
    s3_uri: str,
    swarm_id: str,
    tenant_id: str,
    session_id: str,
    user_id: str,
    hitl_domain: str,
) -> Dict[str, Any]:
    """
    Main Think Tank workflow with Human-in-the-Loop capability.
    
    Flow:
    1. Load input from S3
    2. Execute agent swarm
    3. Synthesize results
    4. If synthesis requires review, pause for human input
    5. Perform deep reasoning with human guidance
    6. Return final result
    """
    input_data = load_input_from_s3_task(s3_uri=s3_uri)
    
    task_data = extract_task_data(input_data=input_data)
    agents = extract_agents(input_data=input_data)
    mode = extract_mode(input_data=input_data)
    
    agent_results = execute_swarm(
        agents=agents,
        task_data=task_data,
        tenant_id=tenant_id,
        mode=mode,
        domain=hitl_domain,
        swarm_id=swarm_id,
    )
    
    synthesis_result = synthesize_results(
        agent_results=agent_results,
        task_data=task_data,
        tenant_id=tenant_id,
    )
    
    decision_id = create_decision_if_needed(
        synthesis_result=synthesis_result,
        tenant_id=tenant_id,
        session_id=session_id,
        task_data=task_data,
        domain=hitl_domain,
        swarm_id=swarm_id,
    )
    
    human_decision = wait_for_human_if_needed(
        synthesis_result=synthesis_result,
        decision_id=decision_id,
        domain=hitl_domain,
    )
    
    final_response = perform_deep_reasoning(
        synthesis=extract_synthesis(synthesis_result),
        human_decision=human_decision,
        task_data=task_data,
        tenant_id=tenant_id,
    )
    
    return build_workflow_result(
        swarm_id=swarm_id,
        agent_results=agent_results,
        synthesis_result=synthesis_result,
        human_decision=human_decision,
        final_response=final_response,
    )


# ============================================================================
# HELPER TASKS
# ============================================================================

@task
def load_input_from_s3_task(s3_uri: str) -> Dict[str, Any]:
    """Task wrapper for loading input from S3."""
    return load_input_from_s3(s3_uri)


@task
def extract_task_data(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract task data from input."""
    return input_data.get("task", {})


@task
def extract_agents(input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract agent configurations from input."""
    return input_data.get("agents", [])


@task
def extract_mode(input_data: Dict[str, Any]) -> str:
    """Extract execution mode from input."""
    options = input_data.get("options", {})
    return options.get("mode", "parallel")


@task
def extract_synthesis(synthesis_result: Dict[str, Any]) -> str:
    """Extract synthesis text from result."""
    return synthesis_result.get("synthesis", "")


@task
def create_decision_if_needed(
    synthesis_result: Dict[str, Any],
    tenant_id: str,
    session_id: str,
    task_data: Dict[str, Any],
    domain: str,
    swarm_id: str,
) -> str:
    """Create a pending decision if human review is required."""
    if not synthesis_result.get("requires_human_review", False):
        return ""
    
    ctx = current_context()
    execution_id = ctx.execution_id.name if ctx.execution_id else swarm_id
    node_id = f"agent_{swarm_id[:8]}"
    
    question = f"""AI Synthesis Review Required

Domain: {domain.upper()}
Reason: {synthesis_result.get('review_reason', 'Confidence below threshold')}

Original Question:
{task_data.get('prompt', 'N/A')}

AI Synthesis:
{synthesis_result.get('synthesis', 'N/A')}

Please review and provide guidance."""

    context = {
        "swarm_id": swarm_id,
        "confidence": synthesis_result.get("confidence", 0),
        "agent_count": len(synthesis_result.get("sources", [])),
    }
    
    try:
        decision_id = create_pending_decision(
            tenant_id=tenant_id,
            session_id=session_id,
            question=question,
            context=context,
            domain=domain,
            flyte_execution_id=execution_id,
            node_id=node_id,
        )
        return decision_id
    except Exception as e:
        print(f"Failed to create pending decision: {e}")
        return ""


@task
def wait_for_human_if_needed(
    synthesis_result: Dict[str, Any],
    decision_id: str,
    domain: str,
) -> Dict[str, Any]:
    """Wait for human input if review is required."""
    if not synthesis_result.get("requires_human_review", False) or not decision_id:
        return {
            "resolution": "auto_approved",
            "guidance": "",
            "resolved_by": "system",
            "resolved_at": datetime.utcnow().isoformat(),
        }
    
    timeout_seconds = DOMAIN_TIMEOUTS.get(domain, 1800)
    signal_name = f"human_decision_{decision_id}"
    
    try:
        human_input = wait_for_input(
            name=signal_name,
            timeout=timedelta(seconds=timeout_seconds),
            expected_type=dict,
        )
        
        return {
            "resolution": human_input.get("resolution", "approved"),
            "guidance": human_input.get("guidance", ""),
            "resolved_by": human_input.get("resolved_by", "unknown"),
            "resolved_at": human_input.get("resolved_at", datetime.utcnow().isoformat()),
        }
        
    except TimeoutError:
        return {
            "resolution": "timed_out",
            "guidance": "",
            "resolved_by": "system",
            "resolved_at": datetime.utcnow().isoformat(),
        }


@task
def build_workflow_result(
    swarm_id: str,
    agent_results: List[Dict[str, Any]],
    synthesis_result: Dict[str, Any],
    human_decision: Dict[str, Any],
    final_response: str,
) -> Dict[str, Any]:
    """Build the final workflow result."""
    success_count = sum(1 for r in agent_results if r.get("status") == "success")
    
    if human_decision.get("resolution") == "rejected":
        status = "rejected"
    elif human_decision.get("resolution") == "timed_out":
        status = "timed_out"
    elif success_count == 0:
        status = "failed"
    elif success_count < len(agent_results):
        status = "partial"
    else:
        status = "completed"
    
    return {
        "swarm_id": swarm_id,
        "status": status,
        "agent_results": agent_results,
        "synthesis": synthesis_result.get("synthesis"),
        "human_decision": human_decision,
        "final_response": final_response,
    }


# ============================================================================
# STANDALONE WORKFLOW (NO HITL)
# ============================================================================

@workflow
def think_tank_workflow(
    s3_uri: str,
    swarm_id: str,
    tenant_id: str,
    session_id: str,
    user_id: str,
) -> Dict[str, Any]:
    """
    Simple Think Tank workflow without HITL.
    Used for non-critical tasks that don't require human review.
    """
    input_data = load_input_from_s3_task(s3_uri=s3_uri)
    
    task_data = extract_task_data(input_data=input_data)
    agents = extract_agents(input_data=input_data)
    mode = extract_mode(input_data=input_data)
    
    agent_results = execute_swarm(
        agents=agents,
        task_data=task_data,
        tenant_id=tenant_id,
        mode=mode,
    )
    
    synthesis_result = synthesize_results(
        agent_results=agent_results,
        task_data=task_data,
        tenant_id=tenant_id,
    )
    
    return {
        "swarm_id": swarm_id,
        "status": "completed",
        "agent_results": agent_results,
        "synthesis": synthesis_result.get("synthesis"),
        "final_response": synthesis_result.get("synthesis"),
    }
