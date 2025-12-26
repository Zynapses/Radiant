/**
 * RADIANT v4.18.0 - AWS CloudWatch Logs Handler
 * 
 * Provides endpoints for viewing and clearing CloudWatch logs
 * from the admin dashboard.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  FilterLogEventsCommand,
  DeleteLogGroupCommand,
  DeleteLogStreamCommand,
  CreateExportTaskCommand,
  DescribeExportTasksCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { createSuccessResponse, createErrorResponse } from '../shared/utils/error-response';
import { logger } from '../shared/logging/enhanced-logger';
import { extractAuthContext, requireAdmin } from '../shared/auth';
import { corsHeaders } from '../shared/middleware/api-response';

const cloudwatch = new CloudWatchLogsClient({});

const LOG_GROUP_PREFIX = process.env.LOG_GROUP_PREFIX || '/aws/lambda/radiant';
const EXPORT_BUCKET = process.env.LOG_EXPORT_BUCKET || 'radiant-log-exports';

export interface LogGroup {
  name: string;
  arn?: string;
  storedBytes?: number;
  retentionDays?: number;
  createdAt?: number;
}

export interface LogStream {
  name: string;
  firstEventTimestamp?: number;
  lastEventTimestamp?: number;
  lastIngestionTime?: number;
  storedBytes?: number;
}

export interface LogEvent {
  timestamp: number;
  message: string;
  ingestionTime?: number;
  logStreamName?: string;
}

export interface LogFilter {
  logGroupName: string;
  startTime?: number;
  endTime?: number;
  filterPattern?: string;
  limit?: number;
  nextToken?: string;
}

/**
 * GET /api/admin/logs/groups - List log groups
 */
export async function listLogGroups(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const prefix = event.queryStringParameters?.prefix || LOG_GROUP_PREFIX;
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const nextToken = event.queryStringParameters?.nextToken;

    const result = await cloudwatch.send(new DescribeLogGroupsCommand({
      logGroupNamePrefix: prefix,
      limit: Math.min(limit, 50),
      nextToken,
    }));

    const logGroups: LogGroup[] = (result.logGroups || []).map((lg: { logGroupName?: string; arn?: string; storedBytes?: number; retentionInDays?: number; creationTime?: number }) => ({
      name: lg.logGroupName || '',
      arn: lg.arn,
      storedBytes: lg.storedBytes,
      retentionDays: lg.retentionInDays,
      createdAt: lg.creationTime,
    }));

    return createSuccessResponse({
      logGroups,
      nextToken: result.nextToken,
      total: logGroups.length,
    });
  } catch (error) {
    logger.error('Failed to list log groups', error instanceof Error ? error : undefined);
    return createErrorResponse(error);
  }
}

/**
 * GET /api/admin/logs/streams - List log streams for a group
 */
export async function listLogStreams(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const logGroupName = event.queryStringParameters?.logGroupName;
    if (!logGroupName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'logGroupName is required' }),
      };
    }

    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const nextToken = event.queryStringParameters?.nextToken;
    const orderBy = event.queryStringParameters?.orderBy === 'LogStreamName' 
      ? 'LogStreamName' as const 
      : 'LastEventTime' as const;

    const result = await cloudwatch.send(new DescribeLogStreamsCommand({
      logGroupName,
      limit: Math.min(limit, 50),
      nextToken,
      orderBy,
      descending: true,
    }));

    const logStreams: LogStream[] = (result.logStreams || []).map((ls: { logStreamName?: string; firstEventTimestamp?: number; lastEventTimestamp?: number; lastIngestionTime?: number; storedBytes?: number }) => ({
      name: ls.logStreamName || '',
      firstEventTimestamp: ls.firstEventTimestamp,
      lastEventTimestamp: ls.lastEventTimestamp,
      lastIngestionTime: ls.lastIngestionTime,
      storedBytes: ls.storedBytes,
    }));

    return createSuccessResponse({
      logStreams,
      nextToken: result.nextToken,
      total: logStreams.length,
    });
  } catch (error) {
    logger.error('Failed to list log streams', error instanceof Error ? error : undefined);
    return createErrorResponse(error);
  }
}

