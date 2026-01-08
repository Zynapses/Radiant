"""
Cato HTTP Client - Polyglot Bridge

This module provides Python access to the TypeScript Cato Safety Service
via HTTP. This is the CORRECT pattern for polyglot microservices - 
never import TypeScript modules directly from Python.

RADIANT v5.0.2 - System Evolution

Usage:
    from radiant.flyte.utils.cato_client import CatoClient
    
    risk = CatoClient.epistemic_check("Some content", "tenant-uuid")
    if risk.risk_level == "LOW":
        # Safe to proceed
"""

import os
import httpx
from dataclasses import dataclass, field
from typing import Optional, Literal, List

# Type definitions
RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


@dataclass
class CatoRisk:
    """Result of a Cato safety check"""
    risk_level: RiskLevel
    reason: str
    cbf_violations: List[str] = field(default_factory=list)
    
    @property
    def is_safe(self) -> bool:
        """Returns True if content passed safety checks"""
        return self.risk_level == "LOW"
    
    @property
    def should_block(self) -> bool:
        """Returns True if content should be blocked"""
        return self.risk_level in ("HIGH", "CRITICAL")
    
    @property
    def needs_review(self) -> bool:
        """Returns True if content needs human review"""
        return self.risk_level == "MEDIUM"


class CatoClient:
    """
    HTTP Bridge to the TypeScript Cato Safety Service
    
    Environment Variables:
        CATO_API_URL: Base URL of the Cato service (default: internal service mesh)
        CATO_TIMEOUT: Request timeout in seconds (default: 5.0)
    """
    
    _base_url: Optional[str] = None
    _timeout: float = 5.0
    
    @classmethod
    def _get_config(cls) -> tuple:
        """Lazy load configuration from environment"""
        if cls._base_url is None:
            cls._base_url = os.environ.get(
                "CATO_API_URL", 
                "http://cato-service.radiant.internal/api/safety"
            )
            cls._timeout = float(os.environ.get("CATO_TIMEOUT", "5.0"))
        return cls._base_url, cls._timeout
    
    @staticmethod
    def epistemic_check(content: str, tenant_id: str) -> CatoRisk:
        """
        Validates content against Cato's epistemic safety rules.
        
        This check is used for:
        - Validating heuristics before injection into prompts
        - Validating AI-generated content before storage
        - Detecting prompt injection attempts in memory
        
        Args:
            content: The text content to validate
            tenant_id: UUID of the tenant (for RLS context)
            
        Returns:
            CatoRisk with risk_level and reason
            
        Note:
            On failure, returns LOW risk (fail-open for reads).
            Callers should implement fail-closed for writes.
        """
        base_url, timeout = CatoClient._get_config()
        
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    f"{base_url}/check",
                    headers={
                        "X-Tenant-ID": tenant_id,
                        "Content-Type": "application/json"
                    },
                    json={
                        "content": content,
                        "check_type": "epistemic",
                        "context": {
                            "source": "grimoire",
                            "operation": "validation"
                        }
                    }
                )
                
                if resp.status_code != 200:
                    print(f"Cato check returned {resp.status_code}: {resp.text}")
                    return CatoRisk(
                        risk_level="LOW", 
                        reason=f"Cato unavailable (HTTP {resp.status_code})"
                    )
                
                data = resp.json()
                return CatoRisk(
                    risk_level=data.get("riskLevel", "LOW"),
                    reason=data.get("reason", ""),
                    cbf_violations=data.get("violations", [])
                )
                
        except httpx.TimeoutException:
            print(f"Cato check timed out after {timeout}s")
            return CatoRisk(risk_level="LOW", reason="Cato timeout - bypass")
            
        except Exception as e:
            print(f"Cato check failed: {e}")
            return CatoRisk(risk_level="LOW", reason=f"Error bypass: {str(e)}")
    
    @staticmethod
    def batch_check(contents: List[str], tenant_id: str) -> List[CatoRisk]:
        """
        Validates multiple content items in a single request.
        More efficient than individual checks for bulk operations.
        
        Args:
            contents: List of text content to validate
            tenant_id: UUID of the tenant
            
        Returns:
            List of CatoRisk objects in the same order as inputs
        """
        base_url, timeout = CatoClient._get_config()
        
        if not contents:
            return []
        
        try:
            with httpx.Client(timeout=timeout * 2) as client:
                resp = client.post(
                    f"{base_url}/check/batch",
                    headers={
                        "X-Tenant-ID": tenant_id,
                        "Content-Type": "application/json"
                    },
                    json={
                        "contents": contents,
                        "check_type": "epistemic"
                    }
                )
                
                if resp.status_code != 200:
                    return [CatoRisk(risk_level="LOW", reason="Batch unavailable") 
                            for _ in contents]
                
                data = resp.json()
                return [
                    CatoRisk(
                        risk_level=item.get("riskLevel", "LOW"),
                        reason=item.get("reason", ""),
                        cbf_violations=item.get("violations", [])
                    )
                    for item in data.get("results", [])
                ]
                
        except Exception as e:
            print(f"Cato batch check failed: {e}")
            return [CatoRisk(risk_level="LOW", reason="Batch error bypass") 
                    for _ in contents]

    @staticmethod
    def validate_for_storage(content: str, tenant_id: str) -> CatoRisk:
        """
        FAIL-CLOSED validation for content storage operations.
        
        Unlike epistemic_check which fails open (returns LOW on error),
        this method returns HIGH risk on any error, preventing potentially
        dangerous content from being stored.
        
        Use this for:
        - Storing heuristics in The Grimoire
        - Storing user-provided memory entries
        - Any write operation to persistent storage
        
        Args:
            content: The content to validate
            tenant_id: UUID of the tenant
            
        Returns:
            CatoRisk - Returns HIGH risk level on any error
        """
        base_url, timeout = CatoClient._get_config()
        
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    f"{base_url}/check",
                    headers={
                        "X-Tenant-ID": tenant_id,
                        "Content-Type": "application/json"
                    },
                    json={
                        "content": content,
                        "check_type": "storage",
                        "context": {
                            "source": "grimoire",
                            "operation": "write",
                            "fail_closed": True
                        }
                    }
                )
                
                if resp.status_code != 200:
                    print(f"Cato storage check returned {resp.status_code} - BLOCKING")
                    return CatoRisk(
                        risk_level="HIGH", 
                        reason=f"Cato unavailable - fail-closed (HTTP {resp.status_code})"
                    )
                
                data = resp.json()
                return CatoRisk(
                    risk_level=data.get("riskLevel", "HIGH"),
                    reason=data.get("reason", ""),
                    cbf_violations=data.get("violations", [])
                )
                
        except Exception as e:
            print(f"Cato storage check failed - BLOCKING: {e}")
            return CatoRisk(
                risk_level="HIGH", 
                reason=f"Fail-closed error: {str(e)}"
            )
