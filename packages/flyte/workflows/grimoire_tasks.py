"""
The Grimoire - Self-Optimizing Procedural Memory

RADIANT v5.0.2 - System Evolution

This module implements the three core operations for RADIANT's
institutional memory system:

1. consult_grimoire - Read relevant heuristics before execution
2. librarian_review - Extract and store lessons after execution  
3. cleanup_expired_heuristics - Maintenance task for stale data

All operations are RLS-compliant and Cato-validated.
"""

import os
import httpx
from datetime import timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    from flytekit import task, dynamic
    HAS_FLYTEKIT = True
except ImportError:
    HAS_FLYTEKIT = False
    # Provide fallback decorators for testing
    def task(**kwargs):
        def decorator(func):
            return func
        return decorator
    
    def dynamic(**kwargs):
        def decorator(func):
            return func
        return decorator

try:
    from radiant.flyte.utils.db import get_safe_db_connection, get_system_db_connection
    from radiant.flyte.utils.embeddings import generate_embedding
    from radiant.flyte.utils.cato_client import CatoClient
except ImportError:
    # Fallback to relative imports for local development
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from utils.db import get_safe_db_connection, get_system_db_connection
    from utils.embeddings import generate_embedding
    from utils.cato_client import CatoClient


# Configuration
SIMILARITY_THRESHOLD = 0.25  # Only highly relevant heuristics (lower = more similar)
MAX_HEURISTICS_RETURNED = 5
HEURISTIC_MIN_LENGTH = 20
HEURISTIC_MAX_LENGTH = 250
INITIAL_CONFIDENCE = 0.7
CONFIDENCE_INCREMENT = 0.1
MAX_CONFIDENCE = 1.0
MIN_CONFIDENCE_FOR_CLEANUP = 0.3
STALE_DAYS = 30


@dataclass
class GrimoireResult:
    """Result from Grimoire consultation"""
    heuristics: List[str]
    count: int
    domain: str
    formatted_context: str


# ============================================================================
# TASK 1: CONSULT GRIMOIRE (Read Operation)
# ============================================================================

@task(
    cache=True, 
    cache_version="v5.0.2-grimoire",
    timeout=timedelta(seconds=30),
    retries=2
)
def consult_grimoire(tenant_id: str, domain: str, prompt: str) -> str:
    """
    Queries The Grimoire for heuristics relevant to the current task.
    
    This is the "Read" operation - retrieves institutional wisdom that can
    help the AI agent perform better on similar tasks.
    
    Args:
        tenant_id: UUID of the tenant
        domain: The domain context (medical, financial, legal, general)
        prompt: The task prompt to find relevant heuristics for
        
    Returns:
        Formatted string of validated heuristics to inject into system prompt,
        or empty string if none found.
        
    Security:
        - All heuristics are validated through Cato before return
        - RLS ensures tenant isolation
        - Only heuristics with distance < 0.25 (high similarity) are returned
    """
    # 1. Generate embedding for semantic search
    try:
        embedding = generate_embedding(prompt)
    except Exception as e:
        print(f"Grimoire: Failed to generate embedding: {e}")
        return ""
    
    # 2. Query the knowledge base
    try:
        with get_safe_db_connection(tenant_id) as (conn, cur):
            # Convert to numpy array if available for pgvector
            if HAS_NUMPY:
                embedding_array = np.array(embedding)
            else:
                embedding_array = embedding
            
            # Cosine similarity search using pgvector's <=> operator
            # Lower distance = higher similarity (0 = identical)
            cur.execute("""
                SELECT 
                    heuristic_text, 
                    (context_embedding <=> %s) as distance,
                    confidence_score,
                    created_at
                FROM knowledge_heuristics
                WHERE domain = %s
                  AND expires_at > NOW()
                  AND confidence_score >= 0.3
                ORDER BY context_embedding <=> %s ASC
                LIMIT %s
            """, (embedding_array, domain, embedding_array, MAX_HEURISTICS_RETURNED))
            
            rows = cur.fetchall()
    except Exception as e:
        print(f"Grimoire: Database query failed: {e}")
        return ""
    
    if not rows:
        return ""
    
    # 3. Filter by similarity threshold and validate with Cato
    safe_heuristics: List[str] = []
    
    for row in rows:
        heuristic_text = row[0]
        distance = row[1]
        confidence = row[2]
        
        # Skip low-similarity matches
        if distance > SIMILARITY_THRESHOLD:
            continue
        
        # SECURITY: Validate through Cato to prevent prompt injection via memory
        risk = CatoClient.epistemic_check(heuristic_text, tenant_id)
        
        if risk.is_safe:
            safe_heuristics.append(heuristic_text)
        else:
            print(f"Grimoire: Blocked unsafe heuristic (risk={risk.risk_level}): {heuristic_text[:50]}...")
    
    if not safe_heuristics:
        return ""
    
    # 4. Format for injection into system prompt
    return "\n\n[INSTITUTIONAL WISDOM - APPLICABLE HEURISTICS]:\n" + \
           "\n".join(f"• {h}" for h in safe_heuristics)


