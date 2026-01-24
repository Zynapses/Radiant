/**
 * Integration tests for Authentication Flow
 * 
 * Tests the complete authentication flow including:
 * - Cognito token validation
 * - Pre-token generation Lambda
 * - Authorization context extraction
 * - Permission level enforcement
 * - Break glass access flow
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { APIGatewayProxyEvent, Context, PreTokenGenerationTriggerEvent } from 'aws-lambda';

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  AdminGetUserCommand: vi.fn(),
  GetUserCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PublishCommand: vi.fn(),
}));

// Mock database client
vi.mock('../../lambda/shared/db/client', () => ({
  executeStatement: vi.fn(),
  getPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    end: vi.fn(),
  })),
}));

// Mock logger
vi.mock('../../lambda/shared/logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Authentication Flow Integration Tests', () => {
  let executeStatement: ReturnType<typeof vi.fn>;

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
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  beforeAll(async () => {
    vi.resetModules();
    executeStatement = (await import('../../lambda/shared/db/client')).executeStatement as ReturnType<typeof vi.fn>;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    executeStatement.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Pre-Token Generation Lambda
  // ==========================================================================

  describe('Pre-Token Generation Lambda', () => {
    const createPreTokenEvent = (
      userName: string,
      userAttributes: Record<string, string>,
      groupConfiguration?: { groupsToOverride?: string[] }
    ): PreTokenGenerationTriggerEvent => ({
      version: '1',
      triggerSource: 'TokenGeneration_HostedAuth',
      region: 'us-east-1',
      userPoolId: 'us-east-1_abc123',
      userName,
      callerContext: {
        awsSdkVersion: '1.0.0',
        clientId: 'client-123',
      },
      request: {
        userAttributes,
        groupConfiguration: groupConfiguration || {},
      },
      response: {
        claimsOverrideDetails: {},
      },
    });

    it('should inject tenant_id into token claims', async () => {
      executeStatement.mockResolvedValueOnce({
        rows: [{
          tenant_id: 'tenant-123',
          permission_level: 'user',
          jurisdiction: 'US',
          data_region: 'us-east-1',
        }],
        rowCount: 1,
      });

      const preTokenHandler = (await import('../../lambda/auth/pre-token-generation')).handler;

      const event = createPreTokenEvent('user-456', {
        sub: 'user-456',
        email: 'user@example.com',
        'custom:tenant_id': 'tenant-123',
      });

      const result = await preTokenHandler(event, mockContext, vi.fn());

      expect(result.response.claimsOverrideDetails).toBeDefined();
      expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride?.tenant_id).toBe('tenant-123');
    });

    it('should inject permission_level into token claims', async () => {
      executeStatement.mockResolvedValueOnce({
        rows: [{
          tenant_id: 'tenant-123',
          permission_level: 'tenant_admin',
        }],
        rowCount: 1,
      });

      const preTokenHandler = (await import('../../lambda/auth/pre-token-generation')).handler;

      const event = createPreTokenEvent('admin-user', {
        sub: 'admin-user',
        email: 'admin@example.com',
        'custom:tenant_id': 'tenant-123',
      });

      const result = await preTokenHandler(event, mockContext, vi.fn());

      expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride?.permission_level).toBe('tenant_admin');
    });

    it('should inject app assignments as scopes', async () => {
      executeStatement.mockImplementation(async (query) => {
        if (query.sql?.includes('users')) {
          return {
            rows: [{ tenant_id: 'tenant-123', permission_level: 'user' }],
            rowCount: 1,
          };
        }
        if (query.sql?.includes('user_application_assignments')) {
          return {
            rows: [
              { app_id: 'thinktank', app_permissions: { read: true, write: true } },
              { app_id: 'dashboard', app_permissions: { read: true } },
            ],
            rowCount: 2,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const preTokenHandler = (await import('../../lambda/auth/pre-token-generation')).handler;

      const event = createPreTokenEvent('user-456', {
        sub: 'user-456',
        email: 'user@example.com',
        'custom:tenant_id': 'tenant-123',
      });

      const result = await preTokenHandler(event, mockContext, vi.fn());

      expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride?.scopes).toBeDefined();
    });

    it('should inject jurisdiction for GDPR compliance', async () => {
      executeStatement.mockResolvedValueOnce({
        rows: [{
          tenant_id: 'tenant-eu',
          permission_level: 'user',
          jurisdiction: 'EU',
          data_region: 'eu-west-1',
        }],
        rowCount: 1,
      });

      const preTokenHandler = (await import('../../lambda/auth/pre-token-generation')).handler;

      const event = createPreTokenEvent('eu-user', {
        sub: 'eu-user',
        email: 'user@eu-company.com',
        'custom:tenant_id': 'tenant-eu',
      });

      const result = await preTokenHandler(event, mockContext, vi.fn());

      expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride?.jurisdiction).toBe('EU');
      expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride?.data_region).toBe('eu-west-1');
    });

    it('should handle radiant admin group membership', async () => {
      executeStatement.mockResolvedValueOnce({
        rows: [{
          tenant_id: 'radiant-platform',
          permission_level: 'radiant_admin',
        }],
        rowCount: 1,
      });

      const preTokenHandler = (await import('../../lambda/auth/pre-token-generation')).handler;

      const event = createPreTokenEvent('super-admin', {
        sub: 'super-admin',
        email: 'superadmin@radiant.ai',
      }, {
        groupsToOverride: ['radiant-admins'],
      });

      const result = await preTokenHandler(event, mockContext, vi.fn());

      expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride?.permission_level).toBe('radiant_admin');
    });
  });

  // ==========================================================================
  // Authorization Context Extraction
  // ==========================================================================

  describe('Authorization Context Extraction', () => {
    it('should extract all fields from authorizer context', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const event = {
        requestContext: {
          authorizer: {
            tenant_id: 'tenant-123',
            user_id: 'user-456',
            permission_level: 'tenant_admin',
            app_uid: 'thinktank',
            jurisdiction: 'US',
            data_region: 'us-east-1',
            break_glass_mode: 'false',
            scopes: '["read", "write", "admin"]',
            groups: '["tenant-admins"]',
          },
        },
      };

      const authContext = dbContextService.extractAuthContext(event);

      expect(authContext.tenantId).toBe('tenant-123');
      expect(authContext.userId).toBe('user-456');
      expect(authContext.permissionLevel).toBe('tenant_admin');
      expect(authContext.appId).toBe('thinktank');
      expect(authContext.jurisdiction).toBe('US');
      expect(authContext.dataRegion).toBe('us-east-1');
      expect(authContext.breakGlassMode).toBe(false);
      expect(authContext.scopes).toEqual(['read', 'write', 'admin']);
      expect(authContext.groups).toEqual(['tenant-admins']);
    });

    it('should throw error when tenant_id is missing', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const event = {
        requestContext: {
          authorizer: {
            user_id: 'user-456',
          },
        },
      };

      expect(() => dbContextService.extractAuthContext(event)).toThrow('Missing tenant_id');
    });

    it('should default permission_level to user', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const event = {
        requestContext: {
          authorizer: {
            tenant_id: 'tenant-123',
          },
        },
      };

      const authContext = dbContextService.extractAuthContext(event);

      expect(authContext.permissionLevel).toBe('user');
    });
  });

  // ==========================================================================
  // Permission Level Enforcement
  // ==========================================================================

  describe('Permission Level Enforcement', () => {
    it('should enforce user < app_admin < tenant_admin < radiant_admin hierarchy', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const userContext = { tenantId: 't', userId: 'u', permissionLevel: 'user' as const };
      const appAdminContext = { tenantId: 't', userId: 'u', permissionLevel: 'app_admin' as const };
      const tenantAdminContext = { tenantId: 't', userId: 'u', permissionLevel: 'tenant_admin' as const };
      const radiantAdminContext = { tenantId: 't', userId: 'u', permissionLevel: 'radiant_admin' as const };

      // User can only access user level
      expect(dbContextService.hasPermission(userContext, 'user')).toBe(true);
      expect(dbContextService.hasPermission(userContext, 'app_admin')).toBe(false);
      expect(dbContextService.hasPermission(userContext, 'tenant_admin')).toBe(false);
      expect(dbContextService.hasPermission(userContext, 'radiant_admin')).toBe(false);

      // App admin can access user and app_admin
      expect(dbContextService.hasPermission(appAdminContext, 'user')).toBe(true);
      expect(dbContextService.hasPermission(appAdminContext, 'app_admin')).toBe(true);
      expect(dbContextService.hasPermission(appAdminContext, 'tenant_admin')).toBe(false);

      // Tenant admin can access user, app_admin, tenant_admin
      expect(dbContextService.hasPermission(tenantAdminContext, 'user')).toBe(true);
      expect(dbContextService.hasPermission(tenantAdminContext, 'app_admin')).toBe(true);
      expect(dbContextService.hasPermission(tenantAdminContext, 'tenant_admin')).toBe(true);
      expect(dbContextService.hasPermission(tenantAdminContext, 'radiant_admin')).toBe(false);

      // Radiant admin can access everything
      expect(dbContextService.hasPermission(radiantAdminContext, 'user')).toBe(true);
      expect(dbContextService.hasPermission(radiantAdminContext, 'app_admin')).toBe(true);
      expect(dbContextService.hasPermission(radiantAdminContext, 'tenant_admin')).toBe(true);
      expect(dbContextService.hasPermission(radiantAdminContext, 'radiant_admin')).toBe(true);
    });

    it('should identify radiant admins correctly', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      expect(dbContextService.isRadiantAdmin({ 
        tenantId: 't', userId: 'u', permissionLevel: 'radiant_admin' 
      })).toBe(true);

      expect(dbContextService.isRadiantAdmin({ 
        tenantId: 't', userId: 'u', permissionLevel: 'tenant_admin', groups: ['radiant-admins'] 
      })).toBe(true);

      expect(dbContextService.isRadiantAdmin({ 
        tenantId: 't', userId: 'u', permissionLevel: 'tenant_admin' 
      })).toBe(false);
    });

    it('should identify tenant admins correctly', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      expect(dbContextService.isTenantAdmin({ 
        tenantId: 't', userId: 'u', permissionLevel: 'tenant_admin' 
      })).toBe(true);

      expect(dbContextService.isTenantAdmin({ 
        tenantId: 't', userId: 'u', permissionLevel: 'radiant_admin' 
      })).toBe(true);

      expect(dbContextService.isTenantAdmin({ 
        tenantId: 't', userId: 'u', permissionLevel: 'user', groups: ['tenant-admins'] 
      })).toBe(true);

      expect(dbContextService.isTenantAdmin({ 
        tenantId: 't', userId: 'u', permissionLevel: 'user' 
      })).toBe(false);
    });
  });

  // ==========================================================================
  // Break Glass Access Flow
  // ==========================================================================

  describe('Break Glass Access Flow', () => {
    it('should initiate break glass for radiant admin', async () => {
      executeStatement.mockResolvedValueOnce({
        rows: [{
          id: 'break-glass-1',
          tenant_id: 'tenant-123',
          initiated_by: 'super-admin',
          access_reason: 'Critical security incident',
          started_at: new Date(),
        }],
        rowCount: 1,
      });

      const userRegistryService = await import('../../lambda/shared/services/user-registry.service');

      const radiantAdminContext = {
        tenantId: 'radiant-platform',
        userId: 'super-admin',
        permissionLevel: 'radiant_admin' as const,
        jurisdiction: 'US',
        dataRegion: 'us-east-1',
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id: 'break-glass-1' }],
          rowCount: 1,
        }),
      };

      const result = await userRegistryService.initiateBreakGlass(
        mockClient as any,
        radiantAdminContext,
        {
          tenantId: 'tenant-123',
          accessReason: 'Critical security incident',
          incidentTicket: 'INC-001',
        }
      );

      expect(result.success).toBe(true);
    });

    it('should reject break glass for non-radiant admin', async () => {
      const userRegistryService = await import('../../lambda/shared/services/user-registry.service');

      const tenantAdminContext = {
        tenantId: 'tenant-123',
        userId: 'tenant-admin',
        permissionLevel: 'tenant_admin' as const,
      };

      const mockClient = {
        query: vi.fn(),
      };

      await expect(
        userRegistryService.initiateBreakGlass(
          mockClient as any,
          tenantAdminContext,
          {
            tenantId: 'tenant-123',
            accessReason: 'Trying to access',
          }
        )
      ).rejects.toThrow();
    });

    it('should set break_glass_mode in auth context', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const event = {
        requestContext: {
          authorizer: {
            tenant_id: 'tenant-123',
            user_id: 'super-admin',
            permission_level: 'radiant_admin',
            break_glass_mode: 'true',
          },
        },
      };

      const authContext = dbContextService.extractAuthContext(event);

      expect(authContext.breakGlassMode).toBe(true);
      expect(dbContextService.isBreakGlassActive(authContext)).toBe(true);
    });

    it('should log break glass access in audit trail', async () => {
      executeStatement.mockResolvedValue({ rows: [], rowCount: 0 });

      const userRegistryService = await import('../../lambda/shared/services/user-registry.service');

      const radiantAdminContext = {
        tenantId: 'radiant-platform',
        userId: 'super-admin',
        permissionLevel: 'radiant_admin' as const,
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id: 'break-glass-1' }],
          rowCount: 1,
        }),
      };

      await userRegistryService.initiateBreakGlass(
        mockClient as any,
        radiantAdminContext,
        {
          tenantId: 'tenant-123',
          accessReason: 'Investigation required',
        }
      );

      // Verify audit log was created
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.any(Array)
      );
    });
  });

  // ==========================================================================
  // Scope-Based Access Control
  // ==========================================================================

  describe('Scope-Based Access Control', () => {
    it('should validate specific scope presence', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const context = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        permissionLevel: 'user' as const,
        scopes: ['thinktank/read', 'thinktank/write', 'dashboard/read'],
      };

      expect(dbContextService.hasScope(context, 'thinktank/read')).toBe(true);
      expect(dbContextService.hasScope(context, 'thinktank/write')).toBe(true);
      expect(dbContextService.hasScope(context, 'dashboard/read')).toBe(true);
      expect(dbContextService.hasScope(context, 'dashboard/write')).toBe(false);
    });

    it('should grant all scopes for admin.full', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const context = {
        tenantId: 'tenant-123',
        userId: 'admin-456',
        permissionLevel: 'tenant_admin' as const,
        scopes: ['thinktank/admin.full'],
      };

      expect(dbContextService.hasScope(context, 'thinktank/read')).toBe(true);
      expect(dbContextService.hasScope(context, 'thinktank/write')).toBe(true);
      expect(dbContextService.hasScope(context, 'thinktank/delete')).toBe(true);
      expect(dbContextService.hasScope(context, 'anything')).toBe(true);
    });
  });

  // ==========================================================================
  // Session Management
  // ==========================================================================

  describe('Session Management', () => {
    it('should set transaction-scoped context variables', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      // Mock pool.connect
      jest.spyOn(dbContextService, 'getPool').mockReturnValue(mockPool as any);

      const authContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        permissionLevel: 'user' as const,
        appId: 'thinktank',
        jurisdiction: 'EU',
        dataRegion: 'eu-west-1',
      };

      await dbContextService.withSecureDBContext(authContext, async (client) => {
        return { success: true };
      });

      // Verify SET LOCAL was called for each context variable
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('app.current_tenant_id'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledWith('RESET ALL');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback and cleanup on error', async () => {
      const dbContextService = await import('../../lambda/shared/services/db-context.service');

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      jest.spyOn(dbContextService, 'getPool').mockReturnValue(mockPool as any);

      const authContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        permissionLevel: 'user' as const,
      };

      await expect(
        dbContextService.withSecureDBContext(authContext, async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Cross-Border Data Access
  // ==========================================================================

  describe('Cross-Border Data Access', () => {
    it('should validate EU data residency requirements', async () => {
      executeStatement.mockResolvedValueOnce({
        rows: [{
          jurisdiction: 'EU',
          data_region: 'eu-west-1',
        }],
        rowCount: 1,
      });

      const userRegistryService = await import('../../lambda/shared/services/user-registry.service');

      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ jurisdiction: 'EU', data_region: 'eu-west-1' }],
          rowCount: 1,
        }),
      };

      const result = await userRegistryService.checkCrossBorderTransfer(
        mockClient as any,
        'eu-user',
        'us-east-1' // Attempting to access from US region
      );

      expect(result.allowed).toBeDefined();
      expect(result.mechanism).toBeDefined();
    });

    it('should allow same region access without restriction', async () => {
      const userRegistryService = await import('../../lambda/shared/services/user-registry.service');

      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ jurisdiction: 'US', data_region: 'us-east-1' }],
          rowCount: 1,
        }),
      };

      const result = await userRegistryService.checkCrossBorderTransfer(
        mockClient as any,
        'us-user',
        'us-east-1'
      );

      expect(result.allowed).toBe(true);
      expect(result.mechanism).toBe('same_region');
    });
  });
});
