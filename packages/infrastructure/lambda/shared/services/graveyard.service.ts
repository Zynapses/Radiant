// RADIANT v5.12.0 - Graveyard Service (Anti-Pattern Registry)
// Tracks high-frequency failures and creates proactive warnings
// "Preventing errors is as valuable as solving them"

import { executeStatement, stringParam, longParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface AntiPattern {
  pattern_id: string;
  pattern_type: 'dependency_conflict' | 'version_incompatibility' | 'config_error' | 'runtime_error' | 'api_breaking_change';
  signature: string;
  description: string;
  failure_count: number;
  failure_rate: number;
  affected_stacks: string[];
  recommended_fix: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  first_seen: Date;
  last_seen: Date;
  is_active: boolean;
}

export interface FailureCluster {
  cluster_id: string;
  error_signature: string;
  occurrences: number;
  unique_users: number;
  stack_trace_sample: string;
  common_context: Record<string, string>;
  created_at: Date;
}

export interface ProactiveWarning {
  warning_id: string;
  pattern_id: string;
  context_match: string;
  warning_message: string;
  recommendation: string;
  confidence: number;
}

// ============================================================================
// Graveyard Service
// ============================================================================

class GraveyardService {
  private readonly CLUSTER_THRESHOLD = 5; // Minimum failures to form cluster
  private readonly PATTERN_THRESHOLD = 10; // Minimum failures to create anti-pattern

  /**
   * Record a failure for clustering
   */
  async recordFailure(failure: {
    tenant_id: string;
    user_id: string;
    error_type: string;
    error_message: string;
    stack_trace?: string;
    context: Record<string, string>;
  }): Promise<void> {
    const signature = this.generateErrorSignature(failure.error_type, failure.error_message);

    await executeStatement(
      `INSERT INTO failure_log (
        id, tenant_id, user_id, error_signature, error_type, 
        error_message, stack_trace, context, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        stringParam('id', uuidv4()),
        stringParam('tenantId', failure.tenant_id),
        stringParam('userId', failure.user_id),
        stringParam('signature', signature),
        stringParam('errorType', failure.error_type),
        stringParam('errorMessage', failure.error_message.substring(0, 1000)),
        stringParam('stackTrace', (failure.stack_trace || '').substring(0, 5000)),
        stringParam('context', JSON.stringify(failure.context)),
      ]
    );

    // Check if we should cluster
    await this.checkAndCluster(signature);
  }

  /**
   * Check context against known anti-patterns and return warnings
   */
  async checkForWarnings(context: {
    language?: string;
    framework?: string;
    dependencies?: Record<string, string>;
    runtime_version?: string;
    intent?: string;
  }): Promise<ProactiveWarning[]> {
    const warnings: ProactiveWarning[] = [];

    // Get active anti-patterns
    const patternsResult = await executeStatement(
      `SELECT * FROM anti_patterns WHERE is_active = true ORDER BY failure_rate DESC`,
      []
    );

    const patterns = (patternsResult.rows || []) as unknown as AntiPattern[];

    for (const pattern of patterns) {
      const match = this.matchesPattern(pattern, context);
      if (match.matches) {
        warnings.push({
          warning_id: uuidv4(),
          pattern_id: pattern.pattern_id,
          context_match: match.matchedOn,
          warning_message: this.formatWarning(pattern),
          recommendation: pattern.recommended_fix,
          confidence: match.confidence,
        });
      }
    }

    return warnings.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get anti-patterns for admin dashboard
   */
  async getAntiPatterns(options: {
    severity?: string;
    type?: string;
    limit?: number;
  } = {}): Promise<AntiPattern[]> {
    let query = `SELECT * FROM anti_patterns WHERE is_active = true`;
    const params: ReturnType<typeof stringParam>[] = [];

    if (options.severity) {
      params.push(stringParam('severity', options.severity));
      query += ` AND severity = $${params.length}`;
    }

    if (options.type) {
      params.push(stringParam('type', options.type));
      query += ` AND pattern_type = $${params.length}`;
    }

    query += ` ORDER BY failure_count DESC LIMIT $${params.length + 1}`;
    params.push(longParam('limit', options.limit || 50));

    const result = await executeStatement(query, params);
    return this.parsePatternRows(result.rows || []);
  }

  /**
   * Create or update an anti-pattern from clustered failures
   */
  async createAntiPattern(input: {
    pattern_type: AntiPattern['pattern_type'];
    signature: string;
    description: string;
    affected_stacks: string[];
    recommended_fix: string;
    severity: AntiPattern['severity'];
  }): Promise<string> {
    const patternId = uuidv4();

    // Get failure stats for this signature
    const statsResult = await executeStatement(
      `SELECT COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
       FROM failure_log WHERE error_signature = $1`,
      [stringParam('signature', input.signature)]
    );

    const stats = statsResult.rows?.[0] as { count: number; unique_users: number } | undefined;
    const failureCount = Number(stats?.count || 0);

    await executeStatement(
      `INSERT INTO anti_patterns (
        pattern_id, pattern_type, signature, description, failure_count,
        failure_rate, affected_stacks, recommended_fix, severity,
        first_seen, last_seen, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), true)
      ON CONFLICT (signature) DO UPDATE SET
        failure_count = anti_patterns.failure_count + 1,
        last_seen = NOW()`,
      [
        stringParam('patternId', patternId),
        stringParam('patternType', input.pattern_type),
        stringParam('signature', input.signature),
        stringParam('description', input.description),
        longParam('failureCount', failureCount),
        doubleParam('failureRate', 0), // Will be calculated
        stringParam('affectedStacks', JSON.stringify(input.affected_stacks)),
        stringParam('recommendedFix', input.recommended_fix),
        stringParam('severity', input.severity),
      ]
    );

    logger.info('Anti-pattern created', { patternId, signature: input.signature });
    return patternId;
  }

  /**
   * Run nightly clustering job to identify new anti-patterns
   */
  async runClusteringJob(): Promise<{ clustersFound: number; patternsCreated: number }> {
    // Find error signatures with high frequency
    const clustersResult = await executeStatement(
      `SELECT 
        error_signature, 
        error_type,
        COUNT(*) as occurrence_count,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(error_message) as sample_message,
        MAX(stack_trace) as sample_stack,
        jsonb_agg(DISTINCT context) as contexts
       FROM failure_log 
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY error_signature, error_type
       HAVING COUNT(*) >= $1
       ORDER BY occurrence_count DESC
       LIMIT 100`,
      [longParam('threshold', this.CLUSTER_THRESHOLD)]
    );

    const clusters = (clustersResult.rows || []) as Array<{
      error_signature: string;
      error_type: string;
      occurrence_count: number;
      unique_users: number;
      sample_message: string;
      sample_stack: string;
      contexts: Record<string, string>[];
    }>;

    let patternsCreated = 0;

    for (const cluster of clusters) {
      if (cluster.occurrence_count >= this.PATTERN_THRESHOLD) {
        // Extract common context
        const commonContext = this.extractCommonContext(cluster.contexts);
        const patternType = this.inferPatternType(cluster.error_type, cluster.sample_message);
        const severity = this.inferSeverity(cluster.occurrence_count, cluster.unique_users);

        await this.createAntiPattern({
          pattern_type: patternType,
          signature: cluster.error_signature,
          description: this.generateDescription(cluster),
          affected_stacks: commonContext.stacks || [],
          recommended_fix: this.generateRecommendation(cluster, commonContext),
          severity,
        });

        patternsCreated++;
      }
    }

    logger.info('Clustering job completed', { clustersFound: clusters.length, patternsCreated });
    return { clustersFound: clusters.length, patternsCreated };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateErrorSignature(errorType: string, errorMessage: string): string {
    // Create a normalized signature by removing variable parts
    const normalized = errorMessage
      .replace(/\d+/g, 'N')
      .replace(/['"][^'"]+['"]/g, 'STR')
      .replace(/0x[a-fA-F0-9]+/g, 'HEX')
      .replace(/\/.+\.(js|ts|py|java)/g, '/FILE.$1')
      .substring(0, 200);

    return `${errorType}:${normalized}`;
  }

  private async checkAndCluster(signature: string): Promise<void> {
    const countResult = await executeStatement(
      `SELECT COUNT(*) as count FROM failure_log 
       WHERE error_signature = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [stringParam('signature', signature)]
    );

    const count = Number((countResult.rows?.[0] as { count: number })?.count || 0);

    if (count >= this.CLUSTER_THRESHOLD) {
      logger.info('Failure cluster detected', { signature, count });
    }
  }

  private matchesPattern(
    pattern: AntiPattern,
    context: {
      language?: string;
      framework?: string;
      dependencies?: Record<string, string>;
      runtime_version?: string;
      intent?: string;
    }
  ): { matches: boolean; matchedOn: string; confidence: number } {
    const affectedStacks = pattern.affected_stacks;
    let matches = false;
    let matchedOn = '';
    let confidence = 0;

    // Check language/framework match
    if (context.language && affectedStacks.includes(context.language)) {
      matches = true;
      matchedOn = `language:${context.language}`;
      confidence = 0.5;
    }

    if (context.framework && affectedStacks.includes(context.framework)) {
      matches = true;
      matchedOn = `framework:${context.framework}`;
      confidence = 0.7;
    }

    // Check dependency matches
    if (context.dependencies) {
      for (const [dep, version] of Object.entries(context.dependencies)) {
        const depPattern = `${dep}@${version}`;
        if (affectedStacks.some((s) => s.includes(dep))) {
          matches = true;
          matchedOn = `dependency:${depPattern}`;
          confidence = 0.8;
        }
      }
    }

    // Check runtime version
    if (context.runtime_version && affectedStacks.some((s) => s.includes(context.runtime_version!))) {
      matches = true;
      matchedOn = `runtime:${context.runtime_version}`;
      confidence = 0.9;
    }

    // Boost confidence based on failure rate
    if (matches) {
      confidence = Math.min(1.0, confidence + pattern.failure_rate * 0.2);
    }

    return { matches, matchedOn, confidence };
  }

  private formatWarning(pattern: AntiPattern): string {
    const severityEmoji = {
      low: '⚠️',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };

    return `${severityEmoji[pattern.severity]} ${pattern.failure_rate.toFixed(0)}% of users experience issues with this configuration. ${pattern.description}`;
  }

  private extractCommonContext(contexts: Record<string, string>[]): Record<string, string[]> {
    const common: Record<string, string[]> = { stacks: [] };

    for (const ctx of contexts) {
      if (ctx.language) common.stacks.push(ctx.language);
      if (ctx.framework) common.stacks.push(ctx.framework);
      if (ctx.runtime) common.stacks.push(ctx.runtime);
    }

    common.stacks = [...new Set(common.stacks)];
    return common;
  }

  private inferPatternType(errorType: string, message: string): AntiPattern['pattern_type'] {
    const lower = (errorType + message).toLowerCase();

    if (lower.includes('version') || lower.includes('incompatible')) {
      return 'version_incompatibility';
    }
    if (lower.includes('dependency') || lower.includes('module not found')) {
      return 'dependency_conflict';
    }
    if (lower.includes('config') || lower.includes('invalid option')) {
      return 'config_error';
    }
    if (lower.includes('deprecated') || lower.includes('breaking change')) {
      return 'api_breaking_change';
    }
    return 'runtime_error';
  }

  private inferSeverity(occurrences: number, uniqueUsers: number): AntiPattern['severity'] {
    if (occurrences > 100 || uniqueUsers > 50) return 'critical';
    if (occurrences > 50 || uniqueUsers > 20) return 'high';
    if (occurrences > 20 || uniqueUsers > 10) return 'medium';
    return 'low';
  }

  private generateDescription(cluster: {
    error_type: string;
    occurrence_count: number;
    unique_users: number;
    sample_message: string;
  }): string {
    return `${cluster.error_type} affecting ${cluster.unique_users} users (${cluster.occurrence_count} occurrences). Common error: ${cluster.sample_message.substring(0, 100)}...`;
  }

  private generateRecommendation(
    cluster: { error_type: string; sample_message: string },
    commonContext: Record<string, string[]>
  ): string {
    const stacks = commonContext.stacks?.join(', ') || 'unknown';
    return `Consider using a compatible version or alternative library. Affected stacks: ${stacks}. Check documentation for migration guides.`;
  }

  private parsePatternRows(rows: unknown[]): AntiPattern[] {
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        pattern_id: r.pattern_id as string,
        pattern_type: r.pattern_type as AntiPattern['pattern_type'],
        signature: r.signature as string,
        description: r.description as string,
        failure_count: Number(r.failure_count || 0),
        failure_rate: Number(r.failure_rate || 0),
        affected_stacks: JSON.parse(r.affected_stacks as string || '[]'),
        recommended_fix: r.recommended_fix as string,
        severity: r.severity as AntiPattern['severity'],
        first_seen: new Date(r.first_seen as string),
        last_seen: new Date(r.last_seen as string),
        is_active: Boolean(r.is_active),
      };
    });
  }
}

export const graveyardService = new GraveyardService();
