/**
 * RADIANT v4.18.0 - Logging Registry Service
 *
 * Self-registering logging system that:
 *  1. Auto-registers services on first use via decorator pattern
 *  2. Enforces structured logging on all Lambda handlers
 *  3. Tracks which services are logging and which are not
 *  4. Provides a "force logging" wrapper that ensures every service produces logs
 *  5. Categorizes log output for the retention system
 *
 * Usage:
 *   // In any Lambda handler:
 *   import { createRegisteredLogger } from './services/logging-registry.service';
 *
 *   const logger = createRegisteredLogger({
 *     serviceName: 'billing/metering',
 *     category: 'billing',
 *     sourceType: 'lambda',
 *   });
 *
 *   export async function handler(event, context) {
 *     logger.info('Processing request', { path: event.path });
 *     // ... handler logic ...
 *   }
 *
 *   // Or use the enforced handler wrapper:
 *   import { withEnforcedLogging } from './services/logging-registry.service';
 *
 *   export const handler = withEnforcedLogging(
 *     { serviceName: 'admin/users', category: 'audit' },
 *     async (event, context, logger) => {
 *       logger.info('Admin action', { action: 'list_users' });
 *       return { statusCode: 200, body: '...' };
 *     }
 *   );
 */

import { Pool } from 'pg';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { LogCategory, LogSourceType } from './log-retention-policy.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoggerConfig {
  serviceName: string;
  category: LogCategory;
  sourceType?: LogSourceType;
  cloudwatchLogGroup?: string;
  description?: string;
  tags?: string[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  category: LogCategory;
  message: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  durationMs?: number;
  error?: { name: string; message: string; stack?: string };
  metadata?: Record<string, unknown>;
}

type EnforcedHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  logger: RegisteredLogger
) => Promise<APIGatewayProxyResult>;

// ---------------------------------------------------------------------------
// In-memory registry (per Lambda cold start)
// ---------------------------------------------------------------------------

const registeredServices = new Map<string, { config: LoggerConfig; registeredAt: Date; lastUsedAt: Date }>();

// DB registration is deferred — we register on first log call to avoid blocking cold starts
let dbRegistrationQueue: LoggerConfig[] = [];
let dbPool: Pool | null = null;

export function setLoggingRegistryPool(pool: Pool): void {
  dbPool = pool;
}

// ---------------------------------------------------------------------------
// Registered Logger
// ---------------------------------------------------------------------------

export class RegisteredLogger {
  private config: LoggerConfig;
  private requestId?: string;
  private tenantId?: string;
  private userId?: string;
  private startTime?: number;

  constructor(config: LoggerConfig) {
    this.config = config;

    // Register in-memory
    if (!registeredServices.has(config.serviceName)) {
      registeredServices.set(config.serviceName, {
        config,
        registeredAt: new Date(),
        lastUsedAt: new Date(),
      });
      dbRegistrationQueue.push(config);
    } else {
      registeredServices.get(config.serviceName)!.lastUsedAt = new Date();
    }
  }

  withContext(ctx: { requestId?: string; tenantId?: string; userId?: string }): RegisteredLogger {
    this.requestId = ctx.requestId;
    this.tenantId = ctx.tenantId;
    this.userId = ctx.userId;
    return this;
  }

  startTimer(): void {
    this.startTime = Date.now();
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.emit('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.emit('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.emit('warn', message, metadata);
  }

  error(message: string, err?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorObj = err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : err ? { name: 'Unknown', message: String(err) } : undefined;
    this.emit('error', message, { ...metadata, error: errorObj });
  }

  fatal(message: string, err?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorObj = err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : err ? { name: 'Unknown', message: String(err) } : undefined;
    this.emit('fatal', message, { ...metadata, error: errorObj });
  }

  child(metadata: Record<string, unknown>): RegisteredLogger {
    const child = new RegisteredLogger(this.config);
    child.requestId = this.requestId;
    child.tenantId = this.tenantId;
    child.userId = this.userId;
    child.startTime = this.startTime;
    return child;
  }

  private emit(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.serviceName,
      category: this.config.category,
      message,
      requestId: this.requestId,
      tenantId: this.tenantId,
      userId: this.userId,
      durationMs: this.startTime ? Date.now() - this.startTime : undefined,
      metadata,
    };

    // Extract error from metadata if present
    if (metadata?.error) {
      entry.error = metadata.error as StructuredLogEntry['error'];
      delete entry.metadata?.error;
    }

    // Emit as structured JSON to stdout (CloudWatch picks this up)
    const output = JSON.stringify(entry);
    switch (level) {
      case 'debug': console.debug(output); break;
      case 'info': console.info(output); break;
      case 'warn': console.warn(output); break;
      case 'error': case 'fatal': console.error(output); break;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRegisteredLogger(config: LoggerConfig): RegisteredLogger {
  return new RegisteredLogger(config);
}

// ---------------------------------------------------------------------------
// Enforced Handler Wrapper
// ---------------------------------------------------------------------------

export function withEnforcedLogging(
  config: LoggerConfig,
  handler: EnforcedHandler
): (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult> {
  const logger = createRegisteredLogger(config);

  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const requestId = context.awsRequestId;
    logger.withContext({ requestId });
    logger.startTimer();

    // Extract tenant/user from auth headers if available
    const tenantId = event.headers?.['x-tenant-id'] || event.requestContext?.authorizer?.tenantId as string;
    const userId = event.headers?.['x-user-id'] || event.requestContext?.authorizer?.userId as string;
    if (tenantId) logger.withContext({ requestId, tenantId, userId });

    logger.info('Request started', {
      method: event.httpMethod,
      path: event.path,
      sourceIp: event.requestContext?.identity?.sourceIp,
      userAgent: event.headers?.['User-Agent']?.substring(0, 100),
    });

    try {
      const result = await handler(event, context, logger);

      logger.info('Request completed', {
        statusCode: result.statusCode,
        method: event.httpMethod,
        path: event.path,
      });

      // Flush deferred DB registrations
      await flushRegistrations();

      return result;
    } catch (error) {
      logger.error('Request failed', error, {
        method: event.httpMethod,
        path: event.path,
      });

      // Still try to flush
      await flushRegistrations().catch(() => {});

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Internal Server Error',
          requestId,
        }),
      };
    }
  };
}

