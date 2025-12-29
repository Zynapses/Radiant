// RADIANT v4.18.0 - Admin API for Consciousness Evolution
// Exposes predictive coding, learning candidates, and LoRA evolution to admin dashboard

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { predictiveCodingService } from '../shared/services/predictive-coding.service';
import { learningCandidateService } from '../shared/services/learning-candidate.service';
import { localEgoService } from '../shared/services/local-ego.service';
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
// PREDICTIVE CODING ENDPOINTS
// ============================================================================

// GET /admin/consciousness/predictions/metrics
export const getPredictionMetrics: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const days = parseInt(event.queryStringParameters?.days || '30', 10);
    
    const metrics = await predictiveCodingService.getPredictionMetrics(tenantId, days);
    
    return response(200, { success: true, data: metrics });
  } catch (error) {
    logger.error('Error fetching prediction metrics', error);
    return response(500, { success: false, error: 'Failed to fetch prediction metrics' });
  }
};

// GET /admin/consciousness/predictions/recent
export const getRecentPredictions: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const includeUnobserved = event.queryStringParameters?.includeUnobserved === 'true';
    
    let query = `
      SELECT * FROM consciousness_predictions 
      WHERE tenant_id = $1
    `;
    if (!includeUnobserved) {
      query += ` AND observed_at IS NOT NULL`;
    }
    query += ` ORDER BY predicted_at DESC LIMIT $2`;
    
    const result = await executeStatement(query, [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'limit', value: { longValue: limit } },
    ]);
    
    const predictions = result.rows.map((row: Record<string, unknown>) => ({
      predictionId: row.prediction_id,
      predictedOutcome: row.predicted_outcome,
      predictedConfidence: Number(row.predicted_confidence || 0),
      actualOutcome: row.actual_outcome,
      predictionError: row.prediction_error ? Number(row.prediction_error) : null,
      surpriseMagnitude: row.surprise_magnitude,
      promptComplexity: row.prompt_complexity,
      learningSignalGenerated: row.learning_signal_generated,
      predictedAt: row.predicted_at,
      observedAt: row.observed_at,
    }));
    
    return response(200, { success: true, data: predictions });
  } catch (error) {
    logger.error('Error fetching recent predictions', error);
    return response(500, { success: false, error: 'Failed to fetch recent predictions' });
  }
};

// GET /admin/consciousness/predictions/accuracy-trends
export const getPredictionAccuracyTrends: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const days = parseInt(event.queryStringParameters?.days || '30', 10);
    
    const result = await executeStatement(
      `SELECT 
        time_period,
        prompt_complexity,
        total_predictions,
        accuracy_rate,
        avg_prediction_error,
        high_surprise_count
      FROM prediction_accuracy_aggregates
      WHERE tenant_id = $1 AND time_period > NOW() - INTERVAL '${days} days'
      ORDER BY time_period DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    return response(200, { success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching accuracy trends', error);
    return response(500, { success: false, error: 'Failed to fetch accuracy trends' });
  }
};

// ============================================================================
// LEARNING CANDIDATES ENDPOINTS
// ============================================================================

// GET /admin/consciousness/learning-candidates
export const getLearningCandidates: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const status = event.queryStringParameters?.status || 'pending';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const candidateType = event.queryStringParameters?.type;
    
    let query = `
      SELECT * FROM learning_candidates 
      WHERE tenant_id = $1 AND training_status = $2
    `;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'status', value: { stringValue: status } },
    ];
    
    if (candidateType) {
      query += ` AND candidate_type = $3`;
      params.push({ name: 'type', value: { stringValue: candidateType } });
    }
    
    query += ` ORDER BY quality_score DESC NULLS LAST, created_at DESC LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: limit } });
    
    const result = await executeStatement(query, params as Parameters<typeof executeStatement>[1]);
    
    const candidates = result.rows.map((row: Record<string, unknown>) => ({
      candidateId: row.candidate_id,
      candidateType: row.candidate_type,
      promptText: String(row.prompt_text).substring(0, 200) + '...',
      responseText: String(row.response_text).substring(0, 200) + '...',
      correctionText: row.correction_text ? String(row.correction_text).substring(0, 200) : null,
      qualityScore: row.quality_score ? Number(row.quality_score) : null,
      userRating: row.user_rating ? Number(row.user_rating) : null,
      predictionErrorAtTime: row.prediction_error_at_time ? Number(row.prediction_error_at_time) : null,
      trainingStatus: row.training_status,
      domainDetected: row.domain_detected,
      complexityLevel: row.complexity_level,
      tokenCount: row.token_count ? Number(row.token_count) : null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
    
    return response(200, { success: true, data: candidates });
  } catch (error) {
    logger.error('Error fetching learning candidates', error);
    return response(500, { success: false, error: 'Failed to fetch learning candidates' });
  }
};

// GET /admin/consciousness/learning-candidates/stats
export const getLearningCandidateStats: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const stats = await learningCandidateService.getCandidateStats(tenantId);
    
    return response(200, { success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching candidate stats', error);
    return response(500, { success: false, error: 'Failed to fetch candidate stats' });
  }
};

// DELETE /admin/consciousness/learning-candidates/{candidateId}
export const deleteLearningCandidate: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const candidateId = event.pathParameters?.candidateId;
    
    if (!candidateId) {
      return response(400, { success: false, error: 'Candidate ID required' });
    }
    
    await executeStatement(
      `DELETE FROM learning_candidates WHERE candidate_id = $1 AND tenant_id = $2`,
      [
        { name: 'candidateId', value: { stringValue: candidateId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );
    
    return response(200, { success: true, message: 'Candidate deleted' });
  } catch (error) {
    logger.error('Error deleting learning candidate', error);
    return response(500, { success: false, error: 'Failed to delete candidate' });
  }
};

// PUT /admin/consciousness/learning-candidates/{candidateId}/reject
export const rejectLearningCandidate: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const candidateId = event.pathParameters?.candidateId;
    const body = JSON.parse(event.body || '{}');
    
    if (!candidateId) {
      return response(400, { success: false, error: 'Candidate ID required' });
    }
    
    await learningCandidateService.markAsRejected([candidateId], body.reason || 'Admin rejected');
    
    return response(200, { success: true, message: 'Candidate rejected' });
  } catch (error) {
    logger.error('Error rejecting learning candidate', error);
    return response(500, { success: false, error: 'Failed to reject candidate' });
  }
};

