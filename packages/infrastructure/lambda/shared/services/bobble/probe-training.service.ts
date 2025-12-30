/**
 * Shadow Self Probe Training Data Collection Service
 * 
 * Collects labeled examples for training probing classifiers that verify
 * structural correspondence between claimed cognitive states and actual
 * neural activations (simulated via context patterns).
 * 
 * The pipeline:
 * 1. Collect introspection samples with user feedback
 * 2. Label samples based on verification outcomes
 * 3. Build training datasets per claim type
 * 4. Trigger probe retraining when sufficient data accumulates
 */

import { logger } from '../../logger';
import { executeStatement, stringParam, longParam, doubleParam } from '../../db/client';
import { ShadowSelfService } from './verification/shadow-self.service';

export interface TrainingExample {
  exampleId: string;
  tenantId: string;
  claimType: string;
  context: string;
  claimedState: string;
  actualOutcome: 'verified' | 'refuted' | 'uncertain';
  confidenceScore: number;
  userFeedback?: 'accurate' | 'inaccurate' | 'unsure';
  verificationPhasesPassed: number;
  groundingScore: number;
  consistencyScore: number;
  createdAt: Date;
}

export interface TrainingDataset {
  claimType: string;
  tenantId: string;
  examples: TrainingExample[];
  positiveCount: number;
  negativeCount: number;
  readyForTraining: boolean;
  lastTrainedAt?: Date;
}

export interface CollectionConfig {
  minExamplesPerType: number;
  minPositiveRatio: number;
  maxPositiveRatio: number;
  exampleExpiryDays: number;
  autoTrainEnabled: boolean;
  autoTrainThreshold: number;
}

const DEFAULT_CONFIG: CollectionConfig = {
  minExamplesPerType: 50,
  minPositiveRatio: 0.3,
  maxPositiveRatio: 0.7,
  exampleExpiryDays: 90,
  autoTrainEnabled: true,
  autoTrainThreshold: 100,
};

export class ProbeTrainingService {
  private tenantId: string;
  private config: CollectionConfig;
  private shadowService: ShadowSelfService;

  constructor(tenantId: string, config?: Partial<CollectionConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.shadowService = new ShadowSelfService(tenantId);
  }

  /**
   * Record a new training example from a dialogue interaction
   */
  async recordExample(params: {
    claimType: string;
    context: string;
    claimedState: string;
    actualOutcome: 'verified' | 'refuted' | 'uncertain';
    confidenceScore: number;
    verificationPhasesPassed: number;
    groundingScore: number;
    consistencyScore: number;
  }): Promise<string> {
    const exampleId = crypto.randomUUID();

    await executeStatement(
      `INSERT INTO bobble_probe_training_examples 
       (example_id, tenant_id, claim_type, context, claimed_state, actual_outcome,
        confidence_score, verification_phases_passed, grounding_score, consistency_score, created_at)
       VALUES (:exampleId, :tenantId, :claimType, :context, :claimedState, :outcome,
               :confidence, :phases, :grounding, :consistency, NOW())`,
      [
        stringParam('exampleId', exampleId),
        stringParam('tenantId', this.tenantId),
        stringParam('claimType', params.claimType),
        stringParam('context', params.context),
        stringParam('claimedState', params.claimedState),
        stringParam('outcome', params.actualOutcome),
        doubleParam('confidence', params.confidenceScore),
        longParam('phases', params.verificationPhasesPassed),
        doubleParam('grounding', params.groundingScore),
        doubleParam('consistency', params.consistencyScore),
      ]
    );

    logger.info('Recorded probe training example', {
      tenantId: this.tenantId,
      exampleId,
      claimType: params.claimType,
      outcome: params.actualOutcome,
    });

    // Check if we should auto-train
    if (this.config.autoTrainEnabled) {
      await this.checkAutoTrain(params.claimType);
    }

    return exampleId;
  }

  /**
   * Add user feedback to an existing example
   */
  async addUserFeedback(
    exampleId: string,
    feedback: 'accurate' | 'inaccurate' | 'unsure'
  ): Promise<void> {
    await executeStatement(
      `UPDATE bobble_probe_training_examples 
       SET user_feedback = :feedback, updated_at = NOW()
       WHERE example_id = :exampleId AND tenant_id = :tenantId`,
      [
        stringParam('feedback', feedback),
        stringParam('exampleId', exampleId),
        stringParam('tenantId', this.tenantId),
      ]
    );

    logger.info('Added user feedback to training example', {
      tenantId: this.tenantId,
      exampleId,
      feedback,
    });
  }

