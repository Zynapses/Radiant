/**
 * Usage Metering Lambda
 * Collects and stores usage events for billing calculations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { Logger } from '../shared/logger.js';
import { success, created, handleError } from '../shared/response.js';
import { extractAuthContext, AuthContext } from '../shared/auth.js';
import { ValidationError } from '../shared/errors.js';
import { executeStatement, toSqlParams } from '../shared/db/client.js';

const logger = new Logger({ handler: 'metering' });
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });

const USAGE_TABLE = process.env.USAGE_TABLE || 'radiant-usage-events';
const ROLLUP_TABLE = process.env.ROLLUP_TABLE || 'radiant-usage-rollups';

const recordUsageSchema = z.object({
  requestId: z.string(),
  providerId: z.string(),
  modelId: z.string(),
  modelName: z.string(),
  requestType: z.enum(['chat', 'embedding', 'image', 'audio', 'video']),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
  cached: z.boolean().default(false),
  phiDetected: z.boolean().default(false),
  phiSanitized: z.boolean().default(false),
  userId: z.string().optional(),
});

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const requestLogger = logger.child({ requestId: context.awsRequestId, path: event.path });

  try {
    const auth = extractAuthContext(event);
    const action = event.path.split('/').pop();

    switch (event.httpMethod) {
      case 'POST':
        if (action === 'record') return await handleRecordUsage(event, auth, requestLogger);
        if (action === 'batch') return await handleBatchRecord(event, auth, requestLogger);
        break;
      case 'GET':
        if (action === 'summary') return await handleGetSummary(event, auth, requestLogger);
        if (action === 'rollups') return await handleGetRollups(event, auth, requestLogger);
        break;
    }
    throw new ValidationError(`Unknown action: ${action}`);
  } catch (error) {
    return handleError(error, requestLogger);
  }
}

async function handleRecordUsage(event: APIGatewayProxyEvent, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  const body = event.body ? JSON.parse(event.body) : {};
  const parseResult = recordUsageSchema.safeParse(body);
  if (!parseResult.success) throw new ValidationError('Invalid usage data', parseResult.error.flatten().fieldErrors as Record<string, string[]>);

  const data = parseResult.data;

  const pricing = await getModelPricing(data.modelId, logger);
  const inputCost = (data.inputTokens / 1000000) * pricing.inputPricePerMillion;
  const outputCost = (data.outputTokens / 1000000) * pricing.outputPricePerMillion;
  const providerCost = inputCost + outputCost;

  const marginPercent = await getTenantMargin(auth.tenantId, logger);
  const billedCost = providerCost * (1 + marginPercent / 100);

  const usageEvent = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    tenantId: auth.tenantId,
    userId: data.userId || auth.userId,
    adminId: auth.isAdmin ? auth.userId : undefined,
    appId: auth.appId,
    environment: auth.environment,
    providerId: data.providerId,
    modelId: data.modelId,
    modelName: data.modelName,
    requestType: data.requestType,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    totalTokens: data.inputTokens + data.outputTokens,
    providerCost,
    billedCost,
    currency: 'USD',
    requestId: data.requestId,
    latencyMs: data.latencyMs,
    cached: data.cached,
    phiDetected: data.phiDetected,
    phiSanitized: data.phiSanitized,
  };

  await ddbClient.send(new PutCommand({
    TableName: USAGE_TABLE,
    Item: { pk: `TENANT#${auth.tenantId}`, sk: `EVENT#${usageEvent.timestamp}#${usageEvent.id}`, ...usageEvent, ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) },
  }));

  await updateDailyRollup(usageEvent, logger);

  logger.info('Usage recorded', { eventId: usageEvent.id, modelId: data.modelId, tokens: usageEvent.totalTokens, cost: billedCost });
  return created({ event: { id: usageEvent.id, billedCost, providerCost } });
}

async function handleBatchRecord(event: APIGatewayProxyEvent, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  const body = event.body ? JSON.parse(event.body) : {};
  if (!Array.isArray(body.events) || body.events.length === 0) throw new ValidationError('events array is required');
  if (body.events.length > 100) throw new ValidationError('Maximum 100 events per batch');

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const eventData of body.events) {
    try {
      const parseResult = recordUsageSchema.safeParse(eventData);
      if (!parseResult.success) { results.push({ id: eventData.requestId || 'unknown', success: false, error: 'Invalid data' }); continue; }

      const data = parseResult.data;
      const pricing = await getModelPricing(data.modelId, logger);
      const providerCost = ((data.inputTokens / 1000000) * pricing.inputPricePerMillion) + ((data.outputTokens / 1000000) * pricing.outputPricePerMillion);
      const marginPercent = await getTenantMargin(auth.tenantId, logger);
      const billedCost = providerCost * (1 + marginPercent / 100);

      const usageEvent = {
        id: uuidv4(), timestamp: new Date().toISOString(), tenantId: auth.tenantId, userId: data.userId || auth.userId,
        appId: auth.appId, environment: auth.environment, providerId: data.providerId, modelId: data.modelId, modelName: data.modelName,
        requestType: data.requestType, inputTokens: data.inputTokens, outputTokens: data.outputTokens, totalTokens: data.inputTokens + data.outputTokens,
        providerCost, billedCost, currency: 'USD', requestId: data.requestId, latencyMs: data.latencyMs, cached: data.cached, phiDetected: data.phiDetected, phiSanitized: data.phiSanitized,
      };

      await ddbClient.send(new PutCommand({ TableName: USAGE_TABLE, Item: { pk: `TENANT#${auth.tenantId}`, sk: `EVENT#${usageEvent.timestamp}#${usageEvent.id}`, ...usageEvent, ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) } }));
      await updateDailyRollup(usageEvent, logger);
      results.push({ id: usageEvent.id, success: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({ id: eventData.requestId || 'unknown', success: false, error: errorMessage });
    }
  }

  logger.info('Batch usage recorded', { total: body.events.length, successful: results.filter(r => r.success).length });
  return success({ results, summary: { total: results.length, successful: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length } });
}

async function handleGetSummary(event: APIGatewayProxyEvent, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  const startDate = event.queryStringParameters?.startDate || getDefaultStartDate();
  const endDate = event.queryStringParameters?.endDate || getTodayDate();

  const response = await ddbClient.send(new QueryCommand({
    TableName: ROLLUP_TABLE,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
    ExpressionAttributeValues: { ':pk': `TENANT#${auth.tenantId}`, ':start': `DATE#${startDate}`, ':end': `DATE#${endDate}#~` },
  }));

  const rollups = response.Items || [];
  const totals = rollups.reduce((acc, r) => ({
    requests: acc.requests + ((r.requestCount as number) || 0),
    inputTokens: acc.inputTokens + ((r.inputTokens as number) || 0),
    outputTokens: acc.outputTokens + ((r.outputTokens as number) || 0),
    providerCost: acc.providerCost + ((r.providerCost as number) || 0),
    billedCost: acc.billedCost + ((r.billedCost as number) || 0),
  }), { requests: 0, inputTokens: 0, outputTokens: 0, providerCost: 0, billedCost: 0 });

  return success({ period: { startDate, endDate }, totals });
}

async function handleGetRollups(event: APIGatewayProxyEvent, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  const startDate = event.queryStringParameters?.startDate || getDefaultStartDate();
  const endDate = event.queryStringParameters?.endDate || getTodayDate();

  const response = await ddbClient.send(new QueryCommand({
    TableName: ROLLUP_TABLE,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
    ExpressionAttributeValues: { ':pk': `TENANT#${auth.tenantId}`, ':start': `DATE#${startDate}`, ':end': `DATE#${endDate}#~` },
  }));

  const rollups = (response.Items || []).map(item => ({
    date: item.date, modelId: item.modelId, providerId: item.providerId, requestCount: item.requestCount,
    inputTokens: item.inputTokens, outputTokens: item.outputTokens, totalTokens: item.totalTokens,
    providerCost: item.providerCost, billedCost: item.billedCost, avgLatencyMs: item.avgLatencyMs,
  }));

  return success({ rollups, period: { startDate, endDate } });
}

async function updateDailyRollup(event: Record<string, unknown>, logger: Logger): Promise<void> {
  const date = (event.timestamp as string).split('T')[0];
  try {
    await ddbClient.send(new UpdateCommand({
      TableName: ROLLUP_TABLE,
      Key: { pk: `TENANT#${event.tenantId}`, sk: `DATE#${date}#MODEL#${event.modelId}` },
      UpdateExpression: `SET #date = :date, modelId = :modelId, providerId = :providerId,
        requestCount = if_not_exists(requestCount, :zero) + :one,
        inputTokens = if_not_exists(inputTokens, :zero) + :inputTokens,
        outputTokens = if_not_exists(outputTokens, :zero) + :outputTokens,
        totalTokens = if_not_exists(totalTokens, :zero) + :totalTokens,
        providerCost = if_not_exists(providerCost, :zero) + :providerCost,
        billedCost = if_not_exists(billedCost, :zero) + :billedCost,
        cachedRequests = if_not_exists(cachedRequests, :zero) + :cached,
        phiRequests = if_not_exists(phiRequests, :zero) + :phi,
        updatedAt = :updatedAt`,
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: {
        ':date': date, ':modelId': event.modelId, ':providerId': event.providerId,
        ':zero': 0, ':one': 1, ':inputTokens': event.inputTokens, ':outputTokens': event.outputTokens,
        ':totalTokens': event.totalTokens, ':providerCost': event.providerCost, ':billedCost': event.billedCost,
        ':cached': event.cached ? 1 : 0, ':phi': event.phiDetected ? 1 : 0, ':updatedAt': new Date().toISOString(),
      },
    }));
  } catch (error) {
    logger.error('Failed to update rollup', error as Error, { tenantId: event.tenantId as string, date, modelId: event.modelId as string });
  }
}

async function getModelPricing(modelId: string, logger: Logger): Promise<{ inputPricePerMillion: number; outputPricePerMillion: number }> {
  const result = await executeStatement<{ input_price_per_million: string; output_price_per_million: string }>(
    `SELECT input_price_per_million, output_price_per_million FROM ai_models WHERE id = :modelId`,
    toSqlParams({ modelId })
  );
  if (result.rowCount === 0) return { inputPricePerMillion: 1.0, outputPricePerMillion: 2.0 };
  return { inputPricePerMillion: parseFloat(result.rows[0].input_price_per_million) || 1.0, outputPricePerMillion: parseFloat(result.rows[0].output_price_per_million) || 2.0 };
}

async function getTenantMargin(tenantId: string, logger: Logger): Promise<number> {
  const result = await executeStatement<{ margin_percent: string }>(
    `SELECT margin_percent FROM billing_settings WHERE tenant_id = :tenantId`,
    toSqlParams({ tenantId })
  );
  return result.rowCount > 0 ? parseFloat(result.rows[0].margin_percent) : 20;
}

function getDefaultStartDate(): string { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; }
function getTodayDate(): string { return new Date().toISOString().split('T')[0]; }
