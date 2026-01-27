/**
 * Batch Writer Lambda Handler
 * 
 * Processes SQS batches of AI model execution results and writes them
 * efficiently to PostgreSQL using bulk inserts.
 * 
 * Architecture:
 * User Request → Lambda → 6 AI Models (parallel) → SQS Queue → This Lambda → PostgreSQL
 * 
 * Benefits:
 * - Eliminates connection exhaustion during traffic spikes
 * - Batches writes for 10-50x efficiency improvement
 * - Provides retry/DLQ for transient failures
 * - Decouples request latency from database write latency
 * 
 * @see OpenAI PostgreSQL scaling patterns
 */

import { SQSHandler, SQSBatchResponse, SQSRecord } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client, Pool } from 'pg';

// Types for batch write payloads
interface ModelExecutionLog {
  type: 'model_log';
  id: string;
  tenant_id: string;
  request_id: string;
  user_id?: string;
  model_id: string;
  model_provider?: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  response_hash?: string;
  status: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface UsageRecord {
  type: 'usage';
  id: string;
  tenant_id: string;
  user_id?: string;
  timestamp: string;
  resource_type: string;
  resource_id?: string;
  quantity: number;
  unit: string;
  cost_microcents: number;
  metadata?: Record<string, unknown>;
}

interface PromptResult {
  type: 'prompt_result';
  id: string;
  tenant_id: string;
  request_id: string;
  user_id?: string;
  prompt_text?: string;
  prompt_hash?: string;
  result_text?: string;
  result_hash?: string;
  orchestration_mode?: string;
  models_used?: string[];
  total_latency_ms?: number;
  cached?: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

type BatchWritePayload = ModelExecutionLog | UsageRecord | PromptResult;

// Connection pool (reused across invocations)
let pool: Pool | null = null;
let dbCredentials: { username: string; password: string } | null = null;

const secretsClient = new SecretsManagerClient({});

/**
 * Get database credentials from Secrets Manager
 */
async function getDbCredentials(): Promise<{ username: string; password: string }> {
  if (dbCredentials) {
    return dbCredentials;
  }

  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable not set');
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  const secret = JSON.parse(response.SecretString);
  dbCredentials = {
    username: secret.username,
    password: secret.password,
  };

  return dbCredentials;
}

/**
 * Get or create connection pool
 * Uses RDS Proxy endpoint for connection multiplexing
 */
async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const credentials = await getDbCredentials();
  const proxyEndpoint = process.env.RDS_PROXY_ENDPOINT;

  if (!proxyEndpoint) {
    throw new Error('RDS_PROXY_ENDPOINT environment variable not set');
  }

  pool = new Pool({
    host: proxyEndpoint,
    port: 5432,
    database: 'radiant',
    user: credentials.username,
    password: credentials.password,
    ssl: { rejectUnauthorized: true },
    // Small pool since RDS Proxy handles pooling
    max: 5,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Statement timeout to prevent long-running queries
    statement_timeout: 30000,
  });

  return pool;
}

/**
 * Parse and validate SQS records
 */
function parseRecords(records: SQSRecord[]): { payload: BatchWritePayload; messageId: string }[] {
  const results: { payload: BatchWritePayload; messageId: string }[] = [];

  for (const record of records) {
    try {
      const payload = JSON.parse(record.body) as BatchWritePayload;
      
      // Validate required fields
      if (!payload.type || !payload.tenant_id) {
        console.warn(`Invalid payload missing type or tenant_id: ${record.messageId}`);
        continue;
      }

      results.push({ payload, messageId: record.messageId });
    } catch (error) {
      console.error(`Failed to parse record ${record.messageId}:`, error);
    }
  }

  return results;
}

/**
 * Batch insert model execution logs
 */
async function insertModelLogs(client: Client | any, logs: ModelExecutionLog[]): Promise<void> {
  if (logs.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const log of logs) {
    placeholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
      `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
      `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    );
    values.push(
      log.id,
      log.tenant_id,
      log.request_id,
      log.user_id || null,
      log.model_id,
      log.model_provider || null,
      log.prompt_tokens,
      log.completion_tokens,
      log.latency_ms,
      log.response_hash || null,
      log.status,
      log.error_message || null,
      JSON.stringify(log.metadata || {})
    );
  }

  const query = `
    INSERT INTO model_execution_logs_partitioned 
    (id, tenant_id, request_id, user_id, model_id, model_provider, 
     prompt_tokens, completion_tokens, latency_ms, response_hash, 
     status, error_message, metadata)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (tenant_id, id, created_at) DO NOTHING
  `;

  await client.query(query, values);
  console.log(`Inserted ${logs.length} model execution logs`);
}

