import { executeStatement } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

type FeedbackRating = 'positive' | 'negative' | 'neutral';
type FeedbackCategory = 'accuracy' | 'relevance' | 'tone' | 'format' | 'speed' | 'safety' | 'creativity' | 'completeness' | 'other';
type ImplicitSignalType = 'regenerate' | 'copy' | 'share' | 'abandon' | 'switch_model' | 'edit_response' | 'expand' | 'continue' | 'follow_up';
type LearningScope = 'user' | 'tenant' | 'global';

interface ExecutionManifest {
  tenantId: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  requestType: 'chat' | 'completion' | 'orchestration' | 'service';
  taskType?: string;
  domainMode?: string;
  modelsUsed: string[];
  modelVersions?: Record<string, string>;
  orchestrationId?: string;
  orchestrationName?: string;
  servicesUsed?: string[];
  thermalStates?: Record<string, string>;
  providerHealth?: Record<string, unknown>;
  brainReasoning?: string;
  brainConfidence?: number;
  wasUserOverride?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalLatencyMs?: number;
  timeToFirstTokenMs?: number;
  totalCost?: number;
  wasStreamed?: boolean;
}

const IMPLICIT_SIGNAL_WEIGHTS: Record<ImplicitSignalType, number> = {
  regenerate: -0.3,
  copy: 0.2,
  share: 0.4,
  abandon: -0.5,
  switch_model: -0.2,
  edit_response: -0.1,
  expand: 0.3,
  continue: 0.2,
  follow_up: 0.1,
};

export class FeedbackLearningService {
  async createManifest(manifest: ExecutionManifest): Promise<string> {
    const outputId = `out_${uuidv4().replace(/-/g, '').substring(0, 24)}`;

    await executeStatement(
      `INSERT INTO execution_manifests 
       (output_id, tenant_id, user_id, conversation_id, message_id, request_type, task_type,
        domain_mode, models_used, model_versions, orchestration_id, orchestration_name,
        services_used, thermal_states_at_execution, provider_health_at_execution,
        brain_reasoning, brain_confidence, was_user_override, input_tokens, output_tokens,
        total_latency_ms, time_to_first_token_ms, total_cost, was_streamed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        { name: 'outputId', value: { stringValue: outputId } },
        { name: 'tenantId', value: { stringValue: manifest.tenantId } },
        { name: 'userId', value: { stringValue: manifest.userId } },
        { name: 'conversationId', value: manifest.conversationId ? { stringValue: manifest.conversationId } : { isNull: true } },
        { name: 'messageId', value: manifest.messageId ? { stringValue: manifest.messageId } : { isNull: true } },
        { name: 'requestType', value: { stringValue: manifest.requestType } },
        { name: 'taskType', value: manifest.taskType ? { stringValue: manifest.taskType } : { isNull: true } },
        { name: 'domainMode', value: manifest.domainMode ? { stringValue: manifest.domainMode } : { isNull: true } },
        { name: 'modelsUsed', value: { stringValue: `{${manifest.modelsUsed.join(',')}}` } },
        { name: 'modelVersions', value: { stringValue: JSON.stringify(manifest.modelVersions || {}) } },
        { name: 'orchestrationId', value: manifest.orchestrationId ? { stringValue: manifest.orchestrationId } : { isNull: true } },
        { name: 'orchestrationName', value: manifest.orchestrationName ? { stringValue: manifest.orchestrationName } : { isNull: true } },
        { name: 'servicesUsed', value: manifest.servicesUsed ? { stringValue: `{${manifest.servicesUsed.join(',')}}` } : { isNull: true } },
        { name: 'thermalStates', value: { stringValue: JSON.stringify(manifest.thermalStates || {}) } },
        { name: 'providerHealth', value: { stringValue: JSON.stringify(manifest.providerHealth || {}) } },
        { name: 'brainReasoning', value: manifest.brainReasoning ? { stringValue: manifest.brainReasoning } : { isNull: true } },
        { name: 'brainConfidence', value: manifest.brainConfidence !== undefined ? { doubleValue: manifest.brainConfidence } : { isNull: true } },
        { name: 'wasUserOverride', value: { booleanValue: manifest.wasUserOverride || false } },
        { name: 'inputTokens', value: manifest.inputTokens ? { longValue: manifest.inputTokens } : { isNull: true } },
        { name: 'outputTokens', value: manifest.outputTokens ? { longValue: manifest.outputTokens } : { isNull: true } },
        { name: 'totalLatencyMs', value: manifest.totalLatencyMs ? { longValue: manifest.totalLatencyMs } : { isNull: true } },
        { name: 'timeToFirstTokenMs', value: manifest.timeToFirstTokenMs ? { longValue: manifest.timeToFirstTokenMs } : { isNull: true } },
        { name: 'totalCost', value: manifest.totalCost !== undefined ? { doubleValue: manifest.totalCost } : { isNull: true } },
        { name: 'wasStreamed', value: { booleanValue: manifest.wasStreamed || false } },
      ]
    );

    return outputId;
  }

  async recordExplicitFeedback(
    outputId: string,
    tenantId: string,
    userId: string,
    rating: FeedbackRating,
    categories?: FeedbackCategory[],
    textFeedback?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO feedback_explicit (output_id, tenant_id, user_id, rating, categories, text_feedback)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'outputId', value: { stringValue: outputId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'rating', value: { stringValue: rating } },
        { name: 'categories', value: categories ? { stringValue: `{${categories.join(',')}}` } : { isNull: true } },
        { name: 'textFeedback', value: textFeedback ? { stringValue: textFeedback } : { isNull: true } },
      ]
    );

    // Update model scores
    await this.updateModelScores(outputId, rating);
  }

  async recordImplicitSignal(
    outputId: string,
    tenantId: string,
    userId: string,
    signalType: ImplicitSignalType,
    signalData?: Record<string, unknown>
  ): Promise<void> {
    const weight = IMPLICIT_SIGNAL_WEIGHTS[signalType];

    await executeStatement(
      `INSERT INTO feedback_implicit (output_id, tenant_id, user_id, signal_type, signal_weight, signal_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'outputId', value: { stringValue: outputId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'signalType', value: { stringValue: signalType } },
        { name: 'signalWeight', value: { doubleValue: weight } },
        { name: 'signalData', value: { stringValue: JSON.stringify(signalData || {}) } },
      ]
    );
  }

