// ============================================================================
// RADIANT Artifact Engine - Main Service
// packages/infrastructure/lambda/shared/services/artifact-engine/artifact-engine.service.ts
// Version: 4.19.0
// ============================================================================

import { query } from '../../db/pool-manager';
import { IntentClassifierService } from './intent-classifier';
import { CodeGeneratorService } from './code-generator';
import { CatoArtifactValidator } from './cato-validator';
import { ReflexionService } from './reflexion.service';
import {
  ArtifactGenerationRequest,
  ArtifactGenerationResult,
  ArtifactGenerationPlan,
  ArtifactValidationResult,
  ReflexionContext,
  GenerationStatus,
  StreamingChunk,
  LogType,
} from './types';

export class ArtifactEngineService {
  private intentClassifier: IntentClassifierService;
  private codeGenerator: CodeGeneratorService;
  private validator: CatoArtifactValidator;
  private reflexion: ReflexionService;

  constructor() {
    this.intentClassifier = new IntentClassifierService();
    this.codeGenerator = new CodeGeneratorService();
    this.validator = new CatoArtifactValidator();
    this.reflexion = new ReflexionService();
  }

  /**
   * Main entry point: Generate artifact with full pipeline
   */
  async generate(request: ArtifactGenerationRequest): Promise<ArtifactGenerationResult> {
    const startTime = Date.now();
    const sessionId = await this.createSession(request);

    try {
      // Phase 1: Planning
      await this.updateStatus(sessionId, 'planning');
      await this.log(sessionId, 'thinking', 'Analyzing your request...');

      const plan = await this.intentClassifier.classifyAndPlan(
        request.prompt,
        request.mood
      );

      await this.log(
        sessionId,
        'planning',
        `Identified as ${plan.intent} (${plan.complexity}). Planning ${plan.steps.length} steps.`
      );

      await query(
        `UPDATE artifact_generation_sessions
         SET plan = $2, estimated_complexity = $3, selected_model = $4, intent_classification = $5
         WHERE id = $1`,
        [sessionId, JSON.stringify(plan), plan.complexity, plan.suggestedModel, plan.intent]
      );

      // Phase 2: Generation
      await this.updateStatus(sessionId, 'generating');
      await this.log(
        sessionId,
        'generating',
        `Using ${plan.suggestedModel.split('/')[1]} to generate code...`
      );

      const code = await this.codeGenerator.generateComplete(sessionId, plan, request);

      await this.log(sessionId, 'generating', 'Code generation complete. Starting validation...');

      // Phase 3: Validation with Reflexion Loop
      const validationResult = await this.validateWithReflexion(
        sessionId,
        code,
        request.tenantId,
        plan
      );

      // Phase 4: Store Artifact (if valid)
      let artifactId: string | undefined;

      if (validationResult.validation.isValid) {
        await this.updateStatus(sessionId, 'completed');

        // Create canvas if not provided
        let canvasId = request.canvasId;
        if (!canvasId) {
          const canvasResult = await query<{ id: string }>(
            `INSERT INTO canvases (tenant_id, user_id, name, type, chat_id)
             VALUES ($1, $2, $3, 'generated', $4)
             RETURNING id`,
            [request.tenantId, request.userId, `Generated: ${plan.intent}`, request.chatId]
          );
          canvasId = canvasResult.rows[0]?.id;
        }

        // Add artifact to canvas
        if (canvasId) {
          const artifactResult = await query<{ id: string }>(
            `INSERT INTO artifacts (
               canvas_id, tenant_id, user_id, artifact_type, title, content, language,
               generation_session_id, verification_status, verification_timestamp
             ) VALUES ($1, $2, $3, 'react', $4, $5, 'tsx', $6, 'validated', NOW())
             RETURNING id`,
            [
              canvasId,
              request.tenantId,
              request.userId,
              this.generateTitle(request.prompt, plan.intent),
              validationResult.finalCode,
              sessionId,
            ]
          );
          artifactId = artifactResult.rows[0]?.id;
        }

        // Update pattern usage stats
        if (plan.similarPatterns.length > 0) {
          await this.updatePatternStats(plan.similarPatterns[0].patternId, true);
        }

        await this.log(sessionId, 'success', 'Artifact created and validated!');
      } else {
        await this.updateStatus(sessionId, 'rejected');

        if (plan.similarPatterns.length > 0) {
          await this.updatePatternStats(plan.similarPatterns[0].patternId, false);
        }

        await this.log(
          sessionId,
          'error',
          `Validation failed: ${validationResult.validation.errors.map((e) => e.message).join(', ')}`
        );
      }

      // Phase 5: Finalize Session
      const generationTimeMs = Date.now() - startTime;
      const tokensUsed = await this.getTokensUsed(sessionId);
      const estimatedCost = this.calculateCost(tokensUsed, plan.suggestedModel);

      await query(
        `UPDATE artifact_generation_sessions
         SET artifact_id = $2, verification_status = $3, cato_validation_result = $4,
             total_tokens_used = $5, estimated_cost = $6, completed_at = NOW()
         WHERE id = $1`,
        [
          sessionId,
          artifactId,
          validationResult.validation.isValid ? 'validated' : 'rejected',
          JSON.stringify(validationResult.validation),
          tokensUsed,
          estimatedCost,
        ]
      );

      return {
        sessionId,
        artifactId,
        status: validationResult.validation.isValid ? 'completed' : 'rejected',
        verificationStatus: validationResult.validation.isValid ? 'validated' : 'rejected',
        code: validationResult.finalCode,
        validation: validationResult.validation,
        reflexionAttempts: validationResult.reflexionAttempts,
        tokensUsed,
        estimatedCost,
        generationTimeMs,
      };
    } catch (error: unknown) {
      await this.updateStatus(sessionId, 'failed');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.log(sessionId, 'error', `Generation failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Generate with streaming for real-time UI updates
   */
  async *generateWithStreaming(
    request: ArtifactGenerationRequest
  ): AsyncGenerator<StreamingChunk | ArtifactGenerationResult> {
    const startTime = Date.now();
    const sessionId = await this.createSession(request);

    try {
      // Planning
      await this.updateStatus(sessionId, 'planning');
      const plan = await this.intentClassifier.classifyAndPlan(request.prompt, request.mood);

      await query(
        `UPDATE artifact_generation_sessions
         SET plan = $2, estimated_complexity = $3, selected_model = $4, intent_classification = $5
         WHERE id = $1`,
        [sessionId, JSON.stringify(plan), plan.complexity, plan.suggestedModel, plan.intent]
      );

      // Streaming generation
      await this.updateStatus(sessionId, 'streaming');
      for await (const chunk of this.codeGenerator.generateWithStreaming(
        sessionId,
        plan,
        request
      )) {
        yield chunk;
      }

      // Get final code
      const finalCodeResult = await query<{ final_code: string }>(
        `SELECT final_code FROM artifact_generation_sessions WHERE id = $1`,
        [sessionId]
      );
      const code = finalCodeResult.rows[0].final_code;

      // Validation with reflexion
      const validationResult = await this.validateWithReflexion(
        sessionId,
        code,
        request.tenantId,
        plan
      );

      // Store artifact if valid
      let artifactId: string | undefined;
      if (validationResult.validation.isValid) {
        let canvasId = request.canvasId;
        if (!canvasId) {
          const canvasResult = await query<{ id: string }>(
            `INSERT INTO canvases (tenant_id, user_id, name, type, chat_id)
             VALUES ($1, $2, $3, 'generated', $4)
             RETURNING id`,
            [request.tenantId, request.userId, `Generated: ${plan.intent}`, request.chatId]
          );
          canvasId = canvasResult.rows[0]?.id;
        }

        if (canvasId) {
          const artifactResult = await query<{ id: string }>(
            `INSERT INTO artifacts (
               canvas_id, tenant_id, user_id, artifact_type, title, content, language,
               generation_session_id, verification_status, verification_timestamp
             ) VALUES ($1, $2, $3, 'react', $4, $5, 'tsx', $6, 'validated', NOW())
             RETURNING id`,
            [
              canvasId,
              request.tenantId,
              request.userId,
              this.generateTitle(request.prompt, plan.intent),
              validationResult.finalCode,
              sessionId,
            ]
          );
          artifactId = artifactResult.rows[0]?.id;
        }
      }

      // Yield final result
      const generationTimeMs = Date.now() - startTime;

      yield {
        sessionId,
        artifactId,
        status: validationResult.validation.isValid ? 'completed' : 'rejected',
        verificationStatus: validationResult.validation.isValid ? 'validated' : 'rejected',
        code: validationResult.finalCode,
        validation: validationResult.validation,
        reflexionAttempts: validationResult.reflexionAttempts,
        tokensUsed: await this.getTokensUsed(sessionId),
        estimatedCost: 0,
        generationTimeMs,
      } as ArtifactGenerationResult;
    } catch (error) {
      await this.updateStatus(sessionId, 'failed');
      throw error;
    }
  }

  /**
   * Validation with Reflexion loop
   */
  private async validateWithReflexion(
    sessionId: string,
    code: string,
    tenantId: string,
    plan: ArtifactGenerationPlan
  ): Promise<{
    validation: ArtifactValidationResult;
    finalCode: string;
    reflexionAttempts: number;
  }> {
    let currentCode = code;
    let attempts = 0;
    const maxAttempts = 3;
    const previousAttempts: ReflexionContext['previousAttempts'] = [];

    while (attempts < maxAttempts) {
      // Validate current code
      await this.updateStatus(sessionId, 'validating');
      await this.log(
        sessionId,
        'validating',
        attempts === 0
          ? 'Running Cato safety checks...'
          : `Re-validating after fix attempt ${attempts}...`
      );

      const validation = await this.validator.validate(currentCode, sessionId, tenantId);

      if (validation.isValid) {
        await this.log(
          sessionId,
          'success',
          `Passed all ${validation.passedCBFs.length} safety checks!`
        );
        return { validation, finalCode: currentCode, reflexionAttempts: attempts };
      }

      // Validation failed - attempt reflexion
      attempts++;

      await this.log(
        sessionId,
        'reflexion',
        `Failed ${validation.failedCBFs.length} checks. Attempting self-correction (${attempts}/${maxAttempts})...`
      );

      await this.updateStatus(sessionId, 'reflexion');

      const context: ReflexionContext = {
        originalCode: currentCode,
        errors: validation.errors.map((e) => e.message),
        attempt: attempts,
        maxAttempts,
        previousAttempts,
      };

      // Check if we should escalate
      if (this.reflexion.shouldEscalate(attempts, maxAttempts)) {
        await this.log(sessionId, 'error', `Max attempts reached. Escalating to human review.`);
        await this.reflexion.escalateToHuman(sessionId, context, validation);
        return { validation, finalCode: currentCode, reflexionAttempts: attempts };
      }

      // Attempt fix
      const fixResult = await this.reflexion.attemptFix(context, sessionId);

      if (fixResult.success) {
        await this.log(
          sessionId,
          'reflexion',
          `Generated fix: ${fixResult.explanation.substring(0, 100)}...`
        );

        previousAttempts.push({
          code: currentCode,
          errors: validation.errors.map((e) => e.message),
        });
        currentCode = fixResult.fixedCode;
      } else {
        await this.log(sessionId, 'error', `Self-correction failed: ${fixResult.explanation}`);
        return { validation, finalCode: currentCode, reflexionAttempts: attempts };
      }
    }

    // Max attempts reached without success
    const finalValidation = await this.validator.validate(currentCode, sessionId, tenantId);
    return { validation: finalValidation, finalCode: currentCode, reflexionAttempts: attempts };
  }

  // Helper Methods

  private async createSession(request: ArtifactGenerationRequest): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO artifact_generation_sessions (
         tenant_id, user_id, chat_id, canvas_id, prompt, intent_classification, status
       ) VALUES ($1, $2, $3, $4, $5, 'pending', 'pending')
       RETURNING id`,
      [request.tenantId, request.userId, request.chatId, request.canvasId, request.prompt]
    );
    return result.rows[0].id;
  }

  private async updateStatus(sessionId: string, status: GenerationStatus): Promise<void> {
    const timestampFields: Record<string, string> = {
      planning: 'planning_started_at',
      generating: 'generation_started_at',
      streaming: 'generation_started_at',
      validating: 'validation_started_at',
      completed: 'completed_at',
    };

    let sql = `UPDATE artifact_generation_sessions SET status = $2, updated_at = NOW()`;
    if (timestampFields[status]) {
      sql += `, ${timestampFields[status]} = NOW()`;
    }
    sql += ` WHERE id = $1`;

    await query(sql, [sessionId, status]);
  }

  private async log(sessionId: string, type: LogType, message: string): Promise<void> {
    await query(
      `INSERT INTO artifact_generation_logs (session_id, log_type, message)
       VALUES ($1, $2, $3)`,
      [sessionId, type, message]
    );
  }

  private async getTokensUsed(sessionId: string): Promise<number> {
    const result = await query<{ tokens_generated: number }>(
      `SELECT tokens_generated FROM artifact_generation_sessions WHERE id = $1`,
      [sessionId]
    );
    return result.rows[0]?.tokens_generated || 0;
  }

  private calculateCost(tokens: number, model: string): number {
    const costPer1K: Record<string, number> = {
      'anthropic/claude-3-5-haiku-20241022': 0.00025,
      'anthropic/claude-sonnet-4-20250514': 0.003,
    };
    const rate = costPer1K[model] || 0.003;
    return (tokens / 1000) * rate;
  }

  private async updatePatternStats(patternId: string, success: boolean): Promise<void> {
    await query(
      `UPDATE artifact_code_patterns
       SET usage_count = usage_count + 1,
           success_rate = (success_rate * usage_count + $2) / (usage_count + 1),
           updated_at = NOW()
       WHERE id = $1`,
      [patternId, success ? 1 : 0]
    );
  }

  private generateTitle(prompt: string, intent: string): string {
    const words = prompt.split(' ').slice(0, 5).join(' ');
    return `${intent.charAt(0).toUpperCase() + intent.slice(1)}: ${words}...`;
  }

  /**
   * Get session status and logs
   */
  async getSession(sessionId: string): Promise<{
    session: Record<string, unknown>;
    logs: Array<Record<string, unknown>>;
  } | null> {
    const sessionResult = await query(
      `SELECT * FROM artifact_generation_sessions WHERE id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const logsResult = await query(
      `SELECT * FROM artifact_generation_logs WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    return {
      session: sessionResult.rows[0],
      logs: logsResult.rows,
    };
  }

  /**
   * Get generation metrics for admin dashboard
   */
  async getMetrics(tenantId: string): Promise<{
    totalGenerated: number;
    successRate: number;
    averageGenerationTime: number;
    reflexionRate: number;
    totalTokens: number;
    totalCost: number;
    topIntents: Array<{ intent: string; count: number }>;
    recentSessions: Array<Record<string, unknown>>;
  }> {
    const metricsResult = await query<{
      total_generated: string;
      successful: string;
      avg_generation_time_ms: string;
      required_reflexion: string;
      total_tokens: string;
      total_cost: string;
    }>(
      `SELECT 
         COUNT(*) as total_generated,
         COUNT(*) FILTER (WHERE status = 'completed') as successful,
         AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) 
           FILTER (WHERE completed_at IS NOT NULL) as avg_generation_time_ms,
         COUNT(*) FILTER (WHERE reflexion_attempts > 0) as required_reflexion,
         SUM(total_tokens_used) as total_tokens,
         SUM(estimated_cost) as total_cost
       FROM artifact_generation_sessions
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [tenantId]
    );

    const topIntentsResult = await query<{ intent: string; count: string }>(
      `SELECT intent_classification as intent, COUNT(*) as count
       FROM artifact_generation_sessions
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
         AND intent_classification != 'pending'
       GROUP BY intent_classification
       ORDER BY count DESC
       LIMIT 5`,
      [tenantId]
    );

    const recentSessionsResult = await query(
      `SELECT id, prompt, intent_classification as intent, status, reflexion_attempts, created_at
       FROM artifact_generation_sessions
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [tenantId]
    );

    const m = metricsResult.rows[0];
    const total = parseInt(m.total_generated) || 0;
    const successful = parseInt(m.successful) || 0;
    const reflexion = parseInt(m.required_reflexion) || 0;

    return {
      totalGenerated: total,
      successRate: total > 0 ? successful / total : 0,
      averageGenerationTime: parseFloat(m.avg_generation_time_ms) || 0,
      reflexionRate: total > 0 ? reflexion / total : 0,
      totalTokens: parseInt(m.total_tokens) || 0,
      totalCost: parseFloat(m.total_cost) || 0,
      topIntents: topIntentsResult.rows.map((r: { intent: string; count: string }) => ({
        intent: r.intent,
        count: parseInt(r.count),
      })),
      recentSessions: recentSessionsResult.rows,
    };
  }

  /**
   * Get available patterns
   */
  async getPatterns(tenantId: string): Promise<
    Array<{
      id: string;
      pattern_name: string;
      pattern_type: string;
      description: string | null;
      usage_count: number;
      success_rate: number;
    }>
  > {
    const result = await query<{
      id: string;
      pattern_name: string;
      pattern_type: string;
      description: string | null;
      usage_count: number;
      success_rate: string;
    }>(
      `SELECT id, pattern_name, pattern_type, description, usage_count, success_rate
       FROM artifact_code_patterns
       WHERE is_active = TRUE AND (scope = 'system' OR tenant_id = $1)
       ORDER BY usage_count DESC
       LIMIT 20`,
      [tenantId]
    );

    return result.rows.map((r: { id: string; pattern_name: string; pattern_type: string; description: string | null; usage_count: number; success_rate: string }) => ({
      ...r,
      success_rate: parseFloat(r.success_rate),
    }));
  }
}

export const artifactEngineService = new ArtifactEngineService();
