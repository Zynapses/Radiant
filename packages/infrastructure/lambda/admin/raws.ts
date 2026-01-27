/**
 * RAWS v1.1 - Admin API Handler
 * Model selection, profiles, and configuration management
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { query, queryWithRls } from '../shared/services/database.js';
import {
  RAWSSelectionService,
  WeightProfileService,
  DomainDetectorService,
  SelectionRequest,
  ExternalModel,
  SelfHostedModel,
  WeightProfile,
  WEIGHT_PROFILES,
  Domain,
} from '../shared/services/raws/index.js';

const selectionService = new RAWSSelectionService();
const weightProfileService = new WeightProfileService();
const domainDetector = new DomainDetectorService();

// Response helpers
const success = (body: any): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const error = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const tenantId = event.requestContext.authorizer?.tenantId;
  if (!tenantId) {
    return error(401, 'Unauthorized');
  }

  const path = event.path.replace('/api/admin/raws', '');
  const method = event.httpMethod;

  try {
    // Initialize models on first request
    await initializeModels();

    // Route handling
    if (path === '/select' && method === 'POST') {
      return handleSelect(event, tenantId);
    }
    if (path === '/profiles' && method === 'GET') {
      return handleListProfiles();
    }
    if (path.startsWith('/profiles/') && method === 'GET') {
      const profileId = path.split('/')[2];
      return handleGetProfile(profileId);
    }
    if (path === '/profiles' && method === 'POST') {
      return handleCreateProfile(event, tenantId);
    }
    if (path === '/models' && method === 'GET') {
      return handleListModels();
    }
    if (path.startsWith('/models/') && method === 'GET') {
      const modelId = path.split('/')[2];
      return handleGetModel(modelId);
    }
    if (path === '/domains' && method === 'GET') {
      return handleListDomains();
    }
    if (path === '/detect-domain' && method === 'POST') {
      return handleDetectDomain(event);
    }
    if (path === '/health' && method === 'GET') {
      return handleHealth();
    }
    if (path === '/audit' && method === 'GET') {
      return handleGetAudit(event, tenantId);
    }

    return error(404, `Unknown endpoint: ${method} ${path}`);
  } catch (err) {
    // Error logged by main handler
    return error(500, (err as Error).message);
  }
};

// =====================================================
// Selection
// =====================================================

async function handleSelect(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = event.requestContext.authorizer?.userId;

  const request: SelectionRequest = {
    tenantId,
    userId,
    ...body,
  };

  const result = await selectionService.select(request);

  // Log to audit
  await logSelectionAudit(tenantId, userId, result);

  return success(result);
}

async function logSelectionAudit(
  tenantId: string,
  userId: string | undefined,
  result: Awaited<ReturnType<RAWSSelectionService['select']>>
): Promise<void> {
  const requiresCompliance =
    result.resolvedDomain === 'healthcare' ||
    result.resolvedDomain === 'financial' ||
    result.resolvedDomain === 'legal';

  await query(
    `INSERT INTO raws_selection_audit (
      id, tenant_id, user_id, request_id, domain, domain_confidence,
      weight_profile_id, system_type, selected_model_id, fallback_models,
      composite_score, score_quality, score_cost, score_latency,
      score_capability, score_reliability, score_compliance,
      score_availability, score_learning, selection_latency_ms,
      requires_compliance_retention
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
    [
      uuidv4(),
      tenantId,
      userId || null,
      result.requestId,
      result.resolvedDomain,
      result.domainConfidence,
      result.resolvedProfile,
      result.resolvedSystemType,
      result.selectedModel.id,
      result.fallbackModels.map(m => m.id),
      result.compositeScore,
      result.dimensionScores.quality,
      result.dimensionScores.cost,
      result.dimensionScores.latency,
      result.dimensionScores.capability,
      result.dimensionScores.reliability,
      result.dimensionScores.compliance,
      result.dimensionScores.availability,
      result.dimensionScores.learning,
      result.selectionLatencyMs,
      requiresCompliance,
    ] as any[]
  );
}

// =====================================================
// Profiles
// =====================================================

async function handleListProfiles(): Promise<APIGatewayProxyResult> {
  const profiles = weightProfileService.listProfiles();
  
  // Group by category
  const grouped = {
    optimization: profiles.filter(p => p.category === 'optimization'),
    domain: profiles.filter(p => p.category === 'domain'),
    sofai: profiles.filter(p => p.category === 'sofai'),
  };

  return success({
    profiles,
    grouped,
    totalCount: profiles.length,
  });
}

async function handleGetProfile(profileId: string): Promise<APIGatewayProxyResult> {
  const profile = weightProfileService.getProfile(profileId);
  if (!profile) {
    return error(404, `Profile not found: ${profileId}`);
  }
  return success(profile);
}

async function handleCreateProfile(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  const { id, displayName, description, weights, ...options } = body;

  if (!id || !displayName || !weights) {
    return error(400, 'Missing required fields: id, displayName, weights');
  }

  // Validate weights sum to 1.0
  const sum = Object.values(weights).reduce((a: number, b: any) => a + Number(b), 0);
  if (Math.abs(Number(sum) - 1.0) > 0.01) {
    return error(400, `Weights must sum to 1.0, got ${sum}`);
  }

  // Save to database
  await query(
    `INSERT INTO raws_weight_profiles (
      id, display_name, description, category,
      weight_quality, weight_cost, weight_latency, weight_capability,
      weight_reliability, weight_compliance, weight_availability, weight_learning,
      domain, min_quality_score, required_compliance, forced_system_type,
      require_truth_engine, require_source_citation, max_ecd_threshold,
      tenant_id, is_system_profile
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, false)`,
    [
      id,
      displayName,
      description || '',
      options.category || 'optimization',
      weights.Q,
      weights.C,
      weights.L,
      weights.K,
      weights.R,
      weights.P,
      weights.A,
      weights.E,
      options.domain || null,
      options.minQualityScore || null,
      options.requiredCompliance || null,
      options.forcedSystemType || null,
      options.requireTruthEngine || false,
      options.requireSourceCitation || false,
      options.maxEcdThreshold || null,
      tenantId,
    ] as any[]
  );

  // Create in-memory profile
  const profile = weightProfileService.createCustomProfile(
    id,
    displayName,
    description || '',
    weights,
    options
  );

  return success(profile);
}

// =====================================================
// Models
// =====================================================

async function handleListModels(): Promise<APIGatewayProxyResult> {
  const external = await loadExternalModels();
  const selfHosted = await loadSelfHostedModels();

  return success({
    external,
    selfHosted,
    totalCount: external.length + selfHosted.length,
  });
}

async function handleGetModel(modelId: string): Promise<APIGatewayProxyResult> {
  // Check external models
  const external = await query(
    'SELECT * FROM raws_external_models WHERE id = $1',
    [modelId] as any[]
  );
  if (external.rows && external.rows.length > 0) {
    return success(mapExternalModel(external.rows[0]));
  }

  // Check self-hosted models
  const selfHosted = await query(
    'SELECT * FROM raws_self_hosted_models WHERE id = $1',
    [modelId] as any[]
  );
  if (selfHosted.rows && selfHosted.rows.length > 0) {
    return success(mapSelfHostedModel(selfHosted.rows[0]));
  }

  return error(404, `Model not found: ${modelId}`);
}

// =====================================================
// Domains
// =====================================================

async function handleListDomains(): Promise<APIGatewayProxyResult> {
  const result = await query(
    'SELECT * FROM raws_domain_config ORDER BY id',
    []
  );

  const domains = (result.rows || []).map((row: any) => ({
    id: row.id,
    displayName: row.display_name,
    description: row.description,
    weightProfileId: row.weight_profile_id,
    minQualityScore: row.min_quality_score,
    maxEcdThreshold: row.max_ecd_threshold,
    requiredCompliance: row.required_compliance || [],
    forcedSystemType: row.forced_system_type,
    requireTruthEngine: row.require_truth_engine,
    requireSourceCitation: row.require_source_citation,
  }));

  return success({ domains });
}

async function handleDetectDomain(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { text, taskType } = body;

  const result = domainDetector.detectWithContext({ text, taskType });

  return success({
    ...result,
    meetsThreshold: domainDetector.meetsConfidenceThreshold(result),
    recommendedProfile: WEIGHT_PROFILES[result.domain.toUpperCase() as keyof typeof WEIGHT_PROFILES]?.id || 'BALANCED',
  });
}

// =====================================================
// Health & Audit
// =====================================================

async function handleHealth(): Promise<APIGatewayProxyResult> {
  const providerHealth = await query(
    `SELECT provider_id, is_healthy, error_rate_1h, avg_latency_ms
     FROM raws_providers WHERE is_active = true`,
    []
  );

  const providers = (providerHealth.rows || []).map((row: any) => ({
    providerId: row.provider_id,
    isHealthy: row.is_healthy,
    errorRate1h: row.error_rate_1h,
    avgLatencyMs: row.avg_latency_ms,
  }));

  return success({
    status: 'healthy',
    providers,
    modelCount: {
      external: parseInt((await query('SELECT COUNT(*) FROM raws_external_models WHERE status = $1', ['active'])).rows?.[0]?.count || '0', 10),
      selfHosted: parseInt((await query('SELECT COUNT(*) FROM raws_self_hosted_models WHERE status = $1', ['active'])).rows?.[0]?.count || '0', 10),
    },
    profileCount: Object.keys(WEIGHT_PROFILES).length,
  });
}

async function handleGetAudit(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

  const result = await query(
    `SELECT * FROM raws_selection_audit 
     WHERE tenant_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset] as any[]
  );

  return success({
    entries: result.rows || [],
    limit,
    offset,
  });
}

// =====================================================
// Data Loading
// =====================================================

let modelsInitialized = false;

async function initializeModels(): Promise<void> {
  if (modelsInitialized) return;

  const external = await loadExternalModels();
  const selfHosted = await loadSelfHostedModels();
  selectionService.loadModels(external, selfHosted);
  modelsInitialized = true;
}

async function loadExternalModels(): Promise<ExternalModel[]> {
  const result = await query(
    'SELECT * FROM raws_external_models WHERE status = $1',
    ['active'] as any[]
  );

  return (result.rows || []).map(mapExternalModel);
}

async function loadSelfHostedModels(): Promise<SelfHostedModel[]> {
  const result = await query(
    'SELECT * FROM raws_self_hosted_models WHERE status = $1',
    ['active'] as any[]
  );

  return (result.rows || []).map(mapSelfHostedModel);
}

function mapExternalModel(row: any): ExternalModel {
  return {
    id: row.id,
    providerId: row.provider_id,
    displayName: row.display_name,
    modelFamily: row.model_family,
    capabilities: row.capabilities || [],
    contextWindow: row.context_window || 128000,
    maxOutputTokens: row.max_output_tokens || 8192,
    supportsFunctionCalling: row.supports_function_calling || false,
    supportsVision: row.supports_vision || false,
    supportsReasoning: row.supports_reasoning || false,
    inputCostPer1kTokens: parseFloat(row.input_cost_per_1k_tokens) || 0.001,
    outputCostPer1kTokens: parseFloat(row.output_cost_per_1k_tokens) || 0.002,
    markupPercent: parseFloat(row.markup_percent) || 40,
    qualityScore: parseFloat(row.quality_score) || 70,
    benchmarks: row.benchmarks || {},
    avgTtftMs: row.avg_ttft_ms,
    avgTps: row.avg_tps,
    uptimePercent30d: parseFloat(row.uptime_percent_30d) || 99.9,
    errorRate7d: parseFloat(row.error_rate_7d) || 0.001,
    complianceCertifications: row.compliance_certifications || [],
    status: row.status || 'active',
  };
}

function mapSelfHostedModel(row: any): SelfHostedModel {
  return {
    id: row.id,
    displayName: row.display_name,
    modelFamily: row.model_family,
    sagemakerEndpoint: row.sagemaker_endpoint,
    instanceType: row.instance_type,
    capabilities: row.capabilities || [],
    contextWindow: row.context_window || 8192,
    maxOutputTokens: row.max_output_tokens || 4096,
    costPerHour: row.cost_per_hour,
    markupPercent: parseFloat(row.markup_percent) || 75,
    qualityScore: parseFloat(row.quality_score) || 70,
    thermalState: row.thermal_state || 'COLD',
    minInstances: row.min_instances || 0,
    maxInstances: row.max_instances || 1,
    coldStartMs: row.cold_start_ms || 60000,
    status: row.status || 'active',
  };
}
