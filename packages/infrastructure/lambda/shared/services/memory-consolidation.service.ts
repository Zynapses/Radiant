// RADIANT v4.18.0 - Memory Consolidation Service
// Advanced Cognition: Compression, decay curves, conflict resolution, memory transfer

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export type JobType = 'compress' | 'decay' | 'conflict_resolve' | 'transfer' | 'prune';
export type ConflictType = 'contradiction' | 'inconsistency' | 'redundancy' | 'temporal_conflict';
export type ResolutionStrategy = 'newer_wins' | 'higher_confidence' | 'merge' | 'flag_for_review';

export interface ConsolidationJob {
  jobId: string;
  jobType: JobType;
  targetMemoryType?: string;
  status: string;
  memoriesProcessed: number;
  memoriesCompressed: number;
  memoriesPruned: number;
  conflictsFound: number;
  conflictsResolved: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface MemoryConflict {
  conflictId: string;
  memoryAId: string;
  memoryAContent: string;
  memoryAConfidence: number;
  memoryBId: string;
  memoryBContent: string;
  memoryBConfidence: number;
  conflictType: ConflictType;
  conflictDescription: string;
  severity: string;
  resolutionStatus: string;
  resolutionStrategy?: string;
  resolutionResult?: unknown;
}

export interface ConsolidationResult {
  jobId: string;
  memoriesProcessed: number;
  memoriesCompressed: number;
  memoriesPruned: number;
  conflictsFound: number;
  conflictsResolved: number;
  consolidatedMemories: string[];
  prunedMemories: string[];
}

export interface DecayConfig {
  baseDecayRate: number; // Per day
  importanceFloor: number; // Minimum importance
  accessBoost: number; // Boost when accessed
  emotionalMultiplier: number; // Higher for emotional memories
}

// ============================================================================
// Memory Consolidation Service
// ============================================================================

export class MemoryConsolidationService {
  private defaultDecayConfig: DecayConfig = {
    baseDecayRate: 0.05,
    importanceFloor: 0.1,
    accessBoost: 0.2,
    emotionalMultiplier: 0.5, // Slower decay for emotional memories
  };

  // ============================================================================
  // Job Management
  // ============================================================================