/**
 * GET /api/admin/logs/events - Get log events from a stream
 */
export async function getLogEvents(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const logGroupName = event.queryStringParameters?.logGroupName;
    const logStreamName = event.queryStringParameters?.logStreamName;

    if (!logGroupName || !logStreamName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'logGroupName and logStreamName are required' }),
      };
    }

    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const startTime = event.queryStringParameters?.startTime 
      ? parseInt(event.queryStringParameters.startTime, 10) 
      : undefined;
    const endTime = event.queryStringParameters?.endTime 
      ? parseInt(event.queryStringParameters.endTime, 10) 
      : undefined;
    const nextToken = event.queryStringParameters?.nextToken;

    const result = await cloudwatch.send(new GetLogEventsCommand({
      logGroupName,
      logStreamName,
      limit: Math.min(limit, 1000),
      startTime,
      endTime,
      nextToken,
      startFromHead: false, // Most recent first
    }));

    const events: LogEvent[] = (result.events || []).map((e: { timestamp?: number; message?: string; ingestionTime?: number }) => ({
      timestamp: e.timestamp || 0,
      message: e.message || '',
      ingestionTime: e.ingestionTime,
    }));

    return createSuccessResponse({
      events,
      nextForwardToken: result.nextForwardToken,
      nextBackwardToken: result.nextBackwardToken,
      total: events.length,
    });
  } catch (error) {
    logger.error('Failed to get log events', error instanceof Error ? error : undefined);
    return createErrorResponse(error);
  }
}

/**
 * POST /api/admin/logs/filter - Filter log events across streams
 */
export async function filterLogEvents(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const body = JSON.parse(event.body || '{}') as LogFilter;

    if (!body.logGroupName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'logGroupName is required' }),
      };
    }

    const limit = Math.min(body.limit || 100, 1000);
    
    // Default to last hour if no time range specified
    const now = Date.now();
    const startTime = body.startTime || now - (60 * 60 * 1000);
    const endTime = body.endTime || now;

    const result = await cloudwatch.send(new FilterLogEventsCommand({
      logGroupName: body.logGroupName,
      startTime,
      endTime,
      filterPattern: body.filterPattern,
      limit,
      nextToken: body.nextToken,
    }));

    const events: LogEvent[] = (result.events || []).map((e: { timestamp?: number; message?: string; ingestionTime?: number; logStreamName?: string }) => ({
      timestamp: e.timestamp || 0,
      message: e.message || '',
      ingestionTime: e.ingestionTime,
      logStreamName: e.logStreamName,
    }));

    return createSuccessResponse({
      events,
      nextToken: result.nextToken,
      searchedLogStreams: result.searchedLogStreams?.length || 0,
      total: events.length,
    });
  } catch (error) {
    logger.error('Failed to filter log events', error instanceof Error ? error : undefined);
    return createErrorResponse(error);
  }
}

/**
 * DELETE /api/admin/logs/groups/:name - Delete a log group
 */
export async function deleteLogGroup(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const logGroupName = event.pathParameters?.name;
    if (!logGroupName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Log group name is required' }),
      };
    }

    // Decode the log group name (it may contain slashes)
    const decodedName = decodeURIComponent(logGroupName);

    logger.info('Deleting log group', { logGroupName: decodedName, userId: auth.userId });

    await cloudwatch.send(new DeleteLogGroupCommand({
      logGroupName: decodedName,
    }));

    return createSuccessResponse({
      success: true,
      message: `Log group ${decodedName} deleted`,
    });
  } catch (error) {
    logger.error('Failed to delete log group', error instanceof Error ? error : undefined);
    return createErrorResponse(error);
  }
}

