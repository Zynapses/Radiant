// RADIANT v4.18.0 - Result Derivation History API Handler
// API endpoints for viewing comprehensive result derivation history in Think Tank

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { resultDerivationService } from '../shared/services/result-derivation.service';
import { logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Helper Functions
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json',
};

const success = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const error = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

const getTenantId = (event: { requestContext?: { authorizer?: { tenantId?: string } | null } }): string => {
  return event.requestContext?.authorizer?.tenantId || '';
};

const getUserId = (event: { requestContext?: { authorizer?: { userId?: string } | null } }): string => {
  return event.requestContext?.authorizer?.userId || '';
};

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/thinktank/derivation/:id
 * Get full derivation history for a specific result
 */
export const getDerivation: APIGatewayProxyHandler = async (event) => {
  try {
    const derivationId = event.pathParameters?.id;
    if (!derivationId) {
      return error(400, 'Derivation ID required');
    }
    
    const derivation = await resultDerivationService.getDerivation(derivationId);
    if (!derivation) {
      return error(404, 'Derivation not found');
    }
    
    return success({
      derivation,
      _links: {
        timeline: `/api/thinktank/derivation/${derivationId}/timeline`,
        analytics: `/api/thinktank/derivation/analytics`,
      },
    });
  } catch (err) {
    logger.error('Error getting derivation:', err);
    return error(500, 'Failed to get derivation');
  }
};

/**
 * GET /api/thinktank/derivation/by-prompt/:promptId
 * Get derivation history by prompt ID
 */
export const getDerivationByPrompt: APIGatewayProxyHandler = async (event) => {
  try {
    const promptId = event.pathParameters?.promptId;
    if (!promptId) {
      return error(400, 'Prompt ID required');
    }
    
    const derivation = await resultDerivationService.getDerivationByPromptId(promptId);
    if (!derivation) {
      return error(404, 'Derivation not found for this prompt');
    }
    
    return success({ derivation });
  } catch (err) {
    logger.error('Error getting derivation by prompt:', err);
    return error(500, 'Failed to get derivation');
  }
};

/**
 * GET /api/thinktank/derivation/:id/timeline
 * Get timeline visualization data for a derivation
 */
export const getDerivationTimeline: APIGatewayProxyHandler = async (event) => {
  try {
    const derivationId = event.pathParameters?.id;
    if (!derivationId) {
      return error(400, 'Derivation ID required');
    }
    
    const timeline = await resultDerivationService.getDerivationTimeline(derivationId);
    
    return success({ timeline });
  } catch (err) {
    logger.error('Error getting derivation timeline:', err);
    return error(500, 'Failed to get timeline');
  }
};

/**
 * GET /api/thinktank/derivation/session/:sessionId
 * List all derivations for a session
 */
export const listSessionDerivations: APIGatewayProxyHandler = async (event) => {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return error(400, 'Session ID required');
    }
    
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    
    const derivations = await resultDerivationService.listDerivations({
      sessionId,
      limit,
      offset,
    });
    
    return success({
      derivations,
      pagination: {
        limit,
        offset,
        hasMore: derivations.length === limit,
      },
    });
  } catch (err) {
    logger.error('Error listing session derivations:', err);
    return error(500, 'Failed to list derivations');
  }
};

/**
 * GET /api/thinktank/derivation/user
 * List derivations for the current user
 */
export const listUserDerivations: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) {
      return error(401, 'User not authenticated');
    }
    
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const startDate = event.queryStringParameters?.startDate 
      ? new Date(event.queryStringParameters.startDate) 
      : undefined;
    const endDate = event.queryStringParameters?.endDate 
      ? new Date(event.queryStringParameters.endDate) 
      : undefined;
    
    const derivations = await resultDerivationService.listDerivations({
      userId,
      limit,
      offset,
      startDate,
      endDate,
    });
    
    return success({
      derivations,
      pagination: {
        limit,
        offset,
        hasMore: derivations.length === limit,
      },
    });
  } catch (err) {
    logger.error('Error listing user derivations:', err);
    return error(500, 'Failed to list derivations');
  }
};

/**
 * GET /api/thinktank/derivation/analytics
 * Get derivation analytics for the tenant
 */
