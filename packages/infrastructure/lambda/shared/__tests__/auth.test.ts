import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import {
  extractAuthContext,
  requireAdmin,
  requireTenantAccess,
  requirePermission,
  canAccessTenant,
  type AuthContext,
} from '../auth';

function createMockAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'user-123',
    appUserId: 'app-user-123',
    tenantId: 'tenant-456',
    appId: 'thinktank',
    email: 'user@example.com',
    roles: ['user'],
    groups: [],
    isAdmin: false,
    isSuperAdmin: false,
    tokenExpiry: Math.floor(Date.now() / 1000) + 3600,
    environment: 'dev',
    role: 'user',
    ...overrides,
  };
}

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/test',
    headers: {},
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
      path: '/test',
      stage: 'test',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/test',
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
    resource: '/test',
    ...overrides,
  };
}

describe('Auth Module', () => {
  describe('extractAuthContext', () => {
    it('should throw UnauthorizedError for missing claims', () => {
      const event = createMockEvent();

      expect(() => extractAuthContext(event)).toThrow('No authentication claims found');
    });

    it('should throw UnauthorizedError for expired token', () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            claims: {
              sub: 'user-123',
              'custom:tenantId': 'tenant-456',
              exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
            },
          },
        },
      });

      expect(() => extractAuthContext(event)).toThrow('Token has expired');
    });

    it('should extract auth context from valid claims', () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            claims: {
              sub: 'user-123',
              email: 'user@example.com',
              'custom:tenantId': 'tenant-456',
              'custom:appId': 'thinktank',
              exp: Math.floor(Date.now() / 1000) + 3600,
            },
          },
        },
      });

      const result = extractAuthContext(event);

      expect(result.userId).toBe('user-123');
      expect(result.tenantId).toBe('tenant-456');
      expect(result.email).toBe('user@example.com');
      expect(result.appId).toBe('thinktank');
    });

    it('should throw UnauthorizedError for missing tenant ID', () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            claims: {
              sub: 'user-123',
              exp: Math.floor(Date.now() / 1000) + 3600,
            },
          },
        },
      });

      expect(() => extractAuthContext(event)).toThrow('Missing tenant ID');
    });
  });

  describe('requireAdmin', () => {
    it('should pass for admin users', () => {
      const auth = createMockAuthContext({
        isAdmin: true,
        groups: ['admin'],
      });

      expect(() => requireAdmin(auth)).not.toThrow();
    });

    it('should throw ForbiddenError for non-admin users', () => {
      const auth = createMockAuthContext({
        isAdmin: false,
      });

      expect(() => requireAdmin(auth)).toThrow('Admin access required');
    });
  });

  describe('requireTenantAccess', () => {
    it('should pass when tenant ID matches', () => {
      const auth = createMockAuthContext({
        tenantId: 'tenant-456',
      });

      expect(() => requireTenantAccess(auth, 'tenant-456')).not.toThrow();
    });

    it('should pass for super admin accessing any tenant', () => {
      const auth = createMockAuthContext({
        tenantId: 'admin-tenant',
        groups: ['super_admin'],
      });

      expect(() => requireTenantAccess(auth, 'other-tenant')).not.toThrow();
    });

    it('should throw ForbiddenError for mismatched tenant', () => {
      const auth = createMockAuthContext({
        tenantId: 'tenant-456',
        groups: [],
      });

      expect(() => requireTenantAccess(auth, 'different-tenant')).toThrow('Access to tenant denied');
    });
  });

  describe('canAccessTenant', () => {
    it('should return true when tenant ID matches', () => {
      const auth = createMockAuthContext({
        tenantId: 'tenant-456',
      });

      expect(canAccessTenant(auth, 'tenant-456')).toBe(true);
    });

    it('should return true for super admin', () => {
      const auth = createMockAuthContext({
        tenantId: 'admin-tenant',
        groups: ['super_admin'],
      });

      expect(canAccessTenant(auth, 'any-tenant')).toBe(true);
    });

    it('should return false for mismatched tenant', () => {
      const auth = createMockAuthContext({
        tenantId: 'tenant-456',
        groups: [],
      });

      expect(canAccessTenant(auth, 'different-tenant')).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should pass for super_admin with any permission', () => {
      const auth = createMockAuthContext({
        role: 'super_admin',
      });

      expect(() => requirePermission(auth, 'admin:write')).not.toThrow();
      expect(() => requirePermission(auth, 'billing:read')).not.toThrow();
    });

    it('should pass for admin with admin:read permission', () => {
      const auth = createMockAuthContext({
        role: 'admin',
      });

      expect(() => requirePermission(auth, 'admin:read')).not.toThrow();
    });

    it('should throw ForbiddenError for missing permission', () => {
      const auth = createMockAuthContext({
        role: 'auditor',
      });

      expect(() => requirePermission(auth, 'deployments:write')).toThrow();
    });
  });
});
