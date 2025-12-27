// RADIANT v4.18.0 - AGI Complete Service
// Proactive Assistance, Analogical Reasoning, Confidence Calibration, Knowledge Graph, Contextual Adaptation

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export interface UserBehaviorPattern {
  patternId: string;
  patternType: string;
  predictedAction: string;
  confidence: number;
  occurrenceCount: number;
}

export interface ProactiveSuggestion {
  itemId: string;
  anticipationType: string;
  title: string;
  description?: string;
  priority: number;
  confidence: number;
  validUntil?: string;
}

export interface AnalogicalMapping {
  mappingId: string;
  sourceDomain: string;
  sourceConcept: string;
  targetDomain: string;
  targetConcept?: string;
  structuralAlignment: Record<string, string>;
  mappingQuality: number;
  candidateInferences: string[];
}

export interface CalibratedConfidence {
  rawConfidence: number;
  calibratedConfidence: number;
  adjustment: number;
  uncertaintySources: string[];
  knowledgeGaps: string[];
}

export interface KnowledgeNode {
  nodeId: string;
  name: string;
  nodeType: string;
  properties: Record<string, unknown>;
  confidence: number;
}

export interface KnowledgeEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  weight: number;
}

export interface ContextState {
  contextId: string;
  userContext: Record<string, unknown>;
  taskContext: Record<string, unknown>;
  domainContext: Record<string, unknown>;
  temporalContext: Record<string, unknown>;
  currentAdaptations: Record<string, unknown>;
}

export interface ContextAdaptation {
  styleAdaptations: Record<string, unknown>;
  contentAdaptations: Record<string, unknown>;
  formatAdaptations: Record<string, unknown>;
}

// ============================================================================
// AGI Complete Service
// ============================================================================

export class AGICompleteService {
  // ============================================================================
  // PROACTIVE ASSISTANCE
  // ============================================================================

