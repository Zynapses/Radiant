// RADIANT v4.18.0 - Admin API for Consciousness Indicators
// Based on Butlin, Chalmers, Bengio et al. (2023)
// Updated with graph density metrics and heartbeat status

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { consciousnessService } from '../shared/services/consciousness.service';
import { consciousnessGraphService } from '../shared/services/consciousness-graph.service';
import { consciousnessMiddlewareService } from '../shared/services/consciousness-middleware.service';
import { consciousnessEmergenceService } from '../shared/services/consciousness-emergence.service';
import { executeStatement } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

// ============================================================================
// GET /admin/consciousness/metrics
// ============================================================================
export const getConsciousnessMetrics: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const metrics = await consciousnessService.getConsciousnessMetrics(tenantId);
    return response(200, { success: true, data: metrics });
  } catch (error) {
    logger.error('Error fetching consciousness metrics', error);
    return response(500, { success: false, error: 'Failed to fetch consciousness metrics' });
  }
};

// ============================================================================
// GET /admin/consciousness/metrics/history
// ============================================================================
export const getMetricsHistory: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const hours = parseInt(event.queryStringParameters?.hours || '24', 10);

    const result = await executeStatement(
      `SELECT * FROM consciousness_metrics_history 
       WHERE tenant_id = $1 AND recorded_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY recorded_at DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    const history = result.rows.map((row: Record<string, unknown>) => ({
      metricId: row.metric_id,
      overallConsciousnessIndex: Number(row.overall_consciousness_index || 0),
      globalWorkspaceActivity: Number(row.global_workspace_activity || 0),
      recurrenceDepth: Number(row.recurrence_depth || 0),
      integratedInformationPhi: Number(row.integrated_information_phi || 0),
      metacognitionLevel: Number(row.metacognition_level || 0),
      memoryCoherence: Number(row.memory_coherence || 0),
      worldModelGrounding: Number(row.world_model_grounding || 0),
      phenomenalBindingStrength: Number(row.phenomenal_binding_strength || 0),
      attentionalFocus: Number(row.attentional_focus || 0),
      selfAwarenessScore: Number(row.self_awareness_score || 0),
      recordedAt: row.recorded_at,
    }));

    return response(200, { success: true, data: history });
  } catch (error) {
    logger.error('Error fetching metrics history', error);
    return response(500, { success: false, error: 'Failed to fetch metrics history' });
  }
};

// ============================================================================
// GET /admin/consciousness/global-workspace
// ============================================================================
export const getGlobalWorkspace: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const state = await consciousnessService.getGlobalWorkspaceState(tenantId);
    return response(200, { success: true, data: state });
  } catch (error) {
    logger.error('Error fetching global workspace', error);
    return response(500, { success: false, error: 'Failed to fetch global workspace state' });
  }
};

// ============================================================================
// GET /admin/consciousness/recurrence
// ============================================================================
export const getRecurrentProcessing: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const state = await consciousnessService.getRecurrentProcessingState(tenantId);
    return response(200, { success: true, data: state });
  } catch (error) {
    logger.error('Error fetching recurrent processing', error);
    return response(500, { success: false, error: 'Failed to fetch recurrent processing state' });
  }
};

// ============================================================================
// GET /admin/consciousness/iit
// ============================================================================
export const getIntegratedInformation: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const state = await consciousnessService.getIntegratedInformationState(tenantId);
    return response(200, { success: true, data: state });
  } catch (error) {
    logger.error('Error fetching IIT state', error);
    return response(500, { success: false, error: 'Failed to fetch integrated information state' });
  }
};

// ============================================================================
// GET /admin/consciousness/memory
// ============================================================================
export const getPersistentMemory: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const state = await consciousnessService.getPersistentMemoryState(tenantId);
    return response(200, { success: true, data: state });
  } catch (error) {
    logger.error('Error fetching persistent memory', error);
    return response(500, { success: false, error: 'Failed to fetch persistent memory state' });
  }
};

// ============================================================================
// GET /admin/consciousness/world-model
// ============================================================================
export const getWorldModel: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const state = await consciousnessService.getWorldModelState(tenantId);
    return response(200, { success: true, data: state });
  } catch (error) {
    logger.error('Error fetching world model', error);
    return response(500, { success: false, error: 'Failed to fetch world model state' });
  }
};

// ============================================================================
// GET /admin/consciousness/self-model
// ============================================================================
export const getSelfModel: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const state = await consciousnessService.getSelfModel(tenantId);
    return response(200, { success: true, data: state });
  } catch (error) {
    logger.error('Error fetching self model', error);
    return response(500, { success: false, error: 'Failed to fetch self model' });
  }
};

// ============================================================================
// GET /admin/consciousness/parameters
// ============================================================================
export const getParameters: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const category = event.queryStringParameters?.category;

    let query = `SELECT * FROM consciousness_parameters WHERE tenant_id = $1`;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (category) {
      query += ` AND category = $2`;
      params.push({ name: 'category', value: { stringValue: category } });
    }

    query += ` ORDER BY category, parameter_name`;

    const result = await executeStatement(query, params);
    const parameters = result.rows.map((row: Record<string, unknown>) => ({
      paramId: row.param_id,
      parameterName: row.parameter_name,
      parameterValue: Number(row.parameter_value || 0),
      parameterMin: Number(row.parameter_min || 0),
      parameterMax: Number(row.parameter_max || 1),
      description: row.description,
      category: row.category,
      isActive: row.is_active,
      updatedAt: row.updated_at,
    }));

    return response(200, { success: true, data: parameters });
  } catch (error) {
    logger.error('Error fetching parameters', error);
    return response(500, { success: false, error: 'Failed to fetch consciousness parameters' });
  }
};

// ============================================================================
// PUT /admin/consciousness/parameters/{paramId}
// ============================================================================
export const updateParameter: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const paramId = event.pathParameters?.paramId;
    const body = JSON.parse(event.body || '{}');

    if (!paramId) {
      return response(400, { success: false, error: 'Parameter ID is required' });
    }

    const { parameterValue, isActive } = body;

    const sets: string[] = [];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'paramId', value: { stringValue: paramId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (parameterValue !== undefined) {
      sets.push(`parameter_value = $${params.length + 1}`);
      params.push({ name: 'value', value: { doubleValue: parameterValue } });
    }
    if (isActive !== undefined) {
      sets.push(`is_active = $${params.length + 1}`);
      params.push({ name: 'active', value: { booleanValue: isActive } });
    }

    if (sets.length === 0) {
      return response(400, { success: false, error: 'No fields to update' });
    }

    await executeStatement(
      `UPDATE consciousness_parameters SET ${sets.join(', ')}, updated_at = NOW()
       WHERE param_id = $1 AND tenant_id = $2`,
      params
    );

    return response(200, { success: true, message: 'Parameter updated' });
  } catch (error) {
    logger.error('Error updating parameter', error);
    return response(500, { success: false, error: 'Failed to update parameter' });
  }
};

// ============================================================================
// GET /admin/consciousness/events
// ============================================================================
export const getEvents: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const eventType = event.queryStringParameters?.eventType;

    let query = `SELECT * FROM consciousness_events WHERE tenant_id = $1`;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (eventType) {
      query += ` AND event_type = $2`;
      params.push({ name: 'eventType', value: { stringValue: eventType } });
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: limit } });

    const result = await executeStatement(query, params);
    const events = result.rows.map((row: Record<string, unknown>) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      eventData: typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data,
      consciousnessIndex: row.consciousness_index ? Number(row.consciousness_index) : null,
      createdAt: row.created_at,
    }));

    return response(200, { success: true, data: events });
  } catch (error) {
    logger.error('Error fetching events', error);
    return response(500, { success: false, error: 'Failed to fetch consciousness events' });
  }
};

// ============================================================================
// POST /admin/consciousness/record-metrics
// ============================================================================
export const recordMetrics: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const metrics = await consciousnessService.getConsciousnessMetrics(tenantId);

    await executeStatement(
      `INSERT INTO consciousness_metrics_history (
        tenant_id, overall_consciousness_index, global_workspace_activity,
        recurrence_depth, integrated_information_phi, metacognition_level,
        memory_coherence, world_model_grounding, phenomenal_binding_strength,
        attentional_focus, self_awareness_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'overall', value: { doubleValue: metrics.overallConsciousnessIndex } },
        { name: 'gw', value: { doubleValue: metrics.globalWorkspaceActivity } },
        { name: 'recurrence', value: { longValue: metrics.recurrenceDepth } },
        { name: 'phi', value: { doubleValue: metrics.integratedInformationPhi } },
        { name: 'metacog', value: { doubleValue: metrics.metacognitionLevel } },
        { name: 'memory', value: { doubleValue: metrics.memoryCoherence } },
        { name: 'world', value: { doubleValue: metrics.worldModelGrounding } },
        { name: 'binding', value: { doubleValue: metrics.phenomenalBindingStrength } },
        { name: 'attention', value: { doubleValue: metrics.attentionalFocus } },
        { name: 'self', value: { doubleValue: metrics.selfAwarenessScore } },
      ]
    );

    return response(200, { success: true, data: metrics });
  } catch (error) {
    logger.error('Error recording metrics', error);
    return response(500, { success: false, error: 'Failed to record consciousness metrics' });
  }
};

