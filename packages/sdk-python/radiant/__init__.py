"""
RADIANT SDK - Official Python Client

Usage:
    from radiant import RadiantClient

    client = RadiantClient(api_key="your-api-key")
    
    response = client.chat.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print(response.choices[0].message.content)
"""

from radiant.client import RadiantClient
from radiant.errors import (
    RadiantError,
    APIError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
    InsufficientCreditsError,
    NotFoundError,
    ServerError,
)
from radiant.types import (
    ChatMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatChoice,
    Usage,
    Model,
    ModelList,
    CreditBalance,
)

__version__ = "4.17.0"

__all__ = [
    "RadiantClient",
    "RadiantError",
    "APIError",
    "AuthenticationError",
    "RateLimitError",
    "ValidationError",
    "InsufficientCreditsError",
    "NotFoundError",
    "ServerError",
    "ChatMessage",
    "ChatCompletionRequest",
    "ChatCompletionResponse",
    "ChatChoice",
    "Usage",
    "Model",
    "ModelList",
    "CreditBalance",
]
