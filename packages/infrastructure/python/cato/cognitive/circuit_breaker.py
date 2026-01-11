"""
RADIANT v5.4.0 - Circuit Breaker for Cognitive Architecture

Implements circuit breaker pattern for Ghost Memory and model endpoints.

States:
- CLOSED: Normal operation, requests allowed
- OPEN: Failing, requests blocked, fallback to War Room
- HALF_OPEN: Testing recovery, limited requests allowed
"""

import time
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Callable, Any, TypeVar, Generic
from datetime import datetime, timedelta
import asyncio
import boto3

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5
    recovery_timeout_seconds: float = 30.0
    half_open_max_requests: int = 3
    success_threshold: int = 2


@dataclass
class CircuitBreakerStats:
    """Statistics for circuit breaker monitoring."""
    state: CircuitBreakerState = CircuitBreakerState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    half_open_successes: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    state_changed_at: float = field(default_factory=time.time)
    total_requests: int = 0
    total_failures: int = 0
    total_successes: int = 0


class CircuitBreaker(Generic[T]):
    """
    Circuit breaker for protecting external service calls.
    
    Usage:
        cb = CircuitBreaker[str](
            name="ghost_memory",
            config=CircuitBreakerConfig(failure_threshold=5)
        )
        
        result = await cb.execute(
            lambda: ghost_memory_service.read(user_id),
            fallback=lambda: {"hit": False, "reason": "circuit_open"}
        )
    """
    
    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None,
        cloudwatch_namespace: str = "Radiant/Cognitive"
    ):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.stats = CircuitBreakerStats()
        self.cloudwatch_namespace = cloudwatch_namespace
        self._cloudwatch = None
        self._lock = asyncio.Lock()
    
    @property
    def cloudwatch(self):
        """Lazy-load CloudWatch client."""
        if self._cloudwatch is None:
            self._cloudwatch = boto3.client('cloudwatch')
        return self._cloudwatch
    
    @property
    def state(self) -> CircuitBreakerState:
        """Get current circuit breaker state."""
        return self.stats.state
    
    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (normal operation)."""
        return self.stats.state == CircuitBreakerState.CLOSED
    
    @property
    def is_open(self) -> bool:
        """Check if circuit is open (blocking requests)."""
        return self.stats.state == CircuitBreakerState.OPEN
    
    def can_execute(self) -> bool:
        """
        Check if request can be executed.
        
        Returns True if:
        - Circuit is CLOSED
        - Circuit is HALF_OPEN (testing recovery)
        - Circuit is OPEN but recovery timeout has passed (transitions to HALF_OPEN)
        """
        if self.stats.state == CircuitBreakerState.CLOSED:
            return True
        
        if self.stats.state == CircuitBreakerState.OPEN:
            if self.stats.last_failure_time is not None:
                elapsed = time.time() - self.stats.last_failure_time
                if elapsed >= self.config.recovery_timeout_seconds:
                    self._transition_to_half_open()
                    return True
            return False
        
        # HALF_OPEN - allow limited requests
        return True
    
    def _transition_to_half_open(self) -> None:
        """Transition from OPEN to HALF_OPEN."""
        logger.info(f"Circuit breaker '{self.name}' transitioning to HALF_OPEN")
        self.stats.state = CircuitBreakerState.HALF_OPEN
        self.stats.half_open_successes = 0
        self.stats.state_changed_at = time.time()
        self._emit_state_change_metric()
    
    def record_success(self) -> None:
        """Record a successful request."""
        self.stats.success_count += 1
        self.stats.total_successes += 1
        self.stats.last_success_time = time.time()
        
        if self.stats.state == CircuitBreakerState.HALF_OPEN:
            self.stats.half_open_successes += 1
            if self.stats.half_open_successes >= self.config.success_threshold:
                self._close_circuit()
        elif self.stats.state == CircuitBreakerState.CLOSED:
            self.stats.failure_count = 0
        
        self._emit_request_metric(success=True)
    
    def record_failure(self, error: Optional[Exception] = None) -> None:
        """Record a failed request."""
        self.stats.failure_count += 1
        self.stats.total_failures += 1
        self.stats.last_failure_time = time.time()
        
        if error:
            logger.warning(f"Circuit breaker '{self.name}' recorded failure: {error}")
        
        if self.stats.state == CircuitBreakerState.HALF_OPEN:
            self._open_circuit()
        elif self.stats.failure_count >= self.config.failure_threshold:
            self._open_circuit()
        
        self._emit_request_metric(success=False)
    
    def _open_circuit(self) -> None:
        """Transition to OPEN state."""
        logger.warning(f"Circuit breaker '{self.name}' OPENED after {self.stats.failure_count} failures")
        self.stats.state = CircuitBreakerState.OPEN
        self.stats.state_changed_at = time.time()
        self._emit_state_change_metric()
    
    def _close_circuit(self) -> None:
        """Transition to CLOSED state."""
        logger.info(f"Circuit breaker '{self.name}' CLOSED after recovery")
        self.stats.state = CircuitBreakerState.CLOSED
        self.stats.failure_count = 0
        self.stats.state_changed_at = time.time()
        self._emit_state_change_metric()
    
    async def execute(
        self,
        operation: Callable[[], T],
        fallback: Optional[Callable[[], T]] = None,
    ) -> T:
        """
        Execute operation with circuit breaker protection.
        
        Args:
            operation: The operation to execute
            fallback: Optional fallback if circuit is open
            
        Returns:
            Result of operation or fallback
            
        Raises:
            CircuitOpenError: If circuit is open and no fallback provided
        """
        async with self._lock:
            self.stats.total_requests += 1
        
        if not self.can_execute():
            if fallback:
                logger.info(f"Circuit '{self.name}' open, using fallback")
                return fallback()
            raise CircuitOpenError(f"Circuit breaker '{self.name}' is OPEN")
        
        start_time = time.time()
        try:
            if asyncio.iscoroutinefunction(operation):
                result = await operation()
            else:
                result = operation()
            
            self.record_success()
            self._emit_latency_metric(time.time() - start_time)
            return result
            
        except Exception as e:
            self.record_failure(e)
            self._emit_latency_metric(time.time() - start_time)
            
            if fallback:
                logger.info(f"Circuit '{self.name}' failed, using fallback: {e}")
                return fallback()
            raise
    
    def _emit_request_metric(self, success: bool) -> None:
        """Emit CloudWatch metric for request."""
        try:
            self.cloudwatch.put_metric_data(
                Namespace=self.cloudwatch_namespace,
                MetricData=[
                    {
                        'MetricName': 'CircuitBreakerRequest',
                        'Dimensions': [
                            {'Name': 'CircuitName', 'Value': self.name},
                            {'Name': 'Result', 'Value': 'Success' if success else 'Failure'},
                        ],
                        'Value': 1,
                        'Unit': 'Count',
                    }
                ]
            )
        except Exception as e:
            logger.debug(f"Failed to emit CloudWatch metric: {e}")
    
    def _emit_state_change_metric(self) -> None:
        """Emit CloudWatch metric for state change."""
        try:
            self.cloudwatch.put_metric_data(
                Namespace=self.cloudwatch_namespace,
                MetricData=[
                    {
                        'MetricName': 'CircuitBreakerStateChange',
                        'Dimensions': [
                            {'Name': 'CircuitName', 'Value': self.name},
                            {'Name': 'NewState', 'Value': self.stats.state.value},
                        ],
                        'Value': 1,
                        'Unit': 'Count',
                    }
                ]
            )
        except Exception as e:
            logger.debug(f"Failed to emit CloudWatch metric: {e}")
    
    def _emit_latency_metric(self, latency_seconds: float) -> None:
        """Emit CloudWatch metric for latency."""
        try:
            self.cloudwatch.put_metric_data(
                Namespace=self.cloudwatch_namespace,
                MetricData=[
                    {
                        'MetricName': 'CircuitBreakerLatency',
                        'Dimensions': [
                            {'Name': 'CircuitName', 'Value': self.name},
                        ],
                        'Value': latency_seconds * 1000,
                        'Unit': 'Milliseconds',
                    }
                ]
            )
        except Exception as e:
            logger.debug(f"Failed to emit CloudWatch metric: {e}")
    
    def get_stats(self) -> dict:
        """Get circuit breaker statistics."""
        return {
            'name': self.name,
            'state': self.stats.state.value,
            'failure_count': self.stats.failure_count,
            'success_count': self.stats.success_count,
            'half_open_successes': self.stats.half_open_successes,
            'total_requests': self.stats.total_requests,
            'total_failures': self.stats.total_failures,
            'total_successes': self.stats.total_successes,
            'last_failure_time': self.stats.last_failure_time,
            'last_success_time': self.stats.last_success_time,
            'state_changed_at': self.stats.state_changed_at,
            'config': {
                'failure_threshold': self.config.failure_threshold,
                'recovery_timeout_seconds': self.config.recovery_timeout_seconds,
                'half_open_max_requests': self.config.half_open_max_requests,
            }
        }
    
    def reset(self) -> None:
        """Reset circuit breaker to initial state."""
        logger.info(f"Circuit breaker '{self.name}' reset")
        self.stats = CircuitBreakerStats()


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open and no fallback provided."""
    pass


# Global circuit breakers for shared services
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
    """
    Get or create a named circuit breaker.
    
    Args:
        name: Unique name for the circuit breaker
        config: Optional configuration (only used on creation)
        
    Returns:
        Circuit breaker instance
    """
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name=name, config=config)
    return _circuit_breakers[name]


def get_ghost_memory_circuit_breaker() -> CircuitBreaker:
    """Get circuit breaker for Ghost Memory service."""
    return get_circuit_breaker(
        "ghost_memory",
        CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout_seconds=30.0,
            half_open_max_requests=3,
        )
    )


def get_sniper_circuit_breaker() -> CircuitBreaker:
    """Get circuit breaker for Sniper path."""
    return get_circuit_breaker(
        "sniper",
        CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout_seconds=15.0,
            half_open_max_requests=2,
        )
    )


def get_war_room_circuit_breaker() -> CircuitBreaker:
    """Get circuit breaker for War Room path."""
    return get_circuit_breaker(
        "war_room",
        CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout_seconds=60.0,
            half_open_max_requests=3,
        )
    )
