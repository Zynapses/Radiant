/**
 * RADIANT Function Calling Example
 * 
 * Run: npm run functions
 */

import { RadiantClient } from '@radiant/sdk';

const client = new RadiantClient({
  apiKey: process.env.RADIANT_API_KEY,
});

// Define available functions
const functions = [
  {
    name: 'get_weather',
    description: 'Get the current weather in a given location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'search_products',
    description: 'Search for products in the catalog',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        category: {
          type: 'string',
          description: 'Product category',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price in dollars',
        },
      },
      required: ['query'],
    },
  },
];

// Mock function implementations
function executeFunction(name, args) {
  switch (name) {
    case 'get_weather':
      return {
        location: args.location,
        temperature: 72,
        unit: args.unit || 'fahrenheit',
        condition: 'sunny',
      };
    case 'search_products':
      return {
        results: [
          { name: 'Widget A', price: 29.99 },
          { name: 'Widget B', price: 49.99 },
        ],
        query: args.query,
      };
    default:
      return { error: 'Unknown function' };
  }
}

async function main() {
  console.log('🔧 RADIANT Function Calling Example\n');

  // First request - AI decides to call a function
  console.log('1️⃣ Asking about the weather...');
  
  const response1 = await client.chat.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'What\'s the weather like in San Francisco?' }
    ],
    functions,
    function_call: 'auto',
  });

  const message1 = response1.choices[0].message;

  if (message1.function_call) {
    console.log(`   → AI wants to call: ${message1.function_call.name}`);
    console.log(`   → Arguments: ${message1.function_call.arguments}`);

    // Execute the function
    const args = JSON.parse(message1.function_call.arguments);
    const result = executeFunction(message1.function_call.name, args);
    console.log(`   → Result: ${JSON.stringify(result)}`);

    // Send the result back to get a natural language response
    const response2 = await client.chat.create({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'What\'s the weather like in San Francisco?' },
        message1,
        {
          role: 'function',
          name: message1.function_call.name,
          content: JSON.stringify(result),
        },
      ],
      functions,
    });

    console.log(`   → Final response: ${response2.choices[0].message.content}\n`);
  }

  // Second example - product search
  console.log('2️⃣ Searching for products...');
  
  const response3 = await client.chat.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Find me some widgets under $50' }
    ],
    functions,
    function_call: 'auto',
  });

  const message3 = response3.choices[0].message;

  if (message3.function_call) {
    console.log(`   → AI wants to call: ${message3.function_call.name}`);
    const args = JSON.parse(message3.function_call.arguments);
    const result = executeFunction(message3.function_call.name, args);
    console.log(`   → Found ${result.results.length} products`);
  }

  console.log('\n✅ Function calling complete!');
}

main().catch(console.error);
