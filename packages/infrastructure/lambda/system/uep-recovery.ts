/**
 * RADIANT UEP Recovery Lambda
 * 
 * Handles UEP self-healing operations:
 * - Startup recovery (EventBridge rule on Lambda initialization)
 * - Scheduled healing (EventBridge rule, e.g., every 15 minutes)
 * - Ad-hoc healing (API Gateway trigger)
 * 
 * @version 1.0.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent, Context } from 'aws-lambda';
import { uepSelfHealingService, HealingReport, HealingConfig } from '../shared/services/uep/index.js';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'system/uep-recovery',
  category: 'infrastructure',
  sourceType: 'lambda',
});
import { executeStatement, stringParam } from '../shared/db/client';

// =============================================================================
// Types
// =============================================================================

interface AdHocHealingRequest {
  tenantId: string;
  config?: Partial<HealingConfig>;
}

interface HealingResponse {
  success: boolean;
  report?: HealingReport;
  error?: string;
  bufferStatus?: {
    pendingCount: number;
    oldestPendingAge?: number;
    failedAttempts: number;
  };
}

// =============================================================================
// Handler
// =============================================================================

export const handler = async (
  event: APIGatewayProxyEvent | ScheduledEvent,
  context: Context
): Promise<APIGatewayProxyResult | void> => {
  const requestId = context.awsRequestId;
  
  logger.info('UEP Recovery Lambda invoked', { 
    requestId,
    eventSource: isScheduledEvent(event) ? 'scheduled' : 'api',
  });

  try {
    // Determine event type and route accordingly
    if (isScheduledEvent(event)) {
      // Scheduled or startup event
      await handleScheduledHealing(event, requestId);
      return;
    }

    // API Gateway event
    return await handleApiRequest(event, requestId);
  } catch (error) {
    logger.error('UEP Recovery Lambda failed', { requestId, error });
    
    if (!isScheduledEvent(event)) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
    
    throw error; // Re-throw for scheduled events to trigger retry
  }
};

// =============================================================================
// Scheduled Event Handler
// =============================================================================

async function handleScheduledHealing(event: ScheduledEvent, requestId: string): Promise<void> {
  const isStartup = event.detail?.type === 'startup' || event.source === 'aws.lambda';
  const mode = isStartup ? 'startup' : 'scheduled';
  
  logger.info('Running scheduled UEP healing', { requestId, mode });

  // Get all active tenants
  const tenants = await getActiveTenants();
  
  const results: Array<{ tenantId: string; success: boolean; issuesFound: number }> = [];
  
  for (const tenantId of tenants) {
    try {
      const report = await uepSelfHealingService.runHealing(tenantId, mode);
      results.push({
        tenantId,
        success: true,
        issuesFound: report.summary.totalIssuesFound,
      });
      
      // Log significant findings
      if (report.summary.totalIssuesFound > 0) {
        logger.warn('UEP healing found issues', {
          tenantId,
          mode,
          issuesFound: report.summary.totalIssuesFound,
          issuesResolved: report.summary.totalIssuesResolved,
          issuesFailed: report.summary.totalIssuesFailed,
        });
      }
    } catch (error) {
      logger.error('UEP healing failed for tenant', { tenantId, error });
      results.push({
        tenantId,
        success: false,
        issuesFound: 0,
      });
    }
  }

  const totalSuccess = results.filter(r => r.success).length;
  const totalFailed = results.filter(r => !r.success).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issuesFound, 0);

  logger.info('Scheduled UEP healing complete', {
    requestId,
    mode,
    tenantsProcessed: tenants.length,
    totalSuccess,
    totalFailed,
    totalIssuesFound: totalIssues,
  });
}

// =============================================================================
// API Gateway Handler
// =============================================================================

async function handleApiRequest(
  event: APIGatewayProxyEvent,
  requestId: string
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  // Route based on path
  if (path.endsWith('/status')) {
    return handleStatusRequest(requestId);
  }

  if (path.endsWith('/heal') && method === 'POST') {
    return handleAdHocHealingRequest(event, requestId);
  }

  if (path.endsWith('/reports') && method === 'GET') {
    return handleGetReportsRequest(event, requestId);
  }

  if (path.endsWith('/quarantine') && method === 'GET') {
    return handleGetQuarantineRequest(event, requestId);
  }

  if (path.match(/\/quarantine\/[^/]+\/resolve$/) && method === 'POST') {
    return handleResolveQuarantineRequest(event, requestId);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not found' }),
  };
}

/**
 * GET /status - Get current buffer and healing status
 */
