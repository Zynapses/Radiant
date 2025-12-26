import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { migrationApprovalService } from '../shared/services';
import { extractAuthContext, requireAdmin } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    requireAdmin(user);

    const path = event.path;
    const method = event.httpMethod;

    // POST /migration-approval/request - Create approval request
    if (method === 'POST' && path.endsWith('/request')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.migrationName || !body.migrationVersion || !body.migrationSql || !body.environment) {
        throw new ValidationError('migrationName, migrationVersion, migrationSql, and environment are required');
      }

      const result = await migrationApprovalService.createRequest(
        user.tenantId,
        user.userId,
        body.migrationName,
        body.migrationVersion,
        body.migrationSql,
        body.environment,
        body.reason,
        body.rollbackSql
      );

      return success(result);
    }

    // GET /migration-approval/pending - Get pending requests
    if (method === 'GET' && path.endsWith('/pending')) {
      const requests = await migrationApprovalService.getPendingRequests(user.tenantId);
      return success({ requests });
    }

    // GET /migration-approval/:id - Get single request
    if (method === 'GET' && path.includes('/migration-approval/') && !path.endsWith('/pending') && !path.includes('/approvals')) {
      const requestId = path.split('/migration-approval/')[1];
      const request = await migrationApprovalService.getRequest(requestId);

      if (!request) {
        throw new ValidationError('Request not found');
      }

      return success(request);
    }

    // POST /migration-approval/:id/approve - Submit approval
    if (method === 'POST' && path.endsWith('/approve')) {
      const requestId = path.split('/migration-approval/')[1].split('/approve')[0];
      const body = JSON.parse(event.body || '{}');

      const result = await migrationApprovalService.submitApproval(
        requestId,
        user.userId,
        'approved',
        body.reason
      );

      return success(result);
    }

    // POST /migration-approval/:id/reject - Submit rejection
    if (method === 'POST' && path.endsWith('/reject')) {
      const requestId = path.split('/migration-approval/')[1].split('/reject')[0];
      const body = JSON.parse(event.body || '{}');

      const result = await migrationApprovalService.submitApproval(
        requestId,
        user.userId,
        'rejected',
        body.reason
      );

      return success(result);
    }

    // POST /migration-approval/:id/execute - Execute approved migration
    if (method === 'POST' && path.endsWith('/execute')) {
      const requestId = path.split('/migration-approval/')[1].split('/execute')[0];

      const result = await migrationApprovalService.executeRequest(requestId, user.userId);
      return success(result);
    }

    // POST /migration-approval/:id/cancel - Cancel request
    if (method === 'POST' && path.endsWith('/cancel')) {
      const requestId = path.split('/migration-approval/')[1].split('/cancel')[0];

      await migrationApprovalService.cancelRequest(requestId);
      return success({ cancelled: true });
    }

    // GET /migration-approval/:id/approvals - Get approvals for request
    if (method === 'GET' && path.endsWith('/approvals')) {
      const requestId = path.split('/migration-approval/')[1].split('/approvals')[0];

      const approvals = await migrationApprovalService.getApprovals(requestId);
      return success({ approvals });
    }

    // POST /migration-approval/policy - Set approval policy
    if (method === 'POST' && path.endsWith('/policy')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.environment) {
        throw new ValidationError('environment is required');
      }

      await migrationApprovalService.setPolicy(user.tenantId, body.environment, {
        approvalsRequired: body.approvalsRequired,
        selfApprovalAllowed: body.selfApprovalAllowed,
        autoApproveDevelopment: body.autoApproveDevelopment,
      });

      return success({ policySet: true });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
