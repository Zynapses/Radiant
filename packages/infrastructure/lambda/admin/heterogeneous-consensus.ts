// RADIANT v7.11.0 - Heterogeneous Model Consensus Admin API
//
// Admin endpoints for managing the cross-model consensus system.
// Provides dashboard data, configuration, evaluation history,
// model leaderboard, and test endpoints.
//
// Base path: /api/admin/consensus
//
// Endpoints:
//   GET    /dashboard              - Full dashboard (config + metrics + evaluations + leaderboard)
//   GET    /config                 - Get current configuration
//   PUT    /config                 - Update configuration
//   GET    /metrics                - Get consensus performance metrics
//   GET    /evaluations            - Get recent consensus evaluations
//   GET    /evaluations/:id        - Get a specific evaluation with full detail
//   GET    /leaderboard            - Get model win-rate leaderboard
//   POST   /evaluate               - Run a test consensus evaluation
//   GET    /panel                  - Get the current default panel of models

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { heterogeneousConsensusService } from '../shared/services/heterogeneous-consensus.service';

function getTenantId(event: APIGatewayProxyEvent): string {
  return event.requestContext?.authorizer?.tenantId
    || event.headers?.['x-tenant-id']
    || '';
}

function getAdminUserId(event: APIGatewayProxyEvent): string {
  return event.requestContext?.authorizer?.userId
    || event.headers?.['x-user-id']
    || 'admin';
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  if (!tenantId) {
    return jsonResponse(401, { error: 'Missing tenant ID' });
  }

  const path = event.path.replace(/^\/api\/admin\/consensus/, '').replace(/\/$/, '') || '/';
  const method = event.httpMethod;

  try {
    // ========================================================================
    // GET /dashboard - Full dashboard data
    // ========================================================================
    if (method === 'GET' && path === '/dashboard') {
      const dashboard = await heterogeneousConsensusService.getDashboard(tenantId);
      return jsonResponse(200, {
        success: true,
        data: dashboard,
      });
    }

    // ========================================================================
    // GET /config - Get current configuration
    // ========================================================================
    if (method === 'GET' && path === '/config') {
      const config = await heterogeneousConsensusService.getConfig(tenantId);
      return jsonResponse(200, {
        success: true,
        data: config,
      });
    }

    // ========================================================================
    // PUT /config - Update configuration
    // Body: Partial<HeterogeneousConsensusConfig>
    // ========================================================================
    if (method === 'PUT' && path === '/config') {
      const body = JSON.parse(event.body || '{}');
      const adminUserId = getAdminUserId(event);
      const config = await heterogeneousConsensusService.updateConfig(tenantId, body, adminUserId);
      return jsonResponse(200, {
        success: true,
        data: config,
        message: 'Consensus configuration updated',
      });
    }

    // ========================================================================
    // GET /metrics - Get consensus performance metrics
    // ========================================================================
    if (method === 'GET' && path === '/metrics') {
      const metrics = await heterogeneousConsensusService.getMetrics(tenantId);
      return jsonResponse(200, {
        success: true,
        data: metrics,
      });
    }

    // ========================================================================
    // GET /evaluations - Get recent consensus evaluations
    // Query params: limit (default: 20)
    // ========================================================================
    if (method === 'GET' && path === '/evaluations') {
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      const evaluations = await heterogeneousConsensusService.getRecentEvaluations(tenantId, limit);
      return jsonResponse(200, {
        success: true,
        data: evaluations,
        count: evaluations.length,
      });
    }

    // ========================================================================
    // POST /evaluate - Run a test consensus evaluation
    // Body: { prompt: string, systemPrompt?: string, taskType?: string,
    //         forceModels?: string[], temperature?: number, maxTokens?: number }
    // ========================================================================
    if (method === 'POST' && path === '/evaluate') {
      const body = JSON.parse(event.body || '{}');
      if (!body.prompt) {
        return jsonResponse(400, { error: 'prompt is required' });
      }

      const result = await heterogeneousConsensusService.evaluate({
        tenantId,
        userId: getAdminUserId(event),
        prompt: body.prompt,
        systemPrompt: body.systemPrompt,
        taskType: body.taskType,
        forceModels: body.forceModels,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
      });

      return jsonResponse(200, {
        success: true,
        data: {
          consensusId: result.consensusId,
          winningResponse: result.winningResponse,
          winningModel: result.winningModel,
          winningProvider: result.winningProvider,
          overallAgreement: result.overallAgreement,
          crossProviderAgreement: result.crossProviderAgreement,
          confidence: result.confidence,
          hallucinationRisk: result.hallucinationRisk,
          triggerReflexion: result.triggerReflexion,
          reflexionReason: result.reflexionReason,
          participantCount: result.participantCount,
          providerCount: result.providerCount,
          agreementCount: result.agreementCount,
          dissentingModels: result.dissentingModels,
          totalCostUsd: result.totalCostUsd,
          totalLatencyMs: result.totalLatencyMs,
          responses: result.responses.map(r => ({
            modelId: r.participant.modelId,
            provider: r.participant.provider,
            extractedAnswer: r.extractedAnswer,
            success: r.success,
            latencyMs: r.latencyMs,
            costUsd: r.costUsd,
          })),
          pairwiseAgreements: result.pairwiseAgreements.map(a => ({
            modelA: a.modelA,
            modelB: a.modelB,
            similarity: a.semanticSimilarity,
            crossProvider: a.crossProvider,
            exactMatch: a.exactMatch,
          })),
        },
      });
    }

    return jsonResponse(404, { error: `Unknown endpoint: ${method} ${path}` });
  } catch (error) {
    console.error('Consensus admin error:', error);
    return jsonResponse(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
