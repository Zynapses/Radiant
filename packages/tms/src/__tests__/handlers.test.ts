/**
 * RADIANT TMS - Handler Tests
 * Complete test implementation for Lambda handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock services before importing handlers
vi.mock('../services/tenant.service', () => ({
  tenantService: {
    createTenant: vi.fn(),
    getTenantById: vi.fn(),
    getTenantSummary: vi.fn(),
    updateTenant: vi.fn(),
    softDeleteTenant: vi.fn(),
    restoreTenant: vi.fn(),
    createPhantomTenant: vi.fn(),
    listTenants: vi.fn(),
    addMembership: vi.fn(),
    updateMembership: vi.fn(),
    removeMembership: vi.fn(),
    listMemberships: vi.fn(),
    createVerificationCode: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    sendDeletionWarning: vi.fn(),
    sendVerificationCode: vi.fn(),
  },
}));

vi.mock('../utils/db', () => ({
  executeStatement: vi.fn(),
  executeStatementSingle: vi.fn(),
  uuidParam: vi.fn((name, value) => ({ name, value: { stringValue: value } })),
  param: vi.fn((name, value) => ({ name, value: { stringValue: String(value) } })),
}));

vi.mock('aws-xray-sdk', () => ({
  captureHTTPsGlobal: vi.fn(),
  getSegment: vi.fn(() => ({
    addNewSubsegment: vi.fn(() => ({
      addAnnotation: vi.fn(),
      close: vi.fn(),
    })),
    trace_id: 'test-trace-id',
  })),
}));

import { handler as createTenantHandler } from '../handlers/create-tenant';
import { handler as getTenantHandler } from '../handlers/get-tenant';
import { handler as updateTenantHandler } from '../handlers/update-tenant';
import { handler as deleteTenantHandler } from '../handlers/delete-tenant';
import { handler as listTenantsHandler } from '../handlers/list-tenants';
import { handler as phantomTenantHandler } from '../handlers/phantom-tenant';
import { tenantService } from '../services/tenant.service';

// Helper to create mock API Gateway event
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/tenants',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {},
      httpMethod: 'GET',
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
        sourceIp: '192.168.1.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/tenants',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/tenants',
      stage: 'test',
    },
    resource: '/tenants',
    ...overrides,
  };
}

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: vi.fn(),
  fail: vi.fn(),
  succeed: vi.fn(),
};

describe('Create Tenant Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if no authorization header', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ name: 'test' }),
    });

    const result = await createTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(401);
    const body = JSON.parse(result?.body || '{}');
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 400 for invalid JSON body', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      body: 'not-valid-json',
    });

    const result = await createTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(400);
    const body = JSON.parse(result?.body || '{}');
    expect(body.error).toBe('BadRequest');
  });

  it('should return 400 for validation errors', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        name: '', // Invalid: empty
        displayName: 'Test',
        adminEmail: 'not-an-email', // Invalid email
      }),
    });

    const result = await createTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(400);
    const body = JSON.parse(result?.body || '{}');
    expect(body.error).toBe('ValidationError');
    expect(body.details).toBeDefined();
  });

  it('should return 201 for successful tenant creation', async () => {
    const mockTenant = {
      id: 'new-tenant-id',
      name: 'test-tenant',
      displayName: 'Test Tenant',
      status: 'active',
    };

    vi.mocked(tenantService.createTenant).mockResolvedValueOnce({
      tenant: mockTenant as any,
      adminUser: { id: 'user-id', email: 'admin@test.com' } as any,
      membership: { id: 'membership-id', role: 'owner' } as any,
    });

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        name: 'test-tenant',
        displayName: 'Test Tenant',
        type: 'organization',
        tier: 1,
        primaryRegion: 'us-east-1',
        complianceMode: [],
        adminEmail: 'admin@test.com',
        adminName: 'Admin User',
      }),
    });

    const result = await createTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(201);
    const body = JSON.parse(result?.body || '{}');
    expect(body.success).toBe(true);
    expect(body.data.tenant.id).toBe('new-tenant-id');
  });

  it('should return 409 for duplicate tenant name', async () => {
    vi.mocked(tenantService.createTenant).mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint')
    );

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        name: 'existing-tenant',
        displayName: 'Existing Tenant',
        type: 'organization',
        tier: 1,
        primaryRegion: 'us-east-1',
        complianceMode: [],
        adminEmail: 'admin@test.com',
        adminName: 'Admin User',
      }),
    });

    const result = await createTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(409);
    const body = JSON.parse(result?.body || '{}');
    expect(body.error).toBe('Conflict');
  });
});

describe('Get Tenant Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for missing tenant ID', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: null,
    });

    const result = await getTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(400);
  });

  it('should return 400 for invalid UUID format', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: { tenantId: 'not-a-uuid' },
    });

    const result = await getTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(400);
    const body = JSON.parse(result?.body || '{}');
    expect(body.message).toContain('Invalid tenant ID');
  });

  it('should return 404 for non-existent tenant', async () => {
    vi.mocked(tenantService.getTenantById).mockResolvedValueOnce(null);

    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: { tenantId: '550e8400-e29b-41d4-a716-446655440000' },
      headers: {
        'Authorization': 'Internal-Service-Token test',
        'x-is-super-admin': 'true',
      },
    });

    const result = await getTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(404);
  });

  it('should return 200 with tenant data', async () => {
    const mockTenant = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'test-tenant',
      displayName: 'Test Tenant',
      status: 'active',
    };

    vi.mocked(tenantService.getTenantById).mockResolvedValueOnce(mockTenant as any);

    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: { tenantId: '550e8400-e29b-41d4-a716-446655440000' },
      headers: {
        'Authorization': 'Internal-Service-Token test',
        'x-is-super-admin': 'true',
        'x-tenant-id': '550e8400-e29b-41d4-a716-446655440000',
      },
    });

    const result = await getTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(200);
    const body = JSON.parse(result?.body || '{}');
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('test-tenant');
  });

  it('should return 403 if user tries to access another tenant', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: { tenantId: '550e8400-e29b-41d4-a716-446655440000' },
      headers: {
        'Authorization': 'Bearer test-token',
        'x-tenant-id': 'different-tenant-id',
        'x-is-super-admin': 'false',
      },
    });

    const result = await getTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(403);
  });
});

describe('List Tenants Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 403 for non-super-admin', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
        'x-is-super-admin': 'false',
      },
    });

    const result = await listTenantsHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(403);
  });

  it('should return paginated results for super admin', async () => {
    vi.mocked(tenantService.listTenants).mockResolvedValueOnce({
      tenants: [
        { id: '1', name: 'tenant-1' } as any,
        { id: '2', name: 'tenant-2' } as any,
      ],
      total: 50,
      limit: 20,
      offset: 0,
      hasMore: true,
    });

    const event = createMockEvent({
      httpMethod: 'GET',
      headers: {
        'Authorization': 'Internal-Service-Token test',
        'x-is-super-admin': 'true',
      },
      queryStringParameters: {
        status: 'active',
        limit: '20',
        offset: '0',
      },
    });

    const result = await listTenantsHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(200);
    const body = JSON.parse(result?.body || '{}');
    expect(body.data.tenants).toHaveLength(2);
    expect(body.data.total).toBe(50);
    expect(body.data.hasMore).toBe(true);
  });
});

describe('Delete Tenant Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for missing reason', async () => {
    const event = createMockEvent({
      httpMethod: 'DELETE',
      pathParameters: { tenantId: '550e8400-e29b-41d4-a716-446655440000' },
      headers: {
        'Authorization': 'Internal-Service-Token test',
        'x-is-super-admin': 'true',
        'x-admin-id': 'admin-123',
      },
      body: JSON.stringify({}), // No reason provided
    });

    const result = await deleteTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(400);
  });

  it('should soft delete tenant successfully', async () => {
    vi.mocked(tenantService.softDeleteTenant).mockResolvedValueOnce({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'pending_deletion',
      deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      retentionDays: 30,
      affectedUsers: { total: 5, willBeDeleted: 3, willRemain: 2 },
      notificationsSent: true,
    });

    const event = createMockEvent({
      httpMethod: 'DELETE',
      pathParameters: { tenantId: '550e8400-e29b-41d4-a716-446655440000' },
      headers: {
        'Authorization': 'Internal-Service-Token test',
        'x-is-super-admin': 'true',
        'x-admin-id': 'admin-123',
      },
      body: JSON.stringify({
        reason: 'Customer requested closure',
        notifyUsers: true,
      }),
    });

    const result = await deleteTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(200);
    const body = JSON.parse(result?.body || '{}');
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending_deletion');
  });
});

describe('Phantom Tenant Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create phantom tenant for new user', async () => {
    vi.mocked(tenantService.createPhantomTenant).mockResolvedValueOnce({
      tenantId: 'new-phantom-tenant',
      userId: 'new-user-id',
      tenantName: "Test User's Workspace",
      isExisting: false,
    });

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        userEmail: 'newuser@example.com',
        userDisplayName: 'Test User',
        cognitoUserId: 'cognito-123',
      }),
    });

    const result = await phantomTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(201);
    const body = JSON.parse(result?.body || '{}');
    expect(body.success).toBe(true);
    expect(body.data.isExisting).toBe(false);
    expect(body.message).toContain('created successfully');
  });

  it('should return existing tenant for existing user', async () => {
    vi.mocked(tenantService.createPhantomTenant).mockResolvedValueOnce({
      tenantId: 'existing-tenant',
      userId: 'existing-user-id',
      tenantName: 'Existing Workspace',
      isExisting: true,
    });

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        userEmail: 'existing@example.com',
        userDisplayName: 'Existing User',
        cognitoUserId: 'cognito-existing-123',
      }),
    });

    const result = await phantomTenantHandler(event, mockContext, vi.fn());
    
    expect(result?.statusCode).toBe(200); // 200 for existing, not 201
    const body = JSON.parse(result?.body || '{}');
    expect(body.data.isExisting).toBe(true);
    expect(body.message).toContain('already exists');
  });
});
