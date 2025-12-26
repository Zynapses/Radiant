/**
 * Input validation schemas using Zod
 */

import { z } from 'zod';

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidSchema = z.string().uuid();

export const emailSchema = z.string().email();

export const tenantIdSchema = z.string().regex(/^tn_[a-z0-9]+$/i, 'Invalid tenant ID format');

export const apiKeySchema = z.string().regex(/^rad_[a-z0-9_]+$/i, 'Invalid API key format');

// Tenant schemas
export const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  email: emailSchema,
  tier: z.enum(['starter', 'professional', 'business', 'enterprise']).default('starter'),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: emailSchema.optional(),
  tier: z.enum(['starter', 'professional', 'business', 'enterprise']).optional(),
  settings: z.object({
    maxUsers: z.number().int().min(1).optional(),
    maxApiKeys: z.number().int().min(1).optional(),
    allowedModels: z.array(z.string()).optional(),
    ssoEnabled: z.boolean().optional(),
  }).optional(),
});

// Model schemas
export const createModelSchema = z.object({
  id: z.string().min(1).max(100),
  provider_id: z.string().min(1),
  display_name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.enum(['chat', 'completion', 'embedding', 'image', 'audio', 'video']).default('chat'),
  context_window: z.number().int().min(1).default(4096),
  input_cost_per_1k: z.number().min(0).optional(),
  output_cost_per_1k: z.number().min(0).optional(),
  capabilities: z.array(z.string()).default(['chat']),
});

export const updateModelSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum(['chat', 'completion', 'embedding', 'image', 'audio', 'video']).optional(),
  context_window: z.number().int().min(1).optional(),
  capabilities: z.array(z.string()).optional(),
  is_enabled: z.boolean().optional(),
});

// Chat schemas
export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function']),
  content: z.string(),
  name: z.string().optional(),
  function_call: z.object({
    name: z.string(),
    arguments: z.string(),
  }).optional(),
});

export const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
});

// Webhook schemas
export const createWebhookSchema = z.object({
  url: z.string().url(),
  event_types: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(),
});

// Cost alert schemas
export const createCostAlertSchema = z.object({
  alert_type: z.enum(['threshold', 'spike', 'budget']),
  threshold: z.number().min(0),
  notification_email: emailSchema.optional(),
});

// Schedule schemas
export const createScheduleSchema = z.object({
  name: z.string().min(1).max(255),
  prompt: z.string().min(1),
  model: z.string().min(1),
  type: z.enum(['once', 'cron', 'interval']),
  cron_expression: z.string().optional(),
  run_at: z.string().datetime().optional(),
  interval_minutes: z.number().int().min(1).optional(),
  timezone: z.string().default('UTC'),
  max_runs: z.number().int().min(1).optional(),
  notification_email: emailSchema.optional(),
  output_destination: z.enum(['email', 'webhook', 'storage']).optional(),
});

// Validation helper
export function validateBody<T>(body: string | null, schema: z.ZodSchema<T>): { success: true; data: T } | { success: false; error: string } {
  if (!body) {
    return { success: false, error: 'Request body is required' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (parseError) {
    console.debug('JSON parse error in validation:', parseError instanceof Error ? parseError.message : 'unknown');
    return { success: false, error: 'Invalid JSON body' };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
}

export function validateQuery<T>(query: Record<string, string | undefined> | null, schema: z.ZodSchema<T>): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(query || {});
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
}
