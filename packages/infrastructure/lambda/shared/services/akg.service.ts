/**
 * Autobiographical Knowledge Graph (AKG) Service v1.0.0
 * 
 * Auto-extracts entities and relationships from every conversation turn,
 * building a living knowledge graph per user. This is the core of the
 * Anticipatory Memory Architecture that leapfrogs Claude's flat memory.
 * 
 * Architecture:
 * ┌──────────────────┐
 * │  Conversation     │
 * │  Turn (user+AI)   │
 * └────────┬─────────┘
 *          ▼
 * ┌──────────────────┐
 * │  LLM Extraction   │  ← gpt-4o-mini (fast, cheap)
 * │  - entities        │
 * │  - relationships   │
 * │  - temporal edges  │
 * └────────┬─────────┘
 *          ▼
 * ┌──────────────────┐
 * │  Contradiction    │  ← Check against existing graph
 * │  Detection        │
 * └────────┬─────────┘
 *          ▼
 * ┌──────────────────┐
 * │  Graph Update     │  ← Merge into AKG (nodes + edges)
 * │  - upsert nodes   │
 * │  - upsert edges   │
 * │  - embeddings     │
 * └────────┬─────────┘
 *          ▼
 * ┌──────────────────┐
 * │  Context Builder  │  ← Build prompt context from graph
 * │  - traversal      │
 * │  - summarize      │
 * └──────────────────┘
 * 
 * Key Design Decisions:
 * - Extraction runs ASYNC after response delivery (doesn't block user)
 * - Uses gpt-4o-mini by default for speed/cost (configurable per tenant)
 * - Nodes are deduplicated by (tenant_id, user_id, label, entity_type)
 * - Edges are deduplicated by (tenant_id, user_id, source, target, relationship)
 * - Embeddings generated via Titan Embeddings for semantic search
 * - Importance = 40% frequency + 30% recency + 30% centrality
 */

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'akg/main',
  category: 'infrastructure',
  sourceType: 'application',
});
import { modelRouterService } from './model-router.service';

import type {
  AKGNode,
  AKGEdge,
  AKGExtractionResult,
  AKGGraphQuery,
  AKGGraphResult,
  AKGConfig,
  AKGEntityType,
  AKGRelationshipType,
  MemoryContradiction,
} from '@radiant/shared';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_AKG_CONFIG: Omit<AKGConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  extractionModel: 'openai/gpt-4o-mini',
  minEntityConfidence: 0.6,
  minEdgeConfidence: 0.5,
  maxNodesPerUser: 5000,
  maxEdgesPerUser: 20000,
  pruneAfterDays: 365,
  enabledEntityTypes: [],
  generateEmbeddings: true,
  maxExtractionTokens: 500,
};

// =============================================================================
// Extraction Prompt
// =============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are an entity and relationship extraction system. Given a conversation between a user and an AI assistant, extract:

1. ENTITIES: People, organizations, projects, technologies, concepts, locations, events, products, skills, preferences, goals, problems, decisions.
2. RELATIONSHIPS: How entities relate to each other (works_at, builds, uses, knows, prefers, manages, created, depends_on, part_of, located_in, interested_in, skilled_in, concerned_about, decided, avoids, collaborates_with, reports_to, owns, studies).

Output STRICT JSON:
{
  "entities": [
    {
      "label": "Entity Name",
      "type": "person|organization|project|technology|concept|location|event|product|skill|preference|goal|problem|decision|custom",
      "aliases": ["alt name"],
      "properties": {"role": "CEO", "since": "2024"},
      "confidence": 0.9
    }
  ],
  "relationships": [
    {
      "source": "Entity A",
      "target": "Entity B",
      "type": "works_at|builds|uses|knows|prefers|manages|created|depends_on|part_of|located_in|interested_in|skilled_in|concerned_about|decided|avoids|collaborates_with|reports_to|owns|studies|custom",
      "label": "works at",
      "properties": {"role": "CTO", "since": "2024-01"},
      "confidence": 0.85,
      "temporal": {"from": "2024-01", "until": null}
    }
  ]
}