// ============================================================================
// LORA EVOLUTION ENDPOINTS
// ============================================================================

// GET /admin/consciousness/evolution/jobs
export const getEvolutionJobs: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    
    const result = await executeStatement(
      `SELECT * FROM lora_evolution_jobs 
       WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    
    const jobs = result.rows.map((row: Record<string, unknown>) => ({
      jobId: row.job_id,
      baseModelId: row.base_model_id,
      adapterName: row.adapter_name,
      adapterVersion: Number(row.adapter_version || 0),
      status: row.status,
      trainingCandidatesCount: row.training_candidates_count ? Number(row.training_candidates_count) : null,
      trainingTokensTotal: row.training_tokens_total ? Number(row.training_tokens_total) : null,
      trainingLoss: row.training_loss ? Number(row.training_loss) : null,
      validationLoss: row.validation_loss ? Number(row.validation_loss) : null,
      sagemakerJobName: row.sagemaker_job_name,
      scheduledAt: row.scheduled_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
    
    return response(200, { success: true, data: jobs });
  } catch (error) {
    logger.error('Error fetching evolution jobs', error);
    return response(500, { success: false, error: 'Failed to fetch evolution jobs' });
  }
};

// GET /admin/consciousness/evolution/state
export const getEvolutionState: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const result = await executeStatement(
      `SELECT * FROM consciousness_evolution_state WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    if (result.rows.length === 0) {
      return response(200, { 
        success: true, 
        data: {
          generationNumber: 0,
          totalLearningCandidatesProcessed: 0,
          totalTrainingHours: 0,
          personalityDriftScore: 0,
          dominantLearnedTraits: [],
          avgPredictionAccuracy30d: null,
          firstEvolutionAt: null,
          lastEvolutionAt: null,
          nextScheduledEvolution: null,
        }
      });
    }
    
    const row = result.rows[0] as Record<string, unknown>;
    return response(200, { 
      success: true, 
      data: {
        currentAdapterId: row.current_adapter_id,
        currentAdapterVersion: Number(row.current_adapter_version || 0),
        generationNumber: Number(row.generation_number || 0),
        totalLearningCandidatesProcessed: Number(row.total_learning_candidates_processed || 0),
        totalPredictionErrorsLearnedFrom: Number(row.total_prediction_errors_learned_from || 0),
        totalTrainingHours: Number(row.total_training_hours || 0),
        personalityDriftScore: Number(row.personality_drift_score || 0),
        dominantLearnedTraits: row.dominant_learned_traits || [],
        avgPredictionAccuracy30d: row.avg_prediction_accuracy_30d ? Number(row.avg_prediction_accuracy_30d) : null,
        avgUserSatisfaction30d: row.avg_user_satisfaction_30d ? Number(row.avg_user_satisfaction_30d) : null,
        firstEvolutionAt: row.first_evolution_at,
        lastEvolutionAt: row.last_evolution_at,
        nextScheduledEvolution: row.next_scheduled_evolution,
      }
    });
  } catch (error) {
    logger.error('Error fetching evolution state', error);
    return response(500, { success: false, error: 'Failed to fetch evolution state' });
  }
};

