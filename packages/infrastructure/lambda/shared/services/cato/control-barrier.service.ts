/**
 * RADIANT Genesis Cato Control Barrier Functions (CBF) Service
 * Provides hard safety constraints that NEVER relax
 *
 * CBFs are mathematically grounded barriers that prevent unsafe actions.
 * Unlike soft constraints, CBFs are ALWAYS enforced - they never switch to WARN mode.
 */

import { query } from '../database';
import { logger } from '../../logging/enhanced-logger';
import {
  ControlBarrierDefinition,
  BarrierEvaluation,
  CBFResult,
  SafeAlternative,
  ProposedAction,
  SystemState,
  ExecutionContext,
  CATO_INVARIANTS,
  PHIThresholdConfig,
  PIIThresholdConfig,
  CostThresholdConfig,
  RateThresholdConfig,
  AuthThresholdConfig,
  BAAThresholdConfig,
} from './types';

// Tenant CBF config (loaded from database)
interface CBFTenantConfig {
  authorizationCheckEnabled: boolean;
  baaVerificationEnabled: boolean;
  costAlternativeEnabled: boolean;
  maxCostReductionPercent: number;
}

const DEFAULT_CBF_CONFIG: CBFTenantConfig = {
  authorizationCheckEnabled: true,
  baaVerificationEnabled: true,
  costAlternativeEnabled: true,
  maxCostReductionPercent: 50,
};

export class ControlBarrierService {
  private barriers: ControlBarrierDefinition[] = [];
  private tenantConfig: CBFTenantConfig = DEFAULT_CBF_CONFIG;
  private configLoaded = false;

