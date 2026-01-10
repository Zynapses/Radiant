/**
 * RADIANT v6.1.0 - Cognition Admin API Handler
 * Admin endpoints for Advanced Cognition services
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { executeStatement, toSqlParams, stringParam, longParam } from '../shared/db/client';
import {
  reasoningTeacher,
  inferenceStudent,
  semanticCache,
  rewardModel,
  counterfactualSimulator,
  curiosityEngine,
  causalTracker,
  metacognitionService,
} from '../shared/services/cognition';

// =============================================================================
// Response Helpers
// =============================================================================

function success(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: message }),
  };
}

function getTenantId(event: APIGatewayProxyEvent): string {
  return event.requestContext.authorizer?.tenantId || 
         event.headers['x-tenant-id'] || 
         '';
}

function getUserId(event: APIGatewayProxyEvent): string {
  return event.requestContext.authorizer?.userId ||
         event.headers['x-user-id'] ||
         '';
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // =========================================================================
    // Teacher Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/teacher/generate' && method === 'POST') {
      return generateTeacherTrace(event);
    }
    if (path === '/api/cognition/teacher/validate' && method === 'POST') {
      return validateTeacherTrace(event);
    }
    if (path === '/api/cognition/teacher/stats' && method === 'GET') {
      return getTeacherStats(event);
    }
    if (path === '/api/cognition/teacher/traces' && method === 'GET') {
      return getTeacherTraces(event);
    }

    // =========================================================================
    // Student Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/student/infer' && method === 'POST') {
      return studentInfer(event);
    }
    if (path === '/api/cognition/student/versions' && method === 'GET') {
      return getStudentVersions(event);
    }
    if (path === '/api/cognition/student/promote' && method === 'POST') {
      return promoteStudentVersion(event);
    }

    // =========================================================================
    // Distillation Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/distillation/jobs' && method === 'GET') {
      return getDistillationJobs(event);
    }
    if (path === '/api/cognition/distillation/start' && method === 'POST') {
      return startDistillationJob(event);
    }

    // =========================================================================
    // Cache Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/cache/get' && method === 'POST') {
      return cacheGet(event);
    }
    if (path === '/api/cognition/cache/set' && method === 'POST') {
      return cacheSet(event);
    }
    if (path === '/api/cognition/cache/invalidate' && method === 'POST') {
      return cacheInvalidate(event);
    }
    if (path === '/api/cognition/cache/metrics' && method === 'GET') {
      return getCacheMetrics(event);
    }

    // =========================================================================
    // Metacognition Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/metacognition/assess' && method === 'POST') {
      return metacognitionAssess(event);
    }
    if (path === '/api/cognition/metacognition/stats' && method === 'GET') {
      return getMetacognitionStats(event);
    }

    // =========================================================================
    // Reward Model Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/reward/score' && method === 'POST') {
      return rewardScore(event);
    }
    if (path === '/api/cognition/reward/select-best' && method === 'POST') {
      return rewardSelectBest(event);
    }

    // =========================================================================
    // Counterfactual Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/counterfactual/candidates' && method === 'GET') {
      return getCounterfactualCandidates(event);
    }
    if (path === '/api/cognition/counterfactual/simulate' && method === 'POST') {
      return simulateCounterfactual(event);
    }
    if (path === '/api/cognition/counterfactual/results' && method === 'GET') {
      return getCounterfactualResults(event);
    }

    // =========================================================================
    // Curiosity Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/curiosity/gaps' && method === 'GET') {
      return getKnowledgeGaps(event);
    }
    if (path === '/api/cognition/curiosity/goals' && method === 'GET') {
      return getCuriosityGoals(event);
    }
    if (path === '/api/cognition/curiosity/explore' && method === 'POST') {
      return exploreKnowledgeGap(event);
    }

    // =========================================================================
    // Causal Tracker Endpoints
    // =========================================================================
    
    if (path === '/api/cognition/causal/link' && method === 'POST') {
      return recordCausalLink(event);
    }
    if (path === '/api/cognition/causal/chain' && method === 'GET') {
      return getCausalChain(event);
    }

    // =========================================================================
    // Dashboard
    // =========================================================================
    
    if (path === '/api/cognition/dashboard' && method === 'GET') {
      return getDashboard(event);
    }

    return error(404, `Not found: ${method} ${path}`);
  } catch (err) {
    logger.error('Cognition API error', err as Error, { path, method });
    return error(500, err instanceof Error ? err.message : 'Internal server error');
  }
}

// =============================================================================
// Teacher Handlers
// =============================================================================

async function generateTeacherTrace(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  
  if (!body.prompt) {
    return error(400, 'Missing required field: prompt');
  }

  const trace = await reasoningTeacher.generateReasoningTrace(
    body.prompt,
    body.context || {},
    body.taskType || 'general',
    body.domainIds || [],
    tenantId
  );

  return success({ trace });
}

async function validateTeacherTrace(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = getUserId(event);
  
  if (!body.traceId || body.qualityScore === undefined) {
    return error(400, 'Missing required fields: traceId, qualityScore');
  }

  await reasoningTeacher.validateTrace(body.traceId, body.qualityScore, userId);
  return success({ success: true });
}

async function getTeacherStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  const result = await executeStatement(`
    SELECT 
      status,
      COUNT(*) as count,
      AVG(quality_score) as avg_quality,
      SUM(cost_usd) as total_cost
    FROM distillation_training_data
    WHERE tenant_id = $1
    GROUP BY status
  `, [stringParam('tenantId', tenantId)]);

  const stats: Record<string, { count: number; avgQuality: number | null; totalCost: number }> = {};
  for (const row of result.rows || []) {
    const r = row as { status: string; count: string; avg_quality: string | null; total_cost: string | null };
    stats[r.status] = {
      count: parseInt(r.count, 10),
      avgQuality: r.avg_quality ? parseFloat(r.avg_quality) : null,
      totalCost: parseFloat(r.total_cost || '0'),
    };
  }

  return success(stats);
}

async function getTeacherTraces(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const status = event.queryStringParameters?.status || 'pending';
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  const result = await executeStatement(`
    SELECT id, input_prompt, task_type, teacher_model_id, confidence_score, 
           quality_score, status, created_at
    FROM distillation_training_data
    WHERE tenant_id = $1 AND status = $2
    ORDER BY created_at DESC
    LIMIT $3
  `, [stringParam('tenantId', tenantId), stringParam('status', status), longParam('limit', limit)]);

  return success({ traces: result.rows || [] });
}

// =============================================================================
// Student Handlers
// =============================================================================

async function studentInfer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  
  if (!body.prompt) {
    return error(400, 'Missing required field: prompt');
  }

  const response = await inferenceStudent.generateSingle(
    body.prompt,
    body.context || {},
    tenantId,
    userId
  );

  return success({ response });
}

async function getStudentVersions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  const result = await executeStatement(`
    SELECT id, version_number, base_model, training_examples_count, 
           accuracy_score, latency_p50_ms, is_active, created_at
    FROM inference_student_versions
    WHERE tenant_id = $1
    ORDER BY version_number DESC
    LIMIT 20
  `, [stringParam('tenantId', tenantId)]);

  return success({ versions: result.rows || [] });
}

async function promoteStudentVersion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  
  if (!body.versionId) {
    return error(400, 'Missing required field: versionId');
  }

  await inferenceStudent.promote(tenantId, body.versionId);
  return success({ success: true });
}

// =============================================================================
// Distillation Handlers
// =============================================================================

async function getDistillationJobs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  const result = await executeStatement(`
    SELECT id, status, examples_collected, training_job_arn, 
           started_at, completed_at, error_message
    FROM distillation_jobs
    WHERE tenant_id = $1
    ORDER BY started_at DESC
    LIMIT 20
  `, [stringParam('tenantId', tenantId)]);

  return success({ jobs: result.rows || [] });
}

async function startDistillationJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  // Distillation jobs are triggered by LoRA evolution pipeline, not directly
  return error(501, 'Distillation jobs are managed by the LoRA evolution pipeline');
}

// =============================================================================
// Cache Handlers
// =============================================================================

async function cacheGet(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  
  if (!body.prompt || !body.modelId) {
    return error(400, 'Missing required fields: prompt, modelId');
  }

  const cached = await semanticCache.get(
    body.prompt,
    tenantId,
    body.modelId,
    body.domainIds || []
  );

  if (cached) {
    return success({ hit: true, response: cached.response });
  }
  return success({ hit: false });
}

async function cacheSet(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  
  if (!body.prompt || !body.response || !body.modelId) {
    return error(400, 'Missing required fields: prompt, response, modelId');
  }

  const id = await semanticCache.set(
    body.prompt,
    body.response,
    tenantId,
    body.modelId,
    body.domainIds || [],
    body.contentType || 'factual'
  );

  return success({ id });
}

async function cacheInvalidate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);

  const deleted = await semanticCache.invalidate(tenantId, {
    modelId: body.modelId,
    domainIds: body.domainIds,
    olderThan: body.olderThan ? new Date(body.olderThan) : undefined,
  });

  return success({ deleted });
}

async function getCacheMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  const metrics = await semanticCache.getMetrics(tenantId);
  return success(metrics);
}

// =============================================================================
// Metacognition Handlers
// =============================================================================

async function metacognitionAssess(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  
  if (!body.prompt || !body.response) {
    return error(400, 'Missing required fields: prompt, response');
  }

  const assessment = await metacognitionService.assessConfidence(
    tenantId,
    body.response,
    'response'
  );

  return success(assessment);
}

async function getMetacognitionStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  const result = await executeStatement(`
    SELECT 
      AVG(overall_confidence) as avg_confidence,
      COUNT(*) FILTER (WHERE suggested_action = 'escalate') as escalation_count,
      COUNT(*) as total_count
    FROM confidence_assessments
    WHERE tenant_id = $1
      AND created_at > NOW() - INTERVAL '7 days'
  `, [stringParam('tenantId', tenantId)]);

  const row = (result.rows?.[0] || {}) as { avg_confidence?: string; escalation_count?: string; total_count?: string };
  const totalCount = parseInt(row.total_count || '0', 10);
  return success({
    avgConfidence: parseFloat(row.avg_confidence || '0'),
    escalationRate: totalCount > 0 
      ? parseInt(row.escalation_count || '0', 10) / totalCount
      : 0,
    totalAssessments: totalCount,
  });
}

// =============================================================================
// Reward Model Handlers
// =============================================================================

async function rewardScore(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  
  if (!body.responses || !Array.isArray(body.responses)) {
    return error(400, 'Missing required field: responses (array)');
  }

  const context = {
    userId,
    tenantId,
    conversationHistory: body.conversationHistory || [],
    originalPrompt: body.prompt || '',
    domainIds: body.domainIds || [],
    userPreferences: body.userPreferences || {
      responseLength: 'balanced' as const,
      formalityLevel: 'professional' as const,
      preferredModels: [],
    },
  };

  const scores = await rewardModel.scoreMultiple(body.responses, context);
  return success({ scores });
}

async function rewardSelectBest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  
  if (!body.responses || !Array.isArray(body.responses)) {
    return error(400, 'Missing required field: responses (array)');
  }

  const context = {
    userId,
    tenantId,
    conversationHistory: body.conversationHistory || [],
    originalPrompt: body.prompt || '',
    domainIds: body.domainIds || [],
    userPreferences: body.userPreferences || {
      responseLength: 'balanced' as const,
      formalityLevel: 'professional' as const,
      preferredModels: [],
    },
  };

  const { selected, scores } = await rewardModel.selectBest(body.responses, context);
  return success({ selected, scores });
}

// =============================================================================
// Counterfactual Handlers
// =============================================================================

async function getCounterfactualCandidates(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  const result = await executeStatement(`
    SELECT id, request_id, original_model, alternative_models, 
           created_at, simulated
    FROM counterfactual_candidates
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [stringParam('tenantId', tenantId), longParam('limit', limit)]);

  return success({ candidates: result.rows || [] });
}

async function simulateCounterfactual(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  
  if (!body.candidateId || !body.alternativeModel) {
    return error(400, 'Missing required fields: candidateId, alternativeModel');
  }

  const result = await counterfactualSimulator.simulateAlternative(
    body.candidateId,
    body.alternativeModel,
    body.reason || 'manual'
  );

  return success(result);
}

async function getCounterfactualResults(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  const results = await counterfactualSimulator.getSimulations(tenantId, { limit });
  return success({ results });
}

// =============================================================================
// Curiosity Handlers
// =============================================================================

async function getKnowledgeGaps(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const status = event.queryStringParameters?.status;

  const gaps = await curiosityEngine.getKnowledgeGaps(tenantId, { minImportance: 0 });
  return success({ gaps });
}

async function getCuriosityGoals(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const status = event.queryStringParameters?.status;

  const goals = await curiosityEngine.getActiveGoals(tenantId);
  return success({ goals });
}

async function exploreKnowledgeGap(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  
  if (!body.gapId) {
    return error(400, 'Missing required field: gapId');
  }

  // Generate a goal from the gap and then explore it
  const gap = (await curiosityEngine.getKnowledgeGaps(tenantId, { limit: 100 })).find(g => g.id === body.gapId);
  if (!gap) {
    return error(404, 'Knowledge gap not found');
  }
  const goal = await curiosityEngine.generateGoalFromGap(tenantId, gap);
  if (!goal) {
    return error(400, 'Could not generate goal from gap');
  }
  const explorationResult = await curiosityEngine.exploreGoal(tenantId, goal.id, { maxTokens: 10000, maxCost: 1.0 });
  return success({ goalId: goal.id, ...explorationResult });
}

// =============================================================================
// Causal Tracker Handlers
// =============================================================================

async function recordCausalLink(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = getTenantId(event);
  
  if (!body.conversationId || !body.sourceTurnId || !body.targetTurnId || !body.type) {
    return error(400, 'Missing required fields: conversationId, sourceTurnId, targetTurnId, type');
  }

  const link = await causalTracker.recordCausalLink(
    tenantId,
    body.conversationId,
    body.sourceTurnId,
    body.targetTurnId,
    body.type,
    body.strength || 0.8
  );

  return success(link);
}

async function getCausalChain(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const conversationId = event.queryStringParameters?.conversationId;
  const turnId = event.queryStringParameters?.turnId;
  
  if (!conversationId) {
    return error(400, 'Missing required query parameter: conversationId');
  }

  const chain = await causalTracker.getCausalChain(
    tenantId,
    conversationId,
    turnId || ''
  );

  return success(chain);
}

// =============================================================================
// Dashboard Handler
// =============================================================================

async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  // Get summary stats from all cognition services
  const [teacherStats, cacheMetrics, gapsCount, goalsCount] = await Promise.all([
    executeStatement(`
      SELECT status, COUNT(*) as count 
      FROM distillation_training_data 
      WHERE tenant_id = $1 
      GROUP BY status
    `, [stringParam('tenantId', tenantId)]),
    semanticCache.getMetrics(tenantId),
    executeStatement(`
      SELECT COUNT(*) as count 
      FROM knowledge_gaps 
      WHERE tenant_id = $1
    `, [stringParam('tenantId', tenantId)]),
    executeStatement(`
      SELECT COUNT(*) as count 
      FROM curiosity_goals 
      WHERE tenant_id = $1 AND status IN ('pending', 'active')
    `, [stringParam('tenantId', tenantId)]),
  ]);

  const traceStats: Record<string, number> = {};
  for (const row of teacherStats.rows || []) {
    const r = row as { status: string; count: string };
    traceStats[r.status] = parseInt(r.count, 10);
  }

  return success({
    teacher: {
      pendingTraces: traceStats['pending'] || 0,
      validatedTraces: traceStats['validated'] || 0,
      usedTraces: traceStats['used'] || 0,
    },
    cache: cacheMetrics,
    curiosity: {
      knowledgeGaps: parseInt((gapsCount.rows?.[0] as { count?: string })?.count || '0', 10),
      activeGoals: parseInt((goalsCount.rows?.[0] as { count?: string })?.count || '0', 10),
    },
  });
}
