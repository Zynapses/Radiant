# RADIANT Python Quick Start

Example applications demonstrating the RADIANT Python SDK.

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your API key
export RADIANT_API_KEY="your-api-key"
```

## Examples

### Quick Start

```bash
python quickstart.py
```

### Streaming

```bash
python streaming.py
```

## Code Snippets

### Simple Chat

```python
from radiant import RadiantClient

client = RadiantClient(api_key="your-api-key")

response = client.chat.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### Streaming

```python
for chunk in client.chat.create_stream(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Tell me a story"}]
):
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

### Error Handling

```python
from radiant import RadiantClient, RateLimitError, AuthenticationError

try:
    response = client.chat.create(...)
except RateLimitError as e:
    print(f"Rate limited. Retry in {e.retry_after}s")
except AuthenticationError:
    print("Invalid API key")
```

### Context Manager

```python
with RadiantClient(api_key="your-api-key") as client:
    response = client.chat.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello!"}]
    )
# Client is automatically closed
```
