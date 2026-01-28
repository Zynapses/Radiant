// RADIANT v4.18.0 - Sentinel Agents API Handler
// Event-Driven Autonomous Agents Management
// Novel UI: "Watchtower Dashboard" - castle towers watching over different domains

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { sentinelAgentService } from '../shared/services/sentinel-agent.service';

// Local type definitions
type SentinelType = 'data_quality' | 'security' | 'compliance' | 'performance' | 'anomaly' | 'custom' | string;
type SentinelStatus = 'active' | 'inactive' | 'triggered' | 'paused' | string;
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Helpers
// ============================================================================

const getTenantId = (event: APIGatewayProxyEvent): string | null => {
  return (event.requestContext.authorizer as Record<string, string> | null)?.tenantId || null;
};

const getUserId = (event: APIGatewayProxyEvent): string | null => {
  return (event.requestContext.authorizer as Record<string, string> | null)?.userId || null;
};

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/thinktank/sentinels
 * List all sentinel agents
 * Novel UI: "Watchtower Map" - visual grid of towers with status indicators
 */
export async function listAgents(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const params = event.queryStringParameters || {};
    const { agents, total } = await sentinelAgentService.listAgents(tenantId, {
      type: params.type as 'monitor' | 'guardian' | 'scout' | 'herald' | 'arbiter' | undefined,
      enabled: params.enabled === 'true' ? true : params.enabled === 'false' ? false : undefined,
      limit: parseInt(params.limit || '50', 10),
      offset: parseInt(params.offset || '0', 10),
    });

    // Add visualization data for watchtower UI
    const towers = agents.map(agent => ({
      ...agent,
      towerIcon: getTowerIcon(agent.type),
      towerColor: getTowerColor(agent.status),
      statusLight: getStatusLight(agent.status),
      domainIcon: getDomainIcon(agent.watchDomain),
      lastActivity: agent.lastTriggeredAt ? getRelativeTime(agent.lastTriggeredAt) : 'Never',
    }));

    return jsonResponse(200, {
      success: true,
      data: { agents: towers, total },
    });
  } catch (error) {
    logger.error('Failed to list sentinel agents', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/sentinels/:id
 * Get a specific sentinel agent
 * Novel UI: "Tower Inspector" - detailed view of single tower
 */
export async function getAgent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const agentId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!agentId) return jsonResponse(400, { error: 'Agent ID required' });

    const agent = await sentinelAgentService.getAgent(tenantId, agentId);
    if (!agent) return jsonResponse(404, { error: 'Agent not found' });

    const events = await sentinelAgentService.getAgentEvents(tenantId, agentId, 10);

    return jsonResponse(200, {
      success: true,
      data: {
        ...agent,
        towerIcon: getTowerIcon(agent.type),
        towerColor: getTowerColor(agent.status),
        statusLight: getStatusLight(agent.status),
        recentEvents: events,
      },
    });
  } catch (error) {
    logger.error('Failed to get sentinel agent', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/sentinels
 * Create a new sentinel agent
 * Novel UI: "Build Tower" - wizard to configure new watchtower
 */
export async function createAgent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { name, description, type, watchDomain, triggers, actions, conditions, cooldownMinutes, priority } = body;

    if (!name || !type || !watchDomain) {
      return jsonResponse(400, { error: 'name, type, and watchDomain are required' });
    }

    if (!triggers || triggers.length === 0) {
      return jsonResponse(400, { error: 'At least one trigger is required' });
    }

    if (!actions || actions.length === 0) {
      return jsonResponse(400, { error: 'At least one action is required' });
    }

    const agent = await sentinelAgentService.createAgent(tenantId, {
      name,
      description: description || '',
      type,
      watchDomain,
      triggers,
      actions,
      conditions: conditions || [],
      cooldownMinutes: cooldownMinutes || 5,
      enabled: true,
      priority: priority || 5,
      metadata: {},
      createdBy: userId,
    });

    return jsonResponse(201, {
      success: true,
      data: agent,
      message: `🏰 Watchtower "${name}" has been erected!`,
    });
  } catch (error) {
    logger.error('Failed to create sentinel agent', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/sentinels/:id
 * Update a sentinel agent
 */
export async function updateAgent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const agentId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!agentId) return jsonResponse(400, { error: 'Agent ID required' });

    const body = JSON.parse(event.body || '{}');
    const agent = await sentinelAgentService.updateAgent(tenantId, agentId, body);

    if (!agent) return jsonResponse(404, { error: 'Agent not found' });

    return jsonResponse(200, { success: true, data: agent });
  } catch (error) {
    logger.error('Failed to update sentinel agent', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * DELETE /api/thinktank/sentinels/:id
 * Delete a sentinel agent
 */
export async function deleteAgent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const agentId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!agentId) return jsonResponse(400, { error: 'Agent ID required' });

    const deleted = await sentinelAgentService.deleteAgent(tenantId, agentId);
    if (!deleted) return jsonResponse(404, { error: 'Agent not found' });

    return jsonResponse(200, {
      success: true,
      message: '🏚️ Watchtower has been demolished.',
    });
  } catch (error) {
    logger.error('Failed to delete sentinel agent', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/sentinels/:id/trigger
 * Manually trigger a sentinel agent
 * Novel UI: "Sound the Alarm" - animated bell/horn effect
 */
export async function triggerAgent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const agentId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!agentId) return jsonResponse(400, { error: 'Agent ID required' });

    const body = JSON.parse(event.body || '{}');
    const triggerData = body.data || {};

    const result = await sentinelAgentService.triggerAgent(tenantId, agentId, triggerData);

    return jsonResponse(200, {
      success: true,
      data: result,
      message: result.status === 'success' ? '🔔 Sentinel has responded!' : '⚠️ Sentinel partially responded',
    });
  } catch (error) {
    logger.error('Failed to trigger sentinel agent', { error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse(500, { error: message });
  }
}

/**
 * POST /api/thinktank/sentinels/:id/enable
 * Enable a sentinel agent
 */
export async function enableAgent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const agentId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!agentId) return jsonResponse(400, { error: 'Agent ID required' });

    await sentinelAgentService.enableAgent(tenantId, agentId);

    return jsonResponse(200, {
      success: true,
      message: '👁️ Sentinel is now watching.',
    });
  } catch (error) {
    logger.error('Failed to enable sentinel agent', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/sentinels/:id/disable
 * Disable a sentinel agent
 */
export async function disableAgent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const agentId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!agentId) return jsonResponse(400, { error: 'Agent ID required' });

    await sentinelAgentService.disableAgent(tenantId, agentId);

    return jsonResponse(200, {
      success: true,
      message: '😴 Sentinel is now resting.',
    });
  } catch (error) {
    logger.error('Failed to disable sentinel agent', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/sentinels/:id/events
 * Get events for a sentinel agent
 * Novel UI: "Tower Log" - scrollable event history with icons
 */
export async function getAgentEvents(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const agentId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!agentId) return jsonResponse(400, { error: 'Agent ID required' });

    const params = event.queryStringParameters || {};
    const limit = parseInt(params.limit || '50', 10);

    const events = await sentinelAgentService.getAgentEvents(tenantId, agentId, limit);

    return jsonResponse(200, {
      success: true,
      data: events.map((e: any) => ({
        ...e,
        statusIcon: getEventStatusIcon(e.status),
        relativeTime: getRelativeTime(e.startedAt),
      })),
    });
  } catch (error) {
    logger.error('Failed to get agent events', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/sentinels/events
 * Get all events across all sentinels
 * Novel UI: "Kingdom Activity" - unified event stream
 */
export async function getAllEvents(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const params = event.queryStringParameters || {};
    const events = await sentinelAgentService.getAllEvents(tenantId, {
      limit: parseInt(params.limit || '100', 10),
    });

    return jsonResponse(200, {
      success: true,
      data: events.map((e: any) => ({
        ...e,
        statusIcon: getEventStatusIcon(e.status),
        relativeTime: getRelativeTime(e.startedAt),
      })),
    });
  } catch (error) {
    logger.error('Failed to get all events', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/sentinels/stats
 * Get sentinel statistics
 * Novel UI: "Kingdom Overview" - dashboard with tower counts and activity
 */
export async function getStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const stats = await sentinelAgentService.getStats(tenantId);

    return jsonResponse(200, {
      success: true,
      data: {
        ...stats,
        healthScore: Math.round(stats.successRate * 100),
        activityLevel: getActivityLevel(stats.triggersToday),
        typeIcons: Object.fromEntries(
          Object.keys(stats.byType).map(t => [t, getTowerIcon(t as SentinelType)])
        ),
      },
    });
  } catch (error) {
    logger.error('Failed to get sentinel stats', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/sentinels/types
 * Get available sentinel types
 */
export async function getTypes(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const types: SentinelType[] = ['monitor', 'guardian', 'scout', 'herald', 'arbiter'];

    return jsonResponse(200, {
      success: true,
      data: types.map(type => ({
        id: type,
        name: getTypeName(type),
        description: getTypeDescription(type),
        icon: getTowerIcon(type),
        color: getTypeColor(type),
      })),
    });
  } catch (error) {
    logger.error('Failed to get types', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// UI Helpers - "Watchtower" Visualization
// ============================================================================

function getTowerIcon(type: SentinelType): string {
  const icons: Record<SentinelType, string> = {
    monitor: '👁️',
    guardian: '🛡️',
    scout: '🔭',
    herald: '📯',
    arbiter: '⚖️',
  };
  return icons[type] || '🏰';
}

function getTowerColor(status: SentinelStatus): string {
  const colors: Record<SentinelStatus, string> = {
    idle: '#6B7280',
    watching: '#10B981',
    triggered: '#F59E0B',
    cooldown: '#3B82F6',
    disabled: '#EF4444',
  };
  return colors[status] || '#6B7280';
}

function getStatusLight(status: SentinelStatus): string {
  const lights: Record<SentinelStatus, string> = {
    idle: '⚪',
    watching: '🟢',
    triggered: '🟡',
    cooldown: '🔵',
    disabled: '🔴',
  };
  return lights[status] || '⚪';
}

function getDomainIcon(domain: string): string {
  const icons: Record<string, string> = {
    security: '🔒',
    performance: '⚡',
    cost: '💰',
    quality: '⭐',
    compliance: '📋',
    general: '🌐',
  };
  return icons[domain.toLowerCase()] || '🏠';
}

function getTypeName(type: SentinelType): string {
  const names: Record<SentinelType, string> = {
    monitor: 'Monitor',
    guardian: 'Guardian',
    scout: 'Scout',
    herald: 'Herald',
    arbiter: 'Arbiter',
  };
  return names[type] || type;
}

function getTypeDescription(type: SentinelType): string {
  const descriptions: Record<SentinelType, string> = {
    monitor: 'Passive watchdog - observes and alerts without intervention',
    guardian: 'Protective sentinel - can block harmful actions',
    scout: 'Proactive explorer - gathers information ahead of requests',
    herald: 'Communication specialist - handles notifications and announcements',
    arbiter: 'Decision maker - routes and delegates based on conditions',
  };
  return descriptions[type] || '';
}

function getTypeColor(type: SentinelType): string {
  const colors: Record<SentinelType, string> = {
    monitor: '#3B82F6',
    guardian: '#EF4444',
    scout: '#10B981',
    herald: '#F59E0B',
    arbiter: '#8B5CF6',
  };
  return colors[type] || '#6B7280';
}

function getEventStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    success: '✅',
    partial: '⚠️',
    failed: '❌',
  };
  return icons[status] || '❓';
}

function getActivityLevel(triggersToday: number): string {
  if (triggersToday >= 100) return 'Very High';
  if (triggersToday >= 50) return 'High';
  if (triggersToday >= 20) return 'Moderate';
  if (triggersToday >= 5) return 'Low';
  return 'Quiet';
}

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// Router
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Stats
  if (method === 'GET' && path.endsWith('/sentinels/stats')) {
    return getStats(event);
  }

  // Types
  if (method === 'GET' && path.endsWith('/sentinels/types')) {
    return getTypes(event);
  }

  // All events
  if (method === 'GET' && path.endsWith('/sentinels/events')) {
    return getAllEvents(event);
  }

  // List
  if (method === 'GET' && path.endsWith('/sentinels')) {
    return listAgents(event);
  }

  // Create
  if (method === 'POST' && path.endsWith('/sentinels')) {
    return createAgent(event);
  }

  // Agent events
  if (method === 'GET' && path.match(/\/sentinels\/[^/]+\/events$/)) {
    return getAgentEvents(event);
  }

  // Trigger
  if (method === 'POST' && path.match(/\/sentinels\/[^/]+\/trigger$/)) {
    return triggerAgent(event);
  }

  // Enable
  if (method === 'POST' && path.match(/\/sentinels\/[^/]+\/enable$/)) {
    return enableAgent(event);
  }

  // Disable
  if (method === 'POST' && path.match(/\/sentinels\/[^/]+\/disable$/)) {
    return disableAgent(event);
  }

  // Get single
  if (method === 'GET' && path.match(/\/sentinels\/[^/]+$/) && !path.endsWith('/events')) {
    return getAgent(event);
  }

  // Update
  if (method === 'PUT' && path.match(/\/sentinels\/[^/]+$/)) {
    return updateAgent(event);
  }

  // Delete
  if (method === 'DELETE' && path.match(/\/sentinels\/[^/]+$/)) {
    return deleteAgent(event);
  }

  return jsonResponse(404, { error: 'Not found' });
}
