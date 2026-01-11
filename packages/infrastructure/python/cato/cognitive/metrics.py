"""
RADIANT v5.4.0 - Cognitive Metrics Service

CloudWatch metrics emission for cognitive architecture observability.

Metrics Namespace: Radiant/Cognitive

Key Metrics:
- GhostMemoryHit/Miss
- SniperExecution
- WarRoomExecution
- HITLEscalation
- CircuitBreakerState
- RoutingLatency
- RetrievalConfidence
"""

import time
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from enum import Enum
import boto3
from datetime import datetime

logger = logging.getLogger(__name__)


class MetricUnit(Enum):
    """CloudWatch metric units."""
    COUNT = "Count"
    SECONDS = "Seconds"
    MILLISECONDS = "Milliseconds"
    PERCENT = "Percent"
    BYTES = "Bytes"
    NONE = "None"


@dataclass
class MetricDimension:
    """CloudWatch metric dimension."""
    name: str
    value: str


@dataclass
class MetricData:
    """CloudWatch metric data point."""
    name: str
    value: float
    unit: MetricUnit = MetricUnit.COUNT
    dimensions: List[MetricDimension] = None
    timestamp: Optional[datetime] = None
    
    def to_cloudwatch(self) -> dict:
        """Convert to CloudWatch PutMetricData format."""
        data = {
            'MetricName': self.name,
            'Value': self.value,
            'Unit': self.unit.value,
        }
        
        if self.dimensions:
            data['Dimensions'] = [
                {'Name': d.name, 'Value': d.value}
                for d in self.dimensions
            ]
        
        if self.timestamp:
            data['Timestamp'] = self.timestamp
        
        return data


