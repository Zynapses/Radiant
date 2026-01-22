/**
 * RADIANT v5.44.0 - Living Parchment Lambda Handler
 * API endpoints for all Living Parchment 2029 Vision features
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { warRoomService } from '../shared/services/living-parchment/war-room.service';
import { councilOfExpertsService } from '../shared/services/living-parchment/council-of-experts.service';
import { debateArenaService } from '../shared/services/living-parchment/debate-arena.service';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
};

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers, body: JSON.stringify(body) };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'] 
    || event.headers['X-Tenant-Id'] || '';
  const userId = event.requestContext.authorizer?.claims?.sub || '';
  const path = event.path;
  const method = event.httpMethod;

  try {
    // =========================================================================
    // WAR ROOM ENDPOINTS
    // =========================================================================

    // List war room sessions
    if (method === 'GET' && path === '/api/thinktank/living-parchment/war-room') {
      const status = event.queryStringParameters?.status;
      const stakeLevel = event.queryStringParameters?.stakeLevel;
      const sessions = await warRoomService.listSessions(tenantId, { status, stakeLevel });
      return response(200, { sessions });
    }

    // Create war room session
    if (method === 'POST' && path === '/api/thinktank/living-parchment/war-room') {
      const body = JSON.parse(event.body || '{}');
      const session = await warRoomService.createSession(tenantId, userId, body);
      return response(201, { session });
    }

    // Get war room session
    if (method === 'GET' && path.match(/\/api\/thinktank\/living-parchment\/war-room\/[^/]+$/)) {
      const sessionId = path.split('/').pop()!;
      const session = await warRoomService.getSession(tenantId, sessionId);
      return response(200, { session });
    }

    // Add advisor to war room
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/war-room\/[^/]+\/advisors$/)) {
      const sessionId = path.split('/')[5];
      const body = JSON.parse(event.body || '{}');
      const advisor = await warRoomService.addAdvisor(sessionId, body);
      return response(201, { advisor });
    }

    // Request advisor analysis
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/war-room\/[^/]+\/advisors\/[^/]+\/analyze$/)) {
      const parts = path.split('/');
      const sessionId = parts[5];
      const advisorId = parts[7];
      const body = JSON.parse(event.body || '{}');
      const analysis = await warRoomService.requestAdvisorAnalysis(tenantId, sessionId, advisorId, body.context);
      return response(200, { analysis });
    }

    // Propose decision path
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/war-room\/[^/]+\/paths$/)) {
      const sessionId = path.split('/')[5];
      const body = JSON.parse(event.body || '{}');
      const decisionPath = await warRoomService.proposeDecisionPath(tenantId, sessionId, body);
      return response(201, { path: decisionPath });
    }

    // Make decision
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/war-room\/[^/]+\/decide$/)) {
      const sessionId = path.split('/')[5];
      const body = JSON.parse(event.body || '{}');
      await warRoomService.makeDecision(tenantId, sessionId, userId, body.pathId, body.rationale);
      return response(200, { success: true });
    }

    // Update terrain
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/war-room\/[^/]+\/terrain$/)) {
      const sessionId = path.split('/')[5];
      const terrain = await warRoomService.updateTerrain(tenantId, sessionId);
      return response(200, { terrain });
    }

    // =========================================================================
    // COUNCIL OF EXPERTS ENDPOINTS
    // =========================================================================

    // Convene council
    if (method === 'POST' && path === '/api/thinktank/living-parchment/council') {
      const body = JSON.parse(event.body || '{}');
      const session = await councilOfExpertsService.conveneCouncil(tenantId, userId, body);
      return response(201, { session });
    }

    // Get council session
    if (method === 'GET' && path.match(/\/api\/thinktank\/living-parchment\/council\/[^/]+$/)) {
      const sessionId = path.split('/').pop()!;
      const session = await councilOfExpertsService.getSession(tenantId, sessionId);
      return response(200, { session });
    }

    // Run debate round
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/council\/[^/]+\/debate$/)) {
      const sessionId = path.split('/')[5];
      await councilOfExpertsService.runDebateRound(tenantId, sessionId);
      const session = await councilOfExpertsService.getSession(tenantId, sessionId);
      return response(200, { session });
    }

    // Conclude council
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/council\/[^/]+\/conclude$/)) {
      const sessionId = path.split('/')[5];
      const conclusion = await councilOfExpertsService.concludeSession(tenantId, sessionId);
      return response(200, { conclusion });
    }

    // =========================================================================
    // DEBATE ARENA ENDPOINTS
    // =========================================================================

    // Create debate
    if (method === 'POST' && path === '/api/thinktank/living-parchment/debate') {
      const body = JSON.parse(event.body || '{}');
      const arena = await debateArenaService.createDebate(tenantId, userId, body);
      return response(201, { arena });
    }

    // Get debate arena
    if (method === 'GET' && path.match(/\/api\/thinktank\/living-parchment\/debate\/[^/]+$/)) {
      const arenaId = path.split('/').pop()!;
      const arena = await debateArenaService.getArena(tenantId, arenaId);
      return response(200, { arena });
    }

    // Run debate round
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/debate\/[^/]+\/round$/)) {
      const arenaId = path.split('/')[5];
      await debateArenaService.runRound(tenantId, arenaId);
      const arena = await debateArenaService.getArena(tenantId, arenaId);
      return response(200, { arena });
    }

    // Generate steel-man
    if (method === 'POST' && path.match(/\/api\/thinktank\/living-parchment\/debate\/[^/]+\/steel-man$/)) {
      const arenaId = path.split('/')[5];
      const body = JSON.parse(event.body || '{}');
      const steelMan = await debateArenaService.generateSteelMan(tenantId, arenaId, body.argumentId);
      return response(200, { steelMan });
    }

    // =========================================================================
    // DASHBOARD ENDPOINT
    // =========================================================================

    if (method === 'GET' && path === '/api/thinktank/living-parchment/dashboard') {
      // Aggregate metrics from all features
      const dashboard = {
        warRooms: {
          active: 0,
          decided: 0,
          averageConfidence: 0,
        },
        councilOfExperts: {
          activeSessions: 0,
          averageConsensus: 0,
          minorityReports: 0,
        },
        debateArena: {
          activeDebates: 0,
          resolvedDebates: 0,
          averageResolutionRounds: 0,
        },
        memoryPalace: {
          totalNodes: 0,
          freshPercentage: 100,
          discoveryHotspots: 0,
        },
        oracleView: {
          activePredictions: 0,
          blackSwanAlerts: 0,
          averageConfidenceDecay: 0,
        },
        synthesisEngine: {
          activeSessions: 0,
          tensionZones: 0,
          resolutionRate: 0,
        },
        cognitiveLoad: {
          averageLoad: 0,
          overwhelmAlerts: 0,
          adaptationsApplied: 0,
        },
        temporalDrift: {
          monitoredFacts: 0,
          driftAlerts: 0,
          averageStability: 100,
        },
      };

      return response(200, { dashboard });
    }

    // =========================================================================
    // CONFIG ENDPOINT
    // =========================================================================

    if (method === 'GET' && path === '/api/thinktank/living-parchment/config') {
      // Return tenant configuration
      const config = {
        features: {
          warRoomEnabled: true,
          memoryPalaceEnabled: true,
          oracleViewEnabled: true,
          synthesisEngineEnabled: true,
          cognitiveLoadEnabled: true,
          councilOfExpertsEnabled: true,
          temporalDriftEnabled: true,
          debateArenaEnabled: true,
        },
        defaults: {
          breathingRateBase: 6,
          confidenceThreshold: 70,
          stalenessThresholdDays: 30,
          maxAdvisors: 10,
          maxExperts: 8,
          maxDebateRounds: 5,
        },
        visualSettings: {
          heatmapColorScheme: 'standard',
          animationIntensity: 'normal',
          ghostOpacity: 0.5,
        },
      };

      return response(200, { config });
    }

    // Not found
    return response(404, { error: 'Endpoint not found', path, method });

  } catch (error) {
    console.error('Living Parchment error:', error);
    return response(500, { 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};
