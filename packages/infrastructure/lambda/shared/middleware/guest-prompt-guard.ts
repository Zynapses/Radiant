/**
 * RADIANT v4.18.0 - Guest Prompt Execution Guard
 *
 * Middleware that intercepts AI prompt requests from guest participants and:
 *  1. Checks the guest has `can_execute_prompts = true`
 *  2. Checks per-session prompt/token limits
 *  3. Resolves cost attribution (who pays)
 *  4. After execution, records usage against the attributed user + tenant
 *
 * Usage:
 *   import { guardGuestPrompt, recordGuestPromptUsage } from './middleware/guest-prompt-guard';
 *
 *   // Before calling LiteLLM / AI model:
 *   const guard = await guardGuestPrompt(pool, { guestId, sessionId, tenantId });
 *   if (!guard.allowed) return error(403, guard.reason);
 *
 *   // ... execute AI call ...
 *
 *   // After AI call completes:
 *   await recordGuestPromptUsage(pool, guard, { modelId, inputTokens, outputTokens, ... });
 */

import { Pool } from 'pg';
import { CollaborationPolicyService } from '../services/collaboration-policy.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GuestPromptGuardRequest {
  guestId: string;
  sessionId: string;
  tenantId: string;
}

export interface GuestPromptGuardResult {
  allowed: boolean;
  reason?: string;
  guestId: string;
  sessionId: string;
  tenantId: string;
  attributedToUserId: string;
  attributionType: string;
  splitPercent?: number;
  guestTenantId?: string;
}

export interface GuestPromptUsageData {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  providerCost: number;
  billedCost: number;
  requestId?: string;
  requestType?: string;
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Guard: call BEFORE executing AI prompt
// ---------------------------------------------------------------------------

export async function guardGuestPrompt(
  pool: Pool,
  request: GuestPromptGuardRequest
): Promise<GuestPromptGuardResult> {
  const policyService = new CollaborationPolicyService(pool);
  const { guestId, sessionId, tenantId } = request;

  // 1. Check the guest record has prompt execution enabled
  const guestResult = await pool.query(
    `SELECT can_execute_prompts, permission FROM collaboration_guests WHERE id = $1 AND session_id = $2`,
    [guestId, sessionId]
  );

  if (guestResult.rows.length === 0) {
    return { allowed: false, reason: 'Guest not found in this session.', guestId, sessionId, tenantId, attributedToUserId: '', attributionType: '' };
  }

  const guest = guestResult.rows[0];
  if (!guest.can_execute_prompts) {
    // Log the restriction
    await policyService.logRestriction(
      tenantId, sessionId, guestId,
      'prompt_execution',
      `Guest attempted prompt execution but can_execute_prompts is false (permission: ${guest.permission})`,
      [],
      'AI prompt execution is not available for guest participants in this session.'
    );

    return {
      allowed: false,
      reason: 'AI prompt execution is not available for guest participants in this session. This restriction is set by the organization\'s collaboration policy.',
      guestId, sessionId, tenantId, attributedToUserId: '', attributionType: '',
    };
  }

  // 2. Check per-session limits
  const usageSummary = await policyService.checkGuestUsageLimits(guestId, sessionId, tenantId);
  if (usageSummary.limitReached) {
    const limitMsg = usageSummary.limitType === 'prompts'
      ? `You have reached the maximum number of AI prompts (${usageSummary.promptsExecuted}) for this session.`
      : `You have reached the maximum token usage (${usageSummary.tokensConsumed.toLocaleString()}) for this session.`;

    await policyService.logRestriction(
      tenantId, sessionId, guestId,
      'prompt_limit_reached',
      `Guest hit ${usageSummary.limitType} limit: ${usageSummary.limitType === 'prompts' ? usageSummary.promptsExecuted : usageSummary.tokensConsumed}`,
      [],
      limitMsg
    );

    return {
      allowed: false,
      reason: limitMsg + ' Contact the session host if you need additional access.',
      guestId, sessionId, tenantId, attributedToUserId: '', attributionType: '',
    };
  }

  // 3. Resolve cost attribution
  const attribution = await policyService.resolveCostAttribution(tenantId, guestId, sessionId);

  return {
    allowed: true,
    guestId,
    sessionId,
    tenantId,
    attributedToUserId: attribution.attributedToUserId,
    attributionType: attribution.attributionType,
    splitPercent: attribution.splitPercent,
    guestTenantId: attribution.guestTenantId,
  };
}

// ---------------------------------------------------------------------------
// Record: call AFTER AI prompt completes
// ---------------------------------------------------------------------------

export async function recordGuestPromptUsage(
  pool: Pool,
  guard: GuestPromptGuardResult,
  usage: GuestPromptUsageData
): Promise<void> {
  if (!guard.allowed) return;

  const policyService = new CollaborationPolicyService(pool);

  await policyService.recordGuestUsage(
    guard.guestId,
    guard.sessionId,
    guard.tenantId,
    {
      attributedToUserId: guard.attributedToUserId,
      attributionType: guard.attributionType as any,
      splitPercent: guard.splitPercent,
      guestTenantId: guard.guestTenantId,
    },
    {
      modelId: usage.modelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      providerCost: usage.providerCost,
      billedCost: usage.billedCost,
      requestId: usage.requestId,
      requestType: usage.requestType,
      latencyMs: usage.latencyMs,
    }
  );
}
