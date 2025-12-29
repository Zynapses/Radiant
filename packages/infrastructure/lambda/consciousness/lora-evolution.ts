// RADIANT v4.18.0 - LoRA Evolution Pipeline
// EventBridge Lambda: Scheduled weekly to train LoRA adapters from learning candidates
// This is the "sleep cycle" that enables epigenetic evolution

import { Handler, ScheduledEvent } from 'aws-lambda';
import { 
  SageMakerClient, 
  CreateTrainingJobCommand,
  DescribeTrainingJobCommand,
} from '@aws-sdk/client-sagemaker';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { executeStatement } from '../shared/db/client';
import { learningCandidateService, type TrainingDataset } from '../shared/services/learning-candidate.service';
import { enhancedLearningService } from '../shared/services/enhanced-learning.service';
import { enhancedLearningIntegrationService } from '../shared/services/enhanced-learning-integration.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Configuration
// ============================================================================

const SAGEMAKER_ROLE_ARN = process.env.SAGEMAKER_ROLE_ARN || '';
const TRAINING_BUCKET = process.env.TRAINING_BUCKET || 'radiant-lora-training';
const BASE_MODEL = process.env.LORA_BASE_MODEL || 'meta-llama/Llama-3-8B-Instruct';
// MIN_CANDIDATES_FOR_TRAINING now comes from enhanced learning config (default 25)
const MAX_TRAINING_CANDIDATES = 1000;
const MAX_TRAINING_TOKENS = 500000;

// ============================================================================
// Types
// ============================================================================

interface EvolutionJobConfig {
  tenantId: string;
  baseModelId: string;
  adapterName: string;
  trainingDataS3Path: string;
  outputS3Path: string;
  hyperparameters: {
    loraRank: number;
    loraAlpha: number;
    learningRate: number;
    epochs: number;
    batchSize: number;
  };
}

type JobStatus = 'scheduled' | 'preparing' | 'training' | 'validating' | 'deploying' | 'completed' | 'failed' | 'rolled_back';

// ============================================================================
// Main Handler
// ============================================================================

