"""
Resilience Utilities for Python Flyte Tasks

RADIANT v5.2.0 - Production Hardening

Implements retry patterns with exponential backoff and timeout enforcement
to prevent cascading failures when external AI providers are down or slow.

Usage:
    from radiant.flyte.utils.resilience import (
        with_retry,
        with_timeout,
        resilient_http_call,
        CircuitBreaker
    )
    
    @with_retry(max_attempts=3)
    async def call_external_api():
        ...
"""

import os
import time
import asyncio
import functools
from typing import TypeVar, Callable, Optional, Any, Dict, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from contextlib import contextmanager

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
    RetryError,
)

# Type variable for generic return types
T = TypeVar('T')


# ============================================================================
# Timeout Configuration
# ============================================================================

# Default timeouts for HTTP calls (connect_timeout, read_timeout)
DEFAULT_CONNECT_TIMEOUT = 5.0   # 5 seconds to establish connection
DEFAULT_READ_TIMEOUT = 60.0     # 60 seconds to read response
DEFAULT_TOTAL_TIMEOUT = 120.0   # 2 minutes total

# Strict timeouts for time-sensitive operations
STRICT_CONNECT_TIMEOUT = 3.0
STRICT_READ_TIMEOUT = 30.0


def get_http_timeout(
    connect: Optional[float] = None,
    read: Optional[float] = None,
    total: Optional[float] = None,
    strict: bool = False
) -> httpx.Timeout:
    """
    Get configured HTTP timeout.
    
    Args:
        connect: Connection timeout in seconds
        read: Read timeout in seconds  
        total: Total operation timeout in seconds
        strict: Use stricter (shorter) timeouts
        
    Returns:
        httpx.Timeout object configured appropriately
    """
    if strict:
        return httpx.Timeout(
            connect=connect or STRICT_CONNECT_TIMEOUT,
            read=read or STRICT_READ_TIMEOUT,
            write=10.0,
            pool=5.0
        )
    
    return httpx.Timeout(
        connect=connect or DEFAULT_CONNECT_TIMEOUT,
        read=read or DEFAULT_READ_TIMEOUT,
        write=30.0,
        pool=10.0
    )


# ============================================================================
# Retry Decorators using Tenacity
# ============================================================================

