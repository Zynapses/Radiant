/**
 * RADIANT v4.18.56 - Metrics Middleware
 * Automatically records metrics for AI endpoints
 * Wraps handler functions to capture billing, performance, and failure metrics
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Pool } from 'pg';
import type { FailureType, ViolationType, ViolationAction } from '@radiant/shared';
import { MetricsCollectionService } from '../services/metrics-collection.service';
import { LearningInfluenceService } from '../services/learning-hierarchy.service';
import { initializeLearningService } from '../services/cognitive-router.service';
import { logger } from '../logging/enhanced-logger';

let pool: Pool | null = null;
let metricsService: MetricsCollectionService | null = null;
let learningService: LearningInfluenceService | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
    
    // Initialize services
    metricsService = new MetricsCollectionService(pool);
    learningService = new LearningInfluenceService(pool);
    initializeLearningService(pool);
  }
  return pool;
}

export interface MetricsContext {
  tenantId: string;
  userId?: string;
  modelId?: string;
  providerId?: string;
  endpoint: string;
  method: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  learningDecisionId?: string;
}

export interface MetricsResult {
  billingMetricId?: string;
  performanceMetricId?: string;
  failureEventId?: string;
}

type HandlerFunction = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

/**
 * Wrap an API handler to automatically record metrics
 */
export function withMetrics(handler: HandlerFunction): HandlerFunction {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();
    const pool = getPool();
    
    // Set tenant context for RLS
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    
    if (tenantId) {
      await pool.query(`SET app.current_tenant_id = '${tenantId}'`);
    }

    const metricsContext: MetricsContext = {
      tenantId: tenantId || 'unknown',
      userId,
      endpoint: event.path,
      method: event.httpMethod,
    };

    let result: APIGatewayProxyResult;
    let success = true;
    let errorType: string | undefined;
    let errorMessage: string | undefined;

    try {
      // Call the actual handler
      result = await handler(event, context);
      
      // Check if response indicates failure
      if (result.statusCode >= 400) {
        success = false;
        const body = JSON.parse(result.body || '{}');
        errorType = result.statusCode >= 500 ? 'internal_error' : 'validation_error';
        errorMessage = body.error || body.message || 'Unknown error';
      }

      // Extract metrics from response body if available
      try {
        const body = JSON.parse(result.body || '{}');
        if (body.usage) {
          metricsContext.inputTokens = body.usage.prompt_tokens;
          metricsContext.outputTokens = body.usage.completion_tokens;
        }
        if (body.model) {
          metricsContext.modelId = body.model;
        }
        if (body.learningDecisionId) {
          metricsContext.learningDecisionId = body.learningDecisionId;
        }
      } catch {
        // Response body parsing failed, continue without
      }

    } catch (error) {
      success = false;
      errorType = 'internal_error';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      result = {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }

    const latencyMs = Date.now() - startTime;

    // Record metrics asynchronously (don't block response)
    recordMetricsAsync(metricsContext, latencyMs, success, errorType, errorMessage).catch((err) => {
      logger.error('Failed to record metrics:', err);
    });

    return result;
  };
}

async function recordMetricsAsync(
  ctx: MetricsContext,
  latencyMs: number,
  success: boolean,
  errorType?: string,
  errorMessage?: string
): Promise<void> {
  if (!metricsService) return;

  try {
    // Record performance metrics
    await metricsService.recordPerformanceMetric({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      endpoint: ctx.endpoint,
      method: ctx.method,
      modelId: ctx.modelId,
      providerId: ctx.providerId,
      totalLatencyMs: latencyMs,
      statusCode: success ? 200 : 500,
      success,
    });

    // Record billing metrics if tokens were used
    if (ctx.inputTokens || ctx.outputTokens) {
      await metricsService.recordBillingMetric({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        modelId: ctx.modelId,
        providerId: ctx.providerId,
        inputTokens: ctx.inputTokens,
        outputTokens: ctx.outputTokens,
        costCents: ctx.costCents,
        success,
      });
    }

    // Record failure if not successful
    if (!success && errorType) {
      await metricsService.recordFailure({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        failureType: errorType as FailureType,
        severity: errorType === 'internal_error' ? 'high' : 'low',
        endpoint: ctx.endpoint,
        modelId: ctx.modelId,
        providerId: ctx.providerId,
        errorMessage,
      });
    }

    // Record learning outcome if we have a decision ID
    if (ctx.learningDecisionId && learningService) {
      await learningService.recordDecisionOutcome(
        ctx.learningDecisionId,
        success,
        ctx.tenantId
      );
    }

  } catch (error) {
    logger.error('Error recording metrics:', error);
  }
}

/**
 * Manual metrics recording for use within handlers
 */
export async function recordBillingMetric(
  tenantId: string,
  userId: string | undefined,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  costCents?: number
): Promise<string | undefined> {
  getPool(); // Ensure initialized
  if (!metricsService) return undefined;
  
  return metricsService.recordBillingMetric({
    tenantId,
    userId,
    modelId,
    inputTokens,
    outputTokens,
    costCents,
    success: true,
  });
}

/**
 * Record a failure event manually
 */
export async function recordFailure(
  tenantId: string,
  userId: string | undefined,
  failureType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  errorMessage: string,
  modelId?: string,
  endpoint?: string
): Promise<string | undefined> {
  getPool(); // Ensure initialized
  if (!metricsService) return undefined;
  
  return metricsService.recordFailure({
    tenantId,
    userId,
    failureType: failureType as FailureType,
    severity,
    errorMessage,
    modelId,
    endpoint,
  });
}

/**
 * Record a prompt violation
 */
export async function recordViolation(
  tenantId: string,
  userId: string,
  violationType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  promptSnippet?: string,
  actionTaken?: string
): Promise<string | undefined> {
  getPool(); // Ensure initialized
  if (!metricsService) return undefined;
  
  return metricsService.recordViolation({
    tenantId,
    userId,
    violationType: violationType as ViolationType,
    severity,
    promptSnippet,
    actionTaken: actionTaken as ViolationAction,
    detectionMethod: 'content_filter',
  });
}

/**
 * Log a system event
 */
export async function logSystem(
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  logSource: string,
  message: string,
  data?: Record<string, unknown>,
  tenantId?: string
): Promise<string | undefined> {
  getPool(); // Ensure initialized
  if (!metricsService) return undefined;
  
  return metricsService.log({
    tenantId,
    logLevel,
    logSource,
    message,
    data,
  });
}
