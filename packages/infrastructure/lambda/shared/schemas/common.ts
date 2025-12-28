/**
 * RADIANT v4.18.0 - Common Zod Schemas
 * 
 * Reusable validation schemas for API requests and responses.
 * Import these instead of defining ad-hoc schemas to ensure consistency.
 */

import { z } from 'zod';

// ============================================================================
// Primitive Schemas
// ============================================================================

/** UUID v4 format */
export const uuidSchema = z.string().uuid();

/** Non-empty string */
export const nonEmptyStringSchema = z.string().min(1);

/** Email address */
export const emailSchema = z.string().email();

/** URL */
export const urlSchema = z.string().url();

/** ISO 8601 date string */
export const isoDateSchema = z.string().datetime();

/** Positive integer */
export const positiveIntSchema = z.number().int().positive();

/** Non-negative integer */
export const nonNegativeIntSchema = z.number().int().nonnegative();

/** Percentage (0-100) */
export const percentageSchema = z.number().min(0).max(100);

/** Score (0-1) */
export const scoreSchema = z.number().min(0).max(1);

// ============================================================================
// ID Schemas
// ============================================================================

export const tenantIdSchema = z.string().min(1).max(100);
export const userIdSchema = z.string().min(1).max(100);
export const sessionIdSchema = z.string().min(1).max(100);
export const modelIdSchema = z.string().min(1).max(200);
export const planIdSchema = z.string().uuid();
export const conversationIdSchema = z.string().uuid();

// ============================================================================
// Pagination
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

// ============================================================================
// API Request Schemas
// ============================================================================

/** Standard request context from auth middleware */
export const requestContextSchema = z.object({
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  sessionId: sessionIdSchema.optional(),
  requestId: z.string(),
});

export type RequestContext = z.infer<typeof requestContextSchema>;

/** Chat message */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  name: z.string().optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Chat completion request */
export const chatCompletionRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  model: modelIdSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

// ============================================================================
// Domain Taxonomy Schemas
// ============================================================================

export const domainDetectionRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  manualFieldId: z.string().optional(),
  manualDomainId: z.string().optional(),
  manualSubspecialtyId: z.string().optional(),
});

export type DomainDetectionRequest = z.infer<typeof domainDetectionRequestSchema>;

export const domainSelectionSchema = z.object({
  fieldId: z.string().optional(),
  domainId: z.string().optional(),
  subspecialtyId: z.string().optional(),
  sessionId: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

export type DomainSelection = z.infer<typeof domainSelectionSchema>;

// ============================================================================
// Delight System Schemas
// ============================================================================

export const personalityModeSchema = z.enum([
  'professional',
  'subtle',
  'expressive',
  'playful',
  'auto',
]);

export type PersonalityMode = z.infer<typeof personalityModeSchema>;

export const delightPreferencesSchema = z.object({
  personalityMode: personalityModeSchema.optional(),
  intensityLevel: z.number().int().min(1).max(10).optional(),
  enableDomainMessages: z.boolean().optional(),
  enableModelPersonality: z.boolean().optional(),
  enableTimeAwareness: z.boolean().optional(),
  enableAchievements: z.boolean().optional(),
  enableWellbeingNudges: z.boolean().optional(),
  enableEasterEggs: z.boolean().optional(),
  enableSounds: z.boolean().optional(),
  soundTheme: z.string().optional(),
  soundVolume: z.number().int().min(0).max(100).optional(),
});

export type DelightPreferences = z.infer<typeof delightPreferencesSchema>;

// ============================================================================
// AGI Brain Plan Schemas
// ============================================================================

export const orchestrationModeSchema = z.enum([
  'thinking',
  'extended_thinking',
  'coding',
  'creative',
  'research',
  'analysis',
  'multi_model',
  'chain_of_thought',
  'self_consistency',
]);

export type OrchestrationMode = z.infer<typeof orchestrationModeSchema>;

export const planStepStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
]);

export type PlanStepStatus = z.infer<typeof planStepStatusSchema>;

export const generatePlanRequestSchema = z.object({
  prompt: z.string().min(1).max(50000),
  mode: orchestrationModeSchema.optional(),
  domainOverride: domainSelectionSchema.optional(),
  modelPreference: modelIdSchema.optional(),
});

export type GeneratePlanRequest = z.infer<typeof generatePlanRequestSchema>;

// ============================================================================
// Billing Schemas
// ============================================================================

export const usageEventSchema = z.object({
  modelId: modelIdSchema,
  modelName: z.string(),
  providerId: z.string().optional(),
  requestType: z.enum(['chat', 'embedding', 'image', 'audio', 'video']),
  inputTokens: nonNegativeIntSchema,
  outputTokens: nonNegativeIntSchema,
  latencyMs: nonNegativeIntSchema.optional(),
  cached: z.boolean().optional().default(false),
  phiDetected: z.boolean().optional().default(false),
  phiSanitized: z.boolean().optional().default(false),
  requestId: z.string().optional(),
  userId: userIdSchema.optional(),
});

export type UsageEvent = z.infer<typeof usageEventSchema>;

// ============================================================================
// Error Response Schema
// ============================================================================

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ============================================================================
// Success Response Schema
// ============================================================================

export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z.object({
      requestId: z.string().optional(),
      timestamp: isoDateSchema.optional(),
    }).optional(),
  });

// ============================================================================
// Paginated Response Schema
// ============================================================================

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: positiveIntSchema,
      limit: positiveIntSchema,
      total: nonNegativeIntSchema,
      totalPages: nonNegativeIntSchema,
      hasMore: z.boolean(),
    }),
  });
