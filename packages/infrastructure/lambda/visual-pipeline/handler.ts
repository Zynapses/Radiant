import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, handleError } from '../shared/response';
import { extractUserFromEvent, type AuthContext } from '../shared/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '../shared/errors';
import { executeStatement } from '../shared/db/client';
import { metricsCollector } from '../shared/services';

type PipelineType = 'segment' | 'inpaint' | 'upscale' | 'interpolate' | 'face_restore' | 'matting';

interface PipelineRequest {
  pipelineType: PipelineType;
  sourceAssetKey: string;
  parameters?: Record<string, unknown>;
}

interface PipelineJob {
  id: string;
  status: string;
  progress: number;
  outputAssetKey?: string;
  error?: string;
}

const s3 = new S3Client({});
const sagemaker = new SageMakerRuntimeClient({});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  try {
    const user = await extractUserFromEvent(event);
    if (!user) {
      return handleError(new UnauthorizedError('Authentication required'));
    }

    if (method === 'POST' && path.endsWith('/jobs')) {
      return handleCreateJob(event, user);
    }

    if (method === 'GET' && path.includes('/jobs/')) {
      const jobId = path.split('/jobs/')[1];
      return handleGetJob(jobId, user);
    }

    if (method === 'GET' && path.endsWith('/jobs')) {
      return handleListJobs(user);
    }

    return handleError(new NotFoundError('Endpoint not found'));
  } catch (error) {
    console.error('Visual pipeline error:', error);
    return handleError(error);
  }
}

async function handleCreateJob(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as PipelineRequest;

  if (!body.pipelineType || !body.sourceAssetKey) {
    return handleError(new ValidationError('pipelineType and sourceAssetKey are required'));
  }

  const validTypes: PipelineType[] = ['segment', 'inpaint', 'upscale', 'interpolate', 'face_restore', 'matting'];
  if (!validTypes.includes(body.pipelineType)) {
    return handleError(new ValidationError(`Invalid pipelineType. Must be one of: ${validTypes.join(', ')}`));
  }

  const modelsUsed = getModelsForPipeline(body.pipelineType, body.parameters);

  const result = await executeStatement(
    `INSERT INTO visual_pipeline_jobs 
     (tenant_id, user_id, pipeline_type, source_asset_key, models_used, parameters, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id`,
    [
      { name: 'tenantId', value: { stringValue: user.tenantId } },
      { name: 'userId', value: { stringValue: user.userId } },
      { name: 'pipelineType', value: { stringValue: body.pipelineType } },
      { name: 'sourceAssetKey', value: { stringValue: body.sourceAssetKey } },
      { name: 'modelsUsed', value: { stringValue: `{${modelsUsed.join(',')}}` } },
      { name: 'parameters', value: { stringValue: JSON.stringify(body.parameters || {}) } },
    ]
  );

  const jobId = String((result.rows[0] as Record<string, unknown>)?.id || '');

  // Start async processing (in production, this would trigger a Step Function or SQS)
  processJobAsync(jobId, body, user).catch(console.error);

  metricsCollector.record({
    tenantId: user.tenantId,
    userId: user.userId,
    metricType: 'api_request',
    metricName: 'visual_pipeline_job_created',
    value: 1,
    dimensions: { pipeline_type: body.pipelineType },
  });

  return success({ id: jobId, status: 'pending', message: 'Job queued for processing' }, 202);
}

async function handleGetJob(
  jobId: string,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT id, pipeline_type, source_asset_key, output_asset_key, models_used,
            status, progress, error_message, cost, created_at, completed_at
     FROM visual_pipeline_jobs
     WHERE id = $1 AND tenant_id = $2`,
    [
      { name: 'jobId', value: { stringValue: jobId } },
      { name: 'tenantId', value: { stringValue: user.tenantId } },
    ]
  );

  if (result.rows.length === 0) {
    return handleError(new NotFoundError('Job not found'));
  }

  return success(result.rows[0]);
}

async function handleListJobs(
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT id, pipeline_type, status, progress, created_at, completed_at
     FROM visual_pipeline_jobs
     WHERE tenant_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 50`,
    [
      { name: 'tenantId', value: { stringValue: user.tenantId } },
      { name: 'userId', value: { stringValue: user.userId } },
    ]
  );

  return success({ jobs: result.rows });
}