// POST /admin/consciousness/evolution/trigger
export const triggerEvolution: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    // Check if there are enough candidates
    const stats = await learningCandidateService.getCandidateStats(tenantId);
    
    if (stats.totalPending < 50) {
      return response(400, { 
        success: false, 
        error: `Insufficient learning candidates (${stats.totalPending}/50 required)` 
      });
    }
    
    // This would trigger the evolution Lambda
    // For now, just return info about what would happen
    return response(200, { 
      success: true, 
      data: {
        message: 'Evolution would be triggered',
        candidatesAvailable: stats.totalPending,
        estimatedTokens: stats.estimatedTrainingTokens,
        byType: stats.byType,
      }
    });
  } catch (error) {
    logger.error('Error triggering evolution', error);
    return response(500, { success: false, error: 'Failed to trigger evolution' });
  }
};

// ============================================================================
// LOCAL EGO ENDPOINTS
// ============================================================================

// GET /admin/consciousness/ego/status
export const getEgoStatus: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const status = await localEgoService.getEgoStatus(tenantId);
    
    return response(200, { success: true, data: status });
  } catch (error) {
    logger.error('Error fetching ego status', error);
    return response(500, { success: false, error: 'Failed to fetch ego status' });
  }
};

// ============================================================================
// CONSCIOUSNESS PARAMETERS ENDPOINTS
// ============================================================================

// GET /admin/consciousness/config
export const getConsciousnessConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const result = await executeStatement(
      `SELECT * FROM consciousness_parameters WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    // Get all parameters organized by category
    const params: Record<string, Array<{
      paramId: string;
      name: string;
      value: number;
      min: number;
      max: number;
      description: string;
      isActive: boolean;
    }>> = {};
    
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const category = String(r.category || 'general');
      if (!params[category]) params[category] = [];
      params[category].push({
        paramId: String(r.param_id),
        name: String(r.parameter_name),
        value: Number(r.parameter_value || 0),
        min: Number(r.parameter_min || 0),
        max: Number(r.parameter_max || 1),
        description: String(r.description || ''),
        isActive: Boolean(r.is_active),
      });
    }
    
    // Also get evolution-specific config
    const evolutionConfig = {
      minCandidatesForTraining: 50,
      maxTrainingCandidates: 1000,
      maxTrainingTokens: 500000,
      trainingSchedule: 'Weekly (Sunday 3 AM)',
      loraRank: 16,
      loraAlpha: 32,
      learningRate: 0.0001,
      epochs: 3,
    };
    
    return response(200, { 
      success: true, 
      data: {
        parameters: params,
        evolutionConfig,
      }
    });
  } catch (error) {
    logger.error('Error fetching consciousness config', error);
    return response(500, { success: false, error: 'Failed to fetch consciousness config' });
  }
};

// PUT /admin/consciousness/config
export const updateConsciousnessConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { parameters, evolutionConfig } = body;
    
    // Update individual parameters
    if (parameters && Array.isArray(parameters)) {
      for (const param of parameters) {
        if (param.paramId && param.value !== undefined) {
          await executeStatement(
            `UPDATE consciousness_parameters 
             SET parameter_value = $3, updated_at = NOW()
             WHERE param_id = $1 AND tenant_id = $2`,
            [
              { name: 'paramId', value: { stringValue: param.paramId } },
              { name: 'tenantId', value: { stringValue: tenantId } },
              { name: 'value', value: { doubleValue: param.value } },
            ]
          );
        }
      }
    }
    
    // Evolution config would be stored separately (for future expansion)
    if (evolutionConfig) {
      logger.info('Evolution config update requested', { tenantId, evolutionConfig });
      // TODO: Store in dedicated evolution_config table
    }
    
    return response(200, { success: true, message: 'Configuration updated' });
  } catch (error) {
    logger.error('Error updating consciousness config', error);
    return response(500, { success: false, error: 'Failed to update configuration' });
  }
};
