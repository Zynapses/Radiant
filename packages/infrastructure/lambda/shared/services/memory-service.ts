import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

type MemoryType = 'fact' | 'preference' | 'context' | 'instruction' | 'conversation' | 'skill';
type RelationshipType = 'related' | 'contradicts' | 'supports' | 'supersedes' | 'derived_from';

interface MemoryOptions {
  type?: MemoryType;
  source?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

interface MemorySearchResult {
  id: string;
  content: string;
  memoryType: MemoryType;
  importance: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

export class MemoryService {
  private bedrock: BedrockRuntimeClient;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  async getOrCreateStore(
    tenantId: string,
    userId: string,
    storeName: string = 'default'
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO memory_stores (tenant_id, user_id, store_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, user_id, store_name) 
       DO UPDATE SET last_accessed = NOW()
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'storeName', value: { stringValue: storeName } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async addMemory(storeId: string, content: string, options?: MemoryOptions): Promise<string> {
    const embedding = await this.generateEmbedding(content);

    const result = await executeStatement(
      `INSERT INTO memories 
       (store_id, content, embedding, memory_type, source, importance, metadata, expires_at)
       VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        { name: 'storeId', value: { stringValue: storeId } },
        { name: 'content', value: { stringValue: content } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'memoryType', value: { stringValue: options?.type || 'fact' } },
        { name: 'source', value: options?.source ? { stringValue: options.source } : { isNull: true } },
        { name: 'importance', value: { doubleValue: options?.importance || 0.5 } },
        { name: 'metadata', value: { stringValue: JSON.stringify(options?.metadata || {}) } },
        { name: 'expiresAt', value: options?.expiresAt ? { stringValue: options.expiresAt.toISOString() } : { isNull: true } },
      ]
    );

    // Update store count
    await executeStatement(
      `UPDATE memory_stores SET total_memories = total_memories + 1 WHERE id = $1`,
      [{ name: 'storeId', value: { stringValue: storeId } }]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async searchMemories(
    storeId: string,
    query: string,
    limit: number = 5,
    minSimilarity: number = 0.7
  ): Promise<MemorySearchResult[]> {
    const embedding = await this.generateEmbedding(query);

    const result = await executeStatement(
      `SELECT 
         id, content, memory_type, importance, metadata,
         1 - (embedding <=> $2::vector) as similarity
       FROM memories
       WHERE store_id = $1
       AND (expires_at IS NULL OR expires_at > NOW())
       AND 1 - (embedding <=> $2::vector) >= $4
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      [
        { name: 'storeId', value: { stringValue: storeId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'limit', value: { longValue: limit } },
        { name: 'minSimilarity', value: { doubleValue: minSimilarity } },
      ]
    );

    // Update access counts
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      await executeStatement(
        `UPDATE memories SET access_count = access_count + 1, last_accessed = NOW() WHERE id = $1`,
        [{ name: 'id', value: { stringValue: String(r.id) } }]
      );
    }

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        content: String(r.content),
        memoryType: r.memory_type as MemoryType,
        importance: Number(r.importance),
        similarity: Number(r.similarity),
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata as Record<string, unknown>) || {},
      };
    });
  }

  async getMemory(memoryId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT * FROM memories WHERE id = $1`,
      [{ name: 'memoryId', value: { stringValue: memoryId } }]
    );
    return result.rows[0];
  }

  async updateMemory(memoryId: string, content: string, options?: Partial<MemoryOptions>): Promise<void> {
    const embedding = await this.generateEmbedding(content);

    await executeStatement(
      `UPDATE memories 
       SET content = $2, embedding = $3::vector, 
           importance = COALESCE($4, importance),
           metadata = COALESCE($5, metadata)
       WHERE id = $1`,
      [
        { name: 'memoryId', value: { stringValue: memoryId } },
        { name: 'content', value: { stringValue: content } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'importance', value: options?.importance ? { doubleValue: options.importance } : { isNull: true } },
        { name: 'metadata', value: options?.metadata ? { stringValue: JSON.stringify(options.metadata) } : { isNull: true } },
      ]
    );
  }

  async deleteMemory(memoryId: string, storeId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM memories WHERE id = $1`,
      [{ name: 'memoryId', value: { stringValue: memoryId } }]
    );

    await executeStatement(
      `UPDATE memory_stores SET total_memories = total_memories - 1 WHERE id = $1`,
      [{ name: 'storeId', value: { stringValue: storeId } }]
    );
  }

  async addRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType,
    strength: number = 0.5
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO memory_relationships (source_memory_id, target_memory_id, relationship_type, strength)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_memory_id, target_memory_id, relationship_type)
       DO UPDATE SET strength = $4
       RETURNING id`,
      [
        { name: 'sourceId', value: { stringValue: sourceId } },
        { name: 'targetId', value: { stringValue: targetId } },
        { name: 'relationshipType', value: { stringValue: relationshipType } },
        { name: 'strength', value: { doubleValue: strength } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getRelatedMemories(memoryId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT m.*, mr.relationship_type, mr.strength
       FROM memory_relationships mr
       JOIN memories m ON mr.target_memory_id = m.id
       WHERE mr.source_memory_id = $1
       ORDER BY mr.strength DESC`,
      [{ name: 'memoryId', value: { stringValue: memoryId } }]
    );
    return result.rows;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: 'amazon.titan-embed-text-v1',
          body: JSON.stringify({ inputText: text }),
          contentType: 'application/json',
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      return result.embedding;
    } catch (error) {
      logger.error('Embedding generation error', { error });
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }
}

export const memoryService = new MemoryService();
