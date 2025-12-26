"""
RADIANT SDK Types
"""

from typing import Any, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A message in a chat conversation."""
    
    role: Literal["system", "user", "assistant", "function"]
    content: str
    name: Optional[str] = None
    function_call: Optional[dict[str, str]] = None


class FunctionDefinition(BaseModel):
    """A function definition for function calling."""
    
    name: str
    description: Optional[str] = None
    parameters: dict[str, Any]


class ChatCompletionRequest(BaseModel):
    """Request for chat completion."""
    
    model: str
    messages: List[ChatMessage]
    max_tokens: Optional[int] = None
    temperature: Optional[float] = Field(None, ge=0, le=2)
    top_p: Optional[float] = Field(None, ge=0, le=1)
    n: Optional[int] = Field(None, ge=1)
    stream: Optional[bool] = False
    stop: Optional[str | List[str]] = None
    presence_penalty: Optional[float] = Field(None, ge=-2, le=2)
    frequency_penalty: Optional[float] = Field(None, ge=-2, le=2)
    user: Optional[str] = None
    functions: Optional[List[FunctionDefinition]] = None
    function_call: Optional[str | dict[str, str]] = None


class Usage(BaseModel):
    """Token usage information."""
    
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatChoice(BaseModel):
    """A choice in a chat completion response."""
    
    index: int
    message: ChatMessage
    finish_reason: Literal["stop", "length", "function_call", "content_filter"]


class ChatCompletionResponse(BaseModel):
    """Response from chat completion."""
    
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: List[ChatChoice]
    usage: Usage


class StreamingDelta(BaseModel):
    """Delta in a streaming response."""
    
    role: Optional[str] = None
    content: Optional[str] = None
    function_call: Optional[dict[str, str]] = None


class StreamingChoice(BaseModel):
    """A choice in a streaming response."""
    
    index: int
    delta: StreamingDelta
    finish_reason: Optional[Literal["stop", "length", "function_call", "content_filter"]] = None


class StreamingChatCompletionResponse(BaseModel):
    """Streaming response chunk."""
    
    id: str
    object: Literal["chat.completion.chunk"] = "chat.completion.chunk"
    created: int
    model: str
    choices: List[StreamingChoice]


class Model(BaseModel):
    """An AI model."""
    
    id: str
    object: Literal["model"] = "model"
    created: int
    owned_by: str
    display_name: str
    description: Optional[str] = None
    category: str
    context_window: int
    input_cost_per_1k: float
    output_cost_per_1k: float
    capabilities: List[str]


class ModelList(BaseModel):
    """List of models."""
    
    object: Literal["list"] = "list"
    data: List[Model]


class CreditBalance(BaseModel):
    """Credit balance information."""
    
    available: float
    reserved: float
    currency: str
    updated_at: str