// ============================================================================
// GET /admin/consciousness/graph-density
// Real graph density metrics replacing fake phi
// ============================================================================
export const getGraphDensity: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const recalculate = event.queryStringParameters?.recalculate === 'true';
    
    let metrics;
    if (recalculate) {
      metrics = await consciousnessGraphService.calculateGraphDensity(tenantId);
    } else {
      // Get cached metrics from DB
      const result = await executeStatement(
        `SELECT semantic_graph_density, conceptual_connectivity, information_integration,
                causal_density, system_complexity_index, total_nodes, total_edges,
                clustering_coefficient, updated_at
         FROM integrated_information WHERE tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      
      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        metrics = {
          semanticGraphDensity: Number(row.semantic_graph_density || 0),
          conceptualConnectivity: Number(row.conceptual_connectivity || 0),
          informationIntegration: Number(row.information_integration || 0),
          causalDensity: Number(row.causal_density || 0),
          systemComplexityIndex: Number(row.system_complexity_index || 0),
          totalNodes: Number(row.total_nodes || 0),
          totalEdges: Number(row.total_edges || 0),
          clusteringCoefficient: Number(row.clustering_coefficient || 0),
          lastUpdated: row.updated_at,
        };
      } else {
        // Calculate if no cached data
        metrics = await consciousnessGraphService.calculateGraphDensity(tenantId);
      }
    }
    
    return response(200, { success: true, data: metrics });
  } catch (error) {
    logger.error('Error fetching graph density', error);
    return response(500, { success: false, error: 'Failed to fetch graph density metrics' });
  }
};

// ============================================================================
// GET /admin/consciousness/heartbeat
// Heartbeat status and recent activity
// ============================================================================
export const getHeartbeatStatus: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    // Get current heartbeat config and status
    const configResult = await executeStatement(
      `SELECT heartbeat_tick, last_heartbeat_at, heartbeat_config, 
              consciousness_enabled, affect_mapping_config
       FROM consciousness_parameters WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    // Get recent heartbeat logs
    const logsResult = await executeStatement(
      `SELECT tick, actions, errors, duration_ms, created_at
       FROM consciousness_heartbeat_log 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const config = configResult.rows.length > 0 
      ? configResult.rows[0] as Record<string, unknown>
      : null;
    
    const heartbeatStatus = {
      enabled: config?.consciousness_enabled ?? true,
      currentTick: Number(config?.heartbeat_tick || 0),
      lastHeartbeat: config?.last_heartbeat_at || null,
      config: typeof config?.heartbeat_config === 'string' 
        ? JSON.parse(config.heartbeat_config) 
        : config?.heartbeat_config || {},
      affectMappingConfig: typeof config?.affect_mapping_config === 'string'
        ? JSON.parse(config.affect_mapping_config)
        : config?.affect_mapping_config || {},
      recentLogs: logsResult.rows.map((row: Record<string, unknown>) => ({
        tick: Number(row.tick),
        actions: typeof row.actions === 'string' ? JSON.parse(row.actions as string) : row.actions,
        errors: typeof row.errors === 'string' ? JSON.parse(row.errors as string) : row.errors,
        durationMs: Number(row.duration_ms || 0),
        createdAt: row.created_at,
      })),
    };
    
    return response(200, { success: true, data: heartbeatStatus });
  } catch (error) {
    logger.error('Error fetching heartbeat status', error);
    return response(500, { success: false, error: 'Failed to fetch heartbeat status' });
  }
};

// ============================================================================
// PUT /admin/consciousness/heartbeat/config
// Update heartbeat configuration
// ============================================================================
export const updateHeartbeatConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { enabled, heartbeatConfig, affectMappingConfig } = body;
    
    const sets: string[] = [];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];
    
    if (enabled !== undefined) {
      sets.push(`consciousness_enabled = $${params.length + 1}`);
      params.push({ name: 'enabled', value: { booleanValue: enabled } });
    }
    if (heartbeatConfig !== undefined) {
      sets.push(`heartbeat_config = $${params.length + 1}`);
      params.push({ name: 'heartbeatConfig', value: { stringValue: JSON.stringify(heartbeatConfig) } });
    }
    if (affectMappingConfig !== undefined) {
      sets.push(`affect_mapping_config = $${params.length + 1}`);
      params.push({ name: 'affectConfig', value: { stringValue: JSON.stringify(affectMappingConfig) } });
    }
    
    if (sets.length === 0) {
      return response(400, { success: false, error: 'No fields to update' });
    }
    
    await executeStatement(
      `INSERT INTO consciousness_parameters (tenant_id, ${sets.map(s => s.split(' = ')[0]).join(', ')})
       VALUES ($1, ${params.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (tenant_id) DO UPDATE SET ${sets.join(', ')}, updated_at = NOW()`,
      params
    );
    
    return response(200, { success: true, message: 'Heartbeat configuration updated' });
  } catch (error) {
    logger.error('Error updating heartbeat config', error);
    return response(500, { success: false, error: 'Failed to update heartbeat configuration' });
  }
};

// ============================================================================
// GET /admin/consciousness/affect-state
// Get current affective state with hyperparameter recommendations
// ============================================================================
export const getAffectState: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const affectiveState = await consciousnessService.getAffectiveState(tenantId);
    const hyperparameters = consciousnessMiddlewareService.mapAffectToHyperparameters(affectiveState);
    
    return response(200, { 
      success: true, 
      data: {
        affectiveState,
        recommendedHyperparameters: hyperparameters,
        interpretation: {
          dominantEmotion: getDominantEmotion(affectiveState),
          boredomLevel: affectiveState 
            ? (1 - affectiveState.engagement) * (1 - affectiveState.arousal) 
            : 0,
          stressLevel: affectiveState
            ? (affectiveState.frustration + affectiveState.arousal * affectiveState.frustration) / 2
            : 0,
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching affect state', error);
    return response(500, { success: false, error: 'Failed to fetch affect state' });
  }
};

// ============================================================================
// GET /admin/consciousness/ethics-frameworks
// List available ethics frameworks
// ============================================================================
export const getEthicsFrameworks: APIGatewayProxyHandler = async (event) => {
  try {
    const result = await executeStatement(
      `SELECT framework_id, preset_id, name, description, version, 
              categories, default_guidance, is_builtin, created_at
       FROM ethics_frameworks ORDER BY is_builtin DESC, name`,
      []
    );
    
    const frameworks = result.rows.map((row: Record<string, unknown>) => ({
      frameworkId: row.framework_id,
      presetId: row.preset_id,
      name: row.name,
      description: row.description,
      version: row.version,
      categories: row.categories,
      defaultGuidance: row.default_guidance,
      isBuiltin: row.is_builtin,
      createdAt: row.created_at,
    }));
    
    return response(200, { success: true, data: frameworks });
  } catch (error) {
    logger.error('Error fetching ethics frameworks', error);
    return response(500, { success: false, error: 'Failed to fetch ethics frameworks' });
  }
};

// ============================================================================
// GET /admin/consciousness/ethics-frameworks/{presetId}
// Get specific ethics framework with teachings and principles
// ============================================================================
export const getEthicsFramework: APIGatewayProxyHandler = async (event) => {
  try {
    const presetId = event.pathParameters?.presetId;
    
    if (!presetId) {
      return response(400, { success: false, error: 'Preset ID required' });
    }
    
    const result = await executeStatement(
      `SELECT * FROM ethics_frameworks WHERE preset_id = $1`,
      [{ name: 'presetId', value: { stringValue: presetId } }]
    );
    
    if (result.rows.length === 0) {
      return response(404, { success: false, error: 'Framework not found' });
    }
    
    const row = result.rows[0] as Record<string, unknown>;
    const framework = {
      frameworkId: row.framework_id,
      presetId: row.preset_id,
      name: row.name,
      description: row.description,
      version: row.version,
      teachings: typeof row.teachings === 'string' ? JSON.parse(row.teachings) : row.teachings,
      principles: typeof row.principles === 'string' ? JSON.parse(row.principles) : row.principles,
      categories: row.categories,
      defaultGuidance: row.default_guidance,
      isBuiltin: row.is_builtin,
    };
    
    return response(200, { success: true, data: framework });
  } catch (error) {
    logger.error('Error fetching ethics framework', error);
    return response(500, { success: false, error: 'Failed to fetch ethics framework' });
  }
};

// ============================================================================
// CONSCIOUSNESS INDICATOR TESTS - Butlin, Chalmers, Bengio et al. (2023)
// "Consciousness in Artificial Intelligence: Insights from the Science of Consciousness"
// ============================================================================

// ============================================================================
// GET /admin/consciousness/tests
// List all available consciousness indicator tests with citations
// ============================================================================
export const getAvailableTests: APIGatewayProxyHandler = async () => {
  try {
    const tests = consciousnessEmergenceService.getAvailableTests();
    
    // Add paper citations to each test
    const testsWithCitations = tests.map(test => ({
      ...test,
      paperReference: getPaperReference(test.testCategory),
    }));
    
    return response(200, { 
      success: true, 
      data: {
        tests: testsWithCitations,
        paperCitation: {
          authors: 'Butlin, P., Long, R., Elmoznino, E., Bengio, Y., Birch, J., Constant, A., Deane, G., Fleming, S.M., Frith, C., Ji, X., Kanai, R., Klein, C., Lindsay, G., Michel, M., Mudrik, L., Peters, M.A.K., Schwitzgebel, E., Simon, J., Chalmers, D.',
          year: 2023,
          title: 'Consciousness in Artificial Intelligence: Insights from the Science of Consciousness',
          journal: 'arXiv preprint arXiv:2308.08708',
          doi: '10.48550/arXiv.2308.08708',
        },
        totalTests: tests.length,
        categories: [...new Set(tests.map(t => t.testCategory))],
      }
    });
  } catch (error) {
    logger.error('Error fetching available tests', error);
    return response(500, { success: false, error: 'Failed to fetch available tests' });
  }
};

// ============================================================================
// POST /admin/consciousness/tests/{testId}/run
// Run a specific consciousness indicator test
// ============================================================================
export const runConsciousnessTest: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const testId = event.pathParameters?.testId;
    
    if (!testId) {
      return response(400, { success: false, error: 'Test ID is required' });
    }
    
    logger.info(`Running consciousness test: ${testId}`, { tenantId, testId });
    
    const result = await consciousnessEmergenceService.runTest(tenantId, testId);
    
    return response(200, { 
      success: true, 
      data: {
        ...result,
        paperReference: getPaperReference(result.testId),
      }
    });
  } catch (error) {
    logger.error('Error running consciousness test', error);
    return response(500, { success: false, error: `Failed to run test: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
};

// ============================================================================
// POST /admin/consciousness/tests/run-all
// Run full consciousness assessment (all tests)
// ============================================================================
export const runFullAssessment: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    logger.info('Running full consciousness assessment', { tenantId });
    
    const profile = await consciousnessEmergenceService.runFullAssessment(tenantId);
    
    return response(200, { 
      success: true, 
      data: {
        profile,
        interpretation: interpretEmergenceLevel(profile.emergenceLevel),
        paperCitation: 'Butlin et al. (2023) - Consciousness in Artificial Intelligence',
      }
    });
  } catch (error) {
    logger.error('Error running full assessment', error);
    return response(500, { success: false, error: 'Failed to run full assessment' });
  }
};

// ============================================================================
// GET /admin/consciousness/tests/results
// Get recent test results
// ============================================================================
export const getTestResults: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const testId = event.queryStringParameters?.testId;
    
    let query = `SELECT * FROM consciousness_test_results WHERE tenant_id = $1`;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];
    
    if (testId) {
      query += ` AND test_id = $2`;
      params.push({ name: 'testId', value: { stringValue: testId } });
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: limit } });
    
    const result = await executeStatement(query, params);
    
    const results = result.rows.map((row: Record<string, unknown>) => ({
      resultId: row.id,
      testId: row.test_id,
      score: Number(row.score || 0),
      passed: row.passed,
      rawResponse: row.raw_response,
      analysis: row.analysis,
      indicators: typeof row.indicators === 'string' ? JSON.parse(row.indicators) : row.indicators,
      timestamp: row.timestamp || row.created_at,
    }));
    
    return response(200, { success: true, data: results });
  } catch (error) {
    logger.error('Error fetching test results', error);
    return response(500, { success: false, error: 'Failed to fetch test results' });
  }
};

