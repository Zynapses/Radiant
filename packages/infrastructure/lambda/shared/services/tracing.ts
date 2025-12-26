/**
 * OpenTelemetry Tracing Integration
 * 
 * Provides distributed tracing for RADIANT services
 */

import { Context, Span, SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('radiant', '4.18.0');

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

/**
 * Create a new span for an operation
 */
export function startSpan(
  name: string,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
    parent?: Context;
  }
): Span {
  const spanOptions = {
    kind: options?.kind ?? SpanKind.INTERNAL,
    attributes: options?.attributes,
  };

  if (options?.parent) {
    return tracer.startSpan(name, spanOptions, options.parent);
  }

  return tracer.startSpan(name, spanOptions);
}

/**
 * Execute a function within a traced span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const span = startSpan(name, options);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = trace.getSpan(context.active());
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Record an event on the current span
 */
export function recordSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = trace.getSpan(context.active());
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set an error on the current span
 */
export function recordSpanError(error: Error): void {
  const span = trace.getSpan(context.active());
  if (span) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
  }
}

/**
 * Get the current trace context
 */
export function getTraceContext(): TraceContext | null {
  const span = trace.getSpan(context.active());
  if (!span) return null;

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

/**
 * Create trace context from headers
 */
export function extractTraceContext(headers: Record<string, string>): Context {
  // W3C Trace Context format
  const traceparent = headers['traceparent'] || headers['Traceparent'];
  
  if (!traceparent) {
    return context.active();
  }

  // Parse traceparent: version-traceId-spanId-flags
  const parts = traceparent.split('-');
  if (parts.length !== 4) {
    return context.active();
  }

  // Create span context from headers
  // This would use the W3C propagator in a full implementation
  return context.active();
}

/**
 * Inject trace context into headers
 */
export function injectTraceContext(headers: Record<string, string>): Record<string, string> {
  const span = trace.getSpan(context.active());
  if (!span) return headers;

  const spanContext = span.spanContext();
  const traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-01`;

  return {
    ...headers,
    traceparent,
  };
}

/**
 * Decorator for tracing Lambda handlers
 */
export function tracedHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  handler: T
): T {
  return (async (...args: unknown[]) => {
    return withSpan(
      name,
      async (span) => {
        span.setAttribute('faas.name', name);
        span.setAttribute('faas.trigger', 'http');
        return handler(...args);
      },
      { kind: SpanKind.SERVER }
    );
  }) as T;
}

/**
 * Trace an HTTP request
 */
export async function traceHttpRequest<T>(
  url: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `HTTP ${method}`,
    async (span) => {
      span.setAttribute('http.method', method);
      span.setAttribute('http.url', url);
      
      try {
        const result = await fn();
        span.setAttribute('http.status_code', 200);
        return result;
      } catch (error) {
        span.setAttribute('http.status_code', 500);
        throw error;
      }
    },
    { kind: SpanKind.CLIENT }
  );
}

/**
 * Trace a database query
 */
export async function traceDbQuery<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `DB ${operation}`,
    async (span) => {
      span.setAttribute('db.system', 'postgresql');
      span.setAttribute('db.operation', operation);
      span.setAttribute('db.sql.table', table);
      return fn();
    },
    { kind: SpanKind.CLIENT }
  );
}

/**
 * Trace an AI model call
 */
export async function traceAiCall<T>(
  model: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `AI ${operation}`,
    async (span) => {
      span.setAttribute('ai.model', model);
      span.setAttribute('ai.operation', operation);
      return fn();
    },
    { kind: SpanKind.CLIENT }
  );
}
