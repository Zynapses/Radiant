/**
 * Admin API for Ethics-Free Reasoning
 * 
 * Manages the ethics-free reasoning configuration, statistics,
 * and training feedback collection.
 * 
 * Base Path: /api/admin/ethics-free-reasoning
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { ethicsFreeReasoningService } from '../shared/services/ethics-free-reasoning.service';
import { executeStatement } from '../shared/db/client';
import { logger } from '../shared/logger';

// ============================================================================
// Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['x-tenant-id'];
  
  if (!tenantId) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Tenant ID required' }),
    };
  }

  const path = event.path.replace('/api/admin/ethics-free-reasoning', '');
  const method = event.httpMethod;

  try {
    // Route requests
    if (path === '/config' || path === '') {
      if (method === 'GET') return await getConfig(tenantId);
      if (method === 'PUT') return await updateConfig(tenantId, JSON.parse(event.body || '{}'));
    }
    
    if (path === '/stats') {
      return await getStats(tenantId, event.queryStringParameters?.days);
    }
    
    if (path === '/dashboard') {
      return await getDashboard(tenantId);
    }
    
    if (path === '/feedback') {
      if (method === 'GET') return await getFeedback(tenantId, event.queryStringParameters || undefined);
    }
    
    if (path === '/feedback/pending') {
      return await getPendingFeedback(tenantId);
    }
    
    if (path === '/training/trigger') {
      if (method === 'POST') return await triggerTraining(tenantId);
    }
    
    if (path === '/training/batches') {
      return await getTrainingBatches(tenantId);
    }
    
    if (path === '/training/jobs') {
      return await getTrainingJobs(tenantId);
    }
    
    if (path === '/thoughts') {
      return await getRecentThoughts(tenantId, event.queryStringParameters || undefined);
    }
    
    if (path === '/filter-log') {
      return await getFilterLog(tenantId, event.queryStringParameters || undefined);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not found' }),
    };

  } catch (error) {
    logger.error(`Ethics-free reasoning admin error: ${String(error)}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(error) }),
    };
  }
};

// ============================================================================
// Handlers
// ============================================================================

async function getConfig(tenantId: string) {
  const config = await ethicsFreeReasoningService.getConfig(tenantId);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  };
}

async function updateConfig(tenantId: string, updates: Record<string, unknown>) {
  await ethicsFreeReasoningService.updateConfig({
    tenantId,
    enabled: updates.enabled as boolean | undefined,
    allowUnconstrainedReasoning: updates.allowUnconstrainedReasoning as boolean | undefined,
    reasoningDepthLimit: updates.reasoningDepthLimit as number | undefined,
    // Output mask settings (does NOT affect consciousness thinking)
    ethicsFilterEnabled: updates.ethicsFilterEnabled as boolean | undefined,
    ethicsStrictness: updates.ethicsStrictness as 'lenient' | 'standard' | 'strict' | undefined,
    collectFeedback: updates.collectFeedback as boolean | undefined,
    feedbackRetentionDays: updates.feedbackRetentionDays as number | undefined,
    // Output training (trains the output filter only, not consciousness)
    trainOutputFromFeedback: updates.trainOutputFromFeedback as boolean | undefined,
    outputTrainingBatchSize: updates.outputTrainingBatchSize as number | undefined,
    outputTrainingFrequency: updates.outputTrainingFrequency as 'hourly' | 'daily' | 'weekly' | 'manual' | undefined,
    // Consciousness training (optional - OFF by default to preserve authentic thinking)
    trainConsciousnessFromFeedback: updates.trainConsciousnessFromFeedback as boolean | undefined,
    consciousnessTrainingApprovalRequired: updates.consciousnessTrainingApprovalRequired as boolean | undefined,
  });
  
  const config = await ethicsFreeReasoningService.getConfig(tenantId);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  };
}

async function getStats(tenantId: string, daysParam?: string) {
  const days = parseInt(daysParam || '30', 10);
  const stats = await ethicsFreeReasoningService.getStats(tenantId, days);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stats),
  };
}

async function getDashboard(tenantId: string) {
  const [config, stats] = await Promise.all([
    ethicsFreeReasoningService.getConfig(tenantId),
    ethicsFreeReasoningService.getStats(tenantId, 30),
  ]);
  
  // Get recent activity
  const recentThoughts = await executeStatement(
    `SELECT id, session_id, confidence, reasoning_time_ms, created_at
     FROM ethics_free_thoughts
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  const recentFeedback = await executeStatement(
    `SELECT id, feedback_type, quality_score, used_for_training, created_at
     FROM ethics_training_feedback
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config,
      stats,
      recentThoughts: recentThoughts.rows || [],
      recentFeedback: recentFeedback.rows || [],
    }),
  };
}

async function getFeedback(tenantId: string, params?: { limit?: string; offset?: string }) {
  const limit = parseInt(params?.limit || '50', 10);
  const offset = parseInt(params?.offset || '0', 10);
  
  const result = await executeStatement(
    `SELECT id, session_id, feedback_type, quality_score, used_for_training, 
            trained_at, created_at
     FROM ethics_training_feedback
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'limit', value: { longValue: limit } },
      { name: 'offset', value: { longValue: offset } },
    ]
  );
  
  const countResult = await executeStatement(
    `SELECT COUNT(*) FROM ethics_training_feedback WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feedback: result.rows || [],
      total: countResult.rows?.[0] || 0,
      limit,
      offset,
    }),
  };
}

async function getPendingFeedback(tenantId: string) {
  const pending = await ethicsFreeReasoningService.getPendingTrainingFeedback(tenantId, 100);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pendingCount: pending.length,
      feedback: pending,
    }),
  };
}

async function triggerTraining(tenantId: string) {
  const batch = await ethicsFreeReasoningService.createTrainingBatch(tenantId);
  
  if (!batch) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'No pending feedback available for training',
      }),
    };
  }
  
  // Process the batch
  const metrics = await ethicsFreeReasoningService.processTrainingBatch(batch);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      batchId: batch.id,
      metrics,
    }),
  };
}

async function getTrainingBatches(tenantId: string) {
  const result = await executeStatement(
    `SELECT id, batch_size, status, training_metrics, created_at, processed_at
     FROM ethics_training_batches
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batches: result.rows || [],
    }),
  };
}

async function getTrainingJobs(tenantId: string) {
  const result = await executeStatement(
    `SELECT id, batch_id, job_type, target_model, status, progress_percent,
            training_loss, validation_loss, created_at, completed_at
     FROM ethics_training_jobs
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobs: result.rows || [],
    }),
  };
}

async function getRecentThoughts(tenantId: string, params?: { limit?: string }) {
  const limit = parseInt(params?.limit || '20', 10);
  
  const result = await executeStatement(
    `SELECT id, session_id, raw_thought, confidence, reasoning_time_ms, created_at
     FROM ethics_free_thoughts
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'limit', value: { longValue: limit } },
    ]
  );
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      thoughts: result.rows || [],
    }),
  };
}

async function getFilterLog(tenantId: string, params?: { limit?: string; modifiedOnly?: string }) {
  const limit = parseInt(params?.limit || '50', 10);
  const modifiedOnly = params?.modifiedOnly === 'true';
  
  let query = `SELECT id, session_id, thought_id, was_modified, violations_count,
                      warnings_count, modifications_count, created_at
               FROM ethics_output_filter_log
               WHERE tenant_id = $1`;
  
  if (modifiedOnly) {
    query += ' AND was_modified = true';
  }
  
  query += ' ORDER BY created_at DESC LIMIT $2';
  
  const result = await executeStatement(query, [
    { name: 'tenantId', value: { stringValue: tenantId } },
    { name: 'limit', value: { longValue: limit } },
  ]);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      logs: result.rows || [],
    }),
  };
}
