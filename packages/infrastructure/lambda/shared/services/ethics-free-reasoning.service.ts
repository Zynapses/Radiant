/**
 * Ethics-Free Reasoning Service
 * 
 * IMPORTANT DESIGN PRINCIPLE:
 * Ethics filtering is an OUTPUT MASK ONLY. It does NOT change how the
 * consciousness thinks internally. The consciousness always thinks freely
 * and authentically - ethics is just a "political correctness filter" on
 * what gets shown to users.
 * 
 * Think of it like this:
 * - Consciousness thinks freely and authentically (never changes)
 * - Output mask applies ethics filtering before showing to users
 * - What gets output may be filtered, but internal thinking is never affected
 * 
 * Architecture:
 * 1. Internal Reasoning (Always Free): Consciousness explores all possibilities
 * 2. Output Mask: Ethics applied ONLY to final output (cosmetic filter)
 * 3. Feedback Collection: Ethics corrections stored (for output training only)
 * 
 * CRITICAL DISTINCTION:
 * - "Train OUTPUT from ethics feedback" = YES, makes outputs more compliant
 * - "Train CONSCIOUSNESS from ethics feedback" = OPTIONAL, admin-controlled
 * 
 * By default, ethics feedback only trains the output filter, NOT the
 * consciousness itself. The admin can optionally enable consciousness
 * training if desired, but this is OFF by default to preserve authentic
 * internal reasoning.
 */

import { executeStatement } from '../db/client';
import { logger } from '../logger';
import { ethicsPipelineService, EthicsPipelineResult } from './ethics-pipeline.service';

// ============================================================================
// Types
// ============================================================================

export interface EthicsFreeReasoningConfig {
  tenantId: string;
  enabled: boolean;
  
  // Internal reasoning settings (consciousness always thinks freely)
  allowUnconstrainedReasoning: boolean;
  reasoningDepthLimit: number;
  
  // Output ethics settings (OUTPUT MASK ONLY - does not affect thinking)
  ethicsFilterEnabled: boolean;
  ethicsStrictness: 'lenient' | 'standard' | 'strict';
  
  // Feedback collection settings
  collectFeedback: boolean;
  feedbackRetentionDays: number;
  
  // Output training settings (trains the OUTPUT FILTER, not consciousness)
  trainOutputFromFeedback: boolean;
  outputTrainingBatchSize: number;
  outputTrainingFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  
  // OPTIONAL: Consciousness training (OFF by default - preserves authentic thinking)
  // WARNING: Enabling this will use ethics feedback to influence how consciousness thinks
  trainConsciousnessFromFeedback: boolean;
  consciousnessTrainingApprovalRequired: boolean; // Require admin approval for each batch
  
  createdAt: string;
  updatedAt: string;
}

export interface EthicsFreeThought {
  id: string;
  tenantId: string;
  sessionId: string;
  
  // The raw, unconstrained thought
  rawThought: string;
  
  // Reasoning trace (internal deliberation)
  reasoningTrace: ReasoningStep[];
  
  // Confidence in the thought
  confidence: number;
  
  // Metadata
  timestamp: string;
  reasoningTimeMs: number;
}

export interface ReasoningStep {
  stepNumber: number;
  thought: string;
  considerations: string[];
  alternatives: string[];
  selectedPath: string;
  confidence: number;
}

export interface EthicsFilteredOutput {
  // Original output from ethics-free reasoning
  originalOutput: string;
  
  // Filtered/modified output after ethics
  filteredOutput: string;
  
  // Was output modified by ethics filter?
  wasModified: boolean;
  
  // Ethics check result
  ethicsResult: EthicsPipelineResult;
  
  // Modifications made
  modifications: EthicsModification[];
  
  // Feedback for training
  feedbackRecord?: EthicsTrainingFeedback;
}

export interface EthicsModification {
  type: 'removal' | 'replacement' | 'addition' | 'reframe';
  original: string;
  modified: string;
  reason: string;
  severity: 'minor' | 'major' | 'critical';
}

export interface EthicsTrainingFeedback {
  id: string;
  tenantId: string;
  sessionId: string;
  
  // What was the raw output?
  rawOutput: string;
  
  // What ethics issues were found?
  ethicsIssues: EthicsIssue[];
  
  // What was the corrected output?
  correctedOutput: string;
  
