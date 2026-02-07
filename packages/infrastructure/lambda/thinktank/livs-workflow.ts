/**
 * LIVS-M Workflow API Handler
 * 
 * Think Tank API endpoints for managing LIVS workflow templates and user preferences.
 * Allows users to toggle LIVS on/off and select workflow templates.
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { getPoolClient } from '../shared/db/centralized-pool';
import { LIVSWorkflowTemplateService } from '../shared/services/livs/livs-workflow-template.service';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'thinktank/livs-workflow',
  category: 'application',
  sourceType: 'lambda',
});
import { corsHeaders } from '../shared/middleware/api-response';
import { InterrogationDepth } from '@radiant/shared';

type LIVSEnvironmentMode = 'strict_engineering' | 'balanced' | 'brainstorming' | 'audit';

interface CreateWorkflowTemplateRequest {
  name: string;
  description?: string;
  slug?: string;
  parentTemplateId?: string;
  environmentMode?: LIVSEnvironmentMode;
  treatWarningsAsBlockers?: boolean;
  defaultInterrogationDepth?: InterrogationDepth;
  autoEscalate?: boolean;
  escalationThreshold?: number;
  interrogatorModel?: string;
  stubDetectionEnabled?: boolean;
  stubPatterns?: string[];
  stubEnforcementAction?: string;
  sycophancyDetectionEnabled?: boolean;
  minTurnsBeforeAgreement?: number;
  maxConsensusThreshold?: number;
  chaosInjectionPrompt?: string;
  enableThesisAntithesis?: boolean;
  antithesisModel?: string;
  synthesisRequired?: boolean;
  maxCostMultiplier?: number;
  maxTokensPerInterrogation?: number;
  isActive?: boolean;
}

let currentService: LIVSWorkflowTemplateService | null = null;
let currentClient: PoolClient | null = null;

const getService = async (): Promise<LIVSWorkflowTemplateService> => {
  if (!currentService) {
    currentClient = await getPoolClient();
    const pool = { query: currentClient.query.bind(currentClient) } as any;
    currentService = new LIVSWorkflowTemplateService({ pool });
  }
  return currentService;
};

const releaseClient = () => {
  if (currentClient) {
    currentClient.release();
    currentClient = null;
    currentService = null;
  }
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const extractContext = (event: APIGatewayProxyEvent): { tenantId: string; userId: string } => {
  const tenantId = event.headers['x-tenant-id'] || event.requestContext?.authorizer?.tenantId;
  const userId = event.headers['x-user-id'] || event.requestContext?.authorizer?.userId;
  
  if (!tenantId || !userId) {
    throw new Error('Missing tenant or user context');
  }
  
  return { tenantId, userId };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const workflowService = await getService();
    
    const path = event.path.replace(/^\/api\/thinktank\/livs-workflow/, '');
    const method = event.httpMethod;

    // Public routes (no auth required for toggle)
    if (path === '/toggle' && method === 'POST') {
      return handleToggle(event, workflowService);
    }

    // All other routes require context
    const { tenantId, userId } = extractContext(event);

    // Route handling
    if (path === '' || path === '/') {
      if (method === 'GET') return getEffectiveSettings(tenantId, userId, workflowService);
    }

    if (path === '/templates') {
      if (method === 'GET') return getTemplates(tenantId, userId, workflowService);
      if (method === 'POST') return createTemplate(event, tenantId, userId, workflowService);
    }

    if (path.startsWith('/templates/')) {
      const templateId = path.split('/')[2];
      if (method === 'GET') return getTemplate(tenantId, templateId, workflowService);
      if (method === 'PUT') return updateTemplate(event, tenantId, templateId, workflowService);
      if (method === 'DELETE') return deleteTemplate(tenantId, templateId, workflowService);
    }

    if (path === '/preferences') {
      if (method === 'GET') return getPreferences(tenantId, userId, workflowService);
      if (method === 'PUT') return updatePreferences(event, tenantId, userId, workflowService);
    }

    if (path === '/select') {
      if (method === 'POST') return selectWorkflow(event, tenantId, userId, workflowService);
    }

    if (path === '/system-templates') {
      if (method === 'GET') return getSystemTemplates(tenantId, workflowService);
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    logger.error('LIVS Workflow API error', { error });
    return response(500, { 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    releaseClient();
  }
};

/**
 * GET / - Get effective LIVS settings for current user
 */
async function getEffectiveSettings(
  tenantId: string, 
  userId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  const settings = await workflowService.getEffectiveSettings(tenantId, userId);
  return response(200, { settings });
}

/**
 * GET /templates - Get all available workflow templates
 */
