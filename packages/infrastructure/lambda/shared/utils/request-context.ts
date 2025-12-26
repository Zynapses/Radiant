/**
 * RADIANT v4.18.0 - Request Context Management
 * 
 * Provides request ID propagation and context management across the application.
 * Uses AsyncLocalStorage for safe context propagation in async operations.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
  appId?: string;
  sessionId?: string;
  correlationId?: string;
  startTime: number;
  metadata: Record<string, unknown>;
}

// AsyncLocalStorage for context propagation
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// Header names (configurable via environment)
const REQUEST_ID_HEADER = process.env.REQUEST_ID_HEADER || 'x-request-id';
const CORRELATION_ID_HEADER = process.env.CORRELATION_ID_HEADER || 'x-correlation-id';
const TENANT_ID_HEADER = process.env.TENANT_ID_HEADER || 'x-tenant-id';

/**
 * Create a new request context
 */
export function createRequestContext(options?: Partial<RequestContext>): RequestContext {
  return {
    requestId: options?.requestId || randomUUID(),
    tenantId: options?.tenantId,
    userId: options?.userId,
    appId: options?.appId || process.env.APP_ID,
    sessionId: options?.sessionId,
    correlationId: options?.correlationId,
    startTime: options?.startTime || Date.now(),
    metadata: options?.metadata || {},
  };
}

/**
 * Get current request context from AsyncLocalStorage
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get request ID from current context
 */
export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}

/**
 * Get tenant ID from current context
 */
export function getTenantId(): string | undefined {
  return getRequestContext()?.tenantId;
}

/**
 * Get user ID from current context
 */
export function getUserId(): string | undefined {
  return getRequestContext()?.userId;
}

/**
 * Get request duration from context
 */
export function getRequestDuration(): number {
  const ctx = getRequestContext();
  return ctx ? Date.now() - ctx.startTime : 0;
}

/**
 * Run a function with request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Run an async function with request context
 */
export async function runWithContextAsync<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Update current context
 */
export function updateContext(updates: Partial<RequestContext>): void {
  const ctx = getRequestContext();
  if (ctx) {
    Object.assign(ctx, updates);
  }
}

/**
 * Add metadata to current context
 */
export function addContextMetadata(key: string, value: unknown): void {
  const ctx = getRequestContext();
  if (ctx) {
    ctx.metadata[key] = value;
  }
}

/**
 * Extract request context from API Gateway event headers
 */
export function extractContextFromHeaders(
  headers: Record<string, string | undefined>
): Partial<RequestContext> {
  const normalizedHeaders: Record<string, string | undefined> = {};
  
  // Normalize header names to lowercase
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  return {
    requestId: normalizedHeaders[REQUEST_ID_HEADER.toLowerCase()] || randomUUID(),
    correlationId: normalizedHeaders[CORRELATION_ID_HEADER.toLowerCase()],
    tenantId: normalizedHeaders[TENANT_ID_HEADER.toLowerCase()],
  };
}

/**
 * Create headers to propagate context to downstream services
 */
export function createContextHeaders(): Record<string, string> {
  const ctx = getRequestContext();
  if (!ctx) return {};

  const headers: Record<string, string> = {
    [REQUEST_ID_HEADER]: ctx.requestId,
  };

  if (ctx.correlationId) {
    headers[CORRELATION_ID_HEADER] = ctx.correlationId;
  }
  if (ctx.tenantId) {
    headers[TENANT_ID_HEADER] = ctx.tenantId;
  }

  return headers;
}

/**
 * Middleware wrapper for Lambda handlers
 */
export function withRequestContext<TEvent, TResult>(
  handler: (event: TEvent, context: RequestContext) => Promise<TResult>
): (event: TEvent & { headers?: Record<string, string> }) => Promise<TResult> {
  return async (event) => {
    const extractedContext = event.headers 
      ? extractContextFromHeaders(event.headers)
      : {};
    
    const ctx = createRequestContext(extractedContext);
    
    return runWithContextAsync(ctx, () => handler(event, ctx));
  };
}

/**
 * Get context as loggable object
 */
export function getLoggableContext(): Record<string, unknown> {
  const ctx = getRequestContext();
  if (!ctx) return {};

  return {
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    correlationId: ctx.correlationId,
    durationMs: Date.now() - ctx.startTime,
  };
}

export { REQUEST_ID_HEADER, CORRELATION_ID_HEADER, TENANT_ID_HEADER };
