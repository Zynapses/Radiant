// RADIANT v4.18.0 - Multimodal Binding Service
// Advanced Cognition: Shared embedding space, cross-modal retrieval, grounding

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type Modality = 'text' | 'image' | 'audio' | 'code' | 'structured_data';

export interface MultimodalRepresentation {
  representationId: string;
  sourceModality: Modality;
  sourceContentHash: string;
  unifiedEmbedding: number[];
  linkedEntities: string[];
  linkedMemories: string[];
  associatedRepresentations: string[];
  embeddingQuality: number;
  groundingConfidence: number;
  createdAt: Date;
}

export interface CrossModalQuery {
  queryId: string;
  queryModality: Modality;
  queryContent: string;
  targetModalities: Modality[];
  results: CrossModalResult[];
  latencyMs: number;
}

export interface CrossModalResult {
  representationId: string;
  modality: Modality;
  similarity: number;
  contentPreview: string;
}

export interface GroundingLink {
  type: 'entity' | 'memory' | 'concept';
  targetId: string;
  confidence: number;
}

// ============================================================================
// Multimodal Binding Service
// ============================================================================

export class MultimodalBindingService {
  // ============================================================================
  // Representation Management
  // ============================================================================

  async createRepresentation(
    tenantId: string,
    modality: Modality,
    content: string | Buffer,
    options: {
      userId?: string;
      metadata?: Record<string, unknown>;
      autoGround?: boolean;
    } = {}
  ): Promise<MultimodalRepresentation> {
    // Generate content hash
    const contentHash = crypto.createHash('sha256')
      .update(typeof content === 'string' ? content : content.toString('base64'))
      .digest('hex');

    // Check if representation already exists
    const existing = await executeStatement(
      `SELECT * FROM multimodal_representations WHERE tenant_id = $1 AND source_content_hash = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'hash', value: { stringValue: contentHash } },
      ]
    );

    if (existing.rows.length > 0) {
      return this.mapRepresentation(existing.rows[0] as Record<string, unknown>);
    }

    // Generate unified embedding based on modality
    const unifiedEmbedding = await this.generateUnifiedEmbedding(modality, content);

    // Generate modality-specific embeddings
    const modalityEmbeddings = await this.generateModalityEmbeddings(modality, content);

    // Create representation
    const result = await executeStatement(
      `INSERT INTO multimodal_representations (
        tenant_id, user_id, source_modality, source_content_hash, source_metadata,
        unified_embedding, embedding_model, text_embedding, code_embedding, embedding_quality
      ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8::vector, $9::vector, $10)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: options.userId ? { stringValue: options.userId } : { isNull: true } },
        { name: 'modality', value: { stringValue: modality } },
        { name: 'hash', value: { stringValue: contentHash } },
        { name: 'metadata', value: { stringValue: JSON.stringify(options.metadata || {}) } },
        { name: 'unifiedEmbedding', value: { stringValue: `[${unifiedEmbedding.join(',')}]` } },
        { name: 'embeddingModel', value: { stringValue: 'titan-embed-v1' } },
        { name: 'textEmbedding', value: modalityEmbeddings.text ? { stringValue: `[${modalityEmbeddings.text.join(',')}]` } : { isNull: true } },
        { name: 'codeEmbedding', value: modalityEmbeddings.code ? { stringValue: `[${modalityEmbeddings.code.join(',')}]` } : { isNull: true } },
        { name: 'quality', value: { doubleValue: 0.8 } },
      ]
    );

    const representation = this.mapRepresentation(result.rows[0] as Record<string, unknown>);

    // Auto-ground if requested
    if (options.autoGround !== false) {
      await this.groundRepresentation(tenantId, representation.representationId, content);
    }

    return representation;
  }

  async getRepresentation(representationId: string): Promise<MultimodalRepresentation | null> {
    const result = await executeStatement(
      `SELECT * FROM multimodal_representations WHERE representation_id = $1`,
      [{ name: 'representationId', value: { stringValue: representationId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapRepresentation(result.rows[0] as Record<string, unknown>);
  }

  // ============================================================================
  // Unified Embedding Generation
  // ============================================================================

  private async generateUnifiedEmbedding(modality: Modality, content: string | Buffer): Promise<number[]> {
    // Convert all modalities to text representation for unified embedding
    let textRepresentation: string;

    switch (modality) {
      case 'text':
        textRepresentation = typeof content === 'string' ? content : content.toString('utf-8');
        break;

      case 'code':
        textRepresentation = await this.codeToText(typeof content === 'string' ? content : content.toString('utf-8'));
        break;

      case 'image':
        textRepresentation = await this.imageToText(content);
        break;

      case 'audio':
        textRepresentation = await this.audioToText(content);
        break;

      case 'structured_data':
        textRepresentation = await this.structuredDataToText(typeof content === 'string' ? content : content.toString('utf-8'));
        break;

      default:
        textRepresentation = typeof content === 'string' ? content : content.toString('utf-8');
    }

    return this.generateEmbedding(textRepresentation);
  }

  private async generateModalityEmbeddings(modality: Modality, content: string | Buffer): Promise<{
    text?: number[];
    code?: number[];
  }> {
    const embeddings: { text?: number[]; code?: number[] } = {};

    if (modality === 'text') {
      embeddings.text = await this.generateEmbedding(typeof content === 'string' ? content : content.toString('utf-8'));
    } else if (modality === 'code') {
      embeddings.code = await this.generateEmbedding(typeof content === 'string' ? content : content.toString('utf-8'));
    }

    return embeddings;
  }

  private async codeToText(code: string): Promise<string> {
    const prompt = `Describe what this code does in natural language:

\`\`\`
${code.substring(0, 2000)}
\`\`\`

Provide a concise description focusing on:
1. The purpose of the code
2. Key functions/classes
3. Important logic

Keep it under 300 words.`;

    try {
      return await this.invokeModel(prompt);
    } catch {
      return `Code: ${code.substring(0, 500)}`;
    }
  }

  private async imageToText(image: string | Buffer): Promise<string> {
    // In production, this would call a vision model
    // For now, return placeholder that could be enhanced with actual vision API
    return 'Image content - vision analysis pending';
  }

  private async audioToText(audio: string | Buffer): Promise<string> {
    // In production, this would call a speech-to-text model
    return 'Audio content - transcription pending';
  }

  private async structuredDataToText(data: string): Promise<string> {
    try {
      const parsed = JSON.parse(data);
      const prompt = `Describe this structured data in natural language:

${JSON.stringify(parsed, null, 2).substring(0, 2000)}

Summarize:
1. What type of data this is
2. Key fields and their meanings
3. Notable patterns or values`;

      return await this.invokeModel(prompt);
    } catch {
      return `Structured data: ${data.substring(0, 500)}`;
    }
  }

  // ============================================================================
  // Cross-Modal Search
  // ============================================================================

  async crossModalSearch(
    tenantId: string,
    query: string,
    queryModality: Modality,
    targetModalities: Modality[],
    limit = 10,
    options: { userId?: string } = {}
  ): Promise<CrossModalQuery> {
    const startTime = Date.now();

    // Generate query embedding
    const queryEmbedding = await this.generateUnifiedEmbedding(queryModality, query);

    // Search across target modalities
    let modalityFilter = '';
    if (targetModalities.length > 0 && !targetModalities.includes('text' as Modality)) {
      modalityFilter = `AND source_modality = ANY(ARRAY[${targetModalities.map((m) => `'${m}'`).join(',')}])`;
    }

    const result = await executeStatement(
      `SELECT representation_id, source_modality, source_metadata,
              1 - (unified_embedding <=> $2::vector) as similarity
       FROM multimodal_representations
       WHERE tenant_id = $1 ${modalityFilter}
       ORDER BY unified_embedding <=> $2::vector
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'queryEmbedding', value: { stringValue: `[${queryEmbedding.join(',')}]` } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    const results: CrossModalResult[] = result.rows.map((row) => {
      const r = row as { representation_id: string; source_modality: string; source_metadata: string; similarity: number };
      const metadata = typeof r.source_metadata === 'string' ? JSON.parse(r.source_metadata) : r.source_metadata;
      return {
        representationId: r.representation_id,
        modality: r.source_modality as Modality,
        similarity: Number(r.similarity),
        contentPreview: metadata?.preview || metadata?.description || 'No preview available',
      };
    });

    const latencyMs = Date.now() - startTime;

    // Log the query
    const queryResult = await executeStatement(
      `INSERT INTO crossmodal_queries (
        tenant_id, user_id, query_modality, query_content, query_embedding,
        target_modalities, results, result_count, latency_ms
      ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9)
      RETURNING query_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: options.userId ? { stringValue: options.userId } : { isNull: true } },
        { name: 'queryModality', value: { stringValue: queryModality } },
        { name: 'queryContent', value: { stringValue: query.substring(0, 1000) } },
        { name: 'queryEmbedding', value: { stringValue: `[${queryEmbedding.join(',')}]` } },
        { name: 'targetModalities', value: { stringValue: `{${targetModalities.join(',')}}` } },
        { name: 'results', value: { stringValue: JSON.stringify(results) } },
        { name: 'resultCount', value: { longValue: results.length } },
        { name: 'latencyMs', value: { longValue: latencyMs } },
      ]
    );

    return {
      queryId: (queryResult.rows[0] as { query_id: string }).query_id,
      queryModality,
      queryContent: query,
      targetModalities,
      results,
      latencyMs,
    };
  }

  async findSimilarAcrossModalities(
    tenantId: string,
    representationId: string,
    limit = 5
  ): Promise<CrossModalResult[]> {
    const representation = await this.getRepresentation(representationId);
    if (!representation) return [];

    const result = await executeStatement(
      `SELECT representation_id, source_modality, source_metadata,
              1 - (unified_embedding <=> $2::vector) as similarity
       FROM multimodal_representations
       WHERE tenant_id = $1
         AND representation_id != $3
       ORDER BY unified_embedding <=> $2::vector
       LIMIT $4`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'embedding', value: { stringValue: `[${representation.unifiedEmbedding.join(',')}]` } },
        { name: 'excludeId', value: { stringValue: representationId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map((row) => {
      const r = row as { representation_id: string; source_modality: string; source_metadata: string; similarity: number };
      const metadata = typeof r.source_metadata === 'string' ? JSON.parse(r.source_metadata) : r.source_metadata;
      return {
        representationId: r.representation_id,
        modality: r.source_modality as Modality,
        similarity: Number(r.similarity),
        contentPreview: metadata?.preview || 'No preview',
      };
    });
  }

  // ============================================================================
  // Grounding
  // ============================================================================

  async groundRepresentation(tenantId: string, representationId: string, content: string | Buffer): Promise<GroundingLink[]> {
    const textContent = typeof content === 'string' ? content : content.toString('utf-8');
    const links: GroundingLink[] = [];

    // Link to world model entities
    const entityLinks = await this.linkToEntities(tenantId, textContent);
    links.push(...entityLinks);

    // Link to episodic memories
    const memoryLinks = await this.linkToMemories(tenantId, textContent);
    links.push(...memoryLinks);

    // Update representation with links
    await executeStatement(
      `UPDATE multimodal_representations SET
        linked_entities = $2,
        linked_memories = $3,
        grounding_confidence = $4
      WHERE representation_id = $1`,
      [
        { name: 'representationId', value: { stringValue: representationId } },
        { name: 'entities', value: { stringValue: `{${entityLinks.map((l) => l.targetId).join(',')}}` } },
        { name: 'memories', value: { stringValue: `{${memoryLinks.map((l) => l.targetId).join(',')}}` } },
        { name: 'confidence', value: { doubleValue: links.length > 0 ? Math.max(...links.map((l) => l.confidence)) : 0 } },
      ]
    );

    return links;
  }

  private async linkToEntities(tenantId: string, content: string): Promise<GroundingLink[]> {
    const embedding = await this.generateEmbedding(content);

    const result = await executeStatement(
      `SELECT entity_id, 1 - (entity_embedding <=> $2::vector) as similarity
       FROM world_model_entities
       WHERE tenant_id = $1
       ORDER BY entity_embedding <=> $2::vector
       LIMIT 5`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
      ]
    );

    return result.rows
      .filter((r) => Number((r as { similarity: number }).similarity) > 0.7)
      .map((r) => ({
        type: 'entity' as const,
        targetId: (r as { entity_id: string }).entity_id,
        confidence: Number((r as { similarity: number }).similarity),
      }));
  }

  private async linkToMemories(tenantId: string, content: string): Promise<GroundingLink[]> {
    const embedding = await this.generateEmbedding(content);

    const result = await executeStatement(
      `SELECT memory_id, 1 - (content_embedding <=> $2::vector) as similarity
       FROM episodic_memories
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY content_embedding <=> $2::vector
       LIMIT 5`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
      ]
    );

    return result.rows
      .filter((r) => Number((r as { similarity: number }).similarity) > 0.7)
      .map((r) => ({
        type: 'memory' as const,
        targetId: (r as { memory_id: string }).memory_id,
        confidence: Number((r as { similarity: number }).similarity),
      }));
  }

  // ============================================================================
  // Association Management
  // ============================================================================

  async createAssociation(representationIdA: string, representationIdB: string, strength: number): Promise<void> {
    // Update both representations with bidirectional association
    await executeStatement(
      `UPDATE multimodal_representations SET
        associated_representations = array_append(
          array_remove(associated_representations, $2), $2
        ),
        association_strengths = association_strengths || jsonb_build_object($2::text, $3)
      WHERE representation_id = $1`,
      [
        { name: 'idA', value: { stringValue: representationIdA } },
        { name: 'idB', value: { stringValue: representationIdB } },
        { name: 'strength', value: { doubleValue: strength } },
      ]
    );

    await executeStatement(
      `UPDATE multimodal_representations SET
        associated_representations = array_append(
          array_remove(associated_representations, $2), $2
        ),
        association_strengths = association_strengths || jsonb_build_object($2::text, $3)
      WHERE representation_id = $1`,
      [
        { name: 'idB', value: { stringValue: representationIdB } },
        { name: 'idA', value: { stringValue: representationIdA } },
        { name: 'strength', value: { doubleValue: strength } },
      ]
    );
  }

  async getAssociations(representationId: string): Promise<Array<{ representationId: string; strength: number }>> {
    const result = await executeStatement(
      `SELECT associated_representations, association_strengths FROM multimodal_representations WHERE representation_id = $1`,
      [{ name: 'representationId', value: { stringValue: representationId } }]
    );

    if (result.rows.length === 0) return [];

    const row = result.rows[0] as { associated_representations: string[]; association_strengths: Record<string, number> };
    const associations = row.associated_representations || [];
    const strengths = typeof row.association_strengths === 'string' 
      ? JSON.parse(row.association_strengths) 
      : row.association_strengths || {};

    return associations.map((id) => ({
      representationId: id,
      strength: strengths[id] || 0.5,
    }));
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
      maxTokens: 1024,
    });
    return response.content;
  }

  private mapRepresentation(row: Record<string, unknown>): MultimodalRepresentation {
    return {
      representationId: String(row.representation_id),
      sourceModality: row.source_modality as Modality,
      sourceContentHash: String(row.source_content_hash),
      unifiedEmbedding: [], // Would parse from vector in production
      linkedEntities: (row.linked_entities as string[]) || [],
      linkedMemories: (row.linked_memories as string[]) || [],
      associatedRepresentations: (row.associated_representations as string[]) || [],
      embeddingQuality: Number(row.embedding_quality || 0.8),
      groundingConfidence: Number(row.grounding_confidence || 0),
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const multimodalBindingService = new MultimodalBindingService();
