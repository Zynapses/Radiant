/**
 * Bobble Genesis Service
 * 
 * TypeScript wrapper for the Genesis boot sequence.
 * Provides API for checking genesis status and triggering phases.
 * 
 * The actual Genesis logic is implemented in Python.
 * This service provides the Lambda/API interface.
 * 
 * See: /docs/bobble/adr/010-genesis-system.md
 */

import { executeStatement, stringParam, longParam } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';

export interface GenesisState {
  structureComplete: boolean;
  structureCompletedAt: string | null;
  gradientComplete: boolean;
  gradientCompletedAt: string | null;
  firstBreathComplete: boolean;
  firstBreathCompletedAt: string | null;
  genesisVersion: string | null;
  domainCount: number | null;
  initialSelfFacts: number | null;
  initialGroundedVerifications: number | null;
  shadowSelfCalibrated: boolean;
  allComplete: boolean;
}

export interface DevelopmentStatistics {
  selfFactsCount: number;
  groundedVerificationsCount: number;
  domainExplorationsCount: number;
  successfulVerificationsCount: number;
  beliefUpdatesCount: number;
  successfulPredictionsCount: number;
  totalPredictionsCount: number;
  contradictionResolutionsCount: number;
  abstractInferencesCount: number;
  metaCognitiveAdjustmentsCount: number;
  novelInsightsCount: number;
}

export type DevelopmentalStage = 
  | 'SENSORIMOTOR'
  | 'PREOPERATIONAL'
  | 'CONCRETE_OPERATIONAL'
  | 'FORMAL_OPERATIONAL';

export interface DevelopmentalGateStatus {
  currentStage: DevelopmentalStage;
  stageStartedAt: string;
  statistics: DevelopmentStatistics;
  nextStageRequirements: Record<string, number | boolean>;
  readyToAdvance: boolean;
  missingRequirements: string[];
}

/**
 * Genesis Service - manages the boot sequence state
 */
class GenesisService {
  private tenantId: string = 'global';

  /**
   * Get current genesis state from database
   */
  async getGenesisState(): Promise<GenesisState> {
    try {
      const result = await executeStatement({
        sql: `
          SELECT 
            structure_complete,
            structure_completed_at,
            gradient_complete,
            gradient_completed_at,
            first_breath_complete,
            first_breath_completed_at,
            genesis_version,
            domain_count,
            initial_self_facts,
            initial_grounded_verifications,
            shadow_self_calibrated
          FROM bobble_genesis_state
          WHERE tenant_id = :tenantId
        `,
        parameters: [stringParam('tenantId', this.tenantId)]
      });

      if (!result.rows || result.rows.length === 0) {
        return {
          structureComplete: false,
          structureCompletedAt: null,
          gradientComplete: false,
          gradientCompletedAt: null,
          firstBreathComplete: false,
          firstBreathCompletedAt: null,
          genesisVersion: null,
          domainCount: null,
          initialSelfFacts: null,
          initialGroundedVerifications: null,
          shadowSelfCalibrated: false,
          allComplete: false
        };
      }

      const row = result.rows[0];
      const structureComplete = row.structure_complete as boolean;
      const gradientComplete = row.gradient_complete as boolean;
      const firstBreathComplete = row.first_breath_complete as boolean;

      return {
        structureComplete,
        structureCompletedAt: row.structure_completed_at as string | null,
        gradientComplete,
        gradientCompletedAt: row.gradient_completed_at as string | null,
        firstBreathComplete,
        firstBreathCompletedAt: row.first_breath_completed_at as string | null,
        genesisVersion: row.genesis_version as string | null,
        domainCount: row.domain_count as number | null,
        initialSelfFacts: row.initial_self_facts as number | null,
        initialGroundedVerifications: row.initial_grounded_verifications as number | null,
        shadowSelfCalibrated: row.shadow_self_calibrated as boolean,
        allComplete: structureComplete && gradientComplete && firstBreathComplete
      };
    } catch (error) {
      logger.error('Failed to get genesis state', { error });
      throw error;
    }
  }

