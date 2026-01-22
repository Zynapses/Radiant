/**
 * RADIANT v5.30.0 - Code Quality & Test Coverage Admin API
 * 
 * Provides endpoints for monitoring test coverage, technical debt,
 * and JSON safety migration progress.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';
import { enhancedLogger } from '../shared/logging/enhanced-logger';
import { createResponse, createErrorResponse } from '../shared/utils/response';

const logger = enhancedLogger;

// ============================================================================
// Types
// ============================================================================

interface CodeQualitySnapshot {
  id: string;
  snapshotType: string;
  component: string;
  totalFiles: number;
  filesWithTests: number;
  lineCoverage: number;
  functionCoverage: number;
  branchCoverage: number;
  overallCoverage: number;
  eslintErrors: number;
  eslintWarnings: number;
  todoCount: number;
  fixmeCount: number;
  anyTypeCount: number;
  unsafeJsonParseCount: number;
  safeJsonCalls: number;
  unsafeJsonCalls: number;
  jsonSafetyPercentage: number;
  capturedAt: string;
}

interface TechnicalDebtItem {
  id: string;
  debtId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  filePaths: string[];
  component: string;
  estimatedHours: number;
  actualHours: number;
  resolvedAt: string | null;
}

interface CodeQualityAlert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  component: string;
  status: string;
  createdAt: string;
}

interface DashboardResponse {
  summary: {
    overallCoverage: number;
    componentsWithTests: number;
    totalComponents: number;
    openDebtItems: number;
    criticalAlerts: number;
    jsonSafetyProgress: number;
  };
  coverageByComponent: Array<{
    component: string;
    lineCoverage: number;
    functionCoverage: number;
    branchCoverage: number;
    overallCoverage: number;
    capturedAt: string;
  }>;
  recentAlerts: CodeQualityAlert[];
  debtSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    totalEstimatedHours: number;
  };
  trends: {
    coverageTrend: number; // percentage change
    debtTrend: number; // count change
  };
}

// ============================================================================
// Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace(/^\/api\/admin\/code-quality/, '');
  const method = event.httpMethod;

  try {
    // Dashboard overview
    if (path === '/dashboard' && method === 'GET') {
      return await getDashboard(event);
    }

    // Test coverage
    if (path === '/coverage' && method === 'GET') {
      return await getCoverage(event);
    }
    if (path === '/coverage/history' && method === 'GET') {
      return await getCoverageHistory(event);
    }

    // Technical debt
    if (path === '/debt' && method === 'GET') {
      return await getTechnicalDebt(event);
    }
    if (path.match(/^\/debt\/[^/]+$/) && method === 'PUT') {
      return await updateDebtItem(event);
    }

    // JSON safety migration
    if (path === '/json-safety' && method === 'GET') {
      return await getJsonSafetyProgress(event);
    }
    if (path === '/json-safety/locations' && method === 'GET') {
      return await getJsonParseLocations(event);
    }

    // Alerts
    if (path === '/alerts' && method === 'GET') {
      return await getAlerts(event);
    }
    if (path.match(/^\/alerts\/[^/]+\/acknowledge$/) && method === 'POST') {
      return await acknowledgeAlert(event);
    }
    if (path.match(/^\/alerts\/[^/]+\/resolve$/) && method === 'POST') {
      return await resolveAlert(event);
    }

    // Files needing tests
    if (path === '/files-needing-tests' && method === 'GET') {
      return await getFilesNeedingTests(event);
    }

    return createErrorResponse('Not found', 404);
  } catch (error) {
    logger.error('Code quality API error', { error, path, method });
    return createErrorResponse('Internal server error', 500);
  }
}

// ============================================================================
// Dashboard
// ============================================================================

async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || null;

  // Get latest coverage by component
  const coverageResult = await executeStatement(`
    SELECT DISTINCT ON (component)
      component,
      line_coverage,
      function_coverage,
      branch_coverage,
      overall_coverage,
      captured_at
    FROM code_quality_snapshots
    WHERE snapshot_type = 'test_coverage'
      AND ($1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID)
    ORDER BY component, captured_at DESC
  `, [stringParam('tenantId', tenantId)]);

  const coverageByComponent = (coverageResult.rows || []).map((row: Record<string, unknown>) => ({
    component: row.component as string,
    lineCoverage: Number(row.line_coverage) || 0,
    functionCoverage: Number(row.function_coverage) || 0,
    branchCoverage: Number(row.branch_coverage) || 0,
    overallCoverage: Number(row.overall_coverage) || 0,
    capturedAt: row.captured_at as string,
  }));

  // Calculate overall coverage
  const overallCoverage = coverageByComponent.length > 0
    ? coverageByComponent.reduce((sum, c) => sum + c.overallCoverage, 0) / coverageByComponent.length
    : 0;

  // Get debt summary
  const debtResult = await executeStatement(`
    SELECT
      COUNT(*) FILTER (WHERE priority = 'p0_critical' AND status IN ('open', 'in_progress')) AS critical_count,
      COUNT(*) FILTER (WHERE priority = 'p1_high' AND status IN ('open', 'in_progress')) AS high_count,
      COUNT(*) FILTER (WHERE priority = 'p2_medium' AND status IN ('open', 'in_progress')) AS medium_count,
      COUNT(*) FILTER (WHERE priority = 'p3_low' AND status IN ('open', 'in_progress')) AS low_count,
      COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) AS open_count,
      COALESCE(SUM(estimated_hours) FILTER (WHERE status IN ('open', 'in_progress')), 0) AS total_hours
    FROM technical_debt_items
    WHERE $1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID
  `, [stringParam('tenantId', tenantId)]);

  const debtRow = debtResult.rows?.[0] || {};
  const debtSummary = {
    critical: Number(debtRow.critical_count) || 0,
    high: Number(debtRow.high_count) || 0,
    medium: Number(debtRow.medium_count) || 0,
    low: Number(debtRow.low_count) || 0,
    totalEstimatedHours: Number(debtRow.total_hours) || 0,
  };

  // Get recent alerts
  const alertsResult = await executeStatement(`
    SELECT id, alert_type, severity, title, description, component, status, created_at
    FROM code_quality_alerts
    WHERE status = 'active'
      AND ($1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID)
    ORDER BY 
      CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT 10
  `, [stringParam('tenantId', tenantId)]);

  const recentAlerts = (alertsResult.rows || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    alertType: row.alert_type as string,
    severity: row.severity as string,
    title: row.title as string,
    description: row.description as string,
    component: row.component as string,
    status: row.status as string,
    createdAt: row.created_at as string,
  }));

  // Get JSON safety progress
  const jsonResult = await executeStatement(`
    SELECT 
      COALESCE(SUM(safe_json_calls), 0) AS safe_calls,
      COALESCE(SUM(unsafe_json_calls), 0) AS unsafe_calls
    FROM code_quality_snapshots
    WHERE snapshot_type = 'json_safety'
      AND captured_at > NOW() - INTERVAL '7 days'
      AND ($1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID)
  `, [stringParam('tenantId', tenantId)]);

  const jsonRow = jsonResult.rows?.[0] || {};
  const safeCalls = Number(jsonRow.safe_calls) || 0;
  const unsafeCalls = Number(jsonRow.unsafe_calls) || 0;
  const jsonSafetyProgress = safeCalls + unsafeCalls > 0
    ? (safeCalls / (safeCalls + unsafeCalls)) * 100
    : 0;

  const response: DashboardResponse = {
    summary: {
      overallCoverage: Math.round(overallCoverage * 10) / 10,
      componentsWithTests: coverageByComponent.filter(c => c.overallCoverage > 0).length,
      totalComponents: coverageByComponent.length,
      openDebtItems: Number(debtRow.open_count) || 0,
      criticalAlerts: recentAlerts.filter(a => a.severity === 'critical').length,
      jsonSafetyProgress: Math.round(jsonSafetyProgress * 10) / 10,
    },
    coverageByComponent,
    recentAlerts,
    debtSummary,
    trends: {
      coverageTrend: 0, // Would calculate from historical data
      debtTrend: 0,
    },
  };

  return createResponse(response, 200);
}

// ============================================================================
// Coverage
// ============================================================================

async function getCoverage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || null;
  const component = event.queryStringParameters?.component;

  let query = `
    SELECT DISTINCT ON (component)
      id, snapshot_type, component, total_files, files_with_tests,
      total_lines, covered_lines, total_functions, covered_functions,
      line_coverage, function_coverage, branch_coverage, overall_coverage,
      eslint_errors, eslint_warnings, todo_count, fixme_count,
      any_type_count, unsafe_json_parse_count, captured_at
    FROM code_quality_snapshots
    WHERE snapshot_type = 'test_coverage'
      AND ($1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID)
  `;
  
  const params = [stringParam('tenantId', tenantId)];

  if (component) {
    query += ` AND component = $2`;
    params.push(stringParam('component', component));
  }

  query += ` ORDER BY component, captured_at DESC`;

  const result = await executeStatement(query, params as unknown as Parameters<typeof executeStatement>[1]);

  const coverage = (result.rows || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    component: row.component,
    totalFiles: Number(row.total_files) || 0,
    filesWithTests: Number(row.files_with_tests) || 0,
    lineCoverage: Number(row.line_coverage) || 0,
    functionCoverage: Number(row.function_coverage) || 0,
    branchCoverage: Number(row.branch_coverage) || 0,
    overallCoverage: Number(row.overall_coverage) || 0,
    eslintErrors: Number(row.eslint_errors) || 0,
    eslintWarnings: Number(row.eslint_warnings) || 0,
    todoCount: Number(row.todo_count) || 0,
    capturedAt: row.captured_at,
  }));

  return createResponse({ coverage }, 200);
}

async function getCoverageHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || null;
  const component = event.queryStringParameters?.component || 'lambda';
  const days = parseInt(event.queryStringParameters?.days || '30', 10);

  const result = await executeStatement(`
    SELECT 
      DATE_TRUNC('day', captured_at) AS date,
      AVG(line_coverage) AS line_coverage,
      AVG(function_coverage) AS function_coverage,
      AVG(branch_coverage) AS branch_coverage,
      AVG(overall_coverage) AS overall_coverage
    FROM code_quality_snapshots
    WHERE snapshot_type = 'test_coverage'
      AND component = $1
      AND captured_at > NOW() - ($2 || ' days')::INTERVAL
      AND ($3::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $3::UUID)
    GROUP BY DATE_TRUNC('day', captured_at)
    ORDER BY date
  `, [
    stringParam('component', component),
    stringParam('days', days.toString()),
    stringParam('tenantId', tenantId),
  ]);

  const history = (result.rows || []).map((row: Record<string, unknown>) => ({
    date: row.date,
    lineCoverage: Number(row.line_coverage) || 0,
    functionCoverage: Number(row.function_coverage) || 0,
    branchCoverage: Number(row.branch_coverage) || 0,
    overallCoverage: Number(row.overall_coverage) || 0,
  }));

  return createResponse({ history, component, days }, 200);
}

// ============================================================================
// Technical Debt
// ============================================================================

async function getTechnicalDebt(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || null;
  const status = event.queryStringParameters?.status || 'open,in_progress';
  const priority = event.queryStringParameters?.priority;
  const category = event.queryStringParameters?.category;

  const statusList = status.split(',').map(s => s.trim());

  let query = `
    SELECT id, debt_id, title, description, category, priority, status,
           file_paths, component, estimated_hours, actual_hours,
           resolution_notes, resolved_at, created_at, updated_at
    FROM technical_debt_items
    WHERE ($1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID)
      AND status = ANY($2::VARCHAR[])
  `;

  const params: (ReturnType<typeof stringParam> | string[])[] = [
    stringParam('tenantId', tenantId),
    statusList,
  ];

  if (priority) {
    query += ` AND priority = $${params.length + 1}`;
    params.push(stringParam('priority', priority));
  }

  if (category) {
    query += ` AND category = $${params.length + 1}`;
    params.push(stringParam('category', category));
  }

  query += ` ORDER BY 
    CASE priority WHEN 'p0_critical' THEN 1 WHEN 'p1_high' THEN 2 WHEN 'p2_medium' THEN 3 ELSE 4 END,
    created_at DESC`;

  const result = await executeStatement(query, params as unknown as Parameters<typeof executeStatement>[1]);

  const items = (result.rows || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    debtId: row.debt_id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    filePaths: row.file_paths || [],
    component: row.component,
    estimatedHours: Number(row.estimated_hours) || 0,
    actualHours: Number(row.actual_hours) || 0,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return createResponse({ items }, 200);
}

async function updateDebtItem(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const debtId = event.path.split('/').pop();
  const body = JSON.parse(event.body || '{}');
  const tenantId = event.headers['x-tenant-id'] || null;

  const { status, actualHours, resolutionNotes } = body;

  const result = await executeStatement(`
    UPDATE technical_debt_items
    SET 
      status = COALESCE($1, status),
      actual_hours = COALESCE($2, actual_hours),
      resolution_notes = COALESCE($3, resolution_notes),
      resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
      updated_at = NOW()
    WHERE debt_id = $4
      AND ($5::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $5::UUID)
    RETURNING *
  `, [
    stringParam('status', status),
    stringParam('actualHours', actualHours?.toString()),
    stringParam('resolutionNotes', resolutionNotes),
    stringParam('debtId', debtId || ''),
    stringParam('tenantId', tenantId),
  ]);

  if (!result.rows?.length) {
    return createErrorResponse('Debt item not found', 404);
  }

  return createResponse({ item: result.rows[0] }, 200);
}

// ============================================================================
// JSON Safety
// ============================================================================

async function getJsonSafetyProgress(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || null;

  const result = await executeStatement(`
    SELECT 
      component,
      SUM(CASE WHEN is_migrated THEN 1 ELSE 0 END) AS migrated_count,
      COUNT(*) AS total_count,
      ROUND(100.0 * SUM(CASE WHEN is_migrated THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS percentage
    FROM json_parse_locations
    WHERE $1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID
    GROUP BY component
    ORDER BY component
  `, [stringParam('tenantId', tenantId)]);

  const byComponent = (result.rows || []).map((row: Record<string, unknown>) => ({
    component: row.component,
    migratedCount: Number(row.migrated_count) || 0,
    totalCount: Number(row.total_count) || 0,
    percentage: Number(row.percentage) || 0,
  }));

  // Get risk distribution
  const riskResult = await executeStatement(`
    SELECT 
      risk_level,
      COUNT(*) AS count,
      SUM(CASE WHEN is_migrated THEN 1 ELSE 0 END) AS migrated
    FROM json_parse_locations
    WHERE $1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID
    GROUP BY risk_level
    ORDER BY 
      CASE risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
  `, [stringParam('tenantId', tenantId)]);

  const byRisk = (riskResult.rows || []).map((row: Record<string, unknown>) => ({
    riskLevel: row.risk_level,
    count: Number(row.count) || 0,
    migrated: Number(row.migrated) || 0,
  }));

  return createResponse({ byComponent, byRisk }, 200);
}

async function getJsonParseLocations(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || null;
  const migrated = event.queryStringParameters?.migrated;
  const riskLevel = event.queryStringParameters?.riskLevel;
  const component = event.queryStringParameters?.component;

  let query = `
    SELECT id, file_path, line_number, component, is_migrated,
           migration_type, schema_name, risk_level, context_description,
           detected_at, migrated_at
    FROM json_parse_locations
    WHERE $1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID
  `;

  const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];

  if (migrated !== undefined) {
    query += ` AND is_migrated = $${params.length + 1}`;
    params.push(stringParam('migrated', migrated));
  }

  if (riskLevel) {
    query += ` AND risk_level = $${params.length + 1}`;
    params.push(stringParam('riskLevel', riskLevel));
  }

  if (component) {
    query += ` AND component = $${params.length + 1}`;
    params.push(stringParam('component', component));
  }

  query += ` ORDER BY 
    CASE risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
    file_path, line_number
    LIMIT 500`;

  const result = await executeStatement(query, params as unknown as Parameters<typeof executeStatement>[1]);

  const locations = (result.rows || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    filePath: row.file_path,
    lineNumber: Number(row.line_number),
    component: row.component,
    isMigrated: Boolean(row.is_migrated),
    migrationType: row.migration_type,
    schemaName: row.schema_name,
    riskLevel: row.risk_level,
    contextDescription: row.context_description,
    detectedAt: row.detected_at,
    migratedAt: row.migrated_at,
  }));

  return createResponse({ locations }, 200);
}

// ============================================================================
// Alerts
// ============================================================================

async function getAlerts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || null;
  const status = event.queryStringParameters?.status || 'active';

  const result = await executeStatement(`
    SELECT id, alert_type, severity, title, description, component,
           file_path, metric_name, previous_value, current_value, threshold_value,
           status, acknowledged_by, acknowledged_at, resolved_at, resolution_notes,
           created_at
    FROM code_quality_alerts
    WHERE status = $1
      AND ($2::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $2::UUID)
    ORDER BY 
      CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT 100
  `, [
    stringParam('status', status),
    stringParam('tenantId', tenantId),
  ]);

  const alerts = (result.rows || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    alertType: row.alert_type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    component: row.component,
    filePath: row.file_path,
    metricName: row.metric_name,
    previousValue: row.previous_value,
    currentValue: row.current_value,
    thresholdValue: row.threshold_value,
    status: row.status,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
  }));

  return createResponse({ alerts }, 200);
}

async function acknowledgeAlert(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const alertId = event.path.split('/')[4]; // /alerts/{id}/acknowledge
  const tenantId = event.headers['x-tenant-id'] || null;
  const body = JSON.parse(event.body || '{}');

  const result = await executeStatement(`
    UPDATE code_quality_alerts
    SET status = 'acknowledged',
        acknowledged_by = $1,
        acknowledged_at = NOW(),
        updated_at = NOW()
    WHERE id = $2::UUID
      AND ($3::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $3::UUID)
    RETURNING *
  `, [
    stringParam('acknowledgedBy', body.acknowledgedBy || 'admin'),
    stringParam('alertId', alertId),
    stringParam('tenantId', tenantId),
  ]);

  if (!result.rows?.length) {
    return createErrorResponse('Alert not found', 404);
  }

  return createResponse({ alert: result.rows[0] }, 200);
}

async function resolveAlert(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const alertId = event.path.split('/')[4]; // /alerts/{id}/resolve
  const tenantId = event.headers['x-tenant-id'] || null;
  const body = JSON.parse(event.body || '{}');

  const result = await executeStatement(`
    UPDATE code_quality_alerts
    SET status = 'resolved',
        resolved_at = NOW(),
        resolution_notes = $1,
        updated_at = NOW()
    WHERE id = $2::UUID
      AND ($3::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $3::UUID)
    RETURNING *
  `, [
    stringParam('resolutionNotes', body.resolutionNotes || ''),
    stringParam('alertId', alertId),
    stringParam('tenantId', tenantId),
  ]);

  if (!result.rows?.length) {
    return createErrorResponse('Alert not found', 404);
  }

  return createResponse({ alert: result.rows[0] }, 200);
}

// ============================================================================
// Files Needing Tests
// ============================================================================

async function getFilesNeedingTests(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || null;
  const component = event.queryStringParameters?.component;
  const priority = event.queryStringParameters?.priority;

  let query = `
    SELECT id, file_path, component, has_tests, test_file_path, test_count,
           line_coverage, function_coverage, lines_of_code, complexity_score,
           priority, last_test_run
    FROM test_file_registry
    WHERE needs_tests = TRUE
      AND ($1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID)
  `;

  const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];

  if (component) {
    query += ` AND component = $${params.length + 1}`;
    params.push(stringParam('component', component));
  }

  if (priority) {
    query += ` AND priority = $${params.length + 1}`;
    params.push(stringParam('priority', priority));
  }

  query += ` ORDER BY 
    CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
    lines_of_code DESC
    LIMIT 100`;

  const result = await executeStatement(query, params as unknown as Parameters<typeof executeStatement>[1]);

  const files = (result.rows || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    filePath: row.file_path,
    component: row.component,
    hasTests: Boolean(row.has_tests),
    testFilePath: row.test_file_path,
    testCount: Number(row.test_count) || 0,
    lineCoverage: Number(row.line_coverage) || 0,
    functionCoverage: Number(row.function_coverage) || 0,
    linesOfCode: Number(row.lines_of_code) || 0,
    complexityScore: Number(row.complexity_score) || 0,
    priority: row.priority,
    lastTestRun: row.last_test_run,
  }));

  return createResponse({ files }, 200);
}