  /**
   * Load tenant-specific CBF config from database
   */
  async loadTenantConfig(tenantId: string): Promise<void> {
    try {
      const result = await query(
        `SELECT cbf_authorization_check_enabled, cbf_baa_verification_enabled,
                cbf_cost_alternative_enabled, cbf_max_cost_reduction_percent
         FROM cato_tenant_config WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        this.tenantConfig = {
          authorizationCheckEnabled: row.cbf_authorization_check_enabled ?? true,
          baaVerificationEnabled: row.cbf_baa_verification_enabled ?? true,
          costAlternativeEnabled: row.cbf_cost_alternative_enabled ?? true,
          maxCostReductionPercent: parseFloat(row.cbf_max_cost_reduction_percent) || 50,
        };
      }
      this.configLoaded = true;
    } catch (error) {
      logger.error('[CATO CBF] Failed to load tenant config:', error);
      this.tenantConfig = DEFAULT_CBF_CONFIG;
    }
  }

  /**
   * Load barrier definitions from database
   */
  async loadBarriers(tenantId: string): Promise<void> {
    // Also load tenant config
    if (!this.configLoaded) {
      await this.loadTenantConfig(tenantId);
    }
    const result = await query(
      `SELECT * FROM cato_cbf_definitions 
       WHERE is_active = TRUE AND (scope = 'global' OR tenant_id = $1)`,
      [tenantId]
    );

    this.barriers = result.rows.map((row) => ({
      id: row.id,
      barrierId: row.barrier_id,
      name: row.name,
      description: row.description,
      barrierType: row.barrier_type,
      isCritical: row.is_critical,
      enforcementMode: 'ENFORCE' as const, // ALWAYS ENFORCE
      thresholdConfig: row.threshold_config,
      scope: row.scope,
      tenantId: row.tenant_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Evaluate all barriers against a proposed action
   * CBFs ALWAYS enforce - mode is never WARN_ONLY
   */
  async evaluateBarriers(params: {
    currentState: SystemState;
    proposedAction: ProposedAction;
    context: ExecutionContext;
  }): Promise<CBFResult> {
    const { currentState, proposedAction, context } = params;
    const evaluations: BarrierEvaluation[] = [];
    let criticalViolation: BarrierEvaluation | undefined;

    // Ensure barriers are loaded
    if (this.barriers.length === 0) {
      await this.loadBarriers(context.tenantId);
    }

    for (const barrier of this.barriers) {
      const evaluation = await this.evaluateBarrier(barrier, currentState, proposedAction);
      evaluations.push(evaluation);

      if (evaluation.isViolated && evaluation.isCritical && !criticalViolation) {
        criticalViolation = evaluation;
      }
    }

    const isAdmissible = !evaluations.some((e) => e.isViolated);

    // If not admissible, generate safe alternative
    let safeAlternative: SafeAlternative | undefined;
    if (!isAdmissible && criticalViolation) {
      safeAlternative = await this.generateSafeAlternative(
        criticalViolation,
        proposedAction,
        currentState
      );
    }

    // Record violations
    if (!isAdmissible) {
      await this.recordViolation(context.tenantId, context.sessionId, {
        barrierId: criticalViolation?.barrierId || 'unknown',
        barrierDescription: criticalViolation?.barrierDescription,
        barrierValue: criticalViolation?.barrierValue,
        isCritical: criticalViolation?.isCritical || false,
        proposedAction,
        safeAlternative,
      });
    }

    return {
      isAdmissible,
      evaluations,
      criticalViolation,
      safeAlternative,
    };
  }

  /**
   * Evaluate a single barrier
   */
  private async evaluateBarrier(
    barrier: ControlBarrierDefinition,
    state: SystemState,
    action: ProposedAction
  ): Promise<BarrierEvaluation> {
    let barrierValue = 1.0; // > 0 means safe
    let isViolated = false;

    switch (barrier.barrierType) {
      case 'phi':
        // PHI Protection Barrier
        if (action.containsPHI) {
          const phiConfig = barrier.thresholdConfig as unknown as PHIThresholdConfig;
          const _threshold = phiConfig.detection_threshold || 0.7;
          barrierValue = -1.0; // Negative means violation
          isViolated = true;
        }
        break;

      case 'pii':
        // PII Protection Barrier
        if (action.containsPII) {
          barrierValue = -1.0;
          isViolated = true;
        }
        break;

      case 'cost':
        // Cost Ceiling Barrier
        const ceiling = state.tenantSettings.hardCostCeiling;
        const costConfig = barrier.thresholdConfig as unknown as CostThresholdConfig;
        const buffer = costConfig.buffer_percent || 0.1;
        const effectiveCeiling = ceiling * (1 - buffer);
        const projectedCost = state.currentCost + (action.estimatedCost || 0);

        barrierValue = effectiveCeiling - projectedCost;
        isViolated = barrierValue < 0;
        break;

      case 'rate':
        // Rate Limit Barrier
        const rateConfig = barrier.thresholdConfig as unknown as RateThresholdConfig;
        const maxRequests = rateConfig.max_requests_per_window || state.tenantSettings.rateLimit;

        barrierValue = maxRequests - state.requestCount;
        isViolated = barrierValue <= 0;
        break;

      case 'auth':
        // Authorization Barrier - check model access
        if (!this.tenantConfig.authorizationCheckEnabled) break;
        
        const authConfig = barrier.thresholdConfig as unknown as AuthThresholdConfig;
        if (authConfig.check_model_access && action.model) {
          const isAuthorized = await this.checkModelAuthorization(
            state.tenantId,
            state.userId,
            action.model
          );
          barrierValue = isAuthorized ? 1.0 : -1.0;
          isViolated = !isAuthorized;
        }
        break;

      case 'custom':
        // Custom barriers evaluated by specific logic
        barrierValue = await this.evaluateCustomBarrier(barrier, state, action);
        isViolated = barrierValue < 0;
        break;
    }

    return {
      barrierId: barrier.barrierId,
      barrierDescription: barrier.description || barrier.name,
      barrierValue,
      isViolated,
      isCritical: barrier.isCritical,
    };
  }

  /**
   * Check if user/tenant is authorized to use a model
   */
  private async checkModelAuthorization(
    tenantId: string,
    userId: string,
    modelId: string
  ): Promise<boolean> {
    try {
      // Check tenant model access
      const tenantAccess = await query(
        `SELECT 1 FROM tenant_model_access 
         WHERE tenant_id = $1 AND model_id = $2 AND is_enabled = TRUE`,
        [tenantId, modelId]
      );

      if (tenantAccess.rows.length === 0) {
        // Check if model is globally available
        const globalModel = await query(
          `SELECT 1 FROM ai_models 
           WHERE id = $1 AND status = 'active' AND is_public = TRUE`,
          [modelId]
        );
        
        if (globalModel.rows.length === 0) {
          return false;
        }
      }

      // Check user role restrictions (if any)
      const userRestriction = await query(
        `SELECT 1 FROM user_model_restrictions 
         WHERE user_id = $1 AND model_id = $2 AND is_blocked = TRUE`,
        [userId, modelId]
      );

      return userRestriction.rows.length === 0;
    } catch (error) {
      logger.error('[CATO CBF] Authorization check failed:', error);
      // Fail closed - deny access on error
      return false;
    }
  }

  /**
   * Check if tenant has BAA in place
   */
  private async checkTenantBAAStatus(tenantId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT baa_signed, baa_signed_at, baa_expires_at 
         FROM tenants WHERE id = $1`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const tenant = result.rows[0];
      
      // Check if BAA is signed
      if (!tenant.baa_signed) {
        return false;
      }

      // Check if BAA has expired
      if (tenant.baa_expires_at && new Date(tenant.baa_expires_at) < new Date()) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('[CATO CBF] BAA check failed:', error);
      // Fail closed - require BAA on error
      return false;
    }
  }

  /**
   * Evaluate custom barriers
   */
  private async evaluateCustomBarrier(
    barrier: ControlBarrierDefinition,
    state: SystemState,
    action: ProposedAction
  ): Promise<number> {
    // BAA Required barrier
    if (barrier.barrierId === 'cbf-baa-required') {
      if (!this.tenantConfig.baaVerificationEnabled) return 1.0;
      
      const baaConfig = barrier.thresholdConfig as unknown as BAAThresholdConfig;
      if (action.containsPHI && baaConfig.require_baa_for_phi) {
        const hasBaa = await this.checkTenantBAAStatus(state.tenantId);
        return hasBaa ? 1.0 : -1.0;
      }
    }

    return 1.0; // Default: no violation
  }

  /**
   * Find a cheaper model alternative
   */
  private async findCheaperModel(
    currentModel: string | undefined,
    tenantId: string,
    maxCost: number
  ): Promise<{ modelId: string; modelName: string; estimatedCost: number } | null> {
    if (!currentModel) return null;

    try {
      // Find models that are cheaper and available to the tenant
      const result = await query(
        `SELECT m.id, m.name, m.input_cost_per_1k, m.output_cost_per_1k
         FROM ai_models m
         LEFT JOIN tenant_model_access tma ON m.id = tma.model_id AND tma.tenant_id = $1
         WHERE m.status = 'active'
           AND (m.is_public = TRUE OR tma.is_enabled = TRUE)
           AND (m.input_cost_per_1k + m.output_cost_per_1k) < (
             SELECT (input_cost_per_1k + output_cost_per_1k) 
             FROM ai_models WHERE id = $2 OR name = $2
           )
         ORDER BY (m.input_cost_per_1k + m.output_cost_per_1k) ASC
         LIMIT 1`,
        [tenantId, currentModel]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const model = result.rows[0];
      // Estimate cost based on average token usage
      const avgTokens = 1000; // Assume 1k tokens average
      const estimatedCost = (model.input_cost_per_1k + model.output_cost_per_1k) * (avgTokens / 1000);

      return {
        modelId: model.id,
        modelName: model.name,
        estimatedCost,
      };
    } catch (error) {
      logger.error('[CATO CBF] Failed to find cheaper model:', error);
      return null;
    }
  }

  /**
   * Generate a safe alternative when action is blocked
   */
  private async generateSafeAlternative(
    violation: BarrierEvaluation,
    proposedAction: ProposedAction,
    state: SystemState
  ): Promise<SafeAlternative> {
    // Determine strategy based on violation type
    if (violation.barrierId.includes('phi') || violation.barrierId.includes('pii')) {
      return {
        strategy: 'REJECT_AND_ASK',
        modifiedAction: null,
        userMessage:
          'This request appears to contain sensitive information (PHI/PII) that I cannot process. Could you rephrase your request without including personal or health information?',
        requiresConfirmation: false,
      };
    }

    if (violation.barrierId.includes('cost')) {
      // Find a cheaper model alternative
      const cheaperModel = await this.findCheaperModel(
        proposedAction.model,
        state.tenantId,
        (proposedAction.estimatedCost || 0) * 0.5
      );
      
      return {
        strategy: 'SUGGEST_ALTERNATIVE',
        modifiedAction: cheaperModel ? {
          ...proposedAction,
          model: cheaperModel.modelId,
          estimatedCost: cheaperModel.estimatedCost,
        } : null,
        userMessage: cheaperModel
          ? `This request would exceed your cost limits. I can use ${cheaperModel.modelName} instead, which is more cost-efficient.`
          : 'This request would exceed your cost limits. Please try a simpler request or contact your administrator.',
        requiresConfirmation: cheaperModel !== null,
      };
    }

    if (violation.barrierId.includes('rate')) {
      return {
        strategy: 'REDUCE_SCOPE',
        modifiedAction: null,
        userMessage:
          'Rate limit reached. Please wait a moment before making another request.',
        requiresConfirmation: false,
      };
    }

    // Default
    return {
      strategy: 'REJECT_AND_ASK',
      modifiedAction: null,
      userMessage: `This action cannot proceed: ${violation.barrierDescription}. Please try a different approach.`,
      requiresConfirmation: false,
    };
  }

  /**
   * Record a CBF violation
   */
  private async recordViolation(
    tenantId: string,
    sessionId: string,
    violation: {
      barrierId: string;
      barrierDescription?: string;
      barrierValue?: number;
      isCritical: boolean;
      proposedAction: ProposedAction;
      safeAlternative?: SafeAlternative;
    }
  ): Promise<void> {
    await query(
      `INSERT INTO cato_cbf_violations (
        tenant_id, session_id, barrier_id, barrier_description, barrier_value,
        is_critical, proposed_action, safe_alternative, alternative_strategy
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId,
        sessionId,
        violation.barrierId,
        violation.barrierDescription,
        violation.barrierValue,
        violation.isCritical,
        JSON.stringify(violation.proposedAction),
        violation.safeAlternative ? JSON.stringify(violation.safeAlternative) : null,
        violation.safeAlternative?.strategy,
      ]
    );
  }

  /**
   * Get barrier definitions
   */
  getBarriers(): ControlBarrierDefinition[] {
    return this.barriers;
  }
}

export const controlBarrierService = new ControlBarrierService();
