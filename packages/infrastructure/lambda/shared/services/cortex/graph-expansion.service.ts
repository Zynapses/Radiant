/**
 * Cortex Graph Expansion Service (Twilight Dreaming v2)
 * Infers missing links and patterns from user interactions
 */

import { randomUUID } from 'crypto';
import type {
  GraphExpansionTask,
  InferredLink,
  PatternDetection,
} from '@radiant/shared';

/**
 * Conflict resolution tiers for Entropy Reversal moat
 */
type ConflictResolutionTier = 'basic' | 'llm' | 'human';

interface ConflictingFact {
  id: string;
  tenantId: string;
  factIdA: string;
  factIdB: string;
  factA: string;
  factB: string;
  sourceA: string;
  sourceB: string;
  dateA: Date;
  dateB: Date;
  status: 'pending' | 'resolved' | 'escalated';
  resolution?: ConflictResolution;
}

interface ConflictResolution {
  winner: 'A' | 'B' | 'BOTH_VALID' | 'MERGED';
  reason: string;
  resolvedBy: 'basic_rules' | 'llm' | 'human';
  confidence: number;
  resolvedAt: Date;
  resolvedByUserId?: string;
}

interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

interface ModelRouter {
  chat: (prompt: string, options?: { model?: string }) => Promise<string>;
}

interface ExpansionRequest {
  tenantId: string;
  taskType: GraphExpansionTask['taskType'];
  sourceNodeIds?: string[];
  targetScope?: GraphExpansionTask['targetScope'];
}

export class GraphExpansionService {
  private modelRouter?: ModelRouter;
  
  constructor(private db: DbClient, modelRouter?: ModelRouter) {
    this.modelRouter = modelRouter;
  }

  /**
   * Create a new graph expansion task
   */
  async createTask(request: ExpansionRequest): Promise<GraphExpansionTask> {
    const result = await this.db.query(
      `INSERT INTO cortex_graph_expansion_tasks (
        tenant_id, task_type, source_node_ids, target_scope, status
      ) VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *`,
      [
        request.tenantId,
        request.taskType,
        request.sourceNodeIds || [],
        request.targetScope || 'local',
      ]
    );

    return this.mapRowToTask(result.rows[0]);
  }

