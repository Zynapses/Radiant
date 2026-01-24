/**
 * RADIANT v5.52.15 - Think Tank DIA (Decision Intelligence Artifacts) API
 * 
 * Handles generation and export of compliance-formatted reports from conversations.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { corsHeaders, jsonResponse, errorResponse } from '../shared/middleware/api-response';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { generateArtifact } from '../shared/services/dia/miner.service';
import { exportArtifact } from '../shared/services/dia/compliance-exporter';
import { executeStatement, stringParam } from '../shared/db/client';
import type { DecisionArtifact, ExportArtifactRequest } from '@radiant/shared';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  
  // Extract tenant and user from auth context
  const tenantId = event.requestContext.authorizer?.tenantId || 'default';
  const userId = event.requestContext.authorizer?.userId || 'anonymous';

  try {
    // POST /api/thinktank/dia/generate - Generate artifact from conversation
    if (method === 'POST' && path.endsWith('/generate')) {
      return handleGenerate(event, tenantId, userId);
    }

    // POST /api/thinktank/dia/:id/export - Export artifact in compliance format
    if (method === 'POST' && path.includes('/export')) {
      const artifactId = extractArtifactId(path);
      if (!artifactId) {
        return errorResponse(400, 'Missing artifact ID');
      }
      return handleExport(event, artifactId, tenantId, userId);
    }

    // GET /api/thinktank/dia - List artifacts (optionally by conversation)
    if (method === 'GET' && !path.includes('/export')) {
      return handleList(event, tenantId, userId);
    }

    // GET /api/thinktank/dia/:id - Get single artifact
    if (method === 'GET') {
      const artifactId = extractArtifactId(path);
      if (!artifactId) {
        return errorResponse(400, 'Missing artifact ID');
      }
      return handleGet(artifactId, tenantId);
    }

    return errorResponse(404, 'Not found');

  } catch (error) {
    logger.error('DIA API error', { error: String(error), path, method });
    return errorResponse(500, 'Internal server error');
  }
}

function extractArtifactId(path: string): string | null {
  // Path format: /api/thinktank/dia/{id} or /api/thinktank/dia/{id}/export
  const parts = path.split('/');
  const diaIndex = parts.indexOf('dia');
  if (diaIndex >= 0 && parts[diaIndex + 1] && parts[diaIndex + 1] !== 'generate') {
    return parts[diaIndex + 1];
  }
  return null;
}

async function handleGenerate(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { conversationId, title } = body;

  if (!conversationId) {
    return errorResponse(400, 'conversationId is required');
  }

  logger.info('Generating DIA artifact', { conversationId, tenantId, userId });

  try {
    const artifact = await generateArtifact({
      conversationId,
      userId,
      tenantId,
      title,
    });

    logger.info('DIA artifact generated', { 
      artifactId: artifact.id, 
      claimCount: artifact.artifactContent.claims.length,
      phiDetected: artifact.phiDetected,
    });

    return jsonResponse(200, artifact);

  } catch (error) {
    logger.error('Failed to generate artifact', { error: String(error), conversationId });
    return errorResponse(500, 'Failed to generate decision record');
  }
}

async function handleExport(
  event: APIGatewayProxyEvent,
  artifactId: string,
  tenantId: string,
  userId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as ExportArtifactRequest;
  const { format, redactPhi = true } = body;

  if (!format) {
    return errorResponse(400, 'format is required');
  }

  // Fetch the artifact
  const result = await executeStatement<DecisionArtifact>(
    `SELECT * FROM decision_artifacts WHERE id = $1 AND tenant_id = $2`,
    [stringParam('id', artifactId), stringParam('tenantId', tenantId)]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Artifact not found');
  }

  const artifact = result.rows[0];

  logger.info('Exporting artifact', { artifactId, format, redactPhi });

  try {
    const exportResult = await exportArtifact({
      artifact,
      request: { format, redactPhi },
      userId,
      tenantId,
    });

    // Log the export for audit
    await executeStatement(
      `INSERT INTO dia_export_log (artifact_id, user_id, tenant_id, format, redact_phi)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        stringParam('artifactId', artifactId),
        stringParam('userId', userId),
        stringParam('tenantId', tenantId),
        stringParam('format', format),
        stringParam('redactPhi', String(redactPhi)),
      ]
    );

    return jsonResponse(200, exportResult);

  } catch (error) {
    logger.error('Failed to export artifact', { error: String(error), artifactId, format });
    return errorResponse(500, 'Failed to export');
  }
}

async function handleList(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId: string
): Promise<APIGatewayProxyResult> {
  const conversationId = event.queryStringParameters?.conversationId;

  let query = `
    SELECT id, conversation_id, title, status, validation_status, version,
           phi_detected, pii_detected, primary_domain, created_at, updated_at
    FROM decision_artifacts
    WHERE tenant_id = $1 AND user_id = $2
  `;
  const params = [
    stringParam('tenantId', tenantId),
    stringParam('userId', userId),
  ];

  if (conversationId) {
    query += ` AND conversation_id = $3`;
    params.push(stringParam('conversationId', conversationId));
  }

  query += ` ORDER BY created_at DESC LIMIT 100`;

  const result = await executeStatement(query, params);

  return jsonResponse(200, { artifacts: result.rows });
}

async function handleGet(
  artifactId: string,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement<DecisionArtifact>(
    `SELECT * FROM decision_artifacts WHERE id = $1 AND tenant_id = $2`,
    [stringParam('id', artifactId), stringParam('tenantId', tenantId)]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'Artifact not found');
  }

  return jsonResponse(200, result.rows[0]);
}
