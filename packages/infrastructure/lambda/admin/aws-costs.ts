// RADIANT v5.38.0 - AWS Cost Monitoring Admin API
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { awsCostMonitoringService } from '../shared/services/aws-cost-monitoring.service';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // GET /admin/costs/report - Get full cost report
    if (method === 'GET' && path.endsWith('/report')) {
      const days = parseInt(event.queryStringParameters?.days || '30', 10);
      const report = await awsCostMonitoringService.getCostReport(user.tenantId, days);
      return success(report);
    }

    // GET /admin/costs/summary - Get cost summary only
    if (method === 'GET' && path.endsWith('/summary')) {
      const days = parseInt(event.queryStringParameters?.days || '30', 10);
      const summary = await awsCostMonitoringService.getCostSummary(days);
      return success(summary);
    }

    // GET /admin/costs/services - Get service breakdown
    if (method === 'GET' && path.endsWith('/services')) {
      const days = parseInt(event.queryStringParameters?.days || '30', 10);
      const services = await awsCostMonitoringService.getServiceBreakdown(days);
      return success({ services });
    }

    // GET /admin/costs/daily - Get daily costs
    if (method === 'GET' && path.endsWith('/daily')) {
      const days = parseInt(event.queryStringParameters?.days || '30', 10);
      const dailyCosts = await awsCostMonitoringService.getDailyCosts(days);
      return success({ dailyCosts });
    }

    // GET /admin/costs/alerts - Get cost alerts
    if (method === 'GET' && path.endsWith('/alerts')) {
      const alerts = await awsCostMonitoringService.getCostAlerts(user.tenantId);
      return success({ alerts });
    }

    // GET /admin/costs/infrastructure-scaling - Get infrastructure scaling costs
    if (method === 'GET' && path.endsWith('/infrastructure-scaling')) {
      const scalingCosts = await awsCostMonitoringService.getInfrastructureScalingCosts(user.tenantId);
      return success({ scalingCosts });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
