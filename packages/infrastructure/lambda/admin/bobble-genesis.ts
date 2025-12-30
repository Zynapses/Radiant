/**
 * Bobble Genesis Admin API
 * 
 * Admin endpoints for managing Genesis state, developmental gates,
 * circuit breakers, and cost tracking.
 * 
 * See: /docs/bobble/adr/010-genesis-system.md
 */

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logging/enhanced-logger';
import { genesisService } from '../shared/services/bobble/genesis.service';
import { costTrackingService } from '../shared/services/bobble/cost-tracking.service';
import { circuitBreakerService } from '../shared/services/bobble/circuit-breaker.service';
import { queryFallbackService } from '../shared/services/bobble/query-fallback.service';
import { consciousnessLoopService } from '../shared/services/bobble/consciousness-loop.service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

function jsonResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

function isSuperAdmin(event: APIGatewayProxyEvent): boolean {
  const role = event.requestContext?.authorizer?.role || 
               event.headers['x-admin-role'] || 
               'admin';
  return role === 'superadmin';
}

function requireSuperAdmin(event: APIGatewayProxyEvent): void {
  if (!isSuperAdmin(event)) {
    throw new Error('This action requires superadmin role');
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }

  try {
    // Auth is handled by API Gateway authorizer
    // All requests reaching here are authenticated

    const path = event.path.replace('/api/admin/bobble', '');
    const method = event.httpMethod;

    // ========== Genesis State ==========
    if (path === '/genesis/status' && method === 'GET') {
      const state = await genesisService.getGenesisState();
      return jsonResponse(200, state);
    }

    if (path === '/genesis/ready' && method === 'GET') {
      const ready = await genesisService.isReadyForConsciousness();
      return jsonResponse(200, { ready });
    }

    // ========== Developmental Gates ==========
    if (path === '/developmental/status' && method === 'GET') {
      const status = await genesisService.getDevelopmentalGateStatus();
      return jsonResponse(200, status);
    }

    if (path === '/developmental/statistics' && method === 'GET') {
      const stats = await genesisService.getDevelopmentStatistics();
      return jsonResponse(200, stats);
    }

    if (path === '/developmental/advance' && method === 'POST') {
      requireSuperAdmin(event);
      const result = await genesisService.advanceStage();
      return jsonResponse(200, result);
    }

    // ========== Circuit Breakers ==========
    if (path === '/circuit-breakers' && method === 'GET') {
      const dashboard = await circuitBreakerService.getDashboard();
      return jsonResponse(200, dashboard);
    }

    if (path.startsWith('/circuit-breakers/') && method === 'GET') {
      const name = path.replace('/circuit-breakers/', '');
      const breaker = await circuitBreakerService.getBreaker(name);
      if (!breaker) {
        return jsonResponse(404, { error: 'Circuit breaker not found' });
      }
      return jsonResponse(200, breaker);
    }

    if (path.startsWith('/circuit-breakers/') && path.endsWith('/force-open') && method === 'POST') {
      requireSuperAdmin(event);
      const name = path.replace('/circuit-breakers/', '').replace('/force-open', '');
      const body = JSON.parse(event.body || '{}');
      await circuitBreakerService.forceOpen(name, body.reason || 'Admin override');
      return jsonResponse(200, { success: true, message: `Breaker ${name} force opened` });
    }

    if (path.startsWith('/circuit-breakers/') && path.endsWith('/force-close') && method === 'POST') {
      requireSuperAdmin(event);
      const name = path.replace('/circuit-breakers/', '').replace('/force-close', '');
      const body = JSON.parse(event.body || '{}');
      await circuitBreakerService.forceClose(name, body.reason || 'Admin override');
      return jsonResponse(200, { success: true, message: `Breaker ${name} force closed` });
    }

    if (path.startsWith('/circuit-breakers/') && path.endsWith('/config') && method === 'PATCH') {
      requireSuperAdmin(event);
      const name = path.replace('/circuit-breakers/', '').replace('/config', '');
      const body = JSON.parse(event.body || '{}');
      await circuitBreakerService.updateConfig(name, body);
      return jsonResponse(200, { success: true, message: `Breaker ${name} config updated` });
    }

    if (path.startsWith('/circuit-breakers/') && path.endsWith('/events') && method === 'GET') {
      const name = path.replace('/circuit-breakers/', '').replace('/events', '');
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      const events = await circuitBreakerService.getEventHistory(name, limit);
      return jsonResponse(200, { events });
    }

    // ========== Cost Tracking ==========
    if (path === '/costs/realtime' && method === 'GET') {
      const estimate = await costTrackingService.getRealtimeEstimate();
      return jsonResponse(200, estimate);
    }

    if (path === '/costs/daily' && method === 'GET') {
      const date = event.queryStringParameters?.date;
      const cost = await costTrackingService.getDailyCost(date);
      return jsonResponse(200, cost);
    }

    if (path === '/costs/mtd' && method === 'GET') {
      const cost = await costTrackingService.getMtdCost();
      return jsonResponse(200, cost);
    }

    if (path === '/costs/budget' && method === 'GET') {
      const status = await costTrackingService.getBudgetStatus();
      return jsonResponse(200, status);
    }

    if (path === '/costs/estimate' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const cognitiveInterval = body.cognitiveIntervalSeconds || 300;
      const estimate = await costTrackingService.estimateSettingsCost(cognitiveInterval);
      return jsonResponse(200, estimate);
    }

    if (path === '/costs/pricing' && method === 'GET') {
      const pricing = await costTrackingService.getPricingTable();
      return jsonResponse(200, pricing);
    }

    // ========== Intervention Level ==========
    if (path === '/intervention-level' && method === 'GET') {
      const level = await circuitBreakerService.getInterventionLevel();
      const riskScore = await circuitBreakerService.calculateRiskScore();
      const neuro = await circuitBreakerService.getNeurochemistry();
      return jsonResponse(200, { 
        level, 
        riskScore, 
        neurochemistry: neuro 
      });
    }

    // ========== Query Fallback ==========
    if (path === '/fallback' && method === 'GET') {
      const response = await queryFallbackService.getFallbackResponse();
      return jsonResponse(200, response);
    }

    if (path === '/fallback/active' && method === 'GET') {
      const active = await queryFallbackService.isFallbackActive();
      return jsonResponse(200, { active });
    }

    if (path === '/fallback/health' && method === 'GET') {
      const health = queryFallbackService.getHealthCheck();
      return jsonResponse(200, health);
    }

    // ========== Consciousness Loop ==========
    if (path === '/loop/status' && method === 'GET') {
      const status = await consciousnessLoopService.getStatus();
      return jsonResponse(200, status);
    }

    if (path === '/loop/settings' && method === 'GET') {
      const settings = await consciousnessLoopService.getSettings();
      return jsonResponse(200, settings);
    }

    if (path === '/loop/settings' && method === 'PATCH') {
      requireSuperAdmin(event);
      const body = JSON.parse(event.body || '{}');
      await consciousnessLoopService.updateSettings(body);
      return jsonResponse(200, { success: true });
    }

    if (path === '/loop/tick/system' && method === 'POST') {
      requireSuperAdmin(event);
      const result = await consciousnessLoopService.executeSystemTick();
      return jsonResponse(200, result);
    }

    if (path === '/loop/tick/cognitive' && method === 'POST') {
      requireSuperAdmin(event);
      const result = await consciousnessLoopService.executeCognitiveTick();
      return jsonResponse(200, result);
    }

    if (path === '/loop/emergency/enable' && method === 'POST') {
      requireSuperAdmin(event);
      const body = JSON.parse(event.body || '{}');
      await consciousnessLoopService.enableEmergencyMode(body.reason || 'Admin triggered');
      return jsonResponse(200, { success: true, message: 'Emergency mode enabled' });
    }

    if (path === '/loop/emergency/disable' && method === 'POST') {
      requireSuperAdmin(event);
      await consciousnessLoopService.disableEmergencyMode();
      return jsonResponse(200, { success: true, message: 'Emergency mode disabled' });
    }

    return jsonResponse(404, { error: 'Not found' });

  } catch (error) {
    logger.error('Bobble Genesis API error', { error, path: event.path });
    
    if ((error as any).message?.includes('requires role')) {
      return jsonResponse(403, { error: 'Forbidden: Insufficient permissions' });
    }
    
    return jsonResponse(500, { 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
