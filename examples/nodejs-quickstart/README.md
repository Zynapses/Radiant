# RADIANT Node.js Quick Start

Example applications demonstrating the RADIANT SDK.

## Setup

```bash
# Install dependencies
npm install

# Set your API key
export RADIANT_API_KEY="your-api-key"
```

## Examples

### Basic Usage

```bash
npm start
```

Demonstrates:
- Listing available models
- Checking credit balance
- Simple chat completion

### Interactive Chat

```bash
npm run chat
```

A simple interactive chat interface with streaming responses.

### Streaming

```bash
npm run stream
```

Demonstrates streaming responses for long-form content generation.

### Function Calling

```bash
npm run functions
```

Demonstrates how to use function calling for tool integration.

## Code Snippets

### Simple Chat

```javascript
import { RadiantClient } from '@radiant/sdk';

const client = new RadiantClient({
  apiKey: process.env.RADIANT_API_KEY,
});

const response = await client.chat.create({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});

console.log(response.choices[0].message.content);
```

### Streaming

```javascript
const stream = client.chat.createStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me a story' }],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Error Handling

```javascript
import { RadiantClient, RateLimitError, AuthenticationError } from '@radiant/sdk';

try {
  const response = await client.chat.create({ ... });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry in ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  }
}
```
