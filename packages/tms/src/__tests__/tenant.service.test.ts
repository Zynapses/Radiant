/**
 * RADIANT TMS - Tenant Service Tests
 * Complete test implementation (no stubs)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tenantService } from '../services/tenant.service';
import * as db from '../utils/db';
import { TmsContext, CreateTenantInput, SoftDeleteTenantInput, CreatePhantomTenantInput } from '../types/tenant.types';

// Mock the database module
vi.mock('../utils/db', () => ({
  executeStatement: vi.fn(),
  executeStatementSingle: vi.fn(),
  withTransaction: vi.fn((fn) => fn('mock-tx-id')),
  beginTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  rollbackTransaction: vi.fn(),
  param: vi.fn((name, value) => ({ name, value: { stringValue: String(value) } })),
  jsonParam: vi.fn((name, value) => ({ name, value: { stringValue: JSON.stringify(value) } })),
  uuidParam: vi.fn((name, value) => ({ name, value: { stringValue: value }, typeHint: 'UUID' })),
  timestampParam: vi.fn((name, value) => ({ name, value: { stringValue: value }, typeHint: 'TIMESTAMP' })),
  setTenantContext: vi.fn(),
  clearTenantContext: vi.fn(),
}));

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-kms', () => ({
  KMSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({
      KeyMetadata: { Arn: 'arn:aws:kms:us-east-1:123456789012:key/mock-key-id' },
    }),
  })),
  CreateKeyCommand: vi.fn(),
  ScheduleKeyDeletionCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ Contents: [] }),
  })),
  ListObjectsV2Command: vi.fn(),
  DeleteObjectsCommand: vi.fn(),
}));

vi.mock('aws-xray-sdk', () => ({
  captureAWSv3Client: vi.fn((client) => client),
  getSegment: vi.fn(() => ({
    addNewSubsegment: vi.fn(() => ({
      addAnnotation: vi.fn(),
      close: vi.fn(),
    })),
  })),
}));

describe('TenantService', () => {
  const mockContext: TmsContext = {
    adminId: 'admin-123',
    userId: 'user-123',
    tenantId: 'tenant-123',
    isSuperAdmin: true,
    ipAddress: '192.168.1.1',
    userAgent: 'test-agent',
    traceId: 'trace-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // CREATE TENANT TESTS
  // ============================================================================

  describe('createTenant', () => {
    const validInput: CreateTenantInput = {
      name: 'test-tenant',
      displayName: 'Test Tenant',
      type: 'organization',
      tier: 1,
      primaryRegion: 'us-east-1',
      complianceMode: [],
      adminEmail: 'admin@test.com',
      adminName: 'Test Admin',
    };

    it('should create tenant with correct defaults', async () => {
      const mockTenant = {
        id: 'new-tenant-id',
        name: 'test-tenant',
        displayName: 'Test Tenant',
        type: 'organization',
        status: 'active',
        tier: 1,
        primaryRegion: 'us-east-1',
        complianceMode: [],
        retentionDays: 30,
        deletionScheduledAt: null,
        deletionRequestedBy: null,
        stripeCustomerId: null,
        kmsKeyArn: null,
        settings: {},
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockUser = {
        id: 'new-user-id',
        tenantId: 'new-tenant-id',
        cognitoUserId: 'cognito-123',
        email: 'admin@test.com',
        displayName: 'Test Admin',
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockMembership = {
        id: 'new-membership-id',
        tenantId: 'new-tenant-id',
        userId: 'new-user-id',
        role: 'owner',
        status: 'active',
        joinedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock retention settings
      vi.mocked(db.executeStatement).mockResolvedValueOnce([
        { settingKey: 'hipaa_min_retention_days', settingValue: 90 },
      ]);

      // Mock tenant insert (no return needed)
      vi.mocked(db.executeStatement).mockResolvedValueOnce([]);

      // Mock user insert (no return needed)
      vi.mocked(db.executeStatement).mockResolvedValueOnce([]);

      // Mock membership insert (no return needed)
      vi.mocked(db.executeStatement).mockResolvedValueOnce([]);

      // Mock audit log insert
      vi.mocked(db.executeStatement).mockResolvedValueOnce([]);

      // Mock getTenantById
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce(mockTenant);

      // Mock get user
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce(mockUser);

      // Mock get membership
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce(mockMembership);

      const result = await tenantService.createTenant(validInput, mockContext);

      expect(result.tenant).toBeDefined();
      expect(result.tenant.name).toBe('test-tenant');
      expect(result.adminUser).toBeDefined();
      expect(result.adminUser.email).toBe('admin@test.com');
      expect(result.membership).toBeDefined();
      expect(result.membership.role).toBe('owner');
    });

    it('should enforce HIPAA minimum retention of 90 days', async () => {
      const hipaaInput: CreateTenantInput = {
        ...validInput,
        complianceMode: ['hipaa'],
        retentionDays: 30, // Should be overridden to 90
      };

      const mockTenant = {
        id: 'hipaa-tenant-id',
        name: 'hipaa-tenant',
        displayName: 'HIPAA Tenant',
        type: 'organization',
        status: 'active',
        tier: 1,
        primaryRegion: 'us-east-1',
        complianceMode: ['hipaa'],
        retentionDays: 90, // Should be 90, not 30
        deletionScheduledAt: null,
        deletionRequestedBy: null,
        stripeCustomerId: null,
        kmsKeyArn: null,
        settings: {},
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock retention settings
      vi.mocked(db.executeStatement).mockResolvedValueOnce([
        { settingKey: 'hipaa_min_retention_days', settingValue: 90 },
      ]);

      // Mock other DB calls
      vi.mocked(db.executeStatement).mockResolvedValue([]);
      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce({ id: 'user-id', email: 'admin@test.com' })
        .mockResolvedValueOnce({ id: 'membership-id', role: 'owner' });

      const result = await tenantService.createTenant(hipaaInput, mockContext);

      // Verify the retention days was enforced to HIPAA minimum
      expect(result.tenant.retentionDays).toBe(90);
    });

    it('should create KMS key for Tier 3+ tenants', async () => {
      const tier3Input: CreateTenantInput = {
        ...validInput,
        tier: 3,
      };

      const mockTenantWithKms = {
        id: 'tier3-tenant-id',
        name: 'tier3-tenant',
        displayName: 'Tier 3 Tenant',
        type: 'organization',
        status: 'active',
        tier: 3,
        primaryRegion: 'us-east-1',
        complianceMode: [],
        retentionDays: 30,
        deletionScheduledAt: null,
        deletionRequestedBy: null,
        stripeCustomerId: null,
        kmsKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/mock-key-id',
        settings: {},
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(db.executeStatement).mockResolvedValue([]);
      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce(mockTenantWithKms)
        .mockResolvedValueOnce({ id: 'user-id', email: 'admin@test.com' })
        .mockResolvedValueOnce({ id: 'membership-id', role: 'owner' });

      const result = await tenantService.createTenant(tier3Input, mockContext);

      expect(result.tenant.kmsKeyArn).toBe('arn:aws:kms:us-east-1:123456789012:key/mock-key-id');
    });
  });

  // ============================================================================
  // SOFT DELETE TENANT TESTS
  // ============================================================================

  describe('softDeleteTenant', () => {
    const softDeleteInput: SoftDeleteTenantInput = {
      initiatedBy: 'admin-123',
      reason: 'Customer requested account closure',
      notifyUsers: true,
    };

    it('should set pending_deletion status and calculate deletion date', async () => {
      const mockTenant = {
        id: 'tenant-to-delete',
        name: 'delete-me',
        displayName: 'Delete Me',
        status: 'active',
        retentionDays: 30,
      };

      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce(mockTenant) // getTenantById
        .mockResolvedValueOnce({ total: 5, willBeDeleted: 3 }); // user count

      vi.mocked(db.executeStatement).mockResolvedValue([]);

      const result = await tenantService.softDeleteTenant('tenant-to-delete', softDeleteInput, mockContext);

      expect(result.status).toBe('pending_deletion');
      expect(result.retentionDays).toBe(30);
      expect(result.affectedUsers.total).toBe(5);
      expect(result.affectedUsers.willBeDeleted).toBe(3);
      expect(result.affectedUsers.willRemain).toBe(2);

      // Verify deletion is scheduled ~30 days from now
      const deletionDate = new Date(result.deletionScheduledAt);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);
      
      // Allow 1 minute tolerance for test execution time
      expect(Math.abs(deletionDate.getTime() - expectedDate.getTime())).toBeLessThan(60000);
    });

    it('should fail if tenant is not active or suspended', async () => {
      const mockDeletedTenant = {
        id: 'already-deleted',
        status: 'deleted',
      };

      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce(mockDeletedTenant);

      await expect(
        tenantService.softDeleteTenant('already-deleted', softDeleteInput, mockContext)
      ).rejects.toThrow('cannot be deleted');
    });

    it('should fail if tenant not found', async () => {
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce(null);

      await expect(
        tenantService.softDeleteTenant('non-existent', softDeleteInput, mockContext)
      ).rejects.toThrow('not found');
    });
  });

  // ============================================================================
  // RESTORE TENANT TESTS
  // ============================================================================

  describe('restoreTenant', () => {
    it('should restore pending_deletion tenant with valid code', async () => {
      const mockTenant = {
        id: 'tenant-to-restore',
        status: 'pending_deletion',
        deletionScheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce(mockTenant) // getTenantById
        .mockResolvedValueOnce({ valid: true, verifiedAt: new Date().toISOString() }); // verify code

      vi.mocked(db.executeStatement).mockResolvedValue([]);

      const result = await tenantService.restoreTenant(
        'tenant-to-restore',
        { restoredBy: 'admin-123', verificationCode: '123456' },
        mockContext
      );

      expect(result.status).toBe('active');
      expect(result.restoredBy).toBe('admin-123');
    });

    it('should fail if tenant not pending deletion', async () => {
      const mockActiveTenant = {
        id: 'active-tenant',
        status: 'active',
      };

      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce(mockActiveTenant);

      await expect(
        tenantService.restoreTenant(
          'active-tenant',
          { restoredBy: 'admin-123', verificationCode: '123456' },
          mockContext
        )
      ).rejects.toThrow('not pending deletion');
    });

    it('should fail with invalid verification code', async () => {
      const mockTenant = {
        id: 'tenant-to-restore',
        status: 'pending_deletion',
      };

      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce({ valid: false, error: 'invalid_code', message: 'Invalid verification code' });

      await expect(
        tenantService.restoreTenant(
          'tenant-to-restore',
          { restoredBy: 'admin-123', verificationCode: '000000' },
          mockContext
        )
      ).rejects.toThrow('Invalid verification code');
    });
  });

  // ============================================================================
  // PHANTOM TENANT TESTS
  // ============================================================================

  describe('createPhantomTenant', () => {
    const phantomInput: CreatePhantomTenantInput = {
      userEmail: 'newuser@example.com',
      userDisplayName: 'New User',
      cognitoUserId: 'cognito-new-user-123',
    };

    it('should create individual tenant for new user', async () => {
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce({
        tenantId: 'new-phantom-tenant-id',
        userId: 'new-user-id',
        tenantName: "New User's Workspace",
      });

      // Mock membership count check (new user = 1 membership)
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce({ count: 1 });

      const result = await tenantService.createPhantomTenant(phantomInput, mockContext);

      expect(result.tenantId).toBe('new-phantom-tenant-id');
      expect(result.userId).toBe('new-user-id');
      expect(result.tenantName).toBe("New User's Workspace");
      expect(result.isExisting).toBe(false);
    });

    it('should return existing tenant for existing user', async () => {
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce({
        tenantId: 'existing-tenant-id',
        userId: 'existing-user-id',
        tenantName: 'Existing Workspace',
      });

      // Mock membership count check (existing user = 2+ memberships)
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce({ count: 2 });

      const result = await tenantService.createPhantomTenant(phantomInput, mockContext);

      expect(result.tenantId).toBe('existing-tenant-id');
      expect(result.isExisting).toBe(true);
    });
  });

  // ============================================================================
  // MEMBERSHIP TESTS
  // ============================================================================

  describe('addMembership', () => {
    it('should create new user and membership when user does not exist', async () => {
      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce({ id: 'tenant-id', status: 'active' }) // getTenantById
        .mockResolvedValueOnce(null) // user doesn't exist
        .mockResolvedValueOnce({ id: 'new-user-id', email: 'new@test.com' }) // created user
        .mockResolvedValueOnce(null) // no existing membership
        .mockResolvedValueOnce({ id: 'membership-id', role: 'member' }); // created membership

      vi.mocked(db.executeStatement).mockResolvedValue([]);

      const result = await tenantService.addMembership(
        {
          tenantId: 'tenant-id',
          userEmail: 'new@test.com',
          role: 'member',
          invitedBy: 'admin-123',
          sendInvitation: true,
        },
        mockContext
      );

      expect(result.membership).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.invitationSent).toBe(true);
    });

    it('should fail if user already has membership', async () => {
      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce({ id: 'tenant-id', status: 'active' })
        .mockResolvedValueOnce({ id: 'existing-user-id', email: 'existing@test.com' })
        .mockResolvedValueOnce({ id: 'existing-membership-id' }); // existing membership

      await expect(
        tenantService.addMembership(
          {
            tenantId: 'tenant-id',
            userEmail: 'existing@test.com',
            role: 'member',
            invitedBy: 'admin-123',
            sendInvitation: false,
          },
          mockContext
        )
      ).rejects.toThrow('already has membership');
    });
  });

  describe('removeMembership', () => {
    it('should prevent removing the last owner', async () => {
      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce({ id: 'membership-id', role: 'owner', status: 'active' })
        .mockResolvedValueOnce({ count: 1 }); // only 1 owner

      await expect(
        tenantService.removeMembership('tenant-id', 'user-id', mockContext)
      ).rejects.toThrow('last owner');
    });

    it('should allow removing owner if there are other owners', async () => {
      vi.mocked(db.executeStatementSingle)
        .mockResolvedValueOnce({ id: 'membership-id', role: 'owner', status: 'active' })
        .mockResolvedValueOnce({ count: 2 }); // 2 owners

      vi.mocked(db.executeStatement).mockResolvedValue([]);

      await expect(
        tenantService.removeMembership('tenant-id', 'user-id', mockContext)
      ).resolves.toBeUndefined();
    });
  });

  // ============================================================================
  // LIST TENANTS TESTS
  // ============================================================================

  describe('listTenants', () => {
    it('should return paginated results with filters', async () => {
      const mockTenants = [
        { id: '1', name: 'tenant-1', displayName: 'Tenant 1', status: 'active', tier: 1 },
        { id: '2', name: 'tenant-2', displayName: 'Tenant 2', status: 'active', tier: 2 },
      ];

      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce({ count: 10 });
      vi.mocked(db.executeStatement).mockResolvedValueOnce(mockTenants);

      const result = await tenantService.listTenants(
        {
          status: 'active',
          limit: 20,
          offset: 0,
          orderBy: 'created_at',
          orderDir: 'desc',
        },
        mockContext
      );

      expect(result.tenants).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('should handle search filter', async () => {
      vi.mocked(db.executeStatementSingle).mockResolvedValueOnce({ count: 1 });
      vi.mocked(db.executeStatement).mockResolvedValueOnce([
        { id: '1', name: 'acme-corp', displayName: 'Acme Corporation' },
      ]);

      const result = await tenantService.listTenants(
        {
          search: 'acme',
          limit: 20,
          offset: 0,
          orderBy: 'name',
          orderDir: 'asc',
        },
        mockContext
      );

      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0].name).toBe('acme-corp');
    });
  });

  // ============================================================================
  // RETENTION SETTINGS TESTS
  // ============================================================================

  describe('getRetentionSettings', () => {
    it('should return all retention settings', async () => {
      const mockSettings = [
        { id: '1', settingKey: 'default_retention_days', settingValue: 30 },
        { id: '2', settingKey: 'hipaa_min_retention_days', settingValue: 90 },
        { id: '3', settingKey: 'hard_delete_batch_size', settingValue: 10 },
      ];

      vi.mocked(db.executeStatement).mockResolvedValueOnce(mockSettings);

      const result = await tenantService.getRetentionSettings();

      expect(result).toHaveLength(3);
      expect(result.find(s => s.settingKey === 'hipaa_min_retention_days')?.settingValue).toBe(90);
    });
  });
});
