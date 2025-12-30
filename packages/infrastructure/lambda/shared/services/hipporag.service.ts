/**
 * HippoRAG Service - Neurobiologically-Inspired Memory Indexing
 * 
 * Implements hippocampal memory patterns:
 * - Pattern separation (distinct encoding of similar experiences)
 * - Pattern completion (retrieval from partial cues)
 * - Personalized PageRank for multi-hop reasoning
 * 
 * Based on: "HippoRAG: Neurobiologically Inspired Long-Term Memory for LLMs"
 * Achieves 20% improvement over standard RAG on multi-hop QA
 * 
 * @see https://arxiv.org/abs/2405.14831
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { executeStatement, stringParam } from '../db/client';
import { modelRouterService } from './model-router.service';
import { logger } from '../logger';
import crypto from 'crypto';

const lambdaClient = new LambdaClient({});
const CONSCIOUSNESS_EXECUTOR_ARN = process.env.CONSCIOUSNESS_EXECUTOR_ARN;

// ============================================================================
// Types
// ============================================================================

export interface HippoRAGDocument {
  docId: string;
  tenantId: string;
  content: string;
  metadata: Record<string, unknown>;
  indexedAt: Date;
}

export interface HippoRAGEntity {
  entityId: string;
  name: string;
  type: string;
  documentIds: string[];
  embedding?: number[];
  importance: number;
}

export interface HippoRAGRelation {
  relationId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  weight: number;
  documentIds: string[];
}

export interface HippoRAGQuery {
  queryId: string;
  query: string;
  results: HippoRAGResult[];
  reasoningPath: string[];
  hops: number;
  latencyMs: number;
}

export interface HippoRAGResult {
  docId: string;
  content: string;
  score: number;
  entities: string[];
  pathFromQuery: string[];
}

export interface HippoRAGConfig {
  enabled: boolean;
  maxHops: number;
  dampingFactor: number;
  minRelevanceScore: number;
  patternSeparationThreshold: number;
  entityExtractionModel: string;
}

const DEFAULT_CONFIG: HippoRAGConfig = {
  enabled: true,
  maxHops: 3,
  dampingFactor: 0.85,
  minRelevanceScore: 0.3,
  patternSeparationThreshold: 0.7,
  entityExtractionModel: 'gpt-4o-mini',
};

// ============================================================================
// HippoRAG Service
// ============================================================================

class HippoRAGService {
  private config: HippoRAGConfig = DEFAULT_CONFIG;

  /**
   * Index a document using hippocampal pattern separation
   */
  async indexDocument(
    tenantId: string,
    docId: string,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<{ entities: HippoRAGEntity[]; relations: HippoRAGRelation[] }> {
    const startTime = Date.now();

    // Extract entities and relationships using LLM
    const extraction = await this.extractEntitiesAndRelations(content);

    // Apply pattern separation - ensure distinct representations
    const separatedEntities = await this.applyPatternSeparation(
      tenantId,
      extraction.entities
    );

    // Store document
    await executeStatement(
      `INSERT INTO hipporag_documents (doc_id, tenant_id, content, metadata, indexed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (doc_id, tenant_id) DO UPDATE SET
         content = $3, metadata = $4, indexed_at = NOW()`,
      [
        stringParam('docId', docId),
        stringParam('tenantId', tenantId),
        stringParam('content', content),
        stringParam('metadata', JSON.stringify(metadata)),
      ]
    );

    // Store entities
    for (const entity of separatedEntities) {
      await executeStatement(
        `INSERT INTO hipporag_entities (entity_id, tenant_id, name, type, importance, document_ids)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (entity_id, tenant_id) DO UPDATE SET
           importance = GREATEST(hipporag_entities.importance, $5),
           document_ids = array_cat(hipporag_entities.document_ids, $6)`,
        [
          stringParam('entityId', entity.entityId),
          stringParam('tenantId', tenantId),
          stringParam('name', entity.name),
          stringParam('type', entity.type),
          { name: 'importance', value: { doubleValue: entity.importance } },
          stringParam('documentIds', JSON.stringify([docId])),
        ]
      );
    }

    // Store relations
    for (const relation of extraction.relations) {
      await executeStatement(
        `INSERT INTO hipporag_relations (relation_id, tenant_id, source_entity_id, target_entity_id, relation_type, weight, document_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (relation_id, tenant_id) DO UPDATE SET
           weight = GREATEST(hipporag_relations.weight, $6),
           document_ids = array_cat(hipporag_relations.document_ids, $7)`,
        [
          stringParam('relationId', relation.relationId),
          stringParam('tenantId', tenantId),
          stringParam('sourceEntityId', relation.sourceEntityId),
          stringParam('targetEntityId', relation.targetEntityId),
          stringParam('relationType', relation.relationType),
          { name: 'weight', value: { doubleValue: relation.weight } },
          stringParam('documentIds', JSON.stringify([docId])),
        ]
      );
    }

    logger.info('HippoRAG document indexed', {
      tenantId,
      docId,
      entities: separatedEntities.length,
      relations: extraction.relations.length,
      latencyMs: Date.now() - startTime,
    });

    return {
      entities: separatedEntities,
      relations: extraction.relations,
    };
  }

  /**
   * Retrieve documents using Personalized PageRank
   */
  async retrieve(
    tenantId: string,
    query: string,
    k: number = 5,
    options: { maxHops?: number; userId?: string } = {}
  ): Promise<HippoRAGQuery> {
    const startTime = Date.now();
    const queryId = crypto.randomUUID();
    const maxHops = options.maxHops ?? this.config.maxHops;

    // Extract query entities
    const queryEntities = await this.extractQueryEntities(query);

    // Find seed entities in the graph
    const seedEntities = await this.findMatchingEntities(tenantId, queryEntities);

    // Run Personalized PageRank from seed entities
    const rankedEntities = await this.personalizedPageRank(
      tenantId,
      seedEntities,
      maxHops
    );

    // Retrieve documents from top-ranked entities
    const results = await this.retrieveDocumentsFromEntities(
      tenantId,
      rankedEntities,
      k
    );

    // Build reasoning path
    const reasoningPath = this.buildReasoningPath(seedEntities, rankedEntities);

    const queryResult: HippoRAGQuery = {
      queryId,
      query,
      results,
      reasoningPath,
      hops: maxHops,
      latencyMs: Date.now() - startTime,
    };

    logger.info('HippoRAG retrieval complete', {
      tenantId,
      queryId,
      results: results.length,
      latencyMs: queryResult.latencyMs,
    });

    return queryResult;
  }

  /**
   * Multi-hop reasoning over the knowledge graph
   */
  async multiHopQuery(
    tenantId: string,
    query: string,
    options: { maxHops?: number; explainReasoning?: boolean } = {}
  ): Promise<{
    answer: string | null;
    confidence: number;
    reasoningPath: string[];
    supportingDocs: HippoRAGResult[];
  }> {
    const maxHops = options.maxHops ?? this.config.maxHops;

    // Retrieve relevant context
    const retrieval = await this.retrieve(tenantId, query, 10, { maxHops });

    if (retrieval.results.length === 0) {
      return {
        answer: null,
        confidence: 0,
        reasoningPath: [],
        supportingDocs: [],
      };
    }

    // Build context from retrieved documents
    const context = retrieval.results
      .map((r, i) => `[${i + 1}] ${r.content}`)
      .join('\n\n');

    // Generate answer with reasoning
    const prompt = `Based on the following context, answer the question. Show your reasoning step by step.

Context:
${context}

Question: ${query}

Provide your answer in this format:
REASONING: [step-by-step reasoning through the evidence]
ANSWER: [your final answer]
CONFIDENCE: [0-1 score]`;

    const response = await modelRouterService.invoke({
      modelId: this.config.entityExtractionModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1024,
    });

    // Parse response
    const answerMatch = response.content.match(/ANSWER:\s*(.+?)(?=CONFIDENCE:|$)/s);
    const confidenceMatch = response.content.match(/CONFIDENCE:\s*([\d.]+)/);
    const reasoningMatch = response.content.match(/REASONING:\s*(.+?)(?=ANSWER:|$)/s);

    const answer = answerMatch?.[1]?.trim() || null;
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
    const reasoning = reasoningMatch?.[1]?.trim() || '';

    return {
      answer,
      confidence,
      reasoningPath: [
        ...retrieval.reasoningPath,
        ...(reasoning ? reasoning.split('\n').filter(l => l.trim()) : []),
      ],
      supportingDocs: retrieval.results.slice(0, 5),
    };
  }

  /**
   * Invoke Python executor for HippoRAG operations
   */
  private async invokePythonExecutor(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    if (!CONSCIOUSNESS_EXECUTOR_ARN) {
      logger.warn('Consciousness executor not configured, using TypeScript fallback');
      return null;
    }

    try {
      const command = new InvokeCommand({
        FunctionName: CONSCIOUSNESS_EXECUTOR_ARN,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify({
          library: 'hipporag',
          method,
          params,
        })),
      });

      const response = await lambdaClient.send(command);
      
      if (response.Payload) {
        const result = JSON.parse(Buffer.from(response.Payload).toString());
        if (result.body?.success) {
          return result.body.result;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('HippoRAG Python executor failed', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Extract entities and relations from content using LLM
   */
  private async extractEntitiesAndRelations(
    content: string
  ): Promise<{ entities: HippoRAGEntity[]; relations: HippoRAGRelation[] }> {
    const prompt = `Extract entities and relationships from the following text.

Text:
${content.substring(0, 4000)}

Return a JSON object with:
{
  "entities": [{"name": "...", "type": "person|place|concept|event|object|other"}],
  "relations": [{"source": "...", "target": "...", "type": "..."}]
}

Only return the JSON, no other text.`;

    try {
      const response = await modelRouterService.invoke({
        modelId: this.config.entityExtractionModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        maxTokens: 2048,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { entities: [], relations: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const entities: HippoRAGEntity[] = (parsed.entities || []).map((e: { name: string; type: string }) => ({
        entityId: crypto.createHash('sha256').update(e.name.toLowerCase()).digest('hex').substring(0, 16),
        name: e.name,
        type: e.type || 'concept',
        documentIds: [],
        importance: 1.0,
      }));

      const entityMap = new Map(entities.map(e => [e.name.toLowerCase(), e.entityId]));

      const relations: HippoRAGRelation[] = (parsed.relations || [])
        .filter((r: { source: string; target: string }) => 
          entityMap.has(r.source.toLowerCase()) && entityMap.has(r.target.toLowerCase())
        )
        .map((r: { source: string; target: string; type: string }) => ({
          relationId: crypto.randomUUID(),
          sourceEntityId: entityMap.get(r.source.toLowerCase())!,
          targetEntityId: entityMap.get(r.target.toLowerCase())!,
          relationType: r.type || 'related_to',
          weight: 1.0,
          documentIds: [],
        }));

      return { entities, relations };
    } catch (error) {
      logger.error('Entity extraction failed', error instanceof Error ? error : new Error(String(error)));
      return { entities: [], relations: [] };
    }
  }

  /**
   * Apply pattern separation to ensure distinct entity representations
   */
  private async applyPatternSeparation(
    tenantId: string,
    entities: HippoRAGEntity[]
  ): Promise<HippoRAGEntity[]> {
    // Get existing entities
    const result = await executeStatement(
      `SELECT entity_id, name, type FROM hipporag_entities WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    const existingEntities = new Map<string, { entityId: string; name: string }>();
    for (const row of (result.rows || []) as Array<Record<string, unknown>>) {
      const name = String(row.name).toLowerCase();
      existingEntities.set(name, {
        entityId: String(row.entity_id),
        name: String(row.name),
      });
    }

    // Apply pattern separation
    const separatedEntities: HippoRAGEntity[] = [];
    
    for (const entity of entities) {
      const existing = existingEntities.get(entity.name.toLowerCase());
      
      if (existing) {
        // Merge with existing entity
        separatedEntities.push({
          ...entity,
          entityId: existing.entityId,
        });
      } else {
        // Check for similar entities (pattern separation)
        let isSimilar = false;
        for (const [existingName] of existingEntities) {
          const similarity = this.computeStringSimilarity(
            entity.name.toLowerCase(),
            existingName
          );
          if (similarity > this.config.patternSeparationThreshold) {
            isSimilar = true;
            break;
          }
        }
        
        if (!isSimilar) {
          separatedEntities.push(entity);
        }
      }
    }

    return separatedEntities;
  }

  /**
   * Extract entities from query
   */
  private async extractQueryEntities(query: string): Promise<string[]> {
    const prompt = `Extract the key entities (nouns, names, concepts) from this query:
"${query}"

Return as JSON array of strings: ["entity1", "entity2", ...]`;

    try {
      const response = await modelRouterService.invoke({
        modelId: this.config.entityExtractionModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        maxTokens: 256,
      });

      const match = response.content.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (error) {
      logger.warn('Query entity extraction failed', { error: String(error) });
    }

    // Fallback: simple word extraction
    return query.split(/\s+/).filter(w => w.length > 3 && /^[A-Z]/.test(w));
  }

  /**
   * Find matching entities in the graph
   */
  private async findMatchingEntities(
    tenantId: string,
    queryEntities: string[]
  ): Promise<Array<{ entityId: string; name: string; matchScore: number }>> {
    if (queryEntities.length === 0) {
      return [];
    }

    const placeholders = queryEntities.map((_, i) => `$${i + 2}`).join(', ');
    const params = [
      stringParam('tenantId', tenantId),
      ...queryEntities.map((e, i) => stringParam(`entity${i}`, `%${e.toLowerCase()}%`)),
    ];

    const result = await executeStatement(
      `SELECT entity_id, name, importance
       FROM hipporag_entities
       WHERE tenant_id = $1 AND (${queryEntities.map((_, i) => `LOWER(name) LIKE $${i + 2}`).join(' OR ')})
       ORDER BY importance DESC
       LIMIT 20`,
      params
    );

    return ((result.rows || []) as Array<Record<string, unknown>>).map(row => ({
      entityId: String(row.entity_id),
      name: String(row.name),
      matchScore: Number(row.importance) || 1.0,
    }));
  }

  /**
   * Run Personalized PageRank from seed entities
   */
  private async personalizedPageRank(
    tenantId: string,
    seedEntities: Array<{ entityId: string; name: string; matchScore: number }>,
    maxHops: number
  ): Promise<Array<{ entityId: string; name: string; score: number }>> {
    if (seedEntities.length === 0) {
      return [];
    }

    // Get the entity graph
    const entityIds = seedEntities.map(e => e.entityId);
    
    // Simple BFS-based approximation of PageRank
    const scores = new Map<string, number>();
    const visited = new Set<string>();
    let frontier = seedEntities.map(e => ({ 
      entityId: e.entityId, 
      name: e.name,
      score: e.matchScore 
    }));

    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
      const nextFrontier: typeof frontier = [];
      const dampingFactor = Math.pow(this.config.dampingFactor, hop);

      for (const entity of frontier) {
        if (visited.has(entity.entityId)) continue;
        visited.add(entity.entityId);

        const currentScore = (scores.get(entity.entityId) || 0) + entity.score * dampingFactor;
        scores.set(entity.entityId, currentScore);

        // Get neighbors
        const neighbors = await this.getEntityNeighbors(tenantId, entity.entityId);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.entityId)) {
            nextFrontier.push({
              entityId: neighbor.entityId,
              name: neighbor.name,
              score: entity.score * neighbor.weight,
            });
          }
        }
      }

      frontier = nextFrontier;
    }

    // Sort by score
    const rankedEntities = Array.from(scores.entries())
      .map(([entityId, score]) => {
        const seed = seedEntities.find(s => s.entityId === entityId);
        return {
          entityId,
          name: seed?.name || entityId,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    return rankedEntities;
  }

  /**
   * Get neighboring entities
   */
  private async getEntityNeighbors(
    tenantId: string,
    entityId: string
  ): Promise<Array<{ entityId: string; name: string; weight: number }>> {
    const result = await executeStatement(
      `SELECT e.entity_id, e.name, r.weight
       FROM hipporag_relations r
       JOIN hipporag_entities e ON (e.entity_id = r.target_entity_id OR e.entity_id = r.source_entity_id)
       WHERE r.tenant_id = $1 AND (r.source_entity_id = $2 OR r.target_entity_id = $2)
         AND e.entity_id != $2
       LIMIT 50`,
      [
        stringParam('tenantId', tenantId),
        stringParam('entityId', entityId),
      ]
    );

    return ((result.rows || []) as Array<Record<string, unknown>>).map(row => ({
      entityId: String(row.entity_id),
      name: String(row.name),
      weight: Number(row.weight) || 1.0,
    }));
  }

  /**
   * Retrieve documents from ranked entities
   */
  private async retrieveDocumentsFromEntities(
    tenantId: string,
    rankedEntities: Array<{ entityId: string; score: number }>,
    k: number
  ): Promise<HippoRAGResult[]> {
    if (rankedEntities.length === 0) {
      return [];
    }

    const topEntities = rankedEntities.slice(0, k * 2);
    const entityIds = topEntities.map(e => e.entityId);

    const result = await executeStatement(
      `SELECT DISTINCT d.doc_id, d.content, e.entity_id, e.name
       FROM hipporag_documents d
       JOIN hipporag_entities e ON e.tenant_id = d.tenant_id 
         AND d.doc_id = ANY(e.document_ids)
       WHERE d.tenant_id = $1 AND e.entity_id = ANY($2::text[])
       LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('entityIds', `{${entityIds.join(',')}}`),
        { name: 'limit', value: { longValue: k } },
      ]
    );

    const entityScores = new Map(topEntities.map(e => [e.entityId, e.score]));

    return ((result.rows || []) as Array<Record<string, unknown>>).map(row => ({
      docId: String(row.doc_id),
      content: String(row.content),
      score: entityScores.get(String(row.entity_id)) || 0.5,
      entities: [String(row.name)],
      pathFromQuery: [],
    }));
  }

  /**
   * Build reasoning path from seed to retrieved entities
   */
  private buildReasoningPath(
    seedEntities: Array<{ entityId: string; name: string }>,
    rankedEntities: Array<{ entityId: string; name: string; score: number }>
  ): string[] {
    const path: string[] = [];
    
    if (seedEntities.length > 0) {
      path.push(`Query entities: ${seedEntities.map(e => e.name).join(', ')}`);
    }

    const topRetrieved = rankedEntities.slice(0, 5);
    if (topRetrieved.length > 0) {
      path.push(`Retrieved via: ${topRetrieved.map(e => `${e.name} (${e.score.toFixed(2)})`).join(' → ')}`);
    }

    return path;
  }

  /**
   * Compute string similarity (Jaccard)
   */
  private computeStringSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HippoRAGConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const hippoRAGService = new HippoRAGService();
