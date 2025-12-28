/**
 * RADIANT v4.18.0 - Request Validation Schemas
 * 
 * Zod schemas for validating API request bodies.
 * Use with parseEventBody() from safe-json.ts
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  cursor: z.string().optional(),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const UUIDSchema = z.string().uuid();

export const TenantIdSchema = z.string().min(1).max(64);

// ============================================================================
// AGI Orchestration Schemas
// ============================================================================

export const ServiceWeightUpdateSchema = z.object({
  weight: z.number().min(0).max(1),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  minLatencyMs: z.number().int().min(0).optional(),
  maxCostCents: z.number().int().min(0).optional(),
});

export const BulkServiceWeightsSchema = z.object({
  weights: z.array(z.object({
    serviceId: z.string(),
    weight: z.number().min(0).max(1),
    enabled: z.boolean().optional(),
  })),
});

export const ConsciousnessWeightUpdateSchema = z.object({
  weight: z.number().min(0).max(1),
  enabled: z.boolean().optional(),
  cycleDepth: z.number().int().min(1).max(10).optional(),
  integrationThreshold: z.number().min(0).max(1).optional(),
});

export const DecisionWeightsSchema = z.object({
  modelQualityWeight: z.number().min(0).max(1).optional(),
  modelCostWeight: z.number().min(0).max(1).optional(),
  modelLatencyWeight: z.number().min(0).max(1).optional(),
  modelSpecialtyWeight: z.number().min(0).max(1).optional(),
  modelReliabilityWeight: z.number().min(0).max(1).optional(),
  domainDetectionWeight: z.number().min(0).max(1).optional(),
  proficiencyMatchWeight: z.number().min(0).max(1).optional(),
});

// ============================================================================
// Brain Plan Schemas
// ============================================================================

export const GeneratePlanRequestSchema = z.object({
  prompt: z.string().min(1).max(100000),
  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  preferences: z.object({
    orchestrationMode: z.enum([
      'thinking', 'extended_thinking', 'coding', 'creative',
      'research', 'analysis', 'multi_model', 'chain_of_thought', 'self_consistency'
    ]).optional(),
    maxCostCents: z.number().int().min(0).optional(),
    maxLatencyMs: z.number().int().min(0).optional(),
    preferredModels: z.array(z.string()).optional(),
  }).optional(),
});

export const UpdateStepStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'failed']),
  output: z.record(z.unknown()).optional(),
  durationMs: z.number().int().min(0).optional(),
  error: z.string().optional(),
});

// ============================================================================
// Domain Taxonomy Schemas
// ============================================================================

export const DomainDetectionRequestSchema = z.object({
  prompt: z.string().min(1).max(50000),
  context: z.string().optional(),
  previousDomainId: z.string().optional(),
});

export const UserDomainSelectionSchema = z.object({
  fieldId: z.string().optional(),
  domainId: z.string().optional(),
  subspecialtyId: z.string().optional(),
  sessionId: z.string(),
  isDefault: z.boolean().optional(),
});

export const DomainFeedbackSchema = z.object({
  promptId: z.string(),
  detectedDomainId: z.string(),
  correctDomainId: z.string().optional(),
  wasCorrect: z.boolean(),
  comment: z.string().max(500).optional(),
});

// ============================================================================
// Chat/Completion Schemas
// ============================================================================

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
  name: z.string().optional(),
});

export const ChatCompletionRequestSchema = z.object({
  model: z.string().optional(),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  topP: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
});

// ============================================================================
// Webhook Schemas
// ============================================================================

export const WebhookCreateSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.string()).min(1),
  description: z.string().max(500).optional(),
});

export const WebhookUpdateSchema = z.object({
  url: z.string().url().optional(),
  eventTypes: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Billing Schemas
// ============================================================================

export const AddCreditsSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1).max(200),
  expiresAt: z.string().datetime().optional(),
});

export const UsageQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month', 'model', 'user']).optional(),
});

// ============================================================================
// Admin Schemas
// ============================================================================

export const TenantCreateSchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
  settings: z.record(z.unknown()).optional(),
});

export const InvitationCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(['super_admin', 'admin', 'operator', 'auditor']),
  message: z.string().max(500).optional(),
});

export const ConfigUpdateSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  description: z.string().max(500).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type PaginationParams = z.infer<typeof PaginationSchema>;
export type ServiceWeightUpdate = z.infer<typeof ServiceWeightUpdateSchema>;
export type BulkServiceWeights = z.infer<typeof BulkServiceWeightsSchema>;
export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;
export type WebhookCreate = z.infer<typeof WebhookCreateSchema>;
export type TenantCreate = z.infer<typeof TenantCreateSchema>;
