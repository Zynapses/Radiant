/**
 * RADIANT v5.33.0 - Question Batching Service
 * 
 * Prevents question storms by intelligently batching related questions.
 * 
 * Three-layer batching approach:
 * 1. Time-window batching (30-60 seconds) - Collects questions arriving close together
 * 2. Correlation-based batching - Groups by workflow ID, entity, task type
 * 3. Semantic similarity batching - Clusters related questions using embeddings
 */

import { executeStatement, stringParam, longParam } from '../../db/client';
import { logger } from '../../utils/logger';

// Using enhanced logger from utils

// ============================================================================
// TYPES
// ============================================================================

export type BatchType = 'time_window' | 'correlation' | 'semantic';
export type BatchStatus = 'collecting' | 'ready' | 'presented' | 'completed' | 'expired';

export interface QuestionBatch {
  id: string;
  tenantId: string;
  userId?: string;
  batchType: BatchType;
  correlationKey?: string;
  status: BatchStatus;
  windowStart: Date;
  windowEnd?: Date;
  collectionWindowSeconds: number;
  questionCount: number;
  answeredCount: number;
  skippedCount: number;
  presentedAt?: Date;
  completedAt?: Date;
}

export interface BatchedQuestion {
  requestId: string;
  question: string;
  questionType: string;
  urgency: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  defaultValue?: unknown;
  isRequired: boolean;
  section?: string;
}

export interface BatchConfig {
  timeWindowSeconds: number;
  maxBatchSize: number;
  minBatchSize: number;
  correlationKeys: string[]; // Fields to use for correlation
  enableSemanticBatching: boolean;
  semanticSimilarityThreshold: number;
}

const DEFAULT_CONFIG: BatchConfig = {
  timeWindowSeconds: 30,
  maxBatchSize: 10,
  minBatchSize: 1,
  correlationKeys: ['workflow_id', 'entity_id', 'task_type'],
  enableSemanticBatching: true,
  semanticSimilarityThreshold: 0.7,
};

// ============================================================================
// BATCH MANAGEMENT
// ============================================================================

async function getOrCreateBatch(
  tenantId: string,
  userId: string | undefined,
  batchType: BatchType,
  correlationKey?: string,
  config: BatchConfig = DEFAULT_CONFIG
): Promise<QuestionBatch> {
  // Look for existing collecting batch
  const existingResult = await executeStatement({
    sql: `
      SELECT * FROM hitl_question_batches
      WHERE tenant_id = :tenantId
        AND status = 'collecting'
        AND batch_type = :batchType
        AND (user_id = :userId OR (user_id IS NULL AND :userId IS NULL))
        AND (correlation_key = :correlationKey OR (correlation_key IS NULL AND :correlationKey IS NULL))
        AND window_start > NOW() - INTERVAL '1 second' * :windowSeconds
      ORDER BY window_start DESC
      LIMIT 1
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('batchType', batchType),
      stringParam('userId', userId || ''),
      stringParam('correlationKey', correlationKey || ''),
      longParam('windowSeconds', config.timeWindowSeconds),
    ],
  });

  if (existingResult.rows && existingResult.rows.length > 0) {
    const row = existingResult.rows[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | undefined,
      batchType: row.batch_type as BatchType,
      correlationKey: row.correlation_key as string | undefined,
      status: row.status as BatchStatus,
      windowStart: new Date(row.window_start as string),
      windowEnd: row.window_end ? new Date(row.window_end as string) : undefined,
      collectionWindowSeconds: row.collection_window_seconds as number,
      questionCount: row.question_count as number,
      answeredCount: row.answered_count as number,
      skippedCount: row.skipped_count as number,
      presentedAt: row.presented_at ? new Date(row.presented_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }

  // Create new batch
  const insertResult = await executeStatement({
    sql: `
      INSERT INTO hitl_question_batches (
        tenant_id, user_id, batch_type, correlation_key,
        status, collection_window_seconds
      ) VALUES (
        :tenantId, :userId, :batchType, :correlationKey,
        'collecting', :windowSeconds
      )
      RETURNING *
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('userId', userId || ''),
      stringParam('batchType', batchType),
      stringParam('correlationKey', correlationKey || ''),
      longParam('windowSeconds', config.timeWindowSeconds),
    ],
  });

  const row = insertResult.rows![0];
  logger.info('Created new question batch', {
    batchId: row.id,
    tenantId,
    batchType,
    correlationKey,
  });

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: row.user_id as string | undefined,
    batchType: row.batch_type as BatchType,
    correlationKey: row.correlation_key as string | undefined,
    status: 'collecting',
    windowStart: new Date(row.window_start as string),
    windowEnd: undefined,
    collectionWindowSeconds: config.timeWindowSeconds,
    questionCount: 0,
    answeredCount: 0,
    skippedCount: 0,
  };
}

