/**
 * RADIANT v5.52.16 - Time Travel API Client
 * 
 * Client-side functions for Time Machine / Reality Scrubber feature.
 * Enables conversation forking, state snapshots, and timeline navigation.
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Timeline {
  id: string;
  conversationId: string;
  name: string;
  status: 'active' | 'archived' | 'forked';
  checkpointCount: number;
  forkCount: number;
  createdAt: string;
  updatedAt: string;
  statusIcon?: string;
  statusColor?: string;
  checkpointLabel?: string;
  forkLabel?: string | null;
}

export interface Checkpoint {
  id: string;
  timelineId: string;
  sequenceNumber: number;
  checkpointType: 'auto' | 'manual' | 'branch_point' | 'milestone';
  label?: string;
  state: Record<string, unknown>;
  messageCount: number;
  createdAt: string;
  isBookmarked?: boolean;
  preview?: string;
}

export interface Fork {
  id: string;
  sourceTimelineId: string;
  forkedTimelineId: string;
  sourceCheckpointId: string;
  forkReason?: string;
  createdAt: string;
}

export interface TimelineComparison {
  timeline1: Timeline;
  timeline2: Timeline;
  divergencePoint: Checkpoint;
  differences: Array<{
    type: 'added' | 'removed' | 'modified';
    path: string;
    value1?: unknown;
    value2?: unknown;
  }>;
}

// ============================================================================
// API Service
// ============================================================================

class TimeTravelService {
  /**
   * List all timelines for the user
   */
  async listTimelines(conversationId?: string): Promise<Timeline[]> {
    const params = conversationId ? `?conversationId=${conversationId}` : '';
    const response = await api.get<{ success: boolean; data: Timeline[] }>(
      `/api/thinktank/time-travel/timelines${params}`
    );
    return response.data || [];
  }

  /**
   * Create a new timeline for a conversation
   */
  async createTimeline(
    conversationId: string,
    initialState: Record<string, unknown>,
    name?: string
  ): Promise<Timeline> {
    const response = await api.post<{ success: boolean; data: Timeline }>(
      '/api/thinktank/time-travel/timelines',
      { conversationId, initialState, name }
    );
    return response.data;
  }

  /**
   * Get timeline details
   */
  async getTimeline(timelineId: string): Promise<Timeline> {
    const response = await api.get<{ success: boolean; data: Timeline }>(
      `/api/thinktank/time-travel/timelines/${timelineId}`
    );
    return response.data;
  }

  /**
   * List checkpoints for a timeline
   */
  async listCheckpoints(timelineId: string): Promise<Checkpoint[]> {
    const response = await api.get<{ success: boolean; data: Checkpoint[] }>(
      `/api/thinktank/time-travel/timelines/${timelineId}/checkpoints`
    );
    return response.data || [];
  }

  /**
   * Create a manual checkpoint (bookmark)
   */
  async createCheckpoint(
    timelineId: string,
    state: Record<string, unknown>,
    label?: string
  ): Promise<Checkpoint> {
    const response = await api.post<{ success: boolean; data: Checkpoint }>(
      `/api/thinktank/time-travel/timelines/${timelineId}/checkpoints`,
      { state, label, checkpointType: 'manual' }
    );
    return response.data;
  }

  /**
   * Restore to a specific checkpoint
   */
  async restoreCheckpoint(
    timelineId: string,
    checkpointId: string
  ): Promise<{ restoredState: Record<string, unknown> }> {
    const response = await api.post<{ success: boolean; data: { restoredState: Record<string, unknown> } }>(
      `/api/thinktank/time-travel/timelines/${timelineId}/checkpoints/${checkpointId}/restore`
    );
    return response.data;
  }

  /**
   * Fork timeline from a checkpoint (create branch)
   */
  async forkTimeline(
    timelineId: string,
    checkpointId: string,
    branchName?: string,
    reason?: string
  ): Promise<{ fork: Fork; newTimeline: Timeline }> {
    const response = await api.post<{ success: boolean; data: { fork: Fork; newTimeline: Timeline } }>(
      `/api/thinktank/time-travel/timelines/${timelineId}/fork`,
      { checkpointId, branchName, reason }
    );
    return response.data;
  }

  /**
   * Compare two timelines
   */
  async compareTimelines(
    timeline1Id: string,
    timeline2Id: string
  ): Promise<TimelineComparison> {
    const response = await api.get<{ success: boolean; data: TimelineComparison }>(
      `/api/thinktank/time-travel/compare?timeline1=${timeline1Id}&timeline2=${timeline2Id}`
    );
    return response.data;
  }

  /**
   * Update checkpoint label (bookmark name)
   */
  async updateCheckpointLabel(
    timelineId: string,
    checkpointId: string,
    label: string
  ): Promise<Checkpoint> {
    const response = await api.patch<{ success: boolean; data: Checkpoint }>(
      `/api/thinktank/time-travel/timelines/${timelineId}/checkpoints/${checkpointId}`,
      { label }
    );
    return response.data;
  }

  /**
   * Delete a timeline
   */
  async deleteTimeline(timelineId: string): Promise<void> {
    await api.delete(`/api/thinktank/time-travel/timelines/${timelineId}`);
  }
}

export const timeTravelService = new TimeTravelService();