export const handler: Handler<ScheduledEvent> = async (event) => {
  const startTime = Date.now();
  logger.info('LoRA Evolution Pipeline triggered', { event });

  try {
    // Get all tenants with pending learning candidates
    const tenantsToProcess = await getTenantsWithPendingCandidates();
    
    if (tenantsToProcess.length === 0) {
      logger.info('No tenants have sufficient learning candidates for training');
      return { statusCode: 200, message: 'No training needed' };
    }

    const results: Array<{ tenantId: string; status: string; jobId?: string; error?: string }> = [];

    for (const tenantId of tenantsToProcess) {
      try {
        const result = await processEvolutionForTenant(tenantId);
        results.push(result);
      } catch (error) {
        logger.error('Evolution failed for tenant', { tenantId, error });
        results.push({ tenantId, status: 'failed', error: String(error) });
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('LoRA Evolution Pipeline completed', { results, durationMs });

    return {
      statusCode: 200,
      tenantsProcessed: results.length,
      results,
      durationMs,
    };
  } catch (error) {
    logger.error('LoRA Evolution Pipeline failed', { error });
    throw error;
  }
};

// ============================================================================
// Core Evolution Logic
// ============================================================================

async function getTenantsWithPendingCandidates(): Promise<string[]> {
  // Get all active tenants
  const tenantsResult = await executeStatement(
    `SELECT id FROM tenants WHERE status = 'active'`,
    []
  );
  
  const readyTenants: string[] = [];
  
  for (const row of tenantsResult.rows || []) {
    const tenantId = String((row as Record<string, unknown>).id);
    
    // Use enhanced learning integration to check if tenant is ready for training
    const { shouldTrain, reason, stats } = await enhancedLearningIntegrationService.shouldTriggerTraining(tenantId);
    
    if (shouldTrain) {
      logger.info('Tenant ready for training', { tenantId, reason, stats });
      readyTenants.push(tenantId);
    } else {
      logger.debug('Tenant not ready for training', { tenantId, reason, stats });
    }
  }
  
  return readyTenants;
}

async function processEvolutionForTenant(tenantId: string): Promise<{
  tenantId: string;
  status: string;
  jobId?: string;
  error?: string;
}> {
  const jobId = uuidv4();
  
  // Create job record
  await createJobRecord(tenantId, jobId);

  try {
    // Step 1: Get training dataset
    await updateJobStatus(jobId, 'preparing');
    const dataset = await learningCandidateService.getTrainingDataset(
      tenantId,
      MAX_TRAINING_CANDIDATES,
      MAX_TRAINING_TOKENS
    );

    // Get min candidates from enhanced learning config
    const config = await enhancedLearningService.getConfig(tenantId);
    const minCandidates = config?.minCandidatesForTraining || 25;
    
    if (dataset.candidates.length < minCandidates) {
      await updateJobStatus(jobId, 'completed', `Insufficient candidates after filtering: ${dataset.candidates.length} < ${minCandidates}`);
      return { tenantId, status: 'skipped', jobId };
    }

    // Step 2: Prepare training data and upload to S3
    const trainingDataPath = await prepareAndUploadTrainingData(tenantId, jobId, dataset);

    // Step 3: Mark candidates as queued
    await learningCandidateService.markAsQueued(
      dataset.candidates.map(c => c.candidateId),
      jobId
    );

    // Step 4: Start SageMaker training job
    await updateJobStatus(jobId, 'training');
    const sagemakerJobName = await startTrainingJob({
      tenantId,
      baseModelId: BASE_MODEL,
      adapterName: `ego-adapter-${tenantId.substring(0, 8)}-${Date.now()}`,
      trainingDataS3Path: trainingDataPath,
      outputS3Path: `s3://${TRAINING_BUCKET}/adapters/${tenantId}/${jobId}/`,
      hyperparameters: {
        loraRank: 16,
        loraAlpha: 32,
        learningRate: 0.0001,
        epochs: 3,
        batchSize: 4,
      },
    });

    // Update job with SageMaker details
    await executeStatement(
      `UPDATE lora_evolution_jobs 
       SET sagemaker_job_name = $2, 
           training_candidates_count = $3,
           training_tokens_total = $4,
           training_data_s3_path = $5,
           started_at = NOW()
       WHERE job_id = $1`,
      [
        { name: 'jobId', value: { stringValue: jobId } },
        { name: 'sagemakerJobName', value: { stringValue: sagemakerJobName } },
        { name: 'candidateCount', value: { longValue: dataset.candidates.length } },
        { name: 'tokenCount', value: { longValue: dataset.totalTokens } },
        { name: 's3Path', value: { stringValue: trainingDataPath } },
      ]
    );

    logger.info('LoRA training job started', {
      tenantId,
      jobId,
      sagemakerJobName,
      candidateCount: dataset.candidates.length,
      tokenCount: dataset.totalTokens,
    });

    return { tenantId, status: 'training_started', jobId };

  } catch (error) {
    await updateJobStatus(jobId, 'failed', String(error));
    throw error;
  }
}

// ============================================================================
// Training Data Preparation
// ============================================================================

async function prepareAndUploadTrainingData(
  tenantId: string,
  jobId: string,
  dataset: TrainingDataset
): Promise<string> {
  const s3Client = new S3Client({});

  // Convert to training format (instruction-following format)
  const trainingRecords = dataset.candidates.map(candidate => {
    // If there's a correction, use the corrected version as the target
    const targetResponse = candidate.correctionText || candidate.responseText;
    
    return {
      instruction: candidate.promptText,
      input: '',
      output: targetResponse,
      metadata: {
        candidateId: candidate.candidateId,
        type: candidate.candidateType,
        qualityScore: candidate.qualityScore,
      },
    };
  });

  // Format as JSONL
  const jsonlContent = trainingRecords.map(r => JSON.stringify(r)).join('\n');

  const s3Key = `training-data/${tenantId}/${jobId}/train.jsonl`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: TRAINING_BUCKET,
    Key: s3Key,
    Body: jsonlContent,
    ContentType: 'application/jsonl',
  }));

  return `s3://${TRAINING_BUCKET}/${s3Key}`;
}

// ============================================================================
// SageMaker Training Job
// ============================================================================

