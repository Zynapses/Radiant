/**
 * Unit tests for Database Context Service
 * 
 * Tests the secure database context management for multi-tenant RLS,
 * including SET LOCAL for transaction-scoped context and permission checks.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { PoolClient, Pool, QueryResult } from 'pg';

// Mock pg module
const mockQuery = jest.fn<() => Promise<QueryResult<any>>>();
const mockRelease = jest.fn();
const mockConnect = jest.fn<() => Promise<Partial<PoolClient>>>();
const mockEnd = jest.fn<() => Promise<void>>();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    end: mockEnd,
    on: jest.fn(),
  })),
}));

describe('DbContextService', () => {
  let dbContextService: typeof import('../lambda/shared/services/db-context.service');
  let mockClient: { query: typeof mockQuery; release: typeof mockRelease };

  const baseAuthContext = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    permissionLevel: 'user' as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockClient = {
      query: mockQuery,
      release: mockRelease,
    };
    
    mockConnect.mockResolvedValue(mockClient);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
    
    // Reset module cache
    jest.resetModules();
    
    // Import service after mocks are set up
    dbContextService = await import('../lambda/shared/services/db-context.service');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // withSecureDBContext
  // ==========================================================================

  describe('withSecureDBContext', () => {
    it('should set up transaction with correct context variables', async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });

      await dbContextService.withSecureDBContext(baseAuthContext, operation);

      // Verify BEGIN transaction
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      
      // Verify tenant_id was set
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.current_tenant_id'),
        ['tenant-123']
      );
      
      // Verify user_id was set
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.current_user_id'),
        ['user-456']
      );
      
      // Verify permission_level was set
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.permission_level'),
        ['user']
      );
      
      // Verify COMMIT
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
      
      // Verify operation was called
      expect(operation).toHaveBeenCalledWith(mockClient);
      
      // Verify cleanup
      expect(mockQuery).toHaveBeenCalledWith('RESET ALL');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should set optional context variables when provided', async () => {
      const authContext = {
        ...baseAuthContext,
        appId: 'thinktank',
        jurisdiction: 'EU',
        dataRegion: 'eu-west-1',
      };

      await dbContextService.withSecureDBContext(authContext, jest.fn().mockResolvedValue(null));

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.current_app_id'),
        ['thinktank']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.user_jurisdiction'),
        ['EU']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.data_region'),
        ['eu-west-1']
      );
    });

    it('should set break_glass_mode when active', async () => {
      const authContext = {
        ...baseAuthContext,
        breakGlassMode: true,
      };

      await dbContextService.withSecureDBContext(authContext, jest.fn().mockResolvedValue(null));

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.break_glass_mode'),
      );
    });

    it('should rollback on operation error', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        dbContextService.withSecureDBContext(baseAuthContext, operation)
      ).rejects.toThrow('Operation failed');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should always release client even on cleanup error', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql === 'RESET ALL') {
          throw new Error('Reset failed');
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      await dbContextService.withSecureDBContext(baseAuthContext, jest.fn().mockResolvedValue(null));

      expect(mockRelease).toHaveBeenCalled();
    });

    it('should set is_super_admin for radiant_admin', async () => {
      const authContext = {
        ...baseAuthContext,
        permissionLevel: 'radiant_admin' as const,
      };

      await dbContextService.withSecureDBContext(authContext, jest.fn().mockResolvedValue(null));

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.is_super_admin'),
        ['true']
      );
    });
  });

  // ==========================================================================
  // extractAuthContext
  // ==========================================================================

  describe('extractAuthContext', () => {
    it('should extract auth context from API Gateway event', () => {
      const event = {
        requestContext: {
          authorizer: {
            tenant_id: 'tenant-123',
            user_id: 'user-456',
            permission_level: 'tenant_admin',
            app_uid: 'thinktank',
            jurisdiction: 'US',
            data_region: 'us-east-1',
          },
        },
      };

      const result = dbContextService.extractAuthContext(event);

      expect(result.tenantId).toBe('tenant-123');
      expect(result.userId).toBe('user-456');
      expect(result.permissionLevel).toBe('tenant_admin');
      expect(result.appId).toBe('thinktank');
      expect(result.jurisdiction).toBe('US');
      expect(result.dataRegion).toBe('us-east-1');
    });

    it('should throw if tenant_id is missing', () => {
      const event = {
        requestContext: {
          authorizer: {
            user_id: 'user-456',
          },
        },
      };

      expect(() => dbContextService.extractAuthContext(event)).toThrow(
        'Missing tenant_id in authorization context'
      );
    });

    it('should default permission_level to user', () => {
      const event = {
        requestContext: {
          authorizer: {
            tenant_id: 'tenant-123',
          },
        },
      };

      const result = dbContextService.extractAuthContext(event);

      expect(result.permissionLevel).toBe('user');
    });

    it('should parse break_glass_mode correctly', () => {
      const event = {
        requestContext: {
          authorizer: {
            tenant_id: 'tenant-123',
            break_glass_mode: 'true',
          },
        },
      };

      const result = dbContextService.extractAuthContext(event);

      expect(result.breakGlassMode).toBe(true);
    });

    it('should parse scopes and groups from JSON', () => {
      const event = {
        requestContext: {
          authorizer: {
            tenant_id: 'tenant-123',
            scopes: '["read", "write"]',
            groups: '["admins", "users"]',
          },
        },
      };

      const result = dbContextService.extractAuthContext(event);

      expect(result.scopes).toEqual(['read', 'write']);
      expect(result.groups).toEqual(['admins', 'users']);
    });

    it('should handle empty authorizer', () => {
      const event = {
        requestContext: {},
      };

      expect(() => dbContextService.extractAuthContext(event)).toThrow(
        'Missing tenant_id in authorization context'
      );
    });
  });

  // ==========================================================================
  // hasPermission
  // ==========================================================================

  describe('hasPermission', () => {
    it('should return true when user has exact permission level', () => {
      const authContext = { ...baseAuthContext, permissionLevel: 'tenant_admin' as const };

      expect(dbContextService.hasPermission(authContext, 'tenant_admin')).toBe(true);
    });

    it('should return true when user has higher permission level', () => {
      const authContext = { ...baseAuthContext, permissionLevel: 'radiant_admin' as const };

      expect(dbContextService.hasPermission(authContext, 'tenant_admin')).toBe(true);
      expect(dbContextService.hasPermission(authContext, 'app_admin')).toBe(true);
      expect(dbContextService.hasPermission(authContext, 'user')).toBe(true);
    });

    it('should return false when user has lower permission level', () => {
      const authContext = { ...baseAuthContext, permissionLevel: 'user' as const };

      expect(dbContextService.hasPermission(authContext, 'app_admin')).toBe(false);
      expect(dbContextService.hasPermission(authContext, 'tenant_admin')).toBe(false);
      expect(dbContextService.hasPermission(authContext, 'radiant_admin')).toBe(false);
    });

    it('should handle all permission level combinations', () => {
      const levels = ['user', 'app_admin', 'tenant_admin', 'radiant_admin'] as const;
      
      for (let i = 0; i < levels.length; i++) {
        const authContext = { ...baseAuthContext, permissionLevel: levels[i] };
        
        for (let j = 0; j < levels.length; j++) {
          const expected = i >= j;
          expect(dbContextService.hasPermission(authContext, levels[j])).toBe(expected);
        }
      }
    });
  });

  // ==========================================================================
  // isRadiantAdmin
  // ==========================================================================

  describe('isRadiantAdmin', () => {
    it('should return true for radiant_admin permission level', () => {
      const authContext = { ...baseAuthContext, permissionLevel: 'radiant_admin' as const };

      expect(dbContextService.isRadiantAdmin(authContext)).toBe(true);
    });

    it('should return true for radiant-admins group', () => {
      const authContext = {
        ...baseAuthContext,
        groups: ['radiant-admins'],
      };

      expect(dbContextService.isRadiantAdmin(authContext)).toBe(true);
    });

    it('should return false for non-radiant admins', () => {
      expect(dbContextService.isRadiantAdmin({ ...baseAuthContext, permissionLevel: 'tenant_admin' as const })).toBe(false);
      expect(dbContextService.isRadiantAdmin({ ...baseAuthContext, permissionLevel: 'app_admin' as const })).toBe(false);
      expect(dbContextService.isRadiantAdmin({ ...baseAuthContext, permissionLevel: 'user' as const })).toBe(false);
    });
  });

  // ==========================================================================
  // isTenantAdmin
  // ==========================================================================

  describe('isTenantAdmin', () => {
    it('should return true for tenant_admin', () => {
      const authContext = { ...baseAuthContext, permissionLevel: 'tenant_admin' as const };

      expect(dbContextService.isTenantAdmin(authContext)).toBe(true);
    });

    it('should return true for radiant_admin', () => {
      const authContext = { ...baseAuthContext, permissionLevel: 'radiant_admin' as const };

      expect(dbContextService.isTenantAdmin(authContext)).toBe(true);
    });

    it('should return true for tenant-admins group', () => {
      const authContext = {
        ...baseAuthContext,
        groups: ['tenant-admins'],
      };

      expect(dbContextService.isTenantAdmin(authContext)).toBe(true);
    });

    it('should return false for regular users', () => {
      expect(dbContextService.isTenantAdmin({ ...baseAuthContext, permissionLevel: 'user' as const })).toBe(false);
      expect(dbContextService.isTenantAdmin({ ...baseAuthContext, permissionLevel: 'app_admin' as const })).toBe(false);
    });
  });

  // ==========================================================================
  // isBreakGlassActive
  // ==========================================================================

  describe('isBreakGlassActive', () => {
    it('should return true when break glass mode is active', () => {
      const authContext = { ...baseAuthContext, breakGlassMode: true };

      expect(dbContextService.isBreakGlassActive(authContext)).toBe(true);
    });

    it('should return false when break glass mode is not active', () => {
      expect(dbContextService.isBreakGlassActive({ ...baseAuthContext, breakGlassMode: false })).toBe(false);
      expect(dbContextService.isBreakGlassActive(baseAuthContext)).toBe(false);
    });
  });

  // ==========================================================================
  // hasScope
  // ==========================================================================

  describe('hasScope', () => {
    it('should return true when user has exact scope', () => {
      const authContext = {
        ...baseAuthContext,
        scopes: ['read', 'write', 'admin'],
      };

      expect(dbContextService.hasScope(authContext, 'read')).toBe(true);
      expect(dbContextService.hasScope(authContext, 'write')).toBe(true);
      expect(dbContextService.hasScope(authContext, 'admin')).toBe(true);
    });

    it('should return false when user lacks scope', () => {
      const authContext = {
        ...baseAuthContext,
        scopes: ['read'],
      };

      expect(dbContextService.hasScope(authContext, 'write')).toBe(false);
      expect(dbContextService.hasScope(authContext, 'admin')).toBe(false);
    });

    it('should return true for admin.full scope (wildcard)', () => {
      const authContext = {
        ...baseAuthContext,
        scopes: ['thinktank/admin.full'],
      };

      expect(dbContextService.hasScope(authContext, 'read')).toBe(true);
      expect(dbContextService.hasScope(authContext, 'anything')).toBe(true);
    });

    it('should return false when scopes is undefined', () => {
      expect(dbContextService.hasScope(baseAuthContext, 'read')).toBe(false);
    });
  });

  // ==========================================================================
  // withDBContext HOC
  // ==========================================================================

  describe('withDBContext', () => {
    it('should wrap handler with database context', async () => {
      const handler = jest.fn().mockResolvedValue({ statusCode: 200 });

      const wrappedHandler = dbContextService.withDBContext(handler);

      const event = {
        requestContext: {
          authorizer: {
            tenant_id: 'tenant-123',
            user_id: 'user-456',
          },
        },
      };

      await wrappedHandler(event);

      expect(handler).toHaveBeenCalledWith(
        event,
        mockClient,
        expect.objectContaining({
          tenantId: 'tenant-123',
          userId: 'user-456',
        })
      );
    });

    it('should throw when auth context is invalid', async () => {
      const handler = jest.fn();
      const wrappedHandler = dbContextService.withDBContext(handler);

      const event = {
        requestContext: {},
      };

      await expect(wrappedHandler(event)).rejects.toThrow(
        'Missing tenant_id in authorization context'
      );
    });
  });

  // ==========================================================================
  // Pool Management
  // ==========================================================================

  describe('pool management', () => {
    it('should return pool instance', () => {
      const pool = dbContextService.getPool();
      expect(pool).toBeDefined();
    });

    it('should close pool gracefully', async () => {
      await dbContextService.closePool();
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
