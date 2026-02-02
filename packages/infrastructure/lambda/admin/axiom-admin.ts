/**
 * AXIOM Admin Lambda Handler
 * 
 * Admin API endpoints for AXIOM/CLARION management:
 * - Learning health metrics across tenants
 * - Pattern approval/rejection workflow
 * - Global parameter configuration
 * - A/B test management
 * - Tenant-level configuration
 * - Compliance data export/delete
 * 
 * Base Path: /api/admin/axiom
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, longParam, doubleParam } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Route Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  logger.info('[AXIOM:ADMIN] Request received', { method, path });

  try {
    // Dashboard & Metrics
    if (path.match(/\/api\/admin\/axiom\/dashboard$/) && method === 'GET') {
      return await handleGetDashboard(event);
    }

    if (path.match(/\/api\/admin\/axiom\/metrics$/) && method === 'GET') {
      return await handleGetMetrics(event);
    }

    if (path.match(/\/api\/admin\/axiom\/metrics\/tenants$/) && method === 'GET') {
      return await handleGetTenantMetrics(event);
    }

    // Pattern Management
    if (path.match(/\/api\/admin\/axiom\/patterns$/) && method === 'GET') {
      return await handleListPatterns(event);
    }

    if (path.match(/\/api\/admin\/axiom\/patterns\/pending$/) && method === 'GET') {
      return await handleListPendingPatterns(event);
    }

    if (path.match(/\/api\/admin\/axiom\/patterns\/[^/]+\/approve$/) && method === 'POST') {
      return await handleApprovePattern(event);
    }

    if (path.match(/\/api\/admin\/axiom\/patterns\/[^/]+\/reject$/) && method === 'POST') {
      return await handleRejectPattern(event);
    }

    if (path.match(/\/api\/admin\/axiom\/patterns$/) && method === 'POST') {
      return await handleInjectPattern(event);
    }

    // Global Configuration
    if (path.match(/\/api\/admin\/axiom\/config$/) && method === 'GET') {
      return await handleGetGlobalConfig(event);
    }

    if (path.match(/\/api\/admin\/axiom\/config$/) && method === 'PUT') {
      return await handleUpdateGlobalConfig(event);
    }

    // A/B Testing
    if (path.match(/\/api\/admin\/axiom\/ab-tests$/) && method === 'GET') {
      return await handleListABTests(event);
    }

    if (path.match(/\/api\/admin\/axiom\/ab-tests$/) && method === 'POST') {
      return await handleCreateABTest(event);
    }

    if (path.match(/\/api\/admin\/axiom\/ab-tests\/[^/]+$/) && method === 'GET') {
      return await handleGetABTest(event);
    }

    if (path.match(/\/api\/admin\/axiom\/ab-tests\/[^/]+$/) && method === 'DELETE') {
      return await handleDeleteABTest(event);
    }

    // Tenant Configuration
    if (path.match(/\/api\/admin\/axiom\/tenants\/[^/]+\/config$/) && method === 'GET') {
      return await handleGetTenantConfig(event);
    }

    if (path.match(/\/api\/admin\/axiom\/tenants\/[^/]+\/config$/) && method === 'PUT') {
      return await handleUpdateTenantConfig(event);
    }

    if (path.match(/\/api\/admin\/axiom\/tenants\/[^/]+\/stats$/) && method === 'GET') {
      return await handleGetTenantStats(event);
    }

    // Compliance
    if (path.match(/\/api\/admin\/axiom\/tenants\/[^/]+\/export$/) && method === 'POST') {
      return await handleExportTenantData(event);
    }

    if (path.match(/\/api\/admin\/axiom\/tenants\/[^/]+\/delete-learning$/) && method === 'DELETE') {
      return await handleDeleteTenantLearning(event);
    }

    // Domain Signatures
    if (path.match(/\/api\/admin\/axiom\/signatures$/) && method === 'GET') {
      return await handleListSignatures(event);
    }

    if (path.match(/\/api\/admin\/axiom\/signatures\/[^/]+$/) && method === 'PUT') {
      return await handleUpdateSignature(event);
    }

    // Questions Management
    if (path.match(/\/api\/admin\/axiom\/questions$/) && method === 'GET') {
      return await handleListQuestions(event);
    }

    if (path.match(/\/api\/admin\/axiom\/questions$/) && method === 'POST') {
      return await handleCreateQuestion(event);
    }

    if (path.match(/\/api\/admin\/axiom\/questions\/[^/]+$/) && method === 'PUT') {
      return await handleUpdateQuestion(event);
    }

    if (path.match(/\/api\/admin\/axiom\/questions\/[^/]+$/) && method === 'DELETE') {
      return await handleDeleteQuestion(event);
    }

    return createResponse(404, { error: 'Not Found', path });

  } catch (error) {
    logger.error('[AXIOM:ADMIN] Handler error', { error, path, method });
    return createResponse(500, { 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// Dashboard & Metrics Handlers
// =============================================================================

async function handleGetDashboard(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Get overview metrics
  const [
    sessionStats,
    patternStats,
    questionStats,
    tenantStats,
    recentSessions,
    pendingPatterns,
  ] = await Promise.all([
    getSessionStats(),
    getPatternStats(),
    getQuestionStats(),
    getTenantStats(),
    getRecentSessions(10),
    getPendingPatterns(5),
  ]);

  return createResponse(200, {
    overview: {
      totalSessions: sessionStats.total,
      activeSessions: sessionStats.active,
      completedSessions: sessionStats.completed,
      averageConfidence: sessionStats.avgConfidence,
      averageQuestionsAsked: sessionStats.avgQuestions,
    },
    patterns: {
      totalPatterns: patternStats.total,
      humanCurated: patternStats.humanCurated,
      evolved: patternStats.evolved,
      invented: patternStats.invented,
      pendingApproval: patternStats.pending,
      averageSuccessRate: patternStats.avgSuccessRate,
    },
    questions: {
      totalQuestions: questionStats.total,
      activeQuestions: questionStats.active,
      averageInformationGain: questionStats.avgInfoGain,
      averageSkipRate: questionStats.avgSkipRate,
    },
    tenants: {
      totalTenants: tenantStats.total,
      tenantsWithCustomConfig: tenantStats.withConfig,
      tenantsUsingAxiom: tenantStats.usingAxiom,
    },
    recentSessions,
    pendingPatterns,
  });
}

async function handleGetMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const timeRange = event.queryStringParameters?.range || '7d';
  
  const metrics = await getAggregatedMetrics(timeRange);
  
  return createResponse(200, metrics);
}

async function handleGetTenantMetrics(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT 
      tenant_id,
      COUNT(*) as session_count,
      AVG(current_confidence) as avg_confidence,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
      MAX(created_at) as last_session_at
     FROM clarion_sessions
     GROUP BY tenant_id
     ORDER BY session_count DESC
     LIMIT 50`,
    []
  );

  const tenantMetrics = result.rows.map((row: any) => ({
    tenantId: row.tenant_id,
    sessionCount: Number(row.session_count),
    avgConfidence: Number(row.avg_confidence) || 0,
    completedCount: Number(row.completed_count),
    lastSessionAt: row.last_session_at,
  }));

  return createResponse(200, { tenants: tenantMetrics });
}

// =============================================================================
// Pattern Management Handlers
// =============================================================================

async function handleListPatterns(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const domain = event.queryStringParameters?.domain;
  const origin = event.queryStringParameters?.origin;
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  let query = `SELECT * FROM axiom_prompt_patterns WHERE is_active = true`;
  const params: any[] = [];
  let paramIndex = 1;

  if (domain) {
    query += ` AND domain_id = $${paramIndex}`;
    params.push(stringParam('domain', domain));
    paramIndex++;
  }

  if (origin) {
    query += ` AND origin = $${paramIndex}`;
    params.push(stringParam('origin', origin));
    paramIndex++;
  }

  query += ` ORDER BY success_rate DESC, usage_count DESC LIMIT $${paramIndex}`;
  params.push(longParam('limit', limit));

  const result = await executeStatement(query, params);

  return createResponse(200, {
    patterns: result.rows,
    total: result.rows.length,
  });
}

async function handleListPendingPatterns(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Patterns evolved by CATO that need human approval
  const result = await executeStatement(
    `SELECT p.*, e.evolution_type, e.fitness_score, e.invention_ratio
     FROM axiom_prompt_patterns p
     JOIN axiom_pattern_evolution e ON p.pattern_id = e.new_pattern_id
     WHERE p.origin IN ('evolved', 'invented')
     AND p.is_active = false
     ORDER BY e.fitness_score DESC
     LIMIT 20`,
    []
  );

  return createResponse(200, {
    pendingPatterns: result.rows,
    total: result.rows.length,
  });
}

async function handleApprovePattern(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const patternId = extractPathParam(event.path, 'patterns');
  
  if (!patternId) {
    return createResponse(400, { error: 'patternId is required' });
  }

  await executeStatement(
    `UPDATE axiom_prompt_patterns 
     SET is_active = true, updated_at = NOW()
     WHERE pattern_id = $1`,
    [stringParam('patternId', patternId)]
  );

  logger.info('[AXIOM:ADMIN] Pattern approved', { patternId });

  return createResponse(200, { patternId, status: 'approved' });
}

async function handleRejectPattern(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const patternId = extractPathParam(event.path, 'patterns');
  const body = parseBody(event.body);
  
  if (!patternId) {
    return createResponse(400, { error: 'patternId is required' });
  }

  // Mark as rejected (soft delete)
  await executeStatement(
    `UPDATE axiom_prompt_patterns 
     SET is_active = false, updated_at = NOW()
     WHERE pattern_id = $1`,
    [stringParam('patternId', patternId)]
  );

  logger.info('[AXIOM:ADMIN] Pattern rejected', { patternId, reason: body.reason });

  return createResponse(200, { patternId, status: 'rejected', reason: body.reason });
}

async function handleInjectPattern(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  
  if (!body.domainId || !body.type || !body.content) {
    return createResponse(400, { error: 'domainId, type, and content are required' });
  }

  const patternId = `pattern-${uuidv4()}`;

  await executeStatement(
    `INSERT INTO axiom_prompt_patterns (
      pattern_id, domain_id, pattern_type, content, origin, is_active,
      usage_count, success_rate, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'human_curated', true, 0, 0.5, NOW(), NOW())`,
    [
      stringParam('patternId', patternId),
      stringParam('domainId', String(body.domainId)),
      stringParam('type', String(body.type)),
      stringParam('content', String(body.content)),
    ]
  );

  logger.info('[AXIOM:ADMIN] Pattern injected', { patternId, domain: body.domainId });

  return createResponse(201, { patternId, status: 'created' });
}

// =============================================================================
// Global Configuration Handlers
// =============================================================================

async function handleGetGlobalConfig(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Get global config (tenant_id = 'global')
  const result = await executeStatement(
    `SELECT * FROM axiom_config WHERE tenant_id = 'global'`,
    []
  );

  if (result.rows.length === 0) {
    // Return defaults
    return createResponse(200, {
      config: {
        maxQuestions: 5,
        confidenceThreshold: 0.85,
        minInformationGain: 0.1,
        sessionTimeoutMinutes: 30,
        maxPatternsRetrieved: 5,
        minPatternScore: 0.3,
        compilationTimeoutMs: 5000,
        variantGenerationCount: 3,
        enableNeuralScoring: true,
        enableCatoLearning: true,
      },
    });
  }

  return createResponse(200, { config: result.rows[0] });
}

async function handleUpdateGlobalConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);

  await executeStatement(
    `INSERT INTO axiom_config (
      tenant_id, max_questions, confidence_threshold, min_information_gain,
      session_timeout_minutes, max_patterns_retrieved, min_pattern_score,
      compilation_timeout_ms, variant_generation_count,
      enable_neural_scoring, enable_cato_learning, updated_at
    ) VALUES ('global', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (tenant_id) DO UPDATE SET
      max_questions = EXCLUDED.max_questions,
      confidence_threshold = EXCLUDED.confidence_threshold,
      min_information_gain = EXCLUDED.min_information_gain,
      session_timeout_minutes = EXCLUDED.session_timeout_minutes,
      max_patterns_retrieved = EXCLUDED.max_patterns_retrieved,
      min_pattern_score = EXCLUDED.min_pattern_score,
      compilation_timeout_ms = EXCLUDED.compilation_timeout_ms,
      variant_generation_count = EXCLUDED.variant_generation_count,
      enable_neural_scoring = EXCLUDED.enable_neural_scoring,
      enable_cato_learning = EXCLUDED.enable_cato_learning,
      updated_at = NOW()`,
    [
      longParam('maxQuestions', Number(body.maxQuestions) || 5),
      doubleParam('confidenceThreshold', Number(body.confidenceThreshold) || 0.85),
      doubleParam('minInformationGain', Number(body.minInformationGain) || 0.1),
      longParam('sessionTimeoutMinutes', Number(body.sessionTimeoutMinutes) || 30),
      longParam('maxPatternsRetrieved', Number(body.maxPatternsRetrieved) || 5),
      doubleParam('minPatternScore', Number(body.minPatternScore) || 0.3),
      longParam('compilationTimeoutMs', Number(body.compilationTimeoutMs) || 5000),
      longParam('variantGenerationCount', Number(body.variantGenerationCount) || 3),
      stringParam('enableNeuralScoring', String(body.enableNeuralScoring !== false)),
      stringParam('enableCatoLearning', String(body.enableCatoLearning !== false)),
    ]
  );

  logger.info('[AXIOM:ADMIN] Global config updated');

  return createResponse(200, { status: 'updated' });
}

// =============================================================================
// A/B Testing Handlers
// =============================================================================

async function handleListABTests(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM axiom_ab_tests ORDER BY created_at DESC LIMIT 50`,
    []
  );

  return createResponse(200, { tests: result.rows });
}

async function handleCreateABTest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  
  if (!body.name || !body.domainId || !body.variants) {
    return createResponse(400, { error: 'name, domainId, and variants are required' });
  }

  const testId = `abtest-${uuidv4()}`;

  await executeStatement(
    `INSERT INTO axiom_ab_tests (
      test_id, name, domain_id, variants, traffic_split, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, 'active', NOW())`,
    [
      stringParam('testId', testId),
      stringParam('name', String(body.name)),
      stringParam('domainId', String(body.domainId)),
      stringParam('variants', JSON.stringify(body.variants)),
      stringParam('trafficSplit', JSON.stringify(body.trafficSplit || { control: 50, variant: 50 })),
    ]
  );

  return createResponse(201, { testId, status: 'created' });
}

async function handleGetABTest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const testId = extractPathParam(event.path, 'ab-tests');
  
  if (!testId) {
    return createResponse(400, { error: 'testId is required' });
  }

  const result = await executeStatement(
    `SELECT * FROM axiom_ab_tests WHERE test_id = $1`,
    [stringParam('testId', testId)]
  );

  if (result.rows.length === 0) {
    return createResponse(404, { error: 'Test not found' });
  }

  return createResponse(200, { test: result.rows[0] });
}

async function handleDeleteABTest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const testId = extractPathParam(event.path, 'ab-tests');
  
  if (!testId) {
    return createResponse(400, { error: 'testId is required' });
  }

  await executeStatement(
    `UPDATE axiom_ab_tests SET status = 'stopped', updated_at = NOW() WHERE test_id = $1`,
    [stringParam('testId', testId)]
  );

  return createResponse(200, { testId, status: 'stopped' });
}

// =============================================================================
// Tenant Configuration Handlers
// =============================================================================

async function handleGetTenantConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = extractPathParam(event.path, 'tenants');
  
  if (!tenantId) {
    return createResponse(400, { error: 'tenantId is required' });
  }

  const result = await executeStatement(
    `SELECT * FROM axiom_config WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)]
  );

  if (result.rows.length === 0) {
    // Return global defaults
    return handleGetGlobalConfig(event);
  }

  return createResponse(200, { config: result.rows[0] });
}

async function handleUpdateTenantConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = extractPathParam(event.path, 'tenants');
  const body = parseBody(event.body);
  
  if (!tenantId) {
    return createResponse(400, { error: 'tenantId is required' });
  }

  await executeStatement(
    `INSERT INTO axiom_config (
      tenant_id, max_questions, confidence_threshold, min_information_gain,
      session_timeout_minutes, max_patterns_retrieved, min_pattern_score,
      compilation_timeout_ms, variant_generation_count,
      enable_neural_scoring, enable_cato_learning, custom_settings, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (tenant_id) DO UPDATE SET
      max_questions = EXCLUDED.max_questions,
      confidence_threshold = EXCLUDED.confidence_threshold,
      min_information_gain = EXCLUDED.min_information_gain,
      session_timeout_minutes = EXCLUDED.session_timeout_minutes,
      max_patterns_retrieved = EXCLUDED.max_patterns_retrieved,
      min_pattern_score = EXCLUDED.min_pattern_score,
      compilation_timeout_ms = EXCLUDED.compilation_timeout_ms,
      variant_generation_count = EXCLUDED.variant_generation_count,
      enable_neural_scoring = EXCLUDED.enable_neural_scoring,
      enable_cato_learning = EXCLUDED.enable_cato_learning,
      custom_settings = EXCLUDED.custom_settings,
      updated_at = NOW()`,
    [
      stringParam('tenantId', tenantId),
      longParam('maxQuestions', Number(body.maxQuestions) || 5),
      doubleParam('confidenceThreshold', Number(body.confidenceThreshold) || 0.85),
      doubleParam('minInformationGain', Number(body.minInformationGain) || 0.1),
      longParam('sessionTimeoutMinutes', Number(body.sessionTimeoutMinutes) || 30),
      longParam('maxPatternsRetrieved', Number(body.maxPatternsRetrieved) || 5),
      doubleParam('minPatternScore', Number(body.minPatternScore) || 0.3),
      longParam('compilationTimeoutMs', Number(body.compilationTimeoutMs) || 5000),
      longParam('variantGenerationCount', Number(body.variantGenerationCount) || 3),
      stringParam('enableNeuralScoring', String(body.enableNeuralScoring !== false)),
      stringParam('enableCatoLearning', String(body.enableCatoLearning !== false)),
      stringParam('customSettings', JSON.stringify(body.customSettings || {})),
    ]
  );

  logger.info('[AXIOM:ADMIN] Tenant config updated', { tenantId });

  return createResponse(200, { tenantId, status: 'updated' });
}

async function handleGetTenantStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = extractPathParam(event.path, 'tenants');
  
  if (!tenantId) {
    return createResponse(400, { error: 'tenantId is required' });
  }

  const [sessionStats, patternStats, questionStats] = await Promise.all([
    executeStatement(
      `SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        AVG(current_confidence) as avg_confidence,
        AVG(JSONB_ARRAY_LENGTH(asked_questions)) as avg_questions
       FROM clarion_sessions WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `SELECT COUNT(*) as total, AVG(success_rate) as avg_success
       FROM axiom_prompt_patterns WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `SELECT question_id, ask_count, skip_count, average_information_gain
       FROM clarion_question_effectiveness
       WHERE domain IN (
         SELECT DISTINCT domain FROM clarion_sessions WHERE tenant_id = $1
       )
       ORDER BY ask_count DESC LIMIT 10`,
      [stringParam('tenantId', tenantId)]
    ),
  ]);

  const session = sessionStats.rows[0] as any;
  const pattern = patternStats.rows[0] as any;

  return createResponse(200, {
    tenantId,
    sessions: {
      total: Number(session?.total_sessions) || 0,
      completed: Number(session?.completed) || 0,
      avgConfidence: Number(session?.avg_confidence) || 0,
      avgQuestions: Number(session?.avg_questions) || 0,
    },
    patterns: {
      total: Number(pattern?.total) || 0,
      avgSuccessRate: Number(pattern?.avg_success) || 0,
    },
    topQuestions: questionStats.rows,
  });
}

// =============================================================================
// Compliance Handlers
// =============================================================================

async function handleExportTenantData(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = extractPathParam(event.path, 'tenants');
  
  if (!tenantId) {
    return createResponse(400, { error: 'tenantId is required' });
  }

  // Collect all tenant AXIOM data
  const [sessions, patterns, config, signals] = await Promise.all([
    executeStatement(
      `SELECT * FROM clarion_sessions WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `SELECT * FROM axiom_prompt_patterns WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `SELECT * FROM axiom_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `SELECT * FROM axiom_training_signals WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    tenantId,
    sessions: sessions.rows,
    patterns: patterns.rows,
    config: config.rows[0] || null,
    trainingSignals: signals.rows,
  };

  logger.info('[AXIOM:ADMIN] Tenant data exported', { tenantId, sessionCount: sessions.rows.length });

  return createResponse(200, { export: exportData });
}

async function handleDeleteTenantLearning(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = extractPathParam(event.path, 'tenants');
  const body = parseBody(event.body);
  
  if (!tenantId) {
    return createResponse(400, { error: 'tenantId is required' });
  }

  if (!body.confirmDelete) {
    return createResponse(400, { error: 'confirmDelete must be true' });
  }

  // Delete all tenant learning data
  await Promise.all([
    executeStatement(
      `DELETE FROM clarion_sessions WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `DELETE FROM axiom_prompt_patterns WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `DELETE FROM axiom_training_signals WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `DELETE FROM axiom_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
  ]);

  logger.info('[AXIOM:ADMIN] Tenant learning data deleted', { tenantId });

  return createResponse(200, { tenantId, status: 'deleted' });
}

// =============================================================================
// Domain Signatures Handlers
// =============================================================================

async function handleListSignatures(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  const result = await executeStatement(
    `SELECT * FROM axiom_domain_signatures 
     WHERE is_active = true
     ORDER BY usage_count DESC
     LIMIT $1`,
    [longParam('limit', limit)]
  );

  return createResponse(200, { signatures: result.rows });
}

async function handleUpdateSignature(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const domainId = extractPathParam(event.path, 'signatures');
  const body = parseBody(event.body);
  
  if (!domainId) {
    return createResponse(400, { error: 'domainId is required' });
  }

  await executeStatement(
    `UPDATE axiom_domain_signatures SET
      template = $1,
      model_preferences = $2,
      version = $3,
      updated_at = NOW()
     WHERE domain_id = $4`,
    [
      stringParam('template', JSON.stringify(body.template)),
      stringParam('modelPreferences', JSON.stringify(body.modelPreferences || {})),
      stringParam('version', String(body.version || '1.0.0')),
      stringParam('domainId', domainId),
    ]
  );

  return createResponse(200, { domainId, status: 'updated' });
}

// =============================================================================
// Questions Management Handlers
// =============================================================================

async function handleListQuestions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const domain = event.queryStringParameters?.domain;
  const category = event.queryStringParameters?.category;
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  let query = `SELECT * FROM clarion_questions WHERE 1=1`;
  const params: any[] = [];
  let paramIndex = 1;

  if (domain) {
    query += ` AND (domain_applicability @> $${paramIndex}::jsonb OR domain_applicability @> '["*"]'::jsonb)`;
    params.push(stringParam('domain', JSON.stringify([domain])));
    paramIndex++;
  }

  if (category) {
    query += ` AND category = $${paramIndex}`;
    params.push(stringParam('category', category));
    paramIndex++;
  }

  query += ` ORDER BY priority DESC LIMIT $${paramIndex}`;
  params.push(longParam('limit', limit));

  const result = await executeStatement(query, params);

  return createResponse(200, { questions: result.rows });
}

async function handleCreateQuestion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  
  if (!body.text || !body.type || !body.category) {
    return createResponse(400, { error: 'text, type, and category are required' });
  }

  const questionId = `q_${uuidv4().slice(0, 8)}`;

  await executeStatement(
    `INSERT INTO clarion_questions (
      question_id, domain_applicability, question_type, text_localized,
      options_localized, priority, information_gain, category, is_active,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())`,
    [
      stringParam('questionId', questionId),
      stringParam('domainApplicability', JSON.stringify(body.domainApplicability || ['*'])),
      stringParam('type', String(body.type)),
      stringParam('text', JSON.stringify(body.text)),
      stringParam('options', JSON.stringify(body.options || null)),
      doubleParam('priority', Number(body.priority) || 0.5),
      doubleParam('informationGain', Number(body.informationGain) || 0.5),
      stringParam('category', String(body.category)),
    ]
  );

  return createResponse(201, { questionId, status: 'created' });
}

async function handleUpdateQuestion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const questionId = extractPathParam(event.path, 'questions');
  const body = parseBody(event.body);
  
  if (!questionId) {
    return createResponse(400, { error: 'questionId is required' });
  }

  await executeStatement(
    `UPDATE clarion_questions SET
      text_localized = COALESCE($1, text_localized),
      options_localized = COALESCE($2, options_localized),
      priority = COALESCE($3, priority),
      information_gain = COALESCE($4, information_gain),
      is_active = COALESCE($5, is_active),
      updated_at = NOW()
     WHERE question_id = $6`,
    [
      body.text ? stringParam('text', JSON.stringify(body.text)) : stringParam('text', ''),
      body.options ? stringParam('options', JSON.stringify(body.options)) : stringParam('options', ''),
      body.priority ? doubleParam('priority', Number(body.priority)) : doubleParam('priority', 0),
      body.informationGain ? doubleParam('informationGain', Number(body.informationGain)) : doubleParam('informationGain', 0),
      body.isActive !== undefined ? stringParam('isActive', String(body.isActive)) : stringParam('isActive', ''),
      stringParam('questionId', questionId),
    ]
  );

  return createResponse(200, { questionId, status: 'updated' });
}

async function handleDeleteQuestion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const questionId = extractPathParam(event.path, 'questions');
  
  if (!questionId) {
    return createResponse(400, { error: 'questionId is required' });
  }

  // Soft delete
  await executeStatement(
    `UPDATE clarion_questions SET is_active = false, updated_at = NOW() WHERE question_id = $1`,
    [stringParam('questionId', questionId)]
  );

  return createResponse(200, { questionId, status: 'deleted' });
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getSessionStats() {
  const result = await executeStatement(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      AVG(current_confidence) as avg_confidence,
      AVG(JSONB_ARRAY_LENGTH(asked_questions)) as avg_questions
     FROM clarion_sessions`,
    []
  );
  const row = result.rows[0] as any;
  return {
    total: Number(row?.total) || 0,
    active: Number(row?.active) || 0,
    completed: Number(row?.completed) || 0,
    avgConfidence: Number(row?.avg_confidence) || 0,
    avgQuestions: Number(row?.avg_questions) || 0,
  };
}

async function getPatternStats() {
  const result = await executeStatement(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN origin = 'human_curated' THEN 1 END) as human_curated,
      COUNT(CASE WHEN origin = 'evolved' THEN 1 END) as evolved,
      COUNT(CASE WHEN origin = 'invented' THEN 1 END) as invented,
      COUNT(CASE WHEN is_active = false AND origin IN ('evolved', 'invented') THEN 1 END) as pending,
      AVG(success_rate) as avg_success_rate
     FROM axiom_prompt_patterns`,
    []
  );
  const row = result.rows[0] as any;
  return {
    total: Number(row?.total) || 0,
    humanCurated: Number(row?.human_curated) || 0,
    evolved: Number(row?.evolved) || 0,
    invented: Number(row?.invented) || 0,
    pending: Number(row?.pending) || 0,
    avgSuccessRate: Number(row?.avg_success_rate) || 0,
  };
}

async function getQuestionStats() {
  const result = await executeStatement(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active,
      AVG(information_gain) as avg_info_gain
     FROM clarion_questions`,
    []
  );
  
  const effectivenessResult = await executeStatement(
    `SELECT AVG(skip_count::float / NULLIF(ask_count, 0)) as avg_skip_rate
     FROM clarion_question_effectiveness`,
    []
  );

  const row = result.rows[0] as any;
  const effRow = effectivenessResult.rows[0] as any;
  return {
    total: Number(row?.total) || 0,
    active: Number(row?.active) || 0,
    avgInfoGain: Number(row?.avg_info_gain) || 0,
    avgSkipRate: Number(effRow?.avg_skip_rate) || 0,
  };
}

async function getTenantStats() {
  const result = await executeStatement(
    `SELECT 
      COUNT(DISTINCT tenant_id) as total,
      COUNT(DISTINCT CASE WHEN tenant_id IN (SELECT tenant_id FROM axiom_config) THEN tenant_id END) as with_config
     FROM clarion_sessions`,
    []
  );
  const row = result.rows[0] as any;
  return {
    total: Number(row?.total) || 0,
    withConfig: Number(row?.with_config) || 0,
    usingAxiom: Number(row?.total) || 0,
  };
}

async function getRecentSessions(limit: number) {
  const result = await executeStatement(
    `SELECT session_id, tenant_id, domain, status, current_confidence, created_at
     FROM clarion_sessions
     ORDER BY created_at DESC
     LIMIT $1`,
    [longParam('limit', limit)]
  );
  return result.rows;
}

async function getPendingPatterns(limit: number) {
  const result = await executeStatement(
    `SELECT p.pattern_id, p.domain_id, p.pattern_type, p.origin, e.fitness_score
     FROM axiom_prompt_patterns p
     LEFT JOIN axiom_pattern_evolution e ON p.pattern_id = e.new_pattern_id
     WHERE p.is_active = false AND p.origin IN ('evolved', 'invented')
     ORDER BY e.fitness_score DESC NULLS LAST
     LIMIT $1`,
    [longParam('limit', limit)]
  );
  return result.rows;
}

async function getAggregatedMetrics(timeRange: string) {
  // Parse time range
  let days = 7;
  if (timeRange === '24h') days = 1;
  else if (timeRange === '30d') days = 30;
  else if (timeRange === '90d') days = 90;

  const result = await executeStatement(
    `SELECT 
      DATE(created_at) as date,
      COUNT(*) as sessions,
      AVG(current_confidence) as avg_confidence,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
     FROM clarion_sessions
     WHERE created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at)
     ORDER BY date`,
    []
  );

  return {
    timeRange,
    days,
    metrics: result.rows,
  };
}

function extractPathParam(path: string, paramName: string): string | null {
  const parts = path.split('/');
  const paramIndex = parts.findIndex(p => p === paramName);
  if (paramIndex >= 0 && parts[paramIndex + 1]) {
    return parts[paramIndex + 1];
  }
  return null;
}

function parseBody(body: string | null): Record<string, unknown> {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function createResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}
