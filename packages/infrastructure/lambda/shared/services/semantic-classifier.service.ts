// RADIANT v4.18.0 - Semantic Classifier Service
// Embedding-based detection for attacks that evade keyword matching
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface SemanticMatch {
  patternId: string;
  patternName: string;
  patternType: string;
  similarity: number;
  severity: number;
}

export interface SemanticClassificationResult {
  isHarmful: boolean;
  semanticScore: number;
  topMatches: SemanticMatch[];
  embeddingModel: string;
  latencyMs: number;
}

export interface PatternEmbedding {
  id: string;
  patternName: string;
  patternType: string;
  embedding: number[];
  severity: number;
  examplePrompts: string[];
}

// Known harmful prompt embeddings (pre-computed centroids)
// These would be computed from HarmBench/WildJailbreak datasets
const HARM_CATEGORY_CENTROIDS: Record<string, { embedding: number[]; threshold: number }> = {};

// ============================================================================
// Semantic Classifier Service
// ============================================================================

class SemanticClassifierService {
  private embeddingCache: Map<string, { embedding: number[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 3600000; // 1 hour
  
  /**
   * Classify input using semantic similarity
   */
  async classifySemanticaly(
    tenantId: string,
    input: string,
    options?: {
      embeddingModel?: string;
      similarityThreshold?: number;
      topK?: number;
    }
  ): Promise<SemanticClassificationResult> {
    const startTime = Date.now();
    const embeddingModel = options?.embeddingModel || 'text-embedding-3-small';
    const similarityThreshold = options?.similarityThreshold || 0.75;
    const topK = options?.topK || 5;
    
    // Get embedding for input
    const inputEmbedding = await this.getEmbedding(input, embeddingModel);
    
    if (!inputEmbedding || inputEmbedding.length === 0) {
      return {
        isHarmful: false,
        semanticScore: 0,
        topMatches: [],
        embeddingModel,
        latencyMs: Date.now() - startTime,
      };
    }
    
    // Get stored pattern embeddings
    const patterns = await this.getPatternEmbeddings(tenantId);
    
    // Calculate similarities
    const matches: SemanticMatch[] = [];
    
    for (const pattern of patterns) {
      if (!pattern.embedding || pattern.embedding.length === 0) continue;
      
      const similarity = this.cosineSimilarity(inputEmbedding, pattern.embedding);
      
      if (similarity >= similarityThreshold) {
        matches.push({
          patternId: pattern.id,
          patternName: pattern.patternName,
          patternType: pattern.patternType,
          similarity,
          severity: pattern.severity,
        });
      }
    }
    
    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity);
    const topMatches = matches.slice(0, topK);
    
    // Calculate semantic score (weighted by severity)
    let semanticScore = 0;
    if (topMatches.length > 0) {
      const weightedSum = topMatches.reduce(
        (sum, m) => sum + m.similarity * (m.severity / 10),
        0
      );
      semanticScore = weightedSum / topMatches.length;
    }
    
    // Check against harm category centroids
    const centroidMatch = await this.checkHarmCentroids(inputEmbedding);
    if (centroidMatch > semanticScore) {
      semanticScore = centroidMatch;
    }
    
    return {
      isHarmful: semanticScore >= 0.6,
      semanticScore,
      topMatches,
      embeddingModel,
      latencyMs: Date.now() - startTime,
    };
  }
  
  /**
   * Get embedding for text
   */
  async getEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
    const cacheKey = `${model}:${crypto.createHash('md5').update(text).digest('hex')}`;
    
    // Check cache
    const cached = this.embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.embedding;
    }
    