/**
 * DELETE /api/admin/logs/streams - Delete a log stream
 */
export async function deleteLogStream(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const logGroupName = event.queryStringParameters?.logGroupName;
    const logStreamName = event.queryStringParameters?.logStreamName;

    if (!logGroupName || !logStreamName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'logGroupName and logStreamName are required' }),
      };
    }

    logger.info('Deleting log stream', { logGroupName, logStreamName, userId: auth.userId });

    await cloudwatch.send(new DeleteLogStreamCommand({
      logGroupName,
      logStreamName,
    }));

    return createSuccessResponse({
      success: true,
      message: `Log stream ${logStreamName} deleted from ${logGroupName}`,
    });
  } catch (error) {
    logger.error('Failed to delete log stream', error instanceof Error ? error : undefined);
    return createErrorResponse(error);
  }
}

/**
 * POST /api/admin/logs/export - Export logs to S3
 */
export async function exportLogs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const body = JSON.parse(event.body || '{}');
    const { logGroupName, startTime, endTime, destinationPrefix } = body;

    if (!logGroupName || !startTime || !endTime) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'logGroupName, startTime, and endTime are required' }),
      };
    }

    const taskName = `export-${Date.now()}`;
    const prefix = destinationPrefix || `logs/${logGroupName.replace(/\//g, '-')}/${taskName}`;

    logger.info('Starting log export', { logGroupName, taskName, userId: auth.userId });

    const result = await cloudwatch.send(new CreateExportTaskCommand({
      logGroupName,
      from: startTime,
      to: endTime,
      destination: EXPORT_BUCKET,
      destinationPrefix: prefix,
      taskName,
    }));

    return createSuccessResponse({
      taskId: result.taskId,
      taskName,
      destination: `s3://${EXPORT_BUCKET}/${prefix}`,
    });
  } catch (error) {
    logger.error('Failed to export logs', error instanceof Error ? error : undefined);
    return createErrorResponse(error);
  }
}

/**
 * GET /api/admin/logs/export/:taskId - Get export task status
 */
export async function getExportStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const taskId = event.pathParameters?.taskId;
    if (!taskId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'taskId is required' }),
      };
    }

    const result = await cloudwatch.send(new DescribeExportTasksCommand({
      taskId,
    }));

    const task = result.exportTasks?.[0];
    if (!task) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Export task not found' }),
      };
    }

    return createSuccessResponse({
      taskId: task.taskId,
      taskName: task.taskName,
      status: task.status?.code,
      statusMessage: task.status?.message,
      logGroupName: task.logGroupName,
      from: task.from,
      to: task.to,
      destination: task.destination,
      destinationPrefix: task.destinationPrefix,
    });
  } catch (error) {
    logger.error('Failed to get export status', error instanceof Error ? error : undefined);
    return createErrorResponse(error);
  }
}

/**
 * Lambda handler router
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Log groups
  if (path === '/api/admin/logs/groups' && method === 'GET') {
    return listLogGroups(event);
  }

  // Log streams
  if (path === '/api/admin/logs/streams' && method === 'GET') {
    return listLogStreams(event);
  }

  // Log events
  if (path === '/api/admin/logs/events' && method === 'GET') {
    return getLogEvents(event);
  }

  // Filter logs
  if (path === '/api/admin/logs/filter' && method === 'POST') {
    return filterLogEvents(event);
  }

  // Delete log group
  if (path.startsWith('/api/admin/logs/groups/') && method === 'DELETE') {
    return deleteLogGroup(event);
  }

  // Delete log stream
  if (path === '/api/admin/logs/streams' && method === 'DELETE') {
    return deleteLogStream(event);
  }

  // Export logs
  if (path === '/api/admin/logs/export' && method === 'POST') {
    return exportLogs(event);
  }

  // Export status
  if (path.startsWith('/api/admin/logs/export/') && method === 'GET') {
    return getExportStatus(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
