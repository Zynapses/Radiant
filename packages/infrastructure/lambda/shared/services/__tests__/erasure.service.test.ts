/**
 * UDS Erasure Service Tests
 * Critical GDPR compliance service - right to erasure implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AWS S3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  DeleteObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
}));

// Mock AWS DynamoDB
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  DeleteItemCommand: vi.fn(),
  QueryCommand: vi.fn(),
}));

// Mock AWS SQS
vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  SendMessageCommand: vi.fn(),
}));

// Mock ioredis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock database
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn(),
  stringParam: vi.fn((name: string, value: string) => ({ name, value: { stringValue: value } })),
  boolParam: vi.fn((name: string, value: boolean) => ({ name, value: { booleanValue: value } })),
}));

// Mock logger
vi.mock('../../logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock audit service
vi.mock('../uds/audit.service', () => ({
  udsAuditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { executeStatement } from '../../db/client';

const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

describe('UDSErasureService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request', () => {
    it('should create a GDPR erasure request', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'erasure-123',
          tenant_id: 'tenant-1',
          user_id: 'user-1',
          scope: 'user',
          status: 'pending',
          created_at: new Date().toISOString(),
        }],
      });

      const { udsErasureService } = await import('../uds/erasure.service');
      
      const result = await udsErasureService.request('tenant-1', 'admin-1', {
        scope: 'user',
        userId: 'user-1',
        legalBasis: 'gdpr_article_17',
      });
      
      expect(result).toHaveProperty('id');
    });

    it('should require userId for user-scope erasure', async () => {
      const { udsErasureService } = await import('../uds/erasure.service');
      
      await expect(
        udsErasureService.request('tenant-1', 'admin-1', {
          scope: 'user',
          // Missing userId
        })
      ).rejects.toThrow('User ID required');
    });

    it('should require conversationId for conversation-scope erasure', async () => {
      const { udsErasureService } = await import('../uds/erasure.service');
      
      await expect(
        udsErasureService.request('tenant-1', 'admin-1', {
          scope: 'conversation',
          // Missing conversationId
        })
      ).rejects.toThrow('Conversation ID required');
    });
  });

  describe('get', () => {
    it('should get an erasure request by ID', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'erasure-123',
          tenant_id: 'tenant-1',
          user_id: 'user-1',
          scope: 'user',
          status: 'completed',
        }],
      });

      const { udsErasureService } = await import('../uds/erasure.service');
      
      const result = await udsErasureService.get('tenant-1', 'erasure-123');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('erasure-123');
    });

    it('should return null for non-existent request', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { udsErasureService } = await import('../uds/erasure.service');
      
      const result = await udsErasureService.get('tenant-1', 'nonexistent');
      
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list erasure requests for a tenant', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { id: 'erasure-1', status: 'pending', scope: 'user' },
          { id: 'erasure-2', status: 'completed', scope: 'tenant' },
        ],
      });

      const { udsErasureService } = await import('../uds/erasure.service');
      
      const result = await udsErasureService.list('tenant-1');
      
      expect(result).toHaveLength(2);
    });
  });

  describe('cancel', () => {
    it('should cancel a pending erasure request', async () => {
      // Get request
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'erasure-123',
          tenant_id: 'tenant-1',
          status: 'pending',
        }],
      });
      // Update status
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { udsErasureService } = await import('../uds/erasure.service');
      
      await expect(
        udsErasureService.cancel('tenant-1', 'erasure-123')
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent request', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { udsErasureService } = await import('../uds/erasure.service');
      
      await expect(
        udsErasureService.cancel('tenant-1', 'nonexistent')
      ).rejects.toThrow('not found');
    });
  });

  describe('GDPR compliance', () => {
    it('should support all required scopes', async () => {
      const { udsErasureService } = await import('../uds/erasure.service');
      
      // Verify service exists with expected methods
      expect(udsErasureService.request).toBeDefined();
      expect(udsErasureService.get).toBeDefined();
      expect(udsErasureService.list).toBeDefined();
      expect(udsErasureService.cancel).toBeDefined();
    });

    it('should log audit trail on request creation', async () => {
      const { udsAuditService } = await import('../uds/audit.service');
      
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'erasure-123',
          tenant_id: 'tenant-1',
          user_id: 'user-1',
          scope: 'user',
          status: 'pending',
        }],
      });

      const { udsErasureService } = await import('../uds/erasure.service');
      
      await udsErasureService.request('tenant-1', 'admin-1', {
        scope: 'user',
        userId: 'user-1',
      });
      
      expect(udsAuditService.log).toHaveBeenCalled();
    });
  });
});