async function startTrainingJob(config: EvolutionJobConfig): Promise<string> {
  const sagemakerClient = new SageMakerClient({});
  
  const jobName = `radiant-lora-${config.tenantId.substring(0, 8)}-${Date.now()}`;

  // Note: In production, this would use a custom training container
  // For now, we create the job structure for future implementation
  const command = new CreateTrainingJobCommand({
    TrainingJobName: jobName,
    RoleArn: SAGEMAKER_ROLE_ARN,
    AlgorithmSpecification: {
      TrainingImage: '763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-training:2.0.0-transformers4.28.1-gpu-py310-cu118-ubuntu20.04',
      TrainingInputMode: 'File',
    },
    HyperParameters: {
      'model_id': config.baseModelId,
      'lora_r': String(config.hyperparameters.loraRank),
      'lora_alpha': String(config.hyperparameters.loraAlpha),
      'learning_rate': String(config.hyperparameters.learningRate),
      'num_train_epochs': String(config.hyperparameters.epochs),
      'per_device_train_batch_size': String(config.hyperparameters.batchSize),
      'gradient_accumulation_steps': '4',
      'warmup_ratio': '0.03',
      'max_seq_length': '2048',
      'lora_dropout': '0.05',
      'target_modules': 'q_proj,k_proj,v_proj,o_proj',
    },
    InputDataConfig: [
      {
        ChannelName: 'train',
        DataSource: {
          S3DataSource: {
            S3DataType: 'S3Prefix',
            S3Uri: config.trainingDataS3Path,
            S3DataDistributionType: 'FullyReplicated',
          },
        },
      },
    ],
    OutputDataConfig: {
      S3OutputPath: config.outputS3Path,
    },
    ResourceConfig: {
      InstanceType: 'ml.g5.2xlarge',
      InstanceCount: 1,
      VolumeSizeInGB: 100,
    },
    StoppingCondition: {
      MaxRuntimeInSeconds: 7200, // 2 hours max
    },
    Tags: [
      { Key: 'TenantId', Value: config.tenantId },
      { Key: 'Purpose', Value: 'LoRA-Evolution' },
      { Key: 'AdapterName', Value: config.adapterName },
    ],
  });

  try {
    await sagemakerClient.send(command);
    return jobName;
  } catch (error) {
    logger.error('Failed to start SageMaker training job', { error, config });
    throw error;
  }
}

// ============================================================================
// Job Status Management
// ============================================================================

