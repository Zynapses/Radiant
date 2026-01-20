/**
 * RADIANT v5.0 - Snapshot Capture Service Unit Tests
 * 
 * Tests for execution state snapshot capture and replay functionality.
 */

// Mock dependencies
jest.mock('../../db/client', () => ({
  executeStatement: jest.fn(),
  stringParam: jest.fn((name: string, value: string) => ({ name, value })),
  longParam: jest.fn((name: string, value: number) => ({ name, value })),
  doubleParam: jest.fn((name: string, value: number) => ({ name, value })),
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
import { snapshotCaptureService } from '../sovereign-mesh/snapshot-capture.service';
import { executeStatement } from '../../db/client';

const mockExecuteStatement = executeStatement as jest.MockedFunction<typeof executeStatement>;

describe('SnapshotCaptureService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('captureSnapshot', () => {
    it('should capture a snapshot and return the ID', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'snapshot-123' }],
        rowCount: 1,
      });

      const snapshotId = await snapshotCaptureService.captureSnapshot({
        executionId: 'exec-1',
        tenantId: 'tenant-1',
        stepNumber: 1,
        stepType: 'observe',
        inputState: { goal: 'test goal' },
        outputState: { result: 'success' },
      });

      expect(snapshotId).toBe('snapshot-123');
      expect(mockExecuteStatement).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_snapshots'),
        expect.any(Array)
      );
    });

    it('should include optional fields when provided', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'snapshot-456' }],
        rowCount: 1,
      });

      const snapshotId = await snapshotCaptureService.captureSnapshot({
        executionId: 'exec-1',
        tenantId: 'tenant-1',
        stepNumber: 2,
        stepType: 'decide',
        inputState: { options: ['a', 'b'] },
        outputState: { selected: 'a' },
        internalState: { confidence: 0.95 },
        modelId: 'gpt-4o',
        governorState: { precision: 0.8 },
        cbfEvaluation: { passed: true },
        costUsd: 0.005,
        tokensUsed: 1500,
        latencyMs: 250,
        metadata: { phase: 'decide' },
      });

      expect(snapshotId).toBe('snapshot-456');
    });

    it('should throw error on database failure', async () => {
      mockExecuteStatement.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        snapshotCaptureService.captureSnapshot({
          executionId: 'exec-1',
          tenantId: 'tenant-1',
          stepNumber: 1,
          stepType: 'observe',
          inputState: {},
          outputState: {},
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('getSnapshots', () => {
    it('should return all snapshots for an execution', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          {
            id: 'snap-1',
            execution_id: 'exec-1',
            step_number: 0,
            step_type: 'start',
            input_state: '{}',
            output_state: '{}',
            internal_state: '{}',
            model_id: null,
            governor_state: '{}',
            cbf_evaluation: '{}',
            cost_usd: '0',
            tokens_used: 0,
            latency_ms: 10,
            captured_at: '2026-01-20T10:00:00Z',
          },
          {
            id: 'snap-2',
            execution_id: 'exec-1',
            step_number: 1,
            step_type: 'observe',
            input_state: '{"goal": "test"}',
            output_state: '{"observed": true}',
            internal_state: '{}',
            model_id: 'gpt-4o',
            governor_state: '{"precision": 0.9}',
            cbf_evaluation: '{"passed": true}',
            cost_usd: '0.01',
            tokens_used: 500,
            latency_ms: 150,
            captured_at: '2026-01-20T10:01:00Z',
          },
        ],
        rowCount: 2,
      });

      const snapshots = await snapshotCaptureService.getSnapshots('exec-1');

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].stepNumber).toBe(0);
      expect(snapshots[1].stepNumber).toBe(1);
      expect(snapshots[1].modelId).toBe('gpt-4o');
    });

    it('should return empty array for execution with no snapshots', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const snapshots = await snapshotCaptureService.getSnapshots('non-existent');

      expect(snapshots).toEqual([]);
    });
  });

  describe('getSnapshot', () => {
    it('should return a specific snapshot by ID', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'snap-1',
          execution_id: 'exec-1',
          step_number: 1,
          step_type: 'observe',
          input_state: '{}',
          output_state: '{}',
          internal_state: '{}',
          model_id: 'gpt-4o',
          governor_state: '{}',
          cbf_evaluation: '{}',
          cost_usd: '0.01',
          tokens_used: 500,
          latency_ms: 150,
          captured_at: '2026-01-20T10:00:00Z',
        }],
        rowCount: 1,
      });

      const snapshot = await snapshotCaptureService.getSnapshot('snap-1');

      expect(snapshot).not.toBeNull();
      expect(snapshot?.id).toBe('snap-1');
      expect(snapshot?.modelId).toBe('gpt-4o');
    });

    it('should return null for non-existent snapshot', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const snapshot = await snapshotCaptureService.getSnapshot('non-existent');

      expect(snapshot).toBeNull();
    });
  });

  describe('getSnapshotAtStep', () => {
    it('should return snapshot at specific step number', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'snap-3',
          execution_id: 'exec-1',
          step_number: 3,
          step_type: 'act',
          input_state: '{}',
          output_state: '{}',
          internal_state: '{}',
          model_id: null,
          governor_state: '{}',
          cbf_evaluation: '{}',
          cost_usd: '0',
          tokens_used: 0,
          latency_ms: 50,
          captured_at: '2026-01-20T10:03:00Z',
        }],
        rowCount: 1,
      });

      const snapshot = await snapshotCaptureService.getSnapshotAtStep('exec-1', 3);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.stepNumber).toBe(3);
      expect(snapshot?.stepType).toBe('act');
    });
  });

  describe('createReplaySession', () => {
    it('should create a full replay session', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'replay-1' }],
        rowCount: 1,
      });

      const sessionId = await snapshotCaptureService.createReplaySession(
        'exec-1',
        'tenant-1',
        'user-1',
        { mode: 'full' }
      );

      expect(sessionId).toBe('replay-1');
      expect(mockExecuteStatement).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO replay_sessions'),
        expect.any(Array)
      );
    });

    it('should create a from-step replay session', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'replay-2' }],
        rowCount: 1,
      });

      const sessionId = await snapshotCaptureService.createReplaySession(
        'exec-1',
        'tenant-1',
        'user-1',
        { mode: 'from_step', startFromStep: 5 }
      );

      expect(sessionId).toBe('replay-2');
    });

    it('should create a modified-input replay session', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'replay-3' }],
        rowCount: 1,
      });

      const sessionId = await snapshotCaptureService.createReplaySession(
        'exec-1',
        'tenant-1',
        'user-1',
        { 
          mode: 'modified_input', 
          modifiedInputs: { goal: 'new goal', constraints: { budget: 5 } }
        }
      );

      expect(sessionId).toBe('replay-3');
    });
  });

  describe('compareExecutions', () => {
    it('should detect divergence between executions', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [
            { id: 's1', execution_id: 'exec-1', step_number: 0, step_type: 'start', output_state: '{"a":1}', model_id: 'gpt-4o' },
            { id: 's2', execution_id: 'exec-1', step_number: 1, step_type: 'observe', output_state: '{"b":2}', model_id: 'gpt-4o' },
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 's3', execution_id: 'exec-2', step_number: 0, step_type: 'start', output_state: '{"a":1}', model_id: 'gpt-4o' },
            { id: 's4', execution_id: 'exec-2', step_number: 1, step_type: 'observe', output_state: '{"b":3}', model_id: 'gpt-4o' },
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Store diff

      const result = await snapshotCaptureService.compareExecutions('exec-1', 'exec-2');

      expect(result.divergenceStep).toBe(1);
      expect(result.differences.length).toBeGreaterThan(0);
    });

    it('should return no differences for identical executions', async () => {
      const sharedSnapshot = { 
        id: 's1', 
        execution_id: 'exec-1', 
        step_number: 0, 
        step_type: 'start', 
        output_state: '{"a":1}', 
        model_id: 'gpt-4o',
        input_state: '{}',
        internal_state: '{}',
        governor_state: '{}',
        cbf_evaluation: '{}',
        cost_usd: '0',
        tokens_used: 0,
        latency_ms: 10,
        captured_at: '2026-01-20T10:00:00Z',
      };

      mockExecuteStatement
        .mockResolvedValueOnce({ rows: [sharedSnapshot], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...sharedSnapshot, id: 's2', execution_id: 'exec-2' }], rowCount: 1 });

      const result = await snapshotCaptureService.compareExecutions('exec-1', 'exec-2');

      expect(result.differences).toHaveLength(0);
      expect(result.divergenceStep).toBeNull();
    });
  });

  describe('addBookmark', () => {
    it('should create a bookmark for a snapshot', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'bookmark-1' }],
        rowCount: 1,
      });

      const bookmarkId = await snapshotCaptureService.addBookmark(
        'snap-1',
        'user-1',
        'Important Step',
        'This is where the agent made a key decision'
      );

      expect(bookmarkId).toBe('bookmark-1');
    });
  });

  describe('addAnnotation', () => {
    it('should create an annotation for a snapshot', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'annotation-1' }],
        rowCount: 1,
      });

      const annotationId = await snapshotCaptureService.addAnnotation(
        'snap-1',
        'user-1',
        'Why did the agent choose this path?',
        'question'
      );

      expect(annotationId).toBe('annotation-1');
    });

    it('should default to note type', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'annotation-2' }],
        rowCount: 1,
      });

      const annotationId = await snapshotCaptureService.addAnnotation(
        'snap-1',
        'user-1',
        'General observation about this step'
      );

      expect(annotationId).toBe('annotation-2');
    });
  });
});