  async detectBehaviorPattern(
    tenantId: string,
    userId: string,
    action: string,
    context: Record<string, unknown>
  ): Promise<void> {
    await executeStatement(
      `SELECT detect_user_pattern($1, $2, $3, $4)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'action', value: { stringValue: action } },
        { name: 'context', value: { stringValue: JSON.stringify(context) } },
      ]
    );
  }

  async getUserPatterns(tenantId: string, userId?: string): Promise<UserBehaviorPattern[]> {
    const result = await executeStatement(
      `SELECT * FROM user_behavior_patterns 
       WHERE tenant_id = $1 ${userId ? 'AND (user_id = $2 OR user_id IS NULL)' : ''}
       ORDER BY confidence DESC, occurrence_count DESC
       LIMIT 20`,
      userId
        ? [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'userId', value: { stringValue: userId } },
          ]
        : [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapBehaviorPattern(row as Record<string, unknown>));
  }

  async generateProactiveSuggestion(
    tenantId: string,
    userId: string,
    currentContext: Record<string, unknown>
  ): Promise<ProactiveSuggestion | null> {
    // Get user patterns
    const patterns = await this.getUserPatterns(tenantId, userId);
    
    if (patterns.length === 0) return null;

    // Find most relevant pattern for current context
    const prompt = `Based on user behavior patterns, generate a proactive suggestion.

USER PATTERNS:
${patterns.slice(0, 5).map(p => `- ${p.predictedAction} (confidence: ${p.confidence}, occurrences: ${p.occurrenceCount})`).join('\n')}

CURRENT CONTEXT:
${JSON.stringify(currentContext)}

Generate a helpful proactive suggestion. Return JSON:
{
  "anticipation_type": "task|information|reminder|suggestion|warning",
  "title": "Brief title",
  "description": "Helpful description",
  "priority": 1-10,
  "confidence": 0.0-1.0,
  "reasoning": "Why this suggestion"
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 500,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const result = await executeStatement(
          `INSERT INTO anticipation_queue (
            tenant_id, user_id, anticipation_type, title, description, priority, confidence, valid_until
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '1 day')
          RETURNING item_id`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'userId', value: { stringValue: userId } },
            { name: 'type', value: { stringValue: parsed.anticipation_type || 'suggestion' } },
            { name: 'title', value: { stringValue: parsed.title } },
            { name: 'description', value: parsed.description ? { stringValue: parsed.description } : { isNull: true } },
            { name: 'priority', value: { longValue: parsed.priority || 5 } },
            { name: 'confidence', value: { doubleValue: parsed.confidence || 0.5 } },
          ]
        );

        return {
          itemId: (result.rows[0] as { item_id: string }).item_id,
          anticipationType: parsed.anticipation_type || 'suggestion',
          title: parsed.title,
          description: parsed.description,
          priority: parsed.priority || 5,
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch { /* suggestion generation failed */ }

    return null;
  }

  async getPendingSuggestions(tenantId: string, userId?: string): Promise<ProactiveSuggestion[]> {
    const result = await executeStatement(
      `SELECT * FROM anticipation_queue
       WHERE tenant_id = $1 
         ${userId ? 'AND (user_id = $2 OR user_id IS NULL)' : ''}
         AND status = 'pending'
         AND (valid_until IS NULL OR valid_until > NOW())
       ORDER BY priority DESC, confidence DESC
       LIMIT 10`,
      userId
        ? [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'userId', value: { stringValue: userId } },
          ]
        : [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapProactiveSuggestion(row as Record<string, unknown>));
  }

  async respondToSuggestion(
    itemId: string,
    response: 'accepted' | 'dismissed' | 'snoozed'
  ): Promise<void> {
    await executeStatement(
      `UPDATE anticipation_queue SET
        status = 'delivered',
        delivered_at = NOW(),
        user_response = $2
      WHERE item_id = $1`,
      [
        { name: 'itemId', value: { stringValue: itemId } },
        { name: 'response', value: { stringValue: response } },
      ]
    );
  }

  // ============================================================================
  // ANALOGICAL REASONING
  // ============================================================================

  async findAnalogies(
    sourceDomain: string,
    sourceConcept: string,
    limit = 5
  ): Promise<AnalogicalMapping[]> {
    // First check existing mappings
    const existingResult = await executeStatement(
      `SELECT * FROM find_analogies($1, $2, $3)`,
      [
        { name: 'sourceDomain', value: { stringValue: sourceDomain } },
        { name: 'sourceConcept', value: { stringValue: sourceConcept } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    if (existingResult.rows.length > 0) {
      return existingResult.rows.map(row => ({
        mappingId: String((row as Record<string, unknown>).analogy_id),
        sourceDomain,
        sourceConcept,
        targetDomain: String((row as Record<string, unknown>).target_domain),
        structuralAlignment: (row as Record<string, unknown>).mapping as Record<string, string>,
        mappingQuality: Number((row as Record<string, unknown>).quality),
        candidateInferences: [],
      }));
    }

    // Check analogy library
    const libraryResult = await executeStatement(
      `SELECT * FROM analogy_library
       WHERE domain_a ILIKE $1 OR domain_b ILIKE $1
       ORDER BY explanatory_power DESC
       LIMIT $2`,
      [
        { name: 'domain', value: { stringValue: `%${sourceDomain}%` } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    if (libraryResult.rows.length > 0) {
      return libraryResult.rows.map(row => {
        const r = row as Record<string, unknown>;
        const isA = String(r.domain_a).toLowerCase().includes(sourceDomain.toLowerCase());
        return {
          mappingId: String(r.analogy_id),
          sourceDomain: isA ? String(r.domain_a) : String(r.domain_b),
          sourceConcept,
          targetDomain: isA ? String(r.domain_b) : String(r.domain_a),
          structuralAlignment: typeof r.core_mapping === 'string' ? JSON.parse(r.core_mapping) : r.core_mapping as Record<string, string>,
          mappingQuality: Number(r.explanatory_power || 0.5),
          candidateInferences: [],
        };
      });
    }

    // Generate new analogy
    return this.generateAnalogy(sourceDomain, sourceConcept);
  }

  async generateAnalogy(
    sourceDomain: string,
    sourceConcept: string
  ): Promise<AnalogicalMapping[]> {
    const prompt = `Generate analogies for understanding this concept in a different domain.

SOURCE DOMAIN: ${sourceDomain}
CONCEPT: ${sourceConcept}

Find analogies that share deep structural similarities, not just surface features.

Return JSON:
{
  "analogies": [
    {
      "target_domain": "The analogous domain",
      "target_concept": "The analogous concept",
      "structural_alignment": {"source_element": "target_element", ...},
      "relational_matches": ["relation that maps..."],
      "mapping_quality": 0.0-1.0,
      "candidate_inferences": ["What we can infer in the target..."],
      "where_breaks_down": ["Limitations of the analogy..."]
    }
  ]
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1500,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const analogies: AnalogicalMapping[] = [];

        for (const analogy of parsed.analogies || []) {
          // Store the mapping
          const result = await executeStatement(
            `INSERT INTO analogical_mappings (
              source_domain, source_concept, target_domain, target_concept,
              structural_alignment, relational_matches, mapping_quality, candidate_inferences
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING mapping_id`,
            [
              { name: 'sourceDomain', value: { stringValue: sourceDomain } },
              { name: 'sourceConcept', value: { stringValue: sourceConcept } },
              { name: 'targetDomain', value: { stringValue: analogy.target_domain } },
              { name: 'targetConcept', value: analogy.target_concept ? { stringValue: analogy.target_concept } : { isNull: true } },
              { name: 'alignment', value: { stringValue: JSON.stringify(analogy.structural_alignment || {}) } },
              { name: 'relations', value: { stringValue: JSON.stringify(analogy.relational_matches || []) } },
              { name: 'quality', value: { doubleValue: analogy.mapping_quality || 0.5 } },
              { name: 'inferences', value: { stringValue: JSON.stringify(analogy.candidate_inferences || []) } },
            ]
          );

          analogies.push({
            mappingId: (result.rows[0] as { mapping_id: string }).mapping_id,
            sourceDomain,
            sourceConcept,
            targetDomain: analogy.target_domain,
            targetConcept: analogy.target_concept,
            structuralAlignment: analogy.structural_alignment || {},
            mappingQuality: analogy.mapping_quality || 0.5,
            candidateInferences: analogy.candidate_inferences || [],
          });
        }

        return analogies;
      }
    } catch { /* analogy generation failed */ }

    return [];
  }

  async applyAnalogy(
    mappingId: string,
    targetQuery: string
  ): Promise<{ inference: string; confidence: number }> {
    const mappingResult = await executeStatement(
      `SELECT * FROM analogical_mappings WHERE mapping_id = $1`,
      [{ name: 'mappingId', value: { stringValue: mappingId } }]
    );

    if (mappingResult.rows.length === 0) {
      throw new Error('Mapping not found');
    }

    const mapping = mappingResult.rows[0] as Record<string, unknown>;

    const prompt = `Apply this analogy to answer a question.

ANALOGY:
- Source: ${mapping.source_domain} / ${mapping.source_concept}
- Target: ${mapping.target_domain}
- Mapping: ${JSON.stringify(mapping.structural_alignment)}

QUESTION: ${targetQuery}

Use the analogy to provide an inference. Return JSON:
{
  "inference": "The answer based on the analogy",
  "confidence": 0.0-1.0,
  "reasoning": "How the analogy applies"
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 500,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Update usage stats
        await executeStatement(
          `UPDATE analogical_mappings SET times_used = times_used + 1 WHERE mapping_id = $1`,
          [{ name: 'mappingId', value: { stringValue: mappingId } }]
        );

        return {
          inference: parsed.inference || '',
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch { /* application failed */ }

    return { inference: '', confidence: 0 };
  }

  // ============================================================================
  // CONFIDENCE CALIBRATION
  // ============================================================================

  async calibrateConfidence(
    tenantId: string,
    domain: string,
    rawConfidence: number,
    taskType?: string
  ): Promise<CalibratedConfidence> {
    // Get calibrated value from database
    const result = await executeStatement(
      `SELECT calibrate_confidence($1, $2, $3)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'domain', value: { stringValue: domain } },
        { name: 'rawConfidence', value: { doubleValue: rawConfidence } },
      ]
    );

    const calibrated = Number((result.rows[0] as Record<string, unknown>)?.calibrate_confidence || rawConfidence);

    // Analyze uncertainty sources
    const uncertaintySources: string[] = [];
    const knowledgeGaps: string[] = [];

    if (calibrated < 0.5) {
      uncertaintySources.push('Low domain confidence');
      knowledgeGaps.push(`Limited training data in ${domain}`);
    }

    if (rawConfidence > calibrated + 0.1) {
      uncertaintySources.push('Historical overconfidence in this domain');
    }

    return {
      rawConfidence,
      calibratedConfidence: calibrated,
      adjustment: calibrated - rawConfidence,
      uncertaintySources,
      knowledgeGaps,
    };
  }

  async recordConfidenceOutcome(
    tenantId: string,
    domain: string,
    taskType: string,
    statedConfidence: number,
    wasCorrect: boolean
  ): Promise<void> {
    // Record assessment
    await executeStatement(
      `INSERT INTO confidence_assessments (
        tenant_id, task_type, domain, stated_confidence, was_correct
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'taskType', value: { stringValue: taskType } },
        { name: 'domain', value: { stringValue: domain } },
        { name: 'statedConfidence', value: { doubleValue: statedConfidence } },
        { name: 'wasCorrect', value: { booleanValue: wasCorrect } },
      ]
    );

    // Update calibration curve
    await this.updateCalibrationCurve(tenantId, domain, taskType);
  }

  private async updateCalibrationCurve(
    tenantId: string,
    domain: string,
    taskType: string
  ): Promise<void> {
    // Calculate calibration metrics
    const metricsResult = await executeStatement(
      `WITH bucketed AS (
        SELECT 
          FLOOR(stated_confidence * 10) / 10 as bucket,
          COUNT(*) as total,
          SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) as correct
        FROM confidence_assessments
        WHERE tenant_id = $1 AND domain = $2 AND task_type = $3
        GROUP BY FLOOR(stated_confidence * 10) / 10
      )
      SELECT 
        jsonb_agg(jsonb_build_object(
          'bucket', bucket,
          'accuracy', CASE WHEN total > 0 THEN correct::DECIMAL / total ELSE 0 END,
          'count', total
        )) as buckets,
        AVG(ABS(bucket - CASE WHEN total > 0 THEN correct::DECIMAL / total ELSE 0 END)) as ece
      FROM bucketed`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'domain', value: { stringValue: domain } },
        { name: 'taskType', value: { stringValue: taskType } },
      ]
    );

    if (metricsResult.rows.length > 0) {
      const metrics = metricsResult.rows[0] as Record<string, unknown>;
      
      await executeStatement(
        `INSERT INTO calibration_curves (tenant_id, domain, task_type, buckets, expected_calibration_error, sample_count)
         VALUES ($1, $2, $3, $4, $5, (SELECT COUNT(*) FROM confidence_assessments WHERE tenant_id = $1 AND domain = $2))
         ON CONFLICT (tenant_id, domain, task_type, model_id) DO UPDATE SET
           buckets = EXCLUDED.buckets,
           expected_calibration_error = EXCLUDED.expected_calibration_error,
           sample_count = EXCLUDED.sample_count,
           last_updated = NOW()`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'domain', value: { stringValue: domain } },
          { name: 'taskType', value: { stringValue: taskType } },
          { name: 'buckets', value: { stringValue: JSON.stringify(metrics.buckets || []) } },
          { name: 'ece', value: { doubleValue: Number(metrics.ece || 0) } },
        ]
      );
    }
  }

  async getEpistemicState(tenantId: string): Promise<{
    knownDomains: string[];
    weakDomains: string[];
    unknownDomains: string[];
    metaAccuracy: number;
  }> {
    const result = await executeStatement(
      `SELECT * FROM epistemic_state WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) {
      return {
        knownDomains: ['general'],
        weakDomains: [],
        unknownDomains: [],
        metaAccuracy: 0.5,
      };
    }

    const state = result.rows[0] as Record<string, unknown>;
    return {
      knownDomains: typeof state.known_domains === 'string' ? JSON.parse(state.known_domains) : (state.known_domains as string[]) || [],
      weakDomains: typeof state.weak_domains === 'string' ? JSON.parse(state.weak_domains) : (state.weak_domains as string[]) || [],
      unknownDomains: typeof state.unknown_domains === 'string' ? JSON.parse(state.unknown_domains) : (state.unknown_domains as string[]) || [],
      metaAccuracy: Number(state.knows_what_it_knows ?? 0.5),
    };
  }

  // ============================================================================
  // KNOWLEDGE GRAPH
  // ============================================================================

  async addKnowledgeNode(
    tenantId: string | null,
    name: string,
    nodeType: string,
    properties: Record<string, unknown> = {}
  ): Promise<KnowledgeNode> {
    const result = await executeStatement(
      `INSERT INTO knowledge_nodes (tenant_id, name, node_type, properties, source)
       VALUES ($1, $2, $3, $4, 'user_provided')
       RETURNING node_id`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'name', value: { stringValue: name } },
        { name: 'nodeType', value: { stringValue: nodeType } },
        { name: 'properties', value: { stringValue: JSON.stringify(properties) } },
      ]
    );

    return {
      nodeId: (result.rows[0] as { node_id: string }).node_id,
      name,
      nodeType,
      properties,
      confidence: 1.0,
    };
  }

  async addKnowledgeEdge(
    tenantId: string | null,
    sourceNodeId: string,
    targetNodeId: string,
    relationType: string,
    properties: Record<string, unknown> = {}
  ): Promise<KnowledgeEdge> {
    const result = await executeStatement(
      `INSERT INTO knowledge_edges (tenant_id, source_node_id, target_node_id, relation_type, relation_properties, source)
       VALUES ($1, $2, $3, $4, $5, 'user_provided')
       RETURNING edge_id`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'sourceNodeId', value: { stringValue: sourceNodeId } },
        { name: 'targetNodeId', value: { stringValue: targetNodeId } },
        { name: 'relationType', value: { stringValue: relationType } },
        { name: 'properties', value: { stringValue: JSON.stringify(properties) } },
      ]
    );

    return {
      edgeId: (result.rows[0] as { edge_id: string }).edge_id,
      sourceNodeId,
      targetNodeId,
      relationType,
      weight: 1.0,
    };
  }

  async findRelatedKnowledge(
    nodeId: string,
    maxDepth = 2,
    limit = 20
  ): Promise<Array<{ node: KnowledgeNode; relationPath: string[]; depth: number }>> {
    const result = await executeStatement(
      `SELECT * FROM find_related_knowledge($1, $2, $3)`,
      [
        { name: 'nodeId', value: { stringValue: nodeId } },
        { name: 'maxDepth', value: { longValue: maxDepth } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        node: {
          nodeId: String(r.node_id),
          name: String(r.name),
          nodeType: String(r.node_type),
          properties: {},
          confidence: 1.0,
        },
        relationPath: (r.relation_path as string[]) || [],
        depth: Number(r.depth),
      };
    });
  }

  async queryKnowledgeGraph(
    tenantId: string,
    query: string
  ): Promise<Array<{ node: KnowledgeNode; relevance: number }>> {
    // Simple keyword search (would use embeddings in production)
    const result = await executeStatement(
      `SELECT *, 
        CASE WHEN name ILIKE '%' || $2 || '%' THEN 1.0
             WHEN properties::TEXT ILIKE '%' || $2 || '%' THEN 0.7
             ELSE 0.5 END as relevance
       FROM knowledge_nodes
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
         AND (name ILIKE '%' || $2 || '%' OR properties::TEXT ILIKE '%' || $2 || '%')
       ORDER BY relevance DESC
       LIMIT 20`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'query', value: { stringValue: query } },
      ]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        node: {
          nodeId: String(r.node_id),
          name: String(r.name),
          nodeType: String(r.node_type),
          properties: typeof r.properties === 'string' ? JSON.parse(r.properties) : (r.properties as Record<string, unknown>) || {},
          confidence: Number(r.confidence ?? 1.0),
        },
        relevance: Number(r.relevance ?? 0.5),
      };
    });
  }

  async extractKnowledgeFromText(
    tenantId: string,
    text: string
  ): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    const prompt = `Extract knowledge graph elements from this text.

TEXT: "${text.substring(0, 2000)}"

Extract entities, concepts, and their relationships.

Return JSON:
{
  "nodes": [
    {"name": "entity name", "type": "entity|concept|event|attribute", "properties": {...}}
  ],
  "edges": [
    {"source": "node name", "target": "node name", "relation": "is_a|has_part|causes|related_to|etc"}
  ]
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1500,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const nodes: KnowledgeNode[] = [];
        const nodeIdMap: Record<string, string> = {};

        // Create nodes
        for (const node of parsed.nodes || []) {
          const created = await this.addKnowledgeNode(
            tenantId,
            node.name,
            node.type || 'entity',
            node.properties || {}
          );
          nodes.push(created);
          nodeIdMap[node.name] = created.nodeId;
        }

        // Create edges
        const edges: KnowledgeEdge[] = [];
        for (const edge of parsed.edges || []) {
          const sourceId = nodeIdMap[edge.source];
          const targetId = nodeIdMap[edge.target];
          if (sourceId && targetId) {
            const created = await this.addKnowledgeEdge(
              tenantId,
              sourceId,
              targetId,
              edge.relation
            );
            edges.push(created);
          }
        }

        return { nodes, edges };
      }
    } catch { /* extraction failed */ }

    return { nodes: [], edges: [] };
  }

  // ============================================================================
  // CONTEXTUAL ADAPTATION
  // ============================================================================

  async detectContext(
    tenantId: string,
    sessionId: string,
    content: string
  ): Promise<ContextState> {
    // Detect context changes
    const changes = await executeStatement(
      `SELECT detect_context_change($1, $2, $3)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'content', value: { stringValue: content } },
      ]
    );

    const detectedChanges = (changes.rows[0] as Record<string, unknown>)?.detect_context_change as Record<string, unknown> || {};

    // Get or create active context
    let contextResult = await executeStatement(
      `SELECT * FROM active_contexts WHERE tenant_id = $1 AND session_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'sessionId', value: { stringValue: sessionId } },
      ]
    );

    if (contextResult.rows.length === 0) {
      await executeStatement(
        `INSERT INTO active_contexts (tenant_id, session_id, domain_context)
         VALUES ($1, $2, $3)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'sessionId', value: { stringValue: sessionId } },
          { name: 'domainContext', value: { stringValue: JSON.stringify(detectedChanges) } },
        ]
      );

      contextResult = await executeStatement(
        `SELECT * FROM active_contexts WHERE tenant_id = $1 AND session_id = $2`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'sessionId', value: { stringValue: sessionId } },
        ]
      );
    } else if (Object.keys(detectedChanges).length > 0) {
      // Update context with detected changes
      await executeStatement(
        `UPDATE active_contexts SET
          domain_context = domain_context || $3,
          updated_at = NOW()
         WHERE tenant_id = $1 AND session_id = $2`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'sessionId', value: { stringValue: sessionId } },
          { name: 'changes', value: { stringValue: JSON.stringify(detectedChanges) } },
        ]
      );
    }

    return this.mapContextState(contextResult.rows[0] as Record<string, unknown>);
  }

  async getAdaptations(tenantId: string, context: ContextState): Promise<ContextAdaptation> {
    // Get matching context profiles
    const profilesResult = await executeStatement(
      `SELECT * FROM context_profiles
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
         AND enabled = true
       ORDER BY priority DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const styleAdaptations: Record<string, unknown> = {};
    const contentAdaptations: Record<string, unknown> = {};
    const formatAdaptations: Record<string, unknown> = {};

    for (const row of profilesResult.rows) {
      const profile = row as Record<string, unknown>;
      const characteristics = typeof profile.characteristics === 'string' 
        ? JSON.parse(profile.characteristics) 
        : profile.characteristics as Record<string, unknown>;

      // Check if profile matches current context
      let matches = true;
      for (const [key, value] of Object.entries(characteristics)) {
        const contextValue = context.domainContext[key] || context.taskContext[key] || context.userContext[key];
        if (contextValue !== undefined && contextValue !== value) {
          matches = false;
          break;
        }
      }

      if (matches) {
        const style = typeof profile.style_adaptations === 'string'
          ? JSON.parse(profile.style_adaptations)
          : profile.style_adaptations as Record<string, unknown>;
        const content = typeof profile.content_adaptations === 'string'
          ? JSON.parse(profile.content_adaptations)
          : profile.content_adaptations as Record<string, unknown>;
        const format = typeof profile.format_adaptations === 'string'
          ? JSON.parse(profile.format_adaptations)
          : profile.format_adaptations as Record<string, unknown>;

        Object.assign(styleAdaptations, style || {});
        Object.assign(contentAdaptations, content || {});
        Object.assign(formatAdaptations, format || {});
      }
    }

    return {
      styleAdaptations,
      contentAdaptations,
      formatAdaptations,
    };
  }

  async applyAdaptations(
    content: string,
    adaptations: ContextAdaptation
  ): Promise<string> {
    if (Object.keys(adaptations.styleAdaptations).length === 0 &&
        Object.keys(adaptations.formatAdaptations).length === 0) {
      return content;
    }

    const prompt = `Adapt this content according to the specified adaptations.

CONTENT:
${content.substring(0, 2000)}

ADAPTATIONS:
- Style: ${JSON.stringify(adaptations.styleAdaptations)}
- Format: ${JSON.stringify(adaptations.formatAdaptations)}

Rewrite the content applying these adaptations. Return only the adapted content.`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2000,
      });

      return response.content;
    } catch {
      return content;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapBehaviorPattern(row: Record<string, unknown>): UserBehaviorPattern {
    return {
      patternId: String(row.pattern_id),
      patternType: String(row.pattern_type),
      predictedAction: String(row.predicted_action),
      confidence: Number(row.confidence ?? 0.5),
      occurrenceCount: Number(row.occurrence_count ?? 1),
    };
  }

  private mapProactiveSuggestion(row: Record<string, unknown>): ProactiveSuggestion {
    return {
      itemId: String(row.item_id),
      anticipationType: String(row.anticipation_type),
      title: String(row.title),
      description: row.description ? String(row.description) : undefined,
      priority: Number(row.priority ?? 5),
      confidence: Number(row.confidence ?? 0.5),
      validUntil: row.valid_until ? String(row.valid_until) : undefined,
    };
  }

  private mapContextState(row: Record<string, unknown>): ContextState {
    return {
      contextId: String(row.context_id),
      userContext: typeof row.user_context === 'string' ? JSON.parse(row.user_context) : (row.user_context as Record<string, unknown>) || {},
      taskContext: typeof row.task_context === 'string' ? JSON.parse(row.task_context) : (row.task_context as Record<string, unknown>) || {},
      domainContext: typeof row.domain_context === 'string' ? JSON.parse(row.domain_context) : (row.domain_context as Record<string, unknown>) || {},
      temporalContext: typeof row.temporal_context === 'string' ? JSON.parse(row.temporal_context) : (row.temporal_context as Record<string, unknown>) || {},
      currentAdaptations: typeof row.current_adaptations === 'string' ? JSON.parse(row.current_adaptations) : (row.current_adaptations as Record<string, unknown>) || {},
    };
  }
}

export const agiCompleteService = new AGICompleteService();
