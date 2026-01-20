/**
 * White-Label Invisibility API Handler
 * 
 * Moat #25: End users never know RADIANT exists. Infrastructure stickiness.
 * Platform layer dependency.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { whiteLabelService } from '../shared/services/white-label.service';

const logger = new Logger({ serviceName: 'white-label-api' });

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const tenantId = event.requestContext.authorizer?.tenantId;

  if (!tenantId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const path = event.path.replace('/api/admin/white-label', '');
  const method = event.httpMethod;

  try {
    // GET /config - Get configuration
    if (path === '/config' && method === 'GET') {
      const config = await whiteLabelService.getConfig(tenantId);
      return {
        statusCode: config ? 200 : 404,
        body: JSON.stringify(config || { error: 'No config found' }),
      };
    }

    // POST /config - Create configuration
    if (path === '/config' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const config = await whiteLabelService.createConfig(tenantId, body);
      return {
        statusCode: 201,
        body: JSON.stringify(config),
      };
    }

    // PUT /config - Update configuration
    if (path === '/config' && method === 'PUT') {
      const updates = JSON.parse(event.body || '{}');
      const config = await whiteLabelService.updateConfig(tenantId, updates);
      return {
        statusCode: 200,
        body: JSON.stringify(config),
      };
    }

    // DELETE /config - Delete configuration
    if (path === '/config' && method === 'DELETE') {
      const deleted = await whiteLabelService.deleteConfig(tenantId);
      return {
        statusCode: deleted ? 200 : 404,
        body: JSON.stringify({ deleted }),
      };
    }

    // POST /validate - Validate configuration
    if (path === '/validate' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const config = await whiteLabelService.getConfig(tenantId);
      if (!config) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'No config found' }),
        };
      }
      const validation = await whiteLabelService.validateConfig({ ...config, ...body });
      return {
        statusCode: 200,
        body: JSON.stringify(validation),
      };
    }

    // POST /domains - Add domain
    if (path === '/domains' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const domain = await whiteLabelService.addDomain(
        tenantId,
        body.domain,
        body.type || 'primary'
      );
      return {
        statusCode: 201,
        body: JSON.stringify(domain),
      };
    }

    // DELETE /domains/:domainId - Remove domain
    const domainMatch = path.match(/^\/domains\/([^/]+)$/);
    if (domainMatch && method === 'DELETE') {
      const domainId = domainMatch[1];
      const removed = await whiteLabelService.removeDomain(tenantId, domainId);
      return {
        statusCode: removed ? 200 : 404,
        body: JSON.stringify({ removed }),
      };
    }

    // POST /domains/:domain/verify - Initiate domain verification
    const verifyMatch = path.match(/^\/domains\/([^/]+)\/verify$/);
    if (verifyMatch && method === 'POST') {
      const domain = decodeURIComponent(verifyMatch[1]);
      const verification = await whiteLabelService.initiateDomainVerification(tenantId, domain);
      return {
        statusCode: 200,
        body: JSON.stringify(verification),
      };
    }

    // GET /domains/:domain/verify - Check domain verification
    if (verifyMatch && method === 'GET') {
      const domain = decodeURIComponent(verifyMatch[1]);
      const verification = await whiteLabelService.checkDomainVerification(tenantId, domain);
      return {
        statusCode: 200,
        body: JSON.stringify(verification),
      };
    }

    // PUT /branding - Update branding
    if (path === '/branding' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const branding = await whiteLabelService.updateBranding(tenantId, body);
      return {
        statusCode: 200,
        body: JSON.stringify(branding),
      };
    }

    // PUT /features - Update feature visibility
    if (path === '/features' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const features = await whiteLabelService.updateFeatureVisibility(tenantId, body);
      return {
        statusCode: 200,
        body: JSON.stringify(features),
      };
    }

    // PUT /legal - Update legal config
    if (path === '/legal' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const legal = await whiteLabelService.updateLegal(tenantId, body);
      return {
        statusCode: 200,
        body: JSON.stringify(legal),
      };
    }

    // PUT /emails - Update email config
    if (path === '/emails' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const emails = await whiteLabelService.updateEmailConfig(tenantId, body);
      return {
        statusCode: 200,
        body: JSON.stringify(emails),
      };
    }

    // GET /preview - Generate branding preview
    if (path === '/preview' && method === 'GET') {
      const preview = await whiteLabelService.generateBrandingPreview(tenantId);
      return {
        statusCode: 200,
        body: JSON.stringify(preview),
      };
    }

    // GET /export - Export configuration
    if (path === '/export' && method === 'GET') {
      const exportData = await whiteLabelService.exportConfig(tenantId);
      return {
        statusCode: 200,
        body: JSON.stringify(exportData),
      };
    }

    // POST /import - Import configuration
    if (path === '/import' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const config = await whiteLabelService.importConfig(tenantId, body);
      return {
        statusCode: 200,
        body: JSON.stringify(config),
      };
    }

    // GET /metrics - Get metrics
    if (path === '/metrics' && method === 'GET') {
      const period = event.queryStringParameters?.period || 'day';
      const metrics = await whiteLabelService.getMetrics(tenantId, period);
      return {
        statusCode: 200,
        body: JSON.stringify(metrics),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    logger.error('Error in white-label handler', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}
