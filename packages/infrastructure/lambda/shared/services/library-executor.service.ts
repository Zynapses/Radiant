// RADIANT v4.18.0 - Library Executor Service
// Multi-tenant concurrent library execution with isolation
// Manages execution queue, resource limits, and tenant isolation

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import type {
  LibraryExecutionRequest,
  LibraryExecutionResult,
  TenantExecutionConfig,
  ExecutionStatus,
  ExecutionMetrics,
  ExecutionBilling,
  ExecutionQueueStatus,
  ExecutionDashboard,
  QueuedExecution,
  DEFAULT_TENANT_EXECUTION_CONFIG,
  EXECUTION_PRICING,
} from '@radiant/shared';

// ============================================================================
// Concurrency Tracking (In-Memory for Lambda, Redis in production)
// ============================================================================

interface TenantConcurrency {
  activeExecutions: Map<string, Set<string>>; // userId -> Set<executionId>
  totalActive: number;
}

const tenantConcurrency = new Map<string, TenantConcurrency>();

function getOrCreateTenantConcurrency(tenantId: string): TenantConcurrency {
  if (!tenantConcurrency.has(tenantId)) {
    tenantConcurrency.set(tenantId, {
      activeExecutions: new Map(),
      totalActive: 0,
    });
  }
  return tenantConcurrency.get(tenantId)!;
}

// ============================================================================
// Library Executor Service
// ============================================================================

class LibraryExecutorService {
  private configCache = new Map<string, { config: TenantExecutionConfig; cachedAt: number }>();
  private readonly CONFIG_CACHE_TTL = 60000; // 1 minute

  // ============================================================================
  // Configuration
  // ============================================================================

