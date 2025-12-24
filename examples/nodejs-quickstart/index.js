/**
 * RADIANT SDK Quick Start Example
 * 
 * Run: npm start
 */

import { RadiantClient } from '@radiant/sdk';

// Initialize the client
const client = new RadiantClient({
  apiKey: process.env.RADIANT_API_KEY,
});

async function main() {
  console.log('🚀 RADIANT Quick Start\n');

  // 1. List available models
  console.log('📋 Available Models:');
  const models = await client.models.list();
  models.data.slice(0, 5).forEach(model => {
    console.log(`  - ${model.id}: ${model.display_name}`);
  });
  console.log(`  ... and ${models.data.length - 5} more\n`);

  // 2. Check credit balance
  console.log('💰 Credit Balance:');
  const balance = await client.billing.getCredits();
  console.log(`  Available: $${balance.available.toFixed(2)}\n`);

  // 3. Simple chat completion
  console.log('💬 Chat Completion:');
  const response = await client.chat.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is RADIANT?' }
    ],
    max_tokens: 100,
  });

  console.log(`  Response: ${response.choices[0].message.content}`);
  console.log(`  Tokens used: ${response.usage.total_tokens}\n`);

  console.log('✅ Quick start complete!');
}

main().catch(console.error);