async function addQuestionToBatch(
  batchId: string,
  requestId: string
): Promise<void> {
  // Update the request with batch ID
  await executeStatement({
    sql: `
      UPDATE hitl_approval_requests
      SET batch_id = :batchId
      WHERE id = :requestId
    `,
    parameters: [
      stringParam('batchId', batchId),
      stringParam('requestId', requestId),
    ],
  });

  // Increment batch count
  await executeStatement({
    sql: `
      UPDATE hitl_question_batches
      SET question_count = question_count + 1
      WHERE id = :batchId
    `,
    parameters: [stringParam('batchId', batchId)],
  });
}

async function closeBatchWindow(batchId: string): Promise<void> {
  await executeStatement({
    sql: `
      UPDATE hitl_question_batches
      SET status = 'ready',
          window_end = NOW()
      WHERE id = :batchId AND status = 'collecting'
    `,
    parameters: [stringParam('batchId', batchId)],
  });

  logger.info('Closed batch window', { batchId });
}

async function markBatchPresented(batchId: string): Promise<void> {
  await executeStatement({
    sql: `
      UPDATE hitl_question_batches
      SET status = 'presented',
          presented_at = NOW()
      WHERE id = :batchId AND status = 'ready'
    `,
    parameters: [stringParam('batchId', batchId)],
  });
}

async function markBatchCompleted(batchId: string): Promise<void> {
  await executeStatement({
    sql: `
      UPDATE hitl_question_batches
      SET status = 'completed',
          completed_at = NOW()
      WHERE id = :batchId
    `,
    parameters: [stringParam('batchId', batchId)],
  });
}

async function recordAnswer(
  batchId: string,
  requestId: string,
  skipped: boolean
): Promise<void> {
  const field = skipped ? 'skipped_count' : 'answered_count';
  
  await executeStatement({
    sql: `
      UPDATE hitl_question_batches
      SET ${field} = ${field} + 1
      WHERE id = :batchId
    `,
    parameters: [stringParam('batchId', batchId)],
  });

  // Check if batch is complete
  const result = await executeStatement({
    sql: `
      SELECT question_count, answered_count, skipped_count
      FROM hitl_question_batches
      WHERE id = :batchId
    `,
    parameters: [stringParam('batchId', batchId)],
  });

  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    const total = (row.answered_count as number) + (row.skipped_count as number);
    if (total >= (row.question_count as number)) {
      await markBatchCompleted(batchId);
    }
  }
}

// ============================================================================
// BATCH RETRIEVAL
// ============================================================================

async function getBatchedQuestions(batchId: string): Promise<BatchedQuestion[]> {
  const result = await executeStatement({
    sql: `
      SELECT 
        id as request_id,
        request_summary as question,
        question_type,
        urgency,
        options,
        default_value,
        CASE WHEN urgency = 'blocking' THEN true ELSE false END as is_required
      FROM hitl_approval_requests
      WHERE batch_id = :batchId
        AND status = 'pending'
      ORDER BY 
        CASE urgency 
          WHEN 'blocking' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        created_at
    `,
    parameters: [stringParam('batchId', batchId)],
  });

  return (result.rows || []).map(row => ({
    requestId: row.request_id as string,
    question: row.question as string,
    questionType: (row.question_type as string) || 'free_text',
    urgency: (row.urgency as string) || 'normal',
    options: row.options as BatchedQuestion['options'],
    defaultValue: row.default_value,
    isRequired: row.is_required as boolean,
  }));
}

