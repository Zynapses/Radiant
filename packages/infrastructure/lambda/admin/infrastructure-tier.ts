/**
 * Infrastructure Tier Admin API
 * 
 * Admin endpoints for managing Bobble infrastructure tiers.
 * Location: System → Infrastructure in Admin Dashboard
 * 
 * Base Path: /api/admin/infrastructure
 * 
 * @see /docs/bobble/adr/009-infrastructure-tiers.md
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logging/enhanced-logger';
import {
  infrastructureTierService,
  InfrastructureTier,
  TierConfig
} from '../shared/services/bobble/infrastructure-tier.service';

// ============================================================================
// Helpers
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
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

// ============================================================================
// Main Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['x-tenant-id'];
  const userEmail = event.requestContext.authorizer?.email || 'admin@system';
  
  if (!tenantId) {
    return error(401, 'Tenant ID required');
  }

  const path = event.path.replace('/api/admin/infrastructure', '');
  const method = event.httpMethod;

  try {
    if (method === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    // GET /tier - Get current tier status
    if (path === '/tier' && method === 'GET') {
      return await getCurrentTier(tenantId);
    }

    // GET /tier/compare - Get tier comparison
    if (path === '/tier/compare' && method === 'GET') {
      return await compareTiers(tenantId);
    }

    // GET /tier/configs - Get all tier configurations
    if (path === '/tier/configs' && method === 'GET') {
      return await getTierConfigs(tenantId);
    }

    // GET /tier/configs/:tierName - Get specific tier config
    if (path.startsWith('/tier/configs/') && method === 'GET') {
      const tierName = path.replace('/tier/configs/', '');
      return await getTierConfig(tenantId, tierName);
    }

    // PUT /tier/configs/:tierName - Update tier config
    if (path.startsWith('/tier/configs/') && method === 'PUT') {
      const tierName = path.replace('/tier/configs/', '');
      const body = JSON.parse(event.body || '{}');
      return await updateTierConfig(tenantId, tierName, body);
    }

    // POST /tier/change - Request tier change
    if (path === '/tier/change' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await requestTierChange(tenantId, userEmail, body);
    }

    // POST /tier/confirm - Confirm tier change
    if (path === '/tier/confirm' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await confirmTierChange(tenantId, userEmail, body.confirmationToken);
    }

    // GET /tier/transition-status - Get transition status
    if (path === '/tier/transition-status' && method === 'GET') {
      return await getTransitionStatus(tenantId);
    }

    // PUT /tier/cooldown - Update cooldown hours
    if (path === '/tier/cooldown' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return await updateCooldown(tenantId, body.hours);
    }

    // GET /tier/change-history - Get change history
    if (path === '/tier/change-history' && method === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '20');
      return await getChangeHistory(tenantId, limit);
    }

    return error(404, 'Not found');

  } catch (err) {
    logger.error(`Infrastructure tier API error: ${String(err)}`);
    return error(500, String(err));
  }
};

// ============================================================================
// Handlers
// ============================================================================

async function getCurrentTier(tenantId: string): Promise<APIGatewayProxyResult> {
  const state = await infrastructureTierService.getCurrentState(tenantId);
  const configs = await infrastructureTierService.getTierConfigs(tenantId);
  const currentConfig = configs.find(c => c.tierName === state.currentTier);

  return success({
    currentTier: state.currentTier,
    targetTier: state.targetTier,
    transitionStatus: state.transitionStatus,
    lastChangedAt: state.lastChangedAt.toISOString(),
    lastChangedBy: state.lastChangedBy,
    cooldownHours: state.cooldownHours,
    nextChangeAllowedAt: state.nextChangeAllowedAt.toISOString(),
    cooldownActive: new Date() < state.nextChangeAllowedAt,
    estimatedMonthlyCost: state.estimatedMonthlyCost,
    actualMtdCost: state.actualMtdCost,
    config: currentConfig || null
  });
}

async function compareTiers(tenantId: string): Promise<APIGatewayProxyResult> {
  const comparison = await infrastructureTierService.getTierComparison(tenantId);
  const state = await infrastructureTierService.getCurrentState(tenantId);

  return success({
    currentTier: state.currentTier,
    tiers: comparison
  });
}

async function getTierConfigs(tenantId: string): Promise<APIGatewayProxyResult> {
  const configs = await infrastructureTierService.getTierConfigs(tenantId);
  return success({ configs });
}

async function getTierConfig(tenantId: string, tierName: string): Promise<APIGatewayProxyResult> {
  const config = await infrastructureTierService.getTierConfig(tenantId, tierName);
  
  if (!config) {
    return error(404, `Tier ${tierName} not found`);
  }

  return success(config);
}

async function updateTierConfig(
  tenantId: string,
  tierName: string,
  updates: Partial<TierConfig>
): Promise<APIGatewayProxyResult> {
  // Validate updates
  if (updates.sagemakerShadowSelfMinInstances !== undefined) {
    if (updates.sagemakerShadowSelfMinInstances < 0 || updates.sagemakerShadowSelfMinInstances > 500) {
      return error(400, 'Min instances must be between 0 and 500');
    }
  }

  if (updates.sagemakerShadowSelfMaxInstances !== undefined) {
    if (updates.sagemakerShadowSelfMaxInstances < 1 || updates.sagemakerShadowSelfMaxInstances > 500) {
      return error(400, 'Max instances must be between 1 and 500');
    }
  }

  if (updates.estimatedMonthlyCost !== undefined) {
    if (updates.estimatedMonthlyCost < 0) {
      return error(400, 'Cost must be non-negative');
    }
  }

  await infrastructureTierService.updateTierConfig(tenantId, tierName, updates);

  const updated = await infrastructureTierService.getTierConfig(tenantId, tierName);
  return success({ message: 'Tier configuration updated', config: updated });
}

async function requestTierChange(
  tenantId: string,
  requestedBy: string,
  body: {
    targetTier: string;
    reason: string;
    bypassCooldown?: boolean;
  }
): Promise<APIGatewayProxyResult> {
  // Validate target tier
  if (!['DEV', 'STAGING', 'PRODUCTION'].includes(body.targetTier)) {
    return error(400, 'Invalid target tier. Must be DEV, STAGING, or PRODUCTION');
  }

  if (!body.reason || body.reason.length < 10) {
    return error(400, 'Reason is required (minimum 10 characters)');
  }

  const result = await infrastructureTierService.requestTierChange(tenantId, requestedBy, {
    targetTier: body.targetTier as InfrastructureTier,
    reason: body.reason,
    bypassCooldown: body.bypassCooldown
  });

  if (result.status === 'REJECTED') {
    return error(400, result.errors?.join(', ') || 'Request rejected');
  }

  return success(result);
}

async function confirmTierChange(
  tenantId: string,
  requestedBy: string,
  confirmationToken: string
): Promise<APIGatewayProxyResult> {
  if (!confirmationToken) {
    return error(400, 'Confirmation token required');
  }

  const result = await infrastructureTierService.confirmTierChange(
    tenantId,
    confirmationToken,
    requestedBy
  );

  if (result.status === 'REJECTED') {
    return error(400, result.errors?.join(', ') || 'Confirmation failed');
  }

  return success(result);
}

async function getTransitionStatus(tenantId: string): Promise<APIGatewayProxyResult> {
  const status = await infrastructureTierService.getTransitionStatus(tenantId);
  return success(status);
}

async function updateCooldown(tenantId: string, hours: number): Promise<APIGatewayProxyResult> {
  if (hours < 0 || hours > 168) { // Max 1 week
    return error(400, 'Cooldown hours must be between 0 and 168');
  }

  await infrastructureTierService.updateCooldownHours(tenantId, hours);
  return success({ message: 'Cooldown updated', cooldownHours: hours });
}

async function getChangeHistory(tenantId: string, limit: number): Promise<APIGatewayProxyResult> {
  const changes = await infrastructureTierService.getChangeHistory(tenantId, limit);
  return success({ 
    changes: changes.map(c => ({
      ...c,
      startedAt: c.startedAt.toISOString(),
      completedAt: c.completedAt?.toISOString() || null
    })),
    limit 
  });
}
