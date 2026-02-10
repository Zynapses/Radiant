/**
 * RADIANT Global Brain — Base Cartridge Generation Pipeline
 *
 * Runs monthly (or on-demand from Forge).
 * Takes completed federated averaging rounds and builds a new base .RADz cartridge.
 *
 * ALL S3 storage goes through cartridgeStorageManager — no direct S3 calls.
 */

import { executeStatement, stringParam, longParam } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';
import { cartridgeStorageManager } from '../cartridge-storage-manager.service';

const logger = createRegisteredLogger({
  serviceName: 'global-brain/cartridge-pipeline',
  category: 'ai_model',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface PipelineResult {
  success: boolean;
  pipelineId: string;
  outputCartridgeId: string | null;
  version: string | null;
  roundsUsed: number;
  participants: number;
  durationMs: number;
  failReason?: string;
}

// ============================================================================
// Pipeline
// ============================================================================

export async function generateBaseCartridge(pipelineId: string): Promise<PipelineResult> {
  const startTime = Date.now();
  logger.info('Starting base cartridge generation', { pipelineId });

  // 1. Get pipeline config
  const pipelineResult = await executeStatement(
    `SELECT * FROM global_brain_cartridge_pipeline WHERE id = $1 AND status = 'scheduled'`,
    [stringParam('pipelineId', pipelineId)]
  );
  if (!pipelineResult.rows || pipelineResult.rows.length === 0) {
    throw new Error(`Pipeline ${pipelineId} not found or not scheduled`);
  }
  const pipeline = pipelineResult.rows[0] as any;

  await updatePipelineStatus(pipelineId, 'collecting_rounds');

  // 2. Get all completed rounds from input_rounds
  const inputRounds = Array.isArray(pipeline.input_rounds)
    ? pipeline.input_rounds
    : (typeof pipeline.input_rounds === 'string' ? JSON.parse(pipeline.input_rounds) : []);

  let roundsQuery: string;
  let roundsParams: any[];

  if (inputRounds.length > 0) {
    roundsQuery = `SELECT * FROM global_brain_rounds
      WHERE status = 'completed' AND id = ANY($1::uuid[])
      ORDER BY round_number ASC`;
    roundsParams = [stringParam('rounds', `{${inputRounds.join(',')}}`)];
  } else {
    // If no specific rounds, get all completed rounds not yet used in a pipeline
    roundsQuery = `SELECT r.* FROM global_brain_rounds r
      WHERE r.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM global_brain_cartridge_pipeline p
          WHERE p.status = 'completed' AND r.id = ANY(p.input_rounds)
        )
      ORDER BY r.round_number ASC
      LIMIT 50`;
    roundsParams = [];
  }

  const roundsResult = await executeStatement(roundsQuery, roundsParams);
  const rounds = (roundsResult.rows || []) as any[];

  if (rounds.length === 0) {
    await updatePipelineStatus(pipelineId, 'failed', { error: 'No completed rounds found' });
    return {
      success: false,
      pipelineId,
      outputCartridgeId: null,
      version: null,
      roundsUsed: 0,
      participants: 0,
      durationMs: Date.now() - startTime,
      failReason: 'No completed rounds found',
    };
  }

  await updatePipelineStatus(pipelineId, 'averaging');

  // 3. Load the latest round result via storage manager
  const latestRound = rounds[rounds.length - 1];
  const roundDataResult = await cartridgeStorageManager.retrieveContent(latestRound.result_storage_ref);

  if (!roundDataResult) {
    await updatePipelineStatus(pipelineId, 'failed', { error: 'Could not load round result from storage' });
    return {
      success: false,
      pipelineId,
      outputCartridgeId: null,
      version: null,
      roundsUsed: rounds.length,
      participants: 0,
      durationMs: Date.now() - startTime,
      failReason: 'Could not load round result from storage',
    };
  }

  const roundResult = JSON.parse(roundDataResult.data.toString('utf-8'));

  // 4. Load previous base cartridge weights as foundation (if any)
  const prevBaseResult = await executeStatement(
    `SELECT id, storage_ref FROM cartridge_universal
     WHERE cartridge_type = 'base' AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
    []
  );

  let baseWeights: Record<string, Float32Array> = {};
  if (prevBaseResult.rows && prevBaseResult.rows.length > 0) {
    const prevBase = prevBaseResult.rows[0] as any;
    baseWeights = await loadBaseWeightsFromStorage(prevBase.storage_ref);
  }

  // 5. Apply averaged gradients to base weights
  for (const network of (roundResult.networks || [])) {
    const key = `network_${network.index}`;
    const gradient = new Float32Array(network.gradient);

    if (baseWeights[key]) {
      for (let i = 0; i < Math.min(gradient.length, baseWeights[key].length); i++) {
        baseWeights[key][i] += gradient[i];
      }
    } else {
      baseWeights[key] = gradient;
    }
  }

  await updatePipelineStatus(pipelineId, 'building_cartridge');

  // 6. Build new base cartridge sections and store via storage manager
  const version = pipeline.target_version || generateVersion();
  const cartridgeId = `global-brain-base-${version}`;

  // Store Q-Node weight sections
  const qnodeManifest: string[] = [];
  let totalSizeBytes = 0;

  for (const [networkName, weights] of Object.entries(baseWeights)) {
    const weightPayload = JSON.stringify({
      dtype: 'float32',
      shape: [weights.length],
      data: Array.from(weights),
    });
    const weightBuffer = Buffer.from(weightPayload);

    await cartridgeStorageManager.storeContent(
      'platform',
      cartridgeId,
      'qnodes',
      `${networkName}_weights.json`,
      weightBuffer,
      'application/json',
    );

    qnodeManifest.push(networkName);
    totalSizeBytes += weightBuffer.length;
  }

  // Store network manifest
  await cartridgeStorageManager.storeContent(
    'platform',
    cartridgeId,
    'qnodes',
    'network_manifest.json',
    Buffer.from(JSON.stringify({ networks: qnodeManifest, version })),
    'application/json',
  );

  // Store default firmware (carry forward from previous or use defaults)
  const defaultAmbitionConfig = getDefaultAmbitionConfig();
  await cartridgeStorageManager.storeContent(
    'platform',
    cartridgeId,
    'firmware',
    'ambition_config.json',
    Buffer.from(JSON.stringify(defaultAmbitionConfig)),
    'application/json',
  );

  await cartridgeStorageManager.storeContent(
    'platform',
    cartridgeId,
    'firmware',
    'veto_thresholds.json',
    Buffer.from(JSON.stringify({ categories: {} })),
    'application/json',
  );

  await updatePipelineStatus(pipelineId, 'validating');

  // 7. Register the cartridge in the DB
  const insertResult = await executeStatement(
    `INSERT INTO cartridge_universal (
      name, display_name, version, cartridge_type, status,
      targets, description, author,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, 'base', 'active',
      ARRAY['omega', 'cortex', 'cato'], $4, $5,
      NOW(), NOW()
    ) RETURNING id`,
    [
      stringParam('name', 'radiant-base'),
      stringParam('displayName', `RADIANT Base Intelligence v${version}`),
      stringParam('version', version),
      stringParam('description', `Federated base intelligence from ${rounds.length} averaging rounds, ${roundResult.participants || 0} tenant participants.`),
      stringParam('author', JSON.stringify({ name: 'RADIANT Global Brain', org_id: 'radiant-platform' })),
    ]
  );

  const outputCartridgeId = (insertResult.rows?.[0] as any)?.id || cartridgeId;

  await updatePipelineStatus(pipelineId, 'publishing');

  // 8. Archive previous base cartridge
  if (prevBaseResult.rows && prevBaseResult.rows.length > 0) {
    const prevId = (prevBaseResult.rows[0] as any).id;
    await executeStatement(
      `UPDATE cartridge_universal SET status = 'archived', updated_at = NOW() WHERE id = $1`,
      [stringParam('prevId', prevId)]
    );
  }

  // 9. Complete pipeline
  await executeStatement(
    `UPDATE global_brain_cartridge_pipeline SET
      status = 'completed',
      output_cartridge_id = $1,
      progress = $2,
      completed_at = NOW()
    WHERE id = $3`,
    [
      stringParam('outputCartridgeId', outputCartridgeId),
      stringParam('progress', JSON.stringify({
        rounds_used: rounds.length,
        participants: roundResult.participants || 0,
        output_version: version,
        output_size_bytes: totalSizeBytes,
        networks: qnodeManifest.length,
      })),
      stringParam('pipelineId', pipelineId),
    ]
  );

  const result: PipelineResult = {
    success: true,
    pipelineId,
    outputCartridgeId,
    version,
    roundsUsed: rounds.length,
    participants: roundResult.participants || 0,
    durationMs: Date.now() - startTime,
  };

  logger.info('Base cartridge published', {
    pipelineId,
    cartridgeId: outputCartridgeId,
    version,
    roundsUsed: rounds.length,
    durationMs: result.durationMs,
  });

  return result;
}

// ============================================================================
// Pipeline Management
// ============================================================================

export async function schedulePipeline(
  pipelineType: 'base' | 'domain_refresh' | 'emergency_patch',
  inputRounds: string[] = [],
  targetVersion?: string,
  scheduledFor?: Date,
): Promise<string> {
  const result = await executeStatement(
    `INSERT INTO global_brain_cartridge_pipeline (
      pipeline_type, status, input_rounds, target_version, scheduled_for, config
    ) VALUES ($1, 'scheduled', $2, $3, $4, '{}')
    RETURNING id`,
    [
      stringParam('type', pipelineType),
      stringParam('rounds', `{${inputRounds.join(',')}}`),
      targetVersion ? stringParam('version', targetVersion) : stringParam('version', ''),
      stringParam('scheduledFor', (scheduledFor || new Date()).toISOString()),
    ]
  );

  const id = (result.rows?.[0] as any)?.id;
  logger.info('Pipeline scheduled', { pipelineId: id, pipelineType, inputRounds: inputRounds.length });
  return id;
}

export async function getPipelineStatus(pipelineId: string): Promise<any> {
  const result = await executeStatement(
    `SELECT * FROM global_brain_cartridge_pipeline WHERE id = $1`,
    [stringParam('pipelineId', pipelineId)]
  );
  return result.rows?.[0] || null;
}

// ============================================================================
// Helpers
// ============================================================================

async function updatePipelineStatus(pipelineId: string, status: string, progress?: Record<string, unknown>): Promise<void> {
  if (progress) {
    await executeStatement(
      `UPDATE global_brain_cartridge_pipeline SET status = $1, progress = $2, started_at = COALESCE(started_at, NOW()) WHERE id = $3`,
      [stringParam('status', status), stringParam('progress', JSON.stringify(progress)), stringParam('pipelineId', pipelineId)]
    );
  } else {
    await executeStatement(
      `UPDATE global_brain_cartridge_pipeline SET status = $1, started_at = COALESCE(started_at, NOW()) WHERE id = $2`,
      [stringParam('status', status), stringParam('pipelineId', pipelineId)]
    );
  }
}

async function loadBaseWeightsFromStorage(storageRef: string): Promise<Record<string, Float32Array>> {
  const weights: Record<string, Float32Array> = {};

  // Try to load network manifest
  const manifestRef = storageRef.replace(/[^/]+$/, 'network_manifest.json');
  const manifestResult = await cartridgeStorageManager.retrieveContent(manifestRef);

  if (manifestResult) {
    const manifest = JSON.parse(manifestResult.data.toString('utf-8'));
    for (const networkName of (manifest.networks || [])) {
      const weightRef = storageRef.replace(/[^/]+$/, `${networkName}_weights.json`);
      const weightResult = await cartridgeStorageManager.retrieveContent(weightRef);
      if (weightResult) {
        const parsed = JSON.parse(weightResult.data.toString('utf-8'));
        weights[networkName] = new Float32Array(parsed.data || []);
      }
    }
  }

  return weights;
}

function generateVersion(): string {
  const now = new Date();
  return `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.1`;
}

function getDefaultAmbitionConfig() {
  return {
    schema_version: '1.0.0',
    chemicals: {
      dopamine: { initial: 0.5, decay_rate: 0.99, reward_on_high_q: 0.15, q_reward_threshold: 0.6, min: 0, max: 1 },
      entropy: { initial: 0.0, growth_rate: 0.01, reduction_on_novel_input: 0.1, research_trigger: 0.6, self_analysis_trigger: 0.5, min: 0, max: 1 },
      curiosity: { initial: 0.5, novelty_sensitivity: 0.8, decay_rate: 0.995, exploration_bias: 0.3, min: 0, max: 1 },
      frustration: { initial: 0.0, growth_on_low_q: 0.05, q_frustration_threshold: 0.25, self_analysis_trigger: 0.7, reduction_on_success: 0.1, min: 0, max: 1 },
      satisfaction: { initial: 0.5, rfm_accuracy_sensitivity: 0.6, decay_rate: 0.998, rfm_recalibration_trigger: 0.3, min: 0, max: 1 },
    },
    self_optimization: {
      enabled: true,
      max_scaling_request_percent: 0.1,
      allowed_adjustments: ['theta_window', 'plasticity_threshold', 'growth_rate', 'pruning_aggressiveness'],
      forbidden_adjustments: ['veto_thresholds', 'helix_geometries', 'appeal_rules', 'firmware_parameters'],
    },
    internet_research: {
      enabled: true,
      max_queries_per_dream: 5,
      entropy_trigger: 0.6,
      result_confidence: 0.6,
      helix_filter_required: true,
      audit_logging_required: true,
    },
  };
}
