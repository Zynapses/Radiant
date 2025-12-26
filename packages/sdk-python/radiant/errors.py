"""
RADIANT SDK Errors
"""

from typing import List, Optional


class RadiantError(Exception):
    """Base exception for RADIANT SDK."""
    
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class APIError(RadiantError):
    """API error with status code and error code."""
    
    def __init__(
        self,
        message: str,
        status: int,
        code: str,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id


class AuthenticationError(APIError):
    """Authentication failed (401)."""
    
    def __init__(self, message: str, request_id: Optional[str] = None) -> None:
        super().__init__(message, 401, "authentication_error", request_id)


class RateLimitError(APIError):
    """Rate limit exceeded (429)."""
    
    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(message, 429, "rate_limit_error", request_id)
        self.retry_after = retry_after


class ValidationError(APIError):
    """Validation error (400)."""
    
    def __init__(
        self,
        message: str,
        errors: Optional[List[dict]] = None,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(message, 400, "validation_error", request_id)
        self.errors = errors or []


class InsufficientCreditsError(APIError):
    """Insufficient credits (402)."""
    
    def __init__(
        self,
        message: str,
        required: float,
        available: float,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(message, 402, "insufficient_credits", request_id)
        self.required = required
        self.available = available


class NotFoundError(APIError):
    """Resource not found (404)."""
    
    def __init__(self, message: str, request_id: Optional[str] = None) -> None:
        super().__init__(message, 404, "not_found", request_id)


class ServerError(APIError):
    """Server error (5xx)."""
    
    def __init__(self, message: str, request_id: Optional[str] = None) -> None:
        super().__init__(message, 500, "server_error", request_id)