async function createJobRecord(tenantId: string, jobId: string): Promise<void> {
  // Get current adapter version
  const versionResult = await executeStatement(
    `SELECT COALESCE(MAX(adapter_version), 0) + 1 as next_version
     FROM lora_evolution_jobs WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  const nextVersion = Number((versionResult.rows[0] as Record<string, unknown>).next_version || 1);

  await executeStatement(
    `INSERT INTO lora_evolution_jobs (
      job_id, tenant_id, base_model_id, adapter_name, adapter_version,
      status, scheduled_at
    ) VALUES ($1, $2, $3, $4, $5, 'scheduled', NOW())`,
    [
      { name: 'jobId', value: { stringValue: jobId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'baseModel', value: { stringValue: BASE_MODEL } },
      { name: 'adapterName', value: { stringValue: `ego-adapter-v${nextVersion}` } },
      { name: 'version', value: { longValue: nextVersion } },
    ]
  );
}

async function updateJobStatus(jobId: string, status: JobStatus, errorMessage?: string): Promise<void> {
  const updates = ['status = $2'];
  const params: Array<{ name: string; value: unknown }> = [
    { name: 'jobId', value: { stringValue: jobId } },
    { name: 'status', value: { stringValue: status } },
  ];

  if (status === 'completed' || status === 'failed') {
    updates.push(`completed_at = NOW()`);
    updates.push(`duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER`);
  }

  if (errorMessage) {
    updates.push(`error_message = $${params.length + 1}`);
    params.push({ name: 'error', value: { stringValue: errorMessage } });
  }

  await executeStatement(
    `UPDATE lora_evolution_jobs SET ${updates.join(', ')} WHERE job_id = $1`,
    params as Parameters<typeof executeStatement>[1]
  );
}

// ============================================================================
// Training Job Status Checker (separate Lambda for async polling)
// ============================================================================

export const checkTrainingStatus: Handler = async () => {
  const sagemakerClient = new SageMakerClient({});

  // Get jobs that are in training status
  const result = await executeStatement(
    `SELECT job_id, sagemaker_job_name, tenant_id
     FROM lora_evolution_jobs
     WHERE status = 'training' AND sagemaker_job_name IS NOT NULL`,
    []
  );

  for (const row of result.rows) {
    const r = row as Record<string, unknown>;
    const jobId = String(r.job_id);
    const sagemakerJobName = String(r.sagemaker_job_name);
    const tenantId = String(r.tenant_id);

    try {
      const response = await sagemakerClient.send(
        new DescribeTrainingJobCommand({ TrainingJobName: sagemakerJobName })
      );

      const status = response.TrainingJobStatus;

      if (status === 'Completed') {
        // Training complete - update job and mark candidates
        await updateJobStatus(jobId, 'validating');
        await learningCandidateService.markAsCompleted(jobId);

        // Update with training metrics
        await executeStatement(
          `UPDATE lora_evolution_jobs SET
            training_loss = $2,
            adapter_s3_path = $3,
            status = 'completed',
            completed_at = NOW()
          WHERE job_id = $1`,
          [
            { name: 'jobId', value: { stringValue: jobId } },
            { name: 'loss', value: { doubleValue: response.FinalMetricDataList?.[0]?.Value || 0 } },
            { name: 's3Path', value: { stringValue: response.ModelArtifacts?.S3ModelArtifacts || '' } },
          ]
        );

        // Update evolution state
        await updateEvolutionState(tenantId, jobId);

        logger.info('LoRA training completed', { jobId, sagemakerJobName, tenantId });

      } else if (status === 'Failed') {
        await updateJobStatus(jobId, 'failed', response.FailureReason || 'Unknown failure');
        logger.error('LoRA training failed', { jobId, sagemakerJobName, reason: response.FailureReason });
      }
      // If still InProgress, do nothing - will check again next run

    } catch (error) {
      logger.error('Failed to check training status', { jobId, sagemakerJobName, error });
    }
  }

  return { statusCode: 200, message: 'Training status check complete' };
};

// ============================================================================
// Evolution State Management
// ============================================================================

async function updateEvolutionState(tenantId: string, completedJobId: string): Promise<void> {
  // Get job details
  const jobResult = await executeStatement(
    `SELECT adapter_version, training_candidates_count, duration_seconds
     FROM lora_evolution_jobs WHERE job_id = $1`,
    [{ name: 'jobId', value: { stringValue: completedJobId } }]
  );

  if (jobResult.rows.length === 0) return;

  const job = jobResult.rows[0] as Record<string, unknown>;

  await executeStatement(
    `INSERT INTO consciousness_evolution_state (
      tenant_id, current_adapter_id, current_adapter_version, generation_number,
      total_learning_candidates_processed, last_evolution_at,
      next_scheduled_evolution
    ) VALUES ($1, $2, $3, 1, $4, NOW(), NOW() + INTERVAL '7 days')
    ON CONFLICT (tenant_id) DO UPDATE SET
      current_adapter_id = $2,
      current_adapter_version = $3,
      generation_number = consciousness_evolution_state.generation_number + 1,
      total_learning_candidates_processed = 
        consciousness_evolution_state.total_learning_candidates_processed + $4,
      total_training_hours = 
        consciousness_evolution_state.total_training_hours + ($5::DECIMAL / 3600),
      last_evolution_at = NOW(),
      next_scheduled_evolution = NOW() + INTERVAL '7 days',
      updated_at = NOW()`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'adapterId', value: { stringValue: completedJobId } },
      { name: 'version', value: { longValue: Number(job.adapter_version || 1) } },
      { name: 'candidateCount', value: { longValue: Number(job.training_candidates_count || 0) } },
      { name: 'durationSeconds', value: { longValue: Number(job.duration_seconds || 0) } },
    ]
  );

  logger.info('Consciousness evolution state updated', {
    tenantId,
    newVersion: job.adapter_version,
  });
}