  async createConsolidationJob(
    tenantId: string,
    jobType: JobType,
    options: {
      targetMemoryType?: string;
      timeRangeStart?: Date;
      timeRangeEnd?: Date;
      memoryIds?: string[];
      compressionRatio?: number;
      importanceThreshold?: number;
      conflictStrategy?: ResolutionStrategy;
    } = {}
  ): Promise<ConsolidationJob> {
    const result = await executeStatement(
      `INSERT INTO memory_consolidation_jobs (
        tenant_id, job_type, target_memory_type, time_range_start, time_range_end,
        memory_ids, compression_ratio, importance_threshold, conflict_resolution_strategy
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'jobType', value: { stringValue: jobType } },
        { name: 'targetType', value: options.targetMemoryType ? { stringValue: options.targetMemoryType } : { isNull: true } },
        { name: 'timeStart', value: options.timeRangeStart ? { stringValue: options.timeRangeStart.toISOString() } : { isNull: true } },
        { name: 'timeEnd', value: options.timeRangeEnd ? { stringValue: options.timeRangeEnd.toISOString() } : { isNull: true } },
        { name: 'memoryIds', value: options.memoryIds ? { stringValue: `{${options.memoryIds.join(',')}}` } : { isNull: true } },
        { name: 'compressionRatio', value: options.compressionRatio ? { doubleValue: options.compressionRatio } : { isNull: true } },
        { name: 'importanceThreshold', value: options.importanceThreshold ? { doubleValue: options.importanceThreshold } : { isNull: true } },
        { name: 'conflictStrategy', value: options.conflictStrategy ? { stringValue: options.conflictStrategy } : { isNull: true } },
      ]
    );

    return this.mapJob(result.rows[0] as Record<string, unknown>);
  }

  async runConsolidationJob(jobId: string): Promise<ConsolidationResult> {
    // Mark job as running
    await executeStatement(
      `UPDATE memory_consolidation_jobs SET status = 'running', started_at = NOW() WHERE job_id = $1`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );

    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');

    try {
      let result: ConsolidationResult;

      switch (job.jobType) {
        case 'compress':
          result = await this.runCompressionJob(jobId);
          break;
        case 'decay':
          result = await this.runDecayJob(jobId);
          break;
        case 'conflict_resolve':
          result = await this.runConflictResolutionJob(jobId);
          break;
        case 'prune':
          result = await this.runPruneJob(jobId);
          break;
        case 'transfer':
          result = await this.runTransferJob(jobId);
          break;
        default:
          throw new Error(`Unknown job type: ${job.jobType}`);
      }

      // Mark job as completed
      await executeStatement(
        `UPDATE memory_consolidation_jobs SET
          status = 'completed',
          completed_at = NOW(),
          memories_processed = $2,
          memories_compressed = $3,
          memories_pruned = $4,
          conflicts_found = $5,
          conflicts_resolved = $6,
          consolidated_memories = $7,
          pruned_memories = $8
        WHERE job_id = $1`,
        [
          { name: 'jobId', value: { stringValue: jobId } },
          { name: 'processed', value: { longValue: result.memoriesProcessed } },
          { name: 'compressed', value: { longValue: result.memoriesCompressed } },
          { name: 'pruned', value: { longValue: result.memoriesPruned } },
          { name: 'conflictsFound', value: { longValue: result.conflictsFound } },
          { name: 'conflictsResolved', value: { longValue: result.conflictsResolved } },
          { name: 'consolidated', value: { stringValue: `{${result.consolidatedMemories.join(',')}}` } },
          { name: 'prunedMems', value: { stringValue: `{${result.prunedMemories.join(',')}}` } },
        ]
      );

      return result;

    } catch (error) {
      await executeStatement(
        `UPDATE memory_consolidation_jobs SET status = 'failed', error_message = $2 WHERE job_id = $1`,
        [
          { name: 'jobId', value: { stringValue: jobId } },
          { name: 'error', value: { stringValue: error instanceof Error ? error.message : 'Unknown error' } },
        ]
      );
      throw error;
    }
  }

  async getJob(jobId: string): Promise<ConsolidationJob | null> {
    const result = await executeStatement(
      `SELECT * FROM memory_consolidation_jobs WHERE job_id = $1`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapJob(result.rows[0] as Record<string, unknown>);
  }

  // ============================================================================
  // Compression
  // ============================================================================

  private async runCompressionJob(jobId: string): Promise<ConsolidationResult> {
    const jobResult = await executeStatement(
      `SELECT * FROM memory_consolidation_jobs WHERE job_id = $1`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );
    const job = jobResult.rows[0] as Record<string, unknown>;
    const tenantId = String(job.tenant_id);
    const compressionRatio = Number(job.compression_ratio || 0.7);

    // Get memories to compress
    const memoryResult = await executeStatement(
      `SELECT * FROM episodic_memories
       WHERE tenant_id = $1
         AND current_importance < 0.5
         AND last_accessed_at < NOW() - INTERVAL '7 days'
       ORDER BY current_importance ASC
       LIMIT 100`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const memories = memoryResult.rows;
    const consolidatedMemories: string[] = [];
    let memoriesCompressed = 0;

    // Group similar memories
    const groups = await this.groupSimilarMemories(tenantId, memories as Array<Record<string, unknown>>);

    for (const group of groups) {
      if (group.length > 1) {
        // Compress group into single memory
        const compressed = await this.compressMemoryGroup(tenantId, group);
        if (compressed) {
          consolidatedMemories.push(compressed);
          memoriesCompressed += group.length;
        }
      }
    }

    return {
      jobId,
      memoriesProcessed: memories.length,
      memoriesCompressed,
      memoriesPruned: 0,
      conflictsFound: 0,
      conflictsResolved: 0,
      consolidatedMemories,
      prunedMemories: [],
    };
  }

  private async groupSimilarMemories(tenantId: string, memories: Array<Record<string, unknown>>): Promise<Array<Array<Record<string, unknown>>>> {
    // Simple grouping by similarity - in production, use clustering
    const groups: Array<Array<Record<string, unknown>>> = [];
    const used = new Set<string>();

    for (const memory of memories) {
      if (used.has(String(memory.memory_id))) continue;

      const group = [memory];
      used.add(String(memory.memory_id));

      // Find similar memories
      const similarResult = await executeStatement(
        `SELECT *, 1 - (content_embedding <=> $2::vector) as similarity
         FROM episodic_memories
         WHERE tenant_id = $1 AND memory_id != $3
         ORDER BY content_embedding <=> $2::vector
         LIMIT 5`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'embedding', value: { stringValue: String(memory.content_embedding) } },
          { name: 'memoryId', value: { stringValue: String(memory.memory_id) } },
        ]
      );

      for (const similar of similarResult.rows) {
        const sim = similar as Record<string, unknown>;
        if (Number(sim.similarity) > 0.85 && !used.has(String(sim.memory_id))) {
          group.push(sim);
          used.add(String(sim.memory_id));
        }
      }

      groups.push(group);
    }

    return groups.filter((g) => g.length > 1);
  }

  private async compressMemoryGroup(tenantId: string, memories: Array<Record<string, unknown>>): Promise<string | null> {
    const contents = memories.map((m) => String(m.content)).join('\n\n---\n\n');

    const prompt = `Compress these related memories into a single, coherent summary that preserves the key information:

MEMORIES:
${contents.substring(0, 4000)}

Create a compressed summary that:
1. Captures the essential facts
2. Removes redundancy
3. Preserves important details
4. Is about ${Math.round(contents.length * 0.5)} characters or less

Return only the compressed memory text.`;

    try {
      const compressed = await this.invokeModel(prompt);

      // Create consolidated memory
      const embedding = await this.generateEmbedding(compressed);
      const maxImportance = Math.max(...memories.map((m) => Number(m.current_importance || 0)));

      const result = await executeStatement(
        `INSERT INTO episodic_memories (
          tenant_id, user_id, content, content_embedding, memory_type, current_importance,
          metadata
        ) VALUES ($1, $2, $3, $4::vector, 'consolidated', $5, $6)
        RETURNING memory_id`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: String(memories[0].user_id) } },
          { name: 'content', value: { stringValue: compressed } },
          { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
          { name: 'importance', value: { doubleValue: maxImportance } },
          { name: 'metadata', value: { stringValue: JSON.stringify({ consolidated_from: memories.map((m) => m.memory_id) }) } },
        ]
      );

      // Mark original memories as archived
      for (const memory of memories) {
        await executeStatement(
          `UPDATE episodic_memories SET is_active = false WHERE memory_id = $1`,
          [{ name: 'memoryId', value: { stringValue: String(memory.memory_id) } }]
        );
      }

      return (result.rows[0] as { memory_id: string }).memory_id;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Decay
  // ============================================================================

  private async runDecayJob(jobId: string): Promise<ConsolidationResult> {
    const jobResult = await executeStatement(
      `SELECT * FROM memory_consolidation_jobs WHERE job_id = $1`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );
    const job = jobResult.rows[0] as Record<string, unknown>;
    const tenantId = String(job.tenant_id);

    // Apply decay to episodic memories
    const decayResult = await executeStatement(
      `UPDATE episodic_memories SET
        current_importance = GREATEST(
          $2,
          current_importance * (1 - $3 * EXTRACT(DAY FROM NOW() - last_accessed_at))
        ),
        updated_at = NOW()
      WHERE tenant_id = $1
        AND current_importance > $2
        AND last_accessed_at < NOW() - INTERVAL '1 day'
      RETURNING memory_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'floor', value: { doubleValue: this.defaultDecayConfig.importanceFloor } },
        { name: 'decayRate', value: { doubleValue: this.defaultDecayConfig.baseDecayRate } },
      ]
    );