export const getDerivationAnalytics: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return error(401, 'Tenant not authenticated');
    }
    
    // Default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    if (event.queryStringParameters?.startDate) {
      startDate.setTime(new Date(event.queryStringParameters.startDate).getTime());
    }
    if (event.queryStringParameters?.endDate) {
      endDate.setTime(new Date(event.queryStringParameters.endDate).getTime());
    }
    
    const analytics = await resultDerivationService.getAnalytics(tenantId, startDate, endDate);
    
    return success({
      analytics,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (err) {
    logger.error('Error getting derivation analytics:', err);
    return error(500, 'Failed to get analytics');
  }
};

/**
 * GET /api/thinktank/derivation/:id/models
 * Get detailed model usage for a derivation
 */
export const getDerivationModels: APIGatewayProxyHandler = async (event) => {
  try {
    const derivationId = event.pathParameters?.id;
    if (!derivationId) {
      return error(400, 'Derivation ID required');
    }
    
    const derivation = await resultDerivationService.getDerivation(derivationId);
    if (!derivation) {
      return error(404, 'Derivation not found');
    }
    
    // Extract and enrich model usage data
    const modelUsage = derivation.modelsUsed.map(usage => ({
      ...usage,
      costBreakdown: {
        input: usage.inputCost,
        output: usage.outputCost,
        total: usage.totalCost,
      },
      tokenBreakdown: {
        input: usage.inputTokens,
        output: usage.outputTokens,
        total: usage.totalTokens,
      },
    }));
    
    // Calculate totals
    const totals = {
      totalModels: modelUsage.length,
      totalTokens: modelUsage.reduce((sum, m) => sum + m.totalTokens, 0),
      totalCost: modelUsage.reduce((sum, m) => sum + m.totalCost, 0),
      totalLatency: modelUsage.reduce((sum, m) => sum + m.latencyMs, 0),
    };
    
    // Group by provider
    const byProvider = {
      selfHosted: modelUsage.filter(m => m.provider === 'self-hosted'),
      external: modelUsage.filter(m => m.provider === 'external'),
    };
    
    return success({
      modelUsage,
      totals,
      byProvider,
    });
  } catch (err) {
    logger.error('Error getting derivation models:', err);
    return error(500, 'Failed to get model usage');
  }
};

/**
 * GET /api/thinktank/derivation/:id/steps
 * Get step-by-step execution details
 */
export const getDerivationSteps: APIGatewayProxyHandler = async (event) => {
  try {
    const derivationId = event.pathParameters?.id;
    if (!derivationId) {
      return error(400, 'Derivation ID required');
    }
    
    const derivation = await resultDerivationService.getDerivation(derivationId);
    if (!derivation) {
      return error(404, 'Derivation not found');
    }
    
    const steps = derivation.plan.steps.map(step => ({
      ...step,
      timing: {
        started: step.startedAt,
        completed: step.completedAt,
        duration: step.durationMs,
      },
      model: step.modelId ? {
        id: step.modelId,
        name: step.modelDisplayName,
      } : null,
    }));
    
    // Calculate step statistics
    const stats = {
      totalSteps: steps.length,
      completedSteps: steps.filter(s => s.status === 'completed').length,
      failedSteps: steps.filter(s => s.status === 'failed').length,
      skippedSteps: steps.filter(s => s.status === 'skipped').length,
      totalDuration: steps.reduce((sum, s) => sum + (s.durationMs || 0), 0),
    };
    
    return success({
      mode: derivation.plan.mode,
      modeDescription: derivation.plan.modeDescription,
      steps,
      stats,
    });
  } catch (err) {
    logger.error('Error getting derivation steps:', err);
    return error(500, 'Failed to get steps');
  }
};

/**
 * GET /api/thinktank/derivation/:id/quality
 * Get quality metrics and verification details
 */
export const getDerivationQuality: APIGatewayProxyHandler = async (event) => {
  try {
    const derivationId = event.pathParameters?.id;
    if (!derivationId) {
      return error(400, 'Derivation ID required');
    }
    
    const derivation = await resultDerivationService.getDerivation(derivationId);
    if (!derivation) {
      return error(404, 'Derivation not found');
    }
    
    return success({
      quality: derivation.qualityMetrics,
      domain: {
        field: derivation.domainDetection.detectedField,
        domain: derivation.domainDetection.detectedDomain,
        subspecialty: derivation.domainDetection.detectedSubspecialty,
        confidence: derivation.domainDetection.domainConfidence,
      },
      orchestration: {
        mode: derivation.orchestration.selectedMode,
        reason: derivation.orchestration.modeSelectionReason,
        complexity: derivation.orchestration.complexityScore,
        strategy: derivation.orchestration.modelSelectionStrategy,
      },
    });
  } catch (err) {
    logger.error('Error getting derivation quality:', err);
    return error(500, 'Failed to get quality metrics');
  }
};

// ============================================================================
// Main Handler - Routes requests to appropriate function
// ============================================================================
export const handler = async (event: Parameters<APIGatewayProxyHandler>[0]): Promise<APIGatewayProxyResult> => {
  const path = event.path;
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (path.includes('/quality') && method === 'GET') {
    return getDerivationQuality(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.includes('/timeline') && method === 'GET') {
    return getDerivationTimeline(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.includes('/sources') && method === 'GET') {
    return getDerivationSteps(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.includes('/models') && method === 'GET') {
    return getDerivationModels(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.includes('/compare') && method === 'POST') {
    return (resultDerivationService as any).compareDerivations(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.match(/\/[^/]+$/) && method === 'GET') {
    return getDerivation(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'GET') {
    return listUserDerivations(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }

  return error(404, 'Not found');
};