Rules:
- Only extract entities/relationships explicitly mentioned or strongly implied
- Confidence 0.9+ for explicitly stated facts, 0.6-0.8 for implied
- Include temporal context when available (dates, "recently", "since")
- Normalize entity names (capitalize properly, use canonical form)
- Merge duplicate entities under the most common name
- Skip trivial/generic entities (e.g., "the project", "a tool")
- Maximum 20 entities and 30 relationships per extraction`;

// =============================================================================
// AKG Service
// =============================================================================

class AKGService {
  private configCache = new Map<string, { config: AKGConfig; loadedAt: number }>();
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ===========================================================================
  // Configuration
  // ===========================================================================

  async getConfig(tenantId: string): Promise<AKGConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM akg_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const config: AKGConfig = {
          tenantId,
          enabled: Boolean(row.enabled ?? true),
          extractionModel: String(row.extraction_model || DEFAULT_AKG_CONFIG.extractionModel),
          minEntityConfidence: Number(row.min_entity_confidence || DEFAULT_AKG_CONFIG.minEntityConfidence),
          minEdgeConfidence: Number(row.min_edge_confidence || DEFAULT_AKG_CONFIG.minEdgeConfidence),
          maxNodesPerUser: Number(row.max_nodes_per_user || DEFAULT_AKG_CONFIG.maxNodesPerUser),
          maxEdgesPerUser: Number(row.max_edges_per_user || DEFAULT_AKG_CONFIG.maxEdgesPerUser),
          pruneAfterDays: Number(row.prune_after_days || DEFAULT_AKG_CONFIG.pruneAfterDays),
          enabledEntityTypes: (row.enabled_entity_types as AKGEntityType[]) || [],
          generateEmbeddings: Boolean(row.generate_embeddings ?? true),
          maxExtractionTokens: Number(row.max_extraction_tokens || DEFAULT_AKG_CONFIG.maxExtractionTokens),
          createdAt: new Date(row.created_at as string),
          updatedAt: new Date(row.updated_at as string),
        };
        this.configCache.set(tenantId, { config, loadedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to load AKG config, using defaults', { tenantId, error: String(error) });
    }

    const config: AKGConfig = {
      tenantId,
      ...DEFAULT_AKG_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.configCache.set(tenantId, { config, loadedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<AKGConfig>): Promise<AKGConfig> {
    const current = await this.getConfig(tenantId);
    const updated = { ...current, ...updates, tenantId };

    await executeStatement(
      `INSERT INTO akg_config (
        tenant_id, enabled, extraction_model, min_entity_confidence, min_edge_confidence,
        max_nodes_per_user, max_edges_per_user, prune_after_days, enabled_entity_types,
        generate_embeddings, max_extraction_tokens
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = $2, extraction_model = $3, min_entity_confidence = $4,
        min_edge_confidence = $5, max_nodes_per_user = $6, max_edges_per_user = $7,
        prune_after_days = $8, enabled_entity_types = $9, generate_embeddings = $10,
        max_extraction_tokens = $11, updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        { name: 'enabled', value: { booleanValue: updated.enabled } },
        stringParam('model', updated.extractionModel),
        doubleParam('minEntity', updated.minEntityConfidence),
        doubleParam('minEdge', updated.minEdgeConfidence),
        { name: 'maxNodes', value: { longValue: updated.maxNodesPerUser } },
        { name: 'maxEdges', value: { longValue: updated.maxEdgesPerUser } },
        { name: 'pruneDays', value: { longValue: updated.pruneAfterDays } },
        stringParam('entityTypes', `{${updated.enabledEntityTypes.join(',')}}`),
        { name: 'embeddings', value: { booleanValue: updated.generateEmbeddings } },
        { name: 'maxTokens', value: { longValue: updated.maxExtractionTokens } },
      ]
    );

    this.configCache.delete(tenantId);
    return { ...updated, updatedAt: new Date() };
  }

  // ===========================================================================
  // Entity Extraction (runs after every conversation turn)
  // ===========================================================================

  /**
   * Extract entities and relationships from a conversation turn.
   * This is the core function called by the Brain Router after every response.
   * 
   * IMPORTANT: This runs ASYNC (fire-and-forget) so it doesn't block the user.
   */
  async extractFromConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
    userMessage: string,
    aiResponse: string,
  ): Promise<AKGExtractionResult> {
    const startTime = Date.now();
    const config = await this.getConfig(tenantId);

    if (!config.enabled) {
      return this.emptyExtractionResult(startTime);
    }

    try {
      // Step 1: Call LLM to extract entities and relationships
      const extractionPrompt = `Conversation turn to analyze:

USER: ${userMessage.substring(0, 2000)}

ASSISTANT: ${aiResponse.substring(0, 2000)}

Extract all entities and relationships from this conversation.`;

      const llmResult = await modelRouterService.invoke({
        tenantId,
        modelId: config.extractionModel,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: extractionPrompt },
        ],
        temperature: 0.1,
        maxTokens: config.maxExtractionTokens,
      });

      // Step 2: Parse extraction result
      const extracted = this.parseExtractionResponse(llmResult.content);
      if (!extracted) {
        logger.warn('AKG extraction returned unparseable result', { tenantId, userId, conversationId });
        await this.logExtraction(tenantId, userId, conversationId, 0, 0, 0, 0, 0, Date.now() - startTime, (llmResult.inputTokens || 0) + (llmResult.outputTokens || 0), config.extractionModel, 'Unparseable LLM response');
        return this.emptyExtractionResult(startTime);
      }

      // Step 3: Upsert nodes
      const newNodes: AKGNode[] = [];
      const updatedNodes: Array<{ nodeId: string; updates: Partial<AKGNode> }> = [];

      for (const entity of extracted.entities) {
        if (entity.confidence < config.minEntityConfidence) continue;
        if (config.enabledEntityTypes.length > 0 && !config.enabledEntityTypes.includes(entity.type as AKGEntityType)) continue;

        const upsertResult = await this.upsertNode(tenantId, userId, {
          entityType: entity.type as AKGEntityType,
          label: entity.label,
          aliases: entity.aliases || [],
          properties: entity.properties || {},
          confidence: entity.confidence,
          conversationId,
        });

        if (upsertResult.isNew) {
          newNodes.push(upsertResult.node);
        } else {
          updatedNodes.push({ nodeId: upsertResult.node.nodeId, updates: { mentionCount: upsertResult.node.mentionCount } });
        }
      }

      // Step 4: Upsert edges
      const newEdges: AKGEdge[] = [];
      const updatedEdges: Array<{ edgeId: string; updates: Partial<AKGEdge> }> = [];

      for (const rel of extracted.relationships) {
        if (rel.confidence < config.minEdgeConfidence) continue;

        // Resolve source and target node IDs by label
        const sourceNode = await this.findNodeByLabel(tenantId, userId, rel.source);
        const targetNode = await this.findNodeByLabel(tenantId, userId, rel.target);

        if (!sourceNode || !targetNode) continue;

        const edgeResult = await this.upsertEdge(tenantId, userId, {
          sourceNodeId: sourceNode.nodeId,
          targetNodeId: targetNode.nodeId,
          relationshipType: rel.type as AKGRelationshipType,
          label: rel.label,
          properties: rel.properties || {},
          confidence: rel.confidence,
          validFrom: rel.temporal?.from ? new Date(rel.temporal.from) : undefined,
          validUntil: rel.temporal?.until ? new Date(rel.temporal.until) : undefined,
          conversationId,
        });

        if (edgeResult.isNew) {
          newEdges.push(edgeResult.edge);
        } else {
          updatedEdges.push({ edgeId: edgeResult.edge.edgeId, updates: { weight: edgeResult.edge.weight } });
        }
      }

      // Step 5: Log extraction
      const latencyMs = Date.now() - startTime;
      const tokensUsed = (llmResult.inputTokens || 0) + (llmResult.outputTokens || 0);
      await this.logExtraction(tenantId, userId, conversationId, newNodes.length, updatedNodes.length, newEdges.length, updatedEdges.length, 0, latencyMs, tokensUsed, config.extractionModel);

      logger.info('AKG extraction completed', {
        tenantId, userId, conversationId,
        newNodes: newNodes.length, updatedNodes: updatedNodes.length,
        newEdges: newEdges.length, updatedEdges: updatedEdges.length,
        latencyMs, tokensUsed,
      });

      return {
        newNodes,
        updatedNodes,
        newEdges,
        updatedEdges,
        contradictions: [],
        extractionLatencyMs: latencyMs,
        tokensUsed,
        modelUsed: config.extractionModel,
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      logger.error('AKG extraction failed', { tenantId, userId, conversationId, error: String(error) });
      await this.logExtraction(tenantId, userId, conversationId, 0, 0, 0, 0, 0, latencyMs, 0, config.extractionModel, String(error));
      return this.emptyExtractionResult(startTime);
    }
  }

  // ===========================================================================
  // Node Operations
  // ===========================================================================

  /**
   * Upsert a node — create if new, update if exists (by label + entity_type).
   */
  private async upsertNode(
    tenantId: string,
    userId: string,
    params: {
      entityType: AKGEntityType;
      label: string;
      aliases: string[];
      properties: Record<string, unknown>;
      confidence: number;
      conversationId: string;
    }
  ): Promise<{ node: AKGNode; isNew: boolean }> {
    // Check if node already exists
    const existing = await this.findNodeByLabel(tenantId, userId, params.label);

    if (existing) {
      // Update existing node
      await executeStatement(
        `UPDATE akg_nodes SET
          mention_count = mention_count + 1,
          last_seen_at = NOW(),
          confidence = GREATEST(confidence, $1),
          properties = properties || $2,
          aliases = (SELECT ARRAY(SELECT DISTINCT unnest(aliases || $3))),
          source_conversation_ids = (
            SELECT ARRAY(SELECT DISTINCT unnest(source_conversation_ids || ARRAY[$4]))
          ),
          updated_at = NOW()
        WHERE node_id = $5 AND tenant_id = $6`,
        [
          doubleParam('confidence', params.confidence),
          stringParam('properties', JSON.stringify(params.properties)),
          stringParam('aliases', `{${params.aliases.map(a => `"${a.replace(/"/g, '\\"')}"`).join(',')}}`),
          stringParam('convId', params.conversationId),
          stringParam('nodeId', existing.nodeId),
          stringParam('tenantId', tenantId),
        ]
      );

      existing.mentionCount += 1;
      existing.lastSeenAt = new Date();
      existing.confidence = Math.max(existing.confidence, params.confidence);
      return { node: existing, isNew: false };
    }

    // Create new node
    const nodeId = crypto.randomUUID();
    const now = new Date();

    await executeStatement(
      `INSERT INTO akg_nodes (
        node_id, tenant_id, user_id, entity_type, label, aliases, properties,
        confidence, mention_count, first_seen_at, last_seen_at, importance,
        source_conversation_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW(), NOW(), $9, ARRAY[$10])`,
      [
        stringParam('nodeId', nodeId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('entityType', params.entityType),
        stringParam('label', params.label),
        stringParam('aliases', `{${params.aliases.map(a => `"${a.replace(/"/g, '\\"')}"`).join(',')}}`),
        stringParam('properties', JSON.stringify(params.properties)),
        doubleParam('confidence', params.confidence),
        doubleParam('importance', params.confidence * 0.5),
        stringParam('convId', params.conversationId),
      ]
    );

    const node: AKGNode = {
      nodeId,
      tenantId,
      userId,
      entityType: params.entityType,
      label: params.label,
      aliases: params.aliases,
      properties: params.properties,
      confidence: params.confidence,
      mentionCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      importance: params.confidence * 0.5,
      sourceConversationIds: [params.conversationId],
      createdAt: now,
      updatedAt: now,
    };

    return { node, isNew: true };
  }

  /**
   * Find a node by label (case-insensitive) or alias.
   */
  async findNodeByLabel(tenantId: string, userId: string, label: string): Promise<AKGNode | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM akg_nodes
         WHERE tenant_id = $1 AND user_id = $2
         AND (LOWER(label) = LOWER($3) OR LOWER($3) = ANY(SELECT LOWER(unnest(aliases))))
         LIMIT 1`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('label', label),
        ]
      );

      if (result.rows.length === 0) return null;
      return this.mapNodeRow(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      logger.warn('findNodeByLabel failed', { tenantId, userId, label, error: String(error) });
      return null;
    }
  }

  /**
   * Get all nodes for a user, optionally filtered by entity type.
   */
  async getUserNodes(
    tenantId: string,
    userId: string,
    options?: { entityTypes?: AKGEntityType[]; limit?: number; minImportance?: number }
  ): Promise<AKGNode[]> {
    const limit = options?.limit || 100;
    const minImportance = options?.minImportance || 0;
    let query = `SELECT * FROM akg_nodes WHERE tenant_id = $1 AND user_id = $2 AND importance >= $3`;
    const params = [
      stringParam('tenantId', tenantId),
      stringParam('userId', userId),
      doubleParam('minImportance', minImportance),
    ];

    if (options?.entityTypes && options.entityTypes.length > 0) {
      query += ` AND entity_type = ANY($4)`;
      params.push(stringParam('types', `{${options.entityTypes.join(',')}}`));
    }

    query += ` ORDER BY importance DESC LIMIT ${limit}`;

    const result = await executeStatement(query, params);
    return result.rows.map(row => this.mapNodeRow(row as Record<string, unknown>));
  }

  // ===========================================================================
  // Edge Operations
  // ===========================================================================

  /**
   * Upsert an edge — create if new, strengthen weight if exists.
   */
  private async upsertEdge(
    tenantId: string,
    userId: string,
    params: {
      sourceNodeId: string;
      targetNodeId: string;
      relationshipType: AKGRelationshipType;
      label: string;
      properties: Record<string, unknown>;
      confidence: number;
      validFrom?: Date;
      validUntil?: Date;
      conversationId: string;
    }
  ): Promise<{ edge: AKGEdge; isNew: boolean }> {
    // Check for existing edge
    const existingResult = await executeStatement(
      `SELECT * FROM akg_edges
       WHERE tenant_id = $1 AND user_id = $2
       AND source_node_id = $3 AND target_node_id = $4
       AND relationship_type = $5
       LIMIT 1`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('source', params.sourceNodeId),
        stringParam('target', params.targetNodeId),
        stringParam('relType', params.relationshipType),
      ]
    );

    if (existingResult.rows.length > 0) {
      const existingRow = existingResult.rows[0] as Record<string, unknown>;
      const edgeId = String(existingRow.edge_id);
      const currentWeight = Number(existingRow.weight || 1.0);
      const newWeight = Math.min(1.0, currentWeight + 0.1);

      await executeStatement(
        `UPDATE akg_edges SET
          weight = $1,
          confidence = GREATEST(confidence, $2),
          properties = properties || $3,
          updated_at = NOW()
        WHERE edge_id = $4 AND tenant_id = $5`,
        [
          doubleParam('weight', newWeight),
          doubleParam('confidence', params.confidence),
          stringParam('properties', JSON.stringify(params.properties)),
          stringParam('edgeId', edgeId),
          stringParam('tenantId', tenantId),
        ]
      );

      const edge = this.mapEdgeRow(existingRow);
      edge.weight = newWeight;
      return { edge, isNew: false };
    }

    // Create new edge
    const edgeId = crypto.randomUUID();
    const now = new Date();

    await executeStatement(
      `INSERT INTO akg_edges (
        edge_id, tenant_id, user_id, source_node_id, target_node_id,
        relationship_type, label, properties, confidence,
        valid_from, valid_until, source_conversation_id, weight
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1.0)`,
      [
        stringParam('edgeId', edgeId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('source', params.sourceNodeId),
        stringParam('target', params.targetNodeId),
        stringParam('relType', params.relationshipType),
        stringParam('label', params.label),
        stringParam('properties', JSON.stringify(params.properties)),
        doubleParam('confidence', params.confidence),
        params.validFrom ? stringParam('from', params.validFrom.toISOString()) : { name: 'from', value: { isNull: true } },
        params.validUntil ? stringParam('until', params.validUntil.toISOString()) : { name: 'until', value: { isNull: true } },
        stringParam('convId', params.conversationId),
      ]
    );

    const edge: AKGEdge = {
      edgeId,
      tenantId,
      userId,
      sourceNodeId: params.sourceNodeId,
      targetNodeId: params.targetNodeId,
      relationshipType: params.relationshipType,
      label: params.label,
      properties: params.properties,
      confidence: params.confidence,
      validFrom: params.validFrom,
      validUntil: params.validUntil,
      sourceConversationId: params.conversationId,
      weight: 1.0,
      createdAt: now,
      updatedAt: now,
    };

    return { edge, isNew: true };
  }

  /**
   * Get edges for a node (both outgoing and incoming).
   */
  async getNodeEdges(tenantId: string, userId: string, nodeId: string): Promise<AKGEdge[]> {
    const result = await executeStatement(
      `SELECT * FROM akg_edges
       WHERE tenant_id = $1 AND user_id = $2
       AND (source_node_id = $3 OR target_node_id = $3)
       ORDER BY weight DESC`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('nodeId', nodeId),
      ]
    );

    return result.rows.map(row => this.mapEdgeRow(row as Record<string, unknown>));
  }

  // ===========================================================================
  // Graph Traversal & Context Building
  // ===========================================================================

  /**
   * Traverse the knowledge graph starting from seed nodes or a natural language query.
   * Returns nodes, edges, paths, and a context summary suitable for prompt injection.
   */
  async queryGraph(query: AKGGraphQuery): Promise<AKGGraphResult> {
    const startTime = Date.now();
    const visitedNodes = new Set<string>();
    const resultNodes: AKGNode[] = [];
    const resultEdges: AKGEdge[] = [];
    const paths: Array<{ nodeIds: string[]; edgeIds: string[]; totalWeight: number }> = [];

    // Determine seed nodes
    let seedNodeIds = query.seedNodeIds || [];

    if (query.naturalLanguageQuery && seedNodeIds.length === 0) {
      // Find seed nodes by text search
      const searchResult = await executeStatement(
        `SELECT node_id, label, importance FROM akg_nodes
         WHERE tenant_id = $1 AND user_id = $2
         AND (
           label ILIKE '%' || $3 || '%'
           OR $3 ILIKE '%' || label || '%'
           OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE a ILIKE '%' || $3 || '%')
         )
         ORDER BY importance DESC
         LIMIT 5`,
        [
          stringParam('tenantId', query.tenantId),
          stringParam('userId', query.userId),
          stringParam('query', query.naturalLanguageQuery),
        ]
      );

      seedNodeIds = searchResult.rows.map(r => String((r as Record<string, unknown>).node_id));
    }

    if (seedNodeIds.length === 0) {
      return {
        nodes: [],
        edges: [],
        paths: [],
        contextSummary: '',
        contextTokens: 0,
        queryLatencyMs: Date.now() - startTime,
      };
    }

    // BFS traversal from seed nodes
    const queue: Array<{ nodeId: string; depth: number; path: string[]; edgePath: string[]; weight: number }> = [];
    for (const seedId of seedNodeIds) {
      queue.push({ nodeId: seedId, depth: 0, path: [seedId], edgePath: [], weight: 1.0 });
      visitedNodes.add(seedId);
    }

    while (queue.length > 0 && resultNodes.length < query.limit) {
      const current = queue.shift()!;

      // Load the current node
      const nodeResult = await executeStatement(
        `SELECT * FROM akg_nodes WHERE node_id = $1 AND tenant_id = $2`,
        [stringParam('nodeId', current.nodeId), stringParam('tenantId', query.tenantId)]
      );

      if (nodeResult.rows.length > 0) {
        const node = this.mapNodeRow(nodeResult.rows[0] as Record<string, unknown>);

        // Apply entity type filter
        if (query.entityTypes && query.entityTypes.length > 0 && !query.entityTypes.includes(node.entityType)) {
          continue;
        }

        resultNodes.push(node);
        paths.push({
          nodeIds: current.path,
          edgeIds: current.edgePath,
          totalWeight: current.weight,
        });
      }

      // Expand to neighbors if within depth limit
      if (current.depth < query.maxDepth) {
        const edgesResult = await executeStatement(
          `SELECT * FROM akg_edges
           WHERE tenant_id = $1 AND user_id = $2
           AND (source_node_id = $3 OR target_node_id = $3)
           AND confidence >= $4
           ${query.includeHistorical ? '' : 'AND (valid_until IS NULL OR valid_until > NOW())'}
           ORDER BY weight DESC
           LIMIT 20`,
          [
            stringParam('tenantId', query.tenantId),
            stringParam('userId', query.userId),
            stringParam('nodeId', current.nodeId),
            doubleParam('minConf', query.minEdgeConfidence),
          ]
        );

        for (const edgeRow of edgesResult.rows) {
          const edge = this.mapEdgeRow(edgeRow as Record<string, unknown>);

          // Apply relationship type filter
          if (query.relationshipTypes && query.relationshipTypes.length > 0 && !query.relationshipTypes.includes(edge.relationshipType)) {
            continue;
          }

          resultEdges.push(edge);

          const neighborId = edge.sourceNodeId === current.nodeId ? edge.targetNodeId : edge.sourceNodeId;

          if (!visitedNodes.has(neighborId)) {
            visitedNodes.add(neighborId);
            queue.push({
              nodeId: neighborId,
              depth: current.depth + 1,
              path: [...current.path, neighborId],
              edgePath: [...current.edgePath, edge.edgeId],
              weight: current.weight * edge.weight,
            });
          }
        }
      }
    }

    // Build context summary
    const contextSummary = this.buildContextSummary(resultNodes, resultEdges);
    const contextTokens = Math.ceil(contextSummary.length / 4);

    return {
      nodes: resultNodes,
      edges: resultEdges,
      paths,
      contextSummary,
      contextTokens,
      queryLatencyMs: Date.now() - startTime,
    };
  }

  /**
   * Build a natural language context summary from graph traversal results.
   * This is injected into the system prompt for context-aware responses.
   */
  private buildContextSummary(nodes: AKGNode[], edges: AKGEdge[]): string {
    if (nodes.length === 0) return '';

    const lines: string[] = ['Known facts about this user:'];

    // Build node lookup
    const nodeMap = new Map<string, AKGNode>();
    for (const node of nodes) {
      nodeMap.set(node.nodeId, node);
    }

    // Generate relationship statements
    for (const edge of edges) {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);
      if (source && target) {
        let statement = `- ${source.label} ${edge.label} ${target.label}`;
        if (edge.validFrom) {
          statement += ` (since ${edge.validFrom.toISOString().split('T')[0]})`;
        }
        if (edge.validUntil) {
          statement += ` (until ${edge.validUntil.toISOString().split('T')[0]})`;
        }
        lines.push(statement);
      }
    }

    // Add standalone entity properties for high-importance nodes not covered by edges
    const edgeNodeIds = new Set<string>();
    for (const edge of edges) {
      edgeNodeIds.add(edge.sourceNodeId);
      edgeNodeIds.add(edge.targetNodeId);
    }

    for (const node of nodes) {
      if (!edgeNodeIds.has(node.nodeId) && node.importance > 0.3) {
        const props = Object.entries(node.properties)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        if (props) {
          lines.push(`- ${node.label} (${node.entityType}): ${props}`);
        } else {
          lines.push(`- ${node.label} (${node.entityType})`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Get a context-ready summary of the most important knowledge for a user.
   * Called during prompt building to inject user context.
   */
  async getUserContext(tenantId: string, userId: string, maxTokens: number = 500): Promise<string> {
    // Get top nodes by importance
    const topNodes = await this.getUserNodes(tenantId, userId, { limit: 30, minImportance: 0.3 });
    if (topNodes.length === 0) return '';

    // Get all edges between top nodes
    const nodeIds = topNodes.map(n => n.nodeId);
    const edgesResult = await executeStatement(
      `SELECT * FROM akg_edges
       WHERE tenant_id = $1 AND user_id = $2
       AND source_node_id = ANY($3) AND target_node_id = ANY($3)
       AND (valid_until IS NULL OR valid_until > NOW())
       ORDER BY weight DESC
       LIMIT 50`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('nodeIds', `{${nodeIds.join(',')}}`),
      ]
    );

    const edges = edgesResult.rows.map(row => this.mapEdgeRow(row as Record<string, unknown>));
    let summary = this.buildContextSummary(topNodes, edges);

    // Truncate to approximate token limit
    const maxChars = maxTokens * 4;
    if (summary.length > maxChars) {
      summary = summary.substring(0, maxChars) + '\n[... additional context truncated]';
    }

    return summary;
  }

  // ===========================================================================
  // Metrics & Stats
  // ===========================================================================

  async getStats(tenantId: string): Promise<{
    totalNodes: number;
    totalEdges: number;
    uniqueUsers: number;
    nodesByType: Record<string, number>;
    avgNodesPerUser: number;
    extractionSuccessRate: number;
    lastExtractionAt?: Date;
  }> {
    try {
      const [nodeStats, edgeStats, extractionStats] = await Promise.all([
        executeStatement(
          `SELECT
            COUNT(*) as total,
            COUNT(DISTINCT user_id) as unique_users,
            entity_type, COUNT(*) as type_count
           FROM akg_nodes WHERE tenant_id = $1
           GROUP BY entity_type`,
          [stringParam('tenantId', tenantId)]
        ),
        executeStatement(
          `SELECT COUNT(*) as total FROM akg_edges WHERE tenant_id = $1`,
          [stringParam('tenantId', tenantId)]
        ),
        executeStatement(
          `SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE error_message IS NULL) as successful,
            MAX(created_at) as last_extraction
           FROM akg_extraction_log WHERE tenant_id = $1
           AND created_at > NOW() - INTERVAL '24 hours'`,
          [stringParam('tenantId', tenantId)]
        ),
      ]);

      let totalNodes = 0;
      let uniqueUsers = 0;
      const nodesByType: Record<string, number> = {};
      for (const row of nodeStats.rows) {
        const r = row as Record<string, unknown>;
        totalNodes += Number(r.total || 0);
        uniqueUsers = Math.max(uniqueUsers, Number(r.unique_users || 0));
        nodesByType[String(r.entity_type)] = Number(r.type_count || 0);
      }

      const totalEdges = Number((edgeStats.rows[0] as Record<string, unknown>)?.total || 0);
      const extRow = extractionStats.rows[0] as Record<string, unknown>;
      const totalExtractions = Number(extRow?.total || 0);
      const successfulExtractions = Number(extRow?.successful || 0);

      return {
        totalNodes,
        totalEdges,
        uniqueUsers,
        nodesByType,
        avgNodesPerUser: uniqueUsers > 0 ? totalNodes / uniqueUsers : 0,
        extractionSuccessRate: totalExtractions > 0 ? successfulExtractions / totalExtractions : 1.0,
        lastExtractionAt: extRow?.last_extraction ? new Date(extRow.last_extraction as string) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get AKG stats', { tenantId, error: String(error) });
      return {
        totalNodes: 0, totalEdges: 0, uniqueUsers: 0,
        nodesByType: {}, avgNodesPerUser: 0, extractionSuccessRate: 0,
      };
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private parseExtractionResponse(content: string): {
    entities: Array<{ label: string; type: string; aliases: string[]; properties: Record<string, unknown>; confidence: number }>;
    relationships: Array<{ source: string; target: string; type: string; label: string; properties: Record<string, unknown>; confidence: number; temporal?: { from?: string; until?: string | null } }>;
  } | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.entities || !Array.isArray(parsed.entities)) return null;
      if (!parsed.relationships) parsed.relationships = [];

      return parsed;
    } catch {
      return null;
    }
  }

  private async logExtraction(
    tenantId: string, userId: string, conversationId: string,
    newNodes: number, updatedNodes: number, newEdges: number, updatedEdges: number,
    contradictions: number, latencyMs: number, tokensUsed: number,
    modelUsed: string, errorMessage?: string
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO akg_extraction_log (
          tenant_id, user_id, conversation_id,
          new_nodes_count, updated_nodes_count, new_edges_count, updated_edges_count,
          contradictions_found, extraction_latency_ms, tokens_used, model_used, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('convId', conversationId),
          { name: 'newNodes', value: { longValue: newNodes } },
          { name: 'updatedNodes', value: { longValue: updatedNodes } },
          { name: 'newEdges', value: { longValue: newEdges } },
          { name: 'updatedEdges', value: { longValue: updatedEdges } },
          { name: 'contradictions', value: { longValue: contradictions } },
          { name: 'latency', value: { longValue: latencyMs } },
          { name: 'tokens', value: { longValue: tokensUsed } },
          stringParam('model', modelUsed),
          errorMessage ? stringParam('error', errorMessage) : { name: 'error', value: { isNull: true } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to log AKG extraction', { error: String(error) });
    }
  }

  private emptyExtractionResult(startTime: number): AKGExtractionResult {
    return {
      newNodes: [], updatedNodes: [], newEdges: [], updatedEdges: [],
      contradictions: [], extractionLatencyMs: Date.now() - startTime,
      tokensUsed: 0, modelUsed: '',
    };
  }

  private mapNodeRow(row: Record<string, unknown>): AKGNode {
    return {
      nodeId: String(row.node_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      entityType: String(row.entity_type) as AKGEntityType,
      label: String(row.label),
      aliases: (row.aliases as string[]) || [],
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : (row.properties as Record<string, unknown>) || {},
      confidence: Number(row.confidence || 0.5),
      mentionCount: Number(row.mention_count || 1),
      firstSeenAt: new Date(row.first_seen_at as string),
      lastSeenAt: new Date(row.last_seen_at as string),
      importance: Number(row.importance || 0.5),
      sourceConversationIds: (row.source_conversation_ids as string[]) || [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapEdgeRow(row: Record<string, unknown>): AKGEdge {
    return {
      edgeId: String(row.edge_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      sourceNodeId: String(row.source_node_id),
      targetNodeId: String(row.target_node_id),
      relationshipType: String(row.relationship_type) as AKGRelationshipType,
      label: String(row.label),
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : (row.properties as Record<string, unknown>) || {},
      confidence: Number(row.confidence || 0.5),
      validFrom: row.valid_from ? new Date(row.valid_from as string) : undefined,
      validUntil: row.valid_until ? new Date(row.valid_until as string) : undefined,
      sourceConversationId: String(row.source_conversation_id || ''),
      weight: Number(row.weight || 1.0),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const akgService = new AKGService();
