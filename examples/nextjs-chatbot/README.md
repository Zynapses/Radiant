# RADIANT Next.js Chatbot

A full-featured chatbot built with Next.js and the RADIANT SDK.

## Features

- 💬 Real-time streaming responses
- 🎨 Clean, responsive UI
- ⚡ Fast and lightweight
- 🔒 Server-side API calls (secure)

## Setup

```bash
# Install dependencies
npm install

# Set your API key
export RADIANT_API_KEY="your-api-key"

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the chatbot.

## Project Structure

```
app/
├── page.tsx          # Main chat UI
├── layout.tsx        # Root layout
├── globals.css       # Global styles
└── api/
    └── chat/
        └── route.ts  # API route for chat
```

## How It Works

1. User types a message in the input
2. Message is sent to `/api/chat` endpoint
3. Server creates a streaming request to RADIANT
4. Tokens are streamed back to the client
5. UI updates in real-time

## Customization

### Change the Model

Edit `app/api/chat/route.ts`:

```typescript
const stream = client.chat.createStream({
  model: 'claude-3-opus', // Change model here
  messages: [...],
});
```

### Add System Prompt

```typescript
messages: [
  { role: 'system', content: 'You are a helpful coding assistant.' },
  ...messages,
],
```

### Add Memory/Context

Store conversation history in a database or session storage.

## Deployment

```bash
npm run build
npm start
```

Or deploy to Vercel:

```bash
vercel
```

Make sure to set `RADIANT_API_KEY` in your environment variables.
