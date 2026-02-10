/**
 * RADIANT Global Brain — Federated Averaging Engine
 *
 * Aggregates gradients from all participating tenants using
 * quality-weighted federated averaging with outlier detection.
 *
 * ALGORITHM:
 * 1. Collect all uploaded gradients for the current round
 * 2. Filter: minimum N participants required
 * 3. Outlier detection: z-score on gradient norms, reject outliers
 * 4. Quality-weighted averaging: higher quality tenants contribute more
 * 5. Momentum: blend with previous round's global model
 * 6. Result: averaged gradient stored as round output
 *
 * ALL S3 storage goes through cartridgeStorageManager — no direct S3 calls.
 */

import * as crypto from 'crypto';
import { executeStatement, stringParam, longParam } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';
import { cartridgeStorageManager } from '../cartridge-storage-manager.service';
import { decryptWithPlatformKey } from './gradient-upload.service';

const logger = createRegisteredLogger({
  serviceName: 'global-brain/federated-averaging',
  category: 'ai_model',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

interface AggregationConfig {
  method: string;
  weighting: string;
  outlier_detection: boolean;
  outlier_z_threshold: number;
  momentum: number;
  learning_rate_global: number;
}

interface GradientRow {
  id: string;
  tenant_id: string;
  storage_ref: string;
  quality_score: number;
  tenant_quality: number;
}

export interface FederatedAveragingResult {
  success: boolean;
  participants: number;
  outliersRejected: number;
  avgGradientNorm: number;
  resultStorageRef: string | null;
  durationMs: number;
  failReason?: string;
}

// ============================================================================
// Service
// ============================================================================

export async function runFederatedAveragingRound(roundId: string): Promise<FederatedAveragingResult> {
  const startTime = Date.now();
  logger.info('Starting federated averaging round', { roundId });

  // 1. Get round config
  const roundResult = await executeStatement(
    `SELECT * FROM global_brain_rounds WHERE id = $1 AND status = 'collecting'`,
    [stringParam('roundId', roundId)]
  );
  if (!roundResult.rows || roundResult.rows.length === 0) {
    throw new Error(`Round ${roundId} not found or not collecting`);
  }
  const round = roundResult.rows[0] as any;
  const config: AggregationConfig = typeof round.aggregation_config === 'string'
    ? JSON.parse(round.aggregation_config)
    : round.aggregation_config;

  // 2. Update status
  await executeStatement(
    `UPDATE global_brain_rounds SET status = 'aggregating' WHERE id = $1`,
    [stringParam('roundId', roundId)]
  );

  // 3. Collect gradients for this round
  const gradientType = round.round_type === 'omega_qnode' ? 'omega_qnode' : 'cortex_performance';
  const gradientsResult = await executeStatement(
    `SELECT g.id, g.tenant_id, g.storage_ref, g.quality_score,
            e.contribution_quality_score as tenant_quality
     FROM global_brain_gradients g
     JOIN global_brain_enrollment e ON e.tenant_id = g.tenant_id
     WHERE g.round_id = $1 AND g.status = 'uploaded' AND g.gradient_type = $2
     ORDER BY g.quality_score DESC`,
    [stringParam('roundId', roundId), stringParam('gradType', gradientType)]
  );

  const gradientRows = (gradientsResult.rows || []) as unknown as GradientRow[];

  if (gradientRows.length < (round.target_participants || 10)) {
    logger.warn('Insufficient participants', {
      required: round.target_participants,
      actual: gradientRows.length,
    });
    if (gradientRows.length < 3) {
      await executeStatement(
        `UPDATE global_brain_rounds SET status = 'failed' WHERE id = $1`,
        [stringParam('roundId', roundId)]
      );
      return {
        success: false,
        participants: gradientRows.length,
        outliersRejected: 0,
        avgGradientNorm: 0,
        resultStorageRef: null,
        durationMs: Date.now() - startTime,
        failReason: `Insufficient participants: ${gradientRows.length} < 3 minimum`,
      };
    }
  }

  // 4. Download and decrypt all gradients via storage manager
  const gradientData: { tenantQuality: number; vectors: Float32Array[] }[] = [];

  for (const g of gradientRows) {
    try {
      const retrieved = await cartridgeStorageManager.retrieveContent(g.storage_ref);
      if (!retrieved) {
        logger.warn('Gradient not found in storage', { gradientId: g.id, storageRef: g.storage_ref });
        continue;
      }

      const decrypted = await decryptWithPlatformKey(retrieved.data);
      const parsed = JSON.parse(decrypted.toString('utf-8'));

      const vectors = parsed.networks.map((n: any) => new Float32Array(n.gradient));
      gradientData.push({
        tenantQuality: (g.tenant_quality || 0.5) * (g.quality_score || 0.5),
        vectors,
      });

      // Mark as aggregating
      await executeStatement(
        `UPDATE global_brain_gradients SET status = 'aggregating' WHERE id = $1`,
        [stringParam('gradientId', g.id)]
      );
    } catch (error) {
      logger.warn('Failed to process gradient', { gradientId: g.id, error });
    }
  }

  if (gradientData.length < 3) {
    await executeStatement(
      `UPDATE global_brain_rounds SET status = 'failed' WHERE id = $1`,
      [stringParam('roundId', roundId)]
    );
    return {
      success: false,
      participants: gradientData.length,
      outliersRejected: 0,
      avgGradientNorm: 0,
      resultStorageRef: null,
      durationMs: Date.now() - startTime,
      failReason: `Only ${gradientData.length} valid gradients after download (need 3)`,
    };
  }

  // 5. Outlier detection (z-score on gradient norms)
  const norms = gradientData.map(g =>
    g.vectors.reduce((sum, v) => sum + l2Norm(v), 0) / g.vectors.length
  );
  const meanNorm = norms.reduce((a, b) => a + b, 0) / norms.length;
  const stdNorm = Math.sqrt(norms.reduce((sum, n) => sum + (n - meanNorm) ** 2, 0) / norms.length);
  const zThreshold = config.outlier_z_threshold || 3.0;

  const filtered = gradientData.filter((_, i) => {
    const z = Math.abs((norms[i] - meanNorm) / (stdNorm || 1));
    if (z > zThreshold) {
      logger.info('Outlier gradient rejected', { index: i, zScore: z.toFixed(3) });
      return false;
    }
    return true;
  });

  const outliersRejected = gradientData.length - filtered.length;

  // 6. Quality-weighted federated averaging
  const totalQuality = filtered.reduce((sum, g) => sum + g.tenantQuality, 0);
  const networkCount = filtered[0].vectors.length;
  const averaged: Float32Array[] = [];

  for (let n = 0; n < networkCount; n++) {
    const paramCount = filtered[0].vectors[n].length;
    const avgVector = new Float32Array(paramCount);

    for (const g of filtered) {
      if (n >= g.vectors.length) continue;
      const weight = g.tenantQuality / totalQuality;
      for (let i = 0; i < Math.min(paramCount, g.vectors[n].length); i++) {
        avgVector[i] += g.vectors[n][i] * weight;
      }
    }

    // Apply global learning rate
    const lr = config.learning_rate_global || 0.01;
    for (let i = 0; i < paramCount; i++) {
      avgVector[i] *= lr;
    }

    averaged.push(avgVector);
  }

  // 7. Store averaged result via storage manager
  const avgGradientNorm = averaged.reduce((sum, v) => sum + l2Norm(v), 0) / averaged.length;

  const resultPayload = JSON.stringify({
    round_id: roundId,
    round_type: round.round_type,
    networks: averaged.map((v, i) => ({ index: i, gradient: Array.from(v) })),
    participants: filtered.length,
    quality_metrics: {
      avg_quality: totalQuality / filtered.length,
      outliers_rejected: outliersRejected,
      avg_gradient_norm: avgGradientNorm,
    },
  });

  const resultFilename = `rounds/${roundId}/averaged_result.json`;
  const storeResult = await cartridgeStorageManager.storeContent(
    'platform',
    'global-brain-rounds',
    'global_brain',
    resultFilename,
    Buffer.from(resultPayload),
    'application/json',
  );

  // 8. Update round
  const checksum = crypto.createHash('sha256').update(resultPayload).digest('hex');
  await executeStatement(
    `UPDATE global_brain_rounds SET
      status = 'completed',
      actual_participants = $1,
      result_storage_ref = $2,
      result_checksum = $3,
      quality_metrics = $4,
      completed_at = NOW()
    WHERE id = $5`,
    [
      longParam('participants', filtered.length),
      stringParam('resultRef', storeResult.storage_ref),
      stringParam('checksum', checksum),
      stringParam('qualityMetrics', JSON.stringify({
        participants: filtered.length,
        outliers_rejected: outliersRejected,
        avg_gradient_norm: avgGradientNorm,
      })),
      stringParam('roundId', roundId),
    ]
  );

  // 9. Mark gradients as aggregated
  for (const g of gradientRows) {
    await executeStatement(
      `UPDATE global_brain_gradients SET status = 'aggregated' WHERE id = $1`,
      [stringParam('gradientId', g.id)]
    );
  }

  const result: FederatedAveragingResult = {
    success: true,
    participants: filtered.length,
    outliersRejected,
    avgGradientNorm,
    resultStorageRef: storeResult.storage_ref,
    durationMs: Date.now() - startTime,
  };

  logger.info('Federated averaging round complete', {
    roundId,
    participants: filtered.length,
    outliers: outliersRejected,
    avgGradientNorm: avgGradientNorm.toFixed(6),
    durationMs: result.durationMs,
  });

  return result;
}

// ============================================================================
// Round Management
// ============================================================================

export async function createNewRound(
  roundType: 'omega_qnode' | 'cortex_networks' | 'full',
  targetParticipants: number = 10,
): Promise<string> {
  // Get next round number
  const countResult = await executeStatement(
    `SELECT COALESCE(MAX(round_number), 0) + 1 as next_round FROM global_brain_rounds`,
    []
  );
  const nextRound = ((countResult.rows?.[0] as any)?.next_round) || 1;

  const result = await executeStatement(
    `INSERT INTO global_brain_rounds (round_number, round_type, target_participants, status)
     VALUES ($1, $2, $3, 'collecting')
     RETURNING id`,
    [
      longParam('roundNumber', nextRound),
      stringParam('roundType', roundType),
      longParam('target', targetParticipants),
    ]
  );

  const id = (result.rows?.[0] as any)?.id;
  logger.info('New federated averaging round created', { roundId: id, roundNumber: nextRound, roundType });
  return id;
}

export async function getActiveRound(): Promise<{ id: string; round_number: number; round_type: string } | null> {
  const result = await executeStatement(
    `SELECT id, round_number, round_type FROM global_brain_rounds WHERE status = 'collecting' ORDER BY created_at DESC LIMIT 1`,
    []
  );
  if (!result.rows || result.rows.length === 0) return null;
  return result.rows[0] as any;
}

// ============================================================================
// Helpers
// ============================================================================

function l2Norm(arr: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
  return Math.sqrt(sum);
}
