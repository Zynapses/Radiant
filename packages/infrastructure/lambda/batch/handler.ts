/**
 * Batch Processor Handler
 * 
 * Processes individual batch job chunks
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { requireEnv } from '../shared/config/env';

const dynamodb = new DynamoDBClient({});
const s3 = new S3Client({});

const JOBS_TABLE = requireEnv('JOBS_TABLE');
const INPUT_BUCKET = requireEnv('INPUT_BUCKET');
const OUTPUT_BUCKET = requireEnv('OUTPUT_BUCKET');

interface BatchChunk {
  jobId: string;
  chunkId: string;
  tenantId: string;
  type: 'embeddings' | 'completions' | 'moderation' | 'translation' | 'extraction' | 'classification';
  model: string;
  inputKey: string;
  outputKey: string;
  options: Record<string, unknown>;
}

interface BatchItem {
  id: string;
  input: string;
  metadata?: Record<string, unknown>;
}

interface BatchResult {
  id: string;
  output: unknown;
  tokens_used?: number;
  error?: string;
}

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const chunk: BatchChunk = JSON.parse(record.body);
  
  logger.info(`Processing chunk ${chunk.chunkId} of job ${chunk.jobId}`);

  try {
    // Update status to processing
    await updateChunkStatus(chunk.jobId, chunk.chunkId, 'processing');

    // Get input data from S3
    const inputData = await getInputData(chunk.inputKey);
    const items: BatchItem[] = JSON.parse(inputData);

    // Process each item
    const results: BatchResult[] = [];
    let totalTokens = 0;

    for (const item of items) {
      try {
        const result = await processItem(item, chunk);
        results.push(result);
        totalTokens += result.tokens_used || 0;
      } catch (error) {
        results.push({
          id: item.id,
          output: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Save results to S3
    await saveResults(chunk.outputKey, results);

    // Update status to complete
    await updateChunkStatus(chunk.jobId, chunk.chunkId, 'complete', {
      itemsProcessed: results.length,
      itemsFailed: results.filter(r => r.error).length,
      tokensUsed: totalTokens,
    });

  } catch (error) {
    logger.error(`Error processing chunk ${chunk.chunkId}`, error);
    await updateChunkStatus(chunk.jobId, chunk.chunkId, 'failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function processItem(item: BatchItem, chunk: BatchChunk): Promise<BatchResult> {
  switch (chunk.type) {
    case 'embeddings':
      return await processEmbedding(item, chunk);
    case 'completions':
      return await processCompletion(item, chunk);
    case 'moderation':
      return await processModeration(item, chunk);
    case 'translation':
      return await processTranslation(item, chunk);
    case 'extraction':
      return await processExtraction(item, chunk);
    case 'classification':
      return await processClassification(item, chunk);
    default:
      throw new Error(`Unknown batch type: ${chunk.type}`);
  }
}

async function processEmbedding(item: BatchItem, chunk: BatchChunk): Promise<BatchResult> {
  // Call embedding API
  const response = await callRadiantAPI('/v2/embeddings', {
    model: chunk.model,
    input: item.input,
  });

  return {
    id: item.id,
    output: response.data[0].embedding,
    tokens_used: response.usage?.total_tokens,
  };
}

async function processCompletion(item: BatchItem, chunk: BatchChunk): Promise<BatchResult> {
  const systemPrompt = chunk.options.system_prompt as string || 'You are a helpful assistant.';
  
  const response = await callRadiantAPI('/v2/chat/completions', {
    model: chunk.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: item.input },
    ],
    max_tokens: chunk.options.max_tokens || 1000,
  });

  return {
    id: item.id,
    output: response.choices[0].message.content,
    tokens_used: response.usage?.total_tokens,
  };
}

async function processModeration(item: BatchItem, chunk: BatchChunk): Promise<BatchResult> {
  const response = await callRadiantAPI('/v2/moderations', {
    input: item.input,
  });

  return {
    id: item.id,
    output: response.results[0],
  };
}

async function processTranslation(item: BatchItem, chunk: BatchChunk): Promise<BatchResult> {
  const targetLanguage = chunk.options.target_language as string;
  
  const response = await callRadiantAPI('/v2/chat/completions', {
    model: chunk.model,
    messages: [
      { role: 'system', content: `Translate the following text to ${targetLanguage}. Only output the translation, nothing else.` },
      { role: 'user', content: item.input },
    ],
  });

  return {
    id: item.id,
    output: response.choices[0].message.content,
    tokens_used: response.usage?.total_tokens,
  };
}

async function processExtraction(item: BatchItem, chunk: BatchChunk): Promise<BatchResult> {
  const schema = chunk.options.schema as string;
  
  const response = await callRadiantAPI('/v2/chat/completions', {
    model: chunk.model,
    messages: [
      { role: 'system', content: `Extract information from the text and return it as JSON matching this schema: ${schema}` },
      { role: 'user', content: item.input },
    ],
    response_format: { type: 'json_object' },
  });

  let output;
  try {
    output = JSON.parse(response.choices[0].message.content);
  } catch (error) {
    // Response is not JSON, use raw content
    output = response.choices[0].message.content;
  }

  return {
    id: item.id,
    output,
    tokens_used: response.usage?.total_tokens,
  };
}

async function processClassification(item: BatchItem, chunk: BatchChunk): Promise<BatchResult> {
  const categories = chunk.options.categories as string[];
  
  const response = await callRadiantAPI('/v2/chat/completions', {
    model: chunk.model,
    messages: [
      { role: 'system', content: `Classify the following text into one of these categories: ${categories.join(', ')}. Return only the category name.` },
      { role: 'user', content: item.input },
    ],
  });

  return {
    id: item.id,
    output: {
      category: response.choices[0].message.content.trim(),
      text: item.input.substring(0, 100),
    },
    tokens_used: response.usage?.total_tokens,
  };
}

async function callRadiantAPI(endpoint: string, body: unknown): Promise<any> {
  const baseUrl = process.env.API_BASE_URL || '';
  const apiKey = process.env.INTERNAL_API_KEY;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Radiant-Batch': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function getInputData(key: string): Promise<string> {
  const response = await s3.send(new GetObjectCommand({
    Bucket: INPUT_BUCKET,
    Key: key,
  }));

  return await response.Body!.transformToString();
}

async function saveResults(key: string, results: BatchResult[]): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: OUTPUT_BUCKET,
    Key: key,
    Body: JSON.stringify(results, null, 2),
    ContentType: 'application/json',
  }));
}

async function updateChunkStatus(
  jobId: string,
  chunkId: string,
  status: string,
  metrics?: Record<string, unknown>
): Promise<void> {
  const updateExpression = ['SET #status = :status', 'updated_at = :now'];
  const expressionAttributeValues: Record<string, any> = {
    ':status': { S: status },
    ':now': { S: new Date().toISOString() },
  };

  if (metrics) {
    updateExpression.push('metrics = :metrics');
    expressionAttributeValues[':metrics'] = { S: JSON.stringify(metrics) };
  }

  await dynamodb.send(new UpdateItemCommand({
    TableName: JOBS_TABLE,
    Key: {
      pk: { S: `JOB#${jobId}` },
      sk: { S: `CHUNK#${chunkId}` },
    },
    UpdateExpression: updateExpression.join(', '),
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}
