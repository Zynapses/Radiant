/**
 * Reality Scrubber Service
 * 
 * "We replaced 'Undo' with Time Travel."
 * 
 * The Reality Scrubber captures full state snapshots (VFS + PGLite + Ghost State + Chat Context)
 * and allows instant rewinding to any point in the timeline.
 * 
 * @module reality-engine/reality-scrubber
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement } from '../../db/client';
import {
  RealitySnapshot,
  RealityTimeline,
  RealityTimelinePoint,
  RealityScrubRequest,
  RealityScrubResponse,
  RealityTriggerEvent,
  RealityChatContext,
  MorphicGhostState,
  MorphicLayout,
} from '@radiant/shared';

// Type alias for flexible params
type LooseParam = any;


interface SnapshotData {
  vfsState?: Record<string, string>;
  dbState?: Buffer;
  ghostState: MorphicGhostState;
  chatContext: RealityChatContext;
  layoutState: MorphicLayout | null;
}

class RealityScrubberService {
  private readonly MAX_SNAPSHOTS_PER_SESSION = 100;
  private readonly AUTO_SNAPSHOT_INTERVAL_MS = 30000; // 30 seconds

  /**
   * Create a new reality timeline for a session
   */
  async createTimeline(
    tenantId: string,
    userId: string,
    sessionId: string,
    name: string = 'Main Timeline'
  ): Promise<RealityTimeline> {
    const timelineId = uuidv4();
    const now = new Date();

    const timeline: RealityTimeline = {
      id: timelineId,
      tenantId,
      userId,
      sessionId,
      snapshots: [],
      currentPosition: -1,
      parentTimelineId: null,
      branchPoint: null,
      childTimelineIds: [],
      name,
      createdAt: now,
      updatedAt: now,
    };

    await executeStatement(
      `INSERT INTO reality_timelines (
        id, tenant_id, user_id, session_id, name, 
        snapshots, current_position, parent_timeline_id, branch_point, 
        child_timeline_ids, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        timeline.id,
        timeline.tenantId,
        timeline.userId,
        timeline.sessionId,
        timeline.name,
        JSON.stringify(timeline.snapshots),
        timeline.currentPosition,
        timeline.parentTimelineId,
        timeline.branchPoint,
        JSON.stringify(timeline.childTimelineIds),
        timeline.createdAt.toISOString(),
        timeline.updatedAt.toISOString(),
      ] as any[]
    );

    return timeline;
  }

  /**
   * Capture a full reality snapshot
   */
  async captureSnapshot(
    tenantId: string,
    userId: string,
    sessionId: string,
    timelineId: string,
    triggerEvent: RealityTriggerEvent,
    data: SnapshotData,
    label?: string
  ): Promise<RealitySnapshot> {
    const snapshotId = uuidv4();
    const now = new Date();

    // Calculate VFS hash (simplified - in production use proper hashing)
    const vfsHash = this.hashVFS(data.vfsState || {});

    // Compress state data
    const vfsSnapshot = data.vfsState 
      ? Buffer.from(JSON.stringify(data.vfsState))
      : null;
    const dbSnapshot = data.dbState || null;

    const byteSize = 
      (vfsSnapshot?.length || 0) + 
      (dbSnapshot?.length || 0) + 
      JSON.stringify(data.ghostState).length +
      JSON.stringify(data.chatContext).length;

    const snapshot: RealitySnapshot = {
      id: snapshotId,
      tenantId,
      userId,
      sessionId,
      realityId: timelineId,
      timestamp: now,
      label,
      vfsHash,
      vfsSnapshot,
      dbSnapshot,
      ghostState: data.ghostState,
      chatContext: data.chatContext,
      layoutState: data.layoutState,
      triggerEvent,
      byteSize,
      isAutoSnapshot: triggerEvent === 'auto_interval',
      isBookmarked: triggerEvent === 'checkpoint',
      createdAt: now,
    };

    // Store snapshot
    await executeStatement(
      `INSERT INTO reality_snapshots (
        id, tenant_id, user_id, session_id, reality_id, timestamp, label,
        vfs_hash, vfs_snapshot, db_snapshot, ghost_state, chat_context, 
        layout_state, trigger_event, byte_size, is_auto_snapshot, 
        is_bookmarked, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        snapshot.id,
        snapshot.tenantId,
        snapshot.userId,
        snapshot.sessionId,
        snapshot.realityId,
        snapshot.timestamp.toISOString(),
        snapshot.label,
        snapshot.vfsHash,
        snapshot.vfsSnapshot,
        snapshot.dbSnapshot,
        JSON.stringify(snapshot.ghostState),
        JSON.stringify(snapshot.chatContext),
        JSON.stringify(snapshot.layoutState),
        snapshot.triggerEvent,
        snapshot.byteSize,
        snapshot.isAutoSnapshot,
        snapshot.isBookmarked,
        snapshot.createdAt.toISOString(),
      ] as any[]
    );

    // Update timeline with new snapshot
    await this.addSnapshotToTimeline(timelineId, snapshot);

    // Cleanup old snapshots if exceeding limit
    await this.cleanupOldSnapshots(sessionId);

    return snapshot;
  }

  /**
   * Scrub reality to a specific point in time
   */
  async scrubTo(request: RealityScrubRequest): Promise<RealityScrubResponse> {
    const startTime = Date.now();

    // Get current timeline
    const timeline = await this.getTimelineBySession(request.sessionId);
    if (!timeline) {
      throw new Error(`No timeline found for session ${request.sessionId}`);
    }

    const previousPosition = timeline.currentPosition;
    let targetPosition: number;

    // Determine target position
    if (request.targetSnapshotId) {
      targetPosition = timeline.snapshots.findIndex(
        s => s.snapshotId === request.targetSnapshotId
      );
      if (targetPosition === -1) {
        throw new Error(`Snapshot ${request.targetSnapshotId} not found in timeline`);
      }
    } else if (request.targetPosition !== undefined) {
      // Relative position
      targetPosition = previousPosition + request.targetPosition;
    } else if (request.targetTimestamp) {
      // Find closest snapshot to timestamp
      targetPosition = this.findClosestSnapshot(timeline.snapshots, request.targetTimestamp);
    } else {
      throw new Error('Must specify targetSnapshotId, targetPosition, or targetTimestamp');
    }

    // Bounds check
    targetPosition = Math.max(0, Math.min(targetPosition, timeline.snapshots.length - 1));

    // Load the target snapshot
    const targetSnapshotId = timeline.snapshots[targetPosition].snapshotId;
    const snapshot = await this.loadSnapshot(targetSnapshotId);

    // Update timeline position
    await this.updateTimelinePosition(timeline.id, targetPosition);

    const scrubDurationMs = Date.now() - startTime;

    return {
      success: true,
      previousPosition,
      newPosition: targetPosition,
      restoredSnapshot: snapshot,
      affectedComponents: this.getAffectedComponents(snapshot),
      scrubDurationMs,
    };
  }

  /**
   * Create a bookmark at the current position
   */
  async createBookmark(
    sessionId: string,
    label: string
  ): Promise<RealitySnapshot> {
    const timeline = await this.getTimelineBySession(sessionId);
    if (!timeline || timeline.currentPosition < 0) {
      throw new Error('No current snapshot to bookmark');
    }

    const currentSnapshotId = timeline.snapshots[timeline.currentPosition].snapshotId;
    
    await executeStatement(
      `UPDATE reality_snapshots SET is_bookmarked = true, label = $1 WHERE id = $2`,
      [label, currentSnapshotId] as any[]
    );

    return this.loadSnapshot(currentSnapshotId);
  }

  /**
   * Get the timeline for a session
   */
  async getTimelineBySession(sessionId: string): Promise<RealityTimeline | null> {
    const result = await executeStatement(`SELECT * FROM reality_timelines WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`, [sessionId] as any[]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return this.mapRowToTimeline(row);
  }

  /**
   * Get all bookmarked snapshots for a session
   */
  async getBookmarks(sessionId: string): Promise<RealitySnapshot[]> {
    const result = await executeStatement(`SELECT * FROM reality_snapshots 
       WHERE session_id = $1 AND is_bookmarked = true 
       ORDER BY timestamp DESC`, [sessionId] as any[]
    );

    return (result.rows || []).map((row: unknown) => 
      this.mapRowToSnapshot(row as Record<string, unknown>)
    );
  }

  /**
   * Fork the timeline at a specific point to create a new branch
   */
  async forkTimeline(
    sessionId: string,
    forkPosition: number,
    newBranchName: string
  ): Promise<RealityTimeline> {
    const parentTimeline = await this.getTimelineBySession(sessionId);
    if (!parentTimeline) {
      throw new Error(`No timeline found for session ${sessionId}`);
    }

    // Create new timeline branching from parent
    const newTimeline = await this.createTimeline(
      parentTimeline.tenantId,
      parentTimeline.userId,
      sessionId,
      newBranchName
    );

    // Copy snapshots up to fork point
    const forkedSnapshots = parentTimeline.snapshots.slice(0, forkPosition + 1);
    
    await executeStatement(
      `UPDATE reality_timelines 
       SET snapshots = $1, current_position = $2, parent_timeline_id = $3, branch_point = $4
       WHERE id = $5`,
      [
        JSON.stringify(forkedSnapshots),
        forkPosition,
        parentTimeline.id,
        forkPosition,
        newTimeline.id,
      ] as any[]
    );

    // Update parent's child references
    const updatedChildren = [...parentTimeline.childTimelineIds, newTimeline.id];
    await executeStatement(`UPDATE reality_timelines SET child_timeline_ids = $1 WHERE id = $2`, [JSON.stringify(updatedChildren), parentTimeline.id] as any[]
    );

    return {
      ...newTimeline,
      snapshots: forkedSnapshots,
      currentPosition: forkPosition,
      parentTimelineId: parentTimeline.id,
      branchPoint: forkPosition,
    };
  }

  /**
   * Get timeline visualization data for the Reality Scrubber UI
   */
  async getTimelineVisualization(sessionId: string): Promise<{
    timeline: RealityTimeline;
    thumbnails: Map<string, string>;
    branches: RealityTimeline[];
  }> {
    const timeline = await this.getTimelineBySession(sessionId);
    if (!timeline) {
      throw new Error(`No timeline found for session ${sessionId}`);
    }

    // Get child branches
    const branches: RealityTimeline[] = [];
    for (const childId of timeline.childTimelineIds) {
      const child = await this.getTimelineById(childId);
      if (child) branches.push(child);
    }

    // Generate thumbnails (simplified - in production use actual screenshots)
    const thumbnails = new Map<string, string>();
    for (const point of timeline.snapshots) {
      thumbnails.set(point.snapshotId, point.thumbnailUrl || '');
    }

    return { timeline, thumbnails, branches };
  }

  // Private helper methods

  private async addSnapshotToTimeline(
    timelineId: string,
    snapshot: RealitySnapshot
  ): Promise<void> {
    const timeline = await this.getTimelineById(timelineId);
    if (!timeline) return;

    const newPoint: RealityTimelinePoint = {
      snapshotId: snapshot.id,
      timestamp: snapshot.timestamp,
      label: snapshot.label,
      triggerEvent: snapshot.triggerEvent,
      isBookmarked: snapshot.isBookmarked,
    };

    const newSnapshots = [...timeline.snapshots, newPoint];
    const newPosition = newSnapshots.length - 1;

    await executeStatement(
      `UPDATE reality_timelines 
       SET snapshots = $1, current_position = $2, updated_at = $3 
       WHERE id = $4`,
      [JSON.stringify(newSnapshots), newPosition, new Date().toISOString(), timelineId] as any[]
    );
  }

  private async getTimelineById(timelineId: string): Promise<RealityTimeline | null> {
    const result = await executeStatement(`SELECT * FROM reality_timelines WHERE id = $1`, [timelineId] as any[]
    );

    if (!result.rows || result.rows.length === 0) return null;
    return this.mapRowToTimeline(result.rows[0] as Record<string, unknown>);
  }

  private async loadSnapshot(snapshotId: string): Promise<RealitySnapshot> {
    const result = await executeStatement(`SELECT * FROM reality_snapshots WHERE id = $1`, [snapshotId] as any[]
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    return this.mapRowToSnapshot(result.rows[0] as Record<string, unknown>);
  }

  private async updateTimelinePosition(
    timelineId: string,
    position: number
  ): Promise<void> {
    await executeStatement(
      `UPDATE reality_timelines SET current_position = $1, updated_at = $2 WHERE id = $3`,
      [position, new Date().toISOString(), timelineId] as any[]
    );
  }

  private async cleanupOldSnapshots(sessionId: string): Promise<void> {
    // Keep only the most recent N auto-snapshots, preserve all bookmarks
    await executeStatement(`DELETE FROM reality_snapshots 
       WHERE session_id = $1 
         AND is_bookmarked = false 
         AND id NOT IN (
           SELECT id FROM reality_snapshots 
           WHERE session_id = $1 
           ORDER BY timestamp DESC 
           LIMIT $2
         )`, [sessionId, this.MAX_SNAPSHOTS_PER_SESSION] as any[]
    );
  }

  private findClosestSnapshot(
    snapshots: RealityTimelinePoint[],
    targetTime: Date
  ): number {
    const targetMs = targetTime.getTime();
    let closestIndex = 0;
    let closestDiff = Infinity;

    for (let i = 0; i < snapshots.length; i++) {
      const diff = Math.abs(snapshots[i].timestamp.getTime() - targetMs);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  private getAffectedComponents(snapshot: RealitySnapshot): string[] {
    if (!snapshot.layoutState) return [];
    return snapshot.layoutState.components.map(c => c.componentType);
  }

  private hashVFS(vfsState: Record<string, string>): string {
    // Simplified hash - in production use proper crypto hash
    const content = JSON.stringify(vfsState);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private mapRowToTimeline(row: Record<string, unknown>): RealityTimeline {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      sessionId: row.session_id as string,
      snapshots: JSON.parse((row.snapshots as string) || '[]'),
      currentPosition: row.current_position as number,
      parentTimelineId: row.parent_timeline_id as string | null,
      branchPoint: row.branch_point as number | null,
      childTimelineIds: JSON.parse((row.child_timeline_ids as string) || '[]'),
      name: row.name as string,
      description: row.description as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapRowToSnapshot(row: Record<string, unknown>): RealitySnapshot {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      sessionId: row.session_id as string,
      realityId: row.reality_id as string,
      timestamp: new Date(row.timestamp as string),
      label: row.label as string | undefined,
      vfsHash: row.vfs_hash as string,
      vfsSnapshot: row.vfs_snapshot as Buffer | null,
      dbSnapshot: row.db_snapshot as Buffer | null,
      ghostState: JSON.parse((row.ghost_state as string) || '{}'),
      chatContext: JSON.parse((row.chat_context as string) || '{}'),
      layoutState: row.layout_state ? JSON.parse(row.layout_state as string) : null,
      triggerEvent: row.trigger_event as RealityTriggerEvent,
      byteSize: row.byte_size as number,
      isAutoSnapshot: row.is_auto_snapshot as boolean,
      isBookmarked: row.is_bookmarked as boolean,
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const realityScrubberService = new RealityScrubberService();