def consult_grimoire_detailed(tenant_id: str, domain: str, prompt: str) -> GrimoireResult:
    """
    Detailed version of consult_grimoire that returns structured data.
    
    Use this when you need access to individual heuristics or metadata.
    """
    context = consult_grimoire(tenant_id, domain, prompt)
    
    # Parse heuristics from formatted string
    heuristics = []
    if context:
        lines = context.split("\n")
        for line in lines:
            if line.startswith("• "):
                heuristics.append(line[2:])
    
    return GrimoireResult(
        heuristics=heuristics,
        count=len(heuristics),
        domain=domain,
        formatted_context=context
    )


# ============================================================================
# TASK 2: LIBRARIAN REVIEW (Write Operation)
# ============================================================================

@task(
    timeout=timedelta(seconds=60),
    retries=1
)
def librarian_review(
    tenant_id: str, 
    domain: str,
    original_prompt: str, 
    final_response: str,
    execution_id: Optional[str] = None
) -> bool:
    """
    The Librarian - Extracts lessons from successful executions.
    
    This is the "Write" operation - analyzes completed tasks and extracts
    reusable heuristics that can help future executions.
    
    Args:
        tenant_id: UUID of the tenant
        domain: The domain context
        original_prompt: The task that was executed
        final_response: The successful AI response
        execution_id: Optional ID to track source of heuristic
        
    Returns:
        True if a heuristic was extracted and stored, False otherwise
        
    Security:
        - Uses FAIL-CLOSED validation (blocks unless explicitly safe)
        - All heuristics validated through Cato before storage
        - Deduplication via ON CONFLICT prevents spam
    """
    # 1. Build extraction prompt
    extraction_prompt = f"""Analyze this successful AI interaction and extract ONE generic, reusable heuristic.

TASK GIVEN:
{original_prompt[:1000]}

SUCCESSFUL RESPONSE:
{final_response[:1000]}

RULES:
- Extract ONLY if there's a genuinely reusable pattern
- Format: "When [specific condition], always [specific action]"
- Maximum 200 characters
- Must be domain-appropriate ({domain})
- NO sensitive data (names, numbers, PII)
- If nothing useful found, respond with exactly: NO_INSIGHT

HEURISTIC:"""
    
    # 2. Call LiteLLM to extract heuristic
    litellm_url = os.environ.get('LITELLM_PROXY_URL', 'http://litellm.radiant.internal')
    litellm_key = os.environ.get('LITELLM_API_KEY', '')
    
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                f"{litellm_url}/chat/completions",
                headers={"Authorization": f"Bearer {litellm_key}"},
                json={
                    "model": "gpt-4o",
                    "max_tokens": 100,
                    "temperature": 0.3,
                    "messages": [{"role": "user", "content": extraction_prompt}]
                }
            )
            resp.raise_for_status()
            heuristic = resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Librarian: Extraction failed: {e}")
        return False
    
    # 3. Validate extraction result
    if "NO_INSIGHT" in heuristic:
        print("Librarian: No useful heuristic extracted (NO_INSIGHT)")
        return False
    
    if len(heuristic) < HEURISTIC_MIN_LENGTH:
        print(f"Librarian: Heuristic too short ({len(heuristic)} chars)")
        return False
    
    if len(heuristic) > HEURISTIC_MAX_LENGTH:
        # Truncate if too long
        heuristic = heuristic[:HEURISTIC_MAX_LENGTH]
    
    # 4. SECURITY: Validate before storage (FAIL-CLOSED)
    risk = CatoClient.validate_for_storage(heuristic, tenant_id)
    
    if not risk.is_safe:
        print(f"Librarian: Blocked unsafe heuristic (risk={risk.risk_level}): {heuristic[:50]}...")
        return False
    
    # 5. Generate embedding for the heuristic
    try:
        embedding = generate_embedding(heuristic)
    except Exception as e:
        print(f"Librarian: Embedding failed: {e}")
        return False
    
    # 6. Store in database with deduplication
    try:
        with get_safe_db_connection(tenant_id) as (conn, cur):
            if HAS_NUMPY:
                embedding_array = np.array(embedding)
            else:
                embedding_array = embedding
            
            cur.execute("""
                INSERT INTO knowledge_heuristics 
                (tenant_id, domain, heuristic_text, context_embedding, confidence_score, source_execution_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, domain, heuristic_text) 
                DO UPDATE SET 
                    confidence_score = LEAST(knowledge_heuristics.confidence_score + %s, %s),
                    updated_at = NOW()
            """, (
                tenant_id, 
                domain, 
                heuristic, 
                embedding_array, 
                INITIAL_CONFIDENCE,
                execution_id,
                CONFIDENCE_INCREMENT,
                MAX_CONFIDENCE
            ))
            
        print(f"Librarian: Stored heuristic for domain '{domain}': {heuristic[:50]}...")
        return True
        
    except Exception as e:
        print(f"Librarian: Storage failed: {e}")
        return False


