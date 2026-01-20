// RADIANT v4.18.0 - Security Signals API Handler
// SSF/CAEP Integration for Identity Security
// Novel UI: "Security Shield" - real-time threat visualization

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { securitySignalsService, SignalType, SignalSeverity, SignalStatus } from '../shared/services/security-signals.service';
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
// Dashboard Handler
// ============================================================================

/**
 * GET /api/thinktank/security/dashboard
 * Get security dashboard with shield visualization
 * Novel UI: "Security Shield" - animated shield with status indicators
 */
export async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const dashboard = await securitySignalsService.getDashboard(tenantId);

    // Add visualization data for shield UI
    const shieldData = {
      ...dashboard,
      shieldIcon: getShieldIcon(dashboard.shieldStatus),
      shieldColor: getShieldColor(dashboard.shieldStatus),
      riskIcon: getRiskIcon(dashboard.riskLevel),
      riskColor: getRiskColor(dashboard.riskLevel),
      signalBreakdown: Object.entries(dashboard.signalsBySeverity).map(([severity, count]) => ({
        severity,
        count,
        icon: getSeverityIcon(severity as SignalSeverity),
        color: getSeverityColor(severity as SignalSeverity),
      })),
      recentSignals: dashboard.recentSignals.map(s => ({
        ...s,
        severityIcon: getSeverityIcon(s.severity),
        severityColor: getSeverityColor(s.severity),
        typeIcon: getSignalTypeIcon(s.type),
        relativeTime: getRelativeTime(s.createdAt),
      })),
    };

    return jsonResponse(200, { success: true, data: shieldData });
  } catch (error) {
    logger.error('Failed to get security dashboard', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Signal Handlers
// ============================================================================

/**
 * GET /api/thinktank/security/signals
 * List security signals
 * Novel UI: "Threat Feed" - scrolling list of security events
 */
export async function listSignals(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const params = event.queryStringParameters || {};
    const { signals, total } = await securitySignalsService.listSignals(tenantId, {
      type: params.type as SignalType,
      severity: params.severity as SignalSeverity,
      status: params.status as SignalStatus,
      limit: parseInt(params.limit || '50', 10),
      offset: parseInt(params.offset || '0', 10),
    });

    return jsonResponse(200, {
      success: true,
      data: {
        signals: signals.map(s => ({
          ...s,
          severityIcon: getSeverityIcon(s.severity),
          severityColor: getSeverityColor(s.severity),
          typeIcon: getSignalTypeIcon(s.type),
          statusIcon: getStatusIcon(s.status),
          relativeTime: getRelativeTime(s.createdAt),
        })),
        total,
      },
    });
  } catch (error) {
    logger.error('Failed to list signals', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/security/signals/:id
 * Get signal details
 */
export async function getSignal(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const signalId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!signalId) return jsonResponse(400, { error: 'Signal ID required' });

    const signal = await securitySignalsService.getSignal(tenantId, signalId);
    if (!signal) return jsonResponse(404, { error: 'Signal not found' });

    return jsonResponse(200, {
      success: true,
      data: {
        ...signal,
        severityIcon: getSeverityIcon(signal.severity),
        severityColor: getSeverityColor(signal.severity),
        typeIcon: getSignalTypeIcon(signal.type),
        statusIcon: getStatusIcon(signal.status),
        actionsDisplay: signal.actions.map(a => ({
          ...a,
          icon: getActionIcon(a.type),
          statusIcon: a.status === 'executed' ? '✅' : a.status === 'failed' ? '❌' : '⏳',
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get signal', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/security/signals
 * Create a manual security signal
 */
export async function createSignal(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { type, severity, subject, event: eventData, context } = body;

    if (!type || !severity || !subject) {
      return jsonResponse(400, { error: 'type, severity, and subject are required' });
    }

    const signal = await securitySignalsService.createSignal(tenantId, {
      type,
      severity,
      source: 'manual_report',
      subject,
      event: eventData || {
        type: 'manual_report',
        timestamp: new Date().toISOString(),
        description: 'Manually reported security event',
        details: {},
      },
      context: context || {},
      metadata: { manuallyCreated: true },
    });

    return jsonResponse(201, {
      success: true,
      data: signal,
      message: '🛡️ Security signal recorded.',
    });
  } catch (error) {
    logger.error('Failed to create signal', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/security/signals/:id/status
 * Update signal status
 */
export async function updateSignalStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const signalId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!signalId) return jsonResponse(400, { error: 'Signal ID required' });

    const body = JSON.parse(event.body || '{}');
    const { status } = body;

    if (!status) {
      return jsonResponse(400, { error: 'status is required' });
    }

    const signal = await securitySignalsService.updateSignalStatus(tenantId, signalId, status, userId || undefined);
    if (!signal) return jsonResponse(404, { error: 'Signal not found' });

    const message = status === 'resolved' ? '✅ Signal resolved.' : status === 'dismissed' ? '🗑️ Signal dismissed.' : '📝 Status updated.';

    return jsonResponse(200, { success: true, data: signal, message });
  } catch (error) {
    logger.error('Failed to update signal status', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Policy Handlers
// ============================================================================

/**
 * GET /api/thinktank/security/policies
 * List security policies
 */
export async function listPolicies(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const policies = await securitySignalsService.listPolicies(tenantId);

    return jsonResponse(200, {
      success: true,
      data: policies.map(p => ({
        ...p,
        triggerCount: p.triggers.length,
        actionCount: p.actions.length,
        statusIcon: p.enabled ? '🟢' : '🔴',
      })),
    });
  } catch (error) {
    logger.error('Failed to list policies', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/security/policies
 * Create a security policy
 */
export async function createPolicy(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { name, description, triggers, actions, priority, enabled } = body;

    if (!name || !triggers || !actions) {
      return jsonResponse(400, { error: 'name, triggers, and actions are required' });
    }

    const policy = await securitySignalsService.createPolicy(tenantId, {
      name,
      description: description || '',
      enabled: enabled !== false,
      triggers,
      actions,
      priority: priority || 5,
    });

    return jsonResponse(201, {
      success: true,
      data: policy,
      message: '📋 Security policy created.',
    });
  } catch (error) {
    logger.error('Failed to create policy', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/security/policies/:id
 * Update a security policy
 */
export async function updatePolicy(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const policyId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!policyId) return jsonResponse(400, { error: 'Policy ID required' });

    const body = JSON.parse(event.body || '{}');
    const policy = await securitySignalsService.updatePolicy(tenantId, policyId, body);

    if (!policy) return jsonResponse(404, { error: 'Policy not found' });

    return jsonResponse(200, { success: true, data: policy });
  } catch (error) {
    logger.error('Failed to update policy', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * DELETE /api/thinktank/security/policies/:id
 * Delete a security policy
 */
export async function deletePolicy(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const policyId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!policyId) return jsonResponse(400, { error: 'Policy ID required' });

    const deleted = await securitySignalsService.deletePolicy(tenantId, policyId);
    if (!deleted) return jsonResponse(404, { error: 'Policy not found' });

    return jsonResponse(200, { success: true, message: '🗑️ Policy deleted.' });
  } catch (error) {
    logger.error('Failed to delete policy', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// SSF/CAEP Webhook Handlers
// ============================================================================

/**
 * POST /api/thinktank/security/ssf/event
 * Ingest SSF (Shared Signals Framework) event
 */
export async function ingestSSFEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const signal = await securitySignalsService.ingestSSFEvent(tenantId, body);

    return jsonResponse(201, { success: true, data: signal });
  } catch (error) {
    logger.error('Failed to ingest SSF event', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/security/caep/event
 * Ingest CAEP (Continuous Access Evaluation Profile) event
 */
export async function ingestCAEPEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const signal = await securitySignalsService.ingestCAEPEvent(tenantId, body);

    return jsonResponse(201, { success: true, data: signal });
  } catch (error) {
    logger.error('Failed to ingest CAEP event', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// UI Helpers - "Security Shield" Visualization
// ============================================================================

function getShieldIcon(status: string): string {
  const icons: Record<string, string> = {
    secure: '🛡️',
    warning: '⚠️',
    alert: '🚨',
    critical: '🔴',
  };
  return icons[status] || '🛡️';
}

function getShieldColor(status: string): string {
  const colors: Record<string, string> = {
    secure: '#10B981',
    warning: '#F59E0B',
    alert: '#F97316',
    critical: '#EF4444',
  };
  return colors[status] || '#6B7280';
}

function getRiskIcon(level: string): string {
  const icons: Record<string, string> = {
    low: '🟢',
    moderate: '🟡',
    elevated: '🟠',
    high: '🔴',
    critical: '⚫',
  };
  return icons[level] || '⚪';
}

function getRiskColor(level: string): string {
  const colors: Record<string, string> = {
    low: '#10B981',
    moderate: '#F59E0B',
    elevated: '#F97316',
    high: '#EF4444',
    critical: '#7C3AED',
  };
  return colors[level] || '#6B7280';
}

function getSeverityIcon(severity: SignalSeverity): string {
  const icons: Record<SignalSeverity, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
    info: '🔵',
  };
  return icons[severity] || '⚪';
}

function getSeverityColor(severity: SignalSeverity): string {
  const colors: Record<SignalSeverity, string> = {
    critical: '#EF4444',
    high: '#F97316',
    medium: '#F59E0B',
    low: '#10B981',
    info: '#3B82F6',
  };
  return colors[severity] || '#6B7280';
}

function getSignalTypeIcon(type: SignalType): string {
  const icons: Record<SignalType, string> = {
    session_revoked: '🔐',
    credential_change: '🔑',
    token_claims_change: '🎫',
    device_compliance: '📱',
    risk_change: '📊',
    assurance_level_change: '📈',
    anomaly_detected: '🔍',
    threat_detected: '⚠️',
    policy_violation: '🚫',
  };
  return icons[type] || '❓';
}

function getStatusIcon(status: SignalStatus): string {
  const icons: Record<SignalStatus, string> = {
    active: '🔔',
    investigating: '🔍',
    resolved: '✅',
    dismissed: '🗑️',
  };
  return icons[status] || '❓';
}

function getActionIcon(action: string): string {
  const icons: Record<string, string> = {
    notify_admin: '📧',
    notify_user: '📬',
    revoke_session: '🔐',
    require_mfa: '🔒',
    block_access: '🚫',
    quarantine: '🔒',
    log_only: '📝',
    escalate: '⬆️',
  };
  return icons[action] || '⚙️';
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

  // Dashboard
  if (method === 'GET' && path.endsWith('/security/dashboard')) {
    return getDashboard(event);
  }

  // SSF/CAEP webhooks
  if (method === 'POST' && path.endsWith('/security/ssf/event')) {
    return ingestSSFEvent(event);
  }
  if (method === 'POST' && path.endsWith('/security/caep/event')) {
    return ingestCAEPEvent(event);
  }

  // Signals
  if (method === 'GET' && path.endsWith('/security/signals')) {
    return listSignals(event);
  }
  if (method === 'POST' && path.endsWith('/security/signals')) {
    return createSignal(event);
  }
  if (method === 'GET' && path.match(/\/security\/signals\/[^/]+$/) && !path.includes('/status')) {
    return getSignal(event);
  }
  if (method === 'PUT' && path.match(/\/security\/signals\/[^/]+\/status$/)) {
    return updateSignalStatus(event);
  }

  // Policies
  if (method === 'GET' && path.endsWith('/security/policies')) {
    return listPolicies(event);
  }
  if (method === 'POST' && path.endsWith('/security/policies')) {
    return createPolicy(event);
  }
  if (method === 'PUT' && path.match(/\/security\/policies\/[^/]+$/)) {
    return updatePolicy(event);
  }
  if (method === 'DELETE' && path.match(/\/security\/policies\/[^/]+$/)) {
    return deletePolicy(event);
  }

  return jsonResponse(404, { error: 'Not found' });
}
