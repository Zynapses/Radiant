/**
 * RADIANT v4.18.0 - Log Retention Admin API
 *
 * Endpoints:
 *   GET  /dashboard                    - Full retention dashboard
 *   GET  /retention                    - Effective retention for a tenant
 *   PUT  /retention/override           - Set tenant retention override
 *   DELETE /retention/override         - Remove tenant retention override
 *   GET  /sources                      - List all registered log sources
 *   GET  /sources/coverage             - Logging coverage report
 *   GET  /index                        - Query log index entries
 *   POST /indexer/run                  - Manually trigger hourly indexer
 *   GET  /compliance                   - Compliance requirements detail
 *   GET  /search                       - Full-text search hot-tier logs
 *   GET  /reports                      - List generated reports
 *   POST /reports                      - Generate a new report
 *   GET  /reports/:id/download         - Get report download URL
 *   GET  /restore/jobs                 - List Glacier restore jobs
 *   POST /restore/jobs                 - Create a new restore job
 *   POST /restore/jobs/:id/process     - Process a restore job
 *   GET  /export/jobs                  - List export jobs
 *   POST /export/jobs                  - Create a new export job
 *   GET  /export/jobs/:id/download     - Get export download URL
 *   GET  /verification/status          - Get Merkle chain status
 *   POST /verification/verify-full     - Verify full Merkle chain
 *   GET  /erasure/requests             - List erasure requests
 *   POST /erasure/requests             - Create an erasure request
 *   POST /erasure/requests/:id/approve - Approve an erasure request
 *   POST /erasure/requests/:id/execute - Execute an approved erasure
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { getDbPool } from '../shared/services/database';
import type { Pool } from 'pg';
import { LogRetentionPolicyService, LogCategory } from '../shared/services/log-retention-policy.service';
import { LogIndexerService } from '../shared/services/log-indexer.service';
import { getLoggingCoverageReport } from '../shared/services/logging-registry.service';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { LogReportService } from '../shared/services/log-report.service';
import { LogGlacierRestoreService } from '../shared/services/log-glacier-restore.service';
import { LogExportService } from '../shared/services/log-export.service';
import { LogTamperVerificationService } from '../shared/services/log-tamper-verification.service';
import { LogGdprErasureService } from '../shared/services/log-gdpr-erasure.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/log-retention',
  category: 'audit',
  sourceType: 'lambda',
});

let pool: Pool;
let retentionService: LogRetentionPolicyService;
let indexerService: LogIndexerService;
let reportService: LogReportService;
let restoreService: LogGlacierRestoreService;
let exportService: LogExportService;
let verificationService: LogTamperVerificationService;
let erasureService: LogGdprErasureService;

async function initPool() {
  if (!pool) {
    pool = await getDbPool();
    retentionService = new LogRetentionPolicyService(pool);
    indexerService = new LogIndexerService(pool);
    reportService = new LogReportService(pool);
    restoreService = new LogGlacierRestoreService(pool);
    exportService = new LogExportService(pool);
    verificationService = new LogTamperVerificationService(pool);
    erasureService = new LogGdprErasureService(pool);
  }
}

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const requestId = context.awsRequestId;
  logger.withContext({ requestId });

  try {
    await initPool();
    const path = event.path.replace(/^\/api\/admin\/log-retention/, '') || '/';
    const method = event.httpMethod;
    const tenantId = event.queryStringParameters?.tenantId || event.headers?.['x-tenant-id'] || '';

    logger.info('Log retention admin request', { method, path, tenantId });

    // Route — original endpoints
    if (method === 'GET' && path === '/dashboard') return await handleDashboard(tenantId);
    if (method === 'GET' && path === '/retention') return await handleGetRetention(tenantId);
    if (method === 'PUT' && path === '/retention/override') return await handleSetOverride(event, tenantId);
    if (method === 'DELETE' && path === '/retention/override') return await handleRemoveOverride(event, tenantId);
    if (method === 'GET' && path === '/sources') return await handleGetSources(event);
    if (method === 'GET' && path === '/sources/coverage') return await handleGetCoverage();
    if (method === 'GET' && path === '/index') return await handleGetIndex(event, tenantId);
    if (method === 'POST' && path === '/indexer/run') return await handleRunIndexer();
    if (method === 'GET' && path === '/compliance') return await handleGetCompliance(event);

    // Search
    if (method === 'GET' && path === '/search') return await handleSearch(event, tenantId);

    // Reports
    if (method === 'GET' && path === '/reports') return await handleListReports(tenantId);
    if (method === 'POST' && path === '/reports') return await handleGenerateReport(event, tenantId);
    const reportDownloadMatch = path.match(/^\/reports\/([^/]+)\/download$/);
    if (method === 'GET' && reportDownloadMatch) return await handleReportDownload(reportDownloadMatch[1]);

    // Glacier Restore
    if (method === 'GET' && path === '/restore/jobs') return await handleListRestoreJobs(tenantId);
    if (method === 'POST' && path === '/restore/jobs') return await handleCreateRestoreJob(event, tenantId);
    const restoreProcessMatch = path.match(/^\/restore\/jobs\/([^/]+)\/process$/);
    if (method === 'POST' && restoreProcessMatch) return await handleProcessRestoreJob(restoreProcessMatch[1]);

    // Export
    if (method === 'GET' && path === '/export/jobs') return await handleListExportJobs(tenantId);
    if (method === 'POST' && path === '/export/jobs') return await handleCreateExportJob(event, tenantId);
    const exportDownloadMatch = path.match(/^\/export\/jobs\/([^/]+)\/download$/);
    if (method === 'GET' && exportDownloadMatch) return await handleExportDownload(exportDownloadMatch[1]);

    // Verification
    if (method === 'GET' && path === '/verification/status') return await handleVerificationStatus();
    if (method === 'POST' && path === '/verification/verify-full') return await handleVerifyFullChain(event);

    // GDPR Erasure
    if (method === 'GET' && path === '/erasure/requests') return await handleListErasureRequests(tenantId);
    if (method === 'POST' && path === '/erasure/requests') return await handleCreateErasureRequest(event, tenantId);
    const erasureApproveMatch = path.match(/^\/erasure\/requests\/([^/]+)\/approve$/);
    if (method === 'POST' && erasureApproveMatch) return await handleApproveErasure(event, erasureApproveMatch[1]);
    const erasureExecuteMatch = path.match(/^\/erasure\/requests\/([^/]+)\/execute$/);
    if (method === 'POST' && erasureExecuteMatch) return await handleExecuteErasure(erasureExecuteMatch[1]);

    return json(404, { error: `Not found: ${method} ${path}` });
  } catch (error) {
    logger.error('Log retention admin error', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json(500, { error: message });
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const dashboard = await retentionService.getDashboard(tenantId);
  return json(200, { dashboard });
}

async function handleGetRetention(tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const retention = await retentionService.resolveEffectiveRetention(tenantId);
  return json(200, { retention });
}

async function handleSetOverride(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });

  const body = event.body ? JSON.parse(event.body) : {};
  const { category, retentionDays, hotDays, warmDays, reason } = body;

  if (!category || !retentionDays || !hotDays || !warmDays) {
    return json(400, { error: 'category, retentionDays, hotDays, warmDays are required' });
  }

  const userId = event.headers?.['x-user-id'] || event.requestContext?.authorizer?.userId as string || '';
  const result = await retentionService.setTenantOverride(
    tenantId, category as LogCategory, retentionDays, hotDays, warmDays, userId, reason
  );

  if (!result.success) {
    return json(400, { error: result.error });
  }

  logger.info('Retention override set', { tenantId, category, retentionDays });
  return json(200, { success: true });
}

async function handleRemoveOverride(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });

  const body = event.body ? JSON.parse(event.body) : {};
  const { category } = body;
  if (!category) return json(400, { error: 'category is required' });

  const userId = event.headers?.['x-user-id'] || event.requestContext?.authorizer?.userId as string || '';
  await retentionService.removeTenantOverride(tenantId, category as LogCategory, userId);

  logger.info('Retention override removed', { tenantId, category });
  return json(200, { success: true });
}

async function handleGetSources(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const category = event.queryStringParameters?.category as LogCategory | undefined;
  const isActive = event.queryStringParameters?.isActive === 'true' ? true :
                   event.queryStringParameters?.isActive === 'false' ? false : undefined;

  const sources = await retentionService.getLogSources({ category, isActive });
  return json(200, { sources, total: sources.length });
}

async function handleGetCoverage(): Promise<APIGatewayProxyResult> {
  const coverage = await getLoggingCoverageReport(pool);
  return json(200, { coverage });
}

async function handleGetIndex(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const category = event.queryStringParameters?.category as LogCategory | null || null;
  const startTime = event.queryStringParameters?.startTime || new Date(Date.now() - 86400000).toISOString();
  const endTime = event.queryStringParameters?.endTime || new Date().toISOString();
  const tier = event.queryStringParameters?.tier as any || undefined;
  const limit = parseInt(event.queryStringParameters?.limit || '100');

  const entries = await retentionService.getLogIndexEntries(
    tenantId || null, category, startTime, endTime, tier, limit
  );
  return json(200, { entries, total: entries.length });
}

async function handleRunIndexer(): Promise<APIGatewayProxyResult> {
  logger.info('Manual indexer run triggered');
  const result = await indexerService.runHourlyIndex();
  logger.info('Indexer run complete', {
    sourcesProcessed: result.sourcesProcessed,
    eventsIndexed: result.eventsIndexed,
    durationMs: result.durationMs,
  });
  return json(200, { result });
}

async function handleGetCompliance(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const keys = event.queryStringParameters?.keys?.split(',') || ['none'];
  const requirements = await retentionService.getComplianceRequirements(keys);
  return json(200, { requirements });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

async function handleSearch(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const q = event.queryStringParameters?.q;
  if (!q) return json(400, { error: 'q (search query) is required' });

  const category = event.queryStringParameters?.category || null;
  const level = event.queryStringParameters?.level || null;
  const limit = parseInt(event.queryStringParameters?.limit || '100');

  let query = `SELECT * FROM log_search_entries WHERE search_vector @@ plainto_tsquery('english', $1)`;
  const params: unknown[] = [q];
  let idx = 2;

  if (tenantId) {
    query += ` AND (tenant_id = $${idx} OR tenant_id IS NULL)`;
    params.push(tenantId);
    idx++;
  }
  if (category) {
    query += ` AND category = $${idx}::log_category`;
    params.push(category);
    idx++;
  }
  if (level) {
    query += ` AND level = $${idx}`;
    params.push(level);
    idx++;
  }

  query += ` ORDER BY timestamp DESC LIMIT $${idx}`;
  params.push(limit);

  const countResult = await pool.query(
    query.replace('SELECT *', 'SELECT COUNT(*)').replace(/ORDER BY.*$/, ''),
    params.slice(0, -1)
  );
  const result = await pool.query(query, params);

  return json(200, {
    results: result.rows.map((r: Record<string, unknown>) => ({
      id: r.id, tenantId: r.tenant_id, category: r.category,
      timestamp: r.timestamp, level: r.level, service: r.service,
      message: r.message, requestId: r.request_id, userId: r.user_id,
      metadata: r.metadata,
    })),
    total: parseInt(countResult.rows[0].count as string),
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

async function handleListReports(tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const result = await reportService.listReports(tenantId);
  return json(200, result);
}

async function handleGenerateReport(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = event.headers?.['x-user-id'] || 'admin';
  const report = await reportService.generateReport({
    tenantId,
    reportType: body.reportType || 'compliance_summary',
    title: body.title,
    description: body.description,
    dateRangeStart: body.dateRangeStart,
    dateRangeEnd: body.dateRangeEnd,
    categories: body.categories,
    complianceKeys: body.complianceKeys,
    parameters: body.parameters,
    generatedBy: userId,
  });
  return json(200, { report });
}

async function handleReportDownload(reportId: string): Promise<APIGatewayProxyResult> {
  const url = await reportService.getReportDownloadUrl(reportId);
  if (!url) return json(404, { error: 'Report not found or not ready' });
  return json(200, { url });
}

// ---------------------------------------------------------------------------
// Glacier Restore
// ---------------------------------------------------------------------------

async function handleListRestoreJobs(tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const result = await restoreService.listJobs(tenantId);
  return json(200, result);
}

async function handleCreateRestoreJob(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = event.headers?.['x-user-id'] || 'admin';
  const job = await restoreService.createRestoreJob({
    tenantId,
    restoreType: body.restoreType || 'date_range',
    categories: body.categories,
    dateRangeStart: body.dateRangeStart,
    dateRangeEnd: body.dateRangeEnd,
    logIndexIds: body.logIndexIds,
    retrievalTier: body.retrievalTier,
    requestedBy: userId,
    requestReason: body.requestReason,
  });
  return json(200, { job });
}

async function handleProcessRestoreJob(jobId: string): Promise<APIGatewayProxyResult> {
  await restoreService.processRestoreJob(jobId);
  const job = await restoreService.getJob(jobId);
  return json(200, { job });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

async function handleListExportJobs(tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const result = await exportService.listJobs(tenantId);
  return json(200, result);
}

async function handleCreateExportJob(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = event.headers?.['x-user-id'] || 'admin';
  const job = await exportService.createExportJob({
    tenantId,
    exportName: body.exportName,
    categories: body.categories,
    dateRangeStart: body.dateRangeStart,
    dateRangeEnd: body.dateRangeEnd,
    includeAllTime: body.includeAllTime,
    searchQuery: body.searchQuery,
    format: body.format,
    includesHot: body.includesHot,
    includesWarm: body.includesWarm,
    includesCold: body.includesCold,
    includesDeep: body.includesDeep,
    glacierRestoreJobId: body.glacierRestoreJobId,
    requestedBy: userId,
    requestReason: body.requestReason,
  });
  return json(200, { job });
}

async function handleExportDownload(jobId: string): Promise<APIGatewayProxyResult> {
  const url = await exportService.getDownloadUrl(jobId);
  if (!url) return json(404, { error: 'Export not found or not ready' });
  return json(200, { url });
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

async function handleVerificationStatus(): Promise<APIGatewayProxyResult> {
  const chainStatus = await verificationService.getChainStatus();
  return json(200, { chainStatus });
}

async function handleVerifyFullChain(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.headers?.['x-user-id'] || 'admin';
  const result = await verificationService.verifyFullChain(userId);
  logger.info('Full chain verification complete', { status: result.status, entriesChecked: result.entriesChecked });
  return json(200, { result });
}

// ---------------------------------------------------------------------------
// GDPR Erasure
// ---------------------------------------------------------------------------

async function handleListErasureRequests(tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const result = await erasureService.listRequests(tenantId);
  return json(200, result);
}

async function handleCreateErasureRequest(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  if (!tenantId) return json(400, { error: 'tenantId is required' });
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = event.headers?.['x-user-id'] || 'admin';
  const request = await erasureService.createErasureRequest({
    tenantId,
    targetUserId: body.targetUserId,
    targetTenantId: body.targetTenantId,
    categories: body.categories || [],
    dateRangeStart: body.dateRangeStart,
    dateRangeEnd: body.dateRangeEnd,
    legalBasis: body.legalBasis,
    dataSubjectRequestId: body.dataSubjectRequestId,
    requestedBy: userId,
  });
  return json(200, { request });
}

async function handleApproveErasure(event: APIGatewayProxyEvent, requestId: string): Promise<APIGatewayProxyResult> {
  const userId = event.headers?.['x-user-id'] || 'admin';
  await erasureService.approveErasure(requestId, userId);
  logger.info('Erasure request approved', { requestId, approvedBy: userId });
  return json(200, { success: true });
}

async function handleExecuteErasure(requestId: string): Promise<APIGatewayProxyResult> {
  await erasureService.executeErasure(requestId);
  const request = await erasureService.getRequest(requestId);
  logger.info('Erasure executed', { requestId, status: request?.status });
  return json(200, { request });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
