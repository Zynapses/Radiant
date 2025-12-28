/**
 * API Key Management Service
 * 
 * Create, validate, and manage API keys for tenant authentication
 */

import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand, DeleteItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const dynamodb = new DynamoDBClient({});
const API_KEYS_TABLE = process.env.API_KEYS_TABLE || 'radiant-api-keys';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-32bytes!!';

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  hashedKey: string;
  scopes: string[];
  rateLimit?: number;
  expiresAt?: string;
  lastUsedAt?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  metadata?: Record<string, string>;
}

export interface ApiKeyCreateResult {
  id: string;
  key: string; // Full key - only returned once
  prefix: string;
  name: string;
  scopes: string[];
  createdAt: string;
}

/**
 * Generate a new API key
 */
export async function createApiKey(options: {
  tenantId: string;
  name: string;
  scopes?: string[];
  rateLimit?: number;
  expiresAt?: string;
  createdBy: string;
  metadata?: Record<string, string>;
}): Promise<ApiKeyCreateResult> {
  const {
    tenantId,
    name,
    scopes = ['chat', 'models'],
    rateLimit,
    expiresAt,
    createdBy,
    metadata,
  } = options;

  // Generate key: rad_{tenantPrefix}_{random}
  const tenantPrefix = tenantId.substring(0, 8);
  const randomPart = randomBytes(24).toString('base64url');
  const key = `rad_${tenantPrefix}_${randomPart}`;
  const prefix = key.substring(0, 12);
  const id = `key_${randomBytes(12).toString('hex')}`;

  // Hash the key for storage
  const hashedKey = hashApiKey(key);

  const apiKey: ApiKey = {
    id,
    tenantId,
    name,
    prefix,
    hashedKey,
    scopes,
    rateLimit,
    expiresAt,
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy,
    metadata,
  };

  // Store in database
  await dynamodb.send(new PutItemCommand({
    TableName: API_KEYS_TABLE,
    Item: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `KEY#${id}` },
      id: { S: id },
      tenant_id: { S: tenantId },
      name: { S: name },
      prefix: { S: prefix },
      hashed_key: { S: hashedKey },
      scopes: { SS: scopes },
      rate_limit: rateLimit ? { N: String(rateLimit) } : { NULL: true },
      expires_at: expiresAt ? { S: expiresAt } : { NULL: true },
      is_active: { BOOL: true },
      created_at: { S: apiKey.createdAt },
      created_by: { S: createdBy },
      metadata: metadata ? { S: JSON.stringify(metadata) } : { NULL: true },
    },
  }));

  // Also store by hashed key for lookups
  await dynamodb.send(new PutItemCommand({
    TableName: API_KEYS_TABLE,
    Item: {
      pk: { S: `HASH#${hashedKey}` },
      sk: { S: `KEY#${id}` },
      tenant_id: { S: tenantId },
      key_id: { S: id },
    },
  }));

  return {
    id,
    key, // Only returned once!
    prefix,
    name,
    scopes,
    createdAt: apiKey.createdAt,
  };
}

/**
 * Validate an API key and return its metadata
 */
export async function validateApiKey(key: string): Promise<ApiKey | null> {
  if (!key.startsWith('rad_')) {
    return null;
  }

  const hashedKey = hashApiKey(key);

  // Look up by hashed key
  const result = await dynamodb.send(new QueryCommand({
    TableName: API_KEYS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: `HASH#${hashedKey}` },
    },
    Limit: 1,
  }));

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const item = result.Items[0];
  const tenantId = item.tenant_id?.S;
  const keyId = item.key_id?.S;

  if (!tenantId || !keyId) {
    return null;
  }

  // Get full key details
  const keyResult = await dynamodb.send(new GetItemCommand({
    TableName: API_KEYS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `KEY#${keyId}` },
    },
  }));

  if (!keyResult.Item) {
    return null;
  }

  const apiKey = itemToApiKey(keyResult.Item);

  // Check if active
  if (!apiKey.isActive) {
    return null;
  }

  // Check expiration
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return null;
  }

  // Update last used
  await updateLastUsed(tenantId, keyId);

  return apiKey;
}

/**
 * List API keys for a tenant
 */
export async function listApiKeys(tenantId: string): Promise<ApiKey[]> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: API_KEYS_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': { S: `TENANT#${tenantId}` },
      ':sk': { S: 'KEY#' },
    },
  }));

  return (result.Items || []).map(itemToApiKey);
}