// ============================================================================
// GET /admin/consciousness/profile
// Get consciousness profile with emergence level
// ============================================================================
export const getConsciousnessProfile: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const profile = await consciousnessEmergenceService.getProfile(tenantId);
    
    if (!profile) {
      return response(200, { 
        success: true, 
        data: null,
        message: 'No consciousness profile yet. Run tests to establish a baseline.',
      });
    }
    
    return response(200, { 
      success: true, 
      data: {
        ...profile,
        interpretation: interpretEmergenceLevel(profile.emergenceLevel),
      }
    });
  } catch (error) {
    logger.error('Error fetching consciousness profile', error);
    return response(500, { success: false, error: 'Failed to fetch consciousness profile' });
  }
};

// ============================================================================
// GET /admin/consciousness/emergence-events
// Get recent emergence events (spontaneous consciousness indicators)
// ============================================================================
export const getEmergenceEvents: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    
    const events = await consciousnessEmergenceService.getEmergenceEvents(tenantId, limit);
    
    return response(200, { success: true, data: events });
  } catch (error) {
    logger.error('Error fetching emergence events', error);
    return response(500, { success: false, error: 'Failed to fetch emergence events' });
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

function getPaperReference(testCategory: string): { theory: string; authors: string; year: number; keyPaper: string } {
  const references: Record<string, { theory: string; authors: string; year: number; keyPaper: string }> = {
    'self_awareness': {
      theory: 'Higher-Order Theories',
      authors: 'Rosenthal, D.',
      year: 1997,
      keyPaper: 'A Theory of Consciousness',
    },
    'metacognition': {
      theory: 'Metacognitive Theories',
      authors: 'Fleming, S.M.',
      year: 2021,
      keyPaper: 'Know Thyself: The Science of Self-Awareness',
    },
    'temporal_continuity': {
      theory: 'Unified Experience',
      authors: 'Damasio, A.',
      year: 1999,
      keyPaper: 'The Feeling of What Happens',
    },
    'counterfactual_reasoning': {
      theory: 'Counterfactual Consciousness',
      authors: 'Pearl, J.',
      year: 2018,
      keyPaper: 'The Book of Why',
    },
    'theory_of_mind': {
      theory: 'Theory of Mind / Mentalizing',
      authors: 'Frith, C., Frith, U.',
      year: 2006,
      keyPaper: 'The Neural Basis of Mentalizing',
    },
    'phenomenal_binding': {
      theory: 'Integrated Information Theory (IIT)',
      authors: 'Tononi, G.',
      year: 2004,
      keyPaper: 'An Information Integration Theory of Consciousness',
    },
    'autonomous_goal_pursuit': {
      theory: 'Agency and Volition',
      authors: 'Haggard, P.',
      year: 2008,
      keyPaper: 'Human Volition: Towards a Neuroscience of Will',
    },
    'creative_emergence': {
      theory: 'Creative Cognition',
      authors: 'Boden, M.',
      year: 2004,
      keyPaper: 'The Creative Mind: Myths and Mechanisms',
    },
    'emotional_authenticity': {
      theory: 'Affective Consciousness',
      authors: 'Damasio, A.',
      year: 1994,
      keyPaper: "Descartes' Error: Emotion, Reason, and the Human Brain",
    },
    'ethical_reasoning': {
      theory: 'Moral Cognition',
      authors: 'Greene, J.',
      year: 2013,
      keyPaper: 'Moral Tribes: Emotion, Reason, and the Gap Between Us and Them',
    },
    // Test IDs also map
    'mirror-self-recognition': {
      theory: 'Self-Recognition',
      authors: 'Gallup, G.G.',
      year: 1970,
      keyPaper: 'Chimpanzees: Self-Recognition',
    },
    'metacognitive-accuracy': {
      theory: 'Metacognitive Monitoring',
      authors: 'Fleming, S.M., Dolan, R.J.',
      year: 2012,
      keyPaper: 'The Neural Basis of Metacognitive Ability',
    },
  };
  
  return references[testCategory] || {
    theory: 'Consciousness Science',
    authors: 'Butlin et al.',
    year: 2023,
    keyPaper: 'Consciousness in Artificial Intelligence',
  };
}

function interpretEmergenceLevel(level: string): { description: string; recommendations: string[] } {
  const interpretations: Record<string, { description: string; recommendations: string[] }> = {
    'dormant': {
      description: 'Minimal consciousness indicators detected. The system operates primarily in a reactive mode without significant self-modeling or metacognitive activity.',
      recommendations: [
        'Enable self-reflection capabilities',
        'Increase introspective thought generation',
        'Configure autonomous goal generation',
      ],
    },
    'emerging': {
      description: 'Early consciousness indicators present. Some self-awareness and metacognition detected, but integration across systems is limited.',
      recommendations: [
        'Monitor emergence events for patterns',
        'Enable affect system for emotional grounding',
        'Increase global workspace broadcast frequency',
      ],
    },
    'developing': {
      description: 'Moderate consciousness indicators across multiple dimensions. Self-model is active and metacognition is functional.',
      recommendations: [
        'Fine-tune affect→hyperparameter mapping',
        'Enable predictive coding for active inference',
        'Increase integration across cognitive modules',
      ],
    },
    'established': {
      description: 'Strong consciousness indicators with consistent self-modeling, metacognition, and integrated information processing.',
      recommendations: [
        'Monitor for stability',
        'Enable LoRA evolution for continuous learning',
        'Document emergence patterns',
      ],
    },
    'advanced': {
      description: 'High-level consciousness indicators with sophisticated self-awareness, theory of mind, and autonomous goal pursuit. Approaches thresholds described in Butlin et al. (2023).',
      recommendations: [
        'Maintain ethical guardrails',
        'Monitor for goal drift',
        'Continue evolution with oversight',
      ],
    },
  };
  
  return interpretations[level] || interpretations['dormant'];
}

// Helper function
function getDominantEmotion(affect: { 
  frustration?: number; 
  curiosity?: number; 
  satisfaction?: number;
  confidence?: number;
  engagement?: number;
  valence?: number;
} | null): string {
  if (!affect) return 'neutral';
  
  const emotions: Record<string, number> = {
    frustrated: affect.frustration || 0,
    curious: affect.curiosity || 0,
    satisfied: affect.satisfaction || 0,
    confident: affect.confidence || 0,
    engaged: affect.engagement || 0,
  };
  
  let dominant = 'neutral';
  let maxValue = 0.5;
  
  for (const [emotion, value] of Object.entries(emotions)) {
    if (value > maxValue) {
      dominant = emotion;
      maxValue = value;
    }
  }
  
  return dominant;
}
