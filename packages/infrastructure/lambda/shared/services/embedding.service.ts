// RADIANT v5.2.1 - Centralized Embedding Service
// Provides embedding generation for semantic search across all services
// Now with resilience patterns: circuit breaker, retry, timeout
// ============================================================================

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { callWithResilience } from './resilient-provider.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  tokensUsed?: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  totalTokensUsed?: number;
}

export type EmbeddingProvider = 'openai' | 'bedrock' | 'cohere' | 'local';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  maxBatchSize: number;
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  maxBatchSize: 100,
  cacheEnabled: true,
  cacheTtlSeconds: 3600,
};

const PROVIDER_CONFIGS: Record<EmbeddingProvider, Partial<EmbeddingConfig>> = {
  openai: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    maxBatchSize: 2048,
  },
  bedrock: {
    model: 'amazon.titan-embed-text-v2:0',
    dimensions: 1024,
    maxBatchSize: 25,
  },
  cohere: {
    model: 'embed-english-v3.0',
    dimensions: 1024,
    maxBatchSize: 96,
  },
  local: {
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
    maxBatchSize: 32,
  },
};

// ============================================================================
// Embedding Service
// ============================================================================

class EmbeddingService {
  private bedrockClient: BedrockRuntimeClient;
  private cache: Map<string, { embedding: number[]; expiresAt: number }> = new Map();
  private config: EmbeddingConfig;

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.config = this.loadConfig();
  }

  private loadConfig(): EmbeddingConfig {
    const provider = (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'openai';
    return {
      ...DEFAULT_CONFIG,
      ...PROVIDER_CONFIGS[provider],
      provider,
    };
  }

  // ==========================================================================
  // Single Embedding
  // ==========================================================================

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string, options?: {
    provider?: EmbeddingProvider;
    skipCache?: boolean;
  }): Promise<EmbeddingResult> {
    const provider = options?.provider || this.config.provider;
    
    // Check cache
    if (this.config.cacheEnabled && !options?.skipCache) {
      const cached = this.getCachedEmbedding(text);
      if (cached) {
        return {
          embedding: cached,
          model: this.config.model,
          dimensions: cached.length,
        };
      }
    }

    let result: EmbeddingResult;

    switch (provider) {
      case 'openai':
        result = await this.generateOpenAIEmbedding(text);
        break;
      case 'bedrock':
        result = await this.generateBedrockEmbedding(text);
        break;
      case 'cohere':
        result = await this.generateCohereEmbedding(text);
        break;
      default:
        // Fallback to OpenAI
        result = await this.generateOpenAIEmbedding(text);
    }

    // Cache result
    if (this.config.cacheEnabled) {
      this.cacheEmbedding(text, result.embedding);
    }

    return result;
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async generateOpenAIEmbedding(text: string): Promise<EmbeddingResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const endpoint = process.env.EMBEDDING_API_URL || 'https://api.openai.com/v1/embeddings';

    if (!apiKey) {
      logger.warn('OpenAI API key not configured, using zero vector');
      return this.getZeroVector('openai');
    }

    try {
      // Wrap OpenAI embedding call with resilience
      const data = await callWithResilience(
        async () => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              input: text.slice(0, 8000),
              model: this.config.model,
            }),
          });

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
          }

          return response.json() as Promise<{
            data: Array<{ embedding: number[] }>;
            usage?: { total_tokens: number };
          }>;
        },
        {
          provider: 'openai',
          operation: 'embedding',
          timeoutMs: 30000,
          maxRetries: 3,
        }
      );

      return {
        embedding: data.data[0].embedding,
        model: this.config.model,
        dimensions: data.data[0].embedding.length,
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      logger.error('OpenAI embedding failed', { error: String(error) });
      return this.getZeroVector('openai');
    }
  }

  /**
   * Generate embedding using AWS Bedrock Titan
   */
  private async generateBedrockEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      const command = new InvokeModelCommand({
        modelId: 'amazon.titan-embed-text-v2:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: text.slice(0, 8000),
          dimensions: 1024,
          normalize: true,
        }),
      });

      // Wrap Bedrock embedding call with resilience
      const response = await callWithResilience(
        () => this.bedrockClient.send(command),
        {
          provider: 'bedrock',
          operation: 'embedding',
          timeoutMs: 30000,
          maxRetries: 2,
        }
      );

      const result = JSON.parse(new TextDecoder().decode(response.body)) as {
        embedding: number[];
        inputTextTokenCount?: number;
      };

      return {
        embedding: result.embedding,
        model: 'amazon.titan-embed-text-v2:0',
        dimensions: result.embedding.length,
        tokensUsed: result.inputTextTokenCount,
      };
    } catch (error) {
      logger.error('Bedrock embedding failed', { error: String(error) });
      return this.getZeroVector('bedrock');
    }
  }

  /**
   * Generate embedding using Cohere API
   */
  private async generateCohereEmbedding(text: string): Promise<EmbeddingResult> {
    const apiKey = process.env.COHERE_API_KEY;

    if (!apiKey) {
      logger.warn('Cohere API key not configured, falling back to OpenAI');
      return this.generateOpenAIEmbedding(text);
    }

    try {
      // Wrap Cohere embedding call with resilience
      const data = await callWithResilience(
        async () => {
          const response = await fetch('https://api.cohere.ai/v1/embed', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              texts: [text.slice(0, 8000)],
              model: 'embed-english-v3.0',
              input_type: 'search_document',
            }),
          });

          if (!response.ok) {
            throw new Error(`Cohere API error: ${response.status}`);
          }

          return response.json() as Promise<{ embeddings: number[][] }>;
        },
        {
          provider: 'cohere',
          operation: 'embedding',
          timeoutMs: 30000,
          maxRetries: 3,
        }
      );

      return {
        embedding: data.embeddings[0],
        model: 'embed-english-v3.0',
        dimensions: data.embeddings[0].length,
      };
    } catch (error) {
      logger.error('Cohere embedding failed', { error: String(error) });
      return this.generateOpenAIEmbedding(text); // Fallback
    }
  }

  // ==========================================================================
  // Batch Embeddings
  // ==========================================================================

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts: string[], options?: {
    provider?: EmbeddingProvider;
    skipCache?: boolean;
  }): Promise<BatchEmbeddingResult> {
    const provider = options?.provider || this.config.provider;
    const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openai;
    const maxBatchSize = providerConfig.maxBatchSize || 100;

    // Split into batches
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += maxBatchSize) {
      batches.push(texts.slice(i, i + maxBatchSize));
    }

    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (const batch of batches) {
      // Check cache for each item
      const uncachedTexts: string[] = [];
      const uncachedIndices: number[] = [];
      const batchResults: Array<number[] | null> = new Array(batch.length).fill(null);

      if (this.config.cacheEnabled && !options?.skipCache) {
        batch.forEach((text, idx) => {
          const cached = this.getCachedEmbedding(text);
          if (cached) {
            batchResults[idx] = cached;
          } else {
            uncachedTexts.push(text);
            uncachedIndices.push(idx);
          }
        });
      } else {
        uncachedTexts.push(...batch);
        uncachedIndices.push(...batch.map((_, i) => i));
      }

      // Generate embeddings for uncached texts
      if (uncachedTexts.length > 0) {
        const result = await this.generateBatchForProvider(uncachedTexts, provider);
        result.embeddings.forEach((emb, i) => {
          batchResults[uncachedIndices[i]] = emb;
          if (this.config.cacheEnabled) {
            this.cacheEmbedding(uncachedTexts[i], emb);
          }
        });
        totalTokens += result.totalTokensUsed || 0;
      }

      allEmbeddings.push(...batchResults.filter((e): e is number[] => e !== null));
    }

    return {
      embeddings: allEmbeddings,
      model: this.config.model,
      dimensions: allEmbeddings[0]?.length || this.config.dimensions,
      totalTokensUsed: totalTokens,
    };
  }

  private async generateBatchForProvider(texts: string[], provider: EmbeddingProvider): Promise<BatchEmbeddingResult> {
    switch (provider) {
      case 'openai':
        return this.generateOpenAIBatchEmbeddings(texts);
      case 'bedrock':
        // Bedrock doesn't support batch, call individually
        const results = await Promise.all(texts.map(t => this.generateBedrockEmbedding(t)));
        return {
          embeddings: results.map(r => r.embedding),
          model: 'amazon.titan-embed-text-v2:0',
          dimensions: results[0]?.dimensions || 1024,
          totalTokensUsed: results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
        };
      case 'cohere':
        return this.generateCohereBatchEmbeddings(texts);
      default:
        return this.generateOpenAIBatchEmbeddings(texts);
    }
  }

  private async generateOpenAIBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const endpoint = process.env.EMBEDDING_API_URL || 'https://api.openai.com/v1/embeddings';

    if (!apiKey) {
      return {
        embeddings: texts.map(() => new Array(1536).fill(0)),
        model: this.config.model,
        dimensions: 1536,
      };
    }

    try {
      // Wrap batch embedding call with resilience
      const data = await callWithResilience(
        async () => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              input: texts.map(t => t.slice(0, 8000)),
              model: this.config.model,
            }),
          });

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
          }

          return response.json() as Promise<{
            data: Array<{ embedding: number[]; index: number }>;
            usage?: { total_tokens: number };
          }>;
        },
        {
          provider: 'openai',
          operation: 'batch-embedding',
          timeoutMs: 60000, // Longer timeout for batch
          maxRetries: 2,
        }
      );

      // Sort by index to maintain order
      const sorted = data.data.sort((a, b) => a.index - b.index);

      return {
        embeddings: sorted.map(d => d.embedding),
        model: this.config.model,
        dimensions: sorted[0]?.embedding.length || 1536,
        totalTokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      logger.error('OpenAI batch embedding failed', { error: String(error) });
      return {
        embeddings: texts.map(() => new Array(1536).fill(0)),
        model: this.config.model,
        dimensions: 1536,
      };
    }
  }

  private async generateCohereBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    const apiKey = process.env.COHERE_API_KEY;

    if (!apiKey) {
      return this.generateOpenAIBatchEmbeddings(texts);
    }

    try {
      // Wrap batch embedding call with resilience
      const data = await callWithResilience(
        async () => {
          const response = await fetch('https://api.cohere.ai/v1/embed', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              texts: texts.map(t => t.slice(0, 8000)),
              model: 'embed-english-v3.0',
              input_type: 'search_document',
            }),
          });

          if (!response.ok) {
            throw new Error(`Cohere API error: ${response.status}`);
          }

          return response.json() as Promise<{ embeddings: number[][] }>;
        },
        {
          provider: 'cohere',
          operation: 'batch-embedding',
          timeoutMs: 60000,
          maxRetries: 2,
        }
      );

      return {
        embeddings: data.embeddings,
        model: 'embed-english-v3.0',
        dimensions: data.embeddings[0]?.length || 1024,
      };
    } catch (error) {
      logger.error('Cohere batch embedding failed', { error: String(error) });
      return this.generateOpenAIBatchEmbeddings(texts);
    }
  }

  // ==========================================================================
  // Similarity Functions
  // ==========================================================================

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Find top-k most similar items
   */
  findTopK(
    queryEmbedding: number[],
    candidates: Array<{ id: string; embedding: number[] }>,
    k: number = 10
  ): Array<{ id: string; similarity: number }> {
    const scored = candidates.map(c => ({
      id: c.id,
      similarity: this.cosineSimilarity(queryEmbedding, c.embedding),
    }));

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  private getCachedEmbedding(text: string): number[] | null {
    const key = this.getCacheKey(text);
    const cached = this.cache.get(key);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.embedding;
    }
    
    if (cached) {
      this.cache.delete(key); // Remove expired
    }
    
    return null;
  }

  private cacheEmbedding(text: string, embedding: number[]): void {
    const key = this.getCacheKey(text);
    this.cache.set(key, {
      embedding,
      expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
    });

    // Limit cache size
    if (this.cache.size > 10000) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  private getCacheKey(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `emb_${hash}`;
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private getZeroVector(provider: EmbeddingProvider): EmbeddingResult {
    const dimensions = PROVIDER_CONFIGS[provider]?.dimensions || 1536;
    return {
      embedding: new Array(dimensions).fill(0),
      model: PROVIDER_CONFIGS[provider]?.model || 'unknown',
      dimensions,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Get provider capabilities
   */
  getProviderInfo(provider: EmbeddingProvider): Partial<EmbeddingConfig> {
    return PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openai;
  }

  /**
   * Format embedding for PostgreSQL pgvector
   */
  toPgVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Parse PostgreSQL pgvector to number array
   */
  fromPgVector(pgVector: string): number[] {
    const cleaned = pgVector.replace(/[\[\]]/g, '');
    return cleaned.split(',').map(Number);
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