/**
 * Get a specific API key
 */
export async function getApiKey(tenantId: string, keyId: string): Promise<ApiKey | null> {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: API_KEYS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `KEY#${keyId}` },
    },
  }));

  if (!result.Item) {
    return null;
  }

  return itemToApiKey(result.Item);
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(tenantId: string, keyId: string): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: API_KEYS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `KEY#${keyId}` },
    },
    UpdateExpression: 'SET is_active = :inactive, revoked_at = :now',
    ExpressionAttributeValues: {
      ':inactive': { BOOL: false },
      ':now': { S: new Date().toISOString() },
    },
  }));
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(tenantId: string, keyId: string): Promise<void> {
  // Get the key first to get the hash
  const key = await getApiKey(tenantId, keyId);
  if (!key) return;

  // Delete the main record
  await dynamodb.send(new DeleteItemCommand({
    TableName: API_KEYS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `KEY#${keyId}` },
    },
  }));

  // Delete the hash lookup record
  await dynamodb.send(new DeleteItemCommand({
    TableName: API_KEYS_TABLE,
    Key: {
      pk: { S: `HASH#${key.hashedKey}` },
      sk: { S: `KEY#${keyId}` },
    },
  }));
}

/**
 * Update API key scopes
 */
export async function updateApiKeyScopes(
  tenantId: string,
  keyId: string,
  scopes: string[]
): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: API_KEYS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `KEY#${keyId}` },
    },
    UpdateExpression: 'SET scopes = :scopes, updated_at = :now',
    ExpressionAttributeValues: {
      ':scopes': { SS: scopes },
      ':now': { S: new Date().toISOString() },
    },
  }));
}

/**
 * Rotate an API key (create new, revoke old)
 */
export async function rotateApiKey(
  tenantId: string,
  keyId: string,
  createdBy: string
): Promise<ApiKeyCreateResult> {
  const oldKey = await getApiKey(tenantId, keyId);
  if (!oldKey) {
    throw new Error('API key not found');
  }

  // Create new key with same settings
  const newKey = await createApiKey({
    tenantId,
    name: `${oldKey.name} (rotated)`,
    scopes: oldKey.scopes,
    rateLimit: oldKey.rateLimit,
    createdBy,
    metadata: oldKey.metadata,
  });

  // Revoke old key
  await revokeApiKey(tenantId, keyId);

  return newKey;
}

// ============================================================================
// Helper Functions
// ============================================================================

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function updateLastUsed(tenantId: string, keyId: string): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: API_KEYS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: `KEY#${keyId}` },
    },
    UpdateExpression: 'SET last_used_at = :now',
    ExpressionAttributeValues: {
      ':now': { S: new Date().toISOString() },
    },
  }));
}

function itemToApiKey(item: Record<string, AttributeValue>): ApiKey {
  return {
    id: item.id?.S || '',
    tenantId: item.tenant_id?.S || '',
    name: item.name?.S || '',
    prefix: item.prefix?.S || '',
    hashedKey: item.hashed_key?.S || '',
    scopes: item.scopes?.SS || [],
    rateLimit: item.rate_limit?.N ? parseInt(item.rate_limit.N, 10) : undefined,
    expiresAt: item.expires_at?.S,
    lastUsedAt: item.last_used_at?.S,
    isActive: item.is_active?.BOOL ?? false,
    createdAt: item.created_at?.S || '',
    createdBy: item.created_by?.S || '',
    metadata: item.metadata?.S ? JSON.parse(item.metadata.S) : undefined,
  };
}

// ============================================================================
// API Key Scopes
// ============================================================================

export const ApiKeyScopes = {
  // Chat
  CHAT: 'chat',
  CHAT_READ: 'chat:read',
  CHAT_WRITE: 'chat:write',

  // Models
  MODELS: 'models',
  MODELS_READ: 'models:read',

  // Billing
  BILLING: 'billing',
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',

  // Webhooks
  WEBHOOKS: 'webhooks',
  WEBHOOKS_READ: 'webhooks:read',
  WEBHOOKS_WRITE: 'webhooks:write',

  // Batch
  BATCH: 'batch',
  BATCH_READ: 'batch:read',
  BATCH_WRITE: 'batch:write',

  // Admin
  ADMIN: 'admin',
  ADMIN_READ: 'admin:read',
  ADMIN_WRITE: 'admin:write',
};
