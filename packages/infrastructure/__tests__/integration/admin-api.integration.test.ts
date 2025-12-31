/**
 * Integration tests for Admin API Handlers
 * 
 * Tests the complete request/response flow for admin API endpoints,
 * including authentication, authorization, and database operations.
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  AdminGetUserCommand: jest.fn(),
  AdminUpdateUserAttributesCommand: jest.fn(),
}));

// Mock database client
jest.mock('../../lambda/shared/db/client', () => ({
  executeStatement: jest.fn(),
  getPool: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    }),
    end: jest.fn(),
  })),
}));

// Mock logger
jest.mock('../../lambda/shared/logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Admin API Integration Tests', () => {
  let executeStatement: jest.Mock;

  const createMockEvent = (
    method: string,
    path: string,
    body?: unknown,
    pathParameters?: Record<string, string>,
    queryStringParameters?: Record<string, string>
  ): APIGatewayProxyEvent => ({
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : null,
    pathParameters: pathParameters || null,
    queryStringParameters: queryStringParameters || null,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock-token',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-123',
      authorizer: {
        tenant_id: 'tenant-123',
        user_id: 'admin-user',
        permission_level: 'tenant_admin',
        app_uid: 'admin-dashboard',
      },
      protocol: 'HTTP/1.1',
      httpMethod: method,
      identity: {
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
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path,
      stage: 'test',
      requestId: 'request-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-123',
      resourcePath: path,
    },
    resource: path,
    stageVariables: null,
    multiValueQueryStringParameters: null,
  });

  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
    memoryLimitInMB: '128',
    awsRequestId: 'request-123',
    logGroupName: '/aws/lambda/test',
    logStreamName: '2024/01/01/[$LATEST]abc123',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  beforeAll(async () => {
    jest.resetModules();
    executeStatement = (await import('../../lambda/shared/db/client')).executeStatement as jest.Mock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    executeStatement.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // User Registry Admin API
  // ==========================================================================

  describe('User Registry Admin API', () => {
    describe('GET /admin/user-registry/dashboard', () => {
      it('should return dashboard statistics', async () => {
        executeStatement.mockImplementation(async (query) => {
          if (query.sql?.includes('COUNT') && query.sql?.includes('user_application_assignments')) {
            return { rows: [{ count: '150' }], rowCount: 1 };
          }
          if (query.sql?.includes('COUNT') && query.sql?.includes('consent_records')) {
            return { rows: [{ count: '45' }], rowCount: 1 };
          }
          if (query.sql?.includes('COUNT') && query.sql?.includes('dsar_requests')) {
            return { rows: [{ count: '3' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        });

        const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
        
        const event = createMockEvent('GET', '/admin/user-registry/dashboard');
        const response = await userRegistryHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.totalAssignments).toBeDefined();
      });
    });

    describe('POST /admin/user-registry/assignments', () => {
      it('should assign user to application', async () => {
        executeStatement.mockResolvedValueOnce({
          rows: [{
            id: 'assignment-1',
            user_id: 'user-789',
            app_id: 'thinktank',
            assignment_type: 'standard',
          }],
          rowCount: 1,
        });

        const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
        
        const event = createMockEvent('POST', '/admin/user-registry/assignments', {
          userId: 'user-789',
          appId: 'thinktank',
          assignmentType: 'standard',
        });
        const response = await userRegistryHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.user_id).toBe('user-789');
      });

      it('should return 400 for missing required fields', async () => {
        const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
        
        const event = createMockEvent('POST', '/admin/user-registry/assignments', {
          userId: 'user-789',
          // missing appId
        });
        const response = await userRegistryHandler(event, mockContext);

        expect(response.statusCode).toBe(400);
      });
    });

    describe('DELETE /admin/user-registry/assignments/:userId/:appId', () => {
      it('should revoke user assignment', async () => {
        executeStatement.mockResolvedValueOnce({
          rows: [{
            id: 'assignment-1',
            revoked_at: new Date(),
            revoked_by: 'admin-user',
          }],
          rowCount: 1,
        });

        const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
        
        const event = createMockEvent(
          'DELETE',
          '/admin/user-registry/assignments/user-789/thinktank',
          null,
          { userId: 'user-789', appId: 'thinktank' }
        );
        const response = await userRegistryHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
      });
    });
  });

  // ==========================================================================
  // Ego Admin API
  // ==========================================================================

  describe('Ego Admin API', () => {
    describe('GET /admin/ego/dashboard', () => {
      it('should return ego dashboard data', async () => {
        executeStatement.mockImplementation(async (query) => {
          if (query.sql?.includes('ego_config')) {
            return { rows: [{ ego_enabled: true, personality_style: 'balanced' }], rowCount: 1 };
          }
          if (query.sql?.includes('ego_identity')) {
            return { rows: [{ name: 'Aria', identity_narrative: 'Test narrative' }], rowCount: 1 };
          }
          if (query.sql?.includes('ego_affect')) {
            return { rows: [{ dominant_emotion: 'curious', valence: 0.5 }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        });

        const egoHandler = (await import('../../lambda/admin/ego')).handler;
        
        const event = createMockEvent('GET', '/admin/ego/dashboard');
        const response = await egoHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.config).toBeDefined();
        expect(body.identity).toBeDefined();
        expect(body.affect).toBeDefined();
      });
    });

    describe('PUT /admin/ego/identity', () => {
      it('should update ego identity', async () => {
        executeStatement.mockResolvedValueOnce({
          rows: [{ name: 'Updated Name', identity_narrative: 'New narrative' }],
          rowCount: 1,
        });

        const egoHandler = (await import('../../lambda/admin/ego')).handler;
        
        const event = createMockEvent('PUT', '/admin/ego/identity', {
          name: 'Updated Name',
          identityNarrative: 'New narrative',
          coreValues: ['honesty', 'helpfulness'],
        });
        const response = await egoHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
      });
    });

    describe('POST /admin/ego/affect/trigger', () => {
      it('should trigger emotional state', async () => {
        executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const egoHandler = (await import('../../lambda/admin/ego')).handler;
        
        const event = createMockEvent('POST', '/admin/ego/affect/trigger', {
          emotion: 'joy',
          intensity: 0.8,
        });
        const response = await egoHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
      });
    });

    describe('POST /admin/ego/affect/reset', () => {
      it('should reset affect to default', async () => {
        executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const egoHandler = (await import('../../lambda/admin/ego')).handler;
        
        const event = createMockEvent('POST', '/admin/ego/affect/reset');
        const response = await egoHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
      });
    });
  });

  // ==========================================================================
  // Security Admin API
  // ==========================================================================

  describe('Security Admin API', () => {
    describe('GET /admin/security/config', () => {
      it('should return security configuration', async () => {
        executeStatement.mockResolvedValueOnce({
          rows: [{
            protection_enabled: true,
            instruction_hierarchy_enabled: true,
            canary_detection_enabled: true,
          }],
          rowCount: 1,
        });

        const securityHandler = (await import('../../lambda/admin/security-protection')).handler;
        
        const event = createMockEvent('GET', '/admin/security/config');
        const response = await securityHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.protectionEnabled).toBe(true);
      });
    });

    describe('PUT /admin/security/config', () => {
      it('should update security configuration', async () => {
        executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const securityHandler = (await import('../../lambda/admin/security-protection')).handler;
        
        const event = createMockEvent('PUT', '/admin/security/config', {
          protectionEnabled: true,
          instructionHierarchy: {
            enabled: true,
            delimiterStyle: 'bracketed',
          },
        });
        const response = await securityHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
      });
    });

    describe('GET /admin/security/audit-log', () => {
      it('should return security audit log', async () => {
        executeStatement.mockResolvedValueOnce({
          rows: [
            { event_type: 'canary_detected', created_at: new Date() },
            { event_type: 'pii_redacted', created_at: new Date() },
          ],
          rowCount: 2,
        });

        const securityHandler = (await import('../../lambda/admin/security-protection')).handler;
        
        const event = createMockEvent('GET', '/admin/security/audit-log', null, null, {
          limit: '50',
          offset: '0',
        });
        const response = await securityHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.events).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // Inference Components Admin API
  // ==========================================================================

  describe('Inference Components Admin API', () => {
    describe('GET /admin/inference-components/dashboard', () => {
      it('should return inference components dashboard', async () => {
        executeStatement.mockImplementation(async (query) => {
          if (query.sql?.includes('shared_inference_endpoints')) {
            return { rows: [{ endpoint_name: 'shared-endpoint-1', status: 'InService' }], rowCount: 1 };
          }
          if (query.sql?.includes('tier_assignments')) {
            return { rows: [{ model_id: 'model-1', current_tier: 'WARM' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        });

        const inferenceHandler = (await import('../../lambda/admin/inference-components')).handler;
        
        const event = createMockEvent('GET', '/admin/inference-components/dashboard');
        const response = await inferenceHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
      });
    });

    describe('POST /admin/inference-components/evaluate', () => {
      it('should evaluate model tier', async () => {
        executeStatement.mockResolvedValueOnce({
          rows: [{ model_id: 'model-1', request_count: 50 }],
          rowCount: 1,
        });

        const inferenceHandler = (await import('../../lambda/admin/inference-components')).handler;
        
        const event = createMockEvent('POST', '/admin/inference-components/evaluate', {
          modelId: 'model-1',
        });
        const response = await inferenceHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.recommendedTier).toBeDefined();
      });
    });

    describe('POST /admin/inference-components/transition', () => {
      it('should transition model tier', async () => {
        executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const inferenceHandler = (await import('../../lambda/admin/inference-components')).handler;
        
        const event = createMockEvent('POST', '/admin/inference-components/transition', {
          modelId: 'model-1',
          targetTier: 'HOT',
          reason: 'High traffic',
        });
        const response = await inferenceHandler(event, mockContext);

        expect(response.statusCode).toBe(200);
      });
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return 401 for missing authorization', async () => {
      const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
      
      const event = createMockEvent('GET', '/admin/user-registry/dashboard');
      event.requestContext.authorizer = undefined;
      
      const response = await userRegistryHandler(event, mockContext);

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for insufficient permissions', async () => {
      const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
      
      const event = createMockEvent('GET', '/admin/user-registry/dashboard');
      event.requestContext.authorizer = {
        tenant_id: 'tenant-123',
        user_id: 'regular-user',
        permission_level: 'user', // Not admin
      };
      
      const response = await userRegistryHandler(event, mockContext);

      expect(response.statusCode).toBe(403);
    });

    it('should return 500 for database errors', async () => {
      executeStatement.mockRejectedValueOnce(new Error('Database connection failed'));

      const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
      
      const event = createMockEvent('GET', '/admin/user-registry/dashboard');
      const response = await userRegistryHandler(event, mockContext);

      expect(response.statusCode).toBe(500);
    });

    it('should return 404 for non-existent resources', async () => {
      executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
      
      const event = createMockEvent(
        'GET',
        '/admin/user-registry/assignments/non-existent-user',
        null,
        { userId: 'non-existent-user' }
      );
      const response = await userRegistryHandler(event, mockContext);

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  describe('Rate Limiting', () => {
    it('should track request counts', async () => {
      executeStatement.mockResolvedValue({ rows: [], rowCount: 0 });

      const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
      
      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        const event = createMockEvent('GET', '/admin/user-registry/dashboard');
        await userRegistryHandler(event, mockContext);
      }

      // Verify requests were processed
      expect(executeStatement).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CORS Headers
  // ==========================================================================

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
      
      const event = createMockEvent('GET', '/admin/user-registry/dashboard');
      const response = await userRegistryHandler(event, mockContext);

      expect(response.headers).toBeDefined();
      expect(response.headers?.['Access-Control-Allow-Origin']).toBeDefined();
    });

    it('should handle OPTIONS preflight requests', async () => {
      const userRegistryHandler = (await import('../../lambda/admin/user-registry')).handler;
      
      const event = createMockEvent('OPTIONS', '/admin/user-registry/dashboard');
      const response = await userRegistryHandler(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Access-Control-Allow-Methods']).toBeDefined();
    });
  });
});
