# radiant-sdk

Official Python SDK for the RADIANT AI Platform.

## Installation

```bash
pip install radiant-sdk
```

## Quick Start

```python
from radiant import RadiantClient

client = RadiantClient(api_key="your-api-key")

# Chat completion
response = client.chat.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ],
)

print(response.choices[0].message.content)
```

## Features

- ✅ Full type hints
- ✅ Automatic retries with exponential backoff
- ✅ Streaming support
- ✅ Pydantic models for responses
- ✅ Context manager support
- ✅ Debug mode

## Usage

### Configuration

```python
client = RadiantClient(
    api_key="your-api-key",
    base_url="https://api.radiant.example.com",  # Optional
    version="v2",                                  # Optional
    timeout=60.0,                                  # Optional (seconds)
    max_retries=3,                                 # Optional
    debug=False,                                   # Optional
)
```

### Chat Completions

```python
# Basic completion
response = client.chat.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ],
    temperature=0.7,
    max_tokens=1000,
)

print(response.choices[0].message.content)
print(f"Tokens used: {response.usage.total_tokens}")
```

### Streaming

```python
# Streaming completion
for chunk in client.chat.create_stream(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Tell me a story."}
    ],
):
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)
```

### List Models

```python
models = client.models.list()

for model in models.data:
    print(f"{model.id}: {model.display_name}")
```

### Get Specific Model

```python
model = client.models.get("gpt-4o")
print(model)
```

### Check Credit Balance

```python
balance = client.billing.get_credits()
print(f"Available credits: {balance.available}")
```

### Get Usage

```python
usage = client.billing.get_usage(
    start_date="2024-12-01",
    end_date="2024-12-31",
)
print(usage)
```

## Error Handling

```python
from radiant import (
    RadiantClient,
    AuthenticationError,
    RateLimitError,
    InsufficientCreditsError,
)

try:
    response = client.chat.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
    )
except AuthenticationError:
    print("Invalid API key")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except InsufficientCreditsError:
    print("Not enough credits")
```

## Error Types

| Error | Status | Description |
|-------|--------|-------------|
| `AuthenticationError` | 401 | Invalid or missing API key |
| `InsufficientCreditsError` | 402 | Not enough credits |
| `ValidationError` | 400 | Invalid request parameters |
| `NotFoundError` | 404 | Resource not found |
| `RateLimitError` | 429 | Too many requests |
| `ServerError` | 5xx | Server-side error |

## Context Manager

```python
with RadiantClient(api_key="your-api-key") as client:
    response = client.chat.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
    )
# Client is automatically closed
```

## Debug Mode

```python
client = RadiantClient(
    api_key="your-api-key",
    debug=True,  # Logs all requests and responses
)
```

## Function Calling

```python
response = client.chat.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "What is the weather in Paris?"}
    ],
    functions=[
        {
            "name": "get_weather",
            "description": "Get the current weather in a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name"},
                },
                "required": ["location"],
            },
        },
    ],
    function_call="auto",
)

if response.choices[0].message.function_call:
    func = response.choices[0].message.function_call
    print(f"Function: {func['name']}, Args: {func['arguments']}")
```

## Requirements

- Python 3.8+
- A valid RADIANT API key

## License

MIT
