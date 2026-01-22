import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { extractAuthContext } from '../shared/auth';
import { 
  schemaAdaptiveReportsService,
  DynamicReportDefinition,
} from '../shared/services/schema-adaptive-reports.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const success = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

const error = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify({ error: message }),
});

export const handler: APIGatewayProxyHandler = async (event) => {
  const { httpMethod: method, path, body: rawBody } = event;
  
  try {
    const auth = extractAuthContext(event);
    if (!auth.tenantId) {
      return error(401, 'Unauthorized');
    }

    const { tenantId } = auth;
    const body = rawBody ? JSON.parse(rawBody) : {};

    logger.info('Dynamic Reports API request', { method, path, tenantId });

    // GET /admin/dynamic-reports/schema - Discover database schema
    if (method === 'GET' && path.endsWith('/schema')) {
      const schema = await schemaAdaptiveReportsService.discoverSchema(tenantId);
      return success({ schema });
    }

    // GET /admin/dynamic-reports/suggestions - Get suggested reports
    if (method === 'GET' && path.endsWith('/suggestions')) {
      const suggestions = await schemaAdaptiveReportsService.getSuggestedReports(tenantId);
      return success({ suggestions });
    }

    // GET /admin/dynamic-reports - List saved reports
    if (method === 'GET' && (path.endsWith('/dynamic-reports') || path.endsWith('/dynamic-reports/'))) {
      const reports = await schemaAdaptiveReportsService.listSavedReports(tenantId);
      return success({ reports, count: reports.length });
    }

    // POST /admin/dynamic-reports/execute - Execute a report
    if (method === 'POST' && path.endsWith('/execute')) {
      const definition = body as DynamicReportDefinition;
      if (!definition.baseTable || !definition.fields || definition.fields.length === 0) {
        return error(400, 'Invalid report definition: baseTable and fields are required');
      }
      const result = await schemaAdaptiveReportsService.executeReport(tenantId, definition);
      return success({ result });
    }

    // POST /admin/dynamic-reports - Save a new report
    if (method === 'POST' && (path.endsWith('/dynamic-reports') || path.endsWith('/dynamic-reports/'))) {
      const definition = body as DynamicReportDefinition;
      if (!definition.name || !definition.baseTable) {
        return error(400, 'Invalid report definition: name and baseTable are required');
      }
      const { id } = await schemaAdaptiveReportsService.saveReportDefinition(tenantId, definition);
      return success({ id, message: 'Report saved successfully' });
    }

    // DELETE /admin/dynamic-reports/:id - Delete a report
    if (method === 'DELETE' && path.includes('/dynamic-reports/')) {
      const reportId = path.split('/').pop();
      if (!reportId) {
        return error(400, 'Report ID is required');
      }
      await schemaAdaptiveReportsService.deleteReport(tenantId, reportId);
      return success({ message: 'Report deleted successfully' });
    }

    // POST /admin/dynamic-reports/export - Export report data
    if (method === 'POST' && path.endsWith('/export')) {
      const { definition, format } = body as { definition: DynamicReportDefinition; format: string };
      const result = await schemaAdaptiveReportsService.executeReport(tenantId, definition);
      
      if (format === 'csv') {
        const headers = result.columns.map(c => c.name).join(',');
        const rows = result.rows.map(row => 
          result.columns.map(c => {
            const val = row[c.name];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
            return String(val);
          }).join(',')
        ).join('\n');
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${definition.name.replace(/\s+/g, '_')}.csv"`,
            'Access-Control-Allow-Origin': '*',
          },
          body: `${headers}\n${rows}`,
        };
      }

      return success({ result, format });
    }

    return error(404, 'Endpoint not found');
  } catch (err) {
    logger.error('Dynamic Reports API error', { error: err, path, method });
    return error(500, err instanceof Error ? err.message : 'Internal server error');
  }
};
