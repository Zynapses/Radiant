/**
 * Thermal Manager Lambda Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Mock AWS SDK
vi.mock('@aws-sdk/client-sagemaker', () => ({
  SageMakerClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  DescribeEndpointCommand: vi.fn(),
  UpdateEndpointWeightsAndCapacitiesCommand: vi.fn(),
}));

// Mock database
vi.mock('../../shared/db/client', () => ({
  executeStatement: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

// Mock logger
vi.mock('../../shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock auth
vi.mock('../../shared/auth', () => ({
  extractAuthContext: vi.fn().mockReturnValue({
    userId: 'test-user',
    tenantId: 'test-tenant',
    appId: 'test-app',
    environment: 'dev',
    roles: ['admin'],
    isSuperAdmin: false,
  }),
}));

// Import after mocks
import { handler } from '../manager';
import { executeStatement } from '../../shared/db/client';

describe('Thermal Manager Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createEvent = (
    method: string,
    path: string,
    body?: object,
    pathParameters?: Record<string, string>
  ): APIGatewayProxyEvent => ({
    httpMethod: method,
    path,
    pathParameters: pathParameters ?? null,
    queryStringParameters: null,
    headers: {
      Authorization: 'Bearer test-token',
    },
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: method,
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
      },
      path,
      stage: 'test',
      requestId: 'test-request',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: path,
    },
    resource: path,
  });

  describe('GET /thermal/models', () => {
    it('should return all thermal models', async () => {
      const mockStates = [
        { model_id: 'yolov8m', current_state: 'WARM', target_state: 'WARM' },
        { model_id: 'sam2', current_state: 'COLD', target_state: 'COLD' },
      ];
      
      vi.mocked(executeStatement).mockResolvedValueOnce({
        rows: mockStates,
        rowCount: 2,
      });

      const event = createEvent('GET', '/thermal/models');
      const response = await handler(event) as APIGatewayProxyResult;

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('GET /thermal/models/:modelId', () => {
    it('should return state for specific model', async () => {
      const mockState = {
        model_id: 'yolov8m',
        current_state: 'WARM',
        target_state: 'WARM',
        last_state_change: new Date().toISOString(),
      };
      
      // Mock model lookup
      vi.mocked(executeStatement).mockResolvedValueOnce({
        rows: [mockState],
        rowCount: 1,
      });
      // Mock metrics lookup
      vi.mocked(executeStatement).mockResolvedValueOnce({
        rows: [{ request_count: 10, avg_latency_ms: 50, total_cost: 1.5 }],
        rowCount: 1,
      });

      const event = createEvent('GET', '/thermal/models/yolov8m', undefined, { modelId: 'yolov8m' });
      const response = await handler(event) as APIGatewayProxyResult;

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 404 for unknown model', async () => {
      vi.mocked(executeStatement).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const event = createEvent('GET', '/thermal/models/unknown-model', undefined, { modelId: 'unknown-model' });
      const response = await handler(event) as APIGatewayProxyResult;

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /thermal/models/:modelId', () => {
    it('should update model thermal state', async () => {
      // Mock state update
      vi.mocked(executeStatement)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        // Mock transition lookup
        .mockResolvedValueOnce({
          rows: [{ endpoint_name: 'yolov8m-endpoint', current_state: 'COLD', min_instances: 1 }],
          rowCount: 1,
        })
        // Mock scale endpoint update
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const event = createEvent(
        'PUT',
        '/thermal/models/yolov8m',
        { targetState: 'WARM' },
        { modelId: 'yolov8m' }
      );
      const response = await handler(event) as APIGatewayProxyResult;

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject invalid state', async () => {
      const event = createEvent(
        'PUT',
        '/thermal/models/yolov8m',
        { targetState: 'INVALID_STATE' },
        { modelId: 'yolov8m' }
      );
      const response = await handler(event) as APIGatewayProxyResult;

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /thermal/metrics', () => {
    it('should return thermal metrics', async () => {
      vi.mocked(executeStatement).mockResolvedValueOnce({
        rows: [
          { state: 'WARM', count: 5 },
          { state: 'COLD', count: 10 },
          { state: 'HOT', count: 2 },
        ],
        rowCount: 3,
      });

      const event = createEvent('GET', '/thermal/metrics');
      const response = await handler(event) as APIGatewayProxyResult;

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const { extractAuthContext } = await import('../../shared/auth.js');
      vi.mocked(extractAuthContext).mockImplementationOnce(() => {
        throw new Error('Unauthorized');
      });

      const event = createEvent('GET', '/thermal/models');
      event.headers = {};
      
      const response = await handler(event) as APIGatewayProxyResult;
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(executeStatement).mockRejectedValueOnce(new Error('Database connection failed'));

      const event = createEvent('GET', '/thermal/models');
      const response = await handler(event) as APIGatewayProxyResult;

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle invalid JSON body', async () => {
      const event = createEvent('PUT', '/thermal/models/yolov8m', undefined, { modelId: 'yolov8m' });
      event.body = 'invalid json{';
      
      const response = await handler(event) as APIGatewayProxyResult;
      expect(response.statusCode).toBe(500); // JSON parse error caught by handler
    });
  });
});
