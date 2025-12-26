# @radiant/sdk

Official TypeScript/JavaScript SDK for the RADIANT AI Platform.

## Installation

```bash
npm install @radiant/sdk
# or
yarn add @radiant/sdk
# or
pnpm add @radiant/sdk
```

## Quick Start

```typescript
import { RadiantClient } from '@radiant/sdk';

const client = new RadiantClient({
  apiKey: 'your-api-key',
});

// Chat completion
const response = await client.chat.create({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
});

console.log(response.choices[0].message.content);
```

## Features

- ✅ Full TypeScript support
- ✅ Automatic retries with exponential backoff
- ✅ Streaming support
- ✅ Error handling with typed errors
- ✅ Configurable timeouts
- ✅ Debug mode

## Usage

### Configuration

```typescript
const client = new RadiantClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.radiant.example.com', // Optional
  version: 'v2',                               // Optional
  timeout: 60000,                              // Optional (ms)
  maxRetries: 3,                               // Optional
  debug: false,                                // Optional
});
```

### Chat Completions

```typescript
// Basic completion
const response = await client.chat.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  temperature: 0.7,
  max_tokens: 1000,
});

console.log(response.choices[0].message.content);
console.log(`Tokens used: ${response.usage.total_tokens}`);
```

### Streaming

```typescript
// Streaming completion
const stream = client.chat.createStream({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Tell me a story.' }
  ],
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

### List Models

```typescript
const models = await client.models.list();

for (const model of models.data) {
  console.log(`${model.id}: ${model.display_name}`);
}
```

### Get Specific Model

```typescript
const model = await client.models.get('gpt-4o');
console.log(model);
```

### Check Credit Balance

```typescript
const balance = await client.billing.getCredits();
console.log(`Available credits: ${balance.available}`);
```

### Get Usage

```typescript
const usage = await client.billing.getUsage({
  start_date: '2024-12-01',
  end_date: '2024-12-31',
});
console.log(usage);
```

## Error Handling

```typescript
import { 
  RadiantClient, 
  AuthenticationError, 
  RateLimitError,
  InsufficientCreditsError,
} from '@radiant/sdk';

try {
  const response = await client.chat.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello' }],
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof InsufficientCreditsError) {
    console.error('Not enough credits');
  } else {
    throw error;
  }
}
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

## Advanced Usage

### Custom Headers

```typescript
const client = new RadiantClient({
  apiKey: 'your-api-key',
  headers: {
    'X-Custom-Header': 'value',
  },
});
```

### Debug Mode

```typescript
const client = new RadiantClient({
  apiKey: 'your-api-key',
  debug: true, // Logs all requests and responses
});
```

### Function Calling

```typescript
const response = await client.chat.create({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'What is the weather in Paris?' }
  ],
  functions: [
    {
      name: 'get_weather',
      description: 'Get the current weather in a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    },
  ],
  function_call: 'auto',
});

if (response.choices[0].message.function_call) {
  const { name, arguments: args } = response.choices[0].message.function_call;
  console.log(`Function: ${name}, Args: ${args}`);
}
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions:

```typescript
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  Model,
  CreditBalance,
} from '@radiant/sdk';
```

## Requirements

- Node.js 18.0.0 or later
- A valid RADIANT API key

## License

MIT
