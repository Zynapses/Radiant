/**
 * Cartridge RNIR Admin API Handler
 * 
 * Manages RNIR (Radiant Neural Intermediate Representation) - 
 * model-agnostic cognitive source code compilation.
 * 
 * @version 1.0.0
 * @since v6.2.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { cartridgeRNIRService } from '../shared/services/cartridge-rnir.service';
import { logger } from '../shared/logging/enhanced-logger';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace(/^\/api\/admin\/rnir/, '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId || 'default';

  logger.info('RNIR API request', { path, method, tenantId });

  try {
    // GET /dashboard - Get RNIR dashboard
    if (method === 'GET' && path === '/dashboard') {
      const dashboard = await cartridgeRNIRService.getDashboard(tenantId);
      return { statusCode: 200, headers, body: JSON.stringify(dashboard) };
    }

    // POST /generate - Generate RNIR from Curator
    if (method === 'POST' && path === '/generate') {
      const body = JSON.parse(event.body || '{}');
      const result = await cartridgeRNIRService.generateFromCurator(tenantId, body);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // GET /documents/:cartridgeId - Get document previews for a cartridge
    const docsMatch = path.match(/^\/documents\/([^/]+)$/);
    if (method === 'GET' && docsMatch) {
      const cartridgeId = docsMatch[1];
      const previews = await cartridgeRNIRService.getDocumentPreviews(tenantId, cartridgeId);
      return { statusCode: 200, headers, body: JSON.stringify({ documents: previews }) };
    }

    // POST /compile - Start a compilation job
    if (method === 'POST' && path === '/compile') {
      const body = JSON.parse(event.body || '{}');
      const job = await cartridgeRNIRService.startCompilation(tenantId, body);
      return { statusCode: 201, headers, body: JSON.stringify(job) };
    }

    // GET /jobs - List compilation jobs
    if (method === 'GET' && path === '/jobs') {
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      const jobs = await cartridgeRNIRService.listJobs(tenantId, limit);
      return { statusCode: 200, headers, body: JSON.stringify({ jobs }) };
    }

    // GET /jobs/:id - Get compilation job status
    const jobMatch = path.match(/^\/jobs\/([^/]+)$/);
    if (method === 'GET' && jobMatch) {
      const jobId = jobMatch[1];
      const job = await cartridgeRNIRService.getJob(jobId);
      if (!job) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(job) };
    }

    // POST /jobs/:id/process - Process a compilation job (internal/worker)
    const processMatch = path.match(/^\/jobs\/([^/]+)\/process$/);
    if (method === 'POST' && processMatch) {
      const jobId = processMatch[1];
      const artifacts = await cartridgeRNIRService.processCompilation(jobId);
      return { statusCode: 200, headers, body: JSON.stringify({ artifacts }) };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found', path, method }),
    };
  } catch (error) {
    logger.error('RNIR API error', { error: String(error), path, method });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(error) }),
    };
  }
}
