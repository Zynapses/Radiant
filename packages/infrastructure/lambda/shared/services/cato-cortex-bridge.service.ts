/**
 * Cato-Cortex Bridge Service
 * 
 * Integrates Cato's consciousness/memory systems with Cortex's tiered memory architecture.
 * This bridge ensures that:
 * 
 * 1. Cato's semantic memories flow to Cortex Warm Tier (knowledge graph)
 * 2. Cortex knowledge enriches Cato's ego context for Think Tank prompts
 * 3. Memory tier coordination (Hot → Warm → Cold) applies to Cato data
 * 4. GDPR erasure cascades through both systems
 * 
 * Architecture:
 * ┌─────────────────┐      ┌─────────────────┐
 * │   CATO SYSTEM   │      │  CORTEX SYSTEM  │
 * │                 │      │                 │
 * │ ┌─────────────┐ │      │ ┌─────────────┐ │
 * │ │GlobalMemory │◀┼──────┼▶│  Hot Tier   │ │
 * │ │ (working)   │ │      │ │   (Redis)   │ │
 * │ └─────────────┘ │      │ └─────────────┘ │
 * │       │         │      │       │         │
 * │       ▼         │      │       ▼         │
 * │ ┌─────────────┐ │      │ ┌─────────────┐ │
 * │ │GlobalMemory │◀┼──────┼▶│ Warm Tier   │ │
 * │ │ (semantic)  │ │      │ │  (Graph)    │ │
 * │ └─────────────┘ │      │ └─────────────┘ │
 * │       │         │      │       │         │
 * │       ▼         │      │       ▼         │
 * │ ┌─────────────┐ │      │ ┌─────────────┐ │
 * │ │GlobalMemory │◀┼──────┼▶│ Cold Tier   │ │
 * │ │ (episodic)  │ │      │ │ (Iceberg)   │ │
 * │ └─────────────┘ │      │ └─────────────┘ │
 * └─────────────────┘      └─────────────────┘
 *           │                      │
 *           └──────────┬───────────┘
 *                      ▼
 *             ┌─────────────────┐
 *             │   BRIDGE        │
 *             │ (This Service)  │
 *             └────────┬────────┘
 *                      ▼
 *             ┌─────────────────┐
 *             │  Think Tank     │
 *             │  Prompt Builder │
 *             └─────────────────┘
 */

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { globalMemoryService, type MemoryEntry } from './cato/global-memory.service';
import { tierCoordinatorService } from './cortex/tier-coordinator.service';

// ============================================================================
// Types
// ============================================================================

export interface CatoCortexConfig {
  tenantId: string;
  syncEnabled: boolean;
  syncSemanticToCortex: boolean;
  syncEpisodicToCortex: boolean;
  enrichEgoFromCortex: boolean;
  maxCortexNodesForContext: number;
  minRelevanceScore: number;
  autoPromoteHighImportance: boolean;
  importancePromotionThreshold: number;
}

export interface CortexKnowledgeResult {
  nodes: CortexGraphNode[];
  totalCount: number;
  relevanceScores: Map<string, number>;
}

export interface CortexGraphNode {
  id: string;
  tenantId: string;
  nodeType: string;
  label: string;
  properties: Record<string, unknown>;
  confidence: number;
  sourceType: 'cato_memory' | 'document' | 'user_input' | 'inferred';
  createdAt: Date;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
  details: string[];
}

export interface ContextEnrichment {
  knowledgeFacts: string[];
  relatedConcepts: string[];
  recentInteractions: string[];
  totalTokensEstimate: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Omit<CatoCortexConfig, 'tenantId'> = {
  syncEnabled: true,
  syncSemanticToCortex: true,
  syncEpisodicToCortex: false, // Episodic is personal, keep in Cato
  enrichEgoFromCortex: true,
  maxCortexNodesForContext: 10,
  minRelevanceScore: 0.3,
  autoPromoteHighImportance: true,
  importancePromotionThreshold: 0.8,
};

// ============================================================================
// Cato-Cortex Bridge Service
// ============================================================================

class CatoCortexBridgeService {
  private configCache = new Map<string, { config: CatoCortexConfig; loadedAt: number }>();
  private CONFIG_CACHE_TTL = 60000; // 1 minute

  // ============================================================================
  // Configuration
  // ============================================================================

