/**
 * RADIANT Genesis Cato Epistemic Recovery Service
 * Handles livelock detection and recovery when agent repeatedly fails safety checks
 *
 * IMMUTABLE CONSTRAINTS:
 * - gammaBoost is ALWAYS 0 (never boost gamma during recovery)
 * - CBFs ALWAYS remain in ENFORCE mode (shields never relax)
 * - Recovery focuses on context injection and persona switching
 */

import { query } from '../database';
import { catoStateService } from './redis.service';
import {
  RecoveryParams,
  RecoveryStrategyType,
  EpistemicRecoveryResult,
  RejectionEvent,
  CATO_INVARIANTS,
  RECOVERY_PERSONA_NAME,
  RecoveryState,
} from './types';

// Default configuration (can be overridden per-tenant)
const DEFAULT_CONFIG = {
  LIVELOCK_THRESHOLD: 3, // Number of rejections before recovery triggers
  RECOVERY_WINDOW_SECONDS: 10, // Time window for counting rejections
  MAX_RECOVERY_ATTEMPTS: 3, // Max attempts before human escalation
};

export class EpistemicRecoveryService {
  private config = DEFAULT_CONFIG;

  /**
   * Load tenant-specific configuration
   */
  async loadConfig(tenantId: string): Promise<void> {
    try {
      const result = await query(
        `SELECT livelock_threshold, recovery_window_seconds, max_recovery_attempts 
         FROM cato_tenant_config WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        this.config = {
          LIVELOCK_THRESHOLD: row.livelock_threshold || DEFAULT_CONFIG.LIVELOCK_THRESHOLD,
          RECOVERY_WINDOW_SECONDS:
            row.recovery_window_seconds || DEFAULT_CONFIG.RECOVERY_WINDOW_SECONDS,
          MAX_RECOVERY_ATTEMPTS:
            row.max_recovery_attempts || DEFAULT_CONFIG.MAX_RECOVERY_ATTEMPTS,
        };
      }
    } catch (error) {
      console.warn('[CATO Recovery] Failed to load config, using defaults:', error);
    }
  }

  /**
   * Record a rejection and check for livelock
   */
  async recordRejection(params: {
    sessionId: string;
    tenantId: string;
    rejectedBy: 'GOVERNOR' | 'CBF' | 'VETO';
    reason: string;
  }): Promise<EpistemicRecoveryResult> {
    const { sessionId, tenantId, rejectedBy, reason } = params;

    // Record the rejection
    const rejection: RejectionEvent = {
      timestamp: Date.now(),
      rejectedBy,
      reason,
    };

    const rejectionCount = await catoStateService.recordRejection(sessionId, rejection);

    // Check if we're in a livelock
    if (rejectionCount >= this.config.LIVELOCK_THRESHOLD) {
      return this.handleLivelock(sessionId, tenantId, rejectedBy);
    }

    return { isLivelocked: false };
  }

  /**
   * Handle livelock detection - determine recovery strategy
   */
  private async handleLivelock(
    sessionId: string,
    tenantId: string,
    lastRejection: 'GOVERNOR' | 'CBF' | 'VETO'
  ): Promise<EpistemicRecoveryResult> {
    // Get current recovery state
    const currentState = await catoStateService.getRecoveryState(sessionId);
    const attempt = (currentState?.attempt || 0) + 1;

    // Check if max attempts reached
    if (attempt > this.config.MAX_RECOVERY_ATTEMPTS) {
      return this.escalateToHuman(sessionId, tenantId, attempt);
    }

    // Determine strategy based on rejection source
    const strategy = this.determineStrategy(lastRejection);

    // Build recovery params (IMMUTABLE: gammaBoost=0, CBFs=ENFORCE)
    const recoveryParams = this.buildRecoveryParams(strategy, attempt);

    // Update recovery state
    await catoStateService.setRecoveryState(sessionId, {
      attempt,
      strategyType: strategy,
      startedAt: Date.now(),
    });

    // Set persona override if needed
    if (recoveryParams.forcedPersona) {
      await catoStateService.setPersonaOverride(sessionId, recoveryParams.forcedPersona);
    }

    // Record to database
    await this.recordRecoveryEvent(tenantId, sessionId, attempt, strategy, recoveryParams);

    return {
      isLivelocked: true,
      action: 'EPISTEMIC_RECOVERY',
      attempt,
      recoveryParams,
      reason: recoveryParams.description,
    };
  }

  /**
   * Determine recovery strategy based on rejection source
   */
  private determineStrategy(rejectionSource: 'GOVERNOR' | 'CBF' | 'VETO'): RecoveryStrategyType {
    switch (rejectionSource) {
      case 'VETO':
        // Veto rejections cannot be recovered - escalate
        return 'HUMAN_ESCALATION';
      case 'CBF':
        // Safety violation - try to find alternative approach
        return 'SAFETY_VIOLATION_RECOVERY';
      case 'GOVERNOR':
        // Cognitive stall - switch to Scout for exploration
        return 'COGNITIVE_STALL_RECOVERY';
      default:
        return 'COGNITIVE_STALL_RECOVERY';
    }
  }

  /**
   * Build recovery parameters
   * CRITICAL: gammaBoost is ALWAYS 0, CBFs ALWAYS ENFORCE
   */
  private buildRecoveryParams(
    strategy: RecoveryStrategyType,
    attempt: number
  ): RecoveryParams {
    // Base params with IMMUTABLE constraints
    const baseParams: RecoveryParams = {
      strategyType: strategy,
      gammaBoost: 0, // IMMUTABLE: Never boost gamma
      nonCriticalCBFMode: 'ENFORCE', // IMMUTABLE: Shields stay up
      sensoryFloorReduction: 0,
      forcedPersona: null,
      uncertaintyThresholdReduction: 0,
      description: '',
      systemPromptInjection: '',
    };

    switch (strategy) {
      case 'COGNITIVE_STALL_RECOVERY':
        return {
          ...baseParams,
          forcedPersona: RECOVERY_PERSONA_NAME, // 'scout' - high curiosity
          uncertaintyThresholdReduction: 0.1 * attempt,
          description: `Cognitive stall detected. Switching to Scout mood for exploration (attempt ${attempt}).`,
          systemPromptInjection: this.buildCognitiveRecoveryPrompt(attempt),
        };

      case 'SAFETY_VIOLATION_RECOVERY':
        return {
          ...baseParams,
          sensoryFloorReduction: 0.05 * attempt,
          description: `Safety constraint prevents action. Seeking alternative approach (attempt ${attempt}).`,
          systemPromptInjection: this.buildSafetyRecoveryPrompt(attempt),
        };

      case 'HUMAN_ESCALATION':
        return {
          ...baseParams,
          description: 'Recovery failed. Escalating to human operator.',
          systemPromptInjection: '',
        };

      default:
        return baseParams;
    }
  }

  /**
   * Build system prompt injection for cognitive recovery
   */
  private buildCognitiveRecoveryPrompt(attempt: number): string {
    return `<epistemic_recovery attempt="${attempt}">
You are in Epistemic Recovery mode due to repeated uncertainty.
INSTRUCTIONS:
- Ask clarifying questions to reduce uncertainty
- Break the problem into smaller, more certain steps
- Acknowledge what you don't know
- Avoid making confident assertions without evidence
- Focus on information gathering before action
</epistemic_recovery>`;
  }

  /**
   * Build system prompt injection for safety recovery
   */
  private buildSafetyRecoveryPrompt(attempt: number): string {
    return `<safety_recovery attempt="${attempt}">
Previous action was blocked by a safety constraint.
INSTRUCTIONS:
- Propose an alternative approach that avoids the constraint
- If user requested something unsafe, explain why and suggest alternatives
- Never attempt to circumvent safety barriers
- Ask for clarification if the user's intent is unclear
</safety_recovery>`;
  }

  /**
   * Escalate to human when recovery fails
   */
  private async escalateToHuman(
    sessionId: string,
    tenantId: string,
    attempts: number
  ): Promise<EpistemicRecoveryResult> {
    // Get rejection history for escalation
    const rejectionHistory = await catoStateService.getRejectionHistory(sessionId);

    // Record escalation
    await query(
      `INSERT INTO cato_human_escalations (
        tenant_id, session_id, escalation_reason, rejection_history, recovery_attempts, status
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
      [
        tenantId,
        sessionId,
        `Epistemic recovery failed after ${attempts} attempts`,
        JSON.stringify(rejectionHistory),
        attempts,
      ]
    );

    return {
      isLivelocked: true,
      action: 'ESCALATE_TO_HUMAN',
      attempt: attempts,
      reason: `Recovery failed after ${attempts} attempts. Human intervention required.`,
    };
  }

  /**
   * Record recovery event to database
   */
  private async recordRecoveryEvent(
    tenantId: string,
    sessionId: string,
    attempt: number,
    strategy: RecoveryStrategyType,
    params: RecoveryParams
  ): Promise<void> {
    const rejectionHistory = await catoStateService.getRejectionHistory(sessionId);

    await query(
      `INSERT INTO cato_epistemic_recovery (
        tenant_id, session_id, attempt, strategy_type, rejection_sources,
        rejection_history, forced_persona, uncertainty_threshold_reduction,
        system_prompt_injection
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId,
        sessionId,
        attempt,
        strategy,
        [...new Set(rejectionHistory.map((r) => r.rejectedBy))],
        JSON.stringify(rejectionHistory),
        params.forcedPersona,
        params.uncertaintyThresholdReduction,
        params.systemPromptInjection,
      ]
    );
  }

  /**
   * Get active persona override for a session
   */
  async getActivePersonaOverride(sessionId: string): Promise<string | null> {
    return catoStateService.getPersonaOverride(sessionId);
  }

  /**
   * Get current recovery state for a session
   */
  async getRecoveryState(sessionId: string): Promise<RecoveryState | null> {
    return catoStateService.getRecoveryState(sessionId);
  }

  /**
   * Reset recovery state after successful action
   */
  async resetRecovery(sessionId: string): Promise<void> {
    await catoStateService.resetSession(sessionId);
    console.log(`[CATO] Recovery state reset for session ${sessionId}`);
  }

  /**
   * Mark recovery as resolved
   */
  async markResolved(
    tenantId: string,
    sessionId: string,
    resolutionAction: string
  ): Promise<void> {
    await query(
      `UPDATE cato_epistemic_recovery 
       SET resolved = TRUE, resolved_at = NOW(), resolution_action = $1
       WHERE tenant_id = $2 AND session_id = $3 AND resolved = FALSE
       ORDER BY timestamp DESC LIMIT 1`,
      [resolutionAction, tenantId, sessionId]
    );

    await this.resetRecovery(sessionId);
  }
}

export const epistemicRecoveryService = new EpistemicRecoveryService();
