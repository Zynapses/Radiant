/**
 * AWS Snapshot Lambda Handler
 * 
 * Handles scheduled and manual AWS infrastructure snapshots.
 * 
 * @version 7.1.0
 * @since 2026-02-04
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { AWSSnapshotService } from '../shared/services/state-registry/aws-snapshot.service';
import {
  AWSSnapshotConfig,
  CreateAWSSnapshotRequest,
  RestoreAWSSnapshotRequest,
  ListAWSSnapshotsRequest,
  EnvironmentName,
} from '@radiant/shared';

const environment = (process.env.RADIANT_ENVIRONMENT || 'development') as EnvironmentName;
const region = process.env.AWS_REGION || 'us-east-1';
const stateRegistryBucket = process.env.STATE_REGISTRY_BUCKET || `radiant-${environment}-state-registry`;
const snsTopicArn = process.env.SNS_TOPIC_ARN;

function createSnapshotService(config?: Partial<AWSSnapshotConfig>): AWSSnapshotService {
  return new AWSSnapshotService({
    region,
    environment,
    tenantId: 'system',
    stateRegistryBucket,
    snsTopicArn,
    snapshotConfig: config,
  });
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  };
}

// Scheduled event handler (EventBridge)
export async function scheduledHandler(event: ScheduledEvent): Promise<void> {
  console.log('[AWSSnapshot] Scheduled snapshot triggered:', JSON.stringify(event));

  const service = createSnapshotService();
  const result = await service.createScheduledSnapshot();

  if (!result.success) {
    console.error('[AWSSnapshot] Scheduled snapshot failed:', result.error);
    throw new Error(`Scheduled snapshot failed: ${result.error}`);
  }

  console.log('[AWSSnapshot] Scheduled snapshot completed:', result.snapshotId);

  // Also cleanup expired snapshots
  const cleanup = await service.cleanupExpiredSnapshots();
  console.log('[AWSSnapshot] Cleanup completed:', cleanup);
}

// API Gateway handler
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('[AWSSnapshot] API request:', event.httpMethod, event.path);

  const service = createSnapshotService();

  try {
    // Route based on path and method
    const path = event.path;
    const method = event.httpMethod;

    // GET /snapshots - List snapshots
    if (method === 'GET' && path.match(/\/snapshots\/?$/)) {
      const params = event.queryStringParameters || {};
      const request: ListAWSSnapshotsRequest = {
        environment: (params.environment as EnvironmentName) || environment,
        status: params.status as any,
        type: params.type as any,
        createdAfter: params.createdAfter,
        createdBefore: params.createdBefore,
        limit: params.limit ? parseInt(params.limit) : undefined,
        offset: params.offset ? parseInt(params.offset) : undefined,
        sortBy: params.sortBy as any,
        sortOrder: params.sortOrder as any,
      };

      const result = await service.listSnapshots(request);
      return response(result.success ? 200 : 500, result);
    }

    // GET /snapshots/:id - Get snapshot details
    if (method === 'GET' && path.match(/\/snapshots\/[\w-]+$/)) {
      const snapshotId = path.split('/').pop()!;
      const snapshots = await service.listSnapshots({ environment });
      const snapshot = snapshots.snapshots.find(s => s.id === snapshotId);

      if (!snapshot) {
        return response(404, { success: false, error: 'Snapshot not found' });
      }

      return response(200, { success: true, snapshot });
    }

    // POST /snapshots - Create manual snapshot
    if (method === 'POST' && path.match(/\/snapshots\/?$/)) {
      const body = JSON.parse(event.body || '{}');
      const request: CreateAWSSnapshotRequest = {
        environment: body.environment || environment,
        description: body.description,
        includeRDS: body.includeRDS,
        includeS3: body.includeS3,
        includeSecrets: body.includeSecrets,
        includeDynamoDB: body.includeDynamoDB,
        retentionDays: body.retentionDays,
        tags: body.tags,
        createdBy: body.createdBy || 'api:manual',
      };

      const result = await service.createSnapshot(request);
      return response(result.success ? 201 : 500, result);
    }

    // POST /snapshots/:id/restore - Restore from snapshot
    if (method === 'POST' && path.match(/\/snapshots\/[\w-]+\/restore$/)) {
      const snapshotId = path.split('/')[path.split('/').length - 2];
      const body = JSON.parse(event.body || '{}');
      const request: RestoreAWSSnapshotRequest = {
        snapshotId,
        targetEnvironment: body.targetEnvironment || environment,
        restoreRDS: body.restoreRDS,
        restoreS3: body.restoreS3,
        restoreSecrets: body.restoreSecrets,
        restoreDynamoDB: body.restoreDynamoDB,
        createNewCluster: body.createNewCluster,
        newClusterSuffix: body.newClusterSuffix,
        validateBeforeRestore: body.validateBeforeRestore,
        restoredBy: body.restoredBy || 'api:restore',
      };

      const result = await service.restoreSnapshot(request);
      return response(result.success ? 200 : 500, result);
    }

    // POST /snapshots/:id/validate - Validate snapshot
    if (method === 'POST' && path.match(/\/snapshots\/[\w-]+\/validate$/)) {
      const snapshotId = path.split('/')[path.split('/').length - 2];
      const validation = await service.validateSnapshot(snapshotId);
      return response(200, { success: true, validation });
    }

    // DELETE /snapshots/:id - Delete snapshot
    if (method === 'DELETE' && path.match(/\/snapshots\/[\w-]+$/)) {
      const snapshotId = path.split('/').pop()!;
      const result = await service.deleteSnapshot(snapshotId);
      return response(result.success ? 200 : 500, result);
    }

    // GET /snapshots/config - Get snapshot configuration
    if (method === 'GET' && path.match(/\/snapshots\/config\/?$/)) {
      const config = service.getConfig();
      return response(200, { success: true, config });
    }

    // PUT /snapshots/config - Update snapshot configuration
    if (method === 'PUT' && path.match(/\/snapshots\/config\/?$/)) {
      const body = JSON.parse(event.body || '{}');
      await service.updateConfig(body);
      const config = service.getConfig();
      return response(200, { success: true, config });
    }

    // POST /snapshots/cleanup - Trigger manual cleanup
    if (method === 'POST' && path.match(/\/snapshots\/cleanup\/?$/)) {
      const result = await service.cleanupExpiredSnapshots();
      return response(200, { success: true, ...result });
    }

    return response(404, { success: false, error: 'Not found' });
  } catch (error) {
    console.error('[AWSSnapshot] Handler error:', error);
    return response(500, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