def with_retry(
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 10.0,
    multiplier: float = 2.0,
    retry_exceptions: tuple = (httpx.TimeoutException, httpx.ConnectError, ConnectionError),
    log_retries: bool = True
):
    """
    Decorator for adding retry logic with exponential backoff.
    
    Args:
        max_attempts: Maximum number of retry attempts (default: 3)
        min_wait: Minimum wait time between retries in seconds (default: 1.0)
        max_wait: Maximum wait time between retries in seconds (default: 10.0)
        multiplier: Exponential backoff multiplier (default: 2.0)
        retry_exceptions: Tuple of exception types to retry on
        log_retries: Whether to log retry attempts
        
    Usage:
        @with_retry(max_attempts=3)
        async def call_litellm():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        @retry(
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential(multiplier=multiplier, min=min_wait, max=max_wait),
            retry=retry_if_exception_type(retry_exceptions),
            reraise=True
        )
        async def async_wrapper(*args, **kwargs):
            return await func(*args, **kwargs)
        
        @functools.wraps(func)
        @retry(
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential(multiplier=multiplier, min=min_wait, max=max_wait),
            retry=retry_if_exception_type(retry_exceptions),
            reraise=True
        )
        def sync_wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def retry_on_rate_limit(
    max_attempts: int = 5,
    min_wait: float = 1.0,
    max_wait: float = 60.0
):
    """
    Specialized retry decorator for rate limit errors (HTTP 429).
    Uses longer waits since rate limits typically have cooldown periods.
    """
    return with_retry(
        max_attempts=max_attempts,
        min_wait=min_wait,
        max_wait=max_wait,
        multiplier=2.0,
        retry_exceptions=(RateLimitError, httpx.HTTPStatusError)
    )


class RateLimitError(Exception):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, message: str, retry_after: Optional[float] = None):
        super().__init__(message)
        self.retry_after = retry_after


# ============================================================================
# Circuit Breaker (Python Implementation)
# ============================================================================

class CircuitState(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5
    failure_window_seconds: float = 30.0
    reset_timeout_seconds: float = 60.0
    success_threshold: int = 2


@dataclass
class CircuitBreakerStats:
    """Statistics for circuit breaker."""
    name: str
    state: CircuitState
    failures: int
    successes: int
    last_failure_time: Optional[datetime]
    last_success_time: Optional[datetime]
    opened_at: Optional[datetime]
    total_calls: int
    total_failures: int
    total_successes: int


class CircuitBreaker:
    """
    Circuit breaker implementation for Python.
    
    Prevents cascading failures by failing fast when a service is known to be down.
    
    States:
    - CLOSED: Normal operation
    - OPEN: Service is down, fail fast
    - HALF_OPEN: Testing if service recovered
    
    Usage:
        breaker = CircuitBreaker("litellm-api")
        
        async with breaker:
            result = await call_litellm()
    """
    
    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._failures = 0
        self._successes = 0
        self._failure_timestamps: List[datetime] = []
        self._last_failure_time: Optional[datetime] = None
        self._last_success_time: Optional[datetime] = None
        self._opened_at: Optional[datetime] = None
        self._total_calls = 0
        self._total_failures = 0
        self._total_successes = 0
    
    @property
    def state(self) -> CircuitState:
        return self._state
    
    @property
    def is_closed(self) -> bool:
        return self._state == CircuitState.CLOSED
    
    @property
    def is_open(self) -> bool:
        return self._state == CircuitState.OPEN
    
    def get_stats(self) -> CircuitBreakerStats:
        return CircuitBreakerStats(
            name=self.name,
            state=self._state,
            failures=self._failures,
            successes=self._successes,
            last_failure_time=self._last_failure_time,
            last_success_time=self._last_success_time,
            opened_at=self._opened_at,
            total_calls=self._total_calls,
            total_failures=self._total_failures,
            total_successes=self._total_successes,
        )
    
    def _should_attempt_reset(self) -> bool:
        """Check if we should try to reset from OPEN to HALF_OPEN."""
        if self._state != CircuitState.OPEN or self._opened_at is None:
            return False
        
        elapsed = (datetime.now() - self._opened_at).total_seconds()
        return elapsed >= self.config.reset_timeout_seconds
    
    def _record_success(self) -> None:
        """Record a successful call."""
        self._total_successes += 1
        self._last_success_time = datetime.now()
        self._successes += 1
        
        if self._state == CircuitState.HALF_OPEN:
            if self._successes >= self.config.success_threshold:
                self._transition_to(CircuitState.CLOSED)
        elif self._state == CircuitState.CLOSED:
            self._failures = 0
            self._failure_timestamps = []
    
    def _record_failure(self) -> None:
        """Record a failed call."""
        now = datetime.now()
        self._total_failures += 1
        self._last_failure_time = now
        self._failures += 1
        self._failure_timestamps.append(now)
        
        # Clean up old timestamps
        window_start = now - timedelta(seconds=self.config.failure_window_seconds)
        self._failure_timestamps = [
            ts for ts in self._failure_timestamps if ts > window_start
        ]
        
        if self._state == CircuitState.HALF_OPEN:
            self._transition_to(CircuitState.OPEN)
        elif self._state == CircuitState.CLOSED:
            if len(self._failure_timestamps) >= self.config.failure_threshold:
                self._transition_to(CircuitState.OPEN)
    
    def _transition_to(self, new_state: CircuitState) -> None:
        """Transition to a new state."""
        old_state = self._state
        self._state = new_state
        
        if new_state == CircuitState.OPEN:
            self._opened_at = datetime.now()
            self._successes = 0
            print(f"Circuit breaker '{self.name}' OPENED after {self._failures} failures")
        elif new_state == CircuitState.HALF_OPEN:
            self._successes = 0
            self._failures = 0
            print(f"Circuit breaker '{self.name}' entering HALF_OPEN state")
        elif new_state == CircuitState.CLOSED:
            self._failures = 0
            self._successes = 0
            self._failure_timestamps = []
            self._opened_at = None
            print(f"Circuit breaker '{self.name}' CLOSED - service recovered")
    
    def __enter__(self):
        """Context manager entry - check if call is allowed."""
        self._total_calls += 1
        
        if self._state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self._transition_to(CircuitState.HALF_OPEN)
            else:
                remaining = 0
                if self._opened_at:
                    elapsed = (datetime.now() - self._opened_at).total_seconds()
                    remaining = max(0, self.config.reset_timeout_seconds - elapsed)
                raise CircuitOpenError(
                    f"Circuit breaker '{self.name}' is OPEN. "
                    f"Retry in {remaining:.1f}s",
                    self.name,
                    remaining
                )
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - record result."""
        if exc_type is None:
            self._record_success()
        else:
            self._record_failure()
        return False  # Don't suppress exceptions
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self.__enter__()
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        return self.__exit__(exc_type, exc_val, exc_tb)
    
    def execute(self, fn: Callable[[], T]) -> T:
        """Execute a function with circuit breaker protection."""
        with self:
            return fn()
    
    async def execute_async(self, fn: Callable[[], Any]) -> Any:
        """Execute an async function with circuit breaker protection."""
        async with self:
            return await fn()
    
    def reset(self) -> None:
        """Reset circuit breaker to initial state."""
        self._state = CircuitState.CLOSED
        self._failures = 0
        self._successes = 0
        self._failure_timestamps = []
        self._opened_at = None
        self._total_calls = 0
        self._total_failures = 0
        self._total_successes = 0


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open."""
    
    def __init__(self, message: str, circuit_name: str, remaining_seconds: float):
        super().__init__(message)
        self.circuit_name = circuit_name
        self.remaining_seconds = remaining_seconds


# Global circuit breaker registry
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(
    name: str,
    config: Optional[CircuitBreakerConfig] = None
) -> CircuitBreaker:
    """Get or create a circuit breaker by name."""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name, config)
    return _circuit_breakers[name]


# ============================================================================
# Resilient HTTP Client
# ============================================================================

@with_retry(max_attempts=3, min_wait=1.0, max_wait=10.0)
def resilient_http_call(
    url: str,
    method: str = "POST",
    headers: Optional[Dict[str, str]] = None,
    json: Optional[Dict[str, Any]] = None,
    timeout: Optional[httpx.Timeout] = None,
    circuit_name: Optional[str] = None,
) -> httpx.Response:
    """
    Make a resilient HTTP call with retry and circuit breaker.
    
    Args:
        url: Target URL
        method: HTTP method (GET, POST, etc.)
        headers: Request headers
        json: JSON body
        timeout: Timeout configuration
        circuit_name: Optional circuit breaker name
        
    Returns:
        httpx.Response object
        
    Raises:
        httpx.TimeoutException: If request times out after retries
        CircuitOpenError: If circuit breaker is open
    """
    actual_timeout = timeout or get_http_timeout()
    
    def make_request() -> httpx.Response:
        with httpx.Client(timeout=actual_timeout) as client:
            response = client.request(
                method=method,
                url=url,
                headers=headers,
                json=json
            )
            
            # Raise for 5xx errors (retryable)
            if response.status_code >= 500:
                response.raise_for_status()
            
            # Raise for rate limits
            if response.status_code == 429:
                retry_after = response.headers.get('Retry-After')
                raise RateLimitError(
                    f"Rate limited by {url}",
                    retry_after=float(retry_after) if retry_after else None
                )
            
            return response
    
    if circuit_name:
        breaker = get_circuit_breaker(circuit_name)
        return breaker.execute(make_request)
    
    return make_request()


@with_retry(max_attempts=3, min_wait=1.0, max_wait=10.0)
async def resilient_http_call_async(
    url: str,
    method: str = "POST",
    headers: Optional[Dict[str, str]] = None,
    json: Optional[Dict[str, Any]] = None,
    timeout: Optional[httpx.Timeout] = None,
    circuit_name: Optional[str] = None,
) -> httpx.Response:
    """
    Async version of resilient HTTP call.
    """
    actual_timeout = timeout or get_http_timeout()
    
    async def make_request() -> httpx.Response:
        async with httpx.AsyncClient(timeout=actual_timeout) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=json
            )
            
            if response.status_code >= 500:
                response.raise_for_status()
            
            if response.status_code == 429:
                retry_after = response.headers.get('Retry-After')
                raise RateLimitError(
                    f"Rate limited by {url}",
                    retry_after=float(retry_after) if retry_after else None
                )
            
            return response
    
    if circuit_name:
        breaker = get_circuit_breaker(circuit_name)
        return await breaker.execute_async(make_request)
    
    return await make_request()


# ============================================================================
# Timeout Context Manager
# ============================================================================

@contextmanager
def with_timeout(seconds: float, operation_name: str = "operation"):
    """
    Context manager for timing out operations.
    
    Note: This is a soft timeout for synchronous code using signals.
    For async code, use asyncio.wait_for instead.
    
    Usage:
        with with_timeout(30, "database query"):
            result = slow_operation()
    """
    import signal
    
    def timeout_handler(signum, frame):
        raise TimeoutError(f"{operation_name} timed out after {seconds}s")
    
    # Set the signal handler
    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    
    try:
        yield
    finally:
        # Restore the old handler
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old_handler)


async def async_timeout(coro, seconds: float, operation_name: str = "operation"):
    """
    Timeout wrapper for async operations.
    
    Usage:
        result = await async_timeout(slow_async_op(), 30, "API call")
    """
    try:
        return await asyncio.wait_for(coro, timeout=seconds)
    except asyncio.TimeoutError:
        raise TimeoutError(f"{operation_name} timed out after {seconds}s")
