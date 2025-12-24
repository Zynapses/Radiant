/**
 * RADIANT Interactive Chat Example
 * 
 * Run: npm run chat
 */

import { RadiantClient } from '@radiant/sdk';
import * as readline from 'readline';

const client = new RadiantClient({
  apiKey: process.env.RADIANT_API_KEY,
});

const messages = [
  { role: 'system', content: 'You are a helpful, friendly assistant.' }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('💬 RADIANT Interactive Chat');
  console.log('Type "quit" to exit\n');

  while (true) {
    const input = await prompt('You: ');
    
    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      rl.close();
      break;
    }

    if (!input.trim()) continue;

    messages.push({ role: 'user', content: input });

    try {
      process.stdout.write('Assistant: ');
      
      let fullResponse = '';
      const stream = client.chat.createStream({
        model: 'gpt-4o',
        messages,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          process.stdout.write(content);
          fullResponse += content;
        }
      }
      
      console.log('\n');
      messages.push({ role: 'assistant', content: fullResponse });
    } catch (error) {
      console.error('\nError:', error.message);
    }
  }
}

main().catch(console.error);