async function getReadyBatches(
  tenantId: string,
  userId?: string
): Promise<QuestionBatch[]> {
  const result = await executeStatement({
    sql: `
      SELECT * FROM hitl_question_batches
      WHERE tenant_id = :tenantId
        AND status = 'ready'
        AND (user_id = :userId OR user_id IS NULL)
      ORDER BY 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM hitl_approval_requests r 
            WHERE r.batch_id = hitl_question_batches.id 
              AND r.urgency = 'blocking'
          ) THEN 1
          ELSE 2
        END,
        window_start
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('userId', userId || ''),
    ],
  });

  return (result.rows || []).map(row => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: row.user_id as string | undefined,
    batchType: row.batch_type as BatchType,
    correlationKey: row.correlation_key as string | undefined,
    status: row.status as BatchStatus,
    windowStart: new Date(row.window_start as string),
    windowEnd: row.window_end ? new Date(row.window_end as string) : undefined,
    collectionWindowSeconds: row.collection_window_seconds as number,
    questionCount: row.question_count as number,
    answeredCount: row.answered_count as number,
    skippedCount: row.skipped_count as number,
    presentedAt: row.presented_at ? new Date(row.presented_at as string) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
  }));
}

// ============================================================================
// BATCH EXPIRATION
// ============================================================================

async function expireOldBatches(): Promise<number> {
  const result = await executeStatement({
    sql: `
      UPDATE hitl_question_batches
      SET status = 'expired'
      WHERE status IN ('collecting', 'ready')
        AND window_start < NOW() - INTERVAL '1 hour'
      RETURNING id
    `,
    parameters: [],
  });

  const expiredCount = result.rows?.length || 0;
  if (expiredCount > 0) {
    logger.info('Expired old batches', { count: expiredCount });
  }

  return expiredCount;
}

async function closeExpiredWindows(): Promise<number> {
  const result = await executeStatement({
    sql: `
      UPDATE hitl_question_batches
      SET status = 'ready',
          window_end = NOW()
      WHERE status = 'collecting'
        AND window_start < NOW() - INTERVAL '1 second' * collection_window_seconds
      RETURNING id
    `,
    parameters: [],
  });

  const closedCount = result.rows?.length || 0;
  if (closedCount > 0) {
    logger.info('Closed expired collection windows', { count: closedCount });
  }

  return closedCount;
}

// ============================================================================
// CORRELATION KEY EXTRACTION
// ============================================================================

function extractCorrelationKey(
  context: Record<string, unknown>,
  keys: string[]
): string | undefined {
  const parts: string[] = [];
  
  for (const key of keys) {
    const value = context[key];
    if (value !== undefined && value !== null) {
      parts.push(`${key}:${String(value)}`);
    }
  }

  return parts.length > 0 ? parts.join('|') : undefined;
}

// ============================================================================
// SEMANTIC BATCHING (placeholder for embedding-based clustering)
// ============================================================================

async function findSemanticBatch(
  tenantId: string,
  questionText: string,
  threshold: number = 0.7
): Promise<string | undefined> {
  // Try embedding-based similarity first
  const embeddingMatch = await findBatchByEmbedding(tenantId, questionText, threshold);
  if (embeddingMatch) return embeddingMatch;
  
  // Fallback to keyword matching if embedding service unavailable
  const keywords = questionText.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  
  if (keywords.length === 0) return undefined;

  // Look for batches with similar questions
  const result = await executeStatement({
    sql: `
      SELECT b.id, r.request_summary
      FROM hitl_question_batches b
      JOIN hitl_approval_requests r ON r.batch_id = b.id
      WHERE b.tenant_id = :tenantId
        AND b.status = 'collecting'
        AND b.batch_type = 'semantic'
      LIMIT 10
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  for (const row of result.rows || []) {
    const existingText = (row.request_summary as string).toLowerCase();
    let matchCount = 0;
    
    for (const keyword of keywords) {
      if (existingText.includes(keyword)) {
        matchCount++;
      }
    }

    const similarity = matchCount / keywords.length;
    if (similarity >= 0.5) {
      return row.id as string;
    }
  }

  return undefined;
}

/**
 * Find batch using embedding-based semantic similarity
 */
async function findBatchByEmbedding(
  tenantId: string,
  questionText: string,
  threshold: number
): Promise<string | undefined> {
  try {
    const { callLiteLLMEmbedding } = await import('../litellm.service.js');
    
    // Generate embedding for the question
    const embeddingResponse = await callLiteLLMEmbedding({
      model: 'text-embedding-3-small',
      input: questionText,
    });
    
    const questionEmbedding = embeddingResponse.data[0].embedding;
    
    // Query for similar batches using pgvector cosine similarity
    const result = await executeStatement({
      sql: `
        SELECT b.id, b.embedding, 
               1 - (b.embedding <=> :embedding::vector) as similarity
        FROM hitl_question_batches b
        WHERE b.tenant_id = :tenantId
          AND b.status = 'collecting'
          AND b.batch_type = 'semantic'
          AND b.embedding IS NOT NULL
          AND 1 - (b.embedding <=> :embedding::vector) >= :threshold
        ORDER BY similarity DESC
        LIMIT 1
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        { name: 'embedding', value: { stringValue: JSON.stringify(questionEmbedding) } },
        { name: 'threshold', value: { doubleValue: threshold } },
      ],
    });
    
    if (result.rows && result.rows.length > 0) {
      return result.rows[0].id as string;
    }
  } catch (error) {
    // Embedding service unavailable, fall back to keyword matching
  }
  
  return undefined;
}

// ============================================================================
// MAIN API
// ============================================================================

async function batchQuestion(
  tenantId: string,
  requestId: string,
  questionText: string,
  userId?: string,
  context: Record<string, unknown> = {},
  config: BatchConfig = DEFAULT_CONFIG
): Promise<{ batchId: string; isNew: boolean }> {
  // 1. Try correlation-based batching first
  const correlationKey = extractCorrelationKey(context, config.correlationKeys);
  if (correlationKey) {
    const batch = await getOrCreateBatch(
      tenantId,
      userId,
      'correlation',
      correlationKey,
      config
    );
    const isNew = batch.questionCount === 0;
    await addQuestionToBatch(batch.id, requestId);
    return { batchId: batch.id, isNew };
  }

  // 2. Try semantic batching
  if (config.enableSemanticBatching) {
    const semanticBatchId = await findSemanticBatch(
      tenantId,
      questionText,
      config.semanticSimilarityThreshold
    );
    if (semanticBatchId) {
      await addQuestionToBatch(semanticBatchId, requestId);
      return { batchId: semanticBatchId, isNew: false };
    }
  }

  // 3. Fall back to time-window batching
  const batch = await getOrCreateBatch(
    tenantId,
    userId,
    'time_window',
    undefined,
    config
  );
  const isNew = batch.questionCount === 0;
  await addQuestionToBatch(batch.id, requestId);
  return { batchId: batch.id, isNew };
}

async function getBatchStatistics(tenantId: string): Promise<{
  totalBatches: number;
  avgQuestionsPerBatch: number;
  avgAnswerTime: number;
  completionRate: number;
  byType: Record<string, number>;
}> {
  const result = await executeStatement({
    sql: `
      SELECT 
        COUNT(*) as total,
        AVG(question_count) as avg_questions,
        AVG(EXTRACT(EPOCH FROM (completed_at - presented_at))) as avg_answer_time,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / 
          NULLIF(COUNT(CASE WHEN status IN ('completed', 'expired') THEN 1 END), 0) as completion_rate
      FROM hitl_question_batches
      WHERE tenant_id = :tenantId
        AND created_at > NOW() - INTERVAL '30 days'
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const typeResult = await executeStatement({
    sql: `
      SELECT batch_type, COUNT(*) as count
      FROM hitl_question_batches
      WHERE tenant_id = :tenantId
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY batch_type
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const row = result.rows?.[0] || {};
  const byType: Record<string, number> = {};

  for (const r of typeResult.rows || []) {
    byType[r.batch_type as string] = Number(r.count);
  }

  return {
    totalBatches: Number(row.total) || 0,
    avgQuestionsPerBatch: Number(row.avg_questions) || 0,
    avgAnswerTime: Number(row.avg_answer_time) || 0,
    completionRate: Number(row.completion_rate) || 0,
    byType,
  };
}

export const batchingService = {
  batchQuestion,
  getOrCreateBatch,
  addQuestionToBatch,
  closeBatchWindow,
  markBatchPresented,
  markBatchCompleted,
  recordAnswer,
  getBatchedQuestions,
  getReadyBatches,
  expireOldBatches,
  closeExpiredWindows,
  extractCorrelationKey,
  getBatchStatistics,
  DEFAULT_CONFIG,
};