class CognitiveMetrics:
    """
    CloudWatch metrics service for cognitive architecture.
    
    Usage:
        metrics = CognitiveMetrics(tenant_id="tenant-123")
        
        # Record ghost memory hit
        metrics.record_ghost_hit(
            user_id="user-456",
            semantic_key="how to reset password",
            confidence=0.92
        )
        
        # Record sniper execution
        metrics.record_sniper_execution(
            latency_ms=45,
            complexity_score=2.5,
            success=True
        )
    """
    
    NAMESPACE = "Radiant/Cognitive"
    
    def __init__(
        self,
        tenant_id: str,
        region: str = "us-east-1",
        enabled: bool = True,
        sample_rate: float = 1.0
    ):
        self.tenant_id = tenant_id
        self.region = region
        self.enabled = enabled
        self.sample_rate = sample_rate
        self._cloudwatch = None
        self._buffer: List[MetricData] = []
        self._buffer_size = 20
    
    @property
    def cloudwatch(self):
        """Lazy-load CloudWatch client."""
        if self._cloudwatch is None:
            self._cloudwatch = boto3.client('cloudwatch', region_name=self.region)
        return self._cloudwatch
    
    def _should_sample(self) -> bool:
        """Determine if this metric should be sampled."""
        if self.sample_rate >= 1.0:
            return True
        import random
        return random.random() < self.sample_rate
    
    def _emit(self, metric: MetricData) -> None:
        """Emit metric to CloudWatch."""
        if not self.enabled or not self._should_sample():
            return
        
        # Add tenant dimension
        if metric.dimensions is None:
            metric.dimensions = []
        metric.dimensions.append(MetricDimension("TenantId", self.tenant_id))
        
        self._buffer.append(metric)
        
        if len(self._buffer) >= self._buffer_size:
            self._flush()
    
    def _flush(self) -> None:
        """Flush buffered metrics to CloudWatch."""
        if not self._buffer:
            return
        
        try:
            self.cloudwatch.put_metric_data(
                Namespace=self.NAMESPACE,
                MetricData=[m.to_cloudwatch() for m in self._buffer]
            )
            logger.debug(f"Flushed {len(self._buffer)} metrics to CloudWatch")
        except Exception as e:
            logger.warning(f"Failed to flush metrics to CloudWatch: {e}")
        finally:
            self._buffer = []
    
    def flush(self) -> None:
        """Public method to flush metrics."""
        self._flush()
    
    # =========================================================================
    # Ghost Memory Metrics
    # =========================================================================
    
    def record_ghost_hit(
        self,
        user_id: str,
        semantic_key: str,
        confidence: float,
        domain_hint: Optional[str] = None,
        latency_ms: Optional[float] = None
    ) -> None:
        """Record a Ghost Memory cache hit."""
        self._emit(MetricData(
            name="GhostMemoryHit",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("UserId", user_id[:8]),  # Truncate for cardinality
                MetricDimension("DomainHint", domain_hint or "general"),
            ]
        ))
        
        self._emit(MetricData(
            name="GhostRetrievalConfidence",
            value=confidence,
            unit=MetricUnit.NONE,
            dimensions=[
                MetricDimension("DomainHint", domain_hint or "general"),
            ]
        ))
        
        if latency_ms is not None:
            self._emit(MetricData(
                name="GhostMemoryLatency",
                value=latency_ms,
                unit=MetricUnit.MILLISECONDS,
            ))
    
    def record_ghost_miss(
        self,
        user_id: str,
        reason: str = "not_found",
        latency_ms: Optional[float] = None
    ) -> None:
        """Record a Ghost Memory cache miss."""
        self._emit(MetricData(
            name="GhostMemoryMiss",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("Reason", reason),
            ]
        ))
        
        if latency_ms is not None:
            self._emit(MetricData(
                name="GhostMemoryLatency",
                value=latency_ms,
                unit=MetricUnit.MILLISECONDS,
            ))
    
    def record_ghost_write(
        self,
        user_id: str,
        semantic_key: str,
        ttl_seconds: int,
        domain_hint: Optional[str] = None,
        success: bool = True
    ) -> None:
        """Record a Ghost Memory write-back."""
        self._emit(MetricData(
            name="GhostMemoryWrite",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("DomainHint", domain_hint or "general"),
                MetricDimension("Success", str(success)),
            ]
        ))
    
    def record_ghost_write_failure(
        self,
        user_id: str,
        error_type: str
    ) -> None:
        """Record a Ghost Memory write-back failure (non-blocking)."""
        self._emit(MetricData(
            name="GhostMemoryWriteFailure",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("ErrorType", error_type),
            ]
        ))
    
    # =========================================================================
    # Routing Metrics
    # =========================================================================
    
    def record_routing_decision(
        self,
        route_type: str,  # 'sniper', 'war_room', 'hitl'
        complexity_score: float,
        retrieval_confidence: float,
        ghost_hit: bool,
        domain_hint: Optional[str] = None,
        latency_ms: Optional[float] = None
    ) -> None:
        """Record an Economic Governor routing decision."""
        self._emit(MetricData(
            name="RoutingDecision",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("RouteType", route_type),
                MetricDimension("GhostHit", str(ghost_hit)),
                MetricDimension("DomainHint", domain_hint or "general"),
            ]
        ))
        
        self._emit(MetricData(
            name="ComplexityScore",
            value=complexity_score,
            unit=MetricUnit.NONE,
            dimensions=[
                MetricDimension("RouteType", route_type),
            ]
        ))
        
        self._emit(MetricData(
            name="RetrievalConfidence",
            value=retrieval_confidence,
            unit=MetricUnit.NONE,
            dimensions=[
                MetricDimension("RouteType", route_type),
            ]
        ))
        
        if latency_ms is not None:
            self._emit(MetricData(
                name="RoutingLatency",
                value=latency_ms,
                unit=MetricUnit.MILLISECONDS,
            ))
    
    # =========================================================================
    # Execution Metrics
    # =========================================================================
    
    def record_sniper_execution(
        self,
        latency_ms: float,
        complexity_score: float,
        success: bool,
        model: Optional[str] = None,
        write_back_queued: bool = False
    ) -> None:
        """Record a Sniper path execution."""
        self._emit(MetricData(
            name="SniperExecution",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("Success", str(success)),
                MetricDimension("Model", model or "default"),
            ]
        ))
        
        self._emit(MetricData(
            name="SniperLatency",
            value=latency_ms,
            unit=MetricUnit.MILLISECONDS,
            dimensions=[
                MetricDimension("Success", str(success)),
            ]
        ))
        
        if write_back_queued:
            self._emit(MetricData(
                name="SniperWriteBackQueued",
                value=1,
                unit=MetricUnit.COUNT,
            ))
    
    def record_war_room_execution(
        self,
        latency_ms: float,
        complexity_score: float,
        success: bool,
        models_used: int = 1,
        fallback_triggered: bool = False
    ) -> None:
        """Record a War Room path execution."""
        self._emit(MetricData(
            name="WarRoomExecution",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("Success", str(success)),
                MetricDimension("FallbackTriggered", str(fallback_triggered)),
            ]
        ))
        
        self._emit(MetricData(
            name="WarRoomLatency",
            value=latency_ms,
            unit=MetricUnit.MILLISECONDS,
        ))
        
        self._emit(MetricData(
            name="WarRoomModelsUsed",
            value=models_used,
            unit=MetricUnit.COUNT,
        ))
    
    def record_hitl_escalation(
        self,
        reason: str,
        domain_hint: Optional[str] = None,
        timeout_seconds: int = 86400
    ) -> None:
        """Record an HITL escalation."""
        self._emit(MetricData(
            name="HITLEscalation",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("Reason", reason),
                MetricDimension("DomainHint", domain_hint or "general"),
            ]
        ))
    
    def record_hitl_resolution(
        self,
        resolution_time_seconds: float,
        resolution_type: str  # 'resolved', 'expired', 'cancelled'
    ) -> None:
        """Record an HITL resolution."""
        self._emit(MetricData(
            name="HITLResolution",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("ResolutionType", resolution_type),
            ]
        ))
        
        self._emit(MetricData(
            name="HITLResolutionTime",
            value=resolution_time_seconds,
            unit=MetricUnit.SECONDS,
        ))
    
    # =========================================================================
    # Circuit Breaker Metrics
    # =========================================================================
    
    def record_circuit_breaker_state(
        self,
        circuit_name: str,
        state: str,  # 'CLOSED', 'OPEN', 'HALF_OPEN'
        failure_count: int
    ) -> None:
        """Record circuit breaker state."""
        self._emit(MetricData(
            name="CircuitBreakerState",
            value=1,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("CircuitName", circuit_name),
                MetricDimension("State", state),
            ]
        ))
        
        self._emit(MetricData(
            name="CircuitBreakerFailures",
            value=failure_count,
            unit=MetricUnit.COUNT,
            dimensions=[
                MetricDimension("CircuitName", circuit_name),
            ]
        ))
    
    # =========================================================================
    # Cost Metrics
    # =========================================================================
    
    def record_cost_savings(
        self,
        estimated_original_cost: float,
        actual_cost: float,
        route_type: str
    ) -> None:
        """Record cost savings from routing optimization."""
        savings = max(0, estimated_original_cost - actual_cost)
        
        self._emit(MetricData(
            name="CostSavings",
            value=savings,
            unit=MetricUnit.NONE,  # Cents
            dimensions=[
                MetricDimension("RouteType", route_type),
            ]
        ))
        
        self._emit(MetricData(
            name="ActualCost",
            value=actual_cost,
            unit=MetricUnit.NONE,
            dimensions=[
                MetricDimension("RouteType", route_type),
            ]
        ))


def emit_metric(
    tenant_id: str,
    metric_name: str,
    value: float,
    unit: str = "Count",
    dimensions: Optional[Dict[str, str]] = None
) -> None:
    """
    Convenience function to emit a single metric.
    
    Args:
        tenant_id: Tenant ID
        metric_name: Name of the metric
        value: Metric value
        unit: CloudWatch unit (Count, Milliseconds, etc.)
        dimensions: Optional dimensions dict
    """
    try:
        cloudwatch = boto3.client('cloudwatch')
        
        metric_data = {
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit,
            'Dimensions': [
                {'Name': 'TenantId', 'Value': tenant_id}
            ]
        }
        
        if dimensions:
            metric_data['Dimensions'].extend([
                {'Name': k, 'Value': v}
                for k, v in dimensions.items()
            ])
        
        cloudwatch.put_metric_data(
            Namespace=CognitiveMetrics.NAMESPACE,
            MetricData=[metric_data]
        )
    except Exception as e:
        logger.warning(f"Failed to emit metric {metric_name}: {e}")
