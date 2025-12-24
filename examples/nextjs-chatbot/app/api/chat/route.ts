import { RadiantClient } from '@radiant/sdk';

const client = new RadiantClient({
  apiKey: process.env.RADIANT_API_KEY!,
});

export async function POST(request: Request) {
  const { messages } = await request.json();

  const stream = client.chat.createStream({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...messages,
    ],
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
