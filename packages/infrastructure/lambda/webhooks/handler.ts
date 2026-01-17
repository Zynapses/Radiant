/**
 * Webhooks Management Handler
 * 
 * Manages webhook subscriptions for tenants
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, QueryCommand, DeleteItemCommand, GetItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';
import { randomUUID, createHmac } from 'crypto';
import { logger } from '../shared/logger';
import { requireEnv } from '../shared/config/env';

const dynamodb = new DynamoDBClient({});
const WEBHOOKS_TABLE = requireEnv('WEBHOOKS_TABLE');

interface Webhook {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  event_types: string[];
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'];

  if (!tenantId) {
    return response(401, { error: 'Unauthorized' });
  }

  try {
    // GET /webhooks - List all webhooks
    if (method === 'GET' && path === '/webhooks') {
      return await listWebhooks(tenantId);
    }

    // POST /webhooks - Create webhook
    if (method === 'POST' && path === '/webhooks') {
      const body = JSON.parse(event.body || '{}');
      return await createWebhook(tenantId, body);
    }

    // GET /webhooks/:id - Get webhook
    if (method === 'GET' && path.match(/^\/webhooks\/[\w-]+$/)) {
      const webhookId = path.split('/')[2];
      return await getWebhook(tenantId, webhookId);
    }

    // PUT /webhooks/:id - Update webhook
    if (method === 'PUT' && path.match(/^\/webhooks\/[\w-]+$/)) {
      const webhookId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return await updateWebhook(tenantId, webhookId, body);
    }

    // DELETE /webhooks/:id - Delete webhook
    if (method === 'DELETE' && path.match(/^\/webhooks\/[\w-]+$/)) {
      const webhookId = path.split('/')[2];
      return await deleteWebhook(tenantId, webhookId);
    }

    // POST /webhooks/:id/test - Test webhook
    if (method === 'POST' && path.match(/^\/webhooks\/[\w-]+\/test$/)) {
      const webhookId = path.split('/')[2];
      return await testWebhook(tenantId, webhookId);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error('Webhook error', error instanceof Error ? error : new Error(String(error)));
    return response(500, { error: 'Internal server error' });
  }
}

async function listWebhooks(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: WEBHOOKS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: `TENANT#${tenantId}` },
    },
  }));

  const webhooks = (result.Items || []).map(item => ({
    id: item.id?.S,
    url: item.url?.S,
    event_types: item.event_types?.SS || [],
    description: item.description?.S,
    is_active: item.is_active?.BOOL ?? true,
    created_at: item.created_at?.S,
    updated_at: item.updated_at?.S,
  }));

  return response(200, { data: webhooks });
}

async function createWebhook(
  tenantId: string,
  body: { url: string; event_types: string[]; description?: string }
): Promise<APIGatewayProxyResult> {
  const { url, event_types, description } = body;

  if (!url || !event_types?.length) {
    return response(400, { error: 'url and event_types are required' });
  }

  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    return response(400, { error: 'Invalid URL format' });
  }

  // Validate event types
  const validEventTypes = [
    'billing.low_balance',
    'billing.payment_received',
    'billing.subscription_changed',
    'usage.quota_reached',
    'usage.rate_limited',
    'usage.threshold_reached',
    'models.added',
    'models.deprecated',
    'models.updated',
    'admin.config_changed',
    'admin.user_added',
    'admin.api_key_created',
  ];

  const invalidTypes = event_types.filter(t => !validEventTypes.includes(t));
  if (invalidTypes.length > 0) {
    return response(400, { error: `Invalid event types: ${invalidTypes.join(', ')}` });
  }

  const webhookId = randomUUID();
  const secret = randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();

  await dynamodb.send(new PutItemCommand({
    TableName: WEBHOOKS_TABLE,
    Item: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `WEBHOOK#${webhookId}` },
      id: { S: webhookId },
      tenant_id: { S: tenantId },
      url: { S: url },
      secret: { S: secret },
      event_types: { SS: event_types },
      description: description ? { S: description } : { NULL: true },
      is_active: { BOOL: true },
      created_at: { S: now },
      updated_at: { S: now },
    },
  }));

  // Also create entries for each event type (for efficient querying)
  for (const eventType of event_types) {
    await dynamodb.send(new PutItemCommand({
      TableName: WEBHOOKS_TABLE,
      Item: {
        pk: { S: `EVENT#${eventType}` },
        sk: { S: `TENANT#${tenantId}#WEBHOOK#${webhookId}` },
        event_type: { S: eventType },
        tenant_id: { S: tenantId },
        webhook_id: { S: webhookId },
        url: { S: url },
        secret: { S: secret },
      },
    }));
  }

  return response(201, {
    data: {
      id: webhookId,
      url,
      secret, // Only returned on creation
      event_types,
      description,
      is_active: true,
      created_at: now,
    },
  });
}

async function getWebhook(tenantId: string, webhookId: string): Promise<APIGatewayProxyResult> {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: WEBHOOKS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `WEBHOOK#${webhookId}` },
    },
  }));

  if (!result.Item) {
    return response(404, { error: 'Webhook not found' });
  }

  return response(200, {
    data: {
      id: result.Item.id?.S,
      url: result.Item.url?.S,
      event_types: result.Item.event_types?.SS || [],
      description: result.Item.description?.S,
      is_active: result.Item.is_active?.BOOL ?? true,
      created_at: result.Item.created_at?.S,
      updated_at: result.Item.updated_at?.S,
    },
  });
}

async function updateWebhook(
  tenantId: string,
  webhookId: string,
  body: { url?: string; event_types?: string[]; description?: string; is_active?: boolean }
): Promise<APIGatewayProxyResult> {
  // Get existing webhook
  const existing = await dynamodb.send(new GetItemCommand({
    TableName: WEBHOOKS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `WEBHOOK#${webhookId}` },
    },
  }));

  if (!existing.Item) {
    return response(404, { error: 'Webhook not found' });
  }

  const now = new Date().toISOString();
  const updates: Record<string, AttributeValue> = {
    updated_at: { S: now },
  };

  if (body.url !== undefined) updates.url = { S: body.url };
  if (body.event_types !== undefined) updates.event_types = { SS: body.event_types };
  if (body.description !== undefined) updates.description = { S: body.description };
  if (body.is_active !== undefined) updates.is_active = { BOOL: body.is_active };

  await dynamodb.send(new PutItemCommand({
    TableName: WEBHOOKS_TABLE,
    Item: {
      ...existing.Item,
      ...updates,
    } as Record<string, AttributeValue>,
  }));

  return response(200, {
    data: {
      id: webhookId,
      url: body.url ?? existing.Item.url?.S,
      event_types: body.event_types ?? existing.Item.event_types?.SS,
      description: body.description ?? existing.Item.description?.S,
      is_active: body.is_active ?? existing.Item.is_active?.BOOL,
      updated_at: now,
    },
  });
}

async function deleteWebhook(tenantId: string, webhookId: string): Promise<APIGatewayProxyResult> {
  // Get webhook to find event types
  const existing = await dynamodb.send(new GetItemCommand({
    TableName: WEBHOOKS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `WEBHOOK#${webhookId}` },
    },
  }));

  if (!existing.Item) {
    return response(404, { error: 'Webhook not found' });
  }

  // Delete main webhook entry
  await dynamodb.send(new DeleteItemCommand({
    TableName: WEBHOOKS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `WEBHOOK#${webhookId}` },
    },
  }));

  // Delete event type entries
  const eventTypes = existing.Item.event_types?.SS || [];
  for (const eventType of eventTypes) {
    await dynamodb.send(new DeleteItemCommand({
      TableName: WEBHOOKS_TABLE,
      Key: {
        pk: { S: `EVENT#${eventType}` },
        sk: { S: `TENANT#${tenantId}#WEBHOOK#${webhookId}` },
      },
    }));
  }

  return response(204, null);
}

async function testWebhook(tenantId: string, webhookId: string): Promise<APIGatewayProxyResult> {
  const existing = await dynamodb.send(new GetItemCommand({
    TableName: WEBHOOKS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `WEBHOOK#${webhookId}` },
    },
  }));

  if (!existing.Item) {
    return response(404, { error: 'Webhook not found' });
  }

  const url = existing.Item.url?.S!;
  const secret = existing.Item.secret?.S!;
  
  const payload = {
    id: randomUUID(),
    type: 'test.ping',
    created_at: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery',
    },
  };

  const signature = createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Radiant-Signature': signature,
        'X-Radiant-Event': 'test.ping',
        'X-Radiant-Delivery': payload.id,
      },
      body: JSON.stringify(payload),
    });

    return response(200, {
      success: res.ok,
      status_code: res.status,
      message: res.ok ? 'Webhook delivered successfully' : 'Webhook delivery failed',
    });
  } catch (error) {
    return response(200, {
      success: false,
      error: 'Failed to deliver webhook',
    });
  }
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: body ? JSON.stringify(body) : '',
  };
}
