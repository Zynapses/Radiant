// RADIANT v5.12.0 - DPO Trainer Service
// Direct Preference Optimization for Cato LoRA training
// Uses Winner/Loser pairs from skeletonized episodes

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { skeletonizerService, SkeletonizedEpisode } from './skeletonizer.service';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface DPOPair {
  pair_id: string;
  chosen_skeleton_id: string;
  rejected_skeleton_id: string;
  goal_skeleton: string;
  chosen_response: string;
  rejected_response: string;
  margin: number;
  used_in_training: boolean;
  training_batch_id?: string;
  created_at: Date;
}

export interface DPOTrainingBatch {
  batch_id: string;
  pairs: DPOPair[];
  created_at: Date;
  status: 'pending' | 'training' | 'completed' | 'failed';
  model_checkpoint?: string;
  metrics?: DPOTrainingMetrics;
}

export interface DPOTrainingMetrics {
  loss: number;
  accuracy: number;
  reward_margin: number;
  training_duration_ms: number;
}

export interface DPOConfig {
  beta: number;
  learning_rate: number;
  batch_size: number;
  max_pairs_per_batch: number;
  min_margin: number;
}

// ============================================================================
// DPO Trainer Service
// ============================================================================

class DPOTrainerService {
  private readonly defaultConfig: DPOConfig = {
    beta: 0.1,
    learning_rate: 1e-6,
    batch_size: 4,
    max_pairs_per_batch: 100,
    min_margin: 0.3,
  };

  /**
   * Create DPO training pairs from skeletonized episodes
   */
  async createTrainingPairs(limit: number = 100): Promise<DPOPair[]> {
    const pairs = await skeletonizerService.getSkeletonizedPairs(limit);
    const createdPairs: DPOPair[] = [];

    for (const { chosen, rejected } of pairs) {
      const margin = this.calculateMargin(chosen, rejected);

      if (margin >= this.defaultConfig.min_margin) {
        const pair = await this.savePair(chosen, rejected, margin);
        createdPairs.push(pair);
      }
    }

    logger.info('DPO training pairs created', { count: createdPairs.length });
    return createdPairs;
  }

  /**
   * Get unused training pairs for next batch
   */
  async getUnusedPairs(limit: number = 100): Promise<DPOPair[]> {
    const result = await executeStatement(
      `SELECT * FROM dpo_training_pairs 
       WHERE used_in_training = false 
       ORDER BY margin DESC, created_at DESC 
       LIMIT $1`,
      [longParam('limit', limit)]
    );

    return this.parsePairRows(result.rows || []);
  }

  /**
   * Create a training batch
   */
  async createBatch(pairIds: string[]): Promise<string> {
    const batchId = uuidv4();

    await executeStatement(
      `UPDATE dpo_training_pairs 
       SET training_batch_id = $1, used_in_training = true 
       WHERE pair_id = ANY($2::uuid[])`,
      [
        stringParam('batchId', batchId),
        stringParam('pairIds', `{${pairIds.join(',')}}`),
      ]
    );

    await executeStatement(
      `INSERT INTO dpo_training_batches (
        batch_id, pair_count, status, created_at
      ) VALUES ($1, $2, 'pending', NOW())`,
      [
        stringParam('batchId', batchId),
        longParam('pairCount', pairIds.length),
      ]
    );

    logger.info('DPO training batch created', { batchId, pairCount: pairIds.length });
    return batchId;
  }

  /**
   * Generate training data in the format expected by DPO trainers
   */
  async generateTrainingData(batchId: string): Promise<{
    prompt: string;
    chosen: string;
    rejected: string;
  }[]> {
    const result = await executeStatement(
      `SELECT * FROM dpo_training_pairs WHERE training_batch_id = $1`,
      [stringParam('batchId', batchId)]
    );

    const pairs = this.parsePairRows(result.rows || []);

    return pairs.map((pair) => ({
      prompt: this.formatPrompt(pair.goal_skeleton),
      chosen: pair.chosen_response,
      rejected: pair.rejected_response,
    }));
  }

  /**
   * Update batch status after training
   */
  async updateBatchStatus(
    batchId: string,
    status: 'training' | 'completed' | 'failed',
    metrics?: DPOTrainingMetrics,
    modelCheckpoint?: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE dpo_training_batches 
       SET status = $2, metrics = $3, model_checkpoint = $4, completed_at = NOW()
       WHERE batch_id = $1`,
      [
        stringParam('batchId', batchId),
        stringParam('status', status),
        stringParam('metrics', JSON.stringify(metrics || {})),
        stringParam('checkpoint', modelCheckpoint || ''),
      ]
    );
  }

  /**
   * Run nightly DPO training job
   * This prepares data for the actual training which happens on SageMaker
   */
  async runNightlyJob(): Promise<{
    pairsCreated: number;
    batchId: string | null;
  }> {
    // Step 1: Create new pairs from recent episodes
    const newPairs = await this.createTrainingPairs(this.defaultConfig.max_pairs_per_batch);

    // Step 2: Get all unused pairs
    const unusedPairs = await this.getUnusedPairs(this.defaultConfig.max_pairs_per_batch);

    if (unusedPairs.length < 10) {
      logger.info('Not enough pairs for DPO training', { unusedCount: unusedPairs.length });
      return { pairsCreated: newPairs.length, batchId: null };
    }

    // Step 3: Create batch
    const pairIds = unusedPairs.map((p) => p.pair_id);
    const batchId = await this.createBatch(pairIds);

    // Step 4: Generate training data
    const trainingData = await this.generateTrainingData(batchId);

    // Step 5: Save training data to S3 (simulated)
    await this.saveTrainingDataToS3(batchId, trainingData);

    logger.info('Nightly DPO job completed', {
      pairsCreated: newPairs.length,
      batchId,
      batchSize: pairIds.length,
    });

    return { pairsCreated: newPairs.length, batchId };
  }

  /**
   * Get training statistics for dashboard
   */
  async getTrainingStats(): Promise<{
    totalPairs: number;
    unusedPairs: number;
    completedBatches: number;
    avgAccuracy: number;
  }> {
    const pairsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE used_in_training = false) as unused
       FROM dpo_training_pairs`,
      []
    );

