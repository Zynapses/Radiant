# @radiant/cli

Command-line interface for the RADIANT AI Platform.

## Installation

```bash
npm install -g @radiant/cli
```

## Quick Start

```bash
# Configure API key
radiant auth login

# Chat with AI
radiant chat send "Hello, how are you?"

# Interactive chat
radiant chat interactive

# List models
radiant models list

# Check credits
radiant billing credits
```

## Commands

### Authentication

```bash
# Login with API key
radiant auth login
radiant auth login --key YOUR_API_KEY

# Check status
radiant auth status

# Logout
radiant auth logout
```

### Chat

```bash
# Send a message
radiant chat send "What is the capital of France?"

# Use a specific model
radiant chat send "Hello" --model gpt-4o

# With system prompt
radiant chat send "Translate to French" --system "You are a translator"

# Stream response
radiant chat send "Tell me a story" --stream

# Output as JSON
radiant chat send "Hello" --json

# Interactive mode
radiant chat interactive
radiant chat i --model claude-3-opus
```

### Models

```bash
# List all models
radiant models list
radiant models ls

# Filter by category
radiant models list --category chat

# Get model info
radiant models info gpt-4o

# Search models
radiant models search claude
```

### Billing

```bash
# Check credit balance
radiant billing credits

# View usage
radiant billing usage
radiant billing usage --start 2024-12-01 --end 2024-12-31

# Estimate cost
radiant billing estimate --model gpt-4o --input 1000 --output 500
```

### Configuration

```bash
# Show all config
radiant config show

# Set a value
radiant config set defaultModel gpt-4o
radiant config set outputFormat json

# Get a value
radiant config get baseUrl

# Reset to defaults
radiant config reset

# Show config file path
radiant config path
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `baseUrl` | API base URL | `https://api.radiant.example.com` |
| `defaultModel` | Default model for chat | `gpt-4o` |
| `outputFormat` | Output format (text/json/table) | `text` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RADIANT_API_KEY` | API key (overrides stored key) |
| `RADIANT_BASE_URL` | Base URL (overrides config) |

## Examples

### Quick Chat

```bash
$ radiant chat send "What is 2+2?"
Assistant: 2 + 2 equals 4.
```

### Interactive Session

```bash
$ radiant chat i
RADIANT Chat (gpt-4o)
Type "exit" or Ctrl+C to quit

You: Hello!
Assistant: Hello! How can I help you today?

You: What's the weather like?
Assistant: I don't have access to real-time weather data...

You: exit
Goodbye!
```

### Cost Estimation

```bash
$ radiant billing estimate --model gpt-4o --input 1000 --output 500

Cost Estimate

  Model:         gpt-4o
  Input:         1,000 tokens → $0.01
  Output:        500 tokens → $0.02
  Total:         $0.03
```

## Requirements

- Node.js 18.0.0 or later
- A valid RADIANT API key

## License

MIT