    return {
      jobId,
      memoriesProcessed: decayResult.rows.length,
      memoriesCompressed: 0,
      memoriesPruned: 0,
      conflictsFound: 0,
      conflictsResolved: 0,
      consolidatedMemories: [],
      prunedMemories: [],
    };
  }

  async boostMemoryImportance(memoryId: string, boost?: number): Promise<void> {
    const actualBoost = boost ?? this.defaultDecayConfig.accessBoost;

    await executeStatement(
      `UPDATE episodic_memories SET
        current_importance = LEAST(1.0, current_importance + $2),
        access_count = access_count + 1,
        last_accessed_at = NOW()
      WHERE memory_id = $1`,
      [
        { name: 'memoryId', value: { stringValue: memoryId } },
        { name: 'boost', value: { doubleValue: actualBoost } },
      ]
    );
  }

  // ============================================================================
  // Conflict Resolution
  // ============================================================================

  private async runConflictResolutionJob(jobId: string): Promise<ConsolidationResult> {
    const jobResult = await executeStatement(
      `SELECT * FROM memory_consolidation_jobs WHERE job_id = $1`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );
    const job = jobResult.rows[0] as Record<string, unknown>;
    const tenantId = String(job.tenant_id);
    const strategy = String(job.conflict_resolution_strategy || 'higher_confidence') as ResolutionStrategy;

    // Find potential conflicts
    const conflicts = await this.detectConflicts(tenantId);
    let conflictsResolved = 0;

    for (const conflict of conflicts) {
      const resolved = await this.resolveConflict(conflict.conflictId, strategy);
      if (resolved) conflictsResolved++;
    }

    return {
      jobId,
      memoriesProcessed: 0,
      memoriesCompressed: 0,
      memoriesPruned: 0,
      conflictsFound: conflicts.length,
      conflictsResolved,
      consolidatedMemories: [],
      prunedMemories: [],
    };
  }

  async detectConflicts(tenantId: string): Promise<MemoryConflict[]> {
    // Get recent semantic memories that might conflict
    const result = await executeStatement(
      `SELECT sm1.memory_id as id_a, sm1.content as content_a, sm1.confidence as conf_a,
              sm2.memory_id as id_b, sm2.content as content_b, sm2.confidence as conf_b,
              1 - (sm1.content_embedding <=> sm2.content_embedding) as similarity
       FROM semantic_memories sm1
       JOIN semantic_memories sm2 ON sm1.tenant_id = sm2.tenant_id
         AND sm1.memory_id < sm2.memory_id
         AND 1 - (sm1.content_embedding <=> sm2.content_embedding) > 0.8
       WHERE sm1.tenant_id = $1
         AND sm1.is_active = true AND sm2.is_active = true
       LIMIT 50`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const conflicts: MemoryConflict[] = [];

    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const conflictCheck = await this.checkForContradiction(String(r.content_a), String(r.content_b));

      if (conflictCheck.isConflict) {
        const insertResult = await executeStatement(
          `INSERT INTO memory_conflicts (
            tenant_id, memory_a_id, memory_a_type, memory_a_content, memory_a_confidence,
            memory_b_id, memory_b_type, memory_b_content, memory_b_confidence,
            conflict_type, conflict_description, severity
          ) VALUES ($1, $2, 'semantic', $3, $4, $5, 'semantic', $6, $7, $8, $9, $10)
          RETURNING conflict_id`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'idA', value: { stringValue: String(r.id_a) } },
            { name: 'contentA', value: { stringValue: String(r.content_a) } },
            { name: 'confA', value: { doubleValue: Number(r.conf_a || 0.5) } },
            { name: 'idB', value: { stringValue: String(r.id_b) } },
            { name: 'contentB', value: { stringValue: String(r.content_b) } },
            { name: 'confB', value: { doubleValue: Number(r.conf_b || 0.5) } },
            { name: 'type', value: { stringValue: conflictCheck.type } },
            { name: 'description', value: { stringValue: conflictCheck.description } },
            { name: 'severity', value: { stringValue: conflictCheck.severity } },
          ]
        );

        conflicts.push({
          conflictId: (insertResult.rows[0] as { conflict_id: string }).conflict_id,
          memoryAId: String(r.id_a),
          memoryAContent: String(r.content_a),
          memoryAConfidence: Number(r.conf_a || 0.5),
          memoryBId: String(r.id_b),
          memoryBContent: String(r.content_b),
          memoryBConfidence: Number(r.conf_b || 0.5),
          conflictType: conflictCheck.type as ConflictType,
          conflictDescription: conflictCheck.description,
          severity: conflictCheck.severity,
          resolutionStatus: 'pending',
        });
      }
    }

    return conflicts;
  }

  private async checkForContradiction(contentA: string, contentB: string): Promise<{
    isConflict: boolean;
    type: string;
    description: string;
    severity: string;
  }> {
    const prompt = `Analyze these two pieces of information for conflicts:

A: "${contentA.substring(0, 500)}"

B: "${contentB.substring(0, 500)}"

Check for:
1. Direct contradiction (A and B cannot both be true)
2. Inconsistency (A and B are partially incompatible)
3. Redundancy (A and B say the same thing)

Return JSON:
{
  "is_conflict": true/false,
  "type": "contradiction|inconsistency|redundancy|none",
  "description": "explanation of the conflict",
  "severity": "critical|major|minor"
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isConflict: parsed.is_conflict && parsed.type !== 'none',
          type: parsed.type || 'none',
          description: parsed.description || '',
          severity: parsed.severity || 'minor',
        };
      }
    } catch { /* no conflict detected */ }

    return { isConflict: false, type: 'none', description: '', severity: 'minor' };
  }

  async resolveConflict(conflictId: string, strategy: ResolutionStrategy): Promise<boolean> {
    const result = await executeStatement(
      `SELECT * FROM memory_conflicts WHERE conflict_id = $1`,
      [{ name: 'conflictId', value: { stringValue: conflictId } }]
    );

    if (result.rows.length === 0) return false;

    const conflict = result.rows[0] as Record<string, unknown>;
    let resolution: { winner?: string; merged?: string; action: string } | null = null;

    switch (strategy) {
      case 'newer_wins':
        // Would need timestamps - simplified here
        resolution = { winner: String(conflict.memory_b_id), action: 'keep_b_archive_a' };
        break;

      case 'higher_confidence':
        const confA = Number(conflict.memory_a_confidence || 0);
        const confB = Number(conflict.memory_b_confidence || 0);
        resolution = confA >= confB
          ? { winner: String(conflict.memory_a_id), action: 'keep_a_archive_b' }
          : { winner: String(conflict.memory_b_id), action: 'keep_b_archive_a' };
        break;

      case 'merge':
        const merged = await this.mergeConflictingMemories(
          String(conflict.memory_a_content),
          String(conflict.memory_b_content)
        );
        resolution = { merged, action: 'create_merged_archive_both' };
        break;

      case 'flag_for_review':
        resolution = { action: 'flagged' };
        break;
    }

    await executeStatement(
      `UPDATE memory_conflicts SET
        resolution_status = $2,
        resolution_strategy = $3,
        resolution_result = $4,
        resolved_by = 'system',
        resolved_at = NOW()
      WHERE conflict_id = $1`,
      [
        { name: 'conflictId', value: { stringValue: conflictId } },
        { name: 'status', value: { stringValue: strategy === 'flag_for_review' ? 'flagged' : 'auto_resolved' } },
        { name: 'strategy', value: { stringValue: strategy } },
        { name: 'result', value: { stringValue: JSON.stringify(resolution) } },
      ]
    );

    return true;
  }

  private async mergeConflictingMemories(contentA: string, contentB: string): Promise<string> {
    const prompt = `Merge these two conflicting pieces of information into a single coherent statement that captures the truth:

A: "${contentA}"
B: "${contentB}"

Create a merged statement that:
1. Resolves the conflict if possible
2. Notes uncertainty where appropriate
3. Preserves important information from both

Return only the merged text.`;

    try {
      return await this.invokeModel(prompt);
    } catch {
      return `[Merged] ${contentA} | ${contentB}`;
    }
  }

  // ============================================================================
  // Prune
  // ============================================================================

  private async runPruneJob(jobId: string): Promise<ConsolidationResult> {
    const jobResult = await executeStatement(
      `SELECT * FROM memory_consolidation_jobs WHERE job_id = $1`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );
    const job = jobResult.rows[0] as Record<string, unknown>;
    const tenantId = String(job.tenant_id);
    const threshold = Number(job.importance_threshold || 0.1);

    // Find memories below threshold
    const pruneResult = await executeStatement(
      `UPDATE episodic_memories SET is_active = false
       WHERE tenant_id = $1
         AND current_importance < $2
         AND last_accessed_at < NOW() - INTERVAL '30 days'
       RETURNING memory_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'threshold', value: { doubleValue: threshold } },
      ]
    );

    return {
      jobId,
      memoriesProcessed: pruneResult.rows.length,
      memoriesCompressed: 0,
      memoriesPruned: pruneResult.rows.length,
      conflictsFound: 0,
      conflictsResolved: 0,
      consolidatedMemories: [],
      prunedMemories: pruneResult.rows.map((r) => (r as { memory_id: string }).memory_id),
    };
  }

  // ============================================================================
  // Transfer (Episodic → Semantic/Procedural)
  // ============================================================================

  private async runTransferJob(jobId: string): Promise<ConsolidationResult> {
    const jobResult = await executeStatement(
      `SELECT * FROM memory_consolidation_jobs WHERE job_id = $1`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );
    const job = jobResult.rows[0] as Record<string, unknown>;
    const tenantId = String(job.tenant_id);

    // Find episodic memories ready for transfer (high access, stable)
    const transferCandidates = await executeStatement(
      `SELECT * FROM episodic_memories
       WHERE tenant_id = $1
         AND access_count > 5
         AND current_importance > 0.7
         AND is_active = true
       ORDER BY access_count DESC
       LIMIT 20`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const consolidatedMemories: string[] = [];

    for (const memory of transferCandidates.rows) {
      const m = memory as Record<string, unknown>;
      const transferred = await this.transferToSemanticMemory(tenantId, m);
      if (transferred) consolidatedMemories.push(transferred);
    }

    return {
      jobId,
      memoriesProcessed: transferCandidates.rows.length,
      memoriesCompressed: 0,
      memoriesPruned: 0,
      conflictsFound: 0,
      conflictsResolved: 0,
      consolidatedMemories,
      prunedMemories: [],
    };
  }

  private async transferToSemanticMemory(tenantId: string, episodicMemory: Record<string, unknown>): Promise<string | null> {
    const content = String(episodicMemory.content);

    const prompt = `Extract a general fact or knowledge from this episodic memory:

"${content.substring(0, 1000)}"

If this memory contains a generalizable fact, concept, or piece of knowledge, extract it.
Return just the semantic knowledge, or "NONE" if no generalizable knowledge can be extracted.`;

    try {
      const semantic = await this.invokeModel(prompt);

      if (semantic.toUpperCase().includes('NONE')) return null;

      const embedding = await this.generateEmbedding(semantic);

      const result = await executeStatement(
        `INSERT INTO semantic_memories (
          tenant_id, user_id, content, content_embedding, category, confidence, source_type
        ) VALUES ($1, $2, $3, $4::vector, 'extracted', 0.8, 'episodic_transfer')
        RETURNING memory_id`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: String(episodicMemory.user_id) } },
          { name: 'content', value: { stringValue: semantic } },
          { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        ]
      );

      return (result.rows[0] as { memory_id: string }).memory_id;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Pending Conflicts
  // ============================================================================

  async getPendingConflicts(tenantId: string): Promise<MemoryConflict[]> {
    const result = await executeStatement(
      `SELECT * FROM memory_conflicts WHERE tenant_id = $1 AND resolution_status = 'pending' ORDER BY created_at DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map((row) => this.mapConflict(row as Record<string, unknown>));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      await modelRouterService.invoke({
        modelId: 'amazon/titan-embed-text',
        messages: [{ role: 'user', content: text.substring(0, 8000) }],
      });
      return new Array(1536).fill(0);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  private async invokeModel(prompt: string): Promise<string> {
    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    });
    return response.content;
  }

  private mapJob(row: Record<string, unknown>): ConsolidationJob {
    return {
      jobId: String(row.job_id),
      jobType: row.job_type as JobType,
      targetMemoryType: row.target_memory_type ? String(row.target_memory_type) : undefined,
      status: String(row.status),
      memoriesProcessed: Number(row.memories_processed || 0),
      memoriesCompressed: Number(row.memories_compressed || 0),
      memoriesPruned: Number(row.memories_pruned || 0),
      conflictsFound: Number(row.conflicts_found || 0),
      conflictsResolved: Number(row.conflicts_resolved || 0),
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }

  private mapConflict(row: Record<string, unknown>): MemoryConflict {
    return {
      conflictId: String(row.conflict_id),
      memoryAId: String(row.memory_a_id),
      memoryAContent: String(row.memory_a_content),
      memoryAConfidence: Number(row.memory_a_confidence || 0.5),
      memoryBId: String(row.memory_b_id),
      memoryBContent: String(row.memory_b_content),
      memoryBConfidence: Number(row.memory_b_confidence || 0.5),
      conflictType: row.conflict_type as ConflictType,
      conflictDescription: String(row.conflict_description),
      severity: String(row.severity),
      resolutionStatus: String(row.resolution_status),
      resolutionStrategy: row.resolution_strategy ? String(row.resolution_strategy) : undefined,
      resolutionResult: row.resolution_result,
    };
  }
}

export const memoryConsolidationService = new MemoryConsolidationService();