  async getConfig(tenantId: string): Promise<CatoCortexConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM cato_cortex_bridge_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const config: CatoCortexConfig = {
          tenantId: String(row.tenant_id),
          syncEnabled: Boolean(row.sync_enabled ?? true),
          syncSemanticToCortex: Boolean(row.sync_semantic_to_cortex ?? true),
          syncEpisodicToCortex: Boolean(row.sync_episodic_to_cortex ?? false),
          enrichEgoFromCortex: Boolean(row.enrich_ego_from_cortex ?? true),
          maxCortexNodesForContext: Number(row.max_cortex_nodes_for_context || 10),
          minRelevanceScore: Number(row.min_relevance_score || 0.3),
          autoPromoteHighImportance: Boolean(row.auto_promote_high_importance ?? true),
          importancePromotionThreshold: Number(row.importance_promotion_threshold || 0.8),
        };
        this.configCache.set(tenantId, { config, loadedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to load Cato-Cortex bridge config, using defaults', { error: String(error) });
    }

    // Return defaults
    const config = { tenantId, ...DEFAULT_CONFIG };
    this.configCache.set(tenantId, { config, loadedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<CatoCortexConfig>): Promise<CatoCortexConfig> {
    const current = await this.getConfig(tenantId);
    const updated = { ...current, ...updates };

    await executeStatement(
      `INSERT INTO cato_cortex_bridge_config 
       (tenant_id, sync_enabled, sync_semantic_to_cortex, sync_episodic_to_cortex,
        enrich_ego_from_cortex, max_cortex_nodes_for_context, min_relevance_score,
        auto_promote_high_importance, importance_promotion_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tenant_id) DO UPDATE SET
         sync_enabled = $2,
         sync_semantic_to_cortex = $3,
         sync_episodic_to_cortex = $4,
         enrich_ego_from_cortex = $5,
         max_cortex_nodes_for_context = $6,
         min_relevance_score = $7,
         auto_promote_high_importance = $8,
         importance_promotion_threshold = $9,
         updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        { name: 'syncEnabled', value: { booleanValue: updated.syncEnabled } },
        { name: 'syncSemanticToCortex', value: { booleanValue: updated.syncSemanticToCortex } },
        { name: 'syncEpisodicToCortex', value: { booleanValue: updated.syncEpisodicToCortex } },
        { name: 'enrichEgoFromCortex', value: { booleanValue: updated.enrichEgoFromCortex } },
        { name: 'maxCortexNodes', value: { longValue: updated.maxCortexNodesForContext } },
        doubleParam('minRelevance', updated.minRelevanceScore),
        { name: 'autoPromote', value: { booleanValue: updated.autoPromoteHighImportance } },
        doubleParam('promotionThreshold', updated.importancePromotionThreshold),
      ]
    );

    this.configCache.delete(tenantId);
    return updated;
  }

  // ============================================================================
  // Cato → Cortex Sync (Memory to Knowledge Graph)
  // ============================================================================

  /**
   * Sync Cato's semantic memories to Cortex knowledge graph
   * Called during Twilight Dreaming or on high-importance memory creation
   */
  async syncCatoMemoriesToCortex(tenantId: string): Promise<SyncResult> {
    const config = await this.getConfig(tenantId);
    const result: SyncResult = { synced: 0, skipped: 0, errors: 0, details: [] };

    if (!config.syncEnabled) {
      result.details.push('Sync disabled for tenant');
      return result;
    }

    try {
      // Get semantic memories that haven't been synced
      const memories = await this.getUnsyncedMemories(tenantId, 'semantic');

      for (const memory of memories) {
        try {
          // Check if already exists in Cortex
          const existsInCortex = await this.checkCortexNodeExists(tenantId, memory.key);
          
          if (existsInCortex) {
            await this.markMemorySynced(memory.id);
            result.skipped++;
            continue;
          }

          // Create Cortex graph node from memory
          await this.createCortexNodeFromMemory(tenantId, memory);
          await this.markMemorySynced(memory.id);
          result.synced++;
        } catch (error) {
          result.errors++;
          result.details.push(`Error syncing memory ${memory.id}: ${String(error)}`);
        }
      }

      // Also sync high-importance episodic if configured
      if (config.syncEpisodicToCortex) {
        const episodicMemories = await this.getUnsyncedMemories(tenantId, 'episodic');
        const highImportance = episodicMemories.filter(m => m.importance >= config.importancePromotionThreshold);

        for (const memory of highImportance) {
          try {
            await this.createCortexNodeFromMemory(tenantId, memory);
            await this.markMemorySynced(memory.id);
            result.synced++;
          } catch (error) {
            result.errors++;
          }
        }
      }

      logger.info('Cato→Cortex sync completed', { tenantId, ...result });
    } catch (error) {
      logger.error('Cato→Cortex sync failed', { tenantId, error: String(error) });
      result.details.push(`Sync failed: ${String(error)}`);
    }

    return result;
  }

  /**
   * Create a Cortex graph node from a Cato memory entry
   */
  private async createCortexNodeFromMemory(tenantId: string, memory: MemoryEntry): Promise<string> {
    const nodeId = `cato_${memory.id}`;
    const nodeType = this.mapCatoMemoryTypeToCortexNodeType(memory.category);

    await executeStatement(
      `INSERT INTO cortex_graph_nodes 
       (id, tenant_id, node_type, label, properties, confidence, source, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
       ON CONFLICT (id) DO UPDATE SET
         label = $4,
         properties = $5,
         confidence = $6,
         updated_at = NOW()`,
      [
        stringParam('id', nodeId),
        stringParam('tenantId', tenantId),
        stringParam('nodeType', nodeType),
        stringParam('label', memory.key),
        stringParam('properties', JSON.stringify({
          catoMemoryId: memory.id,
          catoCategory: memory.category,
          value: memory.value,
          importance: memory.importance,
          accessCount: memory.accessCount,
          metadata: memory.metadata,
        })),
        doubleParam('confidence', memory.importance),
        stringParam('source', 'cato_memory'),
      ]
    );

    return nodeId;
  }

  private mapCatoMemoryTypeToCortexNodeType(category: MemoryEntry['category']): string {
    const mapping: Record<MemoryEntry['category'], string> = {
      semantic: 'fact',
      episodic: 'event',
      procedural: 'procedure',
      working: 'context',
    };
    return mapping[category] || 'fact';
  }

  // ============================================================================
  // Cortex → Cato Enrichment (Knowledge Graph to Ego Context)
  // ============================================================================

  /**
   * Retrieve relevant knowledge from Cortex to enrich Cato's ego context
   * Used when building Think Tank prompts
   */
  async getContextEnrichmentFromCortex(
    tenantId: string,
    query: string,
    options?: { maxNodes?: number; includeRelated?: boolean }
  ): Promise<ContextEnrichment> {
    const config = await this.getConfig(tenantId);
    const enrichment: ContextEnrichment = {
      knowledgeFacts: [],
      relatedConcepts: [],
      recentInteractions: [],
      totalTokensEstimate: 0,
    };

    if (!config.enrichEgoFromCortex) {
      return enrichment;
    }

    const maxNodes = options?.maxNodes || config.maxCortexNodesForContext;

    try {
      // Search Cortex knowledge graph for relevant facts
      const relevantNodes = await this.searchCortexNodes(tenantId, query, maxNodes);

      for (const node of relevantNodes) {
        const factText = this.formatNodeAsFactText(node);
        enrichment.knowledgeFacts.push(factText);
      }

      // Get related concepts if requested
      if (options?.includeRelated && relevantNodes.length > 0) {
        const relatedNodes = await this.getRelatedCortexNodes(
          tenantId,
          relevantNodes.map(n => n.id),
          5
        );
        enrichment.relatedConcepts = relatedNodes.map(n => n.label);
      }

      // Get recent interactions from Cato memory
      const recentMemories = await globalMemoryService.search(tenantId, {
        category: 'working',
        limit: 5,
      });
      enrichment.recentInteractions = recentMemories.map(m => String(m.value));

      // Estimate tokens
      const totalText = [
        ...enrichment.knowledgeFacts,
        ...enrichment.relatedConcepts,
        ...enrichment.recentInteractions,
      ].join(' ');
      enrichment.totalTokensEstimate = Math.ceil(totalText.length / 4);

    } catch (error) {
      logger.warn('Failed to get Cortex enrichment', { tenantId, error: String(error) });
    }

    return enrichment;
  }

  /**
   * Search Cortex graph nodes by semantic similarity
   */
  private async searchCortexNodes(
    tenantId: string,
    query: string,
    limit: number
  ): Promise<CortexGraphNode[]> {
    // Use text search for now; embedding search would be better
    const result = await executeStatement(
      `SELECT * FROM cortex_graph_nodes 
       WHERE tenant_id = $1 
       AND status = 'active'
       AND (label ILIKE $2 OR properties::text ILIKE $2)
       ORDER BY confidence DESC, created_at DESC
       LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('query', `%${query}%`),
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapRowToCortexNode(row as Record<string, unknown>));
  }

  /**
   * Get nodes related to given node IDs via edges
   */
  private async getRelatedCortexNodes(
    tenantId: string,
    nodeIds: string[],
    limit: number
  ): Promise<CortexGraphNode[]> {
    if (nodeIds.length === 0) return [];

    const result = await executeStatement(
      `SELECT DISTINCT n.* FROM cortex_graph_nodes n
       JOIN cortex_graph_edges e ON (n.id = e.target_node_id OR n.id = e.source_node_id)
       WHERE n.tenant_id = $1
       AND n.status = 'active'
       AND n.id NOT IN (SELECT unnest($2::uuid[]))
       AND (e.source_node_id = ANY($2::uuid[]) OR e.target_node_id = ANY($2::uuid[]))
       ORDER BY n.confidence DESC
       LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('nodeIds', `{${nodeIds.join(',')}}`),
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapRowToCortexNode(row as Record<string, unknown>));
  }

  private formatNodeAsFactText(node: CortexGraphNode): string {
    const props = node.properties;
    if (props.value) {
      return `${node.label}: ${JSON.stringify(props.value)}`;
    }
    return node.label;
  }

  // ============================================================================
  // Bidirectional Consistency
  // ============================================================================

  /**
   * When a Cato memory is updated, sync changes to Cortex
   */
  async onCatoMemoryUpdated(tenantId: string, memoryId: string): Promise<void> {
    const config = await this.getConfig(tenantId);
    if (!config.syncEnabled) return;

    try {
      const memory = await this.getMemoryById(tenantId, memoryId);
      if (!memory) return;

      // Check if high importance warrants immediate sync
      if (memory.importance >= config.importancePromotionThreshold && config.autoPromoteHighImportance) {
        await this.createCortexNodeFromMemory(tenantId, memory);
        await this.markMemorySynced(memoryId);
        logger.info('High-importance memory promoted to Cortex', { tenantId, memoryId });
      }
    } catch (error) {
      logger.warn('Failed to sync updated memory to Cortex', { tenantId, memoryId, error: String(error) });
    }
  }

  /**
   * When a Cortex node is updated (e.g., via Golden Rule), sync back to Cato
   */
  async onCortexNodeUpdated(tenantId: string, nodeId: string): Promise<void> {
    try {
      // Check if this node originated from Cato
      if (!nodeId.startsWith('cato_')) return;

      const result = await executeStatement(
        `SELECT properties FROM cortex_graph_nodes WHERE id = $1 AND tenant_id = $2`,
        [stringParam('nodeId', nodeId), stringParam('tenantId', tenantId)]
      );

      if (result.rows.length === 0) return;

      const props = JSON.parse(String((result.rows[0] as Record<string, unknown>).properties || '{}'));
      const catoMemoryId = props.catoMemoryId;

      if (catoMemoryId) {
        // Update importance based on Cortex confidence
        const cortexResult = await executeStatement(
          `SELECT confidence FROM cortex_graph_nodes WHERE id = $1`,
          [stringParam('nodeId', nodeId)]
        );
        
        if (cortexResult.rows.length > 0) {
          const confidence = Number((cortexResult.rows[0] as Record<string, unknown>).confidence || 0.5);
          await executeStatement(
            `UPDATE cato_global_memory SET importance = $1, updated_at = NOW() WHERE id = $2`,
            [doubleParam('importance', confidence), stringParam('memoryId', catoMemoryId)]
          );
        }
      }
    } catch (error) {
      logger.warn('Failed to sync Cortex update to Cato', { tenantId, nodeId, error: String(error) });
    }
  }

  // ============================================================================
  // GDPR Erasure Cascade
  // ============================================================================

  /**
   * Cascade GDPR erasure across both Cato and Cortex
   */
  async cascadeGdprErasure(tenantId: string, userId?: string): Promise<{ catoDeleted: number; cortexDeleted: number }> {
    const result = { catoDeleted: 0, cortexDeleted: 0 };

    try {
      // Erase from Cato
      if (userId) {
        // User-specific erasure
        const catoResult = await executeStatement(
          `DELETE FROM cato_global_memory 
           WHERE tenant_id = $1 AND metadata->>'userId' = $2`,
          [stringParam('tenantId', tenantId), stringParam('userId', userId)]
        );
        result.catoDeleted = catoResult.rowCount || 0;
      } else {
        // Tenant-wide erasure
        const catoResult = await executeStatement(
          `DELETE FROM cato_global_memory WHERE tenant_id = $1`,
          [stringParam('tenantId', tenantId)]
        );
        result.catoDeleted = catoResult.rowCount || 0;
      }

      // Erase from Cortex (mark as deleted, actual deletion handled by Tier Coordinator)
      if (userId) {
        const cortexResult = await executeStatement(
          `UPDATE cortex_graph_nodes SET status = 'deleted' 
           WHERE tenant_id = $1 AND properties->>'userId' = $2`,
          [stringParam('tenantId', tenantId), stringParam('userId', userId)]
        );
        result.cortexDeleted = cortexResult.rowCount || 0;
      } else {
        const cortexResult = await executeStatement(
          `UPDATE cortex_graph_nodes SET status = 'deleted' WHERE tenant_id = $1`,
          [stringParam('tenantId', tenantId)]
        );
        result.cortexDeleted = cortexResult.rowCount || 0;
      }

      logger.info('GDPR erasure cascaded across Cato and Cortex', { tenantId, userId, ...result });
    } catch (error) {
      logger.error('GDPR erasure cascade failed', { tenantId, userId, error: String(error) });
      throw error;
    }

    return result;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async getUnsyncedMemories(tenantId: string, category: MemoryEntry['category']): Promise<MemoryEntry[]> {
    const result = await executeStatement(
      `SELECT * FROM cato_global_memory 
       WHERE tenant_id = $1 
       AND category = $2 
       AND (synced_to_cortex IS NULL OR synced_to_cortex = false)
       ORDER BY importance DESC
       LIMIT 100`,
      [stringParam('tenantId', tenantId), stringParam('category', category)]
    );

    return result.rows.map(row => this.mapRowToMemoryEntry(row as Record<string, unknown>));
  }

  private async checkCortexNodeExists(tenantId: string, key: string): Promise<boolean> {
    const result = await executeStatement(
      `SELECT 1 FROM cortex_graph_nodes WHERE tenant_id = $1 AND label = $2 LIMIT 1`,
      [stringParam('tenantId', tenantId), stringParam('key', key)]
    );
    return result.rows.length > 0;
  }

  private async markMemorySynced(memoryId: string): Promise<void> {
    await executeStatement(
      `UPDATE cato_global_memory SET synced_to_cortex = true, synced_at = NOW() WHERE id = $1`,
      [stringParam('memoryId', memoryId)]
    );
  }

  private async getMemoryById(tenantId: string, memoryId: string): Promise<MemoryEntry | null> {
    const result = await executeStatement(
      `SELECT * FROM cato_global_memory WHERE tenant_id = $1 AND id = $2`,
      [stringParam('tenantId', tenantId), stringParam('memoryId', memoryId)]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapRowToMemoryEntry(result.rows[0] as Record<string, unknown>);
  }

  private mapRowToMemoryEntry(row: Record<string, unknown>): MemoryEntry {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      category: String(row.category) as MemoryEntry['category'],
      key: String(row.key),
      value: row.value ? JSON.parse(String(row.value)) : null,
      importance: Number(row.importance) || 0.5,
      accessCount: Number(row.access_count) || 0,
      lastAccessedAt: row.last_accessed_at ? new Date(String(row.last_accessed_at)) : new Date(),
      createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(),
      expiresAt: row.expires_at ? new Date(String(row.expires_at)) : undefined,
      metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
    };
  }

  private mapRowToCortexNode(row: Record<string, unknown>): CortexGraphNode {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      nodeType: String(row.node_type),
      label: String(row.label),
      properties: row.properties ? JSON.parse(String(row.properties)) : {},
      confidence: Number(row.confidence) || 0.5,
      sourceType: (row.source as CortexGraphNode['sourceType']) || 'document',
      createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(),
    };
  }
}

export const catoCortexBridgeService = new CatoCortexBridgeService();