  async getConfig(tenantId: string): Promise<TenantExecutionConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    const result = await executeStatement(
      `SELECT * FROM library_execution_config WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (!result.records || result.records.length === 0) {
      // Create default config
      const defaultConfig = await this.createDefaultConfig(tenantId);
      return defaultConfig;
    }

    const config = this.mapConfig(result.records[0] as Record<string, unknown>);
    this.configCache.set(tenantId, { config, cachedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<TenantExecutionConfig>): Promise<TenantExecutionConfig> {
    const current = await this.getConfig(tenantId);
    const merged = { ...current, ...updates };

    await executeStatement(
      `UPDATE library_execution_config SET
         execution_enabled = $2,
         max_concurrent_executions = $3,
         max_concurrent_per_user = $4,
         default_constraints = $5,
         library_overrides = $6,
         daily_budget = $7,
         monthly_budget = $8,
         allowed_execution_types = $9,
         blocked_libraries = $10,
         priority_boost = $11,
         updated_at = NOW()
       WHERE tenant_id = $1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'enabled', value: { booleanValue: merged.executionEnabled } },
        { name: 'maxConcurrent', value: { longValue: merged.maxConcurrentExecutions } },
        { name: 'maxPerUser', value: { longValue: merged.maxConcurrentPerUser } },
        { name: 'constraints', value: { stringValue: JSON.stringify(merged.defaultConstraints) } },
        { name: 'overrides', value: merged.libraryOverrides ? { stringValue: JSON.stringify(merged.libraryOverrides) } : { isNull: true } },
        { name: 'dailyBudget', value: merged.dailyBudget ? { doubleValue: merged.dailyBudget } : { isNull: true } },
        { name: 'monthlyBudget', value: merged.monthlyBudget ? { doubleValue: merged.monthlyBudget } : { isNull: true } },
        { name: 'allowedTypes', value: { stringValue: JSON.stringify(merged.allowedExecutionTypes) } },
        { name: 'blockedLibs', value: { stringValue: JSON.stringify(merged.blockedLibraries) } },
        { name: 'priorityBoost', value: { longValue: merged.priorityBoost } },
      ]
    );

    this.configCache.delete(tenantId);
    return this.getConfig(tenantId);
  }

  private async createDefaultConfig(tenantId: string): Promise<TenantExecutionConfig> {
    const now = new Date();
    const config: TenantExecutionConfig = {
      tenantId,
      executionEnabled: true,
      maxConcurrentExecutions: 10,
      maxConcurrentPerUser: 3,
      defaultConstraints: {
        maxDurationSeconds: 60,
        maxMemoryMb: 512,
        maxOutputBytes: 10 * 1024 * 1024,
        allowNetwork: false,
        allowFileWrites: false,
      },
      allowedExecutionTypes: ['code_execution', 'data_transformation', 'analysis', 'visualization'],
      blockedLibraries: [],
      priorityBoost: 0,
      createdAt: now,
      updatedAt: now,
    };

    await executeStatement(
      `INSERT INTO library_execution_config (
         tenant_id, execution_enabled, max_concurrent_executions,
         max_concurrent_per_user, default_constraints, allowed_execution_types,
         blocked_libraries, priority_boost, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'enabled', value: { booleanValue: config.executionEnabled } },
        { name: 'maxConcurrent', value: { longValue: config.maxConcurrentExecutions } },
        { name: 'maxPerUser', value: { longValue: config.maxConcurrentPerUser } },
        { name: 'constraints', value: { stringValue: JSON.stringify(config.defaultConstraints) } },
        { name: 'allowedTypes', value: { stringValue: JSON.stringify(config.allowedExecutionTypes) } },
        { name: 'blockedLibs', value: { stringValue: JSON.stringify(config.blockedLibraries) } },
        { name: 'priorityBoost', value: { longValue: config.priorityBoost } },
      ]
    );

    return config;
  }

  // ============================================================================
  // Execution Management
  // ============================================================================

  /**
   * Submit an execution request with concurrency checks
   */
  async submitExecution(request: LibraryExecutionRequest): Promise<{ queued: boolean; position?: number; error?: string }> {
    const config = await this.getConfig(request.tenantId);

    // Check if execution is enabled
    if (!config.executionEnabled) {
      return { queued: false, error: 'Library execution is disabled for this tenant' };
    }

    // Check if library is blocked
    if (config.blockedLibraries.includes(request.libraryId)) {
      return { queued: false, error: `Library ${request.libraryId} is blocked` };
    }

    // Check if execution type is allowed
    if (!config.allowedExecutionTypes.includes(request.executionType)) {
      return { queued: false, error: `Execution type ${request.executionType} is not allowed` };
    }

    // Check concurrency limits
    const concurrencyCheck = await this.checkConcurrencyLimits(
      request.tenantId,
      request.userId,
      config
    );

    if (!concurrencyCheck.allowed) {
      // Queue the execution
      const position = await this.queueExecution(request, config);
      return { queued: true, position };
    }

    // Check budget limits
    const budgetCheck = await this.checkBudgetLimits(request.tenantId, config);
    if (!budgetCheck.allowed) {
      return { queued: false, error: budgetCheck.reason };
    }

    // Start execution immediately
    await this.startExecution(request, config);
    return { queued: false };
  }

  /**
   * Check if tenant/user can start a new execution
   */
  async checkConcurrencyLimits(
    tenantId: string,
    userId: string,
    config: TenantExecutionConfig
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Get current active executions from database (authoritative source)
    const result = await executeStatement(
      `SELECT 
         COUNT(*) FILTER (WHERE tenant_id = $1 AND status = 'running') as tenant_active,
         COUNT(*) FILTER (WHERE tenant_id = $1 AND user_id = $2 AND status = 'running') as user_active
       FROM library_executions
       WHERE tenant_id = $1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const row = result.records?.[0] as Record<string, unknown> | undefined;
    const tenantActive = Number(row?.tenant_active) || 0;
    const userActive = Number(row?.user_active) || 0;

    if (tenantActive >= config.maxConcurrentExecutions) {
      return { allowed: false, reason: `Tenant limit reached (${tenantActive}/${config.maxConcurrentExecutions})` };
    }

    if (userActive >= config.maxConcurrentPerUser) {
      return { allowed: false, reason: `User limit reached (${userActive}/${config.maxConcurrentPerUser})` };
    }

    return { allowed: true };
  }

  /**
   * Check budget limits
   */
  async checkBudgetLimits(
    tenantId: string,
    config: TenantExecutionConfig
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!config.dailyBudget && !config.monthlyBudget) {
      return { allowed: true };
    }

    const result = await executeStatement(
      `SELECT 
         COALESCE(SUM(credits_used) FILTER (WHERE started_at > NOW() - INTERVAL '1 day'), 0) as daily_used,
         COALESCE(SUM(credits_used) FILTER (WHERE started_at > NOW() - INTERVAL '1 month'), 0) as monthly_used
       FROM library_executions
       WHERE tenant_id = $1 AND status = 'completed'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.records?.[0] as Record<string, unknown> | undefined;
    const dailyUsed = Number(row?.daily_used) || 0;
    const monthlyUsed = Number(row?.monthly_used) || 0;

    if (config.dailyBudget && dailyUsed >= config.dailyBudget) {
      return { allowed: false, reason: `Daily budget exceeded (${dailyUsed.toFixed(2)}/${config.dailyBudget} credits)` };
    }

    if (config.monthlyBudget && monthlyUsed >= config.monthlyBudget) {
      return { allowed: false, reason: `Monthly budget exceeded (${monthlyUsed.toFixed(2)}/${config.monthlyBudget} credits)` };
    }

    return { allowed: true };
  }

  /**
   * Queue an execution for later processing
   */
  private async queueExecution(request: LibraryExecutionRequest, config: TenantExecutionConfig): Promise<number> {
    const priority = (request.priority || 0) + config.priorityBoost;

    await executeStatement(
      `INSERT INTO library_execution_queue (
         execution_id, tenant_id, user_id, library_id, priority,
         request_data, queued_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        { name: 'executionId', value: { stringValue: request.executionId } },
        { name: 'tenantId', value: { stringValue: request.tenantId } },
        { name: 'userId', value: { stringValue: request.userId } },
        { name: 'libraryId', value: { stringValue: request.libraryId } },
        { name: 'priority', value: { longValue: priority } },
        { name: 'request', value: { stringValue: JSON.stringify(request) } },
      ]
    );

    // Get queue position
    const posResult = await executeStatement(
      `SELECT COUNT(*) as position FROM library_execution_queue 
       WHERE tenant_id = $1 AND (priority > $2 OR (priority = $2 AND queued_at < NOW()))`,
      [
        { name: 'tenantId', value: { stringValue: request.tenantId } },
        { name: 'priority', value: { longValue: priority } },
      ]
    );

    return Number((posResult.records?.[0] as Record<string, unknown>)?.position) || 1;
  }

  /**
   * Start an execution
   */
  private async startExecution(request: LibraryExecutionRequest, config: TenantExecutionConfig): Promise<void> {
    // Merge constraints with library-specific overrides
    const constraints = {
      ...config.defaultConstraints,
      ...request.constraints,
      ...(config.libraryOverrides?.[request.libraryId] || {}),
    };

    // Create execution record
    await executeStatement(
      `INSERT INTO library_executions (
         execution_id, tenant_id, user_id, library_id,
         execution_type, status, constraints,
         code, input_data, context_data,
         started_at
       ) VALUES ($1, $2, $3, $4, $5, 'running', $6, $7, $8, $9, NOW())`,
      [
        { name: 'executionId', value: { stringValue: request.executionId } },
        { name: 'tenantId', value: { stringValue: request.tenantId } },
        { name: 'userId', value: { stringValue: request.userId } },
        { name: 'libraryId', value: { stringValue: request.libraryId } },
        { name: 'executionType', value: { stringValue: request.executionType } },
        { name: 'constraints', value: { stringValue: JSON.stringify(constraints) } },
        { name: 'code', value: { stringValue: request.code } },
        { name: 'input', value: request.input ? { stringValue: JSON.stringify(request.input) } : { isNull: true } },
        { name: 'context', value: request.context ? { stringValue: JSON.stringify(request.context) } : { isNull: true } },
      ]
    );

    // Invoke the executor Lambda asynchronously
    // In production, this would use AWS SDK to invoke the executor
    logger.info('Execution started', {
      executionId: request.executionId,
      tenantId: request.tenantId,
      libraryId: request.libraryId,
    });
  }

  /**
   * Complete an execution
   */
  async completeExecution(
    executionId: string,
    status: ExecutionStatus,
    output?: unknown,
    error?: { code: string; message: string; stackTrace?: string }
  ): Promise<LibraryExecutionResult> {
    // Get execution record
    const result = await executeStatement(
      `SELECT * FROM library_executions WHERE execution_id = $1`,
      [{ name: 'executionId', value: { stringValue: executionId } }]
    );

    if (!result.records || result.records.length === 0) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const row = result.records[0] as Record<string, unknown>;
    const startedAt = new Date(row.started_at as string);
    const now = new Date();
    const durationMs = now.getTime() - startedAt.getTime();

    // Calculate billing
    const billing = this.calculateBilling(durationMs, row.constraints as string);

    // Update execution record
    await executeStatement(
      `UPDATE library_executions SET
         status = $2,
         completed_at = NOW(),
         duration_ms = $3,
         output_data = $4,
         error_data = $5,
         credits_used = $6
       WHERE execution_id = $1`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'status', value: { stringValue: status } },
        { name: 'durationMs', value: { longValue: durationMs } },
        { name: 'output', value: output ? { stringValue: JSON.stringify(output) } : { isNull: true } },
        { name: 'error', value: error ? { stringValue: JSON.stringify(error) } : { isNull: true } },
        { name: 'credits', value: { doubleValue: billing.creditsUsed } },
      ]
    );

    // Process queue - start next execution if capacity available
    await this.processQueue(row.tenant_id as string);

    return {
      executionId,
      status,
      output: output ? { data: output } : undefined,
      error: error ? { ...error, category: 'user_error' } : undefined,
      metrics: {
        queuedAt: startedAt,
        startedAt,
        completedAt: now,
        durationMs,
      },
      billing,
    };
  }

  /**
   * Process the queue and start pending executions
   */
  async processQueue(tenantId: string): Promise<number> {
    const config = await this.getConfig(tenantId);
    
    // Check how many more we can start
    const concurrency = await this.checkConcurrencyLimits(tenantId, '', config);
    if (!concurrency.allowed) {
      return 0;
    }

    // Get next queued execution
    const result = await executeStatement(
      `SELECT * FROM library_execution_queue
       WHERE tenant_id = $1
       ORDER BY priority DESC, queued_at ASC
       LIMIT 1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (!result.records || result.records.length === 0) {
      return 0;
    }

    const row = result.records[0] as Record<string, unknown>;
    const request = JSON.parse(row.request_data as string) as LibraryExecutionRequest;

    // Check user-specific concurrency
    const userConcurrency = await this.checkConcurrencyLimits(tenantId, request.userId, config);
    if (!userConcurrency.allowed) {
      return 0;
    }

    // Remove from queue
    await executeStatement(
      `DELETE FROM library_execution_queue WHERE execution_id = $1`,
      [{ name: 'executionId', value: { stringValue: request.executionId } }]
    );

    // Start execution
    await this.startExecution(request, config);

    return 1;
  }

  /**
   * Cancel an execution
   */
  async cancelExecution(executionId: string, tenantId: string, userId: string): Promise<boolean> {
    // First try to remove from queue
    const queueResult = await executeStatement(
      `DELETE FROM library_execution_queue 
       WHERE execution_id = $1 AND tenant_id = $2 AND user_id = $3
       RETURNING execution_id`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    if (queueResult.records && queueResult.records.length > 0) {
      return true; // Removed from queue
    }

    // Try to cancel running execution
    const execResult = await executeStatement(
      `UPDATE library_executions 
       SET status = 'cancelled', completed_at = NOW()
       WHERE execution_id = $1 AND tenant_id = $2 AND user_id = $3 AND status = 'running'
       RETURNING execution_id`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    return !!(execResult.records && execResult.records.length > 0);
  }

  // ============================================================================
  // Queue Status
  // ============================================================================

  async getQueueStatus(tenantId: string): Promise<ExecutionQueueStatus> {
    const result = await executeStatement(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'running') as active,
         COUNT(*) as queue_depth,
         AVG(EXTRACT(EPOCH FROM (NOW() - queued_at))) as avg_wait
       FROM library_execution_queue
       WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.records?.[0] as Record<string, unknown> | undefined;
    const queueDepth = Number(row?.queue_depth) || 0;
    const avgWait = Number(row?.avg_wait) || 0;

    // Get active from executions table
    const activeResult = await executeStatement(
      `SELECT COUNT(*) as active FROM library_executions 
       WHERE tenant_id = $1 AND status = 'running'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    const activeExecutions = Number((activeResult.records?.[0] as Record<string, unknown>)?.active) || 0;

    return {
      tenantId,
      queueDepth,
      activeExecutions,
      avgWaitTimeSeconds: avgWait,
      estimatedWaitSeconds: avgWait * (queueDepth + 1),
      health: queueDepth > 100 ? 'overloaded' : queueDepth > 20 ? 'degraded' : 'healthy',
    };
  }

  // ============================================================================
  // Dashboard
  // ============================================================================

  async getDashboard(tenantId: string): Promise<ExecutionDashboard> {
    const [config, queueStatus, stats, active, recent, topLibraries] = await Promise.all([
      this.getConfig(tenantId),
      this.getQueueStatus(tenantId),
      this.getStats(tenantId),
      this.getActiveExecutions(tenantId),
      this.getRecentExecutions(tenantId),
      this.getTopLibraries(tenantId),
    ]);

    return {
      config,
      stats,
      queueStatus,
      activeExecutions: active,
      recentExecutions: recent,
      topLibraries,
    };
  }

  private async getStats(tenantId: string) {
    const result = await executeStatement(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'completed') as successful,
         COUNT(*) FILTER (WHERE status = 'failed') as failed,
         AVG(duration_ms) as avg_duration,
         COALESCE(SUM(credits_used), 0) as credits_used
       FROM library_executions
       WHERE tenant_id = $1 AND started_at > NOW() - INTERVAL '1 day'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.records?.[0] as Record<string, unknown> | undefined;
    const config = await this.getConfig(tenantId);

    return {
      totalExecutions24h: Number(row?.total) || 0,
      successfulExecutions24h: Number(row?.successful) || 0,
      failedExecutions24h: Number(row?.failed) || 0,
      avgDurationMs: Number(row?.avg_duration) || 0,
      creditsUsed24h: Number(row?.credits_used) || 0,
      creditsRemaining: (config.dailyBudget || Infinity) - (Number(row?.credits_used) || 0),
    };
  }

  private async getActiveExecutions(tenantId: string) {
    const result = await executeStatement(
      `SELECT execution_id, library_id, user_id, status, started_at,
              EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 as duration_ms
       FROM library_executions
       WHERE tenant_id = $1 AND status = 'running'
       ORDER BY started_at DESC
       LIMIT 20`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return (result.records || []).map((row: Record<string, unknown>) => ({
      executionId: row.execution_id as string,
      libraryId: row.library_id as string,
      userId: row.user_id as string,
      status: row.status as ExecutionStatus,
      startedAt: new Date(row.started_at as string),
      durationMs: Number(row.duration_ms) || 0,
    }));
  }

  private async getRecentExecutions(tenantId: string) {
    const result = await executeStatement(
      `SELECT execution_id, library_id, user_id, status, completed_at, duration_ms, credits_used
       FROM library_executions
       WHERE tenant_id = $1 AND status IN ('completed', 'failed')
       ORDER BY completed_at DESC
       LIMIT 20`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return (result.records || []).map((row: Record<string, unknown>) => ({
      executionId: row.execution_id as string,
      libraryId: row.library_id as string,
      userId: row.user_id as string,
      status: row.status as ExecutionStatus,
      completedAt: new Date(row.completed_at as string),
      durationMs: Number(row.duration_ms) || 0,
      creditsUsed: Number(row.credits_used) || 0,
    }));
  }

  private async getTopLibraries(tenantId: string) {
    const result = await executeStatement(
      `SELECT 
         library_id,
         COUNT(*) as execution_count,
         AVG(duration_ms) as avg_duration,
         COUNT(*) FILTER (WHERE status = 'completed')::float / NULLIF(COUNT(*), 0) as success_rate
       FROM library_executions
       WHERE tenant_id = $1 AND started_at > NOW() - INTERVAL '7 days'
       GROUP BY library_id
       ORDER BY execution_count DESC
       LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return (result.records || []).map((row: Record<string, unknown>) => ({
      libraryId: row.library_id as string,
      executionCount: Number(row.execution_count) || 0,
      avgDurationMs: Number(row.avg_duration) || 0,
      successRate: Number(row.success_rate) || 0,
    }));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private calculateBilling(durationMs: number, constraintsJson: string): ExecutionBilling {
    const constraints = JSON.parse(constraintsJson);
    const durationSeconds = durationMs / 1000;
    const memoryMb = constraints.maxMemoryMb || 512;

    const computeCredits = durationSeconds * 0.001;
    const memoryCredits = (memoryMb / 1024) * durationSeconds * 0.0001;
    const totalCredits = Math.max(computeCredits + memoryCredits, 0.01);

    return {
      computeUnits: Math.ceil(durationSeconds),
      creditsUsed: totalCredits,
      pricingTier: 'standard',
    };
  }

  private mapConfig(row: Record<string, unknown>): TenantExecutionConfig {
    return {
      tenantId: row.tenant_id as string,
      executionEnabled: row.execution_enabled as boolean,
      maxConcurrentExecutions: Number(row.max_concurrent_executions),
      maxConcurrentPerUser: Number(row.max_concurrent_per_user),
      defaultConstraints: JSON.parse(row.default_constraints as string),
      libraryOverrides: row.library_overrides ? JSON.parse(row.library_overrides as string) : undefined,
      dailyBudget: row.daily_budget ? Number(row.daily_budget) : undefined,
      monthlyBudget: row.monthly_budget ? Number(row.monthly_budget) : undefined,
      allowedExecutionTypes: JSON.parse(row.allowed_execution_types as string),
      blockedLibraries: JSON.parse(row.blocked_libraries as string),
      priorityBoost: Number(row.priority_boost) || 0,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const libraryExecutorService = new LibraryExecutorService();