async function processJobAsync(
  jobId: string,
  request: PipelineRequest,
  user: AuthContext
): Promise<void> {
  try {
    await updateJobStatus(jobId, 'processing', 0);

    const bucket = process.env.ASSETS_BUCKET || 'radiant-assets';
    const sourceObj = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: request.sourceAssetKey,
      })
    );

    const inputBuffer = Buffer.from(await sourceObj.Body!.transformToByteArray());
    await updateJobStatus(jobId, 'processing', 25);

    const outputBuffer = await processPipeline(
      request.pipelineType,
      inputBuffer,
      request.parameters || {}
    );
    await updateJobStatus(jobId, 'processing', 75);

    const outputKey = `processed/${user.tenantId}/${Date.now()}_${request.pipelineType}.png`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: outputKey,
        Body: outputBuffer,
        ContentType: 'image/png',
      })
    );

    await executeStatement(
      `UPDATE visual_pipeline_jobs 
       SET status = 'completed', progress = 100, output_asset_key = $2, completed_at = NOW()
       WHERE id = $1`,
      [
        { name: 'jobId', value: { stringValue: jobId } },
        { name: 'outputKey', value: { stringValue: outputKey } },
      ]
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await executeStatement(
      `UPDATE visual_pipeline_jobs 
       SET status = 'failed', error_message = $2, completed_at = NOW()
       WHERE id = $1`,
      [
        { name: 'jobId', value: { stringValue: jobId } },
        { name: 'errorMessage', value: { stringValue: errorMessage } },
      ]
    );
  }
}

async function updateJobStatus(jobId: string, status: string, progress: number): Promise<void> {
  await executeStatement(
    `UPDATE visual_pipeline_jobs SET status = $2, progress = $3, started_at = COALESCE(started_at, NOW()) WHERE id = $1`,
    [
      { name: 'jobId', value: { stringValue: jobId } },
      { name: 'status', value: { stringValue: status } },
      { name: 'progress', value: { longValue: progress } },
    ]
  );
}

async function processPipeline(
  pipelineType: PipelineType,
  input: Buffer,
  params: Record<string, unknown>
): Promise<Buffer> {
  const endpointMap: Record<PipelineType, string> = {
    segment: params.quality === 'high' ? 'sam2-large' : 'sam2-base',
    inpaint: 'lama-inpaint',
    upscale: params.style === 'anime' ? 'realesrgan-anime' : 'realesrgan-4x',
    interpolate: 'rife-interpolation',
    face_restore: params.method === 'codeformer' ? 'codeformer' : 'gfpgan',
    matting: 'background-matting-v2',
  };

  const endpoint = endpointMap[pipelineType];
  return invokeSageMaker(endpoint, input, params);
}

async function invokeSageMaker(
  endpoint: string,
  input: Buffer,
  params: Record<string, unknown>
): Promise<Buffer> {
  const payload = {
    image: input.toString('base64'),
    ...params,
  };

  const response = await sagemaker.send(
    new InvokeEndpointCommand({
      EndpointName: endpoint,
      Body: JSON.stringify(payload),
      ContentType: 'application/json',
    })
  );

  const result = JSON.parse(new TextDecoder().decode(response.Body));
  return Buffer.from(result.output, 'base64');
}

function getModelsForPipeline(pipelineType: PipelineType, params?: Record<string, unknown>): string[] {
  const modelMap: Record<PipelineType, string[]> = {
    segment: params?.quality === 'high' ? ['sam2-large'] : ['sam2-base'],
    inpaint: ['lama'],
    upscale: params?.style === 'anime' ? ['realesrgan-anime'] : ['realesrgan-4x'],
    interpolate: ['rife'],
    face_restore: params?.method === 'codeformer' ? ['codeformer'] : ['gfpgan'],
    matting: ['background-matting-v2'],
  };

  return modelMap[pipelineType] || [];
}
