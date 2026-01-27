/**
 * CATO Pipeline Orchestrator Service Tests
 * Critical orchestration service - manages AI pipeline execution
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

import { executeStatement } from '../../db/client';

const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

describe('CatoPipelineOrchestratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executePipeline', () => {
    it('should execute a pipeline with all methods', async () => {
      // Pipeline config
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'pipeline-1',
          name: 'Standard Pipeline',
          methods: ['scout', 'observer', 'critic', 'synthesis'],
          is_active: true,
        }],
      });
      // Pipeline execution log
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'exec-123' }],
      });

      const { catoPipelineOrchestratorService } = await import('../cato-pipeline-orchestrator.service');
      
      const result = await catoPipelineOrchestratorService.execute({
        tenantId: 'tenant-1',
        pipelineId: 'pipeline-1',
        input: { prompt: 'Test query' },
      });
      
      expect(result).toHaveProperty('executionId');
    });
  });

  describe('checkpoint management', () => {
    it('should create checkpoint for HITL pause', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'checkpoint-1',
          execution_id: 'exec-123',
          step_index: 2,
          state: 'paused',
        }],
      });

      const { catoPipelineOrchestratorService } = await import('../cato-pipeline-orchestrator.service');
      
      const checkpoint = await catoPipelineOrchestratorService.createCheckpoint({
        executionId: 'exec-123',
        stepIndex: 2,
        reason: 'Human approval required',
      });
      
      expect(checkpoint).toHaveProperty('id');
    });

    it('should resume from checkpoint', async () => {
      // Get checkpoint
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'checkpoint-1',
          execution_id: 'exec-123',
          step_index: 2,
          remaining_methods: ['critic', 'synthesis'],
          state: 'approved',
        }],
      });
      // Update checkpoint status
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { catoPipelineOrchestratorService } = await import('../cato-pipeline-orchestrator.service');
      
      const result = await catoPipelineOrchestratorService.resumeFromCheckpoint('checkpoint-1');
      
      expect(result).toHaveProperty('resumed', true);
    });
  });

  describe('pipeline configuration', () => {
    it('should get pipeline by ID', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'pipeline-1',
          name: 'Standard Pipeline',
          methods: ['scout', 'observer', 'critic'],
        }],
      });

      const { catoPipelineOrchestratorService } = await import('../cato-pipeline-orchestrator.service');
      
      const pipeline = await catoPipelineOrchestratorService.getPipeline('tenant-1', 'pipeline-1');
      
      expect(pipeline).not.toBeNull();
      expect(pipeline?.name).toBe('Standard Pipeline');
    });

    it('should list available pipelines', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { id: 'pipeline-1', name: 'Standard' },
          { id: 'pipeline-2', name: 'Research' },
        ],
      });

      const { catoPipelineOrchestratorService } = await import('../cato-pipeline-orchestrator.service');
      
      const pipelines = await catoPipelineOrchestratorService.listPipelines('tenant-1');
      
      expect(pipelines).toHaveLength(2);
    });
  });
});