async function handleStatusRequest(requestId: string): Promise<APIGatewayProxyResult> {
  const bufferStatus = uepSelfHealingService.getBufferStatus();
  const lastReport = uepSelfHealingService.getLastReport();
  const config = uepSelfHealingService.getConfig();

  const response: HealingResponse = {
    success: true,
    bufferStatus,
    report: lastReport || undefined,
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...response,
      config,
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * POST /heal - Trigger ad-hoc healing for a tenant
 */
async function handleAdHocHealingRequest(
  event: APIGatewayProxyEvent,
  requestId: string
): Promise<APIGatewayProxyResult> {
  let request: AdHocHealingRequest;
  
  try {
    request = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
    };
  }

  if (!request.tenantId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'tenantId is required' }),
    };
  }

  logger.info('Running ad-hoc UEP healing', { requestId, tenantId: request.tenantId });

  try {
    const report = await uepSelfHealingService.runHealing(
      request.tenantId,
      'adhoc',
      request.config
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        report,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Healing failed',
      }),
    };
  }
}

/**
 * GET /reports - Get recent healing reports for a tenant
 */
async function handleGetReportsRequest(
  event: APIGatewayProxyEvent,
  requestId: string
): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const limit = parseInt(event.queryStringParameters?.limit || '10', 10);

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'tenantId query parameter is required' }),
    };
  }

  try {
    const result = await executeStatement(
      `SELECT run_id, mode, started_at, completed_at, issues_found, issues_resolved, 
              issues_failed, duration_ms, report_data
       FROM uep_healing_reports
       WHERE tenant_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [stringParam('tenantId', tenantId), stringParam('limit', String(limit))]
    );

    const reports = (result.rows || []).map((row: Record<string, unknown>) => ({
      runId: row.run_id,
      mode: row.mode,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      issuesFound: row.issues_found,
      issuesResolved: row.issues_resolved,
      issuesFailed: row.issues_failed,
      durationMs: row.duration_ms,
      details: row.report_data,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch reports' }),
    };
  }
}

/**
 * GET /quarantine - Get quarantined envelopes for a tenant
 */
async function handleGetQuarantineRequest(
  event: APIGatewayProxyEvent,
  requestId: string
): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const status = event.queryStringParameters?.status || 'pending';
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'tenantId query parameter is required' }),
    };
  }

  try {
    let query = `
      SELECT id, envelope_id, quarantine_reason, quarantined_at, 
             reviewed_at, reviewed_by, resolution, resolution_notes
      FROM uep_quarantine
      WHERE tenant_id = $1
    `;
    
    if (status === 'pending') {
      query += ` AND resolution IS NULL`;
    } else if (status === 'resolved') {
      query += ` AND resolution IS NOT NULL`;
    }
    
    query += ` ORDER BY quarantined_at DESC LIMIT $2`;

    const result = await executeStatement(query, [
      stringParam('tenantId', tenantId),
      stringParam('limit', String(limit)),
    ]);

    const quarantined = (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      envelopeId: row.envelope_id,
      reason: row.quarantine_reason,
      quarantinedAt: row.quarantined_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      resolution: row.resolution,
      resolutionNotes: row.resolution_notes,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quarantined }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch quarantine' }),
    };
  }
}

/**
 * POST /quarantine/:id/resolve - Resolve a quarantined envelope
 */
async function handleResolveQuarantineRequest(
  event: APIGatewayProxyEvent,
  requestId: string
): Promise<APIGatewayProxyResult> {
  const pathParts = event.path.split('/');
  const quarantineId = pathParts[pathParts.length - 2];

  let body: { resolution: string; notes?: string; reviewedBy?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  if (!body.resolution || !['recovered', 'discarded', 'manual_fix'].includes(body.resolution)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'resolution must be one of: recovered, discarded, manual_fix' }),
    };
  }

  try {
    await executeStatement(
      `UPDATE uep_quarantine 
       SET resolution = $1, resolution_notes = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $4`,
      [
        stringParam('resolution', body.resolution),
        stringParam('notes', body.notes || ''),
        stringParam('reviewedBy', body.reviewedBy || ''),
        stringParam('id', quarantineId),
      ]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to resolve quarantine' }),
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function isScheduledEvent(event: unknown): event is ScheduledEvent {
  return typeof event === 'object' && event !== null && 'source' in event && 
         (event as ScheduledEvent).source?.startsWith('aws.');
}

async function getActiveTenants(): Promise<string[]> {
  try {
    const result = await executeStatement(
      `SELECT id FROM tenants WHERE status = 'active' AND deleted_at IS NULL`,
      []
    );
    return ((result.rows || []) as Array<{ id: string }>).map(row => row.id);
  } catch (error) {
    logger.error('Failed to get active tenants', { error });
    return [];
  }
}

export default handler;