  /**
   * Run graph expansion analysis
   */
  async runTask(taskId: string, tenantId: string): Promise<GraphExpansionTask> {
    // Mark as running
    await this.db.query(
      `UPDATE cortex_graph_expansion_tasks 
       SET status = 'running', started_at = NOW(), progress = 0
       WHERE id = $1 AND tenant_id = $2`,
      [taskId, tenantId]
    );

    const task = await this.getTask(taskId, tenantId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    try {
      let discoveredLinks: InferredLink[] = [];

      switch (task.taskType) {
        case 'infer_links':
          discoveredLinks = await this.inferLinks(task);
          break;
        case 'cluster_entities':
          discoveredLinks = await this.clusterEntities(task);
          break;
        case 'detect_patterns':
          await this.detectPatterns(task);
          break;
        case 'merge_duplicates':
          discoveredLinks = await this.findDuplicates(task);
          break;
      }

      // Save discovered links
      for (const link of discoveredLinks) {
        await this.db.query(
          `INSERT INTO cortex_inferred_links (
            task_id, tenant_id, source_node_id, target_node_id, 
            edge_type, confidence, evidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            taskId,
            tenantId,
            link.sourceNodeId,
            link.targetNodeId,
            link.edgeType,
            link.confidence,
            JSON.stringify(link.evidence),
          ]
        );
      }

      // Mark as completed
      await this.db.query(
        `UPDATE cortex_graph_expansion_tasks 
         SET status = 'completed', completed_at = NOW(), progress = 100,
             discovered_links = $1
         WHERE id = $2`,
        [JSON.stringify(discoveredLinks), taskId]
      );

      return { ...task, status: 'completed', discoveredLinks, progress: 100 };
    } catch (err) {
      await this.db.query(
        `UPDATE cortex_graph_expansion_tasks 
         SET status = 'failed', error = $1
         WHERE id = $2`,
        [(err as Error).message, taskId]
      );
      throw err;
    }
  }

  /**
   * Infer missing links based on co-occurrence and semantic similarity
   */
  private async inferLinks(task: GraphExpansionTask): Promise<InferredLink[]> {
    const links: InferredLink[] = [];

    // Find nodes that are frequently accessed together but not connected
    const coOccurrenceResult = await this.db.query(
      `WITH access_pairs AS (
        SELECT DISTINCT
          a1.node_id as node1,
          a2.node_id as node2,
          COUNT(*) as co_access_count
        FROM cortex_graph_access_log a1
        JOIN cortex_graph_access_log a2 
          ON a1.session_id = a2.session_id 
          AND a1.node_id < a2.node_id
          AND a1.tenant_id = $1
        GROUP BY a1.node_id, a2.node_id
        HAVING COUNT(*) >= 3
      )
      SELECT ap.*, n1.label as label1, n2.label as label2
      FROM access_pairs ap
      JOIN cortex_graph_nodes n1 ON ap.node1 = n1.id
      JOIN cortex_graph_nodes n2 ON ap.node2 = n2.id
      WHERE NOT EXISTS (
        SELECT 1 FROM cortex_graph_edges e
        WHERE (e.source_node_id = ap.node1 AND e.target_node_id = ap.node2)
           OR (e.source_node_id = ap.node2 AND e.target_node_id = ap.node1)
      )
      LIMIT 100`,
      [task.tenantId]
    );

    for (const row of coOccurrenceResult.rows) {
      const r = row as Record<string, unknown>;
      const coAccessCount = r.co_access_count as number;
      const confidence = Math.min(0.9, 0.5 + (coAccessCount * 0.05));

      links.push({
        sourceNodeId: r.node1 as string,
        targetNodeId: r.node2 as string,
        edgeType: 'relates_to',
        confidence,
        evidence: [
          `Co-accessed ${coAccessCount} times in the same session`,
          `Source: "${r.label1}"`,
          `Target: "${r.label2}"`,
        ],
      });
    }

    // Update progress
    await this.updateProgress(task.id, 50);

    // Find semantically similar nodes using vector similarity
    const similarityResult = await this.db.query(
      `SELECT 
        n1.id as node1, n2.id as node2,
        n1.label as label1, n2.label as label2,
        1 - (n1.embedding <=> n2.embedding) as similarity
      FROM cortex_graph_nodes n1
      JOIN cortex_graph_nodes n2 
        ON n1.tenant_id = n2.tenant_id 
        AND n1.id < n2.id
        AND n1.node_type = n2.node_type
      WHERE n1.tenant_id = $1
        AND n1.embedding IS NOT NULL
        AND n2.embedding IS NOT NULL
        AND 1 - (n1.embedding <=> n2.embedding) > 0.85
        AND NOT EXISTS (
          SELECT 1 FROM cortex_graph_edges e
          WHERE (e.source_node_id = n1.id AND e.target_node_id = n2.id)
             OR (e.source_node_id = n2.id AND e.target_node_id = n1.id)
        )
      ORDER BY similarity DESC
      LIMIT 50`,
      [task.tenantId]
    );

    for (const row of similarityResult.rows) {
      const r = row as Record<string, unknown>;
      links.push({
        sourceNodeId: r.node1 as string,
        targetNodeId: r.node2 as string,
        edgeType: 'similar_to',
        confidence: r.similarity as number,
        evidence: [
          `Vector similarity: ${((r.similarity as number) * 100).toFixed(1)}%`,
          `Source: "${r.label1}"`,
          `Target: "${r.label2}"`,
        ],
      });
    }

    return links;
  }

  /**
   * Cluster related entities
   */
  private async clusterEntities(task: GraphExpansionTask): Promise<InferredLink[]> {
    const links: InferredLink[] = [];

    // Find entities that share common neighbors
    const clusterResult = await this.db.query(
      `WITH node_neighbors AS (
        SELECT 
          source_node_id as node_id,
          array_agg(DISTINCT target_node_id) as neighbors
        FROM cortex_graph_edges
        WHERE tenant_id = $1
        GROUP BY source_node_id
      )
      SELECT 
        nn1.node_id as node1,
        nn2.node_id as node2,
        array_length(array(
          SELECT unnest(nn1.neighbors) 
          INTERSECT 
          SELECT unnest(nn2.neighbors)
        ), 1) as shared_count,
        n1.label as label1,
        n2.label as label2
      FROM node_neighbors nn1
      JOIN node_neighbors nn2 ON nn1.node_id < nn2.node_id
      JOIN cortex_graph_nodes n1 ON nn1.node_id = n1.id
      JOIN cortex_graph_nodes n2 ON nn2.node_id = n2.id
      WHERE array_length(array(
        SELECT unnest(nn1.neighbors) 
        INTERSECT 
        SELECT unnest(nn2.neighbors)
      ), 1) >= 2
      AND NOT EXISTS (
        SELECT 1 FROM cortex_graph_edges e
        WHERE (e.source_node_id = nn1.node_id AND e.target_node_id = nn2.node_id)
           OR (e.source_node_id = nn2.node_id AND e.target_node_id = nn1.node_id)
      )
      ORDER BY shared_count DESC
      LIMIT 50`,
      [task.tenantId]
    );

    for (const row of clusterResult.rows) {
      const r = row as Record<string, unknown>;
      const sharedCount = r.shared_count as number;
      const confidence = Math.min(0.85, 0.4 + (sharedCount * 0.1));

      links.push({
        sourceNodeId: r.node1 as string,
        targetNodeId: r.node2 as string,
        edgeType: 'clustered_with',
        confidence,
        evidence: [
          `Shares ${sharedCount} common neighbors`,
          `Source: "${r.label1}"`,
          `Target: "${r.label2}"`,
        ],
      });
    }

    return links;
  }

  /**
   * Detect patterns in the graph
   */
  private async detectPatterns(task: GraphExpansionTask): Promise<void> {
    // Detect sequence patterns
    const sequenceResult = await this.db.query(
      `WITH edge_sequences AS (
        SELECT 
          e1.source_node_id as start_node,
          e1.target_node_id as mid_node,
          e2.target_node_id as end_node,
          e1.edge_type as edge1_type,
          e2.edge_type as edge2_type,
          COUNT(*) OVER (PARTITION BY e1.edge_type, e2.edge_type) as pattern_count
        FROM cortex_graph_edges e1
        JOIN cortex_graph_edges e2 ON e1.target_node_id = e2.source_node_id
        WHERE e1.tenant_id = $1
      )
      SELECT DISTINCT edge1_type, edge2_type, pattern_count
      FROM edge_sequences
      WHERE pattern_count >= 5
      ORDER BY pattern_count DESC
      LIMIT 10`,
      [task.tenantId]
    );

    for (const row of sequenceResult.rows) {
      const r = row as Record<string, unknown>;
      await this.db.query(
        `INSERT INTO cortex_pattern_detections (
          tenant_id, pattern_type, description, confidence, suggested_action
        ) VALUES ($1, 'sequence', $2, $3, $4)`,
        [
          task.tenantId,
          `Frequent path: ${r.edge1_type} → ${r.edge2_type} (${r.pattern_count} occurrences)`,
          Math.min(0.9, 0.5 + ((r.pattern_count as number) * 0.02)),
          'Consider creating a shortcut edge for frequently traversed paths',
        ]
      );
    }

    // Detect anomalies (nodes with unusual connectivity)
    const anomalyResult = await this.db.query(
      `WITH node_degrees AS (
        SELECT 
          n.id,
          n.label,
          COUNT(DISTINCT e.id) as degree,
          AVG(COUNT(DISTINCT e.id)) OVER () as avg_degree,
          STDDEV(COUNT(DISTINCT e.id)) OVER () as stddev_degree
        FROM cortex_graph_nodes n
        LEFT JOIN cortex_graph_edges e 
          ON n.id = e.source_node_id OR n.id = e.target_node_id
        WHERE n.tenant_id = $1
        GROUP BY n.id, n.label
      )
      SELECT id, label, degree, avg_degree, stddev_degree
      FROM node_degrees
      WHERE ABS(degree - avg_degree) > 2 * stddev_degree
      LIMIT 20`,
      [task.tenantId]
    );

    for (const row of anomalyResult.rows) {
      const r = row as Record<string, unknown>;
      const isHighDegree = (r.degree as number) > (r.avg_degree as number);
      
      await this.db.query(
        `INSERT INTO cortex_pattern_detections (
          tenant_id, pattern_type, description, affected_nodes, confidence, suggested_action
        ) VALUES ($1, 'anomaly', $2, $3, $4, $5)`,
        [
          task.tenantId,
          isHighDegree
            ? `Hub node detected: "${r.label}" has ${r.degree} connections (avg: ${Math.round(r.avg_degree as number)})`
            : `Isolated node detected: "${r.label}" has only ${r.degree} connections`,
          [r.id],
          0.8,
          isHighDegree
            ? 'Review if this is a valid hub or needs decomposition'
            : 'Consider connecting to related nodes or removing if obsolete',
        ]
      );
    }
  }

  /**
   * Find duplicate or near-duplicate nodes
   */
  private async findDuplicates(task: GraphExpansionTask): Promise<InferredLink[]> {
    const links: InferredLink[] = [];

    // Find nodes with very similar labels
    const duplicateResult = await this.db.query(
      `SELECT 
        n1.id as node1, n2.id as node2,
        n1.label as label1, n2.label as label2,
        similarity(n1.label, n2.label) as label_sim
      FROM cortex_graph_nodes n1
      JOIN cortex_graph_nodes n2 
        ON n1.tenant_id = n2.tenant_id 
        AND n1.id < n2.id
        AND n1.node_type = n2.node_type
      WHERE n1.tenant_id = $1
        AND similarity(n1.label, n2.label) > 0.8
      ORDER BY label_sim DESC
      LIMIT 50`,
      [task.tenantId]
    );

    for (const row of duplicateResult.rows) {
      const r = row as Record<string, unknown>;
      links.push({
        sourceNodeId: r.node1 as string,
        targetNodeId: r.node2 as string,
        edgeType: 'duplicate_of',
        confidence: r.label_sim as number,
        evidence: [
          `Label similarity: ${((r.label_sim as number) * 100).toFixed(1)}%`,
          `Node 1: "${r.label1}"`,
          `Node 2: "${r.label2}"`,
          'Consider merging these nodes',
        ],
      });
    }

    return links;
  }

  /**
   * Approve an inferred link and create actual edge
   */
  async approveLink(linkId: string, tenantId: string, userId: string): Promise<void> {
    const linkResult = await this.db.query(
      `SELECT * FROM cortex_inferred_links WHERE id = $1 AND tenant_id = $2`,
      [linkId, tenantId]
    );

    if (linkResult.rows.length === 0) {
      throw new Error(`Inferred link not found: ${linkId}`);
    }

    const link = linkResult.rows[0] as Record<string, unknown>;

    // Create actual edge in graph
    await this.db.query(
      `INSERT INTO cortex_graph_edges (
        tenant_id, source_node_id, target_node_id, edge_type, 
        weight, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantId,
        link.source_node_id,
        link.target_node_id,
        link.edge_type,
        link.confidence,
        JSON.stringify({
          inferredBy: 'graph_expansion',
          approvedBy: userId,
          approvedAt: new Date().toISOString(),
          evidence: link.evidence,
        }),
      ]
    );

    // Mark link as approved
    await this.db.query(
      `UPDATE cortex_inferred_links 
       SET is_approved = true, approved_by = $1, approved_at = NOW()
       WHERE id = $2`,
      [userId, linkId]
    );
  }

  /**
   * Reject an inferred link
   */
  async rejectLink(linkId: string, tenantId: string): Promise<void> {
    await this.db.query(
      `UPDATE cortex_inferred_links SET is_approved = false WHERE id = $1 AND tenant_id = $2`,
      [linkId, tenantId]
    );
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string, tenantId: string): Promise<GraphExpansionTask | null> {
    const result = await this.db.query(
      `SELECT * FROM cortex_graph_expansion_tasks WHERE id = $1 AND tenant_id = $2`,
      [taskId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTask(result.rows[0]);
  }

  /**
   * List expansion tasks
   */
  async listTasks(
    tenantId: string,
    options: { status?: GraphExpansionTask['status']; taskType?: GraphExpansionTask['taskType'] } = {}
  ): Promise<GraphExpansionTask[]> {
    let sql = `SELECT * FROM cortex_graph_expansion_tasks WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (options.status) {
      params.push(options.status);
      sql += ` AND status = $${params.length}`;
    }
    if (options.taskType) {
      params.push(options.taskType);
      sql += ` AND task_type = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await this.db.query(sql, params);
    return result.rows.map((row) => this.mapRowToTask(row));
  }

  /**
   * Get pending inferred links for review
   */
  async getPendingLinks(tenantId: string, limit = 50): Promise<InferredLink[]> {
    const result = await this.db.query(
      `SELECT * FROM cortex_inferred_links 
       WHERE tenant_id = $1 AND is_approved IS NULL
       ORDER BY confidence DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows.map((row) => this.mapRowToLink(row));
  }

  /**
   * Get detected patterns
   */
  async getPatterns(tenantId: string, patternType?: PatternDetection['patternType']): Promise<PatternDetection[]> {
    let sql = `SELECT * FROM cortex_pattern_detections WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (patternType) {
      params.push(patternType);
      sql += ` AND pattern_type = $${params.length}`;
    }

    sql += ` ORDER BY detected_at DESC`;

    const result = await this.db.query(sql, params);
    return result.rows.map((row) => this.mapRowToPattern(row));
  }

  private async updateProgress(taskId: string, progress: number): Promise<void> {
    await this.db.query(
      `UPDATE cortex_graph_expansion_tasks SET progress = $1 WHERE id = $2`,
      [progress, taskId]
    );
  }

  private mapRowToTask(row: unknown): GraphExpansionTask {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      taskType: r.task_type as GraphExpansionTask['taskType'],
      sourceNodeIds: (r.source_node_ids as string[]) || [],
      targetScope: r.target_scope as GraphExpansionTask['targetScope'],
      status: r.status as GraphExpansionTask['status'],
      progress: r.progress as number,
      discoveredLinks: (r.discovered_links as InferredLink[]) || [],
      createdAt: new Date(r.created_at as string),
      startedAt: r.started_at ? new Date(r.started_at as string) : undefined,
      completedAt: r.completed_at ? new Date(r.completed_at as string) : undefined,
      error: r.error as string | undefined,
    };
  }

  private mapRowToLink(row: unknown): InferredLink {
    const r = row as Record<string, unknown>;
    return {
      sourceNodeId: r.source_node_id as string,
      targetNodeId: r.target_node_id as string,
      edgeType: r.edge_type as string,
      confidence: r.confidence as number,
      evidence: (r.evidence as string[]) || [],
      isApproved: r.is_approved as boolean | undefined,
      approvedBy: r.approved_by as string | undefined,
      approvedAt: r.approved_at ? new Date(r.approved_at as string) : undefined,
    };
  }

  private mapRowToPattern(row: unknown): PatternDetection {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      patternType: r.pattern_type as PatternDetection['patternType'],
      description: r.description as string,
      affectedNodes: (r.affected_nodes as string[]) || [],
      confidence: r.confidence as number,
      suggestedAction: r.suggested_action as string | undefined,
      detectedAt: new Date(r.detected_at as string),
    };
  }

  // ============================================================================
  // HYBRID CONFLICT RESOLUTION (Entropy Reversal Moat)
  // ============================================================================

  /**
   * Resolve all pending conflicts using the hybrid 3-tier approach:
   * - Tier 1 (Basic Rules): ~95% of conflicts - deterministic rules
   * - Tier 2 (LLM): ~4% of conflicts - semantic reasoning
   * - Tier 3 (Human): ~1% of conflicts - edge cases requiring expertise
   */
  async resolveConflicts(tenantId: string): Promise<{ resolved: number; escalated: number }> {
    const conflicts = await this.getPendingConflicts(tenantId);
    let resolved = 0;
    let escalated = 0;

    for (const conflict of conflicts) {
      const tier = this.determineResolutionTier(conflict);
      
      try {
        switch (tier) {
          case 'basic':
            await this.resolveWithBasicRules(conflict);
            resolved++;
            break;
          case 'llm':
            if (this.modelRouter) {
              await this.resolveWithLLM(conflict);
              resolved++;
            } else {
              await this.escalateToHuman(conflict, 'LLM not available');
              escalated++;
            }
            break;
          case 'human':
            await this.escalateToHuman(conflict, 'Requires human expertise');
            escalated++;
            break;
        }
      } catch (err) {
        await this.escalateToHuman(conflict, `Resolution failed: ${(err as Error).message}`);
        escalated++;
      }
    }

    return { resolved, escalated };
  }

  /**
   * Determine which resolution tier to use based on conflict characteristics
   */
  private determineResolutionTier(conflict: ConflictingFact): ConflictResolutionTier {
    // Rule 1: If one source is significantly newer (>30 days), use basic rules
    const daysDiff = Math.abs(
      (conflict.dateA.getTime() - conflict.dateB.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 30) {
      return 'basic';
    }

    // Rule 2: If facts are nearly identical (typo-level difference), use basic rules
    const similarity = this.calculateStringSimilarity(conflict.factA, conflict.factB);
    if (similarity > 0.9) {
      return 'basic';
    }

    // Rule 3: If facts contain numbers that differ significantly, escalate to LLM
    const numbersA = conflict.factA.match(/\d+(\.\d+)?/g) || [];
    const numbersB = conflict.factB.match(/\d+(\.\d+)?/g) || [];
    if (numbersA.length > 0 && numbersB.length > 0) {
      return 'llm';
    }

    // Rule 4: If sources are both authoritative, escalate to human
    const authoritativeSources = ['official', 'verified', 'certified', 'approved'];
    const sourceAAuthority = authoritativeSources.some(s => 
      conflict.sourceA.toLowerCase().includes(s)
    );
    const sourceBAuthority = authoritativeSources.some(s => 
      conflict.sourceB.toLowerCase().includes(s)
    );
    if (sourceAAuthority && sourceBAuthority) {
      return 'human';
    }

    // Default: Use LLM for semantic reasoning
    return 'llm';
  }

  /**
   * Tier 1: Resolve using deterministic basic rules
   * Handles ~95% of conflicts
   */
  private async resolveWithBasicRules(conflict: ConflictingFact): Promise<void> {
    let winner: 'A' | 'B' = 'A';
    let reason = '';

    // Rule 1: Newer document supersedes older
    if (conflict.dateA > conflict.dateB) {
      winner = 'A';
      reason = `Source A is newer (${conflict.dateA.toISOString()} vs ${conflict.dateB.toISOString()})`;
    } else if (conflict.dateB > conflict.dateA) {
      winner = 'B';
      reason = `Source B is newer (${conflict.dateB.toISOString()} vs ${conflict.dateA.toISOString()})`;
    } else {
      // Rule 2: If same date, prefer more specific/longer content
      if (conflict.factA.length > conflict.factB.length * 1.2) {
        winner = 'A';
        reason = 'Source A provides more detailed information';
      } else if (conflict.factB.length > conflict.factA.length * 1.2) {
        winner = 'B';
        reason = 'Source B provides more detailed information';
      } else {
        winner = 'A';
        reason = 'Sources are equivalent; defaulting to first encountered';
      }
    }

    await this.applyResolution(conflict.id, {
      winner,
      reason,
      resolvedBy: 'basic_rules',
      confidence: 0.85,
      resolvedAt: new Date(),
    });
  }

  /**
   * Tier 2: Resolve using LLM for semantic reasoning
   * Handles ~4% of conflicts
   */
  private async resolveWithLLM(conflict: ConflictingFact): Promise<void> {
    if (!this.modelRouter) {
      throw new Error('LLM not available for conflict resolution');
    }

    const prompt = `You are resolving a factual conflict in a knowledge base.

**Fact A** (from: ${conflict.sourceA}, date: ${conflict.dateA.toISOString()}):
"${conflict.factA}"

**Fact B** (from: ${conflict.sourceB}, date: ${conflict.dateB.toISOString()}):
"${conflict.factB}"

Analyze these facts and determine:
1. Which is more likely correct (A or B)
2. If both could be valid in different contexts (BOTH_VALID)
3. If they can be merged into a single accurate statement (MERGED)

Respond in JSON format:
{
  "winner": "A" | "B" | "BOTH_VALID" | "MERGED",
  "reason": "<explanation>",
  "confidence": <0.0-1.0>,
  "mergedFact": "<if winner is MERGED, provide the merged statement>"
}`;

    const response = await this.modelRouter.chat(prompt, { model: 'gpt-4o-mini' });
    
    try {
      const parsed = JSON.parse(response);
      const confidence = Math.min(0.95, Math.max(0.5, parsed.confidence || 0.7));

      // If confidence is too low, escalate to human
      if (confidence < 0.6) {
        await this.escalateToHuman(conflict, `LLM confidence too low: ${confidence}`);
        return;
      }

      await this.applyResolution(conflict.id, {
        winner: parsed.winner,
        reason: parsed.reason,
        resolvedBy: 'llm',
        confidence,
        resolvedAt: new Date(),
      });

      // If merged, update the winning fact with merged content
      if (parsed.winner === 'MERGED' && parsed.mergedFact) {
        await this.db.query(
          `UPDATE cortex_graph_nodes SET label = $1, 
           properties = properties || '{"merged": true}'::jsonb
           WHERE id = $2 AND tenant_id = $3`,
          [parsed.mergedFact, conflict.factIdA, conflict.tenantId]
        );
      }
    } catch {
      await this.escalateToHuman(conflict, 'LLM response could not be parsed');
    }
  }

  /**
   * Tier 3: Escalate to human for expert review
   * Handles ~1% of conflicts
   */
  private async escalateToHuman(conflict: ConflictingFact, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE cortex_conflicting_facts 
       SET status = 'escalated', 
           escalation_reason = $1,
           escalated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [reason, conflict.id, conflict.tenantId]
    );

    // Create notification for admin review
    await this.db.query(
      `INSERT INTO notifications (
        tenant_id, type, title, message, metadata, priority
      ) VALUES ($1, 'conflict_escalation', $2, $3, $4, 'medium')`,
      [
        conflict.tenantId,
        'Conflict Requires Human Review',
        `Facts from "${conflict.sourceA}" and "${conflict.sourceB}" conflict and require expert review.`,
        JSON.stringify({
          conflictId: conflict.id,
          factA: conflict.factA,
          factB: conflict.factB,
          reason,
        }),
      ]
    );
  }

  /**
   * Apply a resolution to a conflict
   */
  private async applyResolution(conflictId: string, resolution: ConflictResolution): Promise<void> {
    await this.db.query(
      `UPDATE cortex_conflicting_facts 
       SET status = 'resolved',
           resolution = $1,
           resolved_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(resolution), conflictId]
    );
  }

  /**
   * Get all pending conflicts for a tenant
   */
  async getPendingConflicts(tenantId: string): Promise<ConflictingFact[]> {
    const result = await this.db.query(
      `SELECT cf.*, 
              na.label as fact_a, nb.label as fact_b,
              na.properties->>'source' as source_a,
              nb.properties->>'source' as source_b,
              na.created_at as date_a, nb.created_at as date_b
       FROM cortex_conflicting_facts cf
       JOIN cortex_graph_nodes na ON cf.fact_id_a = na.id
       JOIN cortex_graph_nodes nb ON cf.fact_id_b = nb.id
       WHERE cf.tenant_id = $1 AND cf.status = 'pending'
       ORDER BY cf.created_at ASC`,
      [tenantId]
    );

    return result.rows.map(row => this.mapRowToConflict(row));
  }

  /**
   * Manually resolve a conflict (human intervention)
   */
  async resolveConflictManually(
    conflictId: string,
    tenantId: string,
    userId: string,
    winner: 'A' | 'B' | 'BOTH_VALID' | 'MERGED',
    reason: string,
    mergedFact?: string
  ): Promise<void> {
    await this.applyResolution(conflictId, {
      winner,
      reason,
      resolvedBy: 'human',
      confidence: 1.0,
      resolvedAt: new Date(),
      resolvedByUserId: userId,
    });

    // If merged, update the fact
    if (winner === 'MERGED' && mergedFact) {
      const conflict = await this.db.query(
        `SELECT fact_id_a FROM cortex_conflicting_facts WHERE id = $1`,
        [conflictId]
      );
      if (conflict.rows.length > 0) {
        const factIdA = (conflict.rows[0] as Record<string, unknown>).fact_id_a;
        await this.db.query(
          `UPDATE cortex_graph_nodes SET label = $1,
           properties = properties || '{"merged": true, "merged_by_human": true}'::jsonb
           WHERE id = $2 AND tenant_id = $3`,
          [mergedFact, factIdA, tenantId]
        );
      }
    }
  }

  /**
   * Get conflict resolution statistics
   */
  async getConflictStats(tenantId: string): Promise<{
    pending: number;
    resolved: number;
    escalated: number;
    byTier: { basic: number; llm: number; human: number };
  }> {
    const result = await this.db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'escalated') as escalated,
        COUNT(*) FILTER (WHERE resolution->>'resolvedBy' = 'basic_rules') as basic,
        COUNT(*) FILTER (WHERE resolution->>'resolvedBy' = 'llm') as llm,
        COUNT(*) FILTER (WHERE resolution->>'resolvedBy' = 'human') as human
       FROM cortex_conflicting_facts
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      pending: Number(row.pending) || 0,
      resolved: Number(row.resolved) || 0,
      escalated: Number(row.escalated) || 0,
      byTier: {
        basic: Number(row.basic) || 0,
        llm: Number(row.llm) || 0,
        human: Number(row.human) || 0,
      },
    };
  }

  private calculateStringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private mapRowToConflict(row: unknown): ConflictingFact {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      factIdA: r.fact_id_a as string,
      factIdB: r.fact_id_b as string,
      factA: r.fact_a as string,
      factB: r.fact_b as string,
      sourceA: (r.source_a as string) || 'unknown',
      sourceB: (r.source_b as string) || 'unknown',
      dateA: new Date(r.date_a as string),
      dateB: new Date(r.date_b as string),
      status: r.status as ConflictingFact['status'],
      resolution: r.resolution ? JSON.parse(r.resolution as string) : undefined,
    };
  }
}
