// RADIANT v5.12.0 - Shadow Mode Learning Service
// Self-training on public data during idle times
// "Watch public repos, predict code, grade yourself"

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ShadowLearningSource {
  type: 'github' | 'documentation' | 'stackoverflow';
  url: string;
  content: string;
  metadata: Record<string, string>;
}

export interface ShadowLearningResult {
  id: string;
  source_type: string;
  source_url: string;
  content_hash: string;
  predicted_code: string;
  actual_code: string;
  self_grade: number;
  error_analysis: string;
  learned_pattern: string | null;
  created_at: Date;
}

export interface ShadowModeConfig {
  enabled: boolean;
  sources: ('github' | 'documentation' | 'stackoverflow')[];
  max_daily_exercises: number;
  min_grade_to_learn: number;
  focus_areas: string[];
}

// ============================================================================
// Shadow Mode Service
// ============================================================================

class ShadowModeService {
  private readonly defaultConfig: ShadowModeConfig = {
    enabled: false,
    sources: ['documentation'],
    max_daily_exercises: 50,
    min_grade_to_learn: 0.7,
    focus_areas: [],
  };

  /**
   * Run a shadow learning exercise
   * Takes a code challenge, predicts the solution, compares to actual
   */
  async runExercise(source: ShadowLearningSource): Promise<ShadowLearningResult> {
    const contentHash = this.hashContent(source.content);

    // Check if we've already processed this content
    const existing = await this.checkExisting(contentHash);
    if (existing) {
      return existing;
    }

    // Extract the challenge from the source
    const challenge = this.extractChallenge(source);

    // Generate prediction (would call model in production)
    const prediction = await this.generatePrediction(challenge);

    // Extract actual solution
    const actual = this.extractActualSolution(source);

    // Self-grade
    const grade = this.calculateGrade(prediction, actual);

    // Analyze errors if grade is low
    const errorAnalysis = grade < 0.7 
      ? this.analyzeErrors(prediction, actual) 
      : 'Solution matched expectations';

    // Extract learnable pattern if grade is high
    const learnedPattern = grade >= this.defaultConfig.min_grade_to_learn
      ? this.extractPattern(source, prediction, actual)
      : null;

    const result: ShadowLearningResult = {
      id: uuidv4(),
      source_type: source.type,
      source_url: source.url,
      content_hash: contentHash,
      predicted_code: prediction,
      actual_code: actual,
      self_grade: grade,
      error_analysis: errorAnalysis,
      learned_pattern: learnedPattern,
      created_at: new Date(),
    };

    // Save result
    await this.saveResult(result);

    logger.info('Shadow learning exercise completed', {
      id: result.id,
      sourceType: source.type,
      grade: grade.toFixed(2),
      learned: learnedPattern !== null,
    });

    return result;
  }

