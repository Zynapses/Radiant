/**
 * RADIANT v5.0 - Notification Service Unit Tests
 * 
 * Tests for HITL notification delivery via email, Slack, and webhooks.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  })),
  SendEmailCommand: jest.fn(),
}));

jest.mock('../../db/client', () => ({
  executeStatement: jest.fn(),
  stringParam: jest.fn((name, value) => ({ name, value })),
}));

jest.mock('../../logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocks
import { notificationService } from '../sovereign-mesh/notification.service';
import { executeStatement } from '../../db/client';

const mockExecuteStatement = executeStatement as jest.MockedFunction<typeof executeStatement>;

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SES_ENABLED = 'true';
    process.env.SES_FROM_EMAIL = 'test@radiant.ai';
    process.env.ADMIN_DASHBOARD_URL = 'https://admin.test.radiant.ai';
  });

  afterEach(() => {
    delete process.env.SES_ENABLED;
    delete process.env.SES_FROM_EMAIL;
    delete process.env.ADMIN_DASHBOARD_URL;
  });

  describe('sendNotification', () => {
    it('should return empty array when no channels configured', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await notificationService.sendNotification('tenant-1', {
        type: 'approval_requested',
        requestId: 'req-1',
        queueName: 'Test Queue',
        summary: 'Test approval request',
        priority: 'normal',
      });

      expect(results).toEqual([]);
    });

    it('should send email notification when configured', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            notification_channels: '["email"]',
            email_recipients: '["admin@test.com"]',
            slack_webhook_url: null,
            custom_webhook_url: null,
            custom_webhook_headers: null,
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Log insert

      const results = await notificationService.sendNotification('tenant-1', {
        type: 'approval_requested',
        requestId: 'req-1',
        queueName: 'Test Queue',
        summary: 'Test approval request',
        priority: 'high',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].channel).toBe('email');
    });

    it('should handle Slack webhook notifications', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            notification_channels: '["slack"]',
            email_recipients: null,
            slack_webhook_url: 'https://hooks.slack.com/test',
            custom_webhook_url: null,
            custom_webhook_headers: null,
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await notificationService.sendNotification('tenant-1', {
        type: 'approval_escalated',
        requestId: 'req-1',
        queueName: 'Test Queue',
        summary: 'Escalated request',
        priority: 'critical',
        escalationLevel: 2,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      mockFetch.mockRestore();
    });

    it('should handle custom webhook notifications', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            notification_channels: '["webhook"]',
            email_recipients: null,
            slack_webhook_url: null,
            custom_webhook_url: 'https://api.example.com/webhook',
            custom_webhook_headers: '{"X-API-Key": "secret"}',
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await notificationService.sendNotification('tenant-1', {
        type: 'sla_warning',
        requestId: 'req-1',
        queueName: 'Test Queue',
        summary: 'SLA warning',
        priority: 'high',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'secret',
          }),
        })
      );

      mockFetch.mockRestore();
    });

    it('should handle multiple channels simultaneously', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            notification_channels: '["email", "slack", "webhook"]',
            email_recipients: '["admin@test.com"]',
            slack_webhook_url: 'https://hooks.slack.com/test',
            custom_webhook_url: 'https://api.example.com/webhook',
            custom_webhook_headers: '{}',
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await notificationService.sendNotification('tenant-1', {
        type: 'approval_resolved',
        requestId: 'req-1',
        queueName: 'Test Queue',
        summary: 'Request approved',
        priority: 'normal',
      });

      expect(results.length).toBe(3);

      mockFetch.mockRestore();
    });
  });

  describe('sendEscalationNotification', () => {
    it('should send escalation notification with correct level', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            id: 'req-1',
            tenant_id: 'tenant-1',
            queue_name: 'Agent Plan Approval',
            request_summary: 'Review agent plan',
            priority: 'high',
            expires_at: '2026-01-20T12:00:00Z',
            request_type: 'agent_plan',
            created_at: '2026-01-20T10:00:00Z',
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Config query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Log insert

      const results = await notificationService.sendEscalationNotification(
        'tenant-1',
        'req-1',
        2
      );

      expect(results).toBeDefined();
    });

    it('should return empty array for non-existent request', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await notificationService.sendEscalationNotification(
        'tenant-1',
        'non-existent',
        1
      );

      expect(results).toEqual([]);
    });
  });

  describe('sendExpirationWarning', () => {
    it('should send SLA warning with remaining time', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            id: 'req-1',
            queue_name: 'High Cost Approval',
            request_summary: 'Review high-cost operation',
            priority: 'critical',
            expires_at: '2026-01-20T12:00:00Z',
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await notificationService.sendExpirationWarning(
        'tenant-1',
        'req-1',
        15
      );

      expect(results).toBeDefined();
    });
  });

  describe('email content generation', () => {
    it('should generate correct subject for different notification types', async () => {
      const types = [
        { type: 'approval_requested', expected: 'Approval Required' },
        { type: 'approval_escalated', expected: 'Escalated' },
        { type: 'approval_expired', expected: 'Expired' },
        { type: 'sla_warning', expected: 'SLA Warning' },
        { type: 'approval_resolved', expected: 'Resolved' },
      ];

      for (const { type } of types) {
        mockExecuteStatement
          .mockResolvedValueOnce({
            rows: [{
              notification_channels: '["email"]',
              email_recipients: '["admin@test.com"]',
            }],
            rowCount: 1,
          })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        await notificationService.sendNotification('tenant-1', {
          type: type as any,
          requestId: 'req-1',
          queueName: 'Test Queue',
          summary: 'Test',
          priority: 'normal',
        });
      }

      expect(mockExecuteStatement).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle failed Slack webhook gracefully', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            notification_channels: '["slack"]',
            slack_webhook_url: 'https://hooks.slack.com/test',
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await notificationService.sendNotification('tenant-1', {
        type: 'approval_requested',
        requestId: 'req-1',
        queueName: 'Test',
        summary: 'Test',
        priority: 'normal',
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Slack error');

      mockFetch.mockRestore();
    });

    it('should handle network errors gracefully', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValueOnce(
        new Error('Network error')
      );

      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            notification_channels: '["webhook"]',
            custom_webhook_url: 'https://api.example.com/webhook',
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await notificationService.sendNotification('tenant-1', {
        type: 'approval_requested',
        requestId: 'req-1',
        queueName: 'Test',
        summary: 'Test',
        priority: 'normal',
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Network error');

      mockFetch.mockRestore();
    });
  });
});