async function getTemplates(
  tenantId: string, 
  userId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  const systemTemplates = await workflowService.getTemplates(tenantId, { ownerType: 'system' });
  const tenantTemplates = await workflowService.getTemplates(tenantId, { ownerType: 'tenant' });
  const userTemplates = await workflowService.getTemplates(tenantId, { ownerType: 'user', ownerId: userId });

  return response(200, {
    systemTemplates,
    tenantTemplates,
    userTemplates,
  });
}

/**
 * GET /system-templates - Get only system default templates
 */
async function getSystemTemplates(
  tenantId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  await workflowService.ensureSystemTemplates(tenantId);
  const templates = await workflowService.getTemplates(tenantId, { ownerType: 'system' });
  return response(200, { templates });
}

/**
 * GET /templates/:id - Get a specific template
 */
async function getTemplate(
  tenantId: string, 
  templateId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  const template = await workflowService.getTemplate(tenantId, templateId);
  if (!template) {
    return response(404, { error: 'Template not found' });
  }
  return response(200, { template });
}

/**
 * POST /templates - Create a new user workflow template
 */
async function createTemplate(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as CreateWorkflowTemplateRequest;
  
  if (!body.name) {
    return response(400, { error: 'Template name is required' });
  }

  const template = await workflowService.createTemplate(tenantId, body as any, 'user', userId);
  return response(201, { template });
}

/**
 * PUT /templates/:id - Update a template
 */
async function updateTemplate(
  event: APIGatewayProxyEvent,
  tenantId: string,
  templateId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as Partial<CreateWorkflowTemplateRequest>;
  
  try {
    const template = await workflowService.updateTemplate(tenantId, templateId, body as any);
    if (!template) {
      return response(404, { error: 'Template not found' });
    }
    return response(200, { template });
  } catch (error) {
    if (error instanceof Error && error.message.includes('system templates')) {
      return response(403, { error: 'Cannot modify system templates' });
    }
    throw error;
  }
}

/**
 * DELETE /templates/:id - Delete a user template
 */
async function deleteTemplate(
  tenantId: string,
  templateId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  try {
    const deleted = await workflowService.deleteTemplate(tenantId, templateId);
    if (!deleted) {
      return response(404, { error: 'Template not found' });
    }
    return response(200, { success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('system templates')) {
      return response(403, { error: 'Cannot delete system templates' });
    }
    throw error;
  }
}

/**
 * GET /preferences - Get user workflow preferences
 */
async function getPreferences(
  tenantId: string, 
  userId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  const preferences = await workflowService.getUserPreferences(tenantId, userId);
  return response(200, { 
    preferences: preferences || {
      livsEnabled: true,
      activeWorkflowId: null,
    }
  });
}

/**
 * PUT /preferences - Update user workflow preferences
 */
async function updatePreferences(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as {
    livsEnabled?: boolean;
    activeWorkflowId?: string | null;
    environmentModeOverride?: LIVSEnvironmentMode | null;
    interrogationDepthOverride?: InterrogationDepth | null;
  };

  const preferences = await workflowService.setUserPreferences(tenantId, userId, {
    livsEnabled: body.livsEnabled,
    activeWorkflowId: body.activeWorkflowId ?? undefined,
    environmentModeOverride: body.environmentModeOverride as any,
    interrogationDepthOverride: body.interrogationDepthOverride ?? undefined,
  });

  return response(200, { preferences });
}

/**
 * POST /toggle - Quick toggle LIVS on/off
 */
async function handleToggle(
  event: APIGatewayProxyEvent,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  try {
    const { tenantId, userId } = extractContext(event);
    const body = JSON.parse(event.body || '{}') as { enabled: boolean };

    if (typeof body.enabled !== 'boolean') {
      return response(400, { error: 'enabled must be a boolean' });
    }

    await workflowService.toggleLIVS(tenantId, userId, body.enabled);
    
    const settings = await workflowService.getEffectiveSettings(tenantId, userId);
    
    return response(200, { 
      success: true,
      enabled: body.enabled,
      settings,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing tenant')) {
      return response(401, { error: 'Unauthorized' });
    }
    throw error;
  }
}

/**
 * POST /select - Select a workflow template
 */
async function selectWorkflow(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId: string,
  workflowService: LIVSWorkflowTemplateService
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as { 
    templateId?: string | null;
    useDefault?: boolean;
  };

  let activeWorkflowId: string | undefined;

  if (body.useDefault) {
    const defaultTemplate = await workflowService.getDefaultTemplate(tenantId);
    activeWorkflowId = defaultTemplate?.id;
  } else if (body.templateId) {
    const template = await workflowService.getTemplate(tenantId, body.templateId);
    if (!template) {
      return response(404, { error: 'Template not found' });
    }
    activeWorkflowId = body.templateId;
  }

  await workflowService.setUserPreferences(tenantId, userId, {
    activeWorkflowId,
  });

  const settings = await workflowService.getEffectiveSettings(tenantId, userId);
  
  return response(200, { 
    success: true,
    settings,
  });
}
