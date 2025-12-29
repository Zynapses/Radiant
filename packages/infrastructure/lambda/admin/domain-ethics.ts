// RADIANT v4.18.0 - Domain Ethics Admin API Handler
// Admin endpoints for managing domain-specific professional ethics

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { domainEthicsService } from '../shared/services/domain-ethics.service';
import { DOMAIN_ETHICS_REGISTRY } from '@radiant/shared';

// ============================================================================
// Helper Functions
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const success = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const error = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

const getTenantId = (event: { requestContext?: { authorizer?: Record<string, unknown> } }): string => {
  return String(event.requestContext?.authorizer?.tenantId || '');
};

const getAdminId = (event: { requestContext?: { authorizer?: Record<string, unknown> } }): string => {
  return String(event.requestContext?.authorizer?.userId || '');
};

// ============================================================================
// Framework Endpoints
// ============================================================================

/**
 * GET /api/admin/domain-ethics/frameworks
 * List all ethics frameworks (built-in + custom)
 */
export const listFrameworks: APIGatewayProxyHandler = async (event) => {
  try {
    const domain = event.queryStringParameters?.domain;
    const includeDisabled = event.queryStringParameters?.includeDisabled === 'true';
    
    let frameworks = await domainEthicsService.getAllFrameworks(includeDisabled);
    
    if (domain) {
      frameworks = frameworks.filter(f => f.domain === domain);
    }
    
    // Group by domain for easier display
    const byDomain: Record<string, typeof frameworks> = {};
    for (const framework of frameworks) {
      if (!byDomain[framework.domain]) {
        byDomain[framework.domain] = [];
      }
      byDomain[framework.domain].push(framework);
    }
    
    return success({
      frameworks,
      byDomain,
      totalCount: frameworks.length,
      domains: Object.keys(byDomain),
    });
  } catch (err) {
    console.error('Error listing frameworks:', err);
    return error(500, 'Failed to list frameworks');
  }
};

/**
 * GET /api/admin/domain-ethics/frameworks/:id
 * Get a specific framework with full details
 */
export const getFramework: APIGatewayProxyHandler = async (event) => {
  try {
    const frameworkId = event.pathParameters?.id;
    if (!frameworkId) {
      return error(400, 'Framework ID required');
    }
    
    const framework = await domainEthicsService.getFramework(frameworkId);
    if (!framework) {
      return error(404, 'Framework not found');
    }
    
    return success({
      framework,
      principleCount: framework.principles.length,
      prohibitionCount: framework.prohibitions.length,
      disclosureCount: framework.disclosureRequirements.length,
    });
  } catch (err) {
    console.error('Error getting framework:', err);
    return error(500, 'Failed to get framework');
  }
};

/**
 * GET /api/admin/domain-ethics/frameworks/domain/:domain
 * Get frameworks for a specific domain
 */
export const getFrameworksByDomain: APIGatewayProxyHandler = async (event) => {
  try {
    const domain = event.pathParameters?.domain;
    if (!domain) {
      return error(400, 'Domain required');
    }
    
    const frameworks = await domainEthicsService.getFrameworksForDomain(domain);
    
    return success({
      domain,
      frameworks,
      count: frameworks.length,
    });
  } catch (err) {
    console.error('Error getting frameworks by domain:', err);
    return error(500, 'Failed to get frameworks');
  }
};

// ============================================================================
// Configuration Endpoints
// ============================================================================

/**
 * GET /api/admin/domain-ethics/config
 * Get tenant ethics configuration
 */
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return error(401, 'Tenant not authenticated');
    }
    
    const config = await domainEthicsService.getTenantConfig(tenantId);
    
    // Get available domains
    const domains = [...new Set(DOMAIN_ETHICS_REGISTRY.map(f => f.domain))];
    
    return success({
      config,
      availableDomains: domains,
      availableEnforcementModes: ['strict', 'standard', 'advisory', 'disabled'],
    });
  } catch (err) {
    console.error('Error getting config:', err);
    return error(500, 'Failed to get configuration');
  }
};

/**
 * PUT /api/admin/domain-ethics/config
 * Update tenant ethics configuration
 */
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return error(401, 'Tenant not authenticated');
    }
    
    const body = JSON.parse(event.body || '{}');
    
    const config = await domainEthicsService.updateTenantConfig(tenantId, body);
    
    return success({
      config,
      message: 'Configuration updated successfully',
    });
  } catch (err) {
    console.error('Error updating config:', err);
    return error(500, 'Failed to update configuration');
  }
};

/**
 * PUT /api/admin/domain-ethics/frameworks/:id/enable
 * Enable or disable a framework for the tenant
 */
