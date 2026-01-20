/**
 * RADIANT v5.33.0 - MCP Elicitation Schema Service
 * 
 * Implements the MCP Elicitation specification for structured question schemas.
 * Provides standardized question/response formats for HITL interactions.
 * 
 * MCP Elicitation supports three response actions:
 * - accept: User provides a valid response
 * - decline: User refuses to answer
 * - cancel: User cancels the workflow
 */

import { executeStatement, stringParam } from '../../db/client';
import { logger } from '../../utils/logger';
import { voiService, VOIDecision } from './voi.service';
import { batchingService } from './batching.service';
import { rateLimitingService } from './rate-limiting.service';
import { deduplicationService } from './deduplication.service';
import { abstentionService } from './abstention.service';

// Using enhanced logger from utils

// ============================================================================
// MCP ELICITATION TYPES
// ============================================================================

export type QuestionType = 
  | 'yes_no' 
  | 'single_choice' 
  | 'multiple_choice' 
  | 'free_text' 
  | 'numeric' 
  | 'date' 
  | 'confirmation'
  | 'structured';

export type Urgency = 'blocking' | 'high' | 'normal' | 'low' | 'optional';

export type ResponseAction = 'accept' | 'decline' | 'cancel';

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  isDefault?: boolean;
}

export interface AskUserRequest {
  requestId?: string;
  question: string;
  questionType: QuestionType;
  options?: QuestionOption[];
  responseSchema?: JSONSchemaDefinition;
  urgency: Urgency;
  timeout?: {
    seconds: number;
    defaultAction: ResponseAction;
    defaultValue?: unknown;
  };
  context?: {
    previousResponses?: string[];
    relatedArtifacts?: string[];
    workflowId?: string;
    entityId?: string;
    taskType?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface AskUserResponse {
  requestId: string;
  action: ResponseAction;
  response?: unknown;
  respondedAt: Date;
  respondedBy?: string;
  timeToRespond?: number;
}

export interface JSONSchemaDefinition {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  enum?: (string | number)[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

// ============================================================================
// ORCHESTRATION RESULT
// ============================================================================

export interface OrchestrationResult {
  shouldAsk: boolean;
  requestId?: string;
  batchId?: string;
  voiDecision?: VOIDecision;
  cachedResponse?: unknown;
  rateLimited?: boolean;
  rateLimitReason?: string;
  assumption?: {
    value: unknown;
    reasoning: string;
  };
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

async function createAskUserRequest(
  tenantId: string,
  userId: string | undefined,
  request: AskUserRequest
): Promise<OrchestrationResult> {
  const context = request.context || {};
  
  // 1. Check rate limits
  const rateLimitCheck = await rateLimitingService.checkAllRateLimits(
    tenantId,
    userId,
    context.workflowId
  );
  
  if (!rateLimitCheck.allowed) {
    logger.warn('Rate limit blocked question', {
      tenantId,
      blockedBy: rateLimitCheck.blockedBy,
      reason: rateLimitCheck.blockedBy === 'global' ? rateLimitCheck.global.reason :
               rateLimitCheck.blockedBy === 'per_user' ? rateLimitCheck.perUser?.reason :
               rateLimitCheck.perWorkflow?.reason,
    });
    
    return {
      shouldAsk: false,
      rateLimited: true,
      rateLimitReason: rateLimitCheck.blockedBy === 'global' ? rateLimitCheck.global.reason :
                 rateLimitCheck.blockedBy === 'per_user' ? rateLimitCheck.perUser?.reason :
                 rateLimitCheck.perWorkflow?.reason,
      assumption: request.timeout?.defaultValue !== undefined ? {
        value: request.timeout.defaultValue,
        reasoning: 'Rate limit exceeded. Using default value.',
      } : undefined,
    };
  }

  // 2. Check deduplication cache
  const cacheCheck = await deduplicationService.checkCache(
    tenantId,
    request.question,
    context as Record<string, unknown>
  );
  
  if (cacheCheck.isDuplicate) {
    logger.info('Question deduplicated from cache', {
      tenantId,
      cacheId: cacheCheck.cacheId,
      hitCount: cacheCheck.hitCount,
    });
    
    return {
      shouldAsk: false,
      cachedResponse: cacheCheck.cachedResponse,
    };
  }

  // 3. Calculate VOI (should we ask?)
  const voiDecision = await voiService.shouldAskQuestion({
    tenantId,
    workflowType: context.taskType,
    question: request.question,
    aspectName: extractAspectName(request.question),
    aspectCategory: inferAspectCategory(request),
    options: request.options?.map(o => o.value),
    currentContext: context as Record<string, unknown>,
    urgency: request.urgency,
  });

  if (voiDecision.decision !== 'ask') {
    logger.info('VOI decided not to ask', {
      tenantId,
      decision: voiDecision.decision,
      voiScore: voiDecision.voiScore,
      reasoning: voiDecision.reasoning,
    });

    // Get default value or inferred value
    const assumedValue = voiDecision.decision === 'infer'
      ? inferValue(request)
      : (request.timeout?.defaultValue ?? getDefaultForType(request.questionType));

    return {
      shouldAsk: false,
      voiDecision,
      assumption: {
        value: assumedValue,
        reasoning: voiDecision.reasoning,
      },
    };
  }

  // 4. Consume rate limits
  await rateLimitingService.consumeAllRateLimits(tenantId, userId, context.workflowId);

  // 5. Create the approval request
  const requestId = await createApprovalRequest(tenantId, userId, request);

  // 6. Batch the question
  const { batchId } = await batchingService.batchQuestion(
    tenantId,
    requestId,
    request.question,
    userId,
    context as Record<string, unknown>
  );

  // 7. Record VOI decision
  await voiService.recordVOIDecision(requestId, voiDecision);

  logger.info('Created ask_user request', {
    tenantId,
    requestId,
    batchId,
    questionType: request.questionType,
    urgency: request.urgency,
  });

  return {
    shouldAsk: true,
    requestId,
    batchId,
    voiDecision,
  };
}

async function createApprovalRequest(
  tenantId: string,
  userId: string | undefined,
  request: AskUserRequest
): Promise<string> {
  // Get default queue for tenant
  const queueResult = await executeStatement(
    `SELECT id FROM hitl_queue_configs
     WHERE tenant_id = :tenantId AND is_active = true
     ORDER BY created_at
     LIMIT 1`,
    [stringParam('tenantId', tenantId)]
  );

  const queueId = queueResult.rows?.[0]?.id as string;
  if (!queueId) {
    throw new Error('No active HITL queue configured for tenant');
  }

  const expiresAt = request.timeout
    ? new Date(Date.now() + request.timeout.seconds * 1000)
    : new Date(Date.now() + 60 * 60 * 1000); // Default 1 hour

  const result = await executeStatement(
    `INSERT INTO hitl_approval_requests (
       queue_id, tenant_id, request_type, request_summary, request_details,
       question_type, urgency, options, response_schema,
       default_action, default_value, context_data,
       expires_at, requested_by_user
     ) VALUES (
       :queueId, :tenantId, 'ask_user', :question, :details::jsonb,
       :questionType, :urgency, :options::jsonb, :responseSchema::jsonb,
       :defaultAction, :defaultValue::jsonb, :contextData::jsonb,
       :expiresAt, :requestedBy
     )
     RETURNING id`,
    [
      stringParam('queueId', queueId),
      stringParam('tenantId', tenantId),
      stringParam('question', request.question),
      stringParam('details', JSON.stringify(request.metadata || {})),
      stringParam('questionType', request.questionType),
      stringParam('urgency', request.urgency),
      stringParam('options', JSON.stringify(request.options || [])),
      stringParam('responseSchema', JSON.stringify(request.responseSchema || {})),
      stringParam('defaultAction', request.timeout?.defaultAction || 'decline'),
      stringParam('defaultValue', JSON.stringify(request.timeout?.defaultValue)),
      stringParam('contextData', JSON.stringify(request.context || {})),
      stringParam('expiresAt', expiresAt.toISOString()),
      stringParam('requestedBy', userId || ''),
    ]
  );

  return result.rows![0].id as string;
}

// ============================================================================
// RESPONSE HANDLING
// ============================================================================

async function handleAskUserResponse(
  tenantId: string,
  requestId: string,
  response: AskUserResponse
): Promise<void> {
  // Update the request
  await executeStatement(
    `UPDATE hitl_approval_requests
     SET status = CASE 
           WHEN :action = 'accept' THEN 'approved'
           WHEN :action = 'decline' THEN 'rejected'
           ELSE 'rejected'
         END,
         resolved_at = NOW(),
         resolved_by = :resolvedBy,
         resolution_action = :action,
         resolution_modifications = :response::jsonb
     WHERE id = :requestId AND tenant_id = :tenantId`,
    [
      stringParam('requestId', requestId),
      stringParam('tenantId', tenantId),
      stringParam('action', response.action),
      stringParam('resolvedBy', response.respondedBy || ''),
      stringParam('response', JSON.stringify(response.response)),
    ]
  );

  // Cache the response for future deduplication
  if (response.action === 'accept' && response.response !== undefined) {
    // Get the original question
    const reqResult = await executeStatement(
      `SELECT request_summary, context_data FROM hitl_approval_requests WHERE id = :requestId`,
      [stringParam('requestId', requestId)]
    );
    
    if (reqResult.rows && reqResult.rows.length > 0) {
      const req = reqResult.rows[0];
      await deduplicationService.cacheResponse(
        tenantId,
        req.request_summary as string,
        response.response,
        (req.context_data as Record<string, unknown>) || {},
        response.respondedBy
      );
    }
  }

  // Update batch status
  const batchResult = await executeStatement(
    `SELECT batch_id FROM hitl_approval_requests WHERE id = :requestId`,
    [stringParam('requestId', requestId)]
  );
  
  if (batchResult.rows?.[0]?.batch_id) {
    await batchingService.recordAnswer(
      batchResult.rows[0].batch_id as string,
      requestId,
      response.action === 'decline'
    );
  }

  // Release rate limits
  const contextResult = await executeStatement(
    `SELECT context_data, requested_by_user FROM hitl_approval_requests WHERE id = :requestId`,
    [stringParam('requestId', requestId)]
  );
  
  if (contextResult.rows && contextResult.rows.length > 0) {
    const ctx = contextResult.rows[0];
    const context = (ctx.context_data as Record<string, unknown>) || {};
    await rateLimitingService.releaseAllRateLimits(
      tenantId,
      ctx.requested_by_user as string | undefined,
      context.workflowId as string | undefined
    );
  }

  // Record VOI outcome
  const voiResult = await executeStatement(
    `SELECT aspect_id FROM hitl_voi_decisions WHERE request_id = :requestId`,
    [stringParam('requestId', requestId)]
  );
  
  if (voiResult.rows && voiResult.rows.length > 0) {
    const aspectResult = await executeStatement(
      `SELECT prior_belief FROM hitl_voi_aspects WHERE id = :aspectId`,
      [stringParam('aspectId', voiResult.rows[0].aspect_id as string)]
    );
    
    if (aspectResult.rows && aspectResult.rows.length > 0) {
      await voiService.recordQuestionOutcome(
        requestId,
        voiResult.rows[0].aspect_id as string,
        response.response,
        aspectResult.rows[0].prior_belief as Parameters<typeof voiService.recordQuestionOutcome>[3]
      );
    }
  }

  logger.info('Handled ask_user response', {
    tenantId,
    requestId,
    action: response.action,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractAspectName(question: string): string {
  // Extract key aspect from question
  const normalized = question.toLowerCase()
    .replace(/[?!.,]/g, '')
    .replace(/\b(what|which|how|when|where|who|would|could|should|do|does|is|are|the|a|an)\b/g, '')
    .trim();
  
  const words = normalized.split(/\s+/).filter(w => w.length > 3);
  return words.slice(0, 3).join('_') || 'general_question';
}

function inferAspectCategory(
  request: AskUserRequest
): 'preference' | 'constraint' | 'requirement' | 'context' {
  const question = request.question.toLowerCase();
  
  if (question.includes('prefer') || question.includes('like') || question.includes('want')) {
    return 'preference';
  }
  if (question.includes('must') || question.includes('require') || question.includes('need')) {
    return 'requirement';
  }
  if (question.includes('limit') || question.includes('constraint') || question.includes('budget')) {
    return 'constraint';
  }
  return 'context';
}

function inferValue(request: AskUserRequest): unknown {
  // Try to infer the most likely value based on options/type
  if (request.options && request.options.length > 0) {
    const defaultOption = request.options.find(o => o.isDefault);
    if (defaultOption) return defaultOption.value;
    return request.options[0].value;
  }

  return getDefaultForType(request.questionType);
}

function getDefaultForType(questionType: QuestionType): unknown {
  switch (questionType) {
    case 'yes_no':
    case 'confirmation':
      return false;
    case 'numeric':
      return 0;
    case 'free_text':
      return '';
    case 'date':
      return new Date().toISOString().split('T')[0];
    case 'single_choice':
    case 'multiple_choice':
      return null;
    case 'structured':
      return {};
    default:
      return null;
  }
}

// ============================================================================
// SCHEMA VALIDATION
// ============================================================================

function validateResponse(
  response: unknown,
  schema: JSONSchemaDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (schema.type === 'object' && typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>;
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key in obj) {
          const propErrors = validateProperty(obj[key], prop, key);
          errors.push(...propErrors);
        }
      }
    }

    // Check additional properties
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(obj)) {
        if (!(key in schema.properties)) {
          errors.push(`Unexpected property: ${key}`);
        }
      }
    }
  } else if (schema.type !== 'object') {
    const expectedType = schema.type;
    const actualType = typeof response;
    if (actualType !== expectedType) {
      errors.push(`Expected ${expectedType}, got ${actualType}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateProperty(
  value: unknown,
  prop: JSONSchemaProperty,
  fieldName: string
): string[] {
  const errors: string[] = [];
  const actualType = typeof value;

  if (prop.type === 'integer') {
    if (actualType !== 'number' || !Number.isInteger(value)) {
      errors.push(`${fieldName}: Expected integer, got ${actualType}`);
    }
  } else if (actualType !== prop.type) {
    errors.push(`${fieldName}: Expected ${prop.type}, got ${actualType}`);
  }

  if (prop.enum && !prop.enum.includes(value as string | number)) {
    errors.push(`${fieldName}: Value must be one of ${prop.enum.join(', ')}`);
  }

  if (prop.type === 'number' || prop.type === 'integer') {
    const num = value as number;
    if (prop.minimum !== undefined && num < prop.minimum) {
      errors.push(`${fieldName}: Value must be >= ${prop.minimum}`);
    }
    if (prop.maximum !== undefined && num > prop.maximum) {
      errors.push(`${fieldName}: Value must be <= ${prop.maximum}`);
    }
  }

  if (prop.type === 'string') {
    const str = value as string;
    if (prop.minLength !== undefined && str.length < prop.minLength) {
      errors.push(`${fieldName}: Length must be >= ${prop.minLength}`);
    }
    if (prop.maxLength !== undefined && str.length > prop.maxLength) {
      errors.push(`${fieldName}: Length must be <= ${prop.maxLength}`);
    }
    if (prop.pattern && !new RegExp(prop.pattern).test(str)) {
      errors.push(`${fieldName}: Value must match pattern ${prop.pattern}`);
    }
  }

  return errors;
}

// ============================================================================
// EXPORT
// ============================================================================

export const mcpElicitationService = {
  createAskUserRequest,
  handleAskUserResponse,
  validateResponse,
  extractAspectName,
  inferAspectCategory,
  getDefaultForType,
};

// Re-export sub-services for convenience
export { voiService } from './voi.service';
export { abstentionService } from './abstention.service';
export { batchingService } from './batching.service';
export { rateLimitingService } from './rate-limiting.service';
export { deduplicationService } from './deduplication.service';
export { escalationService } from './escalation.service';