def reinforce_heuristic(tenant_id: str, heuristic_id: str, positive: bool = True) -> bool:
    """
    Manually reinforce or penalize a heuristic based on feedback.
    
    Args:
        tenant_id: UUID of the tenant
        heuristic_id: UUID of the heuristic
        positive: True to increase confidence, False to decrease
        
    Returns:
        True if updated successfully
    """
    try:
        with get_safe_db_connection(tenant_id) as (conn, cur):
            if positive:
                cur.execute("""
                    UPDATE knowledge_heuristics
                    SET confidence_score = LEAST(confidence_score + %s, %s),
                        updated_at = NOW()
                    WHERE id = %s AND tenant_id = %s
                """, (CONFIDENCE_INCREMENT, MAX_CONFIDENCE, heuristic_id, tenant_id))
            else:
                cur.execute("""
                    UPDATE knowledge_heuristics
                    SET confidence_score = GREATEST(confidence_score - %s, 0),
                        updated_at = NOW()
                    WHERE id = %s AND tenant_id = %s
                """, (CONFIDENCE_INCREMENT * 2, heuristic_id, tenant_id))
            
            return cur.rowcount > 0
    except Exception as e:
        print(f"Reinforce heuristic failed: {e}")
        return False


# ============================================================================
# TASK 3: CLEANUP EXPIRED HEURISTICS (Maintenance)
# ============================================================================

@task(
    timeout=timedelta(minutes=5),
    retries=1
)
def cleanup_expired_heuristics() -> Dict[str, int]:
    """
    Maintenance task to remove stale heuristics from The Grimoire.
    
    Should be scheduled to run daily via EventBridge.
    Uses system tenant context for cross-tenant access.
    
    Returns:
        Dictionary with counts of deleted heuristics by category
    """
    results = {
        "expired": 0,
        "low_confidence": 0,
        "total": 0
    }
    
    try:
        with get_system_db_connection() as (conn, cur):
            # Delete expired heuristics
            cur.execute("""
                DELETE FROM knowledge_heuristics 
                WHERE expires_at < NOW()
                RETURNING id
            """)
            expired_ids = cur.fetchall()
            results["expired"] = len(expired_ids)
            
            # Also clean up low-confidence heuristics that haven't been reinforced
            cur.execute("""
                DELETE FROM knowledge_heuristics 
                WHERE confidence_score < %s
                  AND created_at < NOW() - INTERVAL '%s days'
                RETURNING id
            """, (MIN_CONFIDENCE_FOR_CLEANUP, STALE_DAYS))
            stale_ids = cur.fetchall()
            results["low_confidence"] = len(stale_ids)
            
            results["total"] = results["expired"] + results["low_confidence"]
            
            print(f"Grimoire Cleanup: Removed {results['expired']} expired, "
                  f"{results['low_confidence']} low-confidence heuristics")
            
    except Exception as e:
        print(f"Grimoire cleanup failed: {e}")
        raise
    
    return results


# ============================================================================
# ADMIN FUNCTIONS
# ============================================================================

