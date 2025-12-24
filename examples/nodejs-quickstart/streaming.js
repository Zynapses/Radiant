/**
 * RADIANT Streaming Example
 * 
 * Run: npm run stream
 */

import { RadiantClient } from '@radiant/sdk';

const client = new RadiantClient({
  apiKey: process.env.RADIANT_API_KEY,
});

async function main() {
  console.log('🌊 RADIANT Streaming Example\n');
  console.log('Generating a story...\n');
  console.log('-'.repeat(50));

  const stream = client.chat.createStream({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Write a short 3-paragraph story about a robot learning to paint.' }
    ],
  });

  // Stream tokens as they arrive
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }

  console.log('\n' + '-'.repeat(50));
  console.log('\n✅ Streaming complete!');
}

main().catch(console.error);
