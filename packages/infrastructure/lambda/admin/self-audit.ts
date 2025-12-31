// RADIANT v4.18.0 - Admin API for Self-Audit
// Run compliance audits and view audit history

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { selfAuditService, AuditFramework } from '../shared/services/self-audit.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

// ============================================================================
// GET /admin/self-audit/dashboard
// Get audit dashboard with recent runs and scores
// ============================================================================
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.queryStringParameters?.tenant_id || 
                     event.requestContext.authorizer?.tenantId;

    const dashboard = await selfAuditService.getDashboard(tenantId);

    return response(200, {
      success: true,
      data: dashboard,
    });
  } catch (error) {
    logger.error('Error fetching audit dashboard', error);
    return response(500, { success: false, error: 'Failed to fetch dashboard' });
  }
};

// ============================================================================
// POST /admin/self-audit/run
// Run a new compliance audit
// ============================================================================
export const runAudit: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const framework = (body.framework || 'all') as AuditFramework;
    const tenantId = body.tenantId || event.requestContext.authorizer?.tenantId;
    const triggeredBy = event.requestContext.authorizer?.email || 'admin';

    // Validate framework
    const validFrameworks = ['soc2', 'hipaa', 'gdpr', 'iso27001', 'pci-dss', 'all'];
    if (!validFrameworks.includes(framework)) {
      return response(400, { 
        success: false, 
        error: `Invalid framework. Must be one of: ${validFrameworks.join(', ')}` 
      });
    }

    logger.info('Starting audit run', { framework, tenantId, triggeredBy });

    const result = await selfAuditService.runAudit({
      tenantId,
      framework,
      runType: 'manual',
      triggeredBy,
    });

    return response(200, {
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error running audit', error);
    return response(500, { success: false, error: 'Failed to run audit' });
  }
};

// ============================================================================
// GET /admin/self-audit/history
// Get audit run history
// ============================================================================
export const getHistory: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.queryStringParameters?.tenant_id ||
                     event.requestContext.authorizer?.tenantId;
    const framework = event.queryStringParameters?.framework;
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

    const history = await selfAuditService.getAuditHistory({
      tenantId,
      framework,
      limit,
      offset,
    });

    return response(200, {
      success: true,
      data: history.runs,
      total: history.total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching audit history', error);
    return response(500, { success: false, error: 'Failed to fetch history' });
  }
};

// ============================================================================
// GET /admin/self-audit/runs/:runId
// Get a specific audit run with results
// ============================================================================
export const getRun: APIGatewayProxyHandler = async (event) => {
  try {
    const runId = event.pathParameters?.runId;
    if (!runId) {
      return response(400, { success: false, error: 'Run ID is required' });
    }

    const run = await selfAuditService.getAuditRun(runId);
    if (!run) {
      return response(404, { success: false, error: 'Audit run not found' });
    }

    return response(200, {
      success: true,
      data: run,
    });
  } catch (error) {
    logger.error('Error fetching audit run', error);
    return response(500, { success: false, error: 'Failed to fetch audit run' });
  }
};

// ============================================================================
// GET /admin/self-audit/runs/:runId/results
// Get results for a specific audit run
// ============================================================================
export const getRunResults: APIGatewayProxyHandler = async (event) => {
  try {
    const runId = event.pathParameters?.runId;
    if (!runId) {
      return response(400, { success: false, error: 'Run ID is required' });
    }

    const results = await selfAuditService.getAuditResults(runId);

    return response(200, {
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    logger.error('Error fetching audit results', error);
    return response(500, { success: false, error: 'Failed to fetch results' });
  }
};

// ============================================================================
// GET /admin/self-audit/runs/:runId/report
// Generate compliance report for an audit run
// ============================================================================
export const getReport: APIGatewayProxyHandler = async (event) => {
  try {
    const runId = event.pathParameters?.runId;
    if (!runId) {
      return response(400, { success: false, error: 'Run ID is required' });
    }

    const report = await selfAuditService.generateReport(runId);

    return response(200, {
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error generating report', error);
    return response(500, { success: false, error: 'Failed to generate report' });
  }
};

// ============================================================================
// GET /admin/self-audit/checks
// Get all registered audit checks
// ============================================================================
export const getChecks: APIGatewayProxyHandler = async (event) => {
  try {
    const framework = event.queryStringParameters?.framework;

    const checks = await selfAuditService.getAuditChecks(framework);

    // Group by framework
    const byFramework: Record<string, typeof checks> = {};
    for (const check of checks) {
      if (!byFramework[check.framework]) byFramework[check.framework] = [];
      byFramework[check.framework].push(check);
    }

    return response(200, {
      success: true,
      data: checks,
      byFramework,
      count: checks.length,
    });
  } catch (error) {
    logger.error('Error fetching audit checks', error);
    return response(500, { success: false, error: 'Failed to fetch checks' });
  }
};

// ============================================================================
// GET /admin/self-audit/frameworks
// Get available frameworks with check counts
// ============================================================================
export const getFrameworks: APIGatewayProxyHandler = async () => {
  try {
    const checks = await selfAuditService.getAuditChecks();

    const frameworks: Record<string, {
      name: string;
      code: string;
      totalChecks: number;
      requiredChecks: number;
      categories: string[];
    }> = {};

    const frameworkNames: Record<string, string> = {
      'soc2': 'SOC 2 Type II',
      'hipaa': 'HIPAA',
      'gdpr': 'GDPR',
      'iso27001': 'ISO 27001',
      'pci-dss': 'PCI-DSS',
    };

    for (const check of checks) {
      if (!frameworks[check.framework]) {
        frameworks[check.framework] = {
          name: frameworkNames[check.framework] || check.framework.toUpperCase(),
          code: check.framework,
          totalChecks: 0,
          requiredChecks: 0,
          categories: [],
        };
      }
      frameworks[check.framework].totalChecks++;
      if (check.isRequired) frameworks[check.framework].requiredChecks++;
      if (!frameworks[check.framework].categories.includes(check.category)) {
        frameworks[check.framework].categories.push(check.category);
      }
    }

    return response(200, {
      success: true,
      data: Object.values(frameworks),
    });
  } catch (error) {
    logger.error('Error fetching frameworks', error);
    return response(500, { success: false, error: 'Failed to fetch frameworks' });
  }
};
