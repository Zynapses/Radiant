"""
RADIANT SDK Client
"""

import json
import time
import random
from typing import Any, AsyncIterator, Iterator, Optional

import httpx

from radiant.errors import (
    APIError,
    AuthenticationError,
    InsufficientCreditsError,
    NotFoundError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from radiant.types import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    CreditBalance,
    Model,
    ModelList,
    StreamingChatCompletionResponse,
)


DEFAULT_BASE_URL = "https://api.radiant.example.com"
DEFAULT_VERSION = "v2"
DEFAULT_TIMEOUT = 60.0
DEFAULT_MAX_RETRIES = 3


class RadiantClient:
    """
    RADIANT API Client.
    
    Usage:
        client = RadiantClient(api_key="your-api-key")
        response = client.chat.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello!"}]
        )
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        version: str = DEFAULT_VERSION,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        debug: bool = False,
    ) -> None:
        if not api_key:
            raise ValueError("API key is required")
        
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.version = version
        self.timeout = timeout
        self.max_retries = max_retries
        self.debug = debug
        
        self._client = httpx.Client(
            timeout=timeout,
            headers=self._default_headers(),
        )
        
        # Resources
        self.chat = ChatResource(self)
        self.models = ModelsResource(self)
        self.billing = BillingResource(self)
    
    def _default_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Radiant-SDK": "python",
            "X-Radiant-SDK-Version": "4.17.0",
        }
    
    def _build_url(self, path: str) -> str:
        return f"{self.base_url}/{self.version}{path}"
    
    def request(
        self,
        method: str,
        path: str,
        body: Optional[dict[str, Any]] = None,
        stream: bool = False,
    ) -> Any:
        """Make a request to the API."""
        url = self._build_url(path)
        last_error: Optional[Exception] = None
        
        for attempt in range(self.max_retries + 1):
            try:
                if self.debug:
                    print(f"[RADIANT] {method} {url}")
                    if body:
                        print(f"[RADIANT] Body: {json.dumps(body, indent=2)}")
                
                if stream:
                    return self._stream_request(method, url, body)
                
                response = self._client.request(
                    method,
                    url,
                    json=body,
                )
                
                request_id = response.headers.get("x-request-id")
                
                if not response.is_success:
                    error = self._handle_error(response, request_id)
                    
                    # Retry on 5xx or 429
                    if response.status_code >= 500 or response.status_code == 429:
                        last_error = error
                        delay = self._get_retry_delay(attempt, response)
                        time.sleep(delay)
                        continue
                    
                    raise error
                
                data = response.json()
                
                if self.debug:
                    print(f"[RADIANT] Response: {json.dumps(data, indent=2)}")
                
                return data
                
            except httpx.RequestError as e:
                last_error = e
                if attempt < self.max_retries:
                    time.sleep(self._get_retry_delay(attempt))
                    continue
        
        if last_error:
            raise last_error
        raise RuntimeError("Request failed")
    
    def _stream_request(
        self,
        method: str,
        url: str,
        body: Optional[dict[str, Any]],
    ) -> Iterator[str]:
        """Make a streaming request."""
        with self._client.stream(method, url, json=body) as response:
            request_id = response.headers.get("x-request-id")
            
            if not response.is_success:
                response.read()
                raise self._handle_error(response, request_id)
            
            for line in response.iter_lines():
                if line:
                    yield line
    
    def _handle_error(
        self,
        response: httpx.Response,
        request_id: Optional[str],
    ) -> APIError:
        """Convert HTTP error to appropriate exception."""
        try:
            data = response.json()
            error = data.get("error", {})
            message = error.get("message", f"HTTP {response.status_code}")
        except Exception:
            message = f"HTTP {response.status_code}"
            error = {}
        
        status = response.status_code
        
        if status == 401:
            return AuthenticationError(message, request_id)
        elif status == 402:
            return InsufficientCreditsError(message, 0, 0, request_id)
        elif status == 404:
            return NotFoundError(message, request_id)
        elif status == 429:
            retry_after = int(response.headers.get("retry-after", 60))
            return RateLimitError(message, retry_after, request_id)
        elif status == 400:
            errors = error.get("details", [])
            return ValidationError(message, errors, request_id)
        elif status >= 500:
            return ServerError(message, request_id)
        else:
            return APIError(message, status, error.get("code", "unknown"), request_id)
    
    def _get_retry_delay(
        self,
        attempt: int,
        response: Optional[httpx.Response] = None,
    ) -> float:
        """Calculate retry delay with exponential backoff."""
        if response:
            retry_after = response.headers.get("retry-after")
            if retry_after:
                return float(retry_after)
        
        # Exponential backoff with jitter
        base_delay = min(2 ** attempt, 30)
        jitter = random.uniform(0, 1)
        return base_delay + jitter
    
    def close(self) -> None:
        """Close the client."""
        self._client.close()
    
    def __enter__(self) -> "RadiantClient":
        return self
    
    def __exit__(self, *args: Any) -> None:
        self.close()


class ChatResource:
    """Chat completions resource."""
    
    def __init__(self, client: RadiantClient) -> None:
        self._client = client
    
    def create(
        self,
        model: str,
        messages: list[dict[str, Any]],
        **kwargs: Any,
    ) -> ChatCompletionResponse:
        """Create a chat completion."""
        body = {
            "model": model,
            "messages": messages,
            **kwargs,
        }
        
        if kwargs.get("stream"):
            raise ValueError("Use create_stream() for streaming")
        
        response = self._client.request("POST", "/chat/completions", body)
        return ChatCompletionResponse.model_validate(response)
    
    def create_stream(
        self,
        model: str,
        messages: list[dict[str, Any]],
        **kwargs: Any,
    ) -> Iterator[StreamingChatCompletionResponse]:
        """Create a streaming chat completion."""
        body = {
            "model": model,
            "messages": messages,
            "stream": True,
            **kwargs,
        }
        
        for line in self._client.request("POST", "/chat/completions", body, stream=True):
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    return
                try:
                    chunk = json.loads(data)
                    yield StreamingChatCompletionResponse.model_validate(chunk)
                except json.JSONDecodeError:
                    continue


class ModelsResource:
    """Models resource."""
    
    def __init__(self, client: RadiantClient) -> None:
        self._client = client
    
    def list(self) -> ModelList:
        """List all available models."""
        response = self._client.request("GET", "/models")
        return ModelList.model_validate(response)
    
    def get(self, model_id: str) -> Model:
        """Get a specific model."""
        response = self._client.request("GET", f"/models/{model_id}")
        return Model.model_validate(response.get("data", response))


class BillingResource:
    """Billing resource."""
    
    def __init__(self, client: RadiantClient) -> None:
        self._client = client
    
    def get_credits(self) -> CreditBalance:
        """Get credit balance."""
        response = self._client.request("GET", "/billing/credits")
        return CreditBalance.model_validate(response.get("data", response))
    
    def get_usage(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict[str, Any]:
        """Get usage data."""
        params = []
        if start_date:
            params.append(f"start_date={start_date}")
        if end_date:
            params.append(f"end_date={end_date}")
        
        path = "/billing/usage"
        if params:
            path += "?" + "&".join(params)
        
        return self._client.request("GET", path)
