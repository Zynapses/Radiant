// RADIANT v4.18.0 - Shared Zod Validation Schemas
// Centralized validation for API request/response data

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const UUIDSchema = z.string().uuid();

export const TenantIdSchema = z.string().min(1).max(100);

export const UserIdSchema = z.string().min(1).max(100);

export const TimestampSchema = z.string().datetime().or(z.date());

export const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  cursor: z.string().optional(),
});

export const SortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// Authentication Schemas
// ============================================================================

export const AuthTokenSchema = z.object({
  sub: z.string(),
  email: z.string().email().optional(),
  tenantId: TenantIdSchema,
  userId: UserIdSchema.optional(),
  roles: z.array(z.string()).default([]),
  exp: z.number(),
  iat: z.number(),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
  tenantName: z.string().min(1).max(200).optional(),
});

// ============================================================================
// Chat/Conversation Schemas
// ============================================================================

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);

export const ChatMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
});

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  modelId: z.string().optional(),
  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(200000).optional(),
  stream: z.boolean().default(false),
  systemPrompt: z.string().optional(),
});

export const ConversationCreateSchema = z.object({
  title: z.string().max(500).optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Model Selection Schemas
// ============================================================================

export const ModelCapabilitySchema = z.enum([
  'chat',
  'vision',
  'reasoning',
  'coding',
  'math',
  'creative',
  'fast',
  'long-context',
  'thinking',
  'extended-thinking',
  'agents',
  'multimodal',
  'analysis',
]);

export const ModelSelectionRequestSchema = z.object({
  prompt: z.string().min(1),
  preferredCapabilities: z.array(ModelCapabilitySchema).optional(),
  maxCostCents: z.number().positive().optional(),
  maxLatencyMs: z.number().positive().optional(),
  preferredProvider: z.string().optional(),
  excludeProviders: z.array(z.string()).optional(),
});

// ============================================================================
// Brain Plan Schemas
// ============================================================================

export const OrchestrationModeSchema = z.enum([
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

export const BrainPlanRequestSchema = z.object({
  prompt: z.string().min(1).max(100000),
  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  preferredMode: OrchestrationModeSchema.optional(),
  maxCostCents: z.number().positive().optional(),
  maxLatencyMs: z.number().positive().optional(),
  context: z.string().optional(),
});

export const BrainPlanExecuteSchema = z.object({
  planId: z.string(),
  skipConfirmation: z.boolean().default(false),
});

// ============================================================================
// Domain Taxonomy Schemas
// ============================================================================

export const DomainDetectionRequestSchema = z.object({
  prompt: z.string().min(1),
  context: z.string().optional(),
  hints: z.array(z.string()).optional(),
});

export const DomainSelectionSchema = z.object({
  fieldId: z.string(),
  domainId: z.string().optional(),
  subspecialtyId: z.string().optional(),
  sessionId: z.string().optional(),
  isDefault: z.boolean().default(false),
});

// ============================================================================
// Feedback Schemas
// ============================================================================

export const FeedbackRatingSchema = z.enum(['positive', 'negative', 'neutral']);

export const FeedbackSubmitSchema = z.object({
  interactionId: z.string(),
  rating: FeedbackRatingSchema,
  comment: z.string().max(5000).optional(),
  categories: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Admin Schemas
// ============================================================================

export const TenantCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  adminEmail: z.string().email(),
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']).default('free'),
  settings: z.record(z.unknown()).optional(),
});

export const TenantUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const UserInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  message: z.string().max(1000).optional(),
});

export const ModelConfigUpdateSchema = z.object({
  modelId: z.string(),
  isEnabled: z.boolean().optional(),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  costMultiplier: z.number().positive().optional(),
  rateLimitPerMinute: z.number().positive().optional(),
});

// ============================================================================
// Billing Schemas
// ============================================================================

export const UsageRecordSchema = z.object({
  modelId: z.string(),
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  requestId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreditPurchaseSchema = z.object({
  amount: z.number().positive(),
  paymentMethodId: z.string().optional(),
});

// ============================================================================
// Consciousness/AGI Schemas
// ============================================================================

export const ConsciousnessMetricsSchema = z.object({
  overallConsciousnessIndex: z.number().min(0).max(1),
  globalWorkspaceActivity: z.number().min(0).max(1),
  recurrenceDepth: z.number().min(0).max(1),
  integratedInformationPhi: z.number().min(0).max(1),
  metacognitionLevel: z.number().min(0).max(1),
  memoryCoherence: z.number().min(0).max(1),
  worldModelGrounding: z.number().min(0).max(1),
  phenomenalBindingStrength: z.number().min(0).max(1),
  attentionalFocus: z.number().min(0).max(1),
  selfAwarenessScore: z.number().min(0).max(1),
});

export const AGIWeightUpdateSchema = z.object({
  serviceId: z.string(),
  weight: z.number().min(0).max(1),
});

// ============================================================================
// WebSocket Schemas
// ============================================================================

export const WebSocketMessageSchema = z.object({
  type: z.string(),
  sessionId: z.string().optional(),
  payload: z.unknown().optional(),
  requestId: z.string().optional(),
});

export const JoinSessionSchema = z.object({
  participantId: z.string(),
  token: z.string(),
});

export const CursorMoveSchema = z.object({
  x: z.number(),
  y: z.number(),
  elementId: z.string().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

export function validateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

export function safeValidateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
}

// ============================================================================
// Request Body Parser with Validation
// ============================================================================

export function parseAndValidate<T extends z.ZodSchema>(
  schema: T,
  body: string | null | undefined
): z.infer<T> {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('Invalid JSON in request body');
  }
  
  return schema.parse(parsed);
}

export function parseQueryParams<T extends z.ZodSchema>(
  schema: T,
  params: Record<string, string | undefined> | null
): z.infer<T> {
  return schema.parse(params || {});
}
