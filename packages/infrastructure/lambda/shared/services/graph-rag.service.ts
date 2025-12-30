// GraphRAG Service
// Structured Knowledge Mapping with Entity/Relationship Extraction

import { executeStatement, stringParam } from '../db/client';
import { modelRouterService, type ChatMessage } from './model-router.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import type {
  KnowledgeEntity,
  KnowledgeRelationship,
  KnowledgeTriple,
  GraphQuery,
  GraphQueryResult,
  GraphRAGConfig,
  EntityType,
  RelationshipType,
} from '@radiant/shared';
import crypto from 'crypto';

const DEFAULT_CONFIG: GraphRAGConfig = {
  enabled: true,
  extractionModel: 'gpt-4o-mini',
  maxEntitiesPerDocument: 50,
  maxRelationshipsPerDocument: 100,
  minConfidenceThreshold: 0.7,
  enableHybridSearch: true,
  graphWeight: 0.6,
  vectorWeight: 0.4,
  maxHops: 3,
};

class GraphRAGService {
  /**
   * Extract entities and relationships from a document
   */
  async extractKnowledge(
    tenantId: string,
    documentId: string,
    content: string,
    config?: Partial<GraphRAGConfig>
  ): Promise<{ entities: KnowledgeEntity[]; relationships: KnowledgeRelationship[] }> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Extract triples from content
    const triples = await this.extractTriples(content, mergedConfig);

    // Convert triples to entities and relationships
    const entities: KnowledgeEntity[] = [];
    const relationships: KnowledgeRelationship[] = [];
    const entityMap = new Map<string, KnowledgeEntity>();

    for (const triple of triples) {
      // Create or get subject entity
      let subjectEntity = entityMap.get(triple.subject.toLowerCase());
      if (!subjectEntity) {
        subjectEntity = {
          id: crypto.randomUUID(),
          tenantId,
          type: this.inferEntityType(triple.subject),
          name: triple.subject,
          properties: {},
          sourceDocumentIds: [documentId],
          confidence: triple.confidence,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        entityMap.set(triple.subject.toLowerCase(), subjectEntity);
        entities.push(subjectEntity);
      }

      // Create or get object entity
      let objectEntity = entityMap.get(triple.object.toLowerCase());
      if (!objectEntity) {
        objectEntity = {
          id: crypto.randomUUID(),
          tenantId,
          type: this.inferEntityType(triple.object),
          name: triple.object,
          properties: {},
          sourceDocumentIds: [documentId],
          confidence: triple.confidence,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        entityMap.set(triple.object.toLowerCase(), objectEntity);
        entities.push(objectEntity);
      }

      // Create relationship
      const relationship: KnowledgeRelationship = {
        id: crypto.randomUUID(),
        tenantId,
        sourceEntityId: subjectEntity.id,
        targetEntityId: objectEntity.id,
        type: this.inferRelationshipType(triple.predicate),
        description: triple.predicate,
        weight: triple.confidence,
        properties: {},
        sourceDocumentIds: [documentId],
        confidence: triple.confidence,
        createdAt: new Date(),
      };
      relationships.push(relationship);
    }

    // Save to database
    await this.saveEntities(entities);
    await this.saveRelationships(relationships);

    return { entities, relationships };
  }

  /**
   * Extract (Subject, Predicate, Object) triples from text
   */
  private async extractTriples(
    content: string,
    config: GraphRAGConfig
  ): Promise<KnowledgeTriple[]> {
    const prompt = `Extract knowledge triples from this text. Return ONLY a valid JSON array, no other text:
[{"subject": "X", "predicate": "Y", "object": "Z", "confidence": 0.9}]

Text: ${content.slice(0, 4000)}

Rules:
1. Extract up to ${config.maxEntitiesPerDocument} entities
2. Focus on key concepts, people, organizations, relationships
3. Use clear, normalized predicates (authored_by, depends_on, located_in, works_for, related_to, etc.)
4. Confidence should reflect certainty (0.0-1.0)
5. Return ONLY the JSON array, nothing else`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a knowledge extraction system. Extract structured knowledge triples from text. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ];
      
      const response = await modelRouterService.invoke({
        modelId: config.extractionModel || 'anthropic/claude-3-haiku',
        messages,
        temperature: 0,
        maxTokens: 2048,
      });
      
      // Parse the JSON response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          subject: string;
          predicate: string;
          object: string;
          confidence: number;
        }>;
        