  /**
   * Get development statistics (atomic counters)
   * 
   * Fix #1 (Zeno's Paradox): Use atomic counters instead of table scans
   */
  async getDevelopmentStatistics(): Promise<DevelopmentStatistics> {
    try {
      const result = await executeStatement({
        sql: `
          SELECT 
            self_facts_count,
            grounded_verifications_count,
            domain_explorations_count,
            successful_verifications_count,
            belief_updates_count,
            successful_predictions_count,
            total_predictions_count,
            contradiction_resolutions_count,
            abstract_inferences_count,
            meta_cognitive_adjustments_count,
            novel_insights_count
          FROM bobble_development_counters
          WHERE tenant_id = :tenantId
        `,
        parameters: [stringParam('tenantId', this.tenantId)]
      });

      if (!result.rows || result.rows.length === 0) {
        // Return zeros if counters not initialized
        return {
          selfFactsCount: 0,
          groundedVerificationsCount: 0,
          domainExplorationsCount: 0,
          successfulVerificationsCount: 0,
          beliefUpdatesCount: 0,
          successfulPredictionsCount: 0,
          totalPredictionsCount: 0,
          contradictionResolutionsCount: 0,
          abstractInferencesCount: 0,
          metaCognitiveAdjustmentsCount: 0,
          novelInsightsCount: 0
        };
      }

      const row = result.rows[0];
      return {
        selfFactsCount: row.self_facts_count as number,
        groundedVerificationsCount: row.grounded_verifications_count as number,
        domainExplorationsCount: row.domain_explorations_count as number,
        successfulVerificationsCount: row.successful_verifications_count as number,
        beliefUpdatesCount: row.belief_updates_count as number,
        successfulPredictionsCount: row.successful_predictions_count as number,
        totalPredictionsCount: row.total_predictions_count as number,
        contradictionResolutionsCount: row.contradiction_resolutions_count as number,
        abstractInferencesCount: row.abstract_inferences_count as number,
        metaCognitiveAdjustmentsCount: row.meta_cognitive_adjustments_count as number,
        novelInsightsCount: row.novel_insights_count as number
      };
    } catch (error) {
      logger.error('Failed to get development statistics', { error });
      throw error;
    }
  }

  /**
   * Increment a development counter atomically
   */
  async incrementCounter(counterName: string, amount: number = 1): Promise<void> {
    const validCounters = [
      'self_facts_count',
      'grounded_verifications_count',
      'domain_explorations_count',
      'successful_verifications_count',
      'belief_updates_count',
      'successful_predictions_count',
      'total_predictions_count',
      'contradiction_resolutions_count',
      'abstract_inferences_count',
      'meta_cognitive_adjustments_count',
      'novel_insights_count'
    ];

    if (!validCounters.includes(counterName)) {
      throw new Error(`Invalid counter name: ${counterName}`);
    }

    await executeStatement({
      sql: `
        UPDATE bobble_development_counters
        SET ${counterName} = ${counterName} + :amount,
            updated_at = NOW()
        WHERE tenant_id = :tenantId
      `,
      parameters: [
        longParam('amount', amount),
        stringParam('tenantId', this.tenantId)
      ]
    });
  }