/**
 * Batch insert usage records
 */
async function insertUsageRecords(client: Client | any, records: UsageRecord[]): Promise<void> {
  if (records.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const record of records) {
    placeholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
      `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
      `$${paramIndex++}, $${paramIndex++})`
    );
    values.push(
      record.id,
      record.tenant_id,
      record.user_id || null,
      record.timestamp,
      record.resource_type,
      record.resource_id || null,
      record.quantity,
      record.unit,
      record.cost_microcents,
      JSON.stringify(record.metadata || {})
    );
  }

  const query = `
    INSERT INTO usage_records_partitioned 
    (id, tenant_id, user_id, timestamp, resource_type, resource_id, 
     quantity, unit, cost_microcents, metadata)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (tenant_id, id, timestamp) DO NOTHING
  `;

  await client.query(query, values);
  console.log(`Inserted ${records.length} usage records`);
}

/**
 * Batch insert prompt results
 */
async function insertPromptResults(client: Client | any, results: PromptResult[]): Promise<void> {
  if (results.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const result of results) {
    placeholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
      `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
      `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    );
    values.push(
      result.id,
      result.tenant_id,
      result.request_id,
      result.user_id || null,
      result.prompt_text || null,
      result.prompt_hash || null,
      result.result_text || null,
      result.result_hash || null,
      result.orchestration_mode || null,
      result.models_used || null,
      result.total_latency_ms || null,
      result.cached || false,
      JSON.stringify(result.metadata || {})
    );
  }

  const query = `
    INSERT INTO prompt_results 
    (id, tenant_id, request_id, user_id, prompt_text, prompt_hash, 
     result_text, result_hash, orchestration_mode, models_used, 
     total_latency_ms, cached, metadata)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (tenant_id, id) DO NOTHING
  `;

  await client.query(query, values);
  console.log(`Inserted ${results.length} prompt results`);
}

/**
 * Main handler - processes SQS batch with partial failure reporting
 */
export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const startTime = Date.now();
  const failedMessageIds: string[] = [];

  console.log(`Processing batch of ${event.Records.length} records`);

  // Parse all records
  const parsedRecords = parseRecords(event.Records);
  
  // Group by type for efficient batch inserts
  const modelLogs: ModelExecutionLog[] = [];
  const usageRecords: UsageRecord[] = [];
  const promptResults: PromptResult[] = [];
  const messageIdsByType: Map<string, string[]> = new Map([
    ['model_log', []],
    ['usage', []],
    ['prompt_result', []],
  ]);

  for (const { payload, messageId } of parsedRecords) {
    switch (payload.type) {
      case 'model_log':
        modelLogs.push(payload);
        messageIdsByType.get('model_log')!.push(messageId);
        break;
      case 'usage':
        usageRecords.push(payload);
        messageIdsByType.get('usage')!.push(messageId);
        break;
      case 'prompt_result':
        promptResults.push(payload);
        messageIdsByType.get('prompt_result')!.push(messageId);
        break;
      default:
        console.warn(`Unknown payload type: ${(payload as { type: string }).type}`);
    }
  }

  // Get database connection
  const dbPool = await getPool();
  const client = await dbPool.connect();

  try {
    // Start transaction for atomicity
    await client.query('BEGIN');

    // Insert each type with error tracking
    try {
      await insertModelLogs(client, modelLogs);
    } catch (error) {
      console.error('Failed to insert model logs:', error);
      failedMessageIds.push(...(messageIdsByType.get('model_log') || []));
    }

    try {
      await insertUsageRecords(client, usageRecords);
    } catch (error) {
      console.error('Failed to insert usage records:', error);
      failedMessageIds.push(...(messageIdsByType.get('usage') || []));
    }

    try {
      await insertPromptResults(client, promptResults);
    } catch (error) {
      console.error('Failed to insert prompt results:', error);
      failedMessageIds.push(...(messageIdsByType.get('prompt_result') || []));
    }

    // Commit if no failures, rollback otherwise
    if (failedMessageIds.length === 0) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

  } catch (error) {
    console.error('Transaction failed:', error);
    await client.query('ROLLBACK');
    
    // Mark all messages as failed
    for (const { messageId } of parsedRecords) {
      failedMessageIds.push(messageId);
    }
  } finally {
    client.release();
  }

  const duration = Date.now() - startTime;
  console.log(`Batch processing complete in ${duration}ms. Failed: ${failedMessageIds.length}/${event.Records.length}`);

  // Return partial batch failure response
  return {
    batchItemFailures: failedMessageIds.map(id => ({ itemIdentifier: id })),
  };
};

/**
 * Graceful shutdown - close pool on Lambda container freeze
 */
process.on('beforeExit', async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
});
