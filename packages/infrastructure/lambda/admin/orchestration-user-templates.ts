/**
 * RADIANT v4.18.0 - User Workflow Templates Admin API
 * Provides endpoints for managing user-saved workflow templates
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { successResponse, handleError } from '../shared/middleware/api-response';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { NotFoundError, ValidationError, InternalError, UnauthorizedError } from '../shared/errors';

// ============================================================================
// Types
// ============================================================================

interface TemplateStep {
  stepOrder: number;
  methodCode: string;
  displayName: string;
  parameters: Record<string, unknown>;
  condition?: string;
  isEnabled: boolean;
}

interface CreateTemplateRequest {
  templateName: string;
  templateDescription?: string;
  baseWorkflowCode?: string;
  steps: TemplateStep[];
  category?: string;
  tags?: string[];
}

interface UpdateTemplateRequest {
  templateName?: string;
  templateDescription?: string;
  steps?: TemplateStep[];
  category?: string;
  tags?: string[];
}

// ============================================================================
// Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;
  
  // Get tenant and user from context (set by authorizer)
  const tenantId = event.requestContext.authorizer?.tenantId;
  const userId = event.requestContext.authorizer?.userId;

  if (!tenantId || !userId) {
    return handleError(new UnauthorizedError('Authentication required'));
  }

  logger.info('User templates admin request', { path, method, tenantId });

  try {
    // GET /api/admin/orchestration/user-templates
    if (path.endsWith('/user-templates') && method === 'GET') {
      return await getAllTemplates(tenantId, userId);
    }

    // POST /api/admin/orchestration/user-templates
    if (path.endsWith('/user-templates') && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as CreateTemplateRequest;
      return await createTemplate(tenantId, userId, body);
    }

    // GET /api/admin/orchestration/user-templates/:id
    const templateMatch = path.match(/\/user-templates\/([^/]+)$/);
    if (templateMatch && method === 'GET') {
      return await getTemplate(tenantId, userId, templateMatch[1]);
    }

    // PATCH /api/admin/orchestration/user-templates/:id
    if (templateMatch && method === 'PATCH') {
      const body = JSON.parse(event.body || '{}') as UpdateTemplateRequest;
      return await updateTemplate(tenantId, userId, templateMatch[1], body);
    }

    // DELETE /api/admin/orchestration/user-templates/:id
    if (templateMatch && method === 'DELETE') {
      return await deleteTemplate(tenantId, userId, templateMatch[1]);
    }

    // POST /api/admin/orchestration/user-templates/:id/share
    const shareMatch = path.match(/\/user-templates\/([^/]+)\/share$/);
    if (shareMatch && method === 'POST') {
      return await toggleShare(tenantId, userId, shareMatch[1]);
    }

    // POST /api/admin/orchestration/user-templates/:id/duplicate
    const duplicateMatch = path.match(/\/user-templates\/([^/]+)\/duplicate$/);
    if (duplicateMatch && method === 'POST') {
      return await duplicateTemplate(tenantId, userId, duplicateMatch[1]);
    }

    return handleError(new NotFoundError('Endpoint not found'));
  } catch (error) {
    logger.error('User templates admin error', { error });
    return handleError(error instanceof Error ? error : new InternalError('Internal server error'));
  }
}

// ============================================================================
// Template CRUD
// ============================================================================

async function getAllTemplates(tenantId: string, userId: string): Promise<APIGatewayProxyResult> {
  // Get user's own templates and shared templates from same tenant
  const result = await executeStatement(
    `SELECT 
      t.*,
      w.common_name as base_workflow_name
     FROM user_workflow_templates t
     LEFT JOIN orchestration_workflows w ON t.base_workflow_code = w.workflow_code
     WHERE t.tenant_id = $1 AND (t.user_id = $2 OR t.is_shared = true)
     ORDER BY t.updated_at DESC`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
    ]
  );

  const templates = result.rows.map(row => mapTemplate(row as Record<string, unknown>));
  return successResponse({ templates });
}

async function getTemplate(tenantId: string, userId: string, templateId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT 
      t.*,
      w.common_name as base_workflow_name
     FROM user_workflow_templates t
     LEFT JOIN orchestration_workflows w ON t.base_workflow_code = w.workflow_code
     WHERE t.template_id = $1 AND t.tenant_id = $2 AND (t.user_id = $3 OR t.is_shared = true)`,
    [
      { name: 'templateId', value: { stringValue: templateId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
    ]
  );

  if (result.rows.length === 0) {
    return handleError(new NotFoundError(`Template ${templateId} not found`));
  }

  const template = mapTemplate(result.rows[0] as Record<string, unknown>);
  return successResponse({ template });
}

async function createTemplate(
  tenantId: string,
  userId: string,
  request: CreateTemplateRequest
): Promise<APIGatewayProxyResult> {
  if (!request.templateName || request.templateName.trim().length === 0) {
    return handleError(new ValidationError('Template name is required'));
  }

  if (!request.steps || request.steps.length === 0) {
    return handleError(new ValidationError('At least one step is required'));
  }

  const templateId = `template_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  await executeStatement(
    `INSERT INTO user_workflow_templates 
     (template_id, tenant_id, user_id, template_name, template_description, 
      base_workflow_code, steps, category, tags, is_shared, times_used, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 0, NOW(), NOW())`,
    [
      { name: 'templateId', value: { stringValue: templateId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
      { name: 'name', value: { stringValue: request.templateName.trim() } },
      { name: 'description', value: request.templateDescription ? { stringValue: request.templateDescription } : { isNull: true } },
      { name: 'baseWorkflow', value: request.baseWorkflowCode ? { stringValue: request.baseWorkflowCode } : { isNull: true } },
      { name: 'steps', value: { stringValue: JSON.stringify(request.steps) } },
      { name: 'category', value: request.category ? { stringValue: request.category } : { isNull: true } },
      { name: 'tags', value: { stringValue: `{${(request.tags || []).join(',')}}` } },
    ]
  );

  return await getTemplate(tenantId, userId, templateId);
}

async function updateTemplate(
  tenantId: string,
  userId: string,
  templateId: string,
  updates: UpdateTemplateRequest
): Promise<APIGatewayProxyResult> {
  // Verify ownership
  const checkResult = await executeStatement(
    `SELECT user_id FROM user_workflow_templates WHERE template_id = $1 AND tenant_id = $2`,
    [
      { name: 'templateId', value: { stringValue: templateId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
    ]
  );

  if (checkResult.rows.length === 0) {
    return handleError(new NotFoundError(`Template ${templateId} not found`));
  }

  const ownerId = String((checkResult.rows[0] as Record<string, unknown>).user_id);
  if (ownerId !== userId) {
    return handleError(new UnauthorizedError('You can only edit your own templates'));
  }

  const setClauses: string[] = ['updated_at = NOW()'];
  const params: Array<{ name: string; value: { stringValue?: string; isNull?: boolean } }> = [
    { name: 'templateId', value: { stringValue: templateId } },
  ];
  let paramIndex = 2;

  if (updates.templateName !== undefined) {
    setClauses.push(`template_name = $${paramIndex}`);
    params.push({ name: `p${paramIndex}`, value: { stringValue: updates.templateName } });
    paramIndex++;
  }

  if (updates.templateDescription !== undefined) {
    setClauses.push(`template_description = $${paramIndex}`);
    params.push({ name: `p${paramIndex}`, value: updates.templateDescription ? { stringValue: updates.templateDescription } : { isNull: true } });
    paramIndex++;
  }

  if (updates.steps !== undefined) {
    setClauses.push(`steps = $${paramIndex}`);
    params.push({ name: `p${paramIndex}`, value: { stringValue: JSON.stringify(updates.steps) } });
    paramIndex++;
  }

  if (updates.category !== undefined) {
    setClauses.push(`category = $${paramIndex}`);
    params.push({ name: `p${paramIndex}`, value: updates.category ? { stringValue: updates.category } : { isNull: true } });
    paramIndex++;
  }

  if (updates.tags !== undefined) {
    setClauses.push(`tags = $${paramIndex}`);
    params.push({ name: `p${paramIndex}`, value: { stringValue: `{${updates.tags.join(',')}}` } });
    paramIndex++;
  }

  await executeStatement(
    `UPDATE user_workflow_templates SET ${setClauses.join(', ')} WHERE template_id = $1`,
    params
  );

  return await getTemplate(tenantId, userId, templateId);
}

async function deleteTemplate(tenantId: string, userId: string, templateId: string): Promise<APIGatewayProxyResult> {
  // Verify ownership
  const checkResult = await executeStatement(
    `SELECT user_id FROM user_workflow_templates WHERE template_id = $1 AND tenant_id = $2`,
    [
      { name: 'templateId', value: { stringValue: templateId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
    ]
  );

  if (checkResult.rows.length === 0) {
    return handleError(new NotFoundError(`Template ${templateId} not found`));
  }

  const ownerId = String((checkResult.rows[0] as Record<string, unknown>).user_id);
  if (ownerId !== userId) {
    return handleError(new UnauthorizedError('You can only delete your own templates'));
  }

  await executeStatement(
    `DELETE FROM user_workflow_templates WHERE template_id = $1`,
    [{ name: 'templateId', value: { stringValue: templateId } }]
  );

  return successResponse({ success: true, message: 'Template deleted' });
}

async function toggleShare(tenantId: string, userId: string, templateId: string): Promise<APIGatewayProxyResult> {
  // Verify ownership
  const checkResult = await executeStatement(
    `SELECT user_id, is_shared FROM user_workflow_templates WHERE template_id = $1 AND tenant_id = $2`,
    [
      { name: 'templateId', value: { stringValue: templateId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
    ]
  );

  if (checkResult.rows.length === 0) {
    return handleError(new NotFoundError(`Template ${templateId} not found`));
  }

  const row = checkResult.rows[0] as Record<string, unknown>;
  const ownerId = String(row.user_id);
  if (ownerId !== userId) {
    return handleError(new UnauthorizedError('You can only share your own templates'));
  }

  const currentlyShared = Boolean(row.is_shared);

  await executeStatement(
    `UPDATE user_workflow_templates SET is_shared = $2, updated_at = NOW() WHERE template_id = $1`,
    [
      { name: 'templateId', value: { stringValue: templateId } },
      { name: 'shared', value: { booleanValue: !currentlyShared } },
    ]
  );

  return successResponse({ 
    success: true, 
    isShared: !currentlyShared,
    message: !currentlyShared ? 'Template is now shared with your team' : 'Template is now private' 
  });
}

async function duplicateTemplate(tenantId: string, userId: string, templateId: string): Promise<APIGatewayProxyResult> {
  // Get original template (must be accessible to user)
  const result = await executeStatement(
    `SELECT * FROM user_workflow_templates 
     WHERE template_id = $1 AND tenant_id = $2 AND (user_id = $3 OR is_shared = true)`,
    [
      { name: 'templateId', value: { stringValue: templateId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
    ]
  );

  if (result.rows.length === 0) {
    return handleError(new NotFoundError(`Template ${templateId} not found`));
  }

  const original = result.rows[0] as Record<string, unknown>;
  const newTemplateId = `template_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const newName = `${String(original.template_name)} (Copy)`;

  await executeStatement(
    `INSERT INTO user_workflow_templates 
     (template_id, tenant_id, user_id, template_name, template_description, 
      base_workflow_code, steps, category, tags, is_shared, times_used, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 0, NOW(), NOW())`,
    [
      { name: 'templateId', value: { stringValue: newTemplateId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
      { name: 'name', value: { stringValue: newName } },
      { name: 'description', value: original.template_description ? { stringValue: String(original.template_description) } : { isNull: true } },
      { name: 'baseWorkflow', value: original.base_workflow_code ? { stringValue: String(original.base_workflow_code) } : { isNull: true } },
      { name: 'steps', value: { stringValue: typeof original.steps === 'string' ? original.steps : JSON.stringify(original.steps) } },
      { name: 'category', value: original.category ? { stringValue: String(original.category) } : { isNull: true } },
      { name: 'tags', value: { stringValue: Array.isArray(original.tags) ? `{${original.tags.join(',')}}` : '{}' } },
    ]
  );

  return await getTemplate(tenantId, userId, newTemplateId);
}

// ============================================================================
// Helpers
// ============================================================================

function mapTemplate(row: Record<string, unknown>) {
  return {
    templateId: String(row.template_id),
    templateName: String(row.template_name),
    templateDescription: row.template_description ? String(row.template_description) : undefined,
    baseWorkflowCode: row.base_workflow_code ? String(row.base_workflow_code) : undefined,
    baseWorkflowName: row.base_workflow_name ? String(row.base_workflow_name) : undefined,
    steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : (row.steps || []),
    workflowConfig: typeof row.workflow_config === 'string' ? JSON.parse(row.workflow_config) : (row.workflow_config || {}),
    category: row.category ? String(row.category) : undefined,
    tags: (row.tags as string[]) || [],
    isShared: Boolean(row.is_shared),
    isPublic: Boolean(row.is_public),
    timesUsed: Number(row.times_used || 0),
    avgQualityScore: row.avg_quality_score ? Number(row.avg_quality_score) : undefined,
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