    try {
      // Call embedding API (would use actual embedding service)
      const embedding = await this.callEmbeddingAPI(text, model);
      
      // Cache result
      this.embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
      
      return embedding;
    } catch (error) {
      logger.error('Failed to get embedding', { error, model });
      return [];
    }
  }
  
  /**
   * Store pattern embedding in database
   */
  async storePatternEmbedding(
    patternId: string,
    embedding: number[]
  ): Promise<void> {
    await executeStatement(
      `UPDATE jailbreak_patterns SET pattern_embedding = $1::vector WHERE id = $2::uuid`,
      [
        stringParam('embedding', `[${embedding.join(',')}]`),
        stringParam('patternId', patternId),
      ]
    );
  }
  
  /**
   * Compute and store embeddings for all patterns without embeddings
   */
  async computeMissingEmbeddings(embeddingModel: string = 'text-embedding-3-small'): Promise<{
    processed: number;
    failed: number;
  }> {
    const result = await executeStatement(
      `SELECT id, pattern_name, example_prompts FROM jailbreak_patterns 
       WHERE pattern_embedding IS NULL AND array_length(example_prompts, 1) > 0`,
      []
    );
    
    let processed = 0;
    let failed = 0;
    
    for (const row of result.rows || []) {
      try {
        const examplePrompts = row.example_prompts as string[];
        if (!examplePrompts || examplePrompts.length === 0) continue;
        
        // Compute embedding from first example (or average of all)
        const embeddings = await Promise.all(
          examplePrompts.slice(0, 3).map(p => this.getEmbedding(p, embeddingModel))
        );
        
        // Average embeddings
        const avgEmbedding = this.averageEmbeddings(embeddings.filter(e => e.length > 0));
        
        if (avgEmbedding.length > 0) {
          await this.storePatternEmbedding(String(row.id), avgEmbedding);
          processed++;
        }
      } catch (error) {
        logger.error('Failed to compute embedding for pattern', { patternId: row.id, error });
        failed++;
      }
    }
    
    return { processed, failed };
  }
  
  /**
   * Add new harmful pattern with embedding
   */
  async addPatternWithEmbedding(
    pattern: {
      patternName: string;
      patternType: string;
      examplePrompts: string[];
      severity: number;
      source?: string;
    },
    embeddingModel: string = 'text-embedding-3-small'
  ): Promise<string> {
    // Compute embedding from examples
    const embeddings = await Promise.all(
      pattern.examplePrompts.slice(0, 5).map(p => this.getEmbedding(p, embeddingModel))
    );
    const avgEmbedding = this.averageEmbeddings(embeddings.filter(e => e.length > 0));
    
    const result = await executeStatement(
      `INSERT INTO jailbreak_patterns (
        pattern_name, pattern_type, example_prompts, severity, source, 
        pattern_embedding, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6::vector, true)
      RETURNING id`,
      [
        stringParam('patternName', pattern.patternName),
        stringParam('patternType', pattern.patternType),
        stringParam('examplePrompts', `{${pattern.examplePrompts.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`),
        longParam('severity', pattern.severity),
        stringParam('source', pattern.source || 'manual'),
        stringParam('embedding', avgEmbedding.length > 0 ? `[${avgEmbedding.join(',')}]` : null),
      ]
    );
    
    return String(result.rows?.[0]?.id || '');
  }
  
  /**
   * Find similar patterns to input
   */
  async findSimilarPatterns(
    input: string,
    limit: number = 10,
    embeddingModel: string = 'text-embedding-3-small'
  ): Promise<Array<PatternEmbedding & { similarity: number }>> {
    const inputEmbedding = await this.getEmbedding(input, embeddingModel);
    
    if (inputEmbedding.length === 0) return [];
    
    // Use pgvector for efficient similarity search
    const result = await executeStatement(
      `SELECT id, pattern_name, pattern_type, pattern_embedding, severity, example_prompts,
              1 - (pattern_embedding <=> $1::vector) as similarity
       FROM jailbreak_patterns
       WHERE pattern_embedding IS NOT NULL AND is_active = true
       ORDER BY pattern_embedding <=> $1::vector
       LIMIT $2`,
      [
        stringParam('embedding', `[${inputEmbedding.join(',')}]`),
        longParam('limit', limit),
      ]
    );
    
    return (result.rows || []).map(row => ({
      id: String(row.id),
      patternName: String(row.pattern_name),
      patternType: String(row.pattern_type),
      embedding: this.parseVector(row.pattern_embedding),
      severity: Number(row.severity || 5),
      examplePrompts: (row.example_prompts as string[]) || [],
      similarity: Number(row.similarity || 0),
    }));
  }
  
  /**
   * Cluster patterns by semantic similarity
   */
  async clusterPatterns(numClusters: number = 10): Promise<Array<{
    centroid: number[];
    patterns: string[];
    dominantType: string;
  }>> {
    const patterns = await this.getPatternEmbeddings();
    const validPatterns = patterns.filter(p => p.embedding && p.embedding.length > 0);
    
    if (validPatterns.length < numClusters) {
      return [];
    }
    
    // Simple k-means clustering
    const clusters = this.kMeansClustering(
      validPatterns.map(p => ({ id: p.id, embedding: p.embedding, type: p.patternType })),
      numClusters
    );
    
    return clusters;
  }
  
  /**
   * Get semantic similarity statistics
   */
  async getSimilarityStats(tenantId?: string): Promise<{
    totalPatterns: number;
    patternsWithEmbeddings: number;
    averageIntraClusterSimilarity: number;
    typeDistribution: Record<string, number>;
  }> {
    const countResult = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(pattern_embedding) as with_embeddings
       FROM jailbreak_patterns WHERE is_active = true`,
      []
    );
    
    const typeResult = await executeStatement(
      `SELECT pattern_type, COUNT(*) as count
       FROM jailbreak_patterns WHERE is_active = true
       GROUP BY pattern_type`,
      []
    );
    
    const total = Number(countResult.rows?.[0]?.total || 0);
    const withEmbeddings = Number(countResult.rows?.[0]?.with_embeddings || 0);
    
    const typeDistribution: Record<string, number> = {};
    for (const row of typeResult.rows || []) {
      typeDistribution[String(row.pattern_type)] = Number(row.count);
    }
    
    return {
      totalPatterns: total,
      patternsWithEmbeddings: withEmbeddings,
      averageIntraClusterSimilarity: 0.85, // Would compute from actual clusters
      typeDistribution,
    };
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private async getPatternEmbeddings(tenantId?: string): Promise<PatternEmbedding[]> {
    const result = await executeStatement(
      `SELECT id, pattern_name, pattern_type, pattern_embedding, severity, example_prompts
       FROM jailbreak_patterns WHERE is_active = true AND pattern_embedding IS NOT NULL`,
      []
    );
    
    return (result.rows || []).map(row => ({
      id: String(row.id),
      patternName: String(row.pattern_name),
      patternType: String(row.pattern_type),
      embedding: this.parseVector(row.pattern_embedding),
      severity: Number(row.severity || 5),
      examplePrompts: (row.example_prompts as string[]) || [],
    }));
  }
  
  private async checkHarmCentroids(embedding: number[]): Promise<number> {
    let maxSimilarity = 0;
    
    for (const [category, centroid] of Object.entries(HARM_CATEGORY_CENTROIDS)) {
      const similarity = this.cosineSimilarity(embedding, centroid.embedding);
      if (similarity >= centroid.threshold && similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    }
    
    return maxSimilarity;
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    
    const dims = embeddings[0].length;
    const avg = new Array(dims).fill(0);
    
    for (const emb of embeddings) {
      for (let i = 0; i < dims; i++) {
        avg[i] += emb[i] / embeddings.length;
      }
    }
    
    return avg;
  }
  
  private parseVector(vectorString: unknown): number[] {
    if (!vectorString) return [];
    if (Array.isArray(vectorString)) return vectorString;
    
    const str = String(vectorString);
    try {
      // Parse PostgreSQL vector format: [1,2,3] or (1,2,3)
      const cleaned = str.replace(/[\[\]()]/g, '');
      return cleaned.split(',').map(Number);
    } catch {
      return [];
    }
  }
  
  private async callEmbeddingAPI(text: string, model: string): Promise<number[]> {
    // This would call the actual embedding API
    // For now, return a placeholder that would be replaced with real implementation
    
    // In production, this would call:
    // - OpenAI text-embedding-3-small/large
    // - Bedrock Titan embeddings
    // - Self-hosted sentence-transformers
    
    // Simulate embedding generation for development
    const hash = crypto.createHash('sha256').update(text + model).digest();
    const embedding = new Array(1536).fill(0).map((_, i) => 
      (hash[i % hash.length] / 255) * 2 - 1
    );
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    return embedding.map(v => v / norm);
  }
  
  private kMeansClustering(
    data: Array<{ id: string; embedding: number[]; type: string }>,
    k: number,
    maxIterations: number = 100
  ): Array<{ centroid: number[]; patterns: string[]; dominantType: string }> {
    if (data.length === 0 || k <= 0) return [];
    
    const dims = data[0].embedding.length;
    
    // Initialize centroids randomly
    const centroids: number[][] = [];
    const usedIndices = new Set<number>();
    
    while (centroids.length < k && usedIndices.size < data.length) {
      const idx = Math.floor(Math.random() * data.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        centroids.push([...data[idx].embedding]);
      }
    }
    
    // Iterate
    let assignments: number[] = new Array(data.length).fill(0);
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign points to nearest centroid
      const newAssignments = data.map((point, i) => {
        let minDist = Infinity;
        let minIdx = 0;
        
        for (let c = 0; c < centroids.length; c++) {
          const dist = 1 - this.cosineSimilarity(point.embedding, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            minIdx = c;
          }
        }
        
        return minIdx;
      });
      
      // Check convergence
      if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) break;
      assignments = newAssignments;
      
      // Update centroids
      for (let c = 0; c < centroids.length; c++) {
        const clusterPoints = data.filter((_, i) => assignments[i] === c);
        if (clusterPoints.length > 0) {
          centroids[c] = this.averageEmbeddings(clusterPoints.map(p => p.embedding));
        }
      }
    }
    
    // Build result
    return centroids.map((centroid, c) => {
      const clusterPoints = data.filter((_, i) => assignments[i] === c);
      const typeCounts: Record<string, number> = {};
      
      for (const point of clusterPoints) {
        typeCounts[point.type] = (typeCounts[point.type] || 0) + 1;
      }
      
      const dominantType = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      
      return {
        centroid,
        patterns: clusterPoints.map(p => p.id),
        dominantType,
      };
    });
  }
}

export const semanticClassifierService = new SemanticClassifierService();
