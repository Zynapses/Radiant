/**
 * Unit tests for User Registry Service
 * 
 * Tests user-application assignments, consent management, DSAR processing,
 * break glass access, and legal hold operations.
 */

// Jest globals are automatically available via ts-jest
import { PoolClient } from 'pg';

// Mock types
type MockQuery = ReturnType<typeof jest.fn><Promise<{ rows: unknown[]; rowCount: number }>>;

// Create mock pool client
const createMockClient = (): { query: MockQuery } & Partial<PoolClient> => ({
  query: jest.fn() as MockQuery,
});

// Mock db-context service
jest.mock('../lambda/shared/services/db-context.service', () => ({
  withSecureDBContext: jest.fn((fn) => fn),
  isRadiantAdmin: jest.fn((ctx) => ctx.permissionLevel === 'radiant_admin'),
  isTenantAdmin: jest.fn((ctx) => ['radiant_admin', 'tenant_admin'].includes(ctx.permissionLevel)),
}));

describe('UserRegistryService', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let userRegistryService: typeof import('../lambda/shared/services/user-registry.service');

  const mockAuthContext = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    appId: 'thinktank',
    permissionLevel: 'tenant_admin' as const,
    jurisdiction: 'US',
    dataRegion: 'us-east-1',
    isBreakGlass: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockClient = createMockClient();
    
    // Import service
    userRegistryService = await import('../lambda/shared/services/user-registry.service');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // USER APPLICATION ASSIGNMENTS
  // ==========================================================================

  describe('assignUserToApp', () => {
    it('should assign a user to an application', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        user_id: 'user-789',
        app_id: 'thinktank',
        tenant_id: 'tenant-123',
        assignment_type: 'standard',
        app_permissions: {},
        granted_by: 'user-456',
        granted_at: new Date(),
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockAssignment],
        rowCount: 1,
      });

      const result = await userRegistryService.assignUserToApp(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        { userId: 'user-789', appId: 'thinktank' }
      );

      expect(result).toEqual(mockAssignment);
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_application_assignments'),
        expect.arrayContaining(['user-789', 'thinktank', 'tenant-123'])
      );
    });

    it('should handle assignment with custom permissions', async () => {
      const mockAssignment = {
        id: 'assignment-2',
        user_id: 'user-789',
        app_id: 'thinktank',
        tenant_id: 'tenant-123',
        assignment_type: 'admin',
        app_permissions: { canManageUsers: true },
        granted_by: 'user-456',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockAssignment],
        rowCount: 1,
      });

      const result = await userRegistryService.assignUserToApp(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          userId: 'user-789',
          appId: 'thinktank',
          assignmentType: 'admin',
          appPermissions: { canManageUsers: true },
        }
      );

      expect(result.assignment_type).toBe('admin');
      expect(result.app_permissions).toEqual({ canManageUsers: true });
    });

    it('should handle assignment with expiration', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const mockAssignment = {
        id: 'assignment-3',
        user_id: 'user-789',
        app_id: 'thinktank',
        expires_at: expiresAt,
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockAssignment],
        rowCount: 1,
      });

      const result = await userRegistryService.assignUserToApp(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        { userId: 'user-789', appId: 'thinktank', expiresAt }
      );

      expect(result.expires_at).toEqual(expiresAt);
    });
  });

  describe('revokeUserFromApp', () => {
    it('should revoke user assignment', async () => {
      const mockRevoked = {
        id: 'assignment-1',
        user_id: 'user-789',
        app_id: 'thinktank',
        revoked_at: new Date(),
        revoked_by: 'user-456',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockRevoked],
        rowCount: 1,
      });

      const result = await userRegistryService.revokeUserFromApp(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        { userId: 'user-789', appId: 'thinktank' }
      );

      expect(result).toEqual(mockRevoked);
      expect(result?.revoked_by).toBe('user-456');
    });

    it('should return null if assignment not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await userRegistryService.revokeUserFromApp(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        { userId: 'user-789', appId: 'nonexistent' }
      );

      expect(result).toBeNull();
    });
  });

  describe('getUserAssignments', () => {
    it('should return active assignments for a user', async () => {
      const mockAssignments = [
        { id: 'a1', app_id: 'thinktank', assignment_type: 'standard' },
        { id: 'a2', app_id: 'dashboard', assignment_type: 'admin' },
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockAssignments,
        rowCount: 2,
      });

      const result = await userRegistryService.getUserAssignments(
        mockClient as unknown as PoolClient,
        'user-789'
      );

      expect(result).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND revoked_at IS NULL'),
        ['user-789']
      );
    });

    it('should return empty array if no assignments', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await userRegistryService.getUserAssignments(
        mockClient as unknown as PoolClient,
        'user-new'
      );

      expect(result).toEqual([]);
    });
  });

  describe('getAppUsers', () => {
    it('should return users assigned to an app', async () => {
      const mockUsers = [
        { user_id: 'u1', email: 'user1@test.com', assignment_type: 'standard' },
        { user_id: 'u2', email: 'user2@test.com', assignment_type: 'admin' },
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockUsers,
        rowCount: 2,
      });

      const result = await userRegistryService.getAppUsers(
        mockClient as unknown as PoolClient,
        'thinktank'
      );

      expect(result).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN users u ON u.id = uaa.user_id'),
        ['thinktank']
      );
    });
  });

  // ==========================================================================
  // CONSENT MANAGEMENT
  // ==========================================================================

  describe('recordConsent', () => {
    it('should record user consent', async () => {
      const mockConsent = {
        id: 'consent-1',
        user_id: 'user-789',
        purpose_code: 'marketing',
        consent_given: true,
        lawful_basis: 'consent',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockConsent],
        rowCount: 1,
      });

      const result = await userRegistryService.recordConsent(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          userId: 'user-789',
          jurisdiction: 'US',
          purposeCode: 'marketing',
          purposeDescription: 'Marketing emails',
          lawfulBasis: 'consent',
          consentGiven: true,
          consentVersion: '1.0',
          consentMethod: 'explicit_checkbox',
          consentLanguage: 'en',
        }
      );

      expect(result.consent_given).toBe(true);
      expect(result.purpose_code).toBe('marketing');
    });

    it('should record GDPR consent with third party sharing', async () => {
      const mockConsent = {
        id: 'consent-2',
        third_party_sharing_authorized: true,
        authorized_third_parties: ['partner1', 'partner2'],
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockConsent],
        rowCount: 1,
      });

      const result = await userRegistryService.recordConsent(
        mockClient as unknown as PoolClient,
        { ...mockAuthContext, jurisdiction: 'EU' },
        {
          userId: 'user-789',
          jurisdiction: 'EU',
          purposeCode: 'analytics',
          purposeDescription: 'Analytics tracking',
          lawfulBasis: 'consent',
          consentGiven: true,
          consentVersion: '2.0',
          consentMethod: 'double_opt_in',
          consentLanguage: 'en',
          thirdPartySharingAuthorized: true,
          authorizedThirdParties: ['partner1', 'partner2'],
        }
      );

      expect(result.third_party_sharing_authorized).toBe(true);
    });

    it('should record COPPA consent with parent verification', async () => {
      const mockConsent = {
        id: 'consent-3',
        parent_guardian_id: 'parent-123',
        verification_method: 'credit_card',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockConsent],
        rowCount: 1,
      });

      const result = await userRegistryService.recordConsent(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          userId: 'child-user',
          jurisdiction: 'US',
          purposeCode: 'service_usage',
          purposeDescription: 'Basic service access',
          lawfulBasis: 'consent',
          consentGiven: true,
          consentVersion: '1.0',
          consentMethod: 'verified_parent',
          consentLanguage: 'en',
          parentGuardianId: 'parent-123',
          verificationMethod: 'credit_card',
        }
      );

      expect(result.parent_guardian_id).toBe('parent-123');
    });
  });

  describe('getUserConsents', () => {
    it('should return all consents for a user', async () => {
      const mockConsents = [
        { purpose_code: 'marketing', consent_given: true },
        { purpose_code: 'analytics', consent_given: false },
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockConsents,
        rowCount: 2,
      });

      const result = await userRegistryService.getUserConsents(
        mockClient as unknown as PoolClient,
        'user-789'
      );

      expect(result).toHaveLength(2);
    });
  });

  // ==========================================================================
  // BREAK GLASS ACCESS
  // ==========================================================================

  describe('initiateBreakGlass', () => {
    it('should initiate break glass access for radiant admin', async () => {
      const radiantAdminContext = {
        ...mockAuthContext,
        permissionLevel: 'radiant_admin' as const,
      };

      const mockBreakGlass = {
        id: 'bg-1',
        tenant_id: 'tenant-123',
        initiated_by: 'user-456',
        access_reason: 'Critical security incident',
        incident_ticket: 'INC-001',
        started_at: new Date(),
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockBreakGlass],
        rowCount: 1,
      });

      const result = await userRegistryService.initiateBreakGlass(
        mockClient as unknown as PoolClient,
        radiantAdminContext,
        {
          tenantId: 'tenant-123',
          accessReason: 'Critical security incident',
          incidentTicket: 'INC-001',
        }
      );

      expect(result.success).toBe(true);
      expect(result.accessId).toBeDefined();
    });

    it('should reject break glass for non-radiant admin', async () => {
      await expect(
        userRegistryService.initiateBreakGlass(
          mockClient as unknown as PoolClient,
          mockAuthContext, // tenant_admin, not radiant_admin
          {
            tenantId: 'tenant-123',
            accessReason: 'Trying to access',
          }
        )
      ).rejects.toThrow();
    });
  });

  describe('endBreakGlass', () => {
    it('should end break glass access', async () => {
      const radiantAdminContext = {
        ...mockAuthContext,
        permissionLevel: 'radiant_admin' as const,
      };

      const mockEnded = {
        id: 'bg-1',
        ended_at: new Date(),
        actions_taken: { reviewed: true },
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockEnded],
        rowCount: 1,
      });

      const result = await userRegistryService.endBreakGlass(
        mockClient as unknown as PoolClient,
        radiantAdminContext,
        {
          accessId: 'bg-1',
          actionsTaken: { reviewed: true },
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getActiveBreakGlassSessions', () => {
    it('should return active break glass sessions', async () => {
      const mockSessions = [
        { id: 'bg-1', tenant_id: 'tenant-123', started_at: new Date() },
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockSessions,
        rowCount: 1,
      });

      const result = await userRegistryService.getActiveBreakGlassSessions(
        mockClient as unknown as PoolClient
      );

      expect(result).toHaveLength(1);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ended_at IS NULL'),
        []
      );
    });
  });

  // ==========================================================================
  // LEGAL HOLD
  // ==========================================================================

  describe('applyLegalHold', () => {
    it('should apply legal hold to user data', async () => {
      const mockHold = {
        id: 'hold-1',
        user_id: 'user-789',
        hold_reason: 'Litigation pending',
        case_id: 'CASE-001',
        applied_by: 'user-456',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockHold],
        rowCount: 1,
      });

      const result = await userRegistryService.applyLegalHold(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          userId: 'user-789',
          reason: 'Litigation pending',
          caseId: 'CASE-001',
        }
      );

      expect(result.success).toBe(true);
      expect(result.holdId).toBeDefined();
    });
  });

  describe('releaseLegalHold', () => {
    it('should release legal hold', async () => {
      const mockReleased = {
        id: 'hold-1',
        released_at: new Date(),
        released_by: 'user-456',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockReleased],
        rowCount: 1,
      });

      const result = await userRegistryService.releaseLegalHold(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          holdId: 'hold-1',
          releaseReason: 'Case settled',
        }
      );

      expect(result.success).toBe(true);
    });

    it('should return failure if hold not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await userRegistryService.releaseLegalHold(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          holdId: 'nonexistent',
          releaseReason: 'Case settled',
        }
      );

      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // DSAR PROCESSING
  // ==========================================================================

  describe('processDSAR', () => {
    it('should process access request', async () => {
      const mockDSAR = {
        success: true,
        requestId: 'dsar-1',
        user_id: 'user-789',
        request_type: 'access',
        status: 'pending',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockDSAR],
        rowCount: 1,
      });

      const result = await userRegistryService.processDSAR(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          userId: 'user-789',
          requestType: 'access',
        }
      );

      expect(result.success).toBe(true);
    });

    it('should process deletion request', async () => {
      const mockDSAR = {
        success: true,
        requestId: 'dsar-2',
        user_id: 'user-789',
        request_type: 'delete',
        status: 'pending',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockDSAR],
        rowCount: 1,
      });

      const result = await userRegistryService.processDSAR(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          userId: 'user-789',
          requestType: 'delete',
        }
      );

      expect(result.success).toBe(true);
    });

    it('should process portability request', async () => {
      const mockDSAR = {
        success: true,
        requestId: 'dsar-3',
        user_id: 'user-789',
        request_type: 'portability',
        status: 'pending',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockDSAR],
        rowCount: 1,
      });

      const result = await userRegistryService.processDSAR(
        mockClient as unknown as PoolClient,
        mockAuthContext,
        {
          userId: 'user-789',
          requestType: 'portability',
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getDSARRequests', () => {
    it('should return DSAR requests with optional status filter', async () => {
      const mockRequests = [
        { id: 'dsar-1', status: 'pending' },
        { id: 'dsar-2', status: 'completed' },
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockRequests,
        rowCount: 2,
      });

      const result = await userRegistryService.getDSARRequests(
        mockClient as unknown as PoolClient,
        mockAuthContext.tenantId
      );

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockRequests = [
        { id: 'dsar-1', status: 'pending' },
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockRequests,
        rowCount: 1,
      });

      const result = await userRegistryService.getDSARRequests(
        mockClient as unknown as PoolClient,
        mockAuthContext.tenantId,
        'pending'
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });
  });

  // ==========================================================================
  // CROSS-BORDER TRANSFER
  // ==========================================================================

  describe('checkCrossBorderTransfer', () => {
    it('should allow same region transfer', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ jurisdiction: 'US', data_region: 'us-east-1' }],
        rowCount: 1,
      });

      const result = await userRegistryService.checkCrossBorderTransfer(
        mockClient as unknown as PoolClient,
        'user-789',
        'us-east-1'
      );

      expect(result.allowed).toBe(true);
      expect(result.mechanism).toBe('same_region');
    });

    it('should check EU adequacy for cross-border transfer', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ jurisdiction: 'EU', data_region: 'eu-west-1' }],
        rowCount: 1,
      });

      const result = await userRegistryService.checkCrossBorderTransfer(
        mockClient as unknown as PoolClient,
        'user-789',
        'us-east-1'
      );

      // EU to US requires additional mechanisms
      expect(result.allowed).toBeDefined();
      expect(result.mechanism).toBeDefined();
    });
  });

  // ==========================================================================
  // CREDENTIAL ROTATION
  // ==========================================================================

  describe('rotateAppSecret', () => {
    it('should rotate application secret', async () => {
      const mockRotation = {
        app_id: 'thinktank',
        secret_rotation_at: new Date(),
        secret_rotation_window_hours: 24,
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockRotation],
        rowCount: 1,
      });

      const result = await userRegistryService.rotateAppSecret(
        mockClient as unknown as PoolClient,
        'thinktank',
        'new-secret-hash',
        24
      );

      expect(result.success).toBe(true);
      expect(result.rotationWindowHours).toBe(24);
    });
  });

  describe('verifyAppCredentials', () => {
    it('should verify valid credentials', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ verify_app_credentials: true }],
        rowCount: 1,
      });

      const result = await userRegistryService.verifyAppCredentials(
        mockClient as unknown as PoolClient,
        'thinktank',
        'valid-secret'
      );

      expect(result).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ verify_app_credentials: false }],
        rowCount: 1,
      });

      const result = await userRegistryService.verifyAppCredentials(
        mockClient as unknown as PoolClient,
        'thinktank',
        'invalid-secret'
      );

      expect(result).toBe(false);
    });

    it('should return false when no rows returned', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await userRegistryService.verifyAppCredentials(
        mockClient as unknown as PoolClient,
        'nonexistent-app',
        'secret'
      );

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  describe('getUserRegistryDashboard', () => {
    it('should return dashboard statistics', async () => {
      // Mock the parallel queries for dashboard data
      mockClient.query
        .mockResolvedValueOnce({ 
          rows: [{
            total_users: '100',
            active_users: '85',
            total_apps: '5',
            active_apps: '4',
            total_assignments: '150',
            active_consents: '45',
            pending_dsars: '3',
            active_legal_holds: '1',
          }], 
          rowCount: 1 
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recent assignments
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recent consents
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recent DSARs
        .mockResolvedValueOnce({ 
          rows: [{ 
            data_region: 'us-east-1', 
            allowed_regions: ['us-east-1'], 
            compliance_frameworks: ['GDPR', 'CCPA'] 
          }], 
          rowCount: 1 
        }); // tenant info

      const result = await userRegistryService.getUserRegistryDashboard(
        mockClient as unknown as PoolClient,
        mockAuthContext.tenantId
      );

      expect(result.stats.totalAssignments).toBe(150);
      expect(result.stats.activeConsents).toBe(45);
      expect(result.stats.pendingDSARs).toBe(3);
      expect(result.stats.activeLegalHolds).toBe(1);
      expect(result.complianceStatus.gdprCompliant).toBe(true);
    });
  });
});