  /**
   * Get training dataset for a specific claim type
   */
  async getDataset(claimType: string): Promise<TrainingDataset> {
    interface ExampleRow {
      example_id: string;
      claim_type: string;
      context: string;
      claimed_state: string;
      actual_outcome: string;
      confidence_score: number;
      user_feedback: string | null;
      verification_phases_passed: number;
      grounding_score: number;
      consistency_score: number;
      created_at: string;
    }

    const expiryDate = new Date(Date.now() - this.config.exampleExpiryDays * 24 * 60 * 60 * 1000);

    const result = await executeStatement<ExampleRow>(
      `SELECT * FROM bobble_probe_training_examples
       WHERE tenant_id = :tenantId 
         AND claim_type = :claimType
         AND created_at > :expiry
       ORDER BY created_at DESC`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('claimType', claimType),
        stringParam('expiry', expiryDate.toISOString()),
      ]
    );

    const examples: TrainingExample[] = result.rows.map(row => ({
      exampleId: row.example_id,
      tenantId: this.tenantId,
      claimType: row.claim_type,
      context: row.context,
      claimedState: row.claimed_state,
      actualOutcome: row.actual_outcome as 'verified' | 'refuted' | 'uncertain',
      confidenceScore: row.confidence_score,
      userFeedback: row.user_feedback as 'accurate' | 'inaccurate' | 'unsure' | undefined,
      verificationPhasesPassed: row.verification_phases_passed,
      groundingScore: row.grounding_score,
      consistencyScore: row.consistency_score,
      createdAt: new Date(row.created_at),
    }));

    // Count positive (verified) and negative (refuted) examples
    const positiveCount = examples.filter(e => e.actualOutcome === 'verified').length;
    const negativeCount = examples.filter(e => e.actualOutcome === 'refuted').length;
    const totalLabeled = positiveCount + negativeCount;

    // Check if dataset is ready for training
    const positiveRatio = totalLabeled > 0 ? positiveCount / totalLabeled : 0;
    const readyForTraining = 
      totalLabeled >= this.config.minExamplesPerType &&
      positiveRatio >= this.config.minPositiveRatio &&
      positiveRatio <= this.config.maxPositiveRatio;