// ---------------------------------------------------------------------------
// DB Registration (deferred, non-blocking)
// ---------------------------------------------------------------------------

async function flushRegistrations(): Promise<void> {
  if (dbRegistrationQueue.length === 0 || !dbPool) return;

  const queue = [...dbRegistrationQueue];
  dbRegistrationQueue = [];

  for (const config of queue) {
    try {
      await dbPool.query(
        `INSERT INTO log_source_registry (
          source_name, source_type, category, cloudwatch_log_group,
          is_active, logging_enforced, registered_by, description, tags, last_seen_at
        ) VALUES ($1, $2::log_source_type, $3::log_category, $4, true, true, 'decorator', $5, $6, NOW())
        ON CONFLICT (source_name) DO UPDATE SET
          is_active = true,
          logging_enforced = true,
          last_seen_at = NOW(),
          updated_at = NOW()`,
        [
          config.serviceName,
          config.sourceType || 'application',
          config.category,
          config.cloudwatchLogGroup || null,
          config.description || `Auto-registered service: ${config.serviceName}`,
          JSON.stringify(config.tags || []),
        ]
      );
    } catch {
      // Non-blocking — don't fail the request if registration fails
      dbRegistrationQueue.push(config);
    }
  }
}

// ---------------------------------------------------------------------------
// Audit: Get logging coverage report
// ---------------------------------------------------------------------------

export async function getLoggingCoverageReport(pool: Pool): Promise<{
  totalSources: number;
  enforced: number;
  unenforced: number;
  stale: number;
  byCategory: Record<string, { total: number; enforced: number; unenforced: number }>;
  unenforcedSources: { name: string; category: string; lastSeen: string | null }[];
  staleSources: { name: string; category: string; lastSeen: string | null }[];
}> {
  const result = await pool.query(`SELECT * FROM log_source_registry WHERE is_active = true ORDER BY category, source_name`);
  const sources = result.rows;

  const staleThreshold = new Date(Date.now() - 7 * 86400000); // 7 days
  const byCategory: Record<string, { total: number; enforced: number; unenforced: number }> = {};
  const unenforcedSources: { name: string; category: string; lastSeen: string | null }[] = [];
  const staleSources: { name: string; category: string; lastSeen: string | null }[] = [];

  for (const s of sources) {
    const cat = s.category as string;
    if (!byCategory[cat]) byCategory[cat] = { total: 0, enforced: 0, unenforced: 0 };
    byCategory[cat].total++;

    if (s.logging_enforced) {
      byCategory[cat].enforced++;
    } else {
      byCategory[cat].unenforced++;
      unenforcedSources.push({
        name: s.source_name as string,
        category: cat,
        lastSeen: s.last_seen_at ? (s.last_seen_at as Date).toISOString() : null,
      });
    }

    const lastSeen = s.last_seen_at as Date | null;
    if (!lastSeen || lastSeen < staleThreshold) {
      staleSources.push({
        name: s.source_name as string,
        category: cat,
        lastSeen: lastSeen ? lastSeen.toISOString() : null,
      });
    }
  }

  return {
    totalSources: sources.length,
    enforced: sources.filter((s: Record<string, unknown>) => s.logging_enforced).length,
    unenforced: sources.filter((s: Record<string, unknown>) => !s.logging_enforced).length,
    stale: staleSources.length,
    byCategory,
    unenforcedSources,
    staleSources,
  };
}
