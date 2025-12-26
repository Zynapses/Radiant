import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock dependencies
vi.mock('../../shared/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    setRequestId: vi.fn(),
    setUserId: vi.fn(),
  })),
}));

vi.mock('../../shared/auth', () => ({
  extractAuthContext: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('../../shared/db', () => ({
  listTenants: vi.fn(),
  getTenantById: vi.fn(),
  createTenant: vi.fn(),
  listUsersByTenant: vi.fn(),
  listAdministrators: vi.fn(),
  getAdministratorById: vi.fn(),
  listPendingInvitations: vi.fn(),
  listPendingApprovalRequests: vi.fn(),
  listAuditLogs: vi.fn(),
  getUsageStats: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
  createAuditLog: vi.fn(),
}));

import { handler } from '../handler';
import { extractAuthContext, requireAdmin } from '../../shared/auth';
import {
  listTenants,
  getTenantById,
  createTenant,
  listAdministrators,
  listPendingApprovalRequests,
  listModels,
  listProviders,
  createAuditLog,
} from '../../shared/db';

const mockContext = {
  awsRequestId: 'test-request-id',
  functionName: 'admin-handler',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:admin',
  memoryLimitInMB: '256',
  logGroupName: '/aws/lambda/admin',
  logStreamName: 'test-stream',
  callbackWaitsForEmptyEventLoop: true,
  getRemainingTimeInMillis: () => 30000,
  done: vi.fn() as unknown,
  fail: vi.fn() as unknown,
  succeed: vi.fn() as unknown,
} as Context;

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/admin/health',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    queryStringParameters: null,
    pathParameters: null,
    body: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/admin/health',
      stage: 'test',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/admin/health',
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
    },
    resource: '/admin/health',
    ...overrides,
  };
}

describe('Admin Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (extractAuthContext as ReturnType<typeof vi.fn>).mockReturnValue({
      userId: 'admin-user-id',
      tenantId: 'test-tenant',
      isSuperAdmin: true,
    });
    (requireAdmin as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (createAuditLog as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const event = createMockEvent({
        path: '/admin/health',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('healthy');
      expect(body.data.service).toBe('admin');
    });
  });

  describe('Dashboard', () => {
    it('should return dashboard stats', async () => {
      (listTenants as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'tenant-1', name: 'Tenant 1' },
        { id: 'tenant-2', name: 'Tenant 2' },
      ]);
      (listAdministrators as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'admin-1', email: 'admin@example.com' },
      ]);
      (listPendingApprovalRequests as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const event = createMockEvent({
        path: '/admin/dashboard',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.stats.tenants_count).toBe(2);
      expect(body.data.stats.admins_count).toBe(1);
      expect(body.data.stats.pending_approvals).toBe(0);
    });
  });

  describe('Tenants', () => {
    it('should list tenants', async () => {
      const mockTenants = [
        { id: 'tenant-1', name: 'Tenant 1', status: 'active' },
        { id: 'tenant-2', name: 'Tenant 2', status: 'active' },
      ];
      (listTenants as ReturnType<typeof vi.fn>).mockResolvedValue(mockTenants);

      const event = createMockEvent({
        path: '/admin/tenants',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.data.length).toBe(2);
      expect(body.data.count).toBe(2);
    });

    it('should get tenant by ID', async () => {
      const mockTenant = { id: 'tenant-1', name: 'Tenant 1', status: 'active' };
      (getTenantById as ReturnType<typeof vi.fn>).mockResolvedValue(mockTenant);

      const event = createMockEvent({
        path: '/admin/tenants/tenant-1',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('tenant-1');
    });

    it('should return 404 for non-existent tenant', async () => {
      (getTenantById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const event = createMockEvent({
        path: '/admin/tenants/non-existent',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
    });

    it('should create a new tenant', async () => {
      const mockTenant = { id: 'new-tenant', name: 'New Tenant', status: 'active' };
      (createTenant as ReturnType<typeof vi.fn>).mockResolvedValue(mockTenant);

      const event = createMockEvent({
        path: '/admin/tenants',
        httpMethod: 'POST',
        body: JSON.stringify({ name: 'New Tenant' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('New Tenant');
    });

    it('should return validation error for missing name', async () => {
      const event = createMockEvent({
        path: '/admin/tenants',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Models', () => {
    it('should list models', async () => {
      const mockModels = [
        { id: 'gpt-4o', displayName: 'GPT-4o', category: 'chat' },
        { id: 'claude-3-opus', displayName: 'Claude 3 Opus', category: 'chat' },
      ];
      (listModels as ReturnType<typeof vi.fn>).mockResolvedValue(mockModels);

      const event = createMockEvent({
        path: '/admin/models',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.data.length).toBe(2);
    });

    it('should filter models by category', async () => {
      const mockModels = [{ id: 'gpt-4o', displayName: 'GPT-4o', category: 'chat' }];
      (listModels as ReturnType<typeof vi.fn>).mockResolvedValue(mockModels);

      const event = createMockEvent({
        path: '/admin/models',
        httpMethod: 'GET',
        queryStringParameters: { category: 'chat' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(listModels).toHaveBeenCalledWith('chat', undefined);
    });
  });

  describe('Providers', () => {
    it('should list providers', async () => {
      const mockProviders = [
        { id: 'openai', name: 'OpenAI', status: 'active' },
        { id: 'anthropic', name: 'Anthropic', status: 'active' },
      ];
      (listProviders as ReturnType<typeof vi.fn>).mockResolvedValue(mockProviders);

      const event = createMockEvent({
        path: '/admin/providers',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.data.length).toBe(2);
    });
  });

  describe('Authorization', () => {
    it('should reject non-admin users', async () => {
      // Import and use the actual ForbiddenError class
      const { ForbiddenError } = await import('../../shared/errors.js');
      (requireAdmin as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new ForbiddenError('Access denied');
      });

      const event = createMockEvent({
        path: '/admin/tenants',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const event = createMockEvent({
        path: '/admin/unknown-route',
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });
});