  async getModelScore(
    modelId: string,
    taskType: string,
    scope: LearningScope,
    scopeId?: string
  ): Promise<{ qualityScore: number; confidence: number; totalSamples: number } | null> {
    const result = await executeStatement(
      `SELECT quality_score, confidence, total_samples
       FROM model_scores
       WHERE model_id = $1 AND task_type = $2 AND scope = $3 
       AND (scope_id = $4 OR (scope_id IS NULL AND $4 IS NULL))`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'taskType', value: { stringValue: taskType } },
        { name: 'scope', value: { stringValue: scope } },
        { name: 'scopeId', value: scopeId ? { stringValue: scopeId } : { isNull: true } },
      ]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      qualityScore: Number(row.quality_score),
      confidence: Number(row.confidence),
      totalSamples: parseInt(String(row.total_samples), 10),
    };
  }

  async getRecommendedModel(
    taskType: string,
    tenantId: string,
    userId: string,
    availableModels: string[]
  ): Promise<{ modelId: string; score: number; confidence: number; source: LearningScope }> {
    // Try user-level first
    for (const modelId of availableModels) {
      const userScore = await this.getModelScore(modelId, taskType, 'user', userId);
      if (userScore && userScore.confidence > 0.6) {
        return { modelId, score: userScore.qualityScore, confidence: userScore.confidence, source: 'user' };
      }
    }

    // Try tenant-level
    for (const modelId of availableModels) {
      const tenantScore = await this.getModelScore(modelId, taskType, 'tenant', tenantId);
      if (tenantScore && tenantScore.confidence > 0.5) {
        return { modelId, score: tenantScore.qualityScore, confidence: tenantScore.confidence, source: 'tenant' };
      }
    }

    // Fall back to global
    let bestModel = availableModels[0];
    let bestScore = 0.5;
    let bestConfidence = 0;

    for (const modelId of availableModels) {
      const globalScore = await this.getModelScore(modelId, taskType, 'global');
      if (globalScore && globalScore.qualityScore > bestScore) {
        bestModel = modelId;
        bestScore = globalScore.qualityScore;
        bestConfidence = globalScore.confidence;
      }
    }

    return { modelId: bestModel, score: bestScore, confidence: bestConfidence, source: 'global' };
  }

  private async updateModelScores(outputId: string, rating: FeedbackRating): Promise<void> {
    // Get manifest to find models and context
    const manifestResult = await executeStatement(
      `SELECT tenant_id, user_id, models_used, task_type FROM execution_manifests WHERE output_id = $1`,
      [{ name: 'outputId', value: { stringValue: outputId } }]
    );

    if (manifestResult.rows.length === 0) return;

    const manifest = manifestResult.rows[0] as Record<string, unknown>;
    const tenantId = String(manifest.tenant_id);
    const userId = String(manifest.user_id);
    const taskType = String(manifest.task_type || 'general');
    const modelsUsed = manifest.models_used as string[];

    for (const modelId of modelsUsed) {
      // Update all three scopes
      await this.updateScore(modelId, taskType, 'user', userId, rating);
      await this.updateScore(modelId, taskType, 'tenant', tenantId, rating);
      await this.updateScore(modelId, taskType, 'global', undefined, rating);
    }
  }

  private async updateScore(
    modelId: string,
    taskType: string,
    scope: LearningScope,
    scopeId: string | undefined,
    rating: FeedbackRating
  ): Promise<void> {
    const positiveInc = rating === 'positive' ? 1 : 0;
    const negativeInc = rating === 'negative' ? 1 : 0;
    const neutralInc = rating === 'neutral' ? 1 : 0;

    await executeStatement(
      `INSERT INTO model_scores (scope, scope_id, model_id, task_type, positive_count, negative_count, neutral_count, total_samples)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
       ON CONFLICT (scope, scope_id, model_id, task_type)
       DO UPDATE SET 
         positive_count = model_scores.positive_count + $5,
         negative_count = model_scores.negative_count + $6,
         neutral_count = model_scores.neutral_count + $7,
         total_samples = model_scores.total_samples + 1,
         quality_score = (model_scores.positive_count + $5)::DECIMAL / GREATEST((model_scores.total_samples + 1), 1),
         confidence = LEAST(1.0, (model_scores.total_samples + 1)::DECIMAL / 50.0),
         last_updated = NOW()`,
      [
        { name: 'scope', value: { stringValue: scope } },
        { name: 'scopeId', value: scopeId ? { stringValue: scopeId } : { isNull: true } },
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'taskType', value: { stringValue: taskType } },
        { name: 'positiveInc', value: { longValue: positiveInc } },
        { name: 'negativeInc', value: { longValue: negativeInc } },
        { name: 'neutralInc', value: { longValue: neutralInc } },
      ]
    );
  }
}

export const feedbackLearningService = new FeedbackLearningService();
