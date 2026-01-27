/**
 * Model Router Service Tests
 * Critical routing service - selects models based on task type and context
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn(),
  stringParam: vi.fn((name: string, value: string) => ({ name, value: { stringValue: value } })),
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

// Mock Redis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  })),
}));

import { executeStatement } from '../../db/client';

const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

describe('ModelRouterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invoke', () => {
    it('should route to specified model', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'model-claude-3',
          model_id: 'claude-3-5-sonnet',
          provider: 'anthropic',
          endpoint: 'https://api.anthropic.com/v1/messages',
          is_active: true,
        }],
      });

      const { modelRouterService } = await import('../model-router.service');
      
      const result = await modelRouterService.invoke({
        tenantId: 'tenant-1',
        modelId: 'claude-3-5-sonnet',
        prompt: 'Hello, world!',
        maxTokens: 100,
      });
      
      expect(result).toBeDefined();
    });

    it('should handle model not found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { modelRouterService } = await import('../model-router.service');
      
      await expect(
        modelRouterService.invoke({
          tenantId: 'tenant-1',
          modelId: 'nonexistent-model',
          prompt: 'Hello',
        })
      ).rejects.toThrow();
    });
  });

  describe('getAvailableModels', () => {
    it('should return all active models for tenant', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { id: 'model-1', model_id: 'gpt-4', provider: 'openai', is_active: true },
          { id: 'model-2', model_id: 'claude-3', provider: 'anthropic', is_active: true },
        ],
      });

      const { modelRouterService } = await import('../model-router.service');
      
      const models = await modelRouterService.getAvailableModels('tenant-1');
      
      expect(models).toHaveLength(2);
    });

    it('should filter by provider', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { id: 'model-1', model_id: 'gpt-4', provider: 'openai', is_active: true },
        ],
      });

      const { modelRouterService } = await import('../model-router.service');
      
      const models = await modelRouterService.getAvailableModels('tenant-1', { provider: 'openai' });
      
      expect(models.every(m => m.provider === 'openai')).toBe(true);
    });
  });

  describe('routing logic', () => {
    it('should respect tenant model restrictions', async () => {
      // Tenant config
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          tenant_id: 'tenant-1',
          allowed_models: ['gpt-4', 'claude-3'],
        }],
      });
      // Model lookup
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'model-1',
          model_id: 'gpt-4',
          provider: 'openai',
          is_active: true,
        }],
      });

      const { modelRouterService } = await import('../model-router.service');
      
      // Should work with allowed model
      const result = await modelRouterService.invoke({
        tenantId: 'tenant-1',
        modelId: 'gpt-4',
        prompt: 'Test',
      });
      
      expect(result).toBeDefined();
    });
  });
});
