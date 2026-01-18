// RADIANT v5.12.0 - Skeletonizer Service
// Privacy firewall for global learning - strips PII while preserving logic
// Transforms raw user data into semantic skeletons for safe Cato training

import { executeStatement, stringParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface SkeletonizedEpisode {
  skeleton_id: string;
  original_episode_id: string;
  goal_skeleton: string;
  workflow_skeleton: SkeletonStep[];
  outcome_signal: 'positive' | 'negative' | 'neutral';
  metrics_skeleton: SkeletonMetrics;
  created_at: Date;
}

export interface SkeletonStep {
  tool_type: string;
  status: 'success' | 'fail';
  error_category?: string;
}

export interface SkeletonMetrics {
  had_paste_back_error: boolean;
  edit_distance_bucket: 'none' | 'low' | 'medium' | 'high';
  commit_speed_bucket: 'fast' | 'normal' | 'slow' | 'none';
  sandbox_result: 'pass' | 'fail' | 'none';
}

// Pattern definitions for semantic extraction
interface PatternRule {
  pattern: RegExp;
  replacement: string;
  category: string;
}

// ============================================================================
// Skeletonizer Service
// ============================================================================

class SkeletonizerService {
  private readonly patterns: PatternRule[] = [
    // URLs and endpoints
    { pattern: /https?:\/\/[^\s]+/g, replacement: '<URL>', category: 'url' },
    { pattern: /localhost:\d+/g, replacement: '<LOCALHOST_PORT>', category: 'url' },
    
    // Docker/Container
    { pattern: /docker\s+push\s+[\w\-\.\/]+/gi, replacement: '<CMD:DOCKER_PUSH> <REGISTRY_URL> <IMAGE_TAG>', category: 'docker' },
    { pattern: /docker\s+pull\s+[\w\-\.\/]+/gi, replacement: '<CMD:DOCKER_PULL> <IMAGE_REF>', category: 'docker' },
    { pattern: /docker\s+build\s+[^\n]+/gi, replacement: '<CMD:DOCKER_BUILD> <BUILD_ARGS>', category: 'docker' },
    { pattern: /docker\s+run\s+[^\n]+/gi, replacement: '<CMD:DOCKER_RUN> <RUN_ARGS>', category: 'docker' },
    
    // Git
    { pattern: /git\s+clone\s+[^\s]+/gi, replacement: '<CMD:GIT_CLONE> <REPO_URL>', category: 'git' },
    { pattern: /git\s+push\s+[^\n]*/gi, replacement: '<CMD:GIT_PUSH> <REMOTE> <BRANCH>', category: 'git' },
    { pattern: /git\s+commit\s+[^\n]*/gi, replacement: '<CMD:GIT_COMMIT> <COMMIT_ARGS>', category: 'git' },
    
    // AWS
    { pattern: /arn:aws:[a-z0-9\-]+:[a-z0-9\-]*:\d*:[^\s]+/gi, replacement: '<AWS_ARN>', category: 'aws' },
    { pattern: /s3:\/\/[^\s]+/gi, replacement: '<S3_URI>', category: 'aws' },
    { pattern: /aws\s+[a-z0-9\-]+\s+[^\n]+/gi, replacement: '<CMD:AWS_CLI> <SERVICE> <ARGS>', category: 'aws' },
    
    // API Keys and Secrets
    { pattern: /[A-Za-z0-9_]{20,}/g, replacement: '<API_KEY>', category: 'secret' },
    { pattern: /Bearer\s+[A-Za-z0-9\-_\.]+/gi, replacement: 'Bearer <TOKEN>', category: 'secret' },
    { pattern: /sk-[A-Za-z0-9]+/g, replacement: '<OPENAI_KEY>', category: 'secret' },
    { pattern: /AKIA[A-Z0-9]{16}/g, replacement: '<AWS_ACCESS_KEY>', category: 'secret' },
    
    // IPs and Ports
    { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '<IP_ADDRESS>', category: 'network' },
    { pattern: /:\d{4,5}\b/g, replacement: ':<PORT>', category: 'network' },
    
    // File paths
    { pattern: /\/Users\/[^\s\/]+/g, replacement: '<USER_HOME>', category: 'path' },
    { pattern: /\/home\/[^\s\/]+/g, replacement: '<USER_HOME>', category: 'path' },
    { pattern: /C:\\Users\\[^\s\\]+/g, replacement: '<USER_HOME>', category: 'path' },
    
    // Email addresses
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '<EMAIL>', category: 'pii' },
    
    // Names (common patterns)
    { pattern: /my-[a-z0-9\-]+-(app|api|service|db|bucket)/gi, replacement: '<PROJECT_NAME>', category: 'project' },
    { pattern: /[a-z]+-[a-z]+-[a-z0-9]+-(dev|prod|staging)/gi, replacement: '<ENV_RESOURCE>', category: 'project' },
    
    // Database connections
    { pattern: /postgres:\/\/[^\s]+/gi, replacement: '<POSTGRES_URI>', category: 'database' },
    { pattern: /mongodb:\/\/[^\s]+/gi, replacement: '<MONGODB_URI>', category: 'database' },
    { pattern: /mysql:\/\/[^\s]+/gi, replacement: '<MYSQL_URI>', category: 'database' },
    { pattern: /redis:\/\/[^\s]+/gi, replacement: '<REDIS_URI>', category: 'database' },
    
    // Package managers
    { pattern: /npm\s+install\s+[^\n]+/gi, replacement: '<CMD:NPM_INSTALL> <PACKAGES>', category: 'package' },
    { pattern: /pnpm\s+install\s+[^\n]+/gi, replacement: '<CMD:PNPM_INSTALL> <PACKAGES>', category: 'package' },
    { pattern: /yarn\s+add\s+[^\n]+/gi, replacement: '<CMD:YARN_ADD> <PACKAGES>', category: 'package' },
    { pattern: /pip\s+install\s+[^\n]+/gi, replacement: '<CMD:PIP_INSTALL> <PACKAGES>', category: 'package' },
  ];

  /**
   * Skeletonize an episode for global training
   * Strips all PII while preserving semantic structure
   */
  async skeletonize(episode: {
    episode_id: string;
    goal_intent: string;
    workflow_trace: Array<{
      tool: string;
      status: string;
      error_type?: string;
    }>;
    outcome_signal: 'positive' | 'negative' | 'neutral';
    metrics: {
      paste_back_error: boolean;
      edit_distance: number;
      time_to_commit_ms: number | null;
      sandbox_passed: boolean | null;
    };
    draft_content?: string;
    final_content?: string;
  }): Promise<SkeletonizedEpisode> {
    const skeletonId = uuidv4();

    // Skeletonize goal intent
    const goalSkeleton = this.skeletonizeText(episode.goal_intent);

    // Skeletonize workflow trace
    const workflowSkeleton: SkeletonStep[] = episode.workflow_trace.map((step) => ({
      tool_type: this.categorizeToolType(step.tool),
      status: step.status as 'success' | 'fail',
      error_category: step.error_type ? this.categorizeError(step.error_type) : undefined,
    }));

    // Bucketize metrics (preserve signal without exact values)
    const metricsSkeleton: SkeletonMetrics = {
      had_paste_back_error: episode.metrics.paste_back_error,
      edit_distance_bucket: this.bucketizeEditDistance(episode.metrics.edit_distance),
      commit_speed_bucket: this.bucketizeCommitSpeed(episode.metrics.time_to_commit_ms),
      sandbox_result: episode.metrics.sandbox_passed === null 
        ? 'none' 
        : episode.metrics.sandbox_passed ? 'pass' : 'fail',
    };

    const skeletonized: SkeletonizedEpisode = {
      skeleton_id: skeletonId,
      original_episode_id: episode.episode_id,
      goal_skeleton: goalSkeleton,
      workflow_skeleton: workflowSkeleton,
      outcome_signal: episode.outcome_signal,
      metrics_skeleton: metricsSkeleton,
      created_at: new Date(),
    };

    // Store in database
    await executeStatement(
      `INSERT INTO skeletonized_episodes (
        skeleton_id, original_episode_id, goal_skeleton, workflow_skeleton,
        outcome_signal, metrics_skeleton, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        stringParam('skeletonId', skeletonId),
        stringParam('originalEpisodeId', episode.episode_id),
        stringParam('goalSkeleton', goalSkeleton),
        stringParam('workflowSkeleton', JSON.stringify(workflowSkeleton)),
        stringParam('outcomeSignal', episode.outcome_signal),
        stringParam('metricsSkeleton', JSON.stringify(metricsSkeleton)),
        stringParam('createdAt', skeletonized.created_at.toISOString()),
      ]
    );

    logger.info('Episode skeletonized', { skeletonId, originalEpisodeId: episode.episode_id });
    return skeletonized;
  }

  /**
   * Skeletonize code content for training
   * Preserves structure while removing identifiers
   */
  skeletonizeCode(code: string): string {
    let skeleton = code;

    // Apply all patterns
    for (const rule of this.patterns) {
      skeleton = skeleton.replace(rule.pattern, rule.replacement);
    }

    // Additional code-specific sanitization
    skeleton = this.sanitizeVariableNames(skeleton);
    skeleton = this.sanitizeStringLiterals(skeleton);

    return skeleton;
  }

  /**
   * Get skeletonized episodes for DPO training
   */
  async getSkeletonizedPairs(
    limit: number = 100
  ): Promise<Array<{ chosen: SkeletonizedEpisode; rejected: SkeletonizedEpisode }>> {
    // Get positive (chosen) episodes
    const chosenResult = await executeStatement(
      `SELECT * FROM skeletonized_episodes 
       WHERE outcome_signal = 'positive' 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [stringParam('limit', limit.toString())]
    );

    // Get negative (rejected) episodes
    const rejectedResult = await executeStatement(
      `SELECT * FROM skeletonized_episodes 
       WHERE outcome_signal = 'negative' 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [stringParam('limit', limit.toString())]
    );

    const chosenEpisodes = this.parseSkeletonRows(chosenResult.rows || []);
    const rejectedEpisodes = this.parseSkeletonRows(rejectedResult.rows || []);

    // Create pairs based on similar goal skeletons
    const pairs: Array<{ chosen: SkeletonizedEpisode; rejected: SkeletonizedEpisode }> = [];

    for (const chosen of chosenEpisodes) {
      const rejected = rejectedEpisodes.find(
        (r) => this.areSimilarSkeletons(chosen.goal_skeleton, r.goal_skeleton)
      );
      if (rejected) {
        pairs.push({ chosen, rejected });
      }
    }

    return pairs;
  }

  /**
   * Skeletonize text (goal intents, descriptions)
   */
  skeletonizeText(text: string): string {
    let skeleton = text;

    // Apply all patterns
    for (const rule of this.patterns) {
      skeleton = skeleton.replace(rule.pattern, rule.replacement);
    }

    return skeleton;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private categorizeToolType(tool: string): string {
    const toolLower = tool.toLowerCase();
    
    if (toolLower.includes('file') || toolLower.includes('read') || toolLower.includes('write')) {
      return 'FILE_OPERATION';
    }
    if (toolLower.includes('docker') || toolLower.includes('container')) {
      return 'CONTAINER_OPERATION';
    }
    if (toolLower.includes('git')) {
      return 'VERSION_CONTROL';
    }
    if (toolLower.includes('npm') || toolLower.includes('pnpm') || toolLower.includes('yarn') || toolLower.includes('pip')) {
      return 'PACKAGE_MANAGEMENT';
    }
    if (toolLower.includes('build') || toolLower.includes('compile')) {
      return 'BUILD_OPERATION';
    }
    if (toolLower.includes('test')) {
      return 'TEST_OPERATION';
    }
    if (toolLower.includes('deploy')) {
      return 'DEPLOY_OPERATION';
    }
    if (toolLower.includes('search') || toolLower.includes('find')) {
      return 'SEARCH_OPERATION';
    }
    if (toolLower.includes('api') || toolLower.includes('request') || toolLower.includes('http')) {
      return 'API_OPERATION';
    }
    if (toolLower.includes('database') || toolLower.includes('sql') || toolLower.includes('query')) {
      return 'DATABASE_OPERATION';
    }
    
    return 'GENERIC_OPERATION';
  }

  private categorizeError(errorType: string): string {
    const errorLower = errorType.toLowerCase();
    
    if (errorLower.includes('permission') || errorLower.includes('access') || errorLower.includes('denied')) {
      return 'PERMISSION_ERROR';
    }
    if (errorLower.includes('not found') || errorLower.includes('missing') || errorLower.includes('404')) {
      return 'NOT_FOUND_ERROR';
    }
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'TIMEOUT_ERROR';
    }
    if (errorLower.includes('syntax') || errorLower.includes('parse')) {
      return 'SYNTAX_ERROR';
    }
    if (errorLower.includes('type') || errorLower.includes('undefined')) {
      return 'TYPE_ERROR';
    }
    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return 'NETWORK_ERROR';
    }
    if (errorLower.includes('memory') || errorLower.includes('oom')) {
      return 'MEMORY_ERROR';
    }
    if (errorLower.includes('dependency') || errorLower.includes('version')) {
      return 'DEPENDENCY_ERROR';
    }
    
    return 'GENERIC_ERROR';
  }

  private bucketizeEditDistance(distance: number): 'none' | 'low' | 'medium' | 'high' {
    if (distance === 0) return 'none';
    if (distance < 0.2) return 'low';
    if (distance < 0.5) return 'medium';
    return 'high';
  }

  private bucketizeCommitSpeed(timeMs: number | null): 'fast' | 'normal' | 'slow' | 'none' {
    if (timeMs === null) return 'none';
    if (timeMs < 30000) return 'fast';   // < 30 seconds
    if (timeMs < 120000) return 'normal'; // < 2 minutes
    return 'slow';
  }

  private sanitizeVariableNames(code: string): string {
    // Replace common variable naming patterns with generic placeholders
    return code
      .replace(/const\s+[a-zA-Z_][a-zA-Z0-9_]*/g, 'const <VAR>')
      .replace(/let\s+[a-zA-Z_][a-zA-Z0-9_]*/g, 'let <VAR>')
      .replace(/var\s+[a-zA-Z_][a-zA-Z0-9_]*/g, 'var <VAR>')
      .replace(/function\s+[a-zA-Z_][a-zA-Z0-9_]*/g, 'function <FUNC>')
      .replace(/class\s+[a-zA-Z_][a-zA-Z0-9_]*/g, 'class <CLASS>');
  }

  private sanitizeStringLiterals(code: string): string {
    // Replace string literals that might contain sensitive data
    return code
      .replace(/"[^"]*@[^"]*"/g, '"<EMAIL_STRING>"')
      .replace(/"https?:\/\/[^"]*"/g, '"<URL_STRING>"')
      .replace(/"[a-zA-Z0-9]{32,}"/g, '"<LONG_STRING>"');
  }

  private parseSkeletonRows(rows: unknown[]): SkeletonizedEpisode[] {
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        skeleton_id: r.skeleton_id as string,
        original_episode_id: r.original_episode_id as string,
        goal_skeleton: r.goal_skeleton as string,
        workflow_skeleton: JSON.parse(r.workflow_skeleton as string || '[]'),
        outcome_signal: r.outcome_signal as 'positive' | 'negative' | 'neutral',
        metrics_skeleton: JSON.parse(r.metrics_skeleton as string || '{}'),
        created_at: new Date(r.created_at as string),
      };
    });
  }

  private areSimilarSkeletons(a: string, b: string): boolean {
    // Check if two goal skeletons are similar enough to be DPO pairs
    const tokensA = a.split(/\s+/).filter((t) => t.startsWith('<'));
    const tokensB = b.split(/\s+/).filter((t) => t.startsWith('<'));
    
    if (tokensA.length === 0 || tokensB.length === 0) return false;
    
    const intersection = tokensA.filter((t) => tokensB.includes(t));
    return intersection.length >= Math.min(tokensA.length, tokensB.length) * 0.6;
  }
}

export const skeletonizerService = new SkeletonizerService();