def list_heuristics(
    tenant_id: str, 
    domain: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """
    List heuristics for admin viewing/editing.
    
    Args:
        tenant_id: UUID of the tenant
        domain: Optional domain filter
        limit: Max results to return
        offset: Pagination offset
        
    Returns:
        List of heuristic dictionaries
    """
    try:
        with get_safe_db_connection(tenant_id) as (conn, cur):
            if domain:
                cur.execute("""
                    SELECT id, domain, heuristic_text, confidence_score, 
                           source_execution_id, created_at, updated_at, expires_at
                    FROM knowledge_heuristics
                    WHERE domain = %s AND expires_at > NOW()
                    ORDER BY confidence_score DESC, created_at DESC
                    LIMIT %s OFFSET %s
                """, (domain, limit, offset))
            else:
                cur.execute("""
                    SELECT id, domain, heuristic_text, confidence_score,
                           source_execution_id, created_at, updated_at, expires_at
                    FROM knowledge_heuristics
                    WHERE expires_at > NOW()
                    ORDER BY confidence_score DESC, created_at DESC
                    LIMIT %s OFFSET %s
                """, (limit, offset))
            
            rows = cur.fetchall()
            
            return [
                {
                    "id": str(row[0]),
                    "domain": row[1],
                    "heuristic_text": row[2],
                    "confidence_score": float(row[3]),
                    "source_execution_id": row[4],
                    "created_at": row[5].isoformat() if row[5] else None,
                    "updated_at": row[6].isoformat() if row[6] else None,
                    "expires_at": row[7].isoformat() if row[7] else None
                }
                for row in rows
            ]
    except Exception as e:
        print(f"List heuristics failed: {e}")
        return []


def delete_heuristic(tenant_id: str, heuristic_id: str) -> bool:
    """
    Delete a specific heuristic.
    
    Args:
        tenant_id: UUID of the tenant
        heuristic_id: UUID of the heuristic to delete
        
    Returns:
        True if deleted successfully
    """
    try:
        with get_safe_db_connection(tenant_id) as (conn, cur):
            cur.execute("""
                DELETE FROM knowledge_heuristics
                WHERE id = %s AND tenant_id = %s
            """, (heuristic_id, tenant_id))
            return cur.rowcount > 0
    except Exception as e:
        print(f"Delete heuristic failed: {e}")
        return False


def add_manual_heuristic(
    tenant_id: str,
    domain: str,
    heuristic_text: str,
    confidence: float = INITIAL_CONFIDENCE
) -> Optional[str]:
    """
    Manually add a heuristic (admin function).
    
    Args:
        tenant_id: UUID of the tenant
        domain: Domain for the heuristic
        heuristic_text: The heuristic content
        confidence: Initial confidence score
        
    Returns:
        UUID of created heuristic, or None on failure
    """
    # Validate with Cato
    risk = CatoClient.validate_for_storage(heuristic_text, tenant_id)
    if not risk.is_safe:
        print(f"Manual heuristic blocked by Cato: {risk.reason}")
        return None
    
    # Generate embedding
    try:
        embedding = generate_embedding(heuristic_text)
    except Exception as e:
        print(f"Embedding generation failed: {e}")
        return None
    
    # Store
    try:
        with get_safe_db_connection(tenant_id) as (conn, cur):
            if HAS_NUMPY:
                embedding_array = np.array(embedding)
            else:
                embedding_array = embedding
            
            cur.execute("""
                INSERT INTO knowledge_heuristics 
                (tenant_id, domain, heuristic_text, context_embedding, confidence_score, source_execution_id)
                VALUES (%s, %s, %s, %s, %s, 'manual')
                ON CONFLICT (tenant_id, domain, heuristic_text) DO NOTHING
                RETURNING id
            """, (tenant_id, domain, heuristic_text, embedding_array, confidence))
            
            result = cur.fetchone()
            return str(result[0]) if result else None
    except Exception as e:
        print(f"Manual heuristic insert failed: {e}")
        return None


def get_grimoire_statistics(tenant_id: str) -> Dict[str, Any]:
    """
    Get statistics about The Grimoire for a tenant.
    
    Args:
        tenant_id: UUID of the tenant
        
    Returns:
        Dictionary with statistics
    """
    try:
        with get_safe_db_connection(tenant_id) as (conn, cur):
            cur.execute("""
                SELECT 
                    domain,
                    COUNT(*) as total_heuristics,
                    AVG(confidence_score) as avg_confidence,
                    COUNT(*) FILTER (WHERE confidence_score >= 0.8) as high_confidence_count,
                    COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '7 days') as expiring_soon,
                    MAX(created_at) as last_heuristic_added
                FROM knowledge_heuristics
                WHERE expires_at > NOW()
                GROUP BY domain
            """)
            
            rows = cur.fetchall()
            
            by_domain = {}
            total_heuristics = 0
            total_high_confidence = 0
            total_expiring = 0
            
            for row in rows:
                domain_stats = {
                    "total": int(row[1]),
                    "avg_confidence": float(row[2]) if row[2] else 0,
                    "high_confidence": int(row[3]),
                    "expiring_soon": int(row[4]),
                    "last_added": row[5].isoformat() if row[5] else None
                }
                by_domain[row[0]] = domain_stats
                total_heuristics += domain_stats["total"]
                total_high_confidence += domain_stats["high_confidence"]
                total_expiring += domain_stats["expiring_soon"]
            
            return {
                "total_heuristics": total_heuristics,
                "total_high_confidence": total_high_confidence,
                "total_expiring_soon": total_expiring,
                "by_domain": by_domain,
                "domain_count": len(by_domain)
            }
    except Exception as e:
        print(f"Get grimoire statistics failed: {e}")
        return {
            "total_heuristics": 0,
            "total_high_confidence": 0,
            "total_expiring_soon": 0,
            "by_domain": {},
            "domain_count": 0,
            "error": str(e)
        }