  /**
   * Get exercises from documentation updates
   */
  async getDocumentationExercises(library: string): Promise<ShadowLearningSource[]> {
    logger.info('Fetching documentation exercises', { library });
    
    // Fetch from database - exercises are seeded during deployment
    const result = await executeStatement(
      `SELECT id, source_type, source_url, content, metadata, created_at
       FROM shadow_learning_sources
       WHERE source_type = 'documentation'
       AND metadata->>'library' = $1
       AND is_active = true
       ORDER BY created_at DESC
       LIMIT 20`,
      [stringParam('library', library)]
    );

    if (result.rows && result.rows.length > 0) {
      return result.rows.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        const rawMetadata = r.metadata as Record<string, unknown> | null;
        const metadata: Record<string, string> = {};
        if (rawMetadata) {
          for (const [key, value] of Object.entries(rawMetadata)) {
            metadata[key] = String(value);
          }
        } else {
          metadata.library = library;
        }
        return {
          type: 'documentation' as const,
          url: String(r.source_url || ''),
          content: String(r.content || ''),
          metadata,
        };
      });
    }

    // Fallback: Return empty array - no exercises available
    logger.warn('No documentation exercises found for library', { library });
    return [];
  }

  /**
   * Get learning statistics
   */
  async getStats(): Promise<{
    totalExercises: number;
    avgGrade: number;
    patternsLearned: number;
    bySource: Record<string, number>;
  }> {
    const statsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        AVG(self_grade) as avg_grade,
        COUNT(*) FILTER (WHERE learned_pattern IS NOT NULL) as patterns_learned
       FROM shadow_learning_log`,
      []
    );

    const bySourceResult = await executeStatement(
      `SELECT source_type, COUNT(*) as count
       FROM shadow_learning_log
       GROUP BY source_type`,
      []
    );

    const stats = statsResult.rows?.[0] as { total: number; avg_grade: number; patterns_learned: number } | undefined;
    const bySource: Record<string, number> = {};
    
    for (const row of (bySourceResult.rows || []) as Array<{ source_type: string; count: number }>) {
      bySource[row.source_type] = Number(row.count);
    }

    return {
      totalExercises: Number(stats?.total || 0),
      avgGrade: Number(stats?.avg_grade || 0),
      patternsLearned: Number(stats?.patterns_learned || 0),
      bySource,
    };
  }

  /**
   * Get recent learning results
   */
  async getRecentResults(limit: number = 20): Promise<ShadowLearningResult[]> {
    const result = await executeStatement(
      `SELECT * FROM shadow_learning_log 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [stringParam('limit', limit.toString())]
    );

    return this.parseResultRows(result.rows || []);
  }

  /**
   * Run scheduled shadow learning job
   */
  async runScheduledJob(config?: Partial<ShadowModeConfig>): Promise<{
    exercisesRun: number;
    avgGrade: number;
    patternsLearned: number;
  }> {
    const effectiveConfig = { ...this.defaultConfig, ...config };

    if (!effectiveConfig.enabled) {
      logger.info('Shadow mode is disabled');
      return { exercisesRun: 0, avgGrade: 0, patternsLearned: 0 };
    }

    const results: ShadowLearningResult[] = [];

    for (const sourceType of effectiveConfig.sources) {
      if (results.length >= effectiveConfig.max_daily_exercises) break;

      const exercises = await this.getExercisesForSource(sourceType, effectiveConfig);
      
      for (const exercise of exercises) {
        if (results.length >= effectiveConfig.max_daily_exercises) break;
        
        try {
          const result = await this.runExercise(exercise);
          results.push(result);
        } catch (error) {
          logger.error('Shadow exercise failed', { error, sourceType });
        }
      }
    }

    const avgGrade = results.length > 0
      ? results.reduce((sum, r) => sum + r.self_grade, 0) / results.length
      : 0;

    const patternsLearned = results.filter((r) => r.learned_pattern !== null).length;

    logger.info('Shadow learning job completed', {
      exercisesRun: results.length,
      avgGrade: avgGrade.toFixed(2),
      patternsLearned,
    });

    return {
      exercisesRun: results.length,
      avgGrade,
      patternsLearned,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async checkExisting(contentHash: string): Promise<ShadowLearningResult | null> {
    const result = await executeStatement(
      `SELECT * FROM shadow_learning_log WHERE content_hash = $1 LIMIT 1`,
      [stringParam('hash', contentHash)]
    );

    const rows = this.parseResultRows(result.rows || []);
    return rows[0] || null;
  }

  private extractChallenge(source: ShadowLearningSource): string {
    // Extract the problem statement from the source
    // In production, this would use NLP to identify the challenge
    const content = source.content;

    // Look for common patterns
    if (content.includes('Example:')) {
      const parts = content.split('Example:');
      return parts[0].trim();
    }

    if (content.includes('```')) {
      const parts = content.split('```');
      return parts[0].trim();
    }

    return content.substring(0, 500);
  }

  private async generatePrediction(challenge: string): Promise<string> {
    logger.debug('Generating prediction for challenge', { challengeLength: challenge.length });
    
    try {
      const { callLiteLLM } = await import('./litellm.service.js');
      
      const response = await callLiteLLM({
        model: 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'system',
            content: `You are an expert programmer. Given a coding challenge, provide a clean, working solution.
Output ONLY the code solution, no explanations. Use appropriate language based on the context.`,
          },
          {
            role: 'user',
            content: challenge,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      return response.content;
    } catch (error) {
      logger.error('Failed to generate prediction', { error });
      return `// Error generating prediction: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private extractActualSolution(source: ShadowLearningSource): string {
    // Extract the actual solution from the source
    const content = source.content;

    // Look for code blocks
    const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Look for Example section
    if (content.includes('Example:')) {
      const parts = content.split('Example:');
      return parts[1]?.trim() || '';
    }

    return '';
  }

  private calculateGrade(prediction: string, actual: string): number {
    if (!prediction || !actual) return 0;

    // Normalize both
    const normPred = this.normalizeCode(prediction);
    const normActual = this.normalizeCode(actual);

    // Calculate similarity
    const similarity = this.calculateSimilarity(normPred, normActual);

    return similarity;
  }

  private normalizeCode(code: string): string {
    return code
      .replace(/\/\/.*$/gm, '') // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0;

    // Token-based similarity
    const tokensA = new Set(a.split(/\s+/));
    const tokensB = new Set(b.split(/\s+/));

    const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size; // Jaccard similarity
  }

  private analyzeErrors(prediction: string, actual: string): string {
    const errors: string[] = [];

    // Check for missing imports
    const actualImports = actual.match(/import\s+.*?from/g) || [];
    const predImports = prediction.match(/import\s+.*?from/g) || [];
    if (actualImports.length > predImports.length) {
      errors.push('Missing imports');
    }

    // Check for wrong function names
    const actualFuncs = actual.match(/function\s+(\w+)/g) || [];
    const predFuncs = prediction.match(/function\s+(\w+)/g) || [];
    if (actualFuncs.join(',') !== predFuncs.join(',')) {
      errors.push('Function signature mismatch');
    }

    // Check for wrong syntax
    if (prediction.includes('???') || prediction.includes('TODO')) {
      errors.push('Incomplete implementation');
    }

    return errors.length > 0 ? errors.join('; ') : 'General logic differences';
  }

  private extractPattern(
    source: ShadowLearningSource,
    prediction: string,
    actual: string
  ): string | null {
    // Extract a learnable pattern from the successful exercise
    const metadata = source.metadata;

    if (metadata.library) {
      return `${metadata.library}: Correct usage pattern for ${source.type}`;
    }

    return `Pattern learned from ${source.type}: ${source.url.substring(0, 50)}`;
  }

  private async saveResult(result: ShadowLearningResult): Promise<void> {
    await executeStatement(
      `INSERT INTO shadow_learning_log (
        id, source_type, source_url, content_hash, predicted_code,
        actual_code, self_grade, error_analysis, learned_pattern, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        stringParam('id', result.id),
        stringParam('sourceType', result.source_type),
        stringParam('sourceUrl', result.source_url),
        stringParam('contentHash', result.content_hash),
        stringParam('predictedCode', result.predicted_code),
        stringParam('actualCode', result.actual_code),
        doubleParam('selfGrade', result.self_grade),
        stringParam('errorAnalysis', result.error_analysis),
        stringParam('learnedPattern', result.learned_pattern || ''),
        stringParam('createdAt', result.created_at.toISOString()),
      ]
    );
  }

  private async getExercisesForSource(
    sourceType: 'github' | 'documentation' | 'stackoverflow',
    config: ShadowModeConfig
  ): Promise<ShadowLearningSource[]> {
    // In production, this would fetch from actual sources
    switch (sourceType) {
      case 'documentation':
        return this.getDocumentationExercises('typescript');
      case 'github':
        return []; // Would fetch from GitHub API
      case 'stackoverflow':
        return []; // Would fetch from SO API
      default:
        return [];
    }
  }

  private parseResultRows(rows: unknown[]): ShadowLearningResult[] {
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        source_type: r.source_type as string,
        source_url: r.source_url as string,
        content_hash: r.content_hash as string,
        predicted_code: r.predicted_code as string,
        actual_code: r.actual_code as string,
        self_grade: Number(r.self_grade || 0),
        error_analysis: r.error_analysis as string,
        learned_pattern: r.learned_pattern as string | null,
        created_at: new Date(r.created_at as string),
      };
    });
  }
}

export const shadowModeService = new ShadowModeService();
