/**
 * RADIANT v5.0 - Sovereign Mesh AI Helper Service
 * 
 * Parametric AI assistance for all node types (Methods, Agents, Services, Libraries).
 * Each component can independently configure AI capabilities for:
 * - Disambiguation: Resolve unclear inputs
 * - Parameter Inference: Fill in missing parameters  
 * - Error Recovery: Intelligent error handling
 * - Validation: Pre-execution checks
 * - Explanation: Human-readable summaries
 */

import { executeStatement, stringParam, longParam, doubleParam, boolParam, param } from '../../db/client';
import { enhancedLogger } from '../../logging/enhanced-logger';
import * as crypto from 'crypto';

const logger = enhancedLogger;

// ============================================================================
// TYPES
// ============================================================================

export interface AIHelperConfig {
  enabled: boolean;
  disambiguation?: {
    enabled: boolean;
    model?: string;
    confidenceThreshold?: number;
  };
  parameterInference?: {
    enabled: boolean;
    model?: string;
    examples?: Array<{ input: string; inferred: Record<string, unknown> }>;
  };
  errorRecovery?: {
    enabled: boolean;
    model?: string;
    maxAttempts?: number;
    strategies?: Array<{ error: string; recovery: string }>;
  };
  validation?: {
    enabled: boolean;
    model?: string;
    checks?: Array<{ field: string; check: string; severity: 'warning' | 'error' }>;
  };
  explanation?: {
    enabled: boolean;
    model?: string;
  };
}

export interface DisambiguationRequest {
  input: string;
  candidates: Array<{ id: string; label: string; confidence: number }>;
  context?: Record<string, unknown>;
}

export interface DisambiguationResult {
  resolved: boolean;
  selectedId?: string;
  needsUserInput: boolean;
  clarificationQuestion?: string;
  confidence: number;
}

export interface InferenceRequest {
  targetApp: string;
  targetAction: string;
  providedParams: Record<string, unknown>;
  missingParams: string[];
  context?: Record<string, unknown>;
}

export interface InferenceResult {
  inferred: Record<string, unknown>;
  confidence: Record<string, number>;
  needsConfirmation: string[];
}

export interface RecoveryRequest {
  error: { code: string; message: string; details?: unknown };
  action: { app: string; action: string; params: Record<string, unknown> };
  attemptNumber: number;
  context?: Record<string, unknown>;
}

export interface RecoveryResult {
  canAutoRecover: boolean;
  modifiedParams?: Record<string, unknown>;
  alternativeAction?: { action: string; params: Record<string, unknown> };
  suggestion: string;
  requiresHumanInput: boolean;
}

export interface ValidationRequest {
  app: string;
  action: string;
  params: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  issues: Array<{
    field: string;
    severity: 'warning' | 'error';
    message: string;
    suggestion?: string;
  }>;
}

export type AIHelperCallType = 
  | 'disambiguation' 
  | 'parameter_inference' 
  | 'error_recovery'
  | 'validation' 
  | 'explanation' 
  | 'code_generation';

// ============================================================================
// AI HELPER SERVICE
// ============================================================================

class AIHelperService {
  private readonly CACHE_PREFIX = 'ai_helper:';
  private readonly DEFAULT_CACHE_TTL = 3600;
  private configCache: Map<string, { config: AIHelperConfig; cachedAt: number }> = new Map();
  private readonly CONFIG_CACHE_TTL = 60000; // 1 minute

  /**
   * Get merged config: system → tenant → caller
   */
  async getEffectiveConfig(
    tenantId: string,
    callerConfig?: AIHelperConfig
  ): Promise<AIHelperConfig> {
    const systemConfig = await this.getSystemConfig();
    const tenantConfig = await this.getTenantConfig(tenantId);
    return this.mergeConfigs(systemConfig, tenantConfig, callerConfig);
  }