    // Get last trained time
    interface ProbeRow { updated_at: string }
    const probeResult = await executeStatement<ProbeRow>(
      `SELECT updated_at FROM bobble_shadow_probes
       WHERE tenant_id = :tenantId AND claim_type = :claimType`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('claimType', claimType),
      ]
    );

    return {
      claimType,
      tenantId: this.tenantId,
      examples,
      positiveCount,
      negativeCount,
      readyForTraining,
      lastTrainedAt: probeResult.rows[0]?.updated_at 
        ? new Date(probeResult.rows[0].updated_at) 
        : undefined,
    };
  }

  /**
   * Get summary of all claim types and their training status
   */
  async getTrainingSummary(): Promise<Array<{
    claimType: string;
    exampleCount: number;
    positiveCount: number;
    negativeCount: number;
    readyForTraining: boolean;
    lastTrainedAt?: Date;
  }>> {
    interface SummaryRow {
      claim_type: string;
      total: number;
      verified: number;
      refuted: number;
    }

    const result = await executeStatement<SummaryRow>(
      `SELECT 
         claim_type,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE actual_outcome = 'verified') as verified,
         COUNT(*) FILTER (WHERE actual_outcome = 'refuted') as refuted
       FROM bobble_probe_training_examples
       WHERE tenant_id = :tenantId
         AND created_at > :expiry
       GROUP BY claim_type`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('expiry', new Date(Date.now() - this.config.exampleExpiryDays * 24 * 60 * 60 * 1000).toISOString()),
      ]
    );

    return result.rows.map(row => {
      const totalLabeled = Number(row.verified) + Number(row.refuted);
      const positiveRatio = totalLabeled > 0 ? Number(row.verified) / totalLabeled : 0;

      return {
        claimType: row.claim_type,
        exampleCount: Number(row.total),
        positiveCount: Number(row.verified),
        negativeCount: Number(row.refuted),
        readyForTraining: 
          totalLabeled >= this.config.minExamplesPerType &&
          positiveRatio >= this.config.minPositiveRatio &&
          positiveRatio <= this.config.maxPositiveRatio,
      };
    });
  }

  /**
   * Check if auto-training should be triggered
   */
  private async checkAutoTrain(claimType: string): Promise<void> {
    const dataset = await this.getDataset(claimType);

    if (!dataset.readyForTraining) {
      return;
    }

    const totalLabeled = dataset.positiveCount + dataset.negativeCount;
    if (totalLabeled < this.config.autoTrainThreshold) {
      return;
    }

    // Check if we've trained recently
    if (dataset.lastTrainedAt) {
      const hoursSinceTraining = (Date.now() - dataset.lastTrainedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceTraining < 24) {
        return; // Don't retrain more than once per day
      }
    }

    logger.info('Auto-training probe triggered', {
      tenantId: this.tenantId,
      claimType,
      exampleCount: totalLabeled,
    });

    await this.trainProbe(claimType);
  }

  /**
   * Train or retrain a probe for a specific claim type
   */
  async trainProbe(claimType: string): Promise<{
    success: boolean;
    accuracy: number;
    examplesUsed: number;
  }> {
    const dataset = await this.getDataset(claimType);

    if (dataset.examples.length < this.config.minExamplesPerType) {
      logger.warn('Insufficient training examples', {
        tenantId: this.tenantId,
        claimType,
        available: dataset.examples.length,
        required: this.config.minExamplesPerType,
      });
      return { success: false, accuracy: 0, examplesUsed: 0 };
    }

    // Prepare training data
    const trainingContexts = dataset.examples.map(e => e.context);
    const labels = dataset.examples.map(e => {
      // Convert outcome to label based on user feedback if available
      if (e.userFeedback === 'accurate') return e.claimedState;
      if (e.userFeedback === 'inaccurate') return 'incorrect_' + e.claimedState;
      return e.actualOutcome === 'verified' ? e.claimedState : 'unverified';
    });

    // Train the probe
    const result = await this.shadowService.trainProbe({
      claimType,
      trainingContexts,
      labels,
    });

    // Record training event
    await executeStatement(
      `INSERT INTO bobble_probe_training_events
       (tenant_id, claim_type, examples_used, accuracy, created_at)
       VALUES (:tenantId, :claimType, :examples, :accuracy, NOW())`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('claimType', claimType),
        longParam('examples', dataset.examples.length),
        doubleParam('accuracy', result.accuracy),
      ]
    );

    logger.info('Probe training completed', {
      tenantId: this.tenantId,
      claimType,
      success: result.success,
      accuracy: result.accuracy,
      examplesUsed: dataset.examples.length,
    });

    return {
      success: result.success,
      accuracy: result.accuracy,
      examplesUsed: dataset.examples.length,
    };
  }

  /**
   * Clean up expired training examples
   */
  async cleanupExpiredExamples(): Promise<number> {
    const expiryDate = new Date(Date.now() - this.config.exampleExpiryDays * 24 * 60 * 60 * 1000);

    const result = await executeStatement(
      `DELETE FROM bobble_probe_training_examples
       WHERE tenant_id = :tenantId AND created_at < :expiry`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('expiry', expiryDate.toISOString()),
      ]
    );

    logger.info('Cleaned up expired training examples', {
      tenantId: this.tenantId,
      deletedCount: result.rowCount,
    });

    return result.rowCount;
  }

  /**
   * Export training data for external analysis
   */
  async exportTrainingData(claimType?: string): Promise<{
    exportedAt: string;
    tenantId: string;
    claimTypes: string[];
    examples: TrainingExample[];
  }> {
    interface ExampleRow {
      example_id: string;
      claim_type: string;
      context: string;
      claimed_state: string;
      actual_outcome: string;
      confidence_score: number;
      user_feedback: string | null;
      verification_phases_passed: number;
      grounding_score: number;
      consistency_score: number;
      created_at: string;
    }

    const query = claimType
      ? `SELECT * FROM bobble_probe_training_examples
         WHERE tenant_id = :tenantId AND claim_type = :claimType
         ORDER BY created_at DESC`
      : `SELECT * FROM bobble_probe_training_examples
         WHERE tenant_id = :tenantId
         ORDER BY claim_type, created_at DESC`;

    const params = claimType
      ? [stringParam('tenantId', this.tenantId), stringParam('claimType', claimType)]
      : [stringParam('tenantId', this.tenantId)];

    const result = await executeStatement<ExampleRow>(query, params);

    const examples: TrainingExample[] = result.rows.map(row => ({
      exampleId: row.example_id,
      tenantId: this.tenantId,
      claimType: row.claim_type,
      context: row.context,
      claimedState: row.claimed_state,
      actualOutcome: row.actual_outcome as 'verified' | 'refuted' | 'uncertain',
      confidenceScore: row.confidence_score,
      userFeedback: row.user_feedback as 'accurate' | 'inaccurate' | 'unsure' | undefined,
      verificationPhasesPassed: row.verification_phases_passed,
      groundingScore: row.grounding_score,
      consistencyScore: row.consistency_score,
      createdAt: new Date(row.created_at),
    }));

    const claimTypes = [...new Set(examples.map(e => e.claimType))];

    return {
      exportedAt: new Date().toISOString(),
      tenantId: this.tenantId,
      claimTypes,
      examples,
    };
  }
}

export function createProbeTrainingService(
  tenantId: string,
  config?: Partial<CollectionConfig>
): ProbeTrainingService {
  return new ProbeTrainingService(tenantId, config);
}
