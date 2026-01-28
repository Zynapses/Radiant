// RADIANT v4.18.0 - Time Travel Service
// Conversation Forking & State Replay
// Novel UI: "Timeline Scrubber" - horizontal timeline with playhead

import { executeStatement, stringParam, longParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface Timeline {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  name: string;
  description: string;
  rootCheckpointId: string;
  currentCheckpointId: string;
  checkpointCount: number;
  forkCount: number;
  status: TimelineStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TimelineStatus = 'active' | 'archived' | 'merged';

export interface Checkpoint {
  id: string;
  timelineId: string;
  tenantId: string;
  parentId?: string;
  sequence: number;
  type: CheckpointType;
  label?: string;
  state: ConversationState;
  diff?: StateDiff;
  branchPoint: boolean;
  childCount: number;
  createdAt: string;
}

export type CheckpointType = 'auto' | 'manual' | 'fork' | 'merge' | 'rollback';

export interface ConversationState {
  messages: Message[];
  context: Record<string, unknown>;
  variables: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface StateDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

export interface TimelineView {
  timeline: Timeline;
  checkpoints: CheckpointNode[];
  branches: Branch[];
  currentPosition: number;
}

export interface CheckpointNode {
  checkpoint: Checkpoint;
  x: number;
  y: number;
  isCurrent: boolean;
  hasBranch: boolean;
}

export interface Branch {
  id: string;
  name: string;
  startCheckpointId: string;
  checkpointCount: number;
}

// ============================================================================
// Time Travel Service
// ============================================================================

class TimeTravelService {
  // --------------------------------------------------------------------------
  // Timeline Management
  // --------------------------------------------------------------------------

  async createTimeline(
    tenantId: string,
    userId: string,
    conversationId: string,
    name: string,
    initialState: ConversationState
  ): Promise<Timeline> {
    try {
      const timelineId = `tl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const checkpointId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create initial checkpoint
      await executeStatement(
        `INSERT INTO time_travel_checkpoints (id, timeline_id, tenant_id, sequence, type, label, state, branch_point, child_count, created_at)
          VALUES (:id, :timelineId, :tenantId, 0, 'auto', 'Initial', :state, false, 0, NOW())`,
        [
          stringParam('id', checkpointId),
          stringParam('timelineId', timelineId),
          stringParam('tenantId', tenantId),
          stringParam('state', JSON.stringify(initialState)),
        ]
      );

      // Create timeline
      await executeStatement(
        `INSERT INTO time_travel_timelines (id, tenant_id, user_id, conversation_id, name, description, root_checkpoint_id, current_checkpoint_id, checkpoint_count, fork_count, status, metadata, created_at, updated_at)
          VALUES (:id, :tenantId, :userId, :conversationId, :name, '', :rootId, :currentId, 1, 0, 'active', '{}', NOW(), NOW())`,
        [
          stringParam('id', timelineId),
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('conversationId', conversationId),
          stringParam('name', name),
          stringParam('rootId', checkpointId),
          stringParam('currentId', checkpointId),
        ]
      );

      logger.info('Created timeline', { tenantId, timelineId, conversationId });

      return {
        id: timelineId,
        tenantId,
        userId,
        conversationId,
        name,
        description: '',
        rootCheckpointId: checkpointId,
        currentCheckpointId: checkpointId,
        checkpointCount: 1,
        forkCount: 0,
        status: 'active',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to create timeline', { tenantId, error });
      throw error;
    }
  }

  async getTimeline(tenantId: string, timelineId: string): Promise<Timeline | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM time_travel_timelines WHERE tenant_id = :tenantId AND id = :timelineId`,
        [stringParam('tenantId', tenantId), stringParam('timelineId', timelineId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseTimeline(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get timeline', { tenantId, timelineId, error });
      throw error;
    }
  }

  async listTimelines(tenantId: string, userId?: string, limit = 50): Promise<Timeline[]> {
    try {
      let sql = `SELECT * FROM time_travel_timelines WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (userId) {
        sql += ` AND user_id = :userId`;
        params.push(stringParam('userId', userId));
      }

      sql += ` ORDER BY updated_at DESC LIMIT :limit`;
      params.push(longParam('limit', limit));

      const result = await executeStatement(sql, params);
      return (result.rows || []).map(row => this.parseTimeline(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to list timelines', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Checkpoint Management
  // --------------------------------------------------------------------------

  async createCheckpoint(
    tenantId: string,
    timelineId: string,
    state: ConversationState,
    type: CheckpointType = 'auto',
    label?: string
  ): Promise<Checkpoint> {
    try {
      const timeline = await this.getTimeline(tenantId, timelineId);
      if (!timeline) throw new Error('Timeline not found');

      const checkpointId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sequence = timeline.checkpointCount;

      // Get parent checkpoint for diff calculation
      const parentCheckpoint = await this.getCheckpoint(tenantId, timeline.currentCheckpointId);
      const diff = parentCheckpoint ? this.calculateDiff(parentCheckpoint.state, state) : undefined;

      await executeStatement(
        `INSERT INTO time_travel_checkpoints (id, timeline_id, tenant_id, parent_id, sequence, type, label, state, diff, branch_point, child_count, created_at)
          VALUES (:id, :timelineId, :tenantId, :parentId, :sequence, :type, :label, :state, :diff, false, 0, NOW())`,
        [
          stringParam('id', checkpointId),
          stringParam('timelineId', timelineId),
          stringParam('tenantId', tenantId),
          stringParam('parentId', timeline.currentCheckpointId),
          longParam('sequence', sequence),
          stringParam('type', type),
          stringParam('label', label || ''),
          stringParam('state', JSON.stringify(state)),
          stringParam('diff', JSON.stringify(diff || {})),
        ]
      );

      // Update parent's child count
      await executeStatement(
        `UPDATE time_travel_checkpoints SET child_count = child_count + 1 WHERE id = :parentId`,
        [stringParam('parentId', timeline.currentCheckpointId)]
      );

      // Update timeline
      await executeStatement(
        `UPDATE time_travel_timelines SET current_checkpoint_id = :checkpointId, checkpoint_count = checkpoint_count + 1, updated_at = NOW()
          WHERE id = :timelineId`,
        [stringParam('checkpointId', checkpointId), stringParam('timelineId', timelineId)]
      );

      logger.info('Created checkpoint', { tenantId, timelineId, checkpointId });

      return {
        id: checkpointId,
        timelineId,
        tenantId,
        parentId: timeline.currentCheckpointId,
        sequence,
        type,
        label,
        state,
        diff,
        branchPoint: false,
        childCount: 0,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to create checkpoint', { tenantId, timelineId, error });
      throw error;
    }
  }

  async getCheckpoint(tenantId: string, checkpointId: string): Promise<Checkpoint | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM time_travel_checkpoints WHERE tenant_id = :tenantId AND id = :checkpointId`,
        [stringParam('tenantId', tenantId), stringParam('checkpointId', checkpointId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseCheckpoint(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get checkpoint', { tenantId, checkpointId, error });
      throw error;
    }
  }

  async getTimelineCheckpoints(tenantId: string, timelineId: string): Promise<Checkpoint[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM time_travel_checkpoints WHERE tenant_id = :tenantId AND timeline_id = :timelineId ORDER BY sequence ASC`,
        [stringParam('tenantId', tenantId), stringParam('timelineId', timelineId)]
      );

      return (result.rows || []).map(row => this.parseCheckpoint(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to get timeline checkpoints', { tenantId, timelineId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Time Travel Operations
  // --------------------------------------------------------------------------

  async jumpToCheckpoint(tenantId: string, timelineId: string, checkpointId: string): Promise<ConversationState> {
    try {
      const checkpoint = await this.getCheckpoint(tenantId, checkpointId);
      if (!checkpoint) throw new Error('Checkpoint not found');

      await executeStatement(
        `UPDATE time_travel_timelines SET current_checkpoint_id = :checkpointId, updated_at = NOW() WHERE id = :timelineId`,
        [stringParam('checkpointId', checkpointId), stringParam('timelineId', timelineId)]
      );

      logger.info('Jumped to checkpoint', { tenantId, timelineId, checkpointId });
      return checkpoint.state;
    } catch (error) {
      logger.error('Failed to jump to checkpoint', { tenantId, timelineId, checkpointId, error });
      throw error;
    }
  }

  async replayCheckpoints(
    tenantId: string,
    timelineId: string,
    fromCheckpointId: string,
    toCheckpointId: string
  ): Promise<ConversationState[]> {
    try {
      const checkpoints = await this.getTimelineCheckpoints(tenantId, timelineId);
      
      const fromIndex = checkpoints.findIndex(cp => cp.id === fromCheckpointId);
      const toIndex = checkpoints.findIndex(cp => cp.id === toCheckpointId);
      
      if (fromIndex === -1 || toIndex === -1) {
        throw new Error('Checkpoint not found');
      }
      
      const startIndex = Math.min(fromIndex, toIndex);
      const endIndex = Math.max(fromIndex, toIndex);
      
      const replayCheckpoints = checkpoints.slice(startIndex, endIndex + 1);
      
      logger.info('Replaying checkpoints', { tenantId, timelineId, count: replayCheckpoints.length });
      
      return replayCheckpoints.map(cp => cp.state);
    } catch (error) {
      logger.error('Failed to replay checkpoints', { tenantId, timelineId, error });
      throw error;
    }
  }

  async forkTimeline(tenantId: string, sourceTimelineId: string, checkpointId: string, name: string, userId: string): Promise<Timeline> {
    try {
      const checkpoint = await this.getCheckpoint(tenantId, checkpointId);
      if (!checkpoint) throw new Error('Checkpoint not found');

      // Mark source checkpoint as branch point
      await executeStatement(
        `UPDATE time_travel_checkpoints SET branch_point = true WHERE id = :checkpointId`,
        [stringParam('checkpointId', checkpointId)]
      );

      // Create new timeline from checkpoint state
      const sourceTimeline = await this.getTimeline(tenantId, sourceTimelineId);
      if (!sourceTimeline) throw new Error('Source timeline not found');

      const newTimeline = await this.createTimeline(tenantId, userId, sourceTimeline.conversationId, name, checkpoint.state);

      // Record fork
      await executeStatement(
        `INSERT INTO time_travel_forks (id, source_timeline_id, target_timeline_id, checkpoint_id, created_by, created_at)
          VALUES (:id, :sourceId, :targetId, :checkpointId, :createdBy, NOW())`,
        [
          stringParam('id', `fork_${Date.now()}`),
          stringParam('sourceId', sourceTimelineId),
          stringParam('targetId', newTimeline.id),
          stringParam('checkpointId', checkpointId),
          stringParam('createdBy', userId),
        ]
      );

      // Update source timeline fork count
      await executeStatement(
        `UPDATE time_travel_timelines SET fork_count = fork_count + 1, updated_at = NOW() WHERE id = :timelineId`,
        [stringParam('timelineId', sourceTimelineId)]
      );

      logger.info('Forked timeline', { tenantId, sourceTimelineId, newTimelineId: newTimeline.id });
      return newTimeline;
    } catch (error) {
      logger.error('Failed to fork timeline', { tenantId, sourceTimelineId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Timeline View
  // --------------------------------------------------------------------------

  async getTimelineView(tenantId: string, timelineId: string): Promise<TimelineView> {
    try {
      const timeline = await this.getTimeline(tenantId, timelineId);
      if (!timeline) throw new Error('Timeline not found');

      const checkpoints = await this.getTimelineCheckpoints(tenantId, timelineId);

      // Build visual layout
      const checkpointNodes: CheckpointNode[] = checkpoints.map((cp, index) => ({
        checkpoint: cp,
        x: (index / Math.max(1, checkpoints.length - 1)) * 100,
        y: 50,
        isCurrent: cp.id === timeline.currentCheckpointId,
        hasBranch: cp.branchPoint,
      }));

      return {
        timeline,
        checkpoints: checkpointNodes,
        branches: [],
        currentPosition: checkpoints.findIndex(cp => cp.id === timeline.currentCheckpointId),
      };
    } catch (error) {
      logger.error('Failed to get timeline view', { tenantId, timelineId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private calculateDiff(oldState: ConversationState, newState: ConversationState): StateDiff {
    const oldMessages = new Set(oldState.messages.map(m => m.content));
    const newMessages = new Set(newState.messages.map(m => m.content));

    return {
      added: newState.messages.filter(m => !oldMessages.has(m.content)).map(m => m.content.slice(0, 50)),
      removed: oldState.messages.filter(m => !newMessages.has(m.content)).map(m => m.content.slice(0, 50)),
      modified: [],
    };
  }

  private parseTimeline(row: Record<string, unknown>): Timeline {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      conversationId: String(row.conversation_id || ''),
      name: String(row.name || ''),
      description: String(row.description || ''),
      rootCheckpointId: String(row.root_checkpoint_id || ''),
      currentCheckpointId: String(row.current_checkpoint_id || ''),
      checkpointCount: Number(row.checkpoint_count) || 0,
      forkCount: Number(row.fork_count) || 0,
      status: String(row.status || 'active') as TimelineStatus,
      metadata: this.parseJson(row.metadata) || {},
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private parseCheckpoint(row: Record<string, unknown>): Checkpoint {
    return {
      id: String(row.id || ''),
      timelineId: String(row.timeline_id || ''),
      tenantId: String(row.tenant_id || ''),
      parentId: row.parent_id ? String(row.parent_id) : undefined,
      sequence: Number(row.sequence) || 0,
      type: String(row.type || 'auto') as CheckpointType,
      label: row.label ? String(row.label) : undefined,
      state: this.parseJson(row.state) || { messages: [], context: {}, variables: {} },
      diff: this.parseJson(row.diff) || undefined,
      branchPoint: Boolean(row.branch_point),
      childCount: Number(row.child_count) || 0,
      createdAt: String(row.created_at || ''),
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const timeTravelService = new TimeTravelService();