  /**
   * Disambiguate when multiple candidates match
   */
  async disambiguate(
    request: DisambiguationRequest,
    tenantId: string,
    config?: AIHelperConfig
  ): Promise<DisambiguationResult> {
    const effective = await this.getEffectiveConfig(tenantId, config);
    
    if (!effective.enabled || !effective.disambiguation?.enabled) {
      return { resolved: false, needsUserInput: true, confidence: 0 };
    }

    const startTime = Date.now();
    const model = effective.disambiguation.model || 'claude-haiku-35';
    const threshold = effective.disambiguation.confidenceThreshold || 0.7;

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey('disambiguation', request);
      const cached = await this.getFromCache<DisambiguationResult>(cacheKey, tenantId);
      if (cached) {
        await this.recordCall(tenantId, 'disambiguation', model, { cached: true });
        return cached;
      }

      // Build prompt for disambiguation
      const prompt = this.buildDisambiguationPrompt(request);
      
      // Call model (using existing model router infrastructure)
      const response = await this.callModel(tenantId, model, prompt);
      const latency = Date.now() - startTime;

      const parsed = this.parseJsonResponse<{
        selectedId: string | null;
        confidence: number;
        needsClarification: boolean;
        clarificationQuestion?: string;
      }>(response.content);

      const result: DisambiguationResult = {
        resolved: parsed.confidence >= threshold && !!parsed.selectedId,
        selectedId: parsed.selectedId || undefined,
        needsUserInput: parsed.needsClarification || parsed.confidence < threshold,
        clarificationQuestion: parsed.clarificationQuestion,
        confidence: parsed.confidence,
      };

      // Cache and record
      await this.setCache(cacheKey, result, tenantId);
      await this.recordCall(tenantId, 'disambiguation', model, {
        latency,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cost: response.cost,
      });

      return result;
    } catch (error) {
      logger.error('Disambiguation failed', { error, tenantId });
      return { resolved: false, needsUserInput: true, confidence: 0 };
    }
  }

  /**
   * Infer missing parameters
   */
  async inferParameters(
    request: InferenceRequest,
    tenantId: string,
    config?: AIHelperConfig
  ): Promise<InferenceResult> {
    const effective = await this.getEffectiveConfig(tenantId, config);
    
    if (!effective.enabled || !effective.parameterInference?.enabled) {
      return { inferred: {}, confidence: {}, needsConfirmation: request.missingParams };
    }

    const startTime = Date.now();
    const model = effective.parameterInference.model || 'claude-haiku-35';

    try {
      // Check learned inferences first
      const learned = await this.getLearnedInferences(
        request.targetApp,
        request.targetAction,
        request.providedParams,
        tenantId
      );
      
      const stillMissing = request.missingParams.filter(p => !(p in learned.inferred));
      if (stillMissing.length === 0) {
        return learned;
      }

      // Build prompt
      const examples = effective.parameterInference.examples || [];
      const prompt = this.buildInferencePrompt(request, stillMissing, examples);

      // Call model
      const response = await this.callModel(tenantId, model, prompt);
      const latency = Date.now() - startTime;

      const parsed = this.parseJsonResponse<{
        inferred: Record<string, unknown>;
        confidence: Record<string, number>;
        needsConfirmation: string[];
      }>(response.content);

      await this.recordCall(tenantId, 'parameter_inference', model, {
        latency,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cost: response.cost,
      });

      return {
        inferred: { ...learned.inferred, ...parsed.inferred },
        confidence: { ...learned.confidence, ...parsed.confidence },
        needsConfirmation: parsed.needsConfirmation || [],
      };
    } catch (error) {
      logger.error('Parameter inference failed', { error, tenantId });
      return { inferred: {}, confidence: {}, needsConfirmation: request.missingParams };
    }
  }

  /**
   * Suggest error recovery
   */
  async suggestRecovery(
    request: RecoveryRequest,
    tenantId: string,
    config?: AIHelperConfig
  ): Promise<RecoveryResult> {
    const effective = await this.getEffectiveConfig(tenantId, config);
    
    if (!effective.enabled || !effective.errorRecovery?.enabled) {
      return {
        canAutoRecover: false,
        suggestion: `Error: ${request.error.message}`,
        requiresHumanInput: true,
      };
    }

    const maxAttempts = effective.errorRecovery.maxAttempts || 3;
    if (request.attemptNumber >= maxAttempts) {
      return {
        canAutoRecover: false,
        suggestion: `Max recovery attempts (${maxAttempts}) exceeded.`,
        requiresHumanInput: true,
      };
    }

    const startTime = Date.now();
    const model = effective.errorRecovery.model || 'claude-haiku-35';

    try {
      // Check for known recovery strategy
      const knownStrategy = effective.errorRecovery.strategies?.find(
        s => request.error.code.includes(s.error) || request.error.message.includes(s.error)
      );

      const prompt = this.buildRecoveryPrompt(request, knownStrategy);
      const response = await this.callModel(tenantId, model, prompt);
      const latency = Date.now() - startTime;

      const result = this.parseJsonResponse<RecoveryResult>(response.content);

      await this.recordCall(tenantId, 'error_recovery', model, {
        latency,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cost: response.cost,
      });

      return result;
    } catch (error) {
      logger.error('Recovery suggestion failed', { error, tenantId });
      return {
        canAutoRecover: false,
        suggestion: `Error: ${request.error.message}`,
        requiresHumanInput: true,
      };
    }
  }

  /**
   * Validate before execution
   */
  async validate(
    request: ValidationRequest,
    tenantId: string,
    config?: AIHelperConfig
  ): Promise<ValidationResult> {
    const effective = await this.getEffectiveConfig(tenantId, config);
    
    if (!effective.enabled || !effective.validation?.enabled) {
      return { isValid: true, issues: [] };
    }

    const startTime = Date.now();
    const model = effective.validation.model || 'claude-sonnet-4';
    const checks = effective.validation.checks || [];

    try {
      const prompt = this.buildValidationPrompt(request, checks);
      const response = await this.callModel(tenantId, model, prompt);
      const latency = Date.now() - startTime;

      const result = this.parseJsonResponse<ValidationResult>(response.content);

      await this.recordCall(tenantId, 'validation', model, {
        latency,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cost: response.cost,
      });

      return result;
    } catch (error) {
      logger.error('Validation failed', { error, tenantId });
      return { isValid: true, issues: [] };
    }
  }

  /**
   * Explain what was done
   */
  async explain(
    action: string,
    params: Record<string, unknown>,
    result: unknown,
    tenantId: string,
    config?: AIHelperConfig
  ): Promise<string> {
    const effective = await this.getEffectiveConfig(tenantId, config);
    
    if (!effective.enabled || !effective.explanation?.enabled) {
      return `Executed ${action} successfully.`;
    }

    const startTime = Date.now();
    const model = effective.explanation.model || 'claude-haiku-35';

    try {
      const prompt = `Explain in 1-2 sentences what this action did:
Action: ${action}
Parameters: ${JSON.stringify(params)}
Result: ${JSON.stringify(result)}

Be concise and user-friendly.`;

      const response = await this.callModel(tenantId, model, prompt);
      const latency = Date.now() - startTime;

      await this.recordCall(tenantId, 'explanation', model, {
        latency,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cost: response.cost,
      });

      return response.content;
    } catch (error) {
      logger.error('Explanation generation failed', { error, tenantId });
      return `Executed ${action} successfully.`;
    }
  }

  /**
   * Record a correction for learning
   */
  async recordCorrection(
    appId: string,
    inferenceType: string,
    inputContext: Record<string, unknown>,
    originalValue: unknown,
    correctedValue: unknown,
    userId: string,
    tenantId: string
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO app_learned_inferences 
         (app_id, tenant_id, inference_type, input_context, inferred_value, 
          was_corrected, corrected_value, corrected_by, corrected_at)
         VALUES (
           (SELECT id FROM apps WHERE name = :appName LIMIT 1), 
           :tenantId, :inferenceType, :inputContext::jsonb, :originalValue::jsonb, 
           true, :correctedValue::jsonb, :userId, NOW()
         )`,
        [
          stringParam('appName', appId),
          stringParam('tenantId', tenantId),
          stringParam('inferenceType', inferenceType),
          stringParam('inputContext', JSON.stringify(inputContext)),
          stringParam('originalValue', JSON.stringify(originalValue)),
          stringParam('correctedValue', JSON.stringify(correctedValue)),
          stringParam('userId', userId),
        ]
      );
    } catch (error) {
      logger.error('Failed to record correction', { error, appId, tenantId });
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async getSystemConfig(): Promise<AIHelperConfig> {
    const cacheKey = 'system';
    const cached = this.configCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM ai_helper_config WHERE scope = 'system' LIMIT 1`,
        []
      );
      const config = this.rowToConfig(result.rows?.[0]);
      this.configCache.set(cacheKey, { config, cachedAt: Date.now() });
      return config;
    } catch (error) {
      logger.warn('Failed to load system AI helper config', { error });
      return { enabled: true };
    }
  }

  private async getTenantConfig(tenantId: string): Promise<AIHelperConfig | undefined> {
    const cacheKey = `tenant:${tenantId}`;
    const cached = this.configCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM ai_helper_config WHERE scope = 'tenant' AND tenant_id = :tenantId LIMIT 1`,
        [stringParam('tenantId', tenantId)]
      );
      if (!result.rows?.[0]) return undefined;
      
      const config = this.rowToConfig(result.rows[0]);
      this.configCache.set(cacheKey, { config, cachedAt: Date.now() });
      return config;
    } catch (error) {
      logger.warn('Failed to load tenant AI helper config', { error, tenantId });
      return undefined;
    }
  }

  private rowToConfig(row: Record<string, unknown> | undefined): AIHelperConfig {
    if (!row) return { enabled: true };
    
    const getValue = (field: string) => {
      const val = row[field];
      if (val && typeof val === 'object' && 'stringValue' in val) {
        return (val as { stringValue: string }).stringValue;
      }
      if (val && typeof val === 'object' && 'booleanValue' in val) {
        return (val as { booleanValue: boolean }).booleanValue;
      }
      return val;
    };

    return {
      enabled: getValue('is_enabled') !== false,
      disambiguation: {
        enabled: true,
        model: getValue('default_model_disambiguation') as string || 'claude-haiku-35',
        confidenceThreshold: parseFloat(getValue('disambiguation_confidence_threshold') as string) || 0.7,
      },
      parameterInference: {
        enabled: true,
        model: getValue('default_model_inference') as string || 'claude-haiku-35',
      },
      errorRecovery: {
        enabled: true,
        model: getValue('default_model_recovery') as string || 'claude-haiku-35',
      },
      validation: {
        enabled: false,
        model: getValue('default_model_validation') as string || 'claude-sonnet-4',
      },
      explanation: {
        enabled: true,
        model: getValue('default_model_explanation') as string || 'claude-haiku-35',
      },
    };
  }

  private mergeConfigs(...configs: (AIHelperConfig | undefined)[]): AIHelperConfig {
    const result: AIHelperConfig = { enabled: true };
    for (const config of configs) {
      if (!config) continue;
      if (config.enabled === false) result.enabled = false;
      if (config.disambiguation) result.disambiguation = { ...result.disambiguation, ...config.disambiguation };
      if (config.parameterInference) result.parameterInference = { ...result.parameterInference, ...config.parameterInference };
      if (config.errorRecovery) result.errorRecovery = { ...result.errorRecovery, ...config.errorRecovery };
      if (config.validation) result.validation = { ...result.validation, ...config.validation };
      if (config.explanation) result.explanation = { ...result.explanation, ...config.explanation };
    }
    return result;
  }

  private async getLearnedInferences(
    app: string,
    action: string,
    _context: Record<string, unknown>,
    tenantId: string
  ): Promise<InferenceResult> {
    try {
      const result = await executeStatement(
        `SELECT inferred_value, confidence FROM app_learned_inferences 
         WHERE app_id = (SELECT id FROM apps WHERE name = :appName LIMIT 1)
         AND inference_type = :action
         AND (tenant_id IS NULL OR tenant_id = :tenantId)
         AND confidence > 0.8
         ORDER BY times_successful DESC LIMIT 10`,
        [
          stringParam('appName', app),
          stringParam('action', action),
          stringParam('tenantId', tenantId),
        ]
      );

      const inferred: Record<string, unknown> = {};
      const confidence: Record<string, number> = {};

      for (const row of result.rows || []) {
        const getValue = (field: string) => {
          const val = row[field];
          if (val && typeof val === 'object' && 'stringValue' in val) {
            return (val as { stringValue: string }).stringValue;
          }
          return val;
        };

        try {
          const value = JSON.parse(getValue('inferred_value') as string || '{}');
          Object.assign(inferred, value);
          confidence[action] = parseFloat(getValue('confidence') as string) || 0.5;
        } catch {
          // Skip malformed entries
        }
      }

      return { inferred, confidence, needsConfirmation: [] };
    } catch (error) {
      logger.warn('Failed to get learned inferences', { error, app, action });
      return { inferred: {}, confidence: {}, needsConfirmation: [] };
    }
  }

  private generateCacheKey(type: string, data: unknown): string {
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify({ type, data }))
      .digest('hex')
      .substring(0, 32);
    return `${this.CACHE_PREFIX}${type}:${hash}`;
  }

  private async getFromCache<T>(key: string, tenantId: string): Promise<T | null> {
    try {
      const result = await executeStatement(
        `SELECT output FROM ai_helper_cache 
         WHERE cache_key = :key 
         AND (is_global = true OR tenant_id IS NULL OR tenant_id = :tenantId)
         AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1`,
        [stringParam('key', key), stringParam('tenantId', tenantId)]
      );

      if (result.rows?.[0]) {
        const output = result.rows[0].output;
        if (output && typeof output === 'object' && 'stringValue' in output) {
          // Update hit count
          await executeStatement(
            `UPDATE ai_helper_cache SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE cache_key = :key`,
            [stringParam('key', key)]
          );
          return JSON.parse((output as { stringValue: string }).stringValue);
        }
      }
      return null;
    } catch (error) {
      logger.warn('Cache read failed', { error, key });
      return null;
    }
  }

  private async setCache(key: string, value: unknown, tenantId: string, ttl = this.DEFAULT_CACHE_TTL): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
      await executeStatement(
        `INSERT INTO ai_helper_cache (cache_key, call_type, input_hash, output, tenant_id, expires_at)
         VALUES (:key, 'disambiguation', :key, :output::jsonb, :tenantId, :expiresAt::timestamptz)
         ON CONFLICT (cache_key) DO UPDATE SET 
           output = EXCLUDED.output,
           expires_at = EXCLUDED.expires_at`,
        [
          stringParam('key', key),
          stringParam('output', JSON.stringify(value)),
          stringParam('tenantId', tenantId),
          stringParam('expiresAt', expiresAt),
        ]
      );
    } catch (error) {
      logger.warn('Cache write failed', { error, key });
    }
  }

  private async recordCall(
    tenantId: string,
    callType: AIHelperCallType,
    model: string,
    metrics: { cached?: boolean; latency?: number; inputTokens?: number; outputTokens?: number; cost?: number }
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO ai_helper_calls 
         (tenant_id, call_type, caller_type, caller_id, model_used, input_hash, 
          status, latency_ms, input_tokens, output_tokens, cost_usd, was_cached)
         VALUES (:tenantId, :callType::ai_helper_call_type, 'service', 'ai_helper', :model, '', 
          :status::ai_helper_status, :latency, :inputTokens, :outputTokens, :cost, :cached)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('callType', callType),
          stringParam('model', model),
          stringParam('status', metrics.cached ? 'cached' : 'success'),
          longParam('latency', metrics.latency || 0),
          longParam('inputTokens', metrics.inputTokens || 0),
          longParam('outputTokens', metrics.outputTokens || 0),
          doubleParam('cost', metrics.cost || 0),
          boolParam('cached', metrics.cached || false),
        ]
      );
    } catch (error) {
      logger.warn('Failed to record AI helper call', { error, tenantId, callType });
    }
  }

  // Prompt builders
  private buildDisambiguationPrompt(request: DisambiguationRequest): string {
    return `You are helping disambiguate user intent.

Input: "${request.input}"

Candidates:
${request.candidates.map((c, i) => `${i + 1}. [${c.id}] ${c.label} (confidence: ${c.confidence})`).join('\n')}

${request.context ? `Context: ${JSON.stringify(request.context)}` : ''}

Respond with JSON only:
{
  "selectedId": "id of best match or null",
  "confidence": 0.0-1.0,
  "needsClarification": true/false,
  "clarificationQuestion": "question if unclear"
}`;
  }

  private buildInferencePrompt(
    request: InferenceRequest, 
    missingParams: string[], 
    examples: Array<{ input: string; inferred: Record<string, unknown> }>
  ): string {
    return `Infer missing parameters for an API action.

App: ${request.targetApp}
Action: ${request.targetAction}
Provided: ${JSON.stringify(request.providedParams)}
Missing: ${missingParams.join(', ')}
${request.context ? `Context: ${JSON.stringify(request.context)}` : ''}

${examples.length > 0 ? `Examples:\n${examples.map(e => `Input: ${e.input}\nInferred: ${JSON.stringify(e.inferred)}`).join('\n\n')}` : ''}

Respond with JSON only:
{
  "inferred": { "param": "value" },
  "confidence": { "param": 0.0-1.0 },
  "needsConfirmation": ["param names with low confidence"]
}`;
  }

  private buildRecoveryPrompt(
    request: RecoveryRequest, 
    knownStrategy?: { error: string; recovery: string }
  ): string {
    return `An API action failed. Suggest recovery.

Action: ${request.action.app}.${request.action.action}
Params: ${JSON.stringify(request.action.params)}
Error: ${request.error.code} - ${request.error.message}
Attempt: ${request.attemptNumber}
${knownStrategy ? `Known fix: ${knownStrategy.recovery}` : ''}

Respond with JSON only:
{
  "canAutoRecover": true/false,
  "modifiedParams": { ... } or null,
  "alternativeAction": { "action": "...", "params": { ... } } or null,
  "suggestion": "human-readable explanation",
  "requiresHumanInput": true/false
}`;
  }

  private buildValidationPrompt(
    request: ValidationRequest, 
    checks: Array<{ field: string; check: string; severity: 'warning' | 'error' }>
  ): string {
    return `Validate parameters before API execution.

App: ${request.app}
Action: ${request.action}
Params: ${JSON.stringify(request.params)}
${request.context ? `Context: ${JSON.stringify(request.context)}` : ''}

Checks:
${checks.map(c => `- ${c.field}: ${c.check} (${c.severity})`).join('\n')}

Respond with JSON only:
{
  "isValid": true/false,
  "issues": [
    { "field": "...", "severity": "warning|error", "message": "...", "suggestion": "..." }
  ]
}`;
  }

  private parseJsonResponse<T>(content: string): T {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch {
      throw new Error(`Failed to parse JSON response: ${content.substring(0, 200)}`);
    }
  }

  // Model call wrapper - integrates with existing model router
  private async callModel(
    tenantId: string, 
    model: string, 
    prompt: string
  ): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number }; cost?: number }> {
    // This integrates with the existing model router infrastructure
    // For now, return a placeholder - actual implementation will use ModelRouterService
    try {
      // Import dynamically to avoid circular dependencies
      // Stub modelRouter for compilation
      const modelRouter = { complete: async (_: any) => ({ content: 'stub', usage: { inputTokens: 0, outputTokens: 0 }, cost: 0 }) };
      
      const response = await modelRouter.complete({
        tenantId,
        model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1000,
        responseFormat: prompt.includes('JSON only') ? { type: 'json_object' } : undefined,
      });

      return {
        content: response.content,
        usage: response.usage ? {
          inputTokens: response.usage.inputTokens || 0,
          outputTokens: response.usage.outputTokens || 0,
        } : undefined,
        cost: response.cost,
      };
    } catch (error) {
      logger.error('Model call failed', { error, model, tenantId });
      throw error;
    }
  }
}

// Export singleton instance
export const aiHelperService = new AIHelperService();
