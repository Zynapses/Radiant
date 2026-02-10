/**
 * RADIANT Model Metadata Admin API
 * Endpoints for managing AI model metadata, research schedules, and sources
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { modelMetadataService } from '../shared/services/model-metadata.service';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/model-metadata',
  category: 'audit',
  sourceType: 'lambda',
});

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

/**
 * Main handler - routes requests by method and path
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  const path = event.path.replace(/^\/api\/admin\/model-metadata\/?/, '');
  const segments = path.split('/').filter(Boolean);
  const method = event.httpMethod;

  try {
    // GET /admin/model-metadata/models
    if (method === 'GET' && segments[0] === 'models' && !segments[1]) {
      const metadata = await modelMetadataService.getAllMetadata();
      return respond(200, { success: true, data: metadata });
    }

    // GET /admin/model-metadata/models/:modelId
    if (method === 'GET' && segments[0] === 'models' && segments[1]) {
      const metadata = await modelMetadataService.getMetadata(segments[1]);
      if (!metadata) {
        return respond(404, { success: false, error: 'Model not found' });
      }
      return respond(200, { success: true, data: metadata });
    }

    // POST /admin/model-metadata/models/:modelId/research
    if (method === 'POST' && segments[0] === 'models' && segments[2] === 'research') {
      const body = event.body ? JSON.parse(event.body) : {};
      const depth = body.depth || 'standard';
      const result = await modelMetadataService.researchModel(segments[1], depth);
      return respond(200, { success: true, data: result });
    }

    // GET /admin/model-metadata/schedules
    if (method === 'GET' && segments[0] === 'schedules') {
      const schedules = await modelMetadataService.getRefreshSchedules();
      return respond(200, { success: true, data: schedules });
    }

    // POST /admin/model-metadata/schedules
    if (method === 'POST' && segments[0] === 'schedules') {
      const body = event.body ? JSON.parse(event.body) : {};
      const schedule = await modelMetadataService.createRefreshSchedule(body);
      return respond(201, { success: true, data: schedule });
    }

    // PUT /admin/model-metadata/schedules/:id
    if (method === 'PUT' && segments[0] === 'schedules' && segments[1]) {
      const body = event.body ? JSON.parse(event.body) : {};
      const schedule = await modelMetadataService.updateRefreshSchedule(segments[1], body);
      return respond(200, { success: true, data: schedule });
    }

    // GET /admin/model-metadata/research-history
    if (method === 'GET' && segments[0] === 'research-history') {
      const history = await modelMetadataService.getResearchHistory();
      return respond(200, { success: true, data: history });
    }

    // GET /admin/model-metadata/sources
    if (method === 'GET' && segments[0] === 'sources') {
      const sources = await modelMetadataService.getSources();
      return respond(200, { success: true, data: sources });
    }

    return respond(404, { success: false, error: 'Route not found' });
  } catch (error) {
    logger.error('Model metadata admin error', error as Error);
    return respond(500, {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};
