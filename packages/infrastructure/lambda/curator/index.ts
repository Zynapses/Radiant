/**
 * RADIANT Curator API Lambda Handler
 * Knowledge curation and verification endpoints
 * 
 * Features:
 * - Document ingestion and processing
 * - Knowledge graph management
 * - Entrance Exam verification system
 * - Golden Rules "God Mode" overrides
 * - Chain of Custody audit trail
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDbClient } from '../shared/db';
import { getAuthTenantId, getAuthUserId } from '../shared/utils';
import { createResponse, createErrorResponse } from '../shared/utils/response';
import { GoldenRulesService } from '../shared/services/cortex/golden-rules.service';
import { EntranceExamService } from '../shared/services/cortex/entrance-exam.service';
import {
  CuratorDashboardData,
  CuratorDomain,
  CuratorKnowledgeNode,
  CuratorDocument,
  CuratorVerificationItem,
  GraphVisualizationData,
  GoldenRule,
  EntranceExam,
  ExamResult,
} from '@radiant/shared';

const db = getDbClient();
const goldenRulesService = new GoldenRulesService(db);
const entranceExamService = new EntranceExamService(db);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace(/^\/api\/curator/, '');
  const method = event.httpMethod;

  try {
    const tenantId = getAuthTenantId(event);
    const userId = getAuthUserId(event);

    if (!tenantId) {
      return createErrorResponse('Tenant ID required', 401);
    }

    // Set tenant context for RLS
    await db.query(`SET app.current_tenant_id = '${tenantId}'`);

    // Route handling
    if (path === '/dashboard' && method === 'GET') {
      return getDashboard(tenantId);
    }

    if (path === '/domains' && method === 'GET') {
      return getDomains(tenantId);
    }

    if (path === '/domains' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return createDomain(tenantId, userId, body);
    }

    if (path.match(/^\/domains\/[\w-]+$/) && method === 'GET') {
      const domainId = path.split('/')[2];
      return getDomain(tenantId, domainId);
    }

    if (path.match(/^\/domains\/[\w-]+$/) && method === 'PUT') {
      const domainId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return updateDomain(tenantId, domainId, body);
    }

    if (path.match(/^\/domains\/[\w-]+$/) && method === 'DELETE') {
      const domainId = path.split('/')[2];
      return deleteDomain(tenantId, domainId);
    }

    if (path === '/documents' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getDocuments(tenantId, params);
    }

    if (path === '/documents/upload' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return initiateUpload(tenantId, userId, body);
    }

    if (path.match(/^\/documents\/[\w-]+\/complete$/) && method === 'POST') {
      const documentId = path.split('/')[2];
      return completeUpload(tenantId, documentId);
    }

    if (path === '/verification' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getVerificationQueue(tenantId, params);
    }

    if (path.match(/^\/verification\/[\w-]+\/approve$/) && method === 'POST') {
      const itemId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return approveVerification(tenantId, userId, itemId, body.comment);
    }

    if (path.match(/^\/verification\/[\w-]+\/reject$/) && method === 'POST') {
      const itemId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return rejectVerification(tenantId, userId, itemId, body.comment);
    }

    if (path.match(/^\/verification\/[\w-]+\/defer$/) && method === 'POST') {
      const itemId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return deferVerification(tenantId, userId, itemId, body.comment);
    }

    if (path.match(/^\/verification\/[\w-]+\/correct$/) && method === 'POST') {
      const itemId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return correctVerification(tenantId, userId, itemId, body);
    }

    if (path.match(/^\/verification\/[\w-]+\/resolve-ambiguity$/) && method === 'POST') {
      const itemId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return resolveAmbiguity(tenantId, userId, itemId, body);
    }

    if (path === '/graph' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getKnowledgeGraph(tenantId, params);
    }

    if (path === '/nodes' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getNodes(tenantId, params);
    }

    if (path.match(/^\/nodes\/[\w-]+$/) && method === 'GET') {
      const nodeId = path.split('/')[2];
      return getNode(tenantId, nodeId);
    }

    if (path.match(/^\/nodes\/[\w-]+\/override$/) && method === 'POST') {
      const nodeId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return overrideNode(tenantId, userId, nodeId, body);
    }

    if (path === '/audit' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getAuditLog(tenantId, params);
    }

    // ==========================================================================
    // Golden Rules "God Mode" Endpoints
    // ==========================================================================

    if (path === '/golden-rules' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getGoldenRules(tenantId, params);
    }

    if (path === '/golden-rules' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return createGoldenRule(tenantId, userId, body);
    }

    if (path.match(/^\/golden-rules\/[\w-]+$/) && method === 'DELETE') {
      const ruleId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return deactivateGoldenRule(tenantId, userId, ruleId, body.reason);
    }

    if (path === '/golden-rules/check' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return checkGoldenRuleMatch(tenantId, body);
    }

    // ==========================================================================
    // Entrance Exam Endpoints
    // ==========================================================================

    if (path === '/exams' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getExams(tenantId, params);
    }

    if (path === '/exams' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return generateExam(tenantId, body);
    }

    if (path.match(/^\/exams\/[\w-]+$/) && method === 'GET') {
      const examId = path.split('/')[2];
      return getExam(tenantId, examId);
    }

    if (path.match(/^\/exams\/[\w-]+\/start$/) && method === 'POST') {
      const examId = path.split('/')[2];
      return startExam(tenantId, userId, examId);
    }

    if (path.match(/^\/exams\/[\w-]+\/submit$/) && method === 'POST') {
      const examId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return submitExamAnswer(examId, body);
    }

    if (path.match(/^\/exams\/[\w-]+\/complete$/) && method === 'POST') {
      const examId = path.split('/')[2];
      return completeExam(tenantId, userId, examId);
    }

    // ==========================================================================
    // Chain of Custody Endpoints
    // ==========================================================================

    if (path.match(/^\/chain-of-custody\/[\w-]+$/) && method === 'GET') {
      const factId = path.split('/')[2];
      return getChainOfCustody(tenantId, factId);
    }

    if (path.match(/^\/chain-of-custody\/[\w-]+\/verify$/) && method === 'POST') {
      const factId = path.split('/')[2];
      return verifyFact(tenantId, userId, factId);
    }

    if (path.match(/^\/chain-of-custody\/[\w-]+\/audit$/) && method === 'GET') {
      const factId = path.split('/')[2];
      return getFactAuditTrail(factId);
    }

    // ==========================================================================
    // Data Connectors (Zero-Copy) Endpoints
    // ==========================================================================

    if (path === '/connectors' && method === 'GET') {
      return getConnectors(tenantId);
    }

    if (path === '/connectors' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return createConnector(tenantId, userId, body);
    }

    if (path.match(/^\/connectors\/[\w-]+$/) && method === 'DELETE') {
      const connectorId = path.split('/')[2];
      return deleteConnector(tenantId, connectorId);
    }

    if (path.match(/^\/connectors\/[\w-]+\/sync$/) && method === 'POST') {
      const connectorId = path.split('/')[2];
      return syncConnector(tenantId, connectorId);
    }

    // ==========================================================================
    // Conflict Queue Endpoints
    // ==========================================================================

    if (path === '/conflicts' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getConflicts(tenantId, params);
    }

    if (path.match(/^\/conflicts\/[\w-]+\/resolve$/) && method === 'POST') {
      const conflictId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return resolveConflict(tenantId, userId, conflictId, body);
    }

    // ==========================================================================
    // Time Travel / Version Control Endpoints
    // ==========================================================================

    if (path === '/snapshots' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getSnapshots(tenantId, params);
    }

    if (path.match(/^\/snapshots\/[\w-]+$/) && method === 'GET') {
      const snapshotId = path.split('/')[2];
      return getSnapshot(tenantId, snapshotId);
    }

    if (path.match(/^\/snapshots\/[\w-]+\/restore$/) && method === 'POST') {
      const snapshotId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return restoreSnapshot(tenantId, userId, snapshotId, body);
    }

    if (path === '/graph/at-time' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return getGraphAtTime(tenantId, params);
    }

    // ==========================================================================
    // Domain Schema Endpoints
    // ==========================================================================

    if (path.match(/^\/domains\/[\w-]+\/schema$/) && method === 'GET') {
      const domainId = path.split('/')[2];
      return getDomainSchema(tenantId, domainId);
    }

    if (path.match(/^\/domains\/[\w-]+\/schema$/) && method === 'PUT') {
      const domainId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return updateDomainSchema(tenantId, userId, domainId, body);
    }

    return createErrorResponse('Endpoint not found', 404);
  } catch (error) {
    console.error('Curator API error:', error);
    return createErrorResponse('Internal server error');
  }
};

// =============================================================================
// Dashboard
// =============================================================================

async function getDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  const statsQuery = `
    SELECT 
      (SELECT COUNT(*) FROM curator_knowledge_nodes WHERE tenant_id = $1) as total_nodes,
      (SELECT COUNT(*) FROM curator_documents WHERE tenant_id = $1) as documents_ingested,
      (SELECT COUNT(*) FROM curator_knowledge_nodes WHERE tenant_id = $1 AND status = 'verified') as verified_facts,
      (SELECT COUNT(*) FROM curator_verification_queue WHERE tenant_id = $1 AND status = 'pending') as pending_verification,
      (SELECT COUNT(*) FROM curator_knowledge_nodes WHERE tenant_id = $1 AND status = 'overridden') as overridden_nodes,
      (SELECT COUNT(*) FROM curator_domains WHERE tenant_id = $1) as domain_count
  `;

  const recentActivityQuery = `
    SELECT * FROM curator_audit_log 
    WHERE tenant_id = $1 
    ORDER BY created_at DESC 
    LIMIT 10
  `;

  const pendingQuery = `
    SELECT vq.*, kn.label as node_label, kn.node_type
    FROM curator_verification_queue vq
    JOIN curator_knowledge_nodes kn ON kn.id = vq.node_id
    WHERE vq.tenant_id = $1 AND vq.status = 'pending'
    ORDER BY vq.priority DESC, vq.created_at ASC
    LIMIT 5
  `;

  const topDomainsQuery = `
    SELECT * FROM curator_domains 
    WHERE tenant_id = $1 AND parent_id IS NULL
    ORDER BY node_count DESC
    LIMIT 5
  `;

  const [statsResult, activityResult, pendingResult, domainsResult] = await Promise.all([
    db.query(statsQuery, [tenantId]),
    db.query(recentActivityQuery, [tenantId]),
    db.query(pendingQuery, [tenantId]),
    db.query(topDomainsQuery, [tenantId]),
  ]);

  const stats = statsResult.rows[0] as any;
  const dashboard: CuratorDashboardData = {
    stats: {
      totalNodes: parseInt(stats.total_nodes) || 0,
      documentsIngested: parseInt(stats.documents_ingested) || 0,
      verifiedFacts: parseInt(stats.verified_facts) || 0,
      pendingVerification: parseInt(stats.pending_verification) || 0,
      overriddenNodes: parseInt(stats.overridden_nodes) || 0,
      domainCount: parseInt(stats.domain_count) || 0,
    },
    recentActivity: activityResult.rows as any,
    pendingVerifications: pendingResult.rows as any,
    topDomains: domainsResult.rows as any,
  };

  return createResponse(dashboard);
}

// =============================================================================
// Domains
// =============================================================================

async function getDomains(tenantId: string): Promise<APIGatewayProxyResult> {
  const query = `
    SELECT * FROM curator_domains 
    WHERE tenant_id = $1 
    ORDER BY depth, name
  `;
  const result = await db.query(query, [tenantId]);

  // Build tree structure
  const domains = result.rows;
  const domainMap = new Map<string, CuratorDomain & { children: CuratorDomain[] }>();
  const rootDomains: CuratorDomain[] = [];

  domains.forEach((d: any) => {
    domainMap.set(d.id, { ...mapDomain(d), children: [] });
  });

  domains.forEach((d: any) => {
    const domain = domainMap.get(d.id)!;
    if (d.parent_id && domainMap.has(d.parent_id)) {
      domainMap.get(d.parent_id)!.children.push(domain);
    } else {
      rootDomains.push(domain);
    }
  });

  return createResponse(rootDomains);
}

async function getDomain(tenantId: string, domainId: string): Promise<APIGatewayProxyResult> {
  const query = `SELECT * FROM curator_domains WHERE tenant_id = $1 AND id = $2`;
  const result = await db.query(query, [tenantId, domainId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Domain not found', 404);
  }

  return createResponse(mapDomain(result.rows[0]));
}

async function createDomain(tenantId: string, userId: string, body: any): Promise<APIGatewayProxyResult> {
  const { parentId, name, description, slug, settings } = body;

  const insertQuery = `
    INSERT INTO curator_domains (tenant_id, parent_id, name, description, slug, settings, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const slugValue = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const settingsValue = settings || { autoCategorize: true, requireVerification: true };

  const result = await db.query(insertQuery, [
    tenantId, parentId || null, name, description, slugValue, JSON.stringify(settingsValue), userId
  ]);

  await logAudit(tenantId, 'domain', (result.rows[0] as any).id, 'create', userId, null, result.rows[0]);

  return createResponse(mapDomain(result.rows[0] as any));
}

async function updateDomain(tenantId: string, domainId: string, body: any): Promise<APIGatewayProxyResult> {
  const { name, description, settings } = body;

  const oldQuery = `SELECT * FROM curator_domains WHERE tenant_id = $1 AND id = $2`;
  const oldResult = await db.query(oldQuery, [tenantId, domainId]);

  if (oldResult.rows.length === 0) {
    return createErrorResponse('Domain not found', 404);
  }

  const updateQuery = `
    UPDATE curator_domains 
    SET name = COALESCE($3, name),
        description = COALESCE($4, description),
        settings = COALESCE($5, settings),
        updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const result = await db.query(updateQuery, [
    tenantId, domainId, name, description, settings ? JSON.stringify(settings) : null
  ]);

  return createResponse(mapDomain(result.rows[0]));
}

async function deleteDomain(tenantId: string, domainId: string): Promise<APIGatewayProxyResult> {
  const query = `DELETE FROM curator_domains WHERE tenant_id = $1 AND id = $2 RETURNING id`;
  const result = await db.query(query, [tenantId, domainId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Domain not found', 404);
  }

  return createResponse({ deleted: true, id: domainId });
}

// =============================================================================
// Documents
// =============================================================================

async function getDocuments(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { domainId, status, limit = '50', offset = '0' } = params;

  let query = `SELECT * FROM curator_documents WHERE tenant_id = $1`;
  const queryParams: any[] = [tenantId];
  let paramIndex = 2;

  if (domainId) {
    query += ` AND domain_id = $${paramIndex++}`;
    queryParams.push(domainId);
  }

  if (status) {
    query += ` AND status = $${paramIndex++}`;
    queryParams.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  queryParams.push(parseInt(limit), parseInt(offset));

  const result = await db.query(query, queryParams);

  return createResponse(result.rows.map(mapDocument));
}

async function initiateUpload(tenantId: string, userId: string, body: any): Promise<APIGatewayProxyResult> {
  const { domainId, files } = body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return createErrorResponse('Files array required', 400);
  }

  const uploadPromises = files.map(async (file: any) => {
    const insertQuery = `
      INSERT INTO curator_documents (tenant_id, domain_id, filename, original_filename, file_type, file_size, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
      RETURNING id
    `;

    const filename = `${Date.now()}-${file.filename}`;
    const result = await db.query(insertQuery, [
      tenantId, domainId || null, filename, file.filename, file.contentType, file.size, userId
    ]);

    // Generate presigned S3 URL for upload
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    const bucket = process.env.CURATOR_DOCUMENTS_BUCKET || `radiant-curator-documents-${process.env.STAGE || 'dev'}`;
    const key = `${tenantId}/${result.rows[0].id}/${filename}`;
    
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: file.contentType,
    }), { expiresIn: 3600 });

    return {
      documentId: result.rows[0].id,
      uploadUrl,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    };
  });

  const uploadUrls = await Promise.all(uploadPromises);

  return createResponse({ uploadUrls });
}

async function completeUpload(tenantId: string, documentId: string): Promise<APIGatewayProxyResult> {
  const updateQuery = `
    UPDATE curator_documents 
    SET status = 'processing', processing_started_at = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const result = await db.query(updateQuery, [tenantId, documentId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Document not found', 404);
  }

  // Trigger document processing Lambda
  try {
    const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
    const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const functionName = process.env.DOCUMENT_PROCESSOR_LAMBDA || `radiant-${process.env.STAGE || 'dev'}-curator-document-processor`;
    
    await lambda.send(new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: JSON.stringify({ tenantId, documentId }),
    }));
  } catch (error) {
    console.error('Failed to trigger document processor', { tenantId, documentId, error });
    // Don't fail - document is marked as processing
  }

  return createResponse(mapDocument(result.rows[0]));
}

// =============================================================================
// Verification Queue
// =============================================================================

async function getVerificationQueue(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { status = 'pending', limit = '50', offset = '0' } = params;

  const query = `
    SELECT vq.*, kn.label as node_label, kn.node_type, kn.content as node_content
    FROM curator_verification_queue vq
    JOIN curator_knowledge_nodes kn ON kn.id = vq.node_id
    WHERE vq.tenant_id = $1 AND vq.status = $2
    ORDER BY vq.priority DESC, vq.created_at ASC
    LIMIT $3 OFFSET $4
  `;

  const result = await db.query(query, [tenantId, status, parseInt(limit), parseInt(offset)]);

  return createResponse(result.rows.map(mapVerificationItem));
}

async function approveVerification(tenantId: string, userId: string, itemId: string, comment?: string): Promise<APIGatewayProxyResult> {
  return processVerification(tenantId, userId, itemId, 'approved', comment);
}

async function rejectVerification(tenantId: string, userId: string, itemId: string, comment?: string): Promise<APIGatewayProxyResult> {
  return processVerification(tenantId, userId, itemId, 'rejected', comment);
}

async function deferVerification(tenantId: string, userId: string, itemId: string, comment?: string): Promise<APIGatewayProxyResult> {
  return processVerification(tenantId, userId, itemId, 'deferred', comment);
}

async function correctVerification(tenantId: string, userId: string, itemId: string, body: any): Promise<APIGatewayProxyResult> {
  const { correction, reason } = body;

  if (!correction || !reason) {
    return createErrorResponse('Correction and reason are required', 400);
  }

  // Get the original verification item
  const itemQuery = `SELECT * FROM curator_verification_queue WHERE tenant_id = $1 AND id = $2`;
  const itemResult = await db.query(itemQuery, [tenantId, itemId]);

  if (itemResult.rows.length === 0) {
    return createErrorResponse('Verification item not found', 404);
  }

  const originalItem = itemResult.rows[0] as any;

  // Update the verification item with correction
  const updateQuery = `
    UPDATE curator_verification_queue 
    SET status = 'corrected',
        corrected_value = $3,
        correction_reason = $4,
        verified_by = $5,
        verified_at = NOW(),
        updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const result = await db.query(updateQuery, [tenantId, itemId, correction, reason, userId]);

  // Create a Golden Rule for the correction
  const goldenRule = await goldenRulesService.createRule({
    tenantId,
    entityId: itemId,
    ruleType: 'force_override',
    condition: originalItem.statement || originalItem.content,
    override: correction,
    reason: `Correction during verification: ${reason}`,
    priority: 100,
  }, userId);

  // Log the audit event
  await logAudit(tenantId, 'verification', itemId, 'correct', userId, originalItem, result.rows[0], reason);

  return createResponse({
    item: mapVerificationItem(result.rows[0]),
    goldenRule,
  });
}

async function resolveAmbiguity(tenantId: string, userId: string, itemId: string, body: any): Promise<APIGatewayProxyResult> {
  const { choice } = body;

  if (!choice || !['a', 'b'].includes(choice)) {
    return createErrorResponse('Choice must be "a" or "b"', 400);
  }

  // Get the ambiguity item
  const itemQuery = `SELECT * FROM curator_verification_queue WHERE tenant_id = $1 AND id = $2`;
  const itemResult = await db.query(itemQuery, [tenantId, itemId]);

  if (itemResult.rows.length === 0) {
    return createErrorResponse('Verification item not found', 404);
  }

  const originalItem = itemResult.rows[0] as any;
  const selectedOption = choice === 'a' ? originalItem.option_a : originalItem.option_b;
  const rejectedOption = choice === 'a' ? originalItem.option_b : originalItem.option_a;

  // Update the verification item
  const updateQuery = `
    UPDATE curator_verification_queue 
    SET status = 'resolved',
        resolved_choice = $3,
        resolved_value = $4,
        verified_by = $5,
        verified_at = NOW(),
        updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const result = await db.query(updateQuery, [tenantId, itemId, choice, selectedOption, userId]);

  // Create a Golden Rule to ensure the rejected option is never used
  if (rejectedOption) {
    await goldenRulesService.createRule({
      tenantId,
      entityId: itemId,
      ruleType: 'force_override',
      condition: rejectedOption,
      override: selectedOption,
      reason: `Ambiguity resolved: Option ${choice.toUpperCase()} selected`,
      priority: 90,
    }, userId);
  }

  // Log the audit event
  await logAudit(tenantId, 'verification', itemId, 'resolve_ambiguity', userId, originalItem, result.rows[0], `Selected option ${choice.toUpperCase()}`);

  return createResponse({
    item: mapVerificationItem(result.rows[0]),
    selectedOption,
  });
}

async function processVerification(
  tenantId: string,
  userId: string,
  itemId: string,
  status: string,
  comment?: string
): Promise<APIGatewayProxyResult> {
  // Update verification queue item
  const updateVqQuery = `
    UPDATE curator_verification_queue 
    SET status = $3, reviewed_at = NOW(), reviewed_by = $4, review_comment = $5
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const vqResult = await db.query(updateVqQuery, [tenantId, itemId, status, userId, comment]);

  if (vqResult.rows.length === 0) {
    return createErrorResponse('Verification item not found', 404);
  }

  // Update node status if approved/rejected
  if (status === 'approved' || status === 'rejected') {
    const nodeStatus = status === 'approved' ? 'verified' : 'rejected';
    const updateNodeQuery = `
      UPDATE curator_knowledge_nodes 
      SET status = $3, verified_at = NOW(), verified_by = $4
      WHERE tenant_id = $1 AND id = $2
    `;
    await db.query(updateNodeQuery, [tenantId, vqResult.rows[0].node_id, nodeStatus, userId]);
  }

  await logAudit(tenantId, 'verification', itemId, status, userId, null, { comment });

  return createResponse(mapVerificationItem(vqResult.rows[0]));
}

// =============================================================================
// Knowledge Graph
// =============================================================================

async function getKnowledgeGraph(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { domainId, limit = '100' } = params;

  let nodesQuery = `
    SELECT * FROM curator_knowledge_nodes 
    WHERE tenant_id = $1 AND status IN ('verified', 'overridden')
  `;
  const nodesParams: any[] = [tenantId];

  if (domainId) {
    nodesQuery += ` AND domain_id = $2`;
    nodesParams.push(domainId);
  }

  nodesQuery += ` LIMIT $${nodesParams.length + 1}`;
  nodesParams.push(parseInt(limit));

  const nodesResult = await db.query(nodesQuery, nodesParams);
  const nodeIds = nodesResult.rows.map((n: any) => n.id);

  let edges: any[] = [];
  if (nodeIds.length > 0) {
    const edgesQuery = `
      SELECT * FROM curator_knowledge_edges 
      WHERE tenant_id = $1 
      AND source_node_id = ANY($2) 
      AND target_node_id = ANY($2)
    `;
    const edgesResult = await db.query(edgesQuery, [tenantId, nodeIds]);
    edges = edgesResult.rows;
  }

  // Generate visualization positions (simple grid layout)
  const nodes = nodesResult.rows.map((n: any, i: number) => ({
    id: n.id,
    label: n.label,
    type: n.node_type,
    status: n.status,
    x: (i % 10) * 120 + 100,
    y: Math.floor(i / 10) * 100 + 100,
    size: 30,
    color: getNodeColor(n.node_type),
  }));

  const graphData: GraphVisualizationData = {
    nodes,
    edges: edges.map((e: any) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      type: e.relationship_type,
      weight: parseFloat(e.weight),
    })),
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      domainId,
    },
  };

  return createResponse(graphData);
}

async function getNodes(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { domainId, status, nodeType, limit = '50', offset = '0' } = params;

  let query = `SELECT * FROM curator_knowledge_nodes WHERE tenant_id = $1`;
  const queryParams: any[] = [tenantId];
  let paramIndex = 2;

  if (domainId) {
    query += ` AND domain_id = $${paramIndex++}`;
    queryParams.push(domainId);
  }

  if (status) {
    query += ` AND status = $${paramIndex++}`;
    queryParams.push(status);
  }

  if (nodeType) {
    query += ` AND node_type = $${paramIndex++}`;
    queryParams.push(nodeType);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  queryParams.push(parseInt(limit), parseInt(offset));

  const result = await db.query(query, queryParams);

  return createResponse(result.rows.map(mapNode));
}

async function getNode(tenantId: string, nodeId: string): Promise<APIGatewayProxyResult> {
  const query = `SELECT * FROM curator_knowledge_nodes WHERE tenant_id = $1 AND id = $2`;
  const result = await db.query(query, [tenantId, nodeId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Node not found', 404);
  }

  return createResponse(mapNode(result.rows[0]));
}

async function overrideNode(tenantId: string, userId: string, nodeId: string, body: any): Promise<APIGatewayProxyResult> {
  const { overrideValue, reason, priority, expiresAt, createGoldenRule: shouldCreateRule } = body;

  if (!overrideValue || !reason) {
    return createErrorResponse('Override value and reason required', 400);
  }

  const oldQuery = `SELECT * FROM curator_knowledge_nodes WHERE tenant_id = $1 AND id = $2`;
  const oldResult = await db.query(oldQuery, [tenantId, nodeId]);

  if (oldResult.rows.length === 0) {
    return createErrorResponse('Node not found', 404);
  }

  const oldNode = oldResult.rows[0] as any;

  // Update the knowledge node
  const updateQuery = `
    UPDATE curator_knowledge_nodes 
    SET status = 'overridden',
        override_value = $3,
        override_reason = $4,
        override_at = NOW(),
        override_by = $5,
        updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const result = await db.query(updateQuery, [tenantId, nodeId, overrideValue, reason, userId]);

  // Create Golden Rule for "God Mode" override (supersedes all other data)
  let goldenRule = null;
  if (shouldCreateRule !== false) {
    goldenRule = await goldenRulesService.createRule({
      tenantId,
      entityId: nodeId,
      ruleType: 'force_override',
      condition: oldNode.content || oldNode.label,
      override: overrideValue,
      reason: `Override of knowledge node: ${reason}`,
      priority: priority || 100,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }, userId);
  }

  await logAudit(tenantId, 'node', nodeId, 'override', userId, oldResult.rows[0], result.rows[0], reason);

  return createResponse({
    node: mapNode(result.rows[0]),
    goldenRule,
    chainOfCustody: goldenRule ? await goldenRulesService.getChainOfCustody(goldenRule.id, tenantId) : null,
  });
}

// =============================================================================
// Audit Log
// =============================================================================

async function getAuditLog(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { entityType, entityId, limit = '50', offset = '0' } = params;

  let query = `SELECT * FROM curator_audit_log WHERE tenant_id = $1`;
  const queryParams: any[] = [tenantId];
  let paramIndex = 2;

  if (entityType) {
    query += ` AND entity_type = $${paramIndex++}`;
    queryParams.push(entityType);
  }

  if (entityId) {
    query += ` AND entity_id = $${paramIndex++}`;
    queryParams.push(entityId);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  queryParams.push(parseInt(limit), parseInt(offset));

  const result = await db.query(query, queryParams);

  return createResponse(result.rows);
}

async function logAudit(
  tenantId: string,
  entityType: string,
  entityId: string,
  action: string,
  actorId: string,
  oldValue: any,
  newValue: any,
  reason?: string
): Promise<void> {
  const query = `
    INSERT INTO curator_audit_log (tenant_id, entity_type, entity_id, action, actor_id, actor_type, old_value, new_value, reason)
    VALUES ($1, $2, $3, $4, $5, 'user', $6, $7, $8)
  `;
  await db.query(query, [
    tenantId, entityType, entityId, action, actorId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    reason
  ]);
}

// =============================================================================
// Mappers
// =============================================================================

function mapDomain(row: any): CuratorDomain {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    parentId: row.parent_id,
    name: row.name,
    description: row.description,
    slug: row.slug,
    iconName: row.icon_name,
    settings: row.settings || {},
    nodeCount: parseInt(row.node_count) || 0,
    documentCount: parseInt(row.document_count) || 0,
    depth: parseInt(row.depth) || 0,
    pathIds: row.path_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function mapDocument(row: any): CuratorDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    domainId: row.domain_id,
    filename: row.filename,
    originalFilename: row.original_filename,
    fileType: row.file_type,
    fileSize: parseInt(row.file_size),
    storageKey: row.storage_key,
    checksum: row.checksum,
    status: row.status,
    processingStartedAt: row.processing_started_at,
    processingCompletedAt: row.processing_completed_at,
    nodesCreated: parseInt(row.nodes_created) || 0,
    errorMessage: row.error_message,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function mapNode(row: any): CuratorKnowledgeNode {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    domainId: row.domain_id,
    nodeType: row.node_type,
    label: row.label,
    content: row.content,
    sourceDocumentId: row.source_document_id,
    sourceLocation: row.source_location,
    confidence: parseFloat(row.confidence),
    status: row.status,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    overrideValue: row.override_value,
    overrideReason: row.override_reason,
    overrideAt: row.override_at,
    overrideBy: row.override_by,
    aiReasoning: row.ai_reasoning,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVerificationItem(row: any): CuratorVerificationItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nodeId: row.node_id,
    statement: row.statement,
    aiConfidence: parseFloat(row.ai_confidence),
    aiReasoning: row.ai_reasoning,
    sourceReference: row.source_reference,
    domainPath: row.domain_path,
    priority: parseInt(row.priority),
    status: row.status,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewComment: row.review_comment,
    createdAt: row.created_at,
    node: row.node_label ? {
      id: row.node_id,
      tenantId: row.tenant_id,
      nodeType: row.node_type,
      label: row.node_label,
      content: row.node_content,
    } as any : undefined,
  };
}

function getNodeColor(nodeType: string): string {
  switch (nodeType) {
    case 'concept': return '#D4AF37';
    case 'fact': return '#50C878';
    case 'procedure': return '#0F52BA';
    case 'entity': return '#CD7F32';
    case 'rule': return '#9966CC';
    default: return '#888888';
  }
}

// =============================================================================
// Golden Rules "God Mode" Handlers
// =============================================================================

async function getGoldenRules(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { activeOnly, ruleType } = params;
  
  const rules = await goldenRulesService.listRules(tenantId, {
    activeOnly: activeOnly === 'true',
    ruleType: ruleType || undefined,
  });

  return createResponse({ rules });
}

async function createGoldenRule(tenantId: string, userId: string, body: any): Promise<APIGatewayProxyResult> {
  const { entityId, ruleType, condition, override, reason, priority, expiresAt } = body;

  if (!condition || !override || !reason) {
    return createErrorResponse('Condition, override, and reason are required', 400);
  }

  const rule = await goldenRulesService.createRule({
    tenantId,
    entityId,
    ruleType: ruleType || 'force_override',
    condition,
    override,
    reason,
    priority: priority || 100,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  }, userId);

  await logAudit(tenantId, 'golden_rule', rule.id, 'create', userId, null, rule, reason);

  return createResponse(rule);
}

async function deactivateGoldenRule(
  tenantId: string,
  userId: string,
  ruleId: string,
  reason?: string
): Promise<APIGatewayProxyResult> {
  if (!reason) {
    return createErrorResponse('Reason for deactivation is required', 400);
  }

  await goldenRulesService.deactivateRule(tenantId, ruleId, userId, reason);
  await logAudit(tenantId, 'golden_rule', ruleId, 'deactivate', userId, { id: ruleId }, null, reason);

  return createResponse({ success: true, ruleId });
}

async function checkGoldenRuleMatch(tenantId: string, body: any): Promise<APIGatewayProxyResult> {
  const { query, entityId } = body;

  if (!query) {
    return createErrorResponse('Query is required', 400);
  }

  const match = await goldenRulesService.checkMatch(tenantId, query, entityId);

  return createResponse({ 
    matched: !!match,
    rule: match || null,
  });
}

// =============================================================================
// Entrance Exam Handlers
// =============================================================================

async function getExams(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { status, assignedTo, domainId } = params;

  const exams = await entranceExamService.listExams(tenantId, {
    status: status || undefined,
    assignedTo: assignedTo || undefined,
    domainId: domainId || undefined,
  });

  return createResponse({ exams });
}

async function generateExam(tenantId: string, body: any): Promise<APIGatewayProxyResult> {
  const { domainId, domainPath, questionCount, passingScore, timeoutMinutes, assignedTo } = body;

  if (!domainId || !domainPath) {
    return createErrorResponse('Domain ID and domain path are required', 400);
  }

  const exam = await entranceExamService.generateExam({
    tenantId,
    domainId,
    domainPath,
    questionCount: questionCount || 10,
    passingScore: passingScore || 80,
    timeoutMinutes: timeoutMinutes || 60,
    assignedTo,
  });

  return createResponse(exam);
}

async function getExam(tenantId: string, examId: string): Promise<APIGatewayProxyResult> {
  const exam = await entranceExamService.getExam(examId, tenantId);

  if (!exam) {
    return createErrorResponse('Exam not found', 404);
  }

  return createResponse(exam);
}

async function startExam(tenantId: string, userId: string, examId: string): Promise<APIGatewayProxyResult> {
  try {
    const exam = await entranceExamService.startExam(examId, userId);
    await logAudit(tenantId, 'exam', examId, 'start', userId, null, { status: 'in_progress' });
    return createResponse(exam);
  } catch (error) {
    return createErrorResponse((error as Error).message);
  }
}

async function submitExamAnswer(examId: string, body: any): Promise<APIGatewayProxyResult> {
  const { questionId, answer, isVerified, correction, notes } = body;

  if (!questionId) {
    return createErrorResponse('Question ID is required', 400);
  }

  await entranceExamService.submitAnswer({
    examId,
    questionId,
    answer: answer || '',
    isVerified: isVerified ?? true,
    correction,
    notes,
  });

  return createResponse({ success: true });
}

async function completeExam(tenantId: string, userId: string, examId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await entranceExamService.completeExam(examId, tenantId, userId);
    
    await logAudit(tenantId, 'exam', examId, 'complete', userId, null, {
      passed: result.passed,
      score: result.score,
      goldenRulesCreated: result.goldenRulesCreated.length,
    });

    return createResponse(result);
  } catch (error) {
    return createErrorResponse((error as Error).message);
  }
}

// =============================================================================
// Chain of Custody Handlers
// =============================================================================

async function getChainOfCustody(tenantId: string, factId: string): Promise<APIGatewayProxyResult> {
  const custody = await goldenRulesService.getChainOfCustody(factId, tenantId);

  if (!custody) {
    return createErrorResponse('Chain of Custody not found', 404);
  }

  return createResponse(custody);
}

async function verifyFact(tenantId: string, userId: string, factId: string): Promise<APIGatewayProxyResult> {
  try {
    const custody = await goldenRulesService.verifyFact(factId, tenantId, userId);
    
    await logAudit(tenantId, 'fact', factId, 'verify', userId, null, { verified: true });

    return createResponse(custody);
  } catch (error) {
    return createErrorResponse((error as Error).message);
  }
}

async function getFactAuditTrail(factId: string): Promise<APIGatewayProxyResult> {
  const trail = await goldenRulesService.getAuditTrail(factId);

  return createResponse({ auditTrail: trail });
}

// =============================================================================
// Data Connectors (Zero-Copy) Handlers
// =============================================================================

async function getConnectors(tenantId: string): Promise<APIGatewayProxyResult> {
  const query = `SELECT * FROM curator_data_connectors WHERE tenant_id = $1 ORDER BY created_at DESC`;
  const result = await db.query(query, [tenantId]);

  return createResponse({ connectors: result.rows.map(mapConnector) });
}

async function createConnector(tenantId: string, userId: string, body: any): Promise<APIGatewayProxyResult> {
  const { name, type, config, scope, domainId } = body;

  if (!name || !type) {
    return createErrorResponse('Name and type are required', 400);
  }

  const validTypes = ['s3', 'azure_blob', 'sharepoint', 'google_drive', 'snowflake', 'confluence'];
  if (!validTypes.includes(type)) {
    return createErrorResponse(`Invalid connector type. Must be one of: ${validTypes.join(', ')}`);
  }

  const insertQuery = `
    INSERT INTO curator_data_connectors (tenant_id, name, connector_type, config, scope, domain_id, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
    RETURNING *
  `;

  const result = await db.query(insertQuery, [
    tenantId, name, type, JSON.stringify(config || {}), JSON.stringify(scope || {}), domainId || null, userId
  ]);

  await logAudit(tenantId, 'connector', (result.rows[0] as any).id, 'create', userId, null, result.rows[0] as any);

  return createResponse(mapConnector(result.rows[0]));
}

async function deleteConnector(tenantId: string, connectorId: string): Promise<APIGatewayProxyResult> {
  const query = `DELETE FROM curator_data_connectors WHERE tenant_id = $1 AND id = $2 RETURNING id`;
  const result = await db.query(query, [tenantId, connectorId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Connector not found', 404);
  }

  return createResponse({ deleted: true, id: connectorId });
}

async function syncConnector(tenantId: string, connectorId: string): Promise<APIGatewayProxyResult> {
  const getQuery = `SELECT * FROM curator_data_connectors WHERE tenant_id = $1 AND id = $2`;
  const getResult = await db.query(getQuery, [tenantId, connectorId]);

  if (getResult.rows.length === 0) {
    return createErrorResponse('Connector not found', 404);
  }

  // Update status to syncing
  const updateQuery = `
    UPDATE curator_data_connectors 
    SET status = 'syncing', last_sync_started = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const result = await db.query(updateQuery, [tenantId, connectorId]);

  // Trigger async connector sync Lambda
  try {
    const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
    const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const functionName = process.env.CONNECTOR_SYNC_LAMBDA || `radiant-${process.env.STAGE || 'dev'}-curator-connector-sync`;
    
    await lambda.send(new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: JSON.stringify({ tenantId, connectorId }),
    }));
  } catch (error) {
    console.error('Failed to trigger connector sync', { tenantId, connectorId, error });
    // Don't fail - connector is marked as syncing
  }

  return createResponse({ 
    message: 'Sync started',
    connector: mapConnector(result.rows[0]),
  });
}

function mapConnector(row: any): any {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    type: row.connector_type,
    config: row.config || {},
    scope: row.scope || {},
    domainId: row.domain_id,
    status: row.status,
    lastSyncStarted: row.last_sync_started,
    lastSyncCompleted: row.last_sync_completed,
    lastSyncError: row.last_sync_error,
    stubNodesCreated: parseInt(row.stub_nodes_created) || 0,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

// =============================================================================
// Conflict Queue Handlers
// =============================================================================

async function getConflicts(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { status = 'unresolved', limit = '50', offset = '0' } = params;

  const query = `
    SELECT c.*, 
           n1.label as node_a_label, n1.content as node_a_content,
           n2.label as node_b_label, n2.content as node_b_content
    FROM curator_conflicts c
    LEFT JOIN curator_knowledge_nodes n1 ON n1.id = c.node_a_id
    LEFT JOIN curator_knowledge_nodes n2 ON n2.id = c.node_b_id
    WHERE c.tenant_id = $1 AND c.status = $2
    ORDER BY c.priority DESC, c.detected_at DESC
    LIMIT $3 OFFSET $4
  `;

  const result = await db.query(query, [tenantId, status, parseInt(limit), parseInt(offset)]);

  return createResponse({ conflicts: result.rows.map(mapConflict) });
}

async function resolveConflict(
  tenantId: string,
  userId: string,
  conflictId: string,
  body: any
): Promise<APIGatewayProxyResult> {
  const { resolution, winningNodeId, mergedValue, reason } = body;

  if (!resolution || !reason) {
    return createErrorResponse('Resolution type and reason are required', 400);
  }

  const validResolutions = ['supersede_old', 'supersede_new', 'merge', 'context_dependent', 'ignore'];
  if (!validResolutions.includes(resolution)) {
    return createErrorResponse(`Invalid resolution. Must be one of: ${validResolutions.join(', ')}`);
  }

  const getQuery = `SELECT * FROM curator_conflicts WHERE tenant_id = $1 AND id = $2`;
  const getResult = await db.query(getQuery, [tenantId, conflictId]);

  if (getResult.rows.length === 0) {
    return createErrorResponse('Conflict not found', 404);
  }

  const conflict = getResult.rows[0];

  // Update conflict status
  const updateQuery = `
    UPDATE curator_conflicts 
    SET status = 'resolved',
        resolution = $3,
        winning_node_id = $4,
        merged_value = $5,
        resolved_by = $6,
        resolved_at = NOW(),
        resolution_reason = $7
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const result = await db.query(updateQuery, [
    tenantId, conflictId, resolution, winningNodeId, mergedValue, userId, reason
  ]);

  // Apply resolution to nodes
  if (resolution === 'supersede_old' || resolution === 'supersede_new') {
    const losingNodeId = resolution === 'supersede_old' ? conflict.node_a_id : conflict.node_b_id;
    await db.query(
      `UPDATE curator_knowledge_nodes SET status = 'superseded' WHERE id = $1`,
      [losingNodeId]
    );
  }

  await logAudit(tenantId, 'conflict', conflictId, 'resolve', userId, conflict, result.rows[0], reason);

  return createResponse(mapConflict(result.rows[0]));
}

function mapConflict(row: any): any {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nodeAId: row.node_a_id,
    nodeBId: row.node_b_id,
    nodeALabel: row.node_a_label,
    nodeBLabel: row.node_b_label,
    nodeAContent: row.node_a_content,
    nodeBContent: row.node_b_content,
    conflictType: row.conflict_type,
    description: row.description,
    priority: parseInt(row.priority) || 0,
    status: row.status,
    resolution: row.resolution,
    winningNodeId: row.winning_node_id,
    mergedValue: row.merged_value,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionReason: row.resolution_reason,
    detectedAt: row.detected_at,
  };
}

// =============================================================================
// Time Travel / Version Control Handlers
// =============================================================================

async function getSnapshots(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { domainId, limit = '20', offset = '0' } = params;

  let query = `SELECT * FROM curator_snapshots WHERE tenant_id = $1`;
  const queryParams: any[] = [tenantId];
  let paramIndex = 2;

  if (domainId) {
    query += ` AND (domain_id = $${paramIndex++} OR domain_id IS NULL)`;
    queryParams.push(domainId);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  queryParams.push(parseInt(limit), parseInt(offset));

  const result = await db.query(query, queryParams);

  return createResponse({ snapshots: result.rows.map(mapSnapshot) });
}

async function getSnapshot(tenantId: string, snapshotId: string): Promise<APIGatewayProxyResult> {
  const query = `SELECT * FROM curator_snapshots WHERE tenant_id = $1 AND id = $2`;
  const result = await db.query(query, [tenantId, snapshotId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Snapshot not found', 404);
  }

  return createResponse(mapSnapshot(result.rows[0]));
}

async function restoreSnapshot(
  tenantId: string,
  userId: string,
  snapshotId: string,
  body: any
): Promise<APIGatewayProxyResult> {
  const { domainId, dryRun = false } = body;

  const getQuery = `SELECT * FROM curator_snapshots WHERE tenant_id = $1 AND id = $2`;
  const getResult = await db.query(getQuery, [tenantId, snapshotId]);

  if (getResult.rows.length === 0) {
    return createErrorResponse('Snapshot not found', 404);
  }

  const snapshot = getResult.rows[0];

  if (dryRun) {
    // Return preview of changes
    const nodesQuery = `
      SELECT COUNT(*) as count FROM curator_knowledge_nodes 
      WHERE tenant_id = $1 AND created_at > $2
      ${domainId ? 'AND domain_id = $3' : ''}
    `;
    const nodesResult = await db.query(nodesQuery, domainId 
      ? [tenantId, snapshot.created_at, domainId] 
      : [tenantId, snapshot.created_at]
    );

    return createResponse({
      dryRun: true,
      snapshot: mapSnapshot(snapshot),
      affectedNodes: parseInt((nodesResult.rows[0] as any).count),
      warning: 'This will revert all changes made after the snapshot date',
    });
  }

  // Create a new snapshot before restoring
  await db.query(
    `INSERT INTO curator_snapshots (tenant_id, domain_id, name, description, node_count, created_by)
     SELECT $1, $2, 'Pre-restore backup', 'Automatic backup before restoring snapshot ' || $3, 
            (SELECT COUNT(*) FROM curator_knowledge_nodes WHERE tenant_id = $1), $4`,
    [tenantId, domainId, snapshotId, userId]
  );

  // Restore from snapshot: mark nodes created after snapshot as superseded
  // and reactivate any nodes that were superseded after the snapshot time
  await db.query(
    `UPDATE curator_knowledge_nodes SET status = 'superseded', superseded_at = NOW()
     WHERE tenant_id = $1 AND created_at > $2 AND status = 'active'
     ${domainId ? 'AND domain_id = $3' : ''}`,
    domainId ? [tenantId, snapshot.created_at, domainId] : [tenantId, snapshot.created_at]
  );

  // Reactivate nodes that were active at snapshot time
  await db.query(
    `UPDATE curator_knowledge_nodes SET status = 'active', superseded_at = NULL
     WHERE tenant_id = $1 AND created_at <= $2 
     AND (superseded_at IS NULL OR superseded_at > $2)
     AND status = 'superseded'
     ${domainId ? 'AND domain_id = $3' : ''}`,
    domainId ? [tenantId, snapshot.created_at, domainId] : [tenantId, snapshot.created_at]
  );

  await logAudit(tenantId, 'snapshot', snapshotId, 'restore', userId, null, { restored: true });

  return createResponse({ 
    success: true,
    snapshot: mapSnapshot(snapshot),
    message: 'Graph restored to snapshot state',
  });
}

async function getGraphAtTime(tenantId: string, params: any): Promise<APIGatewayProxyResult> {
  const { timestamp, domainId, limit = '100' } = params;

  if (!timestamp) {
    return createErrorResponse('Timestamp is required');
  }

  const targetTime = new Date(timestamp);
  if (isNaN(targetTime.getTime())) {
    return createErrorResponse('Invalid timestamp format');
  }

  let nodesQuery = `
    SELECT * FROM curator_knowledge_nodes 
    WHERE tenant_id = $1 
    AND created_at <= $2
    AND (superseded_at IS NULL OR superseded_at > $2)
  `;
  const nodesParams: any[] = [tenantId, targetTime];
  let paramIndex = 3;

  if (domainId) {
    nodesQuery += ` AND domain_id = $${paramIndex++}`;
    nodesParams.push(domainId);
  }

  nodesQuery += ` LIMIT $${paramIndex++}`;
  nodesParams.push(parseInt(limit));

  const nodesResult = await db.query(nodesQuery, nodesParams);
  const nodeIds = nodesResult.rows.map((n: any) => n.id);

  let edges: any[] = [];
  if (nodeIds.length > 0) {
    const edgesQuery = `
      SELECT * FROM curator_knowledge_edges 
      WHERE tenant_id = $1 
      AND source_node_id = ANY($2) 
      AND target_node_id = ANY($2)
      AND created_at <= $3
    `;
    const edgesResult = await db.query(edgesQuery, [tenantId, nodeIds, targetTime]);
    edges = edgesResult.rows;
  }

  return createResponse({
    timestamp: targetTime.toISOString(),
    nodes: nodesResult.rows.map(mapNode),
    edges: edges.map((e: any) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      type: e.relationship_type,
    })),
    metadata: {
      nodeCount: nodesResult.rows.length,
      edgeCount: edges.length,
    },
  });
}

function mapSnapshot(row: any): any {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    domainId: row.domain_id,
    name: row.name,
    description: row.description,
    nodeCount: parseInt(row.node_count) || 0,
    edgeCount: parseInt(row.edge_count) || 0,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

// =============================================================================
// Domain Schema Handlers
// =============================================================================

async function getDomainSchema(tenantId: string, domainId: string): Promise<APIGatewayProxyResult> {
  const query = `SELECT * FROM curator_domains WHERE tenant_id = $1 AND id = $2`;
  const result = await db.query(query, [tenantId, domainId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Domain not found', 404);
  }

  const domain = result.rows[0];
  const schema = domain.schema || {
    expectedAttributes: [],
    requiredFields: [],
    nodeTypes: ['concept', 'fact', 'procedure', 'entity', 'rule'],
    contextTags: [],
  };

  return createResponse({
    domainId,
    domainName: domain.name,
    schema,
  });
}

async function updateDomainSchema(
  tenantId: string,
  userId: string,
  domainId: string,
  body: any
): Promise<APIGatewayProxyResult> {
  const { expectedAttributes, requiredFields, nodeTypes, contextTags } = body;

  const getQuery = `SELECT * FROM curator_domains WHERE tenant_id = $1 AND id = $2`;
  const getResult = await db.query(getQuery, [tenantId, domainId]);

  if (getResult.rows.length === 0) {
    return createErrorResponse('Domain not found', 404);
  }

  const oldDomain = getResult.rows[0] as any;
  const newSchema = {
    expectedAttributes: expectedAttributes || oldDomain?.schema?.expectedAttributes || [],
    requiredFields: requiredFields || oldDomain?.schema?.requiredFields || [],
    nodeTypes: nodeTypes || oldDomain?.schema?.nodeTypes || ['concept', 'fact', 'procedure', 'entity', 'rule'],
    contextTags: contextTags || oldDomain?.schema?.contextTags || [],
  };

  const updateQuery = `
    UPDATE curator_domains 
    SET schema = $3, updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const result = await db.query(updateQuery, [tenantId, domainId, JSON.stringify(newSchema)]);

  await logAudit(tenantId, 'domain_schema', domainId, 'update', userId, oldDomain.schema, newSchema);

  return createResponse({
    domainId,
    domainName: result.rows[0].name,
    schema: newSchema,
  });
}