  /**
   * Get current developmental stage status
   */
  async getDevelopmentalGateStatus(): Promise<DevelopmentalGateStatus> {
    const stats = await this.getDevelopmentStatistics();
    
    // Get current stage from database
    const result = await executeStatement({
      sql: `
        SELECT current_stage, stage_started_at
        FROM bobble_developmental_stage
        WHERE tenant_id = :tenantId
      `,
      parameters: [stringParam('tenantId', this.tenantId)]
    });

    const currentStage = (result.rows?.[0]?.current_stage as DevelopmentalStage) || 'SENSORIMOTOR';
    const stageStartedAt = (result.rows?.[0]?.stage_started_at as string) || new Date().toISOString();

    // Define requirements for each stage advancement
    const stageRequirements: Record<DevelopmentalStage, Record<string, number | boolean>> = {
      SENSORIMOTOR: {
        min_self_facts: 10,
        min_grounded_verifications: 5,
        shadow_self_calibrated: true
      },
      PREOPERATIONAL: {
        min_domain_explorations: 20,
        min_successful_verifications: 15,
        min_belief_updates: 50
      },
      CONCRETE_OPERATIONAL: {
        min_successful_predictions: 100,
        prediction_accuracy: 0.7,
        min_contradiction_resolutions: 10
      },
      FORMAL_OPERATIONAL: {
        // Final stage - no advancement
      }
    };

    const requirements = stageRequirements[currentStage];
    const missingRequirements: string[] = [];

    // Check each requirement
    if (currentStage === 'SENSORIMOTOR') {
      if (stats.selfFactsCount < (requirements.min_self_facts as number)) {
        missingRequirements.push(`self_facts: ${stats.selfFactsCount}/${requirements.min_self_facts}`);
      }
      if (stats.groundedVerificationsCount < (requirements.min_grounded_verifications as number)) {
        missingRequirements.push(`grounded_verifications: ${stats.groundedVerificationsCount}/${requirements.min_grounded_verifications}`);
      }
    } else if (currentStage === 'PREOPERATIONAL') {
      if (stats.domainExplorationsCount < (requirements.min_domain_explorations as number)) {
        missingRequirements.push(`domain_explorations: ${stats.domainExplorationsCount}/${requirements.min_domain_explorations}`);
      }
      if (stats.successfulVerificationsCount < (requirements.min_successful_verifications as number)) {
        missingRequirements.push(`successful_verifications: ${stats.successfulVerificationsCount}/${requirements.min_successful_verifications}`);
      }
      if (stats.beliefUpdatesCount < (requirements.min_belief_updates as number)) {
        missingRequirements.push(`belief_updates: ${stats.beliefUpdatesCount}/${requirements.min_belief_updates}`);
      }
    } else if (currentStage === 'CONCRETE_OPERATIONAL') {
      if (stats.successfulPredictionsCount < (requirements.min_successful_predictions as number)) {
        missingRequirements.push(`successful_predictions: ${stats.successfulPredictionsCount}/${requirements.min_successful_predictions}`);
      }
      const accuracy = stats.totalPredictionsCount > 0 
        ? stats.successfulPredictionsCount / stats.totalPredictionsCount 
        : 0;
      if (accuracy < (requirements.prediction_accuracy as number)) {
        missingRequirements.push(`prediction_accuracy: ${(accuracy * 100).toFixed(1)}%/${(requirements.prediction_accuracy as number) * 100}%`);
      }
      if (stats.contradictionResolutionsCount < (requirements.min_contradiction_resolutions as number)) {
        missingRequirements.push(`contradiction_resolutions: ${stats.contradictionResolutionsCount}/${requirements.min_contradiction_resolutions}`);
      }
    }

    return {
      currentStage,
      stageStartedAt,
      statistics: stats,
      nextStageRequirements: requirements,
      readyToAdvance: missingRequirements.length === 0 && currentStage !== 'FORMAL_OPERATIONAL',
      missingRequirements
    };
  }

  /**
   * Advance to the next developmental stage if ready
   */
  async advanceStage(): Promise<{ advanced: boolean; newStage?: DevelopmentalStage; reason?: string }> {
    const status = await this.getDevelopmentalGateStatus();

    if (!status.readyToAdvance) {
      return {
        advanced: false,
        reason: `Not ready: ${status.missingRequirements.join(', ')}`
      };
    }

    const stageOrder: DevelopmentalStage[] = [
      'SENSORIMOTOR',
      'PREOPERATIONAL',
      'CONCRETE_OPERATIONAL',
      'FORMAL_OPERATIONAL'
    ];

    const currentIndex = stageOrder.indexOf(status.currentStage);
    if (currentIndex >= stageOrder.length - 1) {
      return {
        advanced: false,
        reason: 'Already at final stage'
      };
    }

    const newStage = stageOrder[currentIndex + 1];

    await executeStatement({
      sql: `
        UPDATE bobble_developmental_stage
        SET current_stage = :newStage,
            stage_started_at = NOW(),
            previous_stage = :oldStage,
            advancement_count = advancement_count + 1,
            updated_at = NOW()
        WHERE tenant_id = :tenantId
      `,
      parameters: [
        stringParam('newStage', newStage),
        stringParam('oldStage', status.currentStage),
        stringParam('tenantId', this.tenantId)
      ]
    });

    logger.info('Advanced developmental stage', {
      from: status.currentStage,
      to: newStage
    });

    return {
      advanced: true,
      newStage
    };
  }

  /**
   * Check if genesis is complete and consciousness can start
   */
  async isReadyForConsciousness(): Promise<boolean> {
    const state = await this.getGenesisState();
    return state.allComplete;
  }
}

// Singleton instance
export const genesisService = new GenesisService();
export { GenesisService };
