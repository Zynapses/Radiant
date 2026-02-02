/**
 * RADIANT Domain Expert Cortex Admin API
 * Endpoints for managing 7 specialized neural networks per domain
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { domainExpertService } from '../shared/services/domain-expert.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import type { DomainExpertNetworkType } from '@radiant/shared';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const getTenantId = (event: { headers: Record<string, string | undefined> }): string => {
  return event.headers['x-tenant-id'] || event.headers['X-Tenant-Id'] || '';
};

const getUserId = (event: { requestContext: { authorizer?: { claims?: { sub?: string } } } }): string => {
  return event.requestContext.authorizer?.claims?.sub || 'system';
};

/**
 * GET /api/admin/domain-experts/dashboard
 * Get dashboard with all domain expert suites
 */
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const dashboard = await domainExpertService.getDashboard(tenantId);
    return respond(200, dashboard);
  } catch (error) {
    logger.error('Failed to get domain expert dashboard', { error });
    return respond(500, { error: 'Failed to get dashboard' });
  }
};

/**
 * GET /api/admin/domain-experts
 * List domain expert suites
 */
export const listDomainExperts: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const params = event.queryStringParameters || {};
    const result = await domainExpertService.listDomainExperts({
      tenantId,
      domainId: params.domainId,
      networkType: params.networkType as DomainExpertNetworkType | undefined,
      status: params.status as any,
      limit: params.limit ? parseInt(params.limit) : undefined,
      offset: params.offset ? parseInt(params.offset) : undefined,
    });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to list domain experts', { error });
    return respond(500, { error: 'Failed to list domain experts' });
  }
};

/**
 * GET /api/admin/domain-experts/domains/:domainId
 * Get domain configuration
 */
export const getDomainConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const domainId = event.pathParameters?.domainId;

    if (!tenantId || !domainId) {
      return respond(400, { error: 'Tenant ID and Domain ID required' });
    }

    const config = await domainExpertService.getDomainConfig(tenantId, domainId);
    if (!config) {
      return respond(404, { error: 'Domain config not found' });
    }

    return respond(200, { config });
  } catch (error) {
    logger.error('Failed to get domain config', { error });
    return respond(500, { error: 'Failed to get domain config' });
  }
};

/**
 * POST /api/admin/domain-experts/domains
 * Create domain configuration
 */
export const createDomainConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.domainId || !body.displayName) {
      return respond(400, { error: 'domainId and displayName are required' });
    }

    const config = await domainExpertService.createDomainConfig(tenantId, userId, body);
    return respond(201, { config });
  } catch (error) {
    logger.error('Failed to create domain config', { error });
    return respond(500, { error: 'Failed to create domain config' });
  }
};

/**
 * PATCH /api/admin/domain-experts/domains/:domainId
 * Update domain configuration
 */
export const updateDomainConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const domainId = event.pathParameters?.domainId;

    if (!tenantId || !domainId) {
      return respond(400, { error: 'Tenant ID and Domain ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const config = await domainExpertService.updateDomainConfig(tenantId, domainId, body);
    return respond(200, { config });
  } catch (error) {
    logger.error('Failed to update domain config', { error });
    return respond(500, { error: 'Failed to update domain config' });
  }
};

/**
 * GET /api/admin/domain-experts/domains/:domainId/networks/:networkType
 * Get specific network
 */
export const getNetwork: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const domainId = event.pathParameters?.domainId;
    const networkType = event.pathParameters?.networkType as DomainExpertNetworkType;

    if (!tenantId || !domainId || !networkType) {
      return respond(400, { error: 'Tenant ID, Domain ID, and Network Type required' });
    }

    const network = await domainExpertService.getNetwork(tenantId, domainId, networkType);
    if (!network) {
      return respond(404, { error: 'Network not found' });
    }

    return respond(200, { network });
  } catch (error) {
    logger.error('Failed to get network', { error });
    return respond(500, { error: 'Failed to get network' });
  }
};

/**
 * POST /api/admin/domain-experts/domains/:domainId/networks/:networkType/deploy
 * Deploy a network
 */
export const deployNetwork: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const domainId = event.pathParameters?.domainId;
    const networkType = event.pathParameters?.networkType as DomainExpertNetworkType;

    if (!tenantId || !domainId || !networkType) {
      return respond(400, { error: 'Tenant ID, Domain ID, and Network Type required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.version || !body.storageKey) {
      return respond(400, { error: 'version and storageKey are required' });
    }

    const network = await domainExpertService.deployNetwork({
      tenantId,
      domainId,
      networkType,
      version: body.version,
      storageKey: body.storageKey,
      parameters: body.parameters,
    }, userId);

    return respond(200, { network });
  } catch (error) {
    logger.error('Failed to deploy network', { error });
    return respond(500, { error: 'Failed to deploy network' });
  }
};

/**
 * POST /api/admin/domain-experts/inference
 * Run inference on a domain expert network
 */
export const runInference: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.domainId || !body.networkType || !body.input?.embedding) {
      return respond(400, { error: 'domainId, networkType, and input.embedding are required' });
    }

    const result = await domainExpertService.runInference({
      tenantId,
      domainId: body.domainId,
      networkType: body.networkType,
      input: body.input,
      options: body.options,
    });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to run inference', { error });
    return respond(500, { error: 'Failed to run inference' });
  }
};

/**
 * POST /api/admin/domain-experts/training
 * Start a training job
 */
export const startTraining: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.domainId || !body.networkType || !body.datasetId) {
      return respond(400, { error: 'domainId, networkType, and datasetId are required' });
    }

    const job = await domainExpertService.startTraining({
      tenantId,
      domainId: body.domainId,
      networkType: body.networkType,
      datasetId: body.datasetId,
      config: body.config,
    }, userId);

    return respond(201, { job });
  } catch (error) {
    logger.error('Failed to start training', { error });
    return respond(500, { error: 'Failed to start training' });
  }
};

/**
 * GET /api/admin/domain-experts/training/:jobId
 * Get training job status
 */
export const getTrainingJob: APIGatewayProxyHandler = async (event) => {
  try {
    const jobId = event.pathParameters?.jobId;

    if (!jobId) {
      return respond(400, { error: 'Job ID required' });
    }

    const job = await domainExpertService.getTrainingJob(jobId);
    if (!job) {
      return respond(404, { error: 'Training job not found' });
    }

    return respond(200, { job });
  } catch (error) {
    logger.error('Failed to get training job', { error });
    return respond(500, { error: 'Failed to get training job' });
  }
};
