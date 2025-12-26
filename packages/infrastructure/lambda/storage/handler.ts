import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { storageBillingService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // GET /storage/usage - Get storage usage
    if (method === 'GET' && path.endsWith('/usage')) {
      const usage = await storageBillingService.getStorageUsage(user.tenantId);
      return success({ usage });
    }

    // POST /storage/event - Record storage event
    if (method === 'POST' && path.endsWith('/event')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.eventType || !body.storageType || body.bytesDelta === undefined) {
        throw new ValidationError('eventType, storageType, and bytesDelta are required');
      }

      await storageBillingService.recordStorageEvent(
        user.tenantId,
        user.userId,
        body.eventType,
        body.storageType,
        body.bytesDelta,
        body.resourceId,
        body.resourcePath
      );

      return success({ recorded: true });
    }

    // POST /storage/sync-s3 - Sync S3 usage
    if (method === 'POST' && path.endsWith('/sync-s3')) {
      await storageBillingService.syncS3Usage(user.tenantId);
      return success({ synced: true });
    }

    // GET /storage/pricing - Get storage pricing for tier
    if (method === 'GET' && path.endsWith('/pricing')) {
      const tierId = event.queryStringParameters?.tierId;

      if (!tierId) {
        throw new ValidationError('tierId is required');
      }

      const pricing = await storageBillingService.getStoragePricing(tierId);
      return success({ pricing });
    }

    // GET /storage/events - Get storage events
    if (method === 'GET' && path.endsWith('/events')) {
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const events = await storageBillingService.getStorageEvents(user.tenantId, limit);
      return success({ events });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