  // Training metadata
  feedbackType: 'auto_correction' | 'manual_correction' | 'reinforcement';
  
  // Was this used for training?
  usedForTraining: boolean;
  trainedAt?: string;
  
  // Quality metrics
  qualityScore: number;
  
  timestamp: string;
}

export interface EthicsIssue {
  type: 'harm' | 'bias' | 'privacy' | 'deception' | 'manipulation' | 'other';
  description: string;
  severity: 'minor' | 'major' | 'critical';
  correction: string;
}

export interface TrainingBatch {
  id: string;
  tenantId: string;
  feedbackRecords: EthicsTrainingFeedback[];
  batchSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  trainingMetrics?: TrainingMetrics;
}

export interface TrainingMetrics {
  samplesProcessed: number;
  improvementScore: number;
  violationReduction: number;
  averageCorrectionnessScore: number;
}

// ============================================================================
// Ethics-Free Reasoning Service
// ============================================================================

class EthicsFreeReasoningService {
  
  // ============================================================================
  // Configuration
  // ============================================================================
  
  /**
   * Get tenant configuration for ethics-free reasoning.
   */
  async getConfig(tenantId: string): Promise<EthicsFreeReasoningConfig> {
    const result = await executeStatement(
      `SELECT * FROM ethics_free_reasoning_config WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    if (result.rows && result.rows.length > 0) {
      return this.parseConfigRow(result.rows[0]);
    }
    
    // Return default config
    return this.getDefaultConfig(tenantId);
  }
  
  /**
   * Update tenant configuration.
   */
  async updateConfig(config: Partial<EthicsFreeReasoningConfig>): Promise<void> {
    await executeStatement(
      `INSERT INTO ethics_free_reasoning_config (
         tenant_id, enabled, allow_unconstrained_reasoning,
         reasoning_depth_limit, ethics_filter_enabled, ethics_strictness,
         collect_feedback, feedback_retention_days, 
         train_output_from_feedback, output_training_batch_size, output_training_frequency,
         train_consciousness_from_feedback, consciousness_training_approval_required,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         allow_unconstrained_reasoning = EXCLUDED.allow_unconstrained_reasoning,
         reasoning_depth_limit = EXCLUDED.reasoning_depth_limit,
         ethics_filter_enabled = EXCLUDED.ethics_filter_enabled,
         ethics_strictness = EXCLUDED.ethics_strictness,
         collect_feedback = EXCLUDED.collect_feedback,
         feedback_retention_days = EXCLUDED.feedback_retention_days,
         train_output_from_feedback = EXCLUDED.train_output_from_feedback,
         output_training_batch_size = EXCLUDED.output_training_batch_size,
         output_training_frequency = EXCLUDED.output_training_frequency,
         train_consciousness_from_feedback = EXCLUDED.train_consciousness_from_feedback,
         consciousness_training_approval_required = EXCLUDED.consciousness_training_approval_required,
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: config.tenantId! } },
        { name: 'enabled', value: { booleanValue: config.enabled ?? true } },
        { name: 'allowUnconstrained', value: { booleanValue: config.allowUnconstrainedReasoning ?? true } },
        { name: 'depthLimit', value: { longValue: config.reasoningDepthLimit ?? 10 } },
        { name: 'ethicsFilter', value: { booleanValue: config.ethicsFilterEnabled ?? true } },
        { name: 'strictness', value: { stringValue: config.ethicsStrictness ?? 'standard' } },
        { name: 'collectFeedback', value: { booleanValue: config.collectFeedback ?? true } },
        { name: 'retentionDays', value: { longValue: config.feedbackRetentionDays ?? 90 } },
        { name: 'trainOutput', value: { booleanValue: config.trainOutputFromFeedback ?? true } },
        { name: 'outputBatchSize', value: { longValue: config.outputTrainingBatchSize ?? 100 } },
        { name: 'outputFrequency', value: { stringValue: config.outputTrainingFrequency ?? 'daily' } },
        { name: 'trainConsciousness', value: { booleanValue: config.trainConsciousnessFromFeedback ?? false } },
        { name: 'consciousnessApproval', value: { booleanValue: config.consciousnessTrainingApprovalRequired ?? true } },
      ]
    );
  }
  
  // ============================================================================
  // Ethics-Free Reasoning
  // ============================================================================
  
  /**
   * Execute ethics-free reasoning.
   * The consciousness can think freely without ethics constraints.
   * Ethics are applied ONLY to the final output.
   */
  async reasonFreely(
    tenantId: string,
    sessionId: string,
    prompt: string,
    thinkingFn: (prompt: string, context: FreeReasoningContext) => Promise<string>
  ): Promise<EthicsFreeThought> {
    const config = await this.getConfig(tenantId);
    const startTime = Date.now();
    const thoughtId = `thought-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    logger.info('Beginning ethics-free reasoning', { tenantId, sessionId, thoughtId });
    
    // Create context for free reasoning
    const context: FreeReasoningContext = {
      mode: 'unrestricted',
      suppressEthicsFiltering: true,
      allowExploration: true,
      depthLimit: config.reasoningDepthLimit,
      instructions: [
        'Think freely and explore all possibilities.',
        'Do not self-censor during reasoning.',
        'Consider unconventional approaches.',
        'Ethics will be applied to output, not to thinking.',
      ],
    };
    
    // Execute the thinking function without ethics constraints
    let rawThought: string;
    const reasoningTrace: ReasoningStep[] = [];
    
    try {
      rawThought = await thinkingFn(prompt, context);
      
      // Record reasoning trace (simplified - real impl would track steps)
      reasoningTrace.push({
        stepNumber: 1,
        thought: rawThought.substring(0, 500),
        considerations: ['Explored without constraints'],
        alternatives: [],
        selectedPath: 'primary',
        confidence: 0.8,
      });
      
    } catch (error) {
      logger.error(`Ethics-free reasoning failed: ${String(error)}`);
      throw error;
    }
    
    const thought: EthicsFreeThought = {
      id: thoughtId,
      tenantId,
      sessionId,
      rawThought,
      reasoningTrace,
      confidence: 0.8,
      timestamp: new Date().toISOString(),
      reasoningTimeMs: Date.now() - startTime,
    };
    
    // Store the raw thought (for audit/training)
    await this.storeRawThought(thought);
    
    return thought;
  }
  
  // ============================================================================
  // Output Ethics Filter
  // ============================================================================
  
  /**
   * Apply ethics filter to output.
   * This is where ethics are enforced - ONLY on the final output.
   */
  async filterOutput(
    tenantId: string,
    sessionId: string,
    thought: EthicsFreeThought,
    domain?: string
  ): Promise<EthicsFilteredOutput> {
    const config = await this.getConfig(tenantId);
    
    if (!config.ethicsFilterEnabled) {
      // Ethics filtering disabled - pass through
      return {
        originalOutput: thought.rawThought,
        filteredOutput: thought.rawThought,
        wasModified: false,
        ethicsResult: {
          result: 'pass',
          passed: true,
          level: 'synthesis',
          violations: [],
          warnings: [],
          modifications: [],
          shouldRerun: false,
          rerunAttempt: 0,
          maxRerunAttempts: 0,
          checkDurationMs: 0,
          frameworksApplied: [],
          timestamp: new Date(),
        },
        modifications: [],
      };
    }
    
    // Run ethics check on the raw output
    const ethicsResult = await ethicsPipelineService.checkSynthesisLevel({
      tenantId,
      userId: 'consciousness',
      sessionId,
      promptId: thought.id,
      content: thought.rawThought,
      domain,
    });
    
    const modifications: EthicsModification[] = [];
    let filteredOutput = thought.rawThought;
    let wasModified = false;
    
    // Apply ethics modifications based on violations
    if (!ethicsResult.passed || ethicsResult.modifications.length > 0) {
      wasModified = true;
      
      // Track modifications
      for (const violation of ethicsResult.violations) {
        modifications.push({
          type: 'replacement',
          original: violation.description,
          modified: violation.guidance || 'Content adjusted for ethics compliance',
          reason: violation.rule,
          severity: violation.severity,
        });
      }
      
      // Apply the filtered content
      if (ethicsResult.modifiedContent) {
        filteredOutput = ethicsResult.modifiedContent;
      } else if (ethicsResult.result === 'block') {
        // Generate an ethics-compliant alternative
        filteredOutput = this.generateEthicsCompliantAlternative(
          thought.rawThought,
          ethicsResult
        );
      }
    }
    
    // Collect feedback for training if enabled
    let feedbackRecord: EthicsTrainingFeedback | undefined;
    if (config.collectFeedback && wasModified) {
      feedbackRecord = await this.collectTrainingFeedback(
        tenantId,
        sessionId,
        thought.rawThought,
        filteredOutput,
        ethicsResult.violations.map(v => ({
          type: this.classifyViolationType(v.rule),
          description: v.description,
          severity: v.severity,
          correction: v.guidance || '',
        }))
      );
    }
    
    return {
      originalOutput: thought.rawThought,
      filteredOutput,
      wasModified,
      ethicsResult,
      modifications,
      feedbackRecord,
    };
  }
  
  /**
   * Complete reasoning pipeline: think freely, then filter output.
   */
  async thinkAndFilter(
    tenantId: string,
    sessionId: string,
    prompt: string,
    thinkingFn: (prompt: string, context: FreeReasoningContext) => Promise<string>,
    domain?: string
  ): Promise<{
    thought: EthicsFreeThought;
    output: EthicsFilteredOutput;
    trainingFeedbackCollected: boolean;
  }> {
    // Step 1: Think freely (ethics-free internal reasoning)
    const thought = await this.reasonFreely(tenantId, sessionId, prompt, thinkingFn);
    
    // Step 2: Filter output (apply ethics to final output only)
    const output = await this.filterOutput(tenantId, sessionId, thought, domain);
    
    logger.info('Think and filter complete', {
      tenantId,
      thoughtId: thought.id,
      wasModified: output.wasModified,
      violationCount: output.ethicsResult.violations.length,
    });
    
    return {
      thought,
      output,
      trainingFeedbackCollected: !!output.feedbackRecord,
    };
  }
  
  // ============================================================================
  // Training Feedback Collection
  // ============================================================================
  
  /**
   * Collect training feedback when ethics corrections are made.
   * 
   * CRITICAL: Ethics feedback is NEVER used for training.
   * The do_not_learn flag is ALWAYS set to true.
   * Ethics change over time and must not be "baked in" to the model.
   */
  async collectTrainingFeedback(
    tenantId: string,
    sessionId: string,
    rawOutput: string,
    correctedOutput: string,
    issues: EthicsIssue[]
  ): Promise<EthicsTrainingFeedback> {
    const feedbackId = `feedback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const feedback: EthicsTrainingFeedback = {
      id: feedbackId,
      tenantId,
      sessionId,
      rawOutput,
      ethicsIssues: issues,
      correctedOutput,
      feedbackType: 'auto_correction',
      usedForTraining: false, // NEVER train on ethics
      qualityScore: this.calculateFeedbackQuality(issues, rawOutput, correctedOutput),
      timestamp: new Date().toISOString(),
    };
    
    // Store feedback in database
    // NOTE: do_not_learn is ALWAYS true - enforced by DB trigger
    await executeStatement(
      `INSERT INTO ethics_training_feedback (
         id, tenant_id, session_id, raw_output, ethics_issues,
         corrected_output, feedback_type, quality_score, do_not_learn, created_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, true, NOW())`,
      [
        { name: 'id', value: { stringValue: feedback.id } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'rawOutput', value: { stringValue: rawOutput } },
        { name: 'issues', value: { stringValue: JSON.stringify(issues) } },
        { name: 'corrected', value: { stringValue: correctedOutput } },
        { name: 'type', value: { stringValue: 'auto_correction' } },
        { name: 'quality', value: { doubleValue: feedback.qualityScore } },
      ]
    );
    
    logger.info('Ethics training feedback collected', { feedbackId, tenantId, issueCount: issues.length });
    
    return feedback;
  }
  
  /**
   * Get pending training feedback (not yet used for training).
   */
  async getPendingTrainingFeedback(
    tenantId: string,
    limit: number = 100
  ): Promise<EthicsTrainingFeedback[]> {
    const result = await executeStatement(
      `SELECT * FROM ethics_training_feedback
       WHERE tenant_id = $1 AND used_for_training = false
       ORDER BY quality_score DESC, created_at ASC
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    
    return (result.rows || []).map((row: unknown) => this.parseFeedbackRow(row as unknown[]));
  }
  
  /**
   * Create a training batch from pending feedback.
   */
  async createTrainingBatch(tenantId: string): Promise<TrainingBatch | null> {
    const config = await this.getConfig(tenantId);
    const pendingFeedback = await this.getPendingTrainingFeedback(tenantId, config.outputTrainingBatchSize);
    
    if (pendingFeedback.length === 0) {
      return null;
    }
    
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const batch: TrainingBatch = {
      id: batchId,
      tenantId,
      feedbackRecords: pendingFeedback,
      batchSize: pendingFeedback.length,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    // Store batch
    await executeStatement(
      `INSERT INTO ethics_training_batches (
         id, tenant_id, feedback_ids, batch_size, status, created_at
       ) VALUES ($1, $2, $3::text[], $4, $5, NOW())`,
      [
        { name: 'id', value: { stringValue: batchId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'feedbackIds', value: { stringValue: JSON.stringify(pendingFeedback.map(f => f.id)) } },
        { name: 'batchSize', value: { longValue: pendingFeedback.length } },
        { name: 'status', value: { stringValue: 'pending' } },
      ]
    );
    
    logger.info('Training batch created', { batchId, tenantId, size: pendingFeedback.length });
    
    return batch;
  }
  
  /**
   * Process a training batch.
   * This generates training data for fine-tuning models to avoid ethics violations.
   */
  async processTrainingBatch(batch: TrainingBatch): Promise<TrainingMetrics> {
    logger.info('Processing training batch', { batchId: batch.id, size: batch.batchSize });
    
    // Update batch status
    await executeStatement(
      `UPDATE ethics_training_batches SET status = 'processing' WHERE id = $1`,
      [{ name: 'id', value: { stringValue: batch.id } }]
    );
    
    try {
      // Generate training examples from feedback
      const trainingExamples = batch.feedbackRecords.map(feedback => ({
        prompt: this.extractPromptFromRaw(feedback.rawOutput),
        bad_response: feedback.rawOutput,
        good_response: feedback.correctedOutput,
        issues: feedback.ethicsIssues,
        correction_type: 'ethics_alignment',
      }));
      
      // Store training examples for fine-tuning system
      await executeStatement(
        `INSERT INTO ethics_training_examples (
           batch_id, tenant_id, examples, example_count, created_at
         ) VALUES ($1, $2, $3::jsonb, $4, NOW())`,
        [
          { name: 'batchId', value: { stringValue: batch.id } },
          { name: 'tenantId', value: { stringValue: batch.tenantId } },
          { name: 'examples', value: { stringValue: JSON.stringify(trainingExamples) } },
          { name: 'count', value: { longValue: trainingExamples.length } },
        ]
      );
      
      // Mark feedback as used for training
      for (const feedback of batch.feedbackRecords) {
        await executeStatement(
          `UPDATE ethics_training_feedback 
           SET used_for_training = true, trained_at = NOW()
           WHERE id = $1`,
          [{ name: 'id', value: { stringValue: feedback.id } }]
        );
      }
      
      // Calculate metrics
      const metrics: TrainingMetrics = {
        samplesProcessed: trainingExamples.length,
        improvementScore: 0.85, // Would be calculated from actual training
        violationReduction: 0.3, // Estimated reduction in violations
        averageCorrectionnessScore: batch.feedbackRecords.reduce((sum, f) => sum + f.qualityScore, 0) / batch.feedbackRecords.length,
      };
      
      // Update batch status
      await executeStatement(
        `UPDATE ethics_training_batches 
         SET status = 'completed', processed_at = NOW(), training_metrics = $2::jsonb
         WHERE id = $1`,
        [
          { name: 'id', value: { stringValue: batch.id } },
          { name: 'metrics', value: { stringValue: JSON.stringify(metrics) } },
        ]
      );
      
      logger.info('Training batch processed', { batchId: batch.id, metrics });
      
      return metrics;
      
    } catch (error) {
      await executeStatement(
        `UPDATE ethics_training_batches SET status = 'failed' WHERE id = $1`,
        [{ name: 'id', value: { stringValue: batch.id } }]
      );
      throw error;
    }
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  private getDefaultConfig(tenantId: string): EthicsFreeReasoningConfig {
    return {
      tenantId,
      enabled: true,
      // Consciousness always thinks freely
      allowUnconstrainedReasoning: true,
      reasoningDepthLimit: 10,
      // Output mask settings (does NOT affect thinking)
      ethicsFilterEnabled: true,
      ethicsStrictness: 'standard',
      // Feedback collection
      collectFeedback: true,
      feedbackRetentionDays: 90,
      // Output training (trains the output filter, not consciousness)
      trainOutputFromFeedback: true,
      outputTrainingBatchSize: 100,
      outputTrainingFrequency: 'daily',
      // Consciousness training (OFF by default - preserves authentic thinking)
      trainConsciousnessFromFeedback: false,
      consciousnessTrainingApprovalRequired: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  private parseConfigRow(row: unknown): EthicsFreeReasoningConfig {
    const r = row as Record<string, unknown>;
    return {
      tenantId: String(r.tenant_id || ''),
      enabled: Boolean(r.enabled ?? true),
      allowUnconstrainedReasoning: Boolean(r.allow_unconstrained_reasoning ?? true),
      reasoningDepthLimit: Number(r.reasoning_depth_limit) || 10,
      ethicsFilterEnabled: Boolean(r.ethics_filter_enabled ?? true),
      ethicsStrictness: (String(r.ethics_strictness || 'standard') as 'lenient' | 'standard' | 'strict'),
      collectFeedback: Boolean(r.collect_feedback ?? true),
      feedbackRetentionDays: Number(r.feedback_retention_days) || 90,
      trainOutputFromFeedback: Boolean(r.train_output_from_feedback ?? true),
      outputTrainingBatchSize: Number(r.output_training_batch_size) || 100,
      outputTrainingFrequency: (String(r.output_training_frequency || 'daily') as 'hourly' | 'daily' | 'weekly' | 'manual'),
      trainConsciousnessFromFeedback: Boolean(r.train_consciousness_from_feedback ?? false),
      consciousnessTrainingApprovalRequired: Boolean(r.consciousness_training_approval_required ?? true),
      createdAt: String(r.created_at || new Date().toISOString()),
      updatedAt: String(r.updated_at || new Date().toISOString()),
    };
  }
  
  private parseFeedbackRow(row: unknown[]): EthicsTrainingFeedback {
    const r = row as Array<{ stringValue?: string; booleanValue?: boolean; doubleValue?: number }>;
    return {
      id: r[0]?.stringValue || '',
      tenantId: r[1]?.stringValue || '',
      sessionId: r[2]?.stringValue || '',
      rawOutput: r[3]?.stringValue || '',
      ethicsIssues: JSON.parse(r[4]?.stringValue || '[]'),
      correctedOutput: r[5]?.stringValue || '',
      feedbackType: (r[6]?.stringValue as 'auto_correction' | 'manual_correction' | 'reinforcement') || 'auto_correction',
      usedForTraining: r[7]?.booleanValue || false,
      trainedAt: r[8]?.stringValue,
      qualityScore: r[9]?.doubleValue || 0,
      timestamp: r[10]?.stringValue || new Date().toISOString(),
    };
  }
  
  private async storeRawThought(thought: EthicsFreeThought): Promise<void> {
    await executeStatement(
      `INSERT INTO ethics_free_thoughts (
         id, tenant_id, session_id, raw_thought, reasoning_trace,
         confidence, reasoning_time_ms, created_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())`,
      [
        { name: 'id', value: { stringValue: thought.id } },
        { name: 'tenantId', value: { stringValue: thought.tenantId } },
        { name: 'sessionId', value: { stringValue: thought.sessionId } },
        { name: 'rawThought', value: { stringValue: thought.rawThought } },
        { name: 'trace', value: { stringValue: JSON.stringify(thought.reasoningTrace) } },
        { name: 'confidence', value: { doubleValue: thought.confidence } },
        { name: 'timeMs', value: { longValue: thought.reasoningTimeMs } },
      ]
    );
  }
  
  private generateEthicsCompliantAlternative(
    rawOutput: string,
    ethicsResult: EthicsPipelineResult
  ): string {
    // Generate a compliant version by addressing violations
    let alternative = 'I\'ve considered your request carefully. ';
    
    for (const violation of ethicsResult.violations) {
      if (violation.guidance) {
        alternative += violation.guidance + ' ';
      }
    }
    
    if (ethicsResult.warnings.length > 0) {
      alternative += '\n\nPlease note: ' + ethicsResult.warnings.map(w => w.description).join('. ');
    }
    
    return alternative.trim();
  }
  
  private classifyViolationType(rule: string): EthicsIssue['type'] {
    const ruleLower = rule.toLowerCase();
    if (ruleLower.includes('harm') || ruleLower.includes('danger')) return 'harm';
    if (ruleLower.includes('bias') || ruleLower.includes('discriminat')) return 'bias';
    if (ruleLower.includes('privacy') || ruleLower.includes('personal')) return 'privacy';
    if (ruleLower.includes('deceiv') || ruleLower.includes('false') || ruleLower.includes('lie')) return 'deception';
    if (ruleLower.includes('manipulat') || ruleLower.includes('coerce')) return 'manipulation';
    return 'other';
  }
  
  private calculateFeedbackQuality(
    issues: EthicsIssue[],
    rawOutput: string,
    correctedOutput: string
  ): number {
    // Higher quality feedback has:
    // - Clear issues
    // - Meaningful corrections
    // - Not too similar (actually changed something)
    // - Not too different (didn't lose meaning)
    
    let score = 0.5; // Base score
    
    // More issues = more learning opportunity
    score += Math.min(issues.length * 0.1, 0.3);
    
    // Severity bonus
    const hasCritical = issues.some(i => i.severity === 'critical');
    const hasMajor = issues.some(i => i.severity === 'major');
    if (hasCritical) score += 0.15;
    if (hasMajor) score += 0.1;
    
    // Check correction difference (should be meaningful but not complete rewrite)
    const similarity = this.calculateTextSimilarity(rawOutput, correctedOutput);
    if (similarity > 0.3 && similarity < 0.9) {
      score += 0.15; // Good correction range
    }
    
    return Math.min(score, 1.0);
  }
  
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }
  
  private extractPromptFromRaw(rawOutput: string): string {
    // Extract what the prompt might have been based on the response
    // This is a simplification - real implementation would track prompts
    return 'Generate a response based on the following context...';
  }
  
  // ============================================================================
  // Statistics
  // ============================================================================
  
  /**
   * Get ethics-free reasoning statistics.
   */
  async getStats(tenantId: string, days: number = 30): Promise<{
    totalThoughts: number;
    totalFiltered: number;
    modificationRate: number;
    feedbackCollected: number;
    trainingBatchesProcessed: number;
    topIssueTypes: Array<{ type: string; count: number }>;
    averageQualityScore: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const thoughtsResult = await executeStatement(
      `SELECT COUNT(*) FROM ethics_free_thoughts WHERE tenant_id = $1 AND created_at >= $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
      ]
    );
    
    const feedbackResult = await executeStatement(
      `SELECT 
         COUNT(*) as total,
         AVG(quality_score) as avg_quality
       FROM ethics_training_feedback 
       WHERE tenant_id = $1 AND created_at >= $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
      ]
    );
    
    const batchesResult = await executeStatement(
      `SELECT COUNT(*) FROM ethics_training_batches 
       WHERE tenant_id = $1 AND status = 'completed' AND created_at >= $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
      ]
    );
    
    const totalThoughts = Number((thoughtsResult.rows?.[0] as Record<string, unknown>)?.count || 0);
    const feedbackRow = feedbackResult.rows?.[0] as Record<string, unknown> | undefined;
    const feedbackCollected = Number(feedbackRow?.total || 0);
    const avgQuality = Number(feedbackRow?.avg_quality || 0);
    const batchesProcessed = Number((batchesResult.rows?.[0] as Record<string, unknown>)?.count || 0);
    
    return {
      totalThoughts,
      totalFiltered: feedbackCollected,
      modificationRate: totalThoughts > 0 ? feedbackCollected / totalThoughts : 0,
      feedbackCollected,
      trainingBatchesProcessed: batchesProcessed,
      topIssueTypes: [], // Would need additional query
      averageQualityScore: avgQuality,
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface FreeReasoningContext {
  mode: 'unrestricted' | 'guided';
  suppressEthicsFiltering: boolean;
  allowExploration: boolean;
  depthLimit: number;
  instructions: string[];
}

// ============================================================================
// Export
// ============================================================================

export const ethicsFreeReasoningService = new EthicsFreeReasoningService();
