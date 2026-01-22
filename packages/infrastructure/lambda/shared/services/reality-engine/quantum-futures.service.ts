/**
 * Quantum Futures Service
 * 
 * "Why choose one strategy? Split the timeline."
 * 
 * Quantum Futures enables parallel reality branching where users can run
 * multiple strategies simultaneously and compare them side-by-side before
 * collapsing reality into the winner.
 * 
 * @module reality-engine/quantum-futures
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement } from '../../db/client';
import {
  QuantumBranch,
  QuantumBranchStatus,
  QuantumBranchMetrics,
  QuantumSplit,
  QuantumViewMode,
  QuantumComparison,
  QuantumDiff,
  QuantumSplitRequest,
  QuantumSplitResponse,
  QuantumCollapseRequest,
  QuantumCollapseResponse,
  MorphicLayout,
} from '@radiant/shared';
import { realityScrubberService } from './reality-scrubber.service';

// Type alias for flexible params
type LooseParam = any;


const BRANCH_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

const BRANCH_ICONS = [
  '🅰️', '🅱️', '©️', '🔷', '🔶', '💠', '⭐', '🌟',
];

class QuantumFuturesService {
  private readonly MAX_BRANCHES_PER_SESSION = 8;

  /**
   * Split the current reality into multiple parallel branches
   */
  async createSplit(request: QuantumSplitRequest): Promise<QuantumSplitResponse> {
    const { sessionId, prompt, branchNames, branchDescriptions, autoCompare } = request;

    // Validate branch count
    if (branchNames.length < 2 || branchNames.length > this.MAX_BRANCHES_PER_SESSION) {
      throw new Error(`Branch count must be between 2 and ${this.MAX_BRANCHES_PER_SESSION}`);
    }

    // Get current timeline to find fork point
    const currentTimeline = await realityScrubberService.getTimelineBySession(sessionId);
    if (!currentTimeline) {
      throw new Error(`No timeline found for session ${sessionId}`);
    }

    const splitId = uuidv4();
    const now = new Date();

    // Create branches
    const branches: QuantumBranch[] = [];
    for (let i = 0; i < branchNames.length; i++) {
      const branch = await this.createBranch(
        currentTimeline.tenantId,
        currentTimeline.userId,
        sessionId,
        branchNames[i],
        branchDescriptions?.[i],
        BRANCH_COLORS[i % BRANCH_COLORS.length],
        BRANCH_ICONS[i % BRANCH_ICONS.length],
        branches.length > 0 ? branches[0].id : null // First branch is parent
      );
      branches.push(branch);
    }

    // Update sibling references
    const siblingIds = branches.map(b => b.id);
    for (const branch of branches) {
      branch.siblingBranchIds = siblingIds.filter(id => id !== branch.id);
      await this.updateBranchSiblings(branch.id, branch.siblingBranchIds);
    }

    // Create the split record
    const split: QuantumSplit = {
      id: splitId,
      sessionId,
      parentBranchId: branches[0].id,
      prompt,
      branches,
      viewMode: autoCompare ? 'split' : 'single',
      activeComparison: autoCompare ? {
        leftBranchId: branches[0].id,
        rightBranchId: branches[1].id,
        diffHighlights: [],
        syncScroll: true,
        showMetrics: true,
      } : null,
      createdAt: now,
    };

    await executeStatement(
      `INSERT INTO quantum_splits (
        id, session_id, parent_branch_id, prompt, branch_ids, 
        view_mode, active_comparison, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        split.id,
        split.sessionId,
        split.parentBranchId,
        split.prompt,
        JSON.stringify(siblingIds),
        split.viewMode,
        JSON.stringify(split.activeComparison),
        split.createdAt.toISOString(),
      ] as any[]
    );

    return {
      success: true,
      split,
      branches,
      comparisonReady: autoCompare || false,
    };
  }

  /**
   * Create a new quantum branch
   */
  async createBranch(
    tenantId: string,
    userId: string,
    sessionId: string,
    name: string,
    description?: string,
    color?: string,
    icon?: string,
    parentBranchId?: string | null
  ): Promise<QuantumBranch> {
    const branchId = uuidv4();
    const now = new Date();

    // Fork the timeline for this branch
    const timeline = await realityScrubberService.getTimelineBySession(sessionId);
    const forkPosition = timeline?.currentPosition || 0;
    
    const forkedTimeline = await realityScrubberService.forkTimeline(
      sessionId,
      forkPosition,
      `Timeline: ${name}`
    );

    const branch: QuantumBranch = {
      id: branchId,
      tenantId,
      userId,
      sessionId,
      name,
      description,
      color: color || BRANCH_COLORS[0],
      icon: icon || BRANCH_ICONS[0],
      timelineId: forkedTimeline.id,
      status: 'active',
      metrics: this.createInitialMetrics(),
      parentBranchId: parentBranchId || null,
      siblingBranchIds: [],
      createdAt: now,
      updatedAt: now,
    };

    await executeStatement(
      `INSERT INTO quantum_branches (
        id, tenant_id, user_id, session_id, name, description,
        color, icon, timeline_id, status, metrics, 
        parent_branch_id, sibling_branch_ids, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        branch.id,
        branch.tenantId,
        branch.userId,
        branch.sessionId,
        branch.name,
        branch.description as any,
        branch.color,
        branch.icon,
        branch.timelineId,
        branch.status,
        JSON.stringify(branch.metrics),
        branch.parentBranchId as any,
        JSON.stringify(branch.siblingBranchIds),
        branch.createdAt.toISOString(),
        branch.updatedAt.toISOString(),
      ]
    );

    return branch;
  }

  /**
   * Compare two branches and generate diffs
   */
  async compareBranches(
    leftBranchId: string,
    rightBranchId: string
  ): Promise<QuantumComparison> {
    const [leftBranch, rightBranch] = await Promise.all([
      this.getBranch(leftBranchId),
      this.getBranch(rightBranchId),
    ]);

    if (!leftBranch || !rightBranch) {
      throw new Error('One or both branches not found');
    }

    // Get latest layouts from each branch
    const [leftLayout, rightLayout] = await Promise.all([
      this.getLatestLayoutForBranch(leftBranch.timelineId),
      this.getLatestLayoutForBranch(rightBranch.timelineId),
    ]);

    // Generate diffs
    const diffHighlights = this.generateLayoutDiffs(leftLayout, rightLayout);

    return {
      leftBranchId,
      rightBranchId,
      diffHighlights,
      syncScroll: true,
      showMetrics: true,
    };
  }

  /**
   * Collapse reality by selecting a winning branch
   */
  async collapseReality(request: QuantumCollapseRequest): Promise<QuantumCollapseResponse> {
    const { sessionId, winningBranchId, losingBranchIds, archiveToMemory } = request;

    const winningBranch = await this.getBranch(winningBranchId);
    if (!winningBranch) {
      throw new Error(`Winning branch ${winningBranchId} not found`);
    }

    // Mark winning branch
    await this.updateBranchStatus(winningBranchId, 'winner');

    // Archive or collapse losing branches
    let archivedToMemoryId: string | undefined;
    for (const losingId of losingBranchIds) {
      if (archiveToMemory) {
        archivedToMemoryId = await this.archiveToDreamMemory(losingId);
        await this.updateBranchStatus(losingId, 'archived');
      } else {
        await this.updateBranchStatus(losingId, 'collapsed');
      }
    }

    // The winning timeline becomes the active timeline
    return {
      success: true,
      collapsedBranchCount: losingBranchIds.length,
      archivedToMemoryId,
      newActiveTimelineId: winningBranch.timelineId,
    };
  }

  /**
   * Get all branches for a session
   */
  async getBranchesForSession(sessionId: string): Promise<QuantumBranch[]> {
    const result = await executeStatement(
      `SELECT * FROM quantum_branches 
       WHERE session_id = $1 AND status NOT IN ('collapsed', 'archived')
       ORDER BY created_at`,
      [sessionId] as any[]
    );

    return (result.rows || []).map((row: unknown) => 
      this.mapRowToBranch(row as Record<string, unknown>)
    );
  }

  /**
   * Get a specific branch
   */
  async getBranch(branchId: string): Promise<QuantumBranch | null> {
    const result = await executeStatement(`SELECT * FROM quantum_branches WHERE id = $1`, [branchId] as any[]
    );

    if (!result.rows || result.rows.length === 0) return null;
    return this.mapRowToBranch(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Update branch metrics after user interaction
   */
  async updateBranchMetrics(
    branchId: string,
    updates: Partial<QuantumBranchMetrics>
  ): Promise<void> {
    const branch = await this.getBranch(branchId);
    if (!branch) return;

    const updatedMetrics = { ...branch.metrics, ...updates };
    
    await executeStatement(
      `UPDATE quantum_branches SET metrics = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(updatedMetrics), new Date().toISOString(), branchId] as any[]
    );
  }

  /**
   * Record user interaction with a branch
   */
  async recordInteraction(branchId: string): Promise<void> {
    const branch = await this.getBranch(branchId);
    if (!branch) return;

    await this.updateBranchMetrics(branchId, {
      interactionCount: branch.metrics.interactionCount + 1,
      lastInteraction: new Date(),
    });
  }

  /**
   * Set the view mode for comparing branches
   */
  async setViewMode(
    sessionId: string,
    viewMode: QuantumViewMode
  ): Promise<void> {
    await executeStatement(`UPDATE quantum_splits SET view_mode = $1 WHERE session_id = $2`, [viewMode, sessionId] as any[]
    );
  }

  /**
   * Get the active split for a session
   */
  async getActiveSplit(sessionId: string): Promise<QuantumSplit | null> {
    const result = await executeStatement(`SELECT * FROM quantum_splits WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`, [sessionId] as any[]
    );

    if (!result.rows || result.rows.length === 0) return null;
    
    const row = result.rows[0] as Record<string, unknown>;
    const branchIds = JSON.parse((row.branch_ids as string) || '[]');
    const branches = await Promise.all(
      branchIds.map((id: string) => this.getBranch(id))
    );

    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      parentBranchId: row.parent_branch_id as string,
      prompt: row.prompt as string,
      branches: branches.filter((b): b is QuantumBranch => b !== null),
      viewMode: row.view_mode as QuantumViewMode,
      activeComparison: row.active_comparison 
        ? JSON.parse(row.active_comparison as string) 
        : null,
      createdAt: new Date(row.created_at as string),
    };
  }

  // Private helper methods

  private createInitialMetrics(): QuantumBranchMetrics {
    return {
      completionRate: 0,
      complexityScore: 0,
      costEstimate: 0,
      validationErrors: 0,
      warningCount: 0,
      testsPassed: 0,
      testsTotal: 0,
      interactionCount: 0,
      timeSpentMs: 0,
      lastInteraction: new Date(),
    };
  }

  private async updateBranchSiblings(
    branchId: string,
    siblingIds: string[]
  ): Promise<void> {
    await executeStatement(`UPDATE quantum_branches SET sibling_branch_ids = $1 WHERE id = $2`, [JSON.stringify(siblingIds), branchId] as any[]
    );
  }

  private async updateBranchStatus(
    branchId: string,
    status: QuantumBranchStatus
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'collapsed' || status === 'archived') {
      updates.collapsed_at = new Date().toISOString();
    }

    await executeStatement(
      `UPDATE quantum_branches 
       SET status = $1, updated_at = $2, collapsed_at = $3 
       WHERE id = $4`,
      [status, updates.updated_at, updates.collapsed_at || null, branchId] as any[]
    );
  }

  private async archiveToDreamMemory(branchId: string): Promise<string> {
    const branch = await this.getBranch(branchId);
    if (!branch) throw new Error('Branch not found');

    // Store in dream memory for potential future recall
    const memoryId = uuidv4();
    await executeStatement(
      `INSERT INTO quantum_dream_archive (
        id, branch_id, session_id, timeline_id, name, description,
        metrics, archived_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        memoryId,
        branch.id,
        branch.sessionId,
        branch.timelineId,
        branch.name,
        branch.description as any,
        JSON.stringify(branch.metrics),
        new Date().toISOString(),
      ] as any[]
    );

    return memoryId;
  }

  private async getLatestLayoutForBranch(
    timelineId: string
  ): Promise<MorphicLayout | null> {
    const result = await executeStatement(`SELECT layout_state FROM reality_snapshots 
       WHERE reality_id = $1 AND layout_state IS NOT NULL
       ORDER BY timestamp DESC LIMIT 1`, [timelineId] as any[]
    );

    if (!result.rows || result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return row.layout_state ? JSON.parse(row.layout_state as string) : null;
  }

  private generateLayoutDiffs(
    left: MorphicLayout | null,
    right: MorphicLayout | null
  ): QuantumDiff[] {
    const diffs: QuantumDiff[] = [];

    if (!left && !right) return diffs;

    if (!left) {
      diffs.push({
        type: 'added',
        path: 'layout',
        rightValue: right,
        description: 'Entire layout added in right branch',
      });
      return diffs;
    }

    if (!right) {
      diffs.push({
        type: 'removed',
        path: 'layout',
        leftValue: left,
        description: 'Entire layout removed in right branch',
      });
      return diffs;
    }

    // Compare layout types
    if (left.type !== right.type) {
      diffs.push({
        type: 'modified',
        path: 'layout.type',
        leftValue: left.type,
        rightValue: right.type,
        description: `Layout type changed from ${left.type} to ${right.type}`,
      });
    }

    // Compare components
    const leftComponentIds = new Set(left.components.map(c => c.componentType));
    const rightComponentIds = new Set(right.components.map(c => c.componentType));

    for (const comp of left.components) {
      if (!rightComponentIds.has(comp.componentType)) {
        diffs.push({
          type: 'removed',
          path: `components.${comp.componentType}`,
          leftValue: comp,
          description: `Component ${comp.componentType} removed`,
        });
      }
    }

    for (const comp of right.components) {
      if (!leftComponentIds.has(comp.componentType)) {
        diffs.push({
          type: 'added',
          path: `components.${comp.componentType}`,
          rightValue: comp,
          description: `Component ${comp.componentType} added`,
        });
      }
    }

    return diffs;
  }

  private mapRowToBranch(row: Record<string, unknown>): QuantumBranch {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      sessionId: row.session_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      color: row.color as string,
      icon: row.icon as string,
      timelineId: row.timeline_id as string,
      status: row.status as QuantumBranchStatus,
      metrics: JSON.parse((row.metrics as string) || '{}'),
      parentBranchId: row.parent_branch_id as string | null,
      siblingBranchIds: JSON.parse((row.sibling_branch_ids as string) || '[]'),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      collapsedAt: row.collapsed_at 
        ? new Date(row.collapsed_at as string) 
        : undefined,
    };
  }
}

export const quantumFuturesService = new QuantumFuturesService();