export const setFrameworkEnabled: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return error(401, 'Tenant not authenticated');
    }
    
    const frameworkId = event.pathParameters?.id;
    if (!frameworkId) {
      return error(400, 'Framework ID required');
    }
    
    const body = JSON.parse(event.body || '{}');
    const enabled = body.enabled !== false;
    
    try {
      await domainEthicsService.setFrameworkEnabled(tenantId, frameworkId, enabled);
    } catch (err) {
      if (err instanceof Error && err.message.includes('cannot be disabled')) {
        return error(403, err.message);
      }
      throw err;
    }
    
    return success({
      frameworkId,
      enabled,
      message: `Framework ${enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (err) {
    console.error('Error setting framework enabled:', err);
    return error(500, 'Failed to update framework');
  }
};

/**
 * PUT /api/admin/domain-ethics/domains/:domain/settings
 * Update domain-specific settings
 */
export const updateDomainSettings: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return error(401, 'Tenant not authenticated');
    }
    
    const domain = event.pathParameters?.domain;
    if (!domain) {
      return error(400, 'Domain required');
    }
    
    const body = JSON.parse(event.body || '{}');
    
    await domainEthicsService.updateDomainSettings(tenantId, domain, body);
    
    const config = await domainEthicsService.getTenantConfig(tenantId);
    
    return success({
      domain,
      settings: config.domainSettings[domain],
      message: 'Domain settings updated successfully',
    });
  } catch (err) {
    console.error('Error updating domain settings:', err);
    return error(500, 'Failed to update domain settings');
  }
};

// ============================================================================
// Audit & Analytics Endpoints
// ============================================================================

/**
 * GET /api/admin/domain-ethics/audit
 * Get ethics check audit logs
 */
export const getAuditLogs: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return error(401, 'Tenant not authenticated');
    }
    
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const domain = event.queryStringParameters?.domain;
    const violationsOnly = event.queryStringParameters?.violationsOnly === 'true';
    const startDate = event.queryStringParameters?.startDate 
      ? new Date(event.queryStringParameters.startDate) 
      : undefined;
    const endDate = event.queryStringParameters?.endDate 
      ? new Date(event.queryStringParameters.endDate) 
      : undefined;
    
    const logs = await domainEthicsService.getAuditLogs(tenantId, {
      limit,
      offset,
      domain,
      violationsOnly,
      startDate,
      endDate,
    });
    
    return success({
      logs,
      pagination: {
        limit,
        offset,
        hasMore: logs.length === limit,
      },
    });
  } catch (err) {
    console.error('Error getting audit logs:', err);
    return error(500, 'Failed to get audit logs');
  }
};

/**
 * GET /api/admin/domain-ethics/stats
 * Get ethics check statistics
 */
export const getStats: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return error(401, 'Tenant not authenticated');
    }
    
    const days = parseInt(event.queryStringParameters?.days || '30', 10);
    
    const stats = await domainEthicsService.getStats(tenantId, days);
    
    return success({
      stats,
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    return error(500, 'Failed to get statistics');
  }
};

// ============================================================================
// Test Endpoint
// ============================================================================

/**
 * POST /api/admin/domain-ethics/test
 * Test ethics check on sample content
 */
export const testEthicsCheck: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getAdminId(event);
    if (!tenantId || !userId) {
      return error(401, 'Not authenticated');
    }
    
    const body = JSON.parse(event.body || '{}');
    const { domain, subspecialty, content } = body;
    
    if (!domain || !content) {
      return error(400, 'Domain and content are required');
    }
    
    const check = await domainEthicsService.checkDomainEthics({
      tenantId,
      userId,
      sessionId: 'test-session',
      promptId: 'test-prompt',
      domain,
      subspecialty,
      content,
    });
    
    // Apply modifications to show what the output would look like
    let modifiedContent = content;
    if (!check.passed || check.requiredDisclosures.length > 0) {
      modifiedContent = domainEthicsService.applyModifications(content, check);
    }
    
    return success({
      check,
      originalContent: content,
      modifiedContent,
      wouldBlock: !check.passed && check.violations.some(v => v.action === 'block'),
    });
  } catch (err) {
    console.error('Error testing ethics check:', err);
    return error(500, 'Failed to test ethics check');
  }
};

// ============================================================================
// Disclaimers Endpoint
// ============================================================================

/**
 * GET /api/admin/domain-ethics/disclaimers/:domain
 * Get all required disclaimers for a domain
 */
export const getDisclaimers: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return error(401, 'Tenant not authenticated');
    }
    
    const domain = event.pathParameters?.domain;
    if (!domain) {
      return error(400, 'Domain required');
    }
    
    const disclaimers = await domainEthicsService.getDisclaimersForDomain(tenantId, domain);
    
    return success({
      domain,
      disclaimers,
      count: disclaimers.length,
    });
  } catch (err) {
    console.error('Error getting disclaimers:', err);
    return error(500, 'Failed to get disclaimers');
  }
};
