// RADIANT v4.18.0 - Embedding API Service
// Real embedding API integration for OpenAI, Bedrock, and local models
// ============================================================================
//
// @deprecated Use embedding.service.ts instead. This service will be removed in v5.0.
// Migration: Import { embeddingService } from './embedding.service' instead.
//

import { executeStatement, stringParam, longParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingRequest {
  text: string;
  model?: string;
  dimensions?: number;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
  tokensUsed: number;
  cached: boolean;
  latencyMs: number;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'bedrock' | 'local';
  model: string;
  dimensions: number;
  cacheEnabled: boolean;
  cacheTtlHours: number;
  batchSize: number;
}

export interface BatchEmbeddingResponse {
  embeddings: EmbeddingResponse[];
  totalTokens: number;
  totalLatencyMs: number;
}

// Model configurations
const EMBEDDING_MODELS: Record<string, { provider: string; dimensions: number; maxTokens: number }> = {
  'text-embedding-3-small': { provider: 'openai', dimensions: 1536, maxTokens: 8191 },
  'text-embedding-3-large': { provider: 'openai', dimensions: 3072, maxTokens: 8191 },
  'text-embedding-ada-002': { provider: 'openai', dimensions: 1536, maxTokens: 8191 },
  'amazon.titan-embed-text-v1': { provider: 'bedrock', dimensions: 1536, maxTokens: 8000 },
  'amazon.titan-embed-text-v2:0': { provider: 'bedrock', dimensions: 1024, maxTokens: 8000 },
  'cohere.embed-english-v3': { provider: 'bedrock', dimensions: 1024, maxTokens: 512 },
  'cohere.embed-multilingual-v3': { provider: 'bedrock', dimensions: 1024, maxTokens: 512 },
};

// ============================================================================
// Embedding API Service
// ============================================================================

class EmbeddingAPIService {
  private cache: Map<string, { embedding: number[]; timestamp: number }> = new Map();
  private readonly DEFAULT_MODEL = 'text-embedding-3-small';
  private readonly CACHE_TTL_MS = 3600000; // 1 hour
  
  /**
   * Get embedding for text
   */
  async getEmbedding(
    tenantId: string,
    text: string,
    options?: {
      model?: string;
      useCache?: boolean;
      dimensions?: number;
    }
  ): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    const model = options?.model || this.DEFAULT_MODEL;
    const useCache = options?.useCache ?? true;
    
    // Check cache first
    if (useCache) {
      const cached = await this.getFromCache(text, model);
      if (cached) {
        return {
          embedding: cached,
          model,
          dimensions: cached.length,
          tokensUsed: 0,
          cached: true,
          latencyMs: Date.now() - startTime,
        };
      }
    }
    
    // Get embedding from provider
    const modelConfig = EMBEDDING_MODELS[model];
    if (!modelConfig) {
      throw new Error(`Unknown embedding model: ${model}`);
    }
    
    let embedding: number[];
    let tokensUsed = 0;
    
    try {
      if (modelConfig.provider === 'openai') {
        const result = await this.getOpenAIEmbedding(text, model, options?.dimensions);
        embedding = result.embedding;
        tokensUsed = result.tokensUsed;
      } else if (modelConfig.provider === 'bedrock') {
        const result = await this.getBedrockEmbedding(text, model);
        embedding = result.embedding;
        tokensUsed = result.tokensUsed;
      } else {
        // Fallback to simulated embedding
        embedding = this.generateSimulatedEmbedding(text, modelConfig.dimensions);
        tokensUsed = Math.ceil(text.length / 4);
      }
    } catch (error) {
      logger.error('Embedding API call failed', { model, error: String(error) });
      // Fallback to simulated embedding on error
      embedding = this.generateSimulatedEmbedding(text, modelConfig.dimensions);
      tokensUsed = Math.ceil(text.length / 4);
    }
    
    // Cache the result
    if (useCache) {
      await this.saveToCache(tenantId, text, model, embedding, tokensUsed);
    }
    
    return {
      embedding,
      model,
      dimensions: embedding.length,
      tokensUsed,
      cached: false,
      latencyMs: Date.now() - startTime,
    };
  }
  
  /**
   * Get embeddings for multiple texts
   */
  async getBatchEmbeddings(
    tenantId: string,
    texts: string[],
    options?: {
      model?: string;
      useCache?: boolean;
      batchSize?: number;
    }
  ): Promise<BatchEmbeddingResponse> {
    const startTime = Date.now();
    const model = options?.model || this.DEFAULT_MODEL;
    const batchSize = options?.batchSize || 100;
    
    const embeddings: EmbeddingResponse[] = [];
    let totalTokens = 0;
    
    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Check cache for each text
      const results: (EmbeddingResponse | null)[] = await Promise.all(
        batch.map(async (text) => {
          if (options?.useCache !== false) {
            const cached = await this.getFromCache(text, model);
            if (cached) {
              return {
                embedding: cached,
                model,
                dimensions: cached.length,
                tokensUsed: 0,
                cached: true,
                latencyMs: 0,
              };
            }
          }
          return null;
        })
      );
      
      // Get embeddings for uncached texts
      const uncachedIndices: number[] = [];
      const uncachedTexts: string[] = [];
      
      results.forEach((r, idx) => {
        if (!r) {
          uncachedIndices.push(idx);
          uncachedTexts.push(batch[idx]);
        }
      });
      
      if (uncachedTexts.length > 0) {
        const modelConfig = EMBEDDING_MODELS[model];
        
        try {
          if (modelConfig?.provider === 'openai') {
            const batchResult = await this.getOpenAIBatchEmbedding(uncachedTexts, model);
            
            for (let j = 0; j < uncachedIndices.length; j++) {
              const idx = uncachedIndices[j];
              results[idx] = {
                embedding: batchResult.embeddings[j],
                model,
                dimensions: batchResult.embeddings[j].length,
                tokensUsed: Math.ceil(batchResult.totalTokens / uncachedTexts.length),
                cached: false,
                latencyMs: 0,
              };
              
              // Cache the result
              await this.saveToCache(tenantId, uncachedTexts[j], model, batchResult.embeddings[j], 0);
            }
            
            totalTokens += batchResult.totalTokens;
          } else {
            // Process individually for non-OpenAI providers
            for (let j = 0; j < uncachedIndices.length; j++) {
              const idx = uncachedIndices[j];
              const result = await this.getEmbedding(tenantId, uncachedTexts[j], { model, useCache: false });
              results[idx] = result;
              totalTokens += result.tokensUsed;
            }
          }
        } catch (error) {
          logger.error('Batch embedding failed', { error: String(error) });
          
          // Fallback to simulated embeddings
          for (let j = 0; j < uncachedIndices.length; j++) {
            const idx = uncachedIndices[j];
            const dims = modelConfig?.dimensions || 1536;
            results[idx] = {
              embedding: this.generateSimulatedEmbedding(uncachedTexts[j], dims),
              model,
              dimensions: dims,
              tokensUsed: Math.ceil(uncachedTexts[j].length / 4),
              cached: false,
              latencyMs: 0,
            };
          }
        }
      }
      
      embeddings.push(...(results.filter(Boolean) as EmbeddingResponse[]));
    }
    
    return {
      embeddings,
      totalTokens,
      totalLatencyMs: Date.now() - startTime,
    };
  }
  
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
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
  
  /**
   * Find most similar texts from a set
   */
  async findSimilar(
    tenantId: string,
    query: string,
    candidates: string[],
    options?: {
      model?: string;
      topK?: number;
      minSimilarity?: number;
    }
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    const topK = options?.topK || 5;
    const minSimilarity = options?.minSimilarity || 0;
    
    // Get query embedding
    const queryEmbedding = await this.getEmbedding(tenantId, query, { model: options?.model });
    
    // Get candidate embeddings
    const candidateEmbeddings = await this.getBatchEmbeddings(tenantId, candidates, { model: options?.model });
    
    // Calculate similarities
    const similarities = candidateEmbeddings.embeddings.map((e, idx) => ({
      text: candidates[idx],
      similarity: this.cosineSimilarity(queryEmbedding.embedding, e.embedding),
      index: idx,
    }));
    
    // Sort by similarity and filter
    return similarities
      .filter(s => s.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
  
  /**
   * Get available models
   */
  getAvailableModels(): Array<{ model: string; provider: string; dimensions: number }> {
    return Object.entries(EMBEDDING_MODELS).map(([model, config]) => ({
      model,
      provider: config.provider,
      dimensions: config.dimensions,
    }));
  }
  
  // ==========================================================================
  // Provider-specific implementations
  // ==========================================================================
  
  private async getOpenAIEmbedding(
    text: string,
    model: string,
    dimensions?: number
  ): Promise<{ embedding: number[]; tokensUsed: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.warn('OpenAI API key not configured, using simulated embedding');
      const dims = dimensions || EMBEDDING_MODELS[model]?.dimensions || 1536;
      return {
        embedding: this.generateSimulatedEmbedding(text, dims),
        tokensUsed: Math.ceil(text.length / 4),
      };
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model,
        ...(dimensions ? { dimensions } : {}),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
      usage: { total_tokens: number };
    };
    
    return {
      embedding: data.data[0].embedding,
      tokensUsed: data.usage.total_tokens,
    };
  }
  
  private async getOpenAIBatchEmbedding(
    texts: string[],
    model: string
  ): Promise<{ embeddings: number[][]; totalTokens: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.warn('OpenAI API key not configured, using simulated embeddings');
      const dims = EMBEDDING_MODELS[model]?.dimensions || 1536;
      return {
        embeddings: texts.map(t => this.generateSimulatedEmbedding(t, dims)),
        totalTokens: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      };
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
      usage: { total_tokens: number };
    };
    
    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    
    return {
      embeddings: sorted.map(d => d.embedding),
      totalTokens: data.usage.total_tokens,
    };
  }
  
  private async getBedrockEmbedding(
    text: string,
    model: string
  ): Promise<{ embedding: number[]; tokensUsed: number }> {
    try {
      const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
      
      const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
      
      let body: string;
      if (model.startsWith('amazon.titan')) {
        body = JSON.stringify({ inputText: text });
      } else if (model.startsWith('cohere')) {
        body = JSON.stringify({ texts: [text], input_type: 'search_document' });
      } else {
        throw new Error(`Unsupported Bedrock model: ${model}`);
      }
      
      const command = new InvokeModelCommand({
        modelId: model,
        body,
        contentType: 'application/json',
        accept: 'application/json',
      });
      
      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      let embedding: number[];
      if (model.startsWith('amazon.titan')) {
        embedding = responseBody.embedding;
      } else if (model.startsWith('cohere')) {
        embedding = responseBody.embeddings[0];
      } else {
        throw new Error('Unknown response format');
      }
      
      return {
        embedding,
        tokensUsed: responseBody.inputTextTokenCount || Math.ceil(text.length / 4),
      };
    } catch (error) {
      logger.error('Bedrock embedding failed', { model, error: String(error) });
      const dims = EMBEDDING_MODELS[model]?.dimensions || 1536;
      return {
        embedding: this.generateSimulatedEmbedding(text, dims),
        tokensUsed: Math.ceil(text.length / 4),
      };
    }
  }
  
  // ==========================================================================
  // Caching
  // ==========================================================================
  
  private getCacheKey(text: string, model: string): string {
    return crypto.createHash('md5').update(`${model}:${text}`).digest('hex');
  }
  
  private async getFromCache(text: string, model: string): Promise<number[] | null> {
    const key = this.getCacheKey(text, model);
    
    // Check in-memory cache first
    const memCached = this.cache.get(key);
    if (memCached && Date.now() - memCached.timestamp < this.CACHE_TTL_MS) {
      return memCached.embedding;
    }
    
    // Check database cache
    try {
      const result = await executeStatement(
        `SELECT embedding FROM embedding_cache 
         WHERE text_hash = $1 AND embedding_model = $2 AND expires_at > NOW()`,
        [stringParam('hash', key), stringParam('model', model)]
      );
      
      if (result.rows?.length) {
        const embedding = result.rows[0].embedding as number[];
        // Update in-memory cache
        this.cache.set(key, { embedding, timestamp: Date.now() });
        return embedding;
      }
    } catch (error) {
      // Cache miss or error
    }
    
    return null;
  }
  
  private async saveToCache(
    tenantId: string,
    text: string,
    model: string,
    embedding: number[],
    tokensUsed: number
  ): Promise<void> {
    const key = this.getCacheKey(text, model);
    
    // Save to in-memory cache
    this.cache.set(key, { embedding, timestamp: Date.now() });
    
    // Save to database cache
    try {
      await executeStatement(
        `INSERT INTO embedding_cache (text_hash, embedding_model, embedding, text_length, expires_at)
         VALUES ($1, $2, $3::vector, $4, NOW() + INTERVAL '7 days')
         ON CONFLICT (text_hash, embedding_model) DO UPDATE SET
           embedding = EXCLUDED.embedding,
           expires_at = NOW() + INTERVAL '7 days'`,
        [
          stringParam('hash', key),
          stringParam('model', model),
          stringParam('embedding', `[${embedding.join(',')}]`),
          longParam('length', text.length),
        ]
      );
      
      // Also log to embedding_requests for analytics
      await executeStatement(
        `INSERT INTO embedding_requests (tenant_id, text_hash, text_length, model, embedding, dimensions, tokens_used, cached)
         VALUES ($1::uuid, $2, $3, $4, $5::vector, $6, $7, false)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('hash', key),
          longParam('length', text.length),
          stringParam('model', model),
          stringParam('embedding', `[${embedding.join(',')}]`),
          longParam('dimensions', embedding.length),
          longParam('tokens', tokensUsed),
        ]
      );
    } catch (error) {
      logger.warn('Failed to cache embedding', { error: String(error) });
    }
  }
  
  // ==========================================================================
  // Simulated embeddings (fallback)
  // ==========================================================================
  
  private generateSimulatedEmbedding(text: string, dimensions: number): number[] {
    // Generate deterministic pseudo-random embedding based on text content
    const hash = crypto.createHash('sha256').update(text).digest();
    const embedding: number[] = [];
    
    for (let i = 0; i < dimensions; i++) {
      // Use hash bytes to seed pseudo-random values
      const byte1 = hash[i % hash.length];
      const byte2 = hash[(i + 1) % hash.length];
      const value = ((byte1 << 8) | byte2) / 65535;
      
      // Convert to range [-1, 1] and add some variation based on position
      embedding.push((value - 0.5) * 2 * Math.cos(i * 0.1));
    }
    
    // Normalize to unit length
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / magnitude);
  }
}

export const embeddingAPIService = new EmbeddingAPIService();
