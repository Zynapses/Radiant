/**
 * Feature Flags Service
 * 
 * Provides runtime feature flag management for gradual rollouts,
 * A/B testing, and environment-specific configurations.
 */

import { DynamoDBClient, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({});
const FLAGS_TABLE = process.env.FLAGS_TABLE || 'radiant-feature-flags';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  targetTenants?: string[];
  targetTiers?: string[];
  variants?: FlagVariant[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FlagVariant {
  key: string;
  weight: number;
  value: unknown;
}

export interface FlagContext {
  tenantId?: string;
  userId?: string;
  tier?: string;
  environment?: string;
  attributes?: Record<string, string | number | boolean>;
}

// In-memory cache for flags
const flagCache: Map<string, { flag: FeatureFlag; expiresAt: number }> = new Map();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Check if a feature flag is enabled
 */
export async function isEnabled(key: string, context: FlagContext = {}): Promise<boolean> {
  const flag = await getFlag(key);
  
  if (!flag) return false;
  if (!flag.enabled) return false;

  // Check tenant targeting
  if (flag.targetTenants && flag.targetTenants.length > 0) {
    if (!context.tenantId || !flag.targetTenants.includes(context.tenantId)) {
      return false;
    }
  }

  // Check tier targeting
  if (flag.targetTiers && flag.targetTiers.length > 0) {
    if (!context.tier || !flag.targetTiers.includes(context.tier)) {
      return false;
    }
  }

  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
    const hash = hashContext(key, context);
    const bucket = hash % 100;
    if (bucket >= flag.rolloutPercentage) {
      return false;
    }
  }

  return true;
}

/**
 * Get a variant for A/B testing
 */
export async function getVariant(key: string, context: FlagContext = {}): Promise<unknown> {
  const flag = await getFlag(key);
  
  if (!flag || !flag.enabled || !flag.variants || flag.variants.length === 0) {
    return null;
  }

  // Check if flag is enabled for this context
  const enabled = await isEnabled(key, context);
  if (!enabled) return null;

  // Calculate total weight
  const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0);
  
  // Get deterministic bucket based on context
  const hash = hashContext(key, context);
  let bucket = hash % totalWeight;

  // Find the variant for this bucket
  for (const variant of flag.variants) {
    if (bucket < variant.weight) {
      return variant.value;
    }
    bucket -= variant.weight;
  }

  return flag.variants[0].value;
}

/**
 * Get flag value with default
 */
export async function getValue<T>(key: string, defaultValue: T, context: FlagContext = {}): Promise<T> {
  const enabled = await isEnabled(key, context);
  if (!enabled) return defaultValue;

  const flag = await getFlag(key);
  if (!flag) return defaultValue;

  // If variants exist, return variant value
  if (flag.variants && flag.variants.length > 0) {
    const variant = await getVariant(key, context);
    return (variant as T) ?? defaultValue;
  }

  // Return metadata value if exists
  if (flag.metadata?.value !== undefined) {
    return flag.metadata.value as T;
  }

  return defaultValue;
}

/**
 * Get all enabled flags for a context
 */
export async function getEnabledFlags(context: FlagContext = {}): Promise<string[]> {
  const flags = await getAllFlags();
  const enabled: string[] = [];

  for (const flag of flags) {
    if (await isEnabled(flag.key, context)) {
      enabled.push(flag.key);
    }
  }

  return enabled;
}

/**
 * Get a single flag from cache or database
 */
async function getFlag(key: string): Promise<FeatureFlag | null> {
  // Check cache
  const cached = flagCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.flag;
  }

  // Fetch from database
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: FLAGS_TABLE,
      Key: {
        pk: { S: 'FLAG' },
        sk: { S: key },
      },
    }));

    if (!result.Item) {
      return null;
    }

    const flag: FeatureFlag = {
      key: result.Item.sk.S!,
      enabled: result.Item.enabled?.BOOL ?? false,
      description: result.Item.description?.S,
      rolloutPercentage: result.Item.rollout_percentage?.N 
        ? parseInt(result.Item.rollout_percentage.N, 10) 
        : undefined,
      targetTenants: result.Item.target_tenants?.SS,
      targetTiers: result.Item.target_tiers?.SS,
      variants: result.Item.variants?.S 
        ? JSON.parse(result.Item.variants.S) 
        : undefined,
      metadata: result.Item.metadata?.S 
        ? JSON.parse(result.Item.metadata.S) 
        : undefined,
      createdAt: result.Item.created_at?.S || '',
      updatedAt: result.Item.updated_at?.S || '',
    };

    // Cache the flag
    flagCache.set(key, {
      flag,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return flag;
  } catch (error) {
    console.error(`Error fetching flag ${key}:`, error);
    return null;
  }
}

/**
 * Get all flags
 */
async function getAllFlags(): Promise<FeatureFlag[]> {
  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: FLAGS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': { S: 'FLAG' },
      },
    }));

    return (result.Items || []).map(item => ({
      key: item.sk.S!,
      enabled: item.enabled?.BOOL ?? false,
      description: item.description?.S,
      rolloutPercentage: item.rollout_percentage?.N 
        ? parseInt(item.rollout_percentage.N, 10) 
        : undefined,
      targetTenants: item.target_tenants?.SS,
      targetTiers: item.target_tiers?.SS,
      variants: item.variants?.S ? JSON.parse(item.variants.S) : undefined,
      metadata: item.metadata?.S ? JSON.parse(item.metadata.S) : undefined,
      createdAt: item.created_at?.S || '',
      updatedAt: item.updated_at?.S || '',
    }));
  } catch (error) {
    console.error('Error fetching all flags:', error);
    return [];
  }
}

/**
 * Hash context for consistent bucketing
 */
function hashContext(key: string, context: FlagContext): number {
  const str = `${key}:${context.tenantId || ''}:${context.userId || ''}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Clear flag cache (for testing or forced refresh)
 */
export function clearCache(): void {
  flagCache.clear();
}

/**
 * Predefined feature flags
 */
export const FLAGS = {
  // AI Features
  STREAMING_ENABLED: 'ai.streaming.enabled',
  FUNCTION_CALLING_ENABLED: 'ai.function_calling.enabled',
  VISION_ENABLED: 'ai.vision.enabled',
  
  // Billing
  USAGE_ALERTS_ENABLED: 'billing.usage_alerts.enabled',
  AUTO_TOPUP_ENABLED: 'billing.auto_topup.enabled',
  
  // Platform
  MULTI_REGION_ENABLED: 'platform.multi_region.enabled',
  WEBHOOKS_ENABLED: 'platform.webhooks.enabled',
  BATCH_PROCESSING_ENABLED: 'platform.batch.enabled',
  
  // Admin
  ADMIN_ANALYTICS_V2: 'admin.analytics_v2.enabled',
  ADMIN_AUDIT_EXPORT: 'admin.audit_export.enabled',
  
  // Experimental
  ORCHESTRATION_PATTERNS: 'experimental.orchestration.enabled',
  AI_AGENTS: 'experimental.agents.enabled',
} as const;