        return parsed
          .filter(t => t.subject && t.predicate && t.object)
          .map((t, idx) => ({
            subject: t.subject,
            predicate: t.predicate,
            object: t.object,
            confidence: t.confidence || 0.8,
            sourceChunk: content.slice(idx * 200, (idx + 1) * 200),
          }))
          .filter(t => t.confidence >= config.minConfidenceThreshold);
      }
      
      logger.warn('Failed to parse LLM response as JSON, falling back to pattern extraction');
    } catch (error) {
      logger.warn('LLM extraction failed, falling back to pattern extraction', { error: String(error) });
    }
    
    // Fallback: Simple pattern-based extraction
    const triples: KnowledgeTriple[] = [];
    const sentences = content.split(/[.!?]+/);
    for (const sentence of sentences.slice(0, 10)) {
      const words = sentence.trim().split(/\s+/);
      if (words.length >= 3) {
        triples.push({
          subject: words[0],
          predicate: 'mentioned_with',
          object: words[words.length - 1],
          confidence: 0.5,
          sourceChunk: sentence.trim(),
        });
      }
    }

    return triples.filter(t => t.confidence >= config.minConfidenceThreshold);
  }

  /**
   * Query the knowledge graph
   */
  async queryGraph(
    tenantId: string,
    query: GraphQuery
  ): Promise<GraphQueryResult> {
    const entities: KnowledgeEntity[] = [];
    const relationships: KnowledgeRelationship[] = [];
    const paths: GraphQueryResult['paths'] = [];

    // Find starting entities
    const startEntities = await this.findEntitiesByNames(tenantId, query.startEntities);
    entities.push(...startEntities);

    // Traverse graph up to maxHops
    const visited = new Set<string>();
    const toVisit = startEntities.map(e => ({ entity: e, depth: 0, path: [e.id], relPath: [] as string[] }));

    while (toVisit.length > 0) {
      const current = toVisit.shift()!;
      if (visited.has(current.entity.id) || current.depth >= query.maxHops) continue;
      visited.add(current.entity.id);

      // Get connected entities
      const connected = await this.getConnectedEntities(
        tenantId,
        current.entity.id,
        query.relationshipTypes,
        query.entityTypes
      );

      for (const { entity, relationship } of connected) {
        if (!visited.has(entity.id)) {
          entities.push(entity);
          relationships.push(relationship);

          const newPath = [...current.path, entity.id];
          const newRelPath = [...current.relPath, relationship.id];

          toVisit.push({
            entity,
            depth: current.depth + 1,
            path: newPath,
            relPath: newRelPath,
          });

          // Record path
          paths.push({
            nodes: newPath,
            relationships: newRelPath,
            totalWeight: this.calculatePathWeight(relationships.filter(r => newRelPath.includes(r.id))),
          });
        }
      }
    }

    // Generate reasoning explanation
    const reasoning = this.generateReasoningExplanation(query.startEntities, entities, relationships);

    return {
      entities: this.deduplicateEntities(entities),
      relationships: this.deduplicateRelationships(relationships),
      paths: paths.slice(0, query.limit || 10),
      reasoning,
    };
  }

  /**
   * Hybrid search combining graph traversal with vector similarity
   */
  async hybridSearch(
    tenantId: string,
    queryText: string,
    queryEmbedding: number[],
    config?: Partial<GraphRAGConfig>
  ): Promise<GraphQueryResult> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Vector search for semantically similar entities
    const vectorResults = await this.vectorSearchEntities(tenantId, queryEmbedding, 10);

    // Extract key terms for graph search
    const keyTerms = this.extractKeyTerms(queryText);

    // Graph search from key terms
    const graphResult = await this.queryGraph(tenantId, {
      startEntities: keyTerms,
      maxHops: mergedConfig.maxHops,
      minConfidence: mergedConfig.minConfidenceThreshold,
    });

    // Combine results with weights
    const combinedEntities = this.combineResults(
      vectorResults,
      graphResult.entities,
      mergedConfig.vectorWeight,
      mergedConfig.graphWeight
    );

    return {
      entities: combinedEntities,
      relationships: graphResult.relationships,
      paths: graphResult.paths,
      reasoning: `Hybrid search combining vector similarity (${(mergedConfig.vectorWeight * 100).toFixed(0)}% weight) with graph traversal (${(mergedConfig.graphWeight * 100).toFixed(0)}% weight). Found ${combinedEntities.length} relevant entities connected through ${graphResult.relationships.length} relationships.`,
    };
  }

  /**
   * Find entities by name
   */
  private async findEntitiesByNames(tenantId: string, names: string[]): Promise<KnowledgeEntity[]> {
    if (names.length === 0) return [];

    const result = await executeStatement(
      `SELECT * FROM knowledge_entities
       WHERE tenant_id = $1::uuid
       AND LOWER(name) = ANY($2::text[])`,
      [
        stringParam('tenantId', tenantId),
        stringParam('names', `{${names.map(n => n.toLowerCase()).join(',')}}`),
      ]
    );

    return (result.rows || []).map(row => this.mapRowToEntity(row));
  }

  /**
   * Get entities connected to a given entity
   */
  private async getConnectedEntities(
    tenantId: string,
    entityId: string,
    relationshipTypes?: RelationshipType[],
    entityTypes?: EntityType[]
  ): Promise<{ entity: KnowledgeEntity; relationship: KnowledgeRelationship }[]> {
    let sql = `
      SELECT e.*, r.id as rel_id, r.type as rel_type, r.description as rel_desc,
             r.weight as rel_weight, r.confidence as rel_confidence
      FROM knowledge_entities e
      JOIN knowledge_relationships r ON (
        (r.source_entity_id = $1::uuid AND r.target_entity_id = e.id) OR
        (r.target_entity_id = $1::uuid AND r.source_entity_id = e.id)
      )
      WHERE e.tenant_id = $2::uuid
    `;

    const params = [
      stringParam('entityId', entityId),
      stringParam('tenantId', tenantId),
    ];

    if (relationshipTypes?.length) {
      sql += ` AND r.type = ANY($3::text[])`;
      params.push(stringParam('relTypes', `{${relationshipTypes.join(',')}}`));
    }

    if (entityTypes?.length) {
      sql += ` AND e.type = ANY($${params.length + 1}::text[])`;
      params.push(stringParam('entityTypes', `{${entityTypes.join(',')}}`));
    }

    const result = await executeStatement(sql, params);

    return (result.rows || []).map(row => ({
      entity: this.mapRowToEntity(row),
      relationship: {
        id: row.rel_id as string,
        tenantId,
        sourceEntityId: entityId,
        targetEntityId: row.id as string,
        type: row.rel_type as RelationshipType,
        description: row.rel_desc as string,
        weight: parseFloat(row.rel_weight as string),
        properties: {},
        sourceDocumentIds: [],
        confidence: parseFloat(row.rel_confidence as string),
        createdAt: new Date(),
      },
    }));
  }

  /**
   * Vector search for entities
   */
  private async vectorSearchEntities(
    tenantId: string,
    embedding: number[],
    limit: number
  ): Promise<KnowledgeEntity[]> {
    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await executeStatement(
      `SELECT *, 1 - (embedding <=> $1::vector) as similarity
       FROM knowledge_entities
       WHERE tenant_id = $2::uuid
       AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [
        stringParam('embedding', embeddingStr),
        stringParam('tenantId', tenantId),
        stringParam('limit', String(limit)),
      ]
    );

    return (result.rows || []).map(row => this.mapRowToEntity(row));
  }

  /**
   * Save entities to database
   */
  private async saveEntities(entities: KnowledgeEntity[]): Promise<void> {
    for (const entity of entities) {
      await executeStatement(
        `INSERT INTO knowledge_entities (
           id, tenant_id, type, name, description, properties,
           source_document_ids, confidence, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb,
           $7::text[], $8, $9, $10
         )
         ON CONFLICT (tenant_id, LOWER(name)) DO UPDATE SET
           source_document_ids = array_cat(knowledge_entities.source_document_ids, $7::text[]),
           confidence = GREATEST(knowledge_entities.confidence, $8),
           updated_at = $10`,
        [
          stringParam('id', entity.id),
          stringParam('tenantId', entity.tenantId),
          stringParam('type', entity.type),
          stringParam('name', entity.name),
          stringParam('description', entity.description || ''),
          stringParam('properties', JSON.stringify(entity.properties)),
          stringParam('sourceDocIds', `{${entity.sourceDocumentIds.join(',')}}`),
          stringParam('confidence', String(entity.confidence)),
          stringParam('createdAt', entity.createdAt.toISOString()),
          stringParam('updatedAt', entity.updatedAt.toISOString()),
        ]
      );
    }
  }

  /**
   * Save relationships to database
   */
  private async saveRelationships(relationships: KnowledgeRelationship[]): Promise<void> {
    for (const rel of relationships) {
      await executeStatement(
        `INSERT INTO knowledge_relationships (
           id, tenant_id, source_entity_id, target_entity_id,
           type, description, weight, properties,
           source_document_ids, confidence, created_at
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid,
           $5, $6, $7, $8::jsonb,
           $9::text[], $10, $11
         )
         ON CONFLICT DO NOTHING`,
        [
          stringParam('id', rel.id),
          stringParam('tenantId', rel.tenantId),
          stringParam('sourceEntityId', rel.sourceEntityId),
          stringParam('targetEntityId', rel.targetEntityId),
          stringParam('type', rel.type),
          stringParam('description', rel.description || ''),
          stringParam('weight', String(rel.weight)),
          stringParam('properties', JSON.stringify(rel.properties)),
          stringParam('sourceDocIds', `{${rel.sourceDocumentIds.join(',')}}`),
          stringParam('confidence', String(rel.confidence)),
          stringParam('createdAt', rel.createdAt.toISOString()),
        ]
      );
    }
  }

  /**
   * Infer entity type from name
   */
  private inferEntityType(name: string): EntityType {
    const lower = name.toLowerCase();
    
    if (/\b(inc|corp|llc|ltd|company|organization)\b/i.test(name)) return 'organization';
    if (/\b(mr|ms|mrs|dr|prof)\b/i.test(name) || /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name)) return 'person';
    if (/\.(pdf|doc|txt|csv)$/i.test(name)) return 'document';
    if (/\d{4}[-/]\d{2}[-/]\d{2}/.test(name)) return 'date';
    if (/\$[\d,]+|\d+%/.test(name)) return 'metric';
    
    return 'concept';
  }

  /**
   * Infer relationship type from predicate
   */
  private inferRelationshipType(predicate: string): RelationshipType {
    const lower = predicate.toLowerCase();
    
    if (/wrote|authored|created/.test(lower)) return 'authored_by';
    if (/depends|requires|needs/.test(lower)) return 'depends_on';
    if (/blocks|prevents/.test(lower)) return 'blocked_by';
    if (/part of|belongs to|member of/.test(lower)) return 'part_of';
    if (/caused|led to|resulted/.test(lower)) return 'caused_by';
    if (/before|precedes/.test(lower)) return 'precedes';
    if (/after|follows/.test(lower)) return 'follows';
    if (/mentions|references/.test(lower)) return 'mentions';
    if (/contradicts|opposes/.test(lower)) return 'contradicts';
    if (/supports|confirms/.test(lower)) return 'supports';
    if (/defines|means/.test(lower)) return 'defines';
    if (/located|in|at/.test(lower)) return 'located_in';
    if (/works|employed/.test(lower)) return 'works_for';
    if (/owns|has/.test(lower)) return 'owns';
    
    return 'related_to';
  }

  /**
   * Extract key terms from query
   */
  private extractKeyTerms(text: string): string[] {
    // Simple extraction - would use NLP in production
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'hers', 'i', 'me', 'my']);
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5);
  }

  /**
   * Calculate total path weight
   */
  private calculatePathWeight(relationships: KnowledgeRelationship[]): number {
    if (relationships.length === 0) return 0;
    return relationships.reduce((sum, r) => sum + r.weight, 0) / relationships.length;
  }

  /**
   * Generate natural language explanation
   */
  private generateReasoningExplanation(
    startTerms: string[],
    entities: KnowledgeEntity[],
    relationships: KnowledgeRelationship[]
  ): string {
    const entityTypes = [...new Set(entities.map(e => e.type))];
    const relTypes = [...new Set(relationships.map(r => r.type))];

    return `Starting from "${startTerms.join('", "')}", found ${entities.length} connected entities (${entityTypes.join(', ')}) through ${relationships.length} relationships (${relTypes.join(', ')}). This reveals multi-hop connections that vector similarity alone would miss.`;
  }

  /**
   * Combine vector and graph results
   */
  private combineResults(
    vectorResults: KnowledgeEntity[],
    graphResults: KnowledgeEntity[],
    vectorWeight: number,
    graphWeight: number
  ): KnowledgeEntity[] {
    const combined = new Map<string, KnowledgeEntity & { combinedScore: number }>();

    for (let i = 0; i < vectorResults.length; i++) {
      const entity = vectorResults[i];
      const score = (1 - i / vectorResults.length) * vectorWeight;
      combined.set(entity.id, { ...entity, combinedScore: score });
    }

    for (let i = 0; i < graphResults.length; i++) {
      const entity = graphResults[i];
      const score = (1 - i / graphResults.length) * graphWeight;
      if (combined.has(entity.id)) {
        combined.get(entity.id)!.combinedScore += score;
      } else {
        combined.set(entity.id, { ...entity, combinedScore: score });
      }
    }

    return Array.from(combined.values())
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /**
   * Deduplicate entities
   */
  private deduplicateEntities(entities: KnowledgeEntity[]): KnowledgeEntity[] {
    const seen = new Set<string>();
    return entities.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }

  /**
   * Deduplicate relationships
   */
  private deduplicateRelationships(relationships: KnowledgeRelationship[]): KnowledgeRelationship[] {
    const seen = new Set<string>();
    return relationships.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  /**
   * Map database row to entity
   */
  private mapRowToEntity(row: Record<string, unknown>): KnowledgeEntity {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      type: row.type as EntityType,
      name: row.name as string,
      description: row.description as string,
      properties: (row.properties || {}) as Record<string, unknown>,
      sourceDocumentIds: (row.source_document_ids || []) as string[],
      confidence: parseFloat(row.confidence as string) || 0,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Get configuration
   */
  async getConfig(tenantId: string): Promise<GraphRAGConfig> {
    const result = await executeStatement(
      `SELECT graph_rag FROM cognitive_architecture_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );

    if (result.rows?.length && result.rows[0].graph_rag) {
      return result.rows[0].graph_rag as GraphRAGConfig;
    }

    return DEFAULT_CONFIG;
  }
}

export const graphRAGService = new GraphRAGService();
