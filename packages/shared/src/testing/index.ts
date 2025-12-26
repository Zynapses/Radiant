/**
 * Testing Utilities
 * 
 * Helpers for testing RADIANT components
 */

// ============================================================================
// Mock Factories
// ============================================================================

export function createMockTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: `tn_${randomId()}`,
    name: 'Test Tenant',
    email: 'test@example.com',
    tier: 'professional',
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: `usr_${randomId()}`,
    tenantId: `tn_${randomId()}`,
    email: 'user@example.com',
    name: 'Test User',
    role: 'admin',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockApiKey(overrides: Partial<MockApiKey> = {}): MockApiKey {
  const tenantId = overrides.tenantId || `tn_${randomId()}`;
  return {
    id: `key_${randomId()}`,
    tenantId,
    name: 'Test API Key',
    prefix: `rad_${tenantId.substring(0, 8)}`,
    scopes: ['chat', 'models'],
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockChatMessage(overrides: Partial<MockMessage> = {}): MockMessage {
  return {
    role: 'user',
    content: 'Hello, how are you?',
    ...overrides,
  };
}

export function createMockChatRequest(overrides: Partial<MockChatRequest> = {}): MockChatRequest {
  return {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ],
    max_tokens: 1000,
    temperature: 0.7,
    ...overrides,
  };
}

export function createMockChatResponse(overrides: Partial<MockChatResponse> = {}): MockChatResponse {
  return {
    id: `chatcmpl_${randomId()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 25,
      completion_tokens: 10,
      total_tokens: 35,
    },
    ...overrides,
  };
}

export function createMockModel(overrides: Partial<MockModel> = {}): MockModel {
  return {
    id: 'gpt-4o',
    providerId: 'openai',
    displayName: 'GPT-4o',
    category: 'chat',
    contextWindow: 128000,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    capabilities: ['chat', 'vision', 'function_calling'],
    status: 'active',
    ...overrides,
  };
}

export function createMockWebhook(overrides: Partial<MockWebhook> = {}): MockWebhook {
  return {
    id: `wh_${randomId()}`,
    tenantId: `tn_${randomId()}`,
    url: 'https://example.com/webhook',
    secret: `whsec_${randomId()}`,
    eventTypes: ['billing.low_balance'],
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Mock Types
// ============================================================================

interface MockTenant {
  id: string;
  name: string;
  email: string;
  tier: string;
  status: string;
  createdAt: string;
}

interface MockUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface MockApiKey {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
}

interface MockMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

interface MockChatRequest {
  model: string;
  messages: MockMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface MockChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: MockMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MockModel {
  id: string;
  providerId: string;
  displayName: string;
  category: string;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  capabilities: string[];
  status: string;
}

interface MockWebhook {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock API Gateway event
 */
export function createMockApiGatewayEvent(overrides: Partial<MockApiGatewayEvent> = {}): MockApiGatewayEvent {
  return {
    httpMethod: 'GET',
    path: '/v2/models',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer rad_test_key',
    },
    queryStringParameters: null,
    pathParameters: null,
    body: null,
    requestContext: {
      requestId: randomId(),
      identity: {
        sourceIp: '127.0.0.1',
      },
    },
    ...overrides,
  };
}

interface MockApiGatewayEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  pathParameters: Record<string, string> | null;
  body: string | null;
  requestContext: {
    requestId: string;
    identity: {
      sourceIp: string;
    };
  };
}

/**
 * Create a mock Lambda context
 */
export function createMockLambdaContext(overrides: Partial<MockLambdaContext> = {}): MockLambdaContext {
  return {
    awsRequestId: randomId(),
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
    memoryLimitInMB: '256',
    logGroupName: '/aws/lambda/test',
    logStreamName: 'test-stream',
    getRemainingTimeInMillis: () => 30000,
    ...overrides,
  };
}

interface MockLambdaContext {
  awsRequestId: string;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis: () => number;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Sleep for a duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random ID
 */
function randomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a value is defined
 */
export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || 'Value is undefined or null');
  }
}

/**
 * Assert that values are equal
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

/**
 * Assert that a value matches a pattern
 */
export function assertMatch(value: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(value)) {
    throw new Error(message || `Value "${value}" does not match pattern ${pattern}`);
  }
}

/**
 * Assert that an array contains a value
 */
export function assertContains<T>(array: T[], value: T, message?: string): void {
  if (!array.includes(value)) {
    throw new Error(message || `Array does not contain ${value}`);
  }
}

/**
 * Assert that an async function throws
 */
export async function assertThrows(
  fn: () => Promise<unknown>,
  expectedError?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (expectedError) {
      const message = error instanceof Error ? error.message : String(error);
      if (typeof expectedError === 'string') {
        if (!message.includes(expectedError)) {
          throw new Error(`Expected error to include "${expectedError}" but got "${message}"`);
        }
      } else {
        if (!expectedError.test(message)) {
          throw new Error(`Expected error to match ${expectedError} but got "${message}"`);
        }
      }
    }
  }
}