    const batchesResult = await executeStatement(
      `SELECT 
        COUNT(*) as completed,
        AVG((metrics->>'accuracy')::DECIMAL) as avg_accuracy
       FROM dpo_training_batches
       WHERE status = 'completed'`,
      []
    );

    const pairs = pairsResult.rows?.[0] as { total: number; unused: number } | undefined;
    const batches = batchesResult.rows?.[0] as { completed: number; avg_accuracy: number } | undefined;

    return {
      totalPairs: Number(pairs?.total || 0),
      unusedPairs: Number(pairs?.unused || 0),
      completedBatches: Number(batches?.completed || 0),
      avgAccuracy: Number(batches?.avg_accuracy || 0),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async savePair(
    chosen: SkeletonizedEpisode,
    rejected: SkeletonizedEpisode,
    margin: number
  ): Promise<DPOPair> {
    const pairId = uuidv4();

    const pair: DPOPair = {
      pair_id: pairId,
      chosen_skeleton_id: chosen.skeleton_id,
      rejected_skeleton_id: rejected.skeleton_id,
      goal_skeleton: chosen.goal_skeleton,
      chosen_response: this.formatResponse(chosen),
      rejected_response: this.formatResponse(rejected),
      margin,
      used_in_training: false,
      created_at: new Date(),
    };

    await executeStatement(
      `INSERT INTO dpo_training_pairs (
        pair_id, chosen_skeleton_id, rejected_skeleton_id, goal_skeleton,
        chosen_response, rejected_response, margin, used_in_training, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())`,
      [
        stringParam('pairId', pairId),
        stringParam('chosenId', chosen.skeleton_id),
        stringParam('rejectedId', rejected.skeleton_id),
        stringParam('goalSkeleton', chosen.goal_skeleton),
        stringParam('chosenResponse', pair.chosen_response),
        stringParam('rejectedResponse', pair.rejected_response),
        doubleParam('margin', margin),
      ]
    );

    return pair;
  }

  private calculateMargin(chosen: SkeletonizedEpisode, rejected: SkeletonizedEpisode): number {
    let margin = 0.5;

    // Boost margin based on metrics differences
    const chosenMetrics = chosen.metrics_skeleton;
    const rejectedMetrics = rejected.metrics_skeleton;

    // Paste-back error is a strong signal
    if (!chosenMetrics.had_paste_back_error && rejectedMetrics.had_paste_back_error) {
      margin += 0.2;
    }

    // Edit distance difference
    const editDistanceScore = {
      none: 1.0,
      low: 0.8,
      medium: 0.5,
      high: 0.2,
    };
    const chosenEditScore = editDistanceScore[chosenMetrics.edit_distance_bucket];
    const rejectedEditScore = editDistanceScore[rejectedMetrics.edit_distance_bucket];
    margin += (chosenEditScore - rejectedEditScore) * 0.15;

    // Sandbox result
    if (chosenMetrics.sandbox_result === 'pass' && rejectedMetrics.sandbox_result === 'fail') {
      margin += 0.15;
    }

    return Math.min(1.0, Math.max(0, margin));
  }

  private formatResponse(episode: SkeletonizedEpisode): string {
    const steps = episode.workflow_skeleton
      .map((s, i) => `${i + 1}. ${s.tool_type}: ${s.status}${s.error_category ? ` (${s.error_category})` : ''}`)
      .join('\n');

    return `Goal: ${episode.goal_skeleton}\n\nWorkflow:\n${steps}\n\nOutcome: ${episode.outcome_signal}`;
  }

  private formatPrompt(goalSkeleton: string): string {
    return `You are helping a user complete the following task:\n\n${goalSkeleton}\n\nProvide the optimal workflow to accomplish this.`;
  }

  private async saveTrainingDataToS3(
    batchId: string,
    data: { prompt: string; chosen: string; rejected: string }[]
  ): Promise<void> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    const bucket = process.env.DPO_TRAINING_BUCKET || `radiant-dpo-training-${process.env.STAGE || 'dev'}`;
    const key = `dpo-training/${batchId}/training_data.jsonl`;

    // Convert to JSONL format
    const jsonlContent = data.map(record => JSON.stringify(record)).join('\n');

    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: jsonlContent,
        ContentType: 'application/jsonlines',
        Metadata: {
          'batch-id': batchId,
          'record-count': String(data.length),
          'created-at': new Date().toISOString(),
        },
      }));

      logger.info('Training data uploaded to S3', {
        batchId,
        recordCount: data.length,
        bucket,
        key,
      });
    } catch (error) {
      logger.error('Failed to upload training data to S3', { batchId, error });
      throw error;
    }
  }

  private parsePairRows(rows: unknown[]): DPOPair[] {
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        pair_id: r.pair_id as string,
        chosen_skeleton_id: r.chosen_skeleton_id as string,
        rejected_skeleton_id: r.rejected_skeleton_id as string,
        goal_skeleton: r.goal_skeleton as string,
        chosen_response: r.chosen_response as string,
        rejected_response: r.rejected_response as string,
        margin: Number(r.margin || 0),
        used_in_training: Boolean(r.used_in_training),
        training_batch_id: r.training_batch_id as string | undefined,
        created_at: new Date(r.created_at as string),
      };
    });
  }
}

export const dpoTrainerService = new DPOTrainerService();
