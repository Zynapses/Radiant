/**
 * RADIANT v5.43.0 - Decision Artifacts Lambda Handler
 * 
 * API endpoints for the DIA Engine - Glass Box Decision Records
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { 
  generateArtifact, 
  checkStaleness, 
  validateArtifact,
  exportArtifact,
  getValidationHistory,
  getExportHistory,
} from '../shared/services/dia';
import {
  DecisionArtifact,
  DecisionArtifactSummary,
  GenerateArtifactRequest,
  ListArtifactsRequest,
  ExportArtifactRequest,
  ValidateArtifactRequest,
  DIADashboardMetrics,
} from '@radiant/shared';

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = event.requestContext?.authorizer?.tenantId;
    const userId = event.requestContext?.authorizer?.userId || 'system';

    if (!tenantId) {
      return response(400, { error: 'Tenant ID required' });
    }

    const path = event.path
      .replace('/api/thinktank/decision-artifacts', '')
      .replace('/thinktank/decision-artifacts', '');
    const method = event.httpMethod;

    // Route handling
    if (path === '' || path === '/') {
      if (method === 'GET') return listArtifacts(tenantId, userId, event);
      if (method === 'POST') return createArtifact(tenantId, userId, event);
    }

    if (path === '/dashboard') {
      if (method === 'GET') return getDashboard(tenantId);
    }

    if (path === '/templates') {
      if (method === 'GET') return listTemplates(tenantId);
    }

    if (path === '/config') {
      if (method === 'GET') return getConfig(tenantId);
      if (method === 'PUT') return updateConfig(tenantId, event);
    }

    // Dynamic routes
    const artifactMatch = path.match(/^\/([a-f0-9-]+)$/);
    if (artifactMatch) {
      const artifactId = artifactMatch[1];
      if (method === 'GET') return getArtifact(tenantId, userId, artifactId);
      if (method === 'DELETE') return deleteArtifact(tenantId, artifactId);
    }

    const stalenessMatch = path.match(/^\/([a-f0-9-]+)\/staleness$/);
    if (stalenessMatch && method === 'GET') {
      return checkArtifactStaleness(tenantId, stalenessMatch[1]);
    }

    const validateMatch = path.match(/^\/([a-f0-9-]+)\/validate$/);
    if (validateMatch && method === 'POST') {
      return validateArtifactHandler(tenantId, userId, validateMatch[1], event);
    }

    const exportMatch = path.match(/^\/([a-f0-9-]+)\/export$/);
    if (exportMatch && method === 'POST') {
      return exportArtifactHandler(tenantId, userId, exportMatch[1], event);
    }

    const versionsMatch = path.match(/^\/([a-f0-9-]+)\/versions$/);
    if (versionsMatch && method === 'GET') {
      return getVersionHistory(tenantId, versionsMatch[1]);
    }

    const validationHistoryMatch = path.match(/^\/([a-f0-9-]+)\/validation-history$/);
    if (validationHistoryMatch && method === 'GET') {
      return getArtifactValidationHistory(tenantId, validationHistoryMatch[1]);
    }

    const exportHistoryMatch = path.match(/^\/([a-f0-9-]+)\/export-history$/);
    if (exportHistoryMatch && method === 'GET') {
      return getArtifactExportHistory(tenantId, exportHistoryMatch[1]);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Decision Artifacts handler error:', error);
    return response(500, { 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// List Artifacts
// ============================================================================

async function listArtifacts(
  tenantId: string,
  userId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit || '20', 10), 100);
  const offset = parseInt(params.offset || '0', 10);
  const status = params.status;
  const conversationId = params.conversationId;

  let sql = `
    SELECT id, conversation_id, title, status, validation_status, version,
           jsonb_array_length(COALESCE(artifact_content->'claims', '[]'::jsonb)) as claim_count,
           jsonb_array_length(COALESCE(artifact_content->'dissent_events', '[]'::jsonb)) as dissent_count,
           (artifact_content->'metrics'->>'overall_confidence')::decimal as overall_confidence,
           phi_detected, pii_detected, primary_domain, created_at, updated_at
    FROM decision_artifacts
    WHERE tenant_id = $1 AND user_id = $2
  `;
  const sqlParams = [
    stringParam('tenantId', tenantId),
    stringParam('userId', userId),
  ];
  let paramIndex = 3;

  if (status) {
    sql += ` AND status = $${paramIndex}`;
    sqlParams.push(stringParam('status', status));
    paramIndex++;
  }

  if (conversationId) {
    sql += ` AND conversation_id = $${paramIndex}`;
    sqlParams.push(stringParam('conversationId', conversationId));
    paramIndex++;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  sqlParams.push(longParam('limit', limit));
  sqlParams.push(longParam('offset', offset));

  const result = await executeStatement<Record<string, unknown>>(sql, sqlParams);

  // Get total count
  let countSql = `SELECT COUNT(*) as total FROM decision_artifacts WHERE tenant_id = $1 AND user_id = $2`;
  const countParams = [stringParam('tenantId', tenantId), stringParam('userId', userId)];
  
  if (status) {
    countSql += ` AND status = $3`;
    countParams.push(stringParam('status', status));
  }

  const countResult = await executeStatement<{ total: number }>(countSql, countParams);
  const total = Number(countResult.rows[0]?.total) || 0;

  return response(200, {
    artifacts: result.rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      title: row.title,
      status: row.status,
      validationStatus: row.validation_status,
      version: row.version,
      claimCount: Number(row.claim_count) || 0,
      dissentCount: Number(row.dissent_count) || 0,
      overallConfidence: Number(row.overall_confidence) || 0,
      phiDetected: row.phi_detected,
      piiDetected: row.pii_detected,
      primaryDomain: row.primary_domain,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    total,
    hasMore: offset + result.rows.length < total,
  });
}

// ============================================================================
// Create Artifact
// ============================================================================

async function createArtifact(
  tenantId: string,
  userId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as GenerateArtifactRequest;

  if (!body.conversationId) {
    return response(400, { error: 'conversationId is required' });
  }

  // Check if artifact already exists for this conversation
  const existing = await executeStatement<{ id: string }>(
    `SELECT id FROM decision_artifacts 
     WHERE conversation_id = $1 AND tenant_id = $2 AND status = 'active'`,
    [stringParam('conversationId', body.conversationId), stringParam('tenantId', tenantId)]
  );

  if (existing.rows.length > 0) {
    return response(409, { 
      error: 'Active artifact already exists for this conversation',
      existingId: existing.rows[0].id,
    });
  }

  const artifact = await generateArtifact({
    conversationId: body.conversationId,
    userId,
    tenantId,
    title: body.title,
    templateId: body.templateId,
  });

  return response(201, { artifact });
}

// ============================================================================
// Get Artifact
// ============================================================================

async function getArtifact(
  tenantId: string,
  userId: string,
  artifactId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement<Record<string, unknown>>(
    `SELECT * FROM decision_artifacts WHERE id = $1 AND tenant_id = $2`,
    [stringParam('id', artifactId), stringParam('tenantId', tenantId)]
  );

  if (result.rows.length === 0) {
    return response(404, { error: 'Artifact not found' });
  }

  const row = result.rows[0] as any;
  
  // Log access
  await executeStatement(
    `INSERT INTO decision_artifact_access_log (artifact_id, tenant_id, user_id, action)
     VALUES ($1, $2, $3, 'viewed')`,
    [stringParam('artifactId', artifactId), stringParam('tenantId', tenantId), stringParam('userId', userId)]
  );

  // Parse JSONB fields
  const artifact: DecisionArtifact = {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    version: row.version,
    parentArtifactId: row.parent_artifact_id,
    artifactContent: typeof row.artifact_content === 'string' 
      ? JSON.parse(row.artifact_content) 
      : row.artifact_content,
    minerModel: row.miner_model,
    extractionConfidence: row.extraction_confidence,
    extractionTimestamp: row.extraction_timestamp,
    lastValidatedAt: row.last_validated_at,
    validationStatus: row.validation_status,
    stalenessThresholdDays: row.staleness_threshold_days,
    heatmapData: typeof row.heatmap_data === 'string'
      ? JSON.parse(row.heatmap_data)
      : row.heatmap_data || [],
    complianceFrameworks: row.compliance_frameworks || [],
    phiDetected: row.phi_detected,
    piiDetected: row.pii_detected,
    dataClassification: row.data_classification,
    primaryDomain: row.primary_domain,
    secondaryDomains: row.secondary_domains || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    frozenAt: row.frozen_at,
    frozenBy: row.frozen_by,
    contentHash: row.content_hash,
    signatureTimestamp: row.signature_timestamp,
  };

  return response(200, { artifact });
}

// ============================================================================
// Delete Artifact
// ============================================================================

async function deleteArtifact(
  tenantId: string,
  artifactId: string
): Promise<APIGatewayProxyResult> {
  // Soft delete - set status to archived
  await executeStatement(
    `UPDATE decision_artifacts SET status = 'archived', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [stringParam('id', artifactId), stringParam('tenantId', tenantId)]
  );

  return response(200, { success: true });
}

// ============================================================================
// Check Staleness
// ============================================================================

async function checkArtifactStaleness(
  tenantId: string,
  artifactId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement<{ artifact_content: string }>(
    `SELECT artifact_content FROM decision_artifacts WHERE id = $1 AND tenant_id = $2`,
    [stringParam('id', artifactId), stringParam('tenantId', tenantId)]
  );

  if (result.rows.length === 0) {
    return response(404, { error: 'Artifact not found' });
  }

  const content = typeof result.rows[0].artifact_content === 'string'
    ? JSON.parse(result.rows[0].artifact_content)
    : result.rows[0].artifact_content;

  const staleness = checkStaleness({ artifactContent: content } as any);

  return response(200, staleness);
}

// ============================================================================
// Validate Artifact
// ============================================================================

async function validateArtifactHandler(
  tenantId: string,
  userId: string,
  artifactId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as ValidateArtifactRequest;

  const validationResult = await validateArtifact({
    artifactId,
    tenantId,
    userId,
    queryIds: body.queryIds,
  });

  return response(200, validationResult);
}

// ============================================================================
// Export Artifact
// ============================================================================

async function exportArtifactHandler(
  tenantId: string,
  userId: string,
  artifactId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as ExportArtifactRequest;

  if (!body.format) {
    return response(400, { error: 'format is required' });
  }

  // Get artifact
  const result = await executeStatement<Record<string, unknown>>(
    `SELECT * FROM decision_artifacts WHERE id = $1 AND tenant_id = $2`,
    [stringParam('id', artifactId), stringParam('tenantId', tenantId)]
  );

  if (result.rows.length === 0) {
    return response(404, { error: 'Artifact not found' });
  }

  const row = result.rows[0] as any;
  const artifact = {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    artifactContent: typeof row.artifact_content === 'string'
      ? JSON.parse(row.artifact_content)
      : row.artifact_content,
    heatmapData: typeof row.heatmap_data === 'string'
      ? JSON.parse(row.heatmap_data)
      : row.heatmap_data || [],
    complianceFrameworks: row.compliance_frameworks || [],
    secondaryDomains: row.secondary_domains || [],
  } as any;

  const exportResult = await exportArtifact({
    artifact,
    request: body,
    userId,
    tenantId,
  });

  return response(200, exportResult);
}

// ============================================================================
// Version History
// ============================================================================

async function getVersionHistory(
  tenantId: string,
  artifactId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement<{
    artifact_id: string;
    version: number;
    status: string;
    created_at: string;
    frozen_at: string | null;
    content_hash: string | null;
  }>(
    `SELECT * FROM get_decision_artifact_version_history($1)`,
    [stringParam('artifactId', artifactId)]
  );

  return response(200, { versions: result.rows });
}

// ============================================================================
// Validation History
// ============================================================================

async function getArtifactValidationHistory(
  tenantId: string,
  artifactId: string
): Promise<APIGatewayProxyResult> {
  const history = await getValidationHistory(artifactId, tenantId);
  return response(200, { history });
}

// ============================================================================
// Export History
// ============================================================================

async function getArtifactExportHistory(
  tenantId: string,
  artifactId: string
): Promise<APIGatewayProxyResult> {
  const history = await getExportHistory(artifactId, tenantId);
  return response(200, { history });
}

// ============================================================================
// Dashboard
// ============================================================================

async function getDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  // Get aggregate metrics
  const metricsResult = await executeStatement<{
    total: number;
    active: number;
    frozen: number;
    stale: number;
    with_phi: number;
    with_pii: number;
    avg_confidence: number;
  }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'active') as active,
       COUNT(*) FILTER (WHERE status = 'frozen') as frozen,
       COUNT(*) FILTER (WHERE validation_status = 'stale') as stale,
       COUNT(*) FILTER (WHERE phi_detected = true) as with_phi,
       COUNT(*) FILTER (WHERE pii_detected = true) as with_pii,
       COALESCE(AVG(extraction_confidence), 0) as avg_confidence
     FROM decision_artifacts
     WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)]
  );

  // Get validation costs (month to date)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const costResult = await executeStatement<{ total_cost: number }>(
    `SELECT COALESCE(SUM(api_cost_cents), 0) as total_cost
     FROM decision_artifact_validation_log
     WHERE tenant_id = $1 AND validated_at >= $2`,
    [stringParam('tenantId', tenantId), stringParam('startDate', startOfMonth.toISOString())]
  );

  // Get top domains
  const domainsResult = await executeStatement<{ domain: string; count: number }>(
    `SELECT primary_domain as domain, COUNT(*) as count
     FROM decision_artifacts
     WHERE tenant_id = $1 AND primary_domain IS NOT NULL AND primary_domain != ''
     GROUP BY primary_domain
     ORDER BY count DESC
     LIMIT 10`,
    [stringParam('tenantId', tenantId)]
  );

  // Get compliance framework usage
  const complianceResult = await executeStatement<{ framework: string; count: number }>(
    `SELECT unnest(compliance_frameworks) as framework, COUNT(*) as count
     FROM decision_artifacts
     WHERE tenant_id = $1 AND array_length(compliance_frameworks, 1) > 0
     GROUP BY framework
     ORDER BY count DESC`,
    [stringParam('tenantId', tenantId)]
  );

  // Get artifacts by day (last 30 days)
  const artifactsByDayResult = await executeStatement<{ date: string; count: number }>(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM decision_artifacts
     WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [stringParam('tenantId', tenantId)]
  );

  const metrics = metricsResult.rows[0];
  const dashboard: DIADashboardMetrics = {
    totalArtifacts: Number(metrics?.total) || 0,
    activeArtifacts: Number(metrics?.active) || 0,
    frozenArtifacts: Number(metrics?.frozen) || 0,
    averageConfidence: Number(metrics?.avg_confidence) || 0,
    artifactsWithPhi: Number(metrics?.with_phi) || 0,
    artifactsWithPii: Number(metrics?.with_pii) || 0,
    validationCostMtd: Number(costResult.rows[0]?.total_cost) || 0,
    staleArtifacts: Number(metrics?.stale) || 0,
    topDomains: domainsResult.rows.map(r => ({ domain: r.domain, count: Number(r.count) })),
    complianceFrameworkUsage: complianceResult.rows.map(r => ({ framework: r.framework, count: Number(r.count) })),
    artifactsByDay: artifactsByDayResult.rows.map(r => ({ date: r.date, count: Number(r.count) })),
    validationActivity: [], // Would need separate query
  };

  return response(200, { dashboard });
}

// ============================================================================
// Templates
// ============================================================================

async function listTemplates(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM decision_artifact_templates
     WHERE tenant_id = $1 OR is_system = true
     ORDER BY is_system DESC, name ASC`,
    [stringParam('tenantId', tenantId)]
  );

  return response(200, { templates: result.rows });
}

// ============================================================================
// Config
// ============================================================================

async function getConfig(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM decision_artifact_config WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)]
  );

  if (result.rows.length === 0) {
    // Return defaults
    return response(200, {
      config: {
        diaEnabled: true,
        autoGenerateEnabled: false,
        phiDetectionEnabled: true,
        piiDetectionEnabled: true,
        defaultStalenessThresholdDays: 7,
        maxArtifactsPerUser: 0,
        extractionModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      },
    });
  }

  return response(200, { config: result.rows[0] });
}

async function updateConfig(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  // Upsert config
  await executeStatement(
    `INSERT INTO decision_artifact_config (tenant_id, dia_enabled, auto_generate_enabled, 
       phi_detection_enabled, pii_detection_enabled, default_staleness_threshold_days)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id) DO UPDATE SET
       dia_enabled = EXCLUDED.dia_enabled,
       auto_generate_enabled = EXCLUDED.auto_generate_enabled,
       phi_detection_enabled = EXCLUDED.phi_detection_enabled,
       pii_detection_enabled = EXCLUDED.pii_detection_enabled,
       default_staleness_threshold_days = EXCLUDED.default_staleness_threshold_days,
       updated_at = NOW()`,
    [
      stringParam('tenantId', tenantId),
      stringParam('diaEnabled', body.diaEnabled !== false ? 'true' : 'false'),
      stringParam('autoGenerate', body.autoGenerateEnabled ? 'true' : 'false'),
      stringParam('phiDetection', body.phiDetectionEnabled !== false ? 'true' : 'false'),
      stringParam('piiDetection', body.piiDetectionEnabled !== false ? 'true' : 'false'),
      longParam('staleness', body.defaultStalenessThresholdDays || 7),
    ]
  );

  return response(200, { success: true });
}
