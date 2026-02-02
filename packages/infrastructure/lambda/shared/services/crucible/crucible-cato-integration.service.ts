/**
 * The Crucible - Cato Pipeline Integration
 * 
 * Integrates The Crucible competitive deliberation with Cato pipeline execution.
 * When a method has multiple LLMs assigned, this service triggers a Crucible
 * deliberation session to get the best possible output.
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { Pool } from 'pg';
import { logger } from '../../logging/enhanced-logger';
import {
  CrucibleSession,
  CrucibleFinalReport,
  CrucibleCostMode,
  CrucibleModelType,
  CatoMethodEnvelope,
} from '@radiant/shared';
import { CrucibleService } from './crucible.service';
import { CrucibleOrchestratorService, LLMInvoker, ModelInfoProvider } from './crucible-orchestrator.service';

export interface CrucibleCatoConfig {
  /** Enable Crucible integration */
  enabled: boolean;
  
  /** Minimum LLMs to trigger Crucible */
  minLlmsForCrucible: number;
  
  /** Default cost mode */
  defaultCostMode: CrucibleCostMode;
  
  /** Skip interrogation for cost savings */
  skipInterrogation: boolean;
}

export interface MethodLLMAssignment {
  /** Method ID being executed */
  methodId: string;
  
  /** Assigned LLM model IDs */
  modelIds: string[];
  
  /** Task prompt for the method */
  taskPrompt: string;
}

export interface CrucibleMethodResult {
  /** Whether Crucible was triggered */
  crucibleTriggered: boolean;
  
  /** Crucible session if triggered */
  session?: CrucibleSession;
  
  /** Winning report if available */
  winnerReport?: CrucibleFinalReport;
  
  /** All final reports */
  allReports?: CrucibleFinalReport[];
  
  /** The output to use (either Crucible winner or original) */
  output: string;
  
  /** Metadata about the deliberation */
  metadata: {
    participantCount: number;
    questionsAsked: number;
    deliberationDurationMs: number;
    winnerModelId?: string;
    winnerScore?: number;
  };
}

export class CrucibleCatoIntegrationService {
  private crucibleService: CrucibleService;
  private crucibleOrchestrator: CrucibleOrchestratorService;
  private config: CrucibleCatoConfig;

  constructor(
    private pool: Pool,
    llmInvoker: LLMInvoker,
    modelInfoProvider: ModelInfoProvider,
    config?: Partial<CrucibleCatoConfig>
  ) {
    this.crucibleService = new CrucibleService(pool);
    this.crucibleOrchestrator = new CrucibleOrchestratorService(pool, {
      llmInvoker,
      modelInfoProvider,
    });
    
    this.config = {
      enabled: true,
      minLlmsForCrucible: 2,
      defaultCostMode: 'balanced',
      skipInterrogation: true,
      ...config,
    };
  }

  /**
   * Check if a method execution should trigger Crucible deliberation
   */
  async shouldTriggerCrucible(
    tenantId: string,
    assignment: MethodLLMAssignment,
    modelInfoProvider: ModelInfoProvider
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // Check tenant config
    const tenantConfig = await this.crucibleService.getConfig(tenantId);
    if (!tenantConfig.enabled) {
      return false;
    }

    // Count LLMs (not vision/audio/embedding models)
    let llmCount = 0;
    for (const modelId of assignment.modelIds) {
      const info = await modelInfoProvider.getModelInfo(modelId);
      if (info.modelType === 'llm') {
        llmCount++;
      }
    }

    const minRequired = Math.max(
      this.config.minLlmsForCrucible,
      tenantConfig.minLlmsForCrucible
    );

    return llmCount >= minRequired;
  }

  /**
   * Execute a method with Crucible deliberation if applicable
   */
  async executeWithCrucible(
    tenantId: string,
    pipelineExecutionId: string,
    methodInvocationId: string,
    assignment: MethodLLMAssignment,
    options?: {
      costMode?: CrucibleCostMode;
      maxQuestions?: number;
      skipInterrogation?: boolean;
    }
  ): Promise<CrucibleMethodResult> {
    const shouldTrigger = await this.shouldTriggerCrucible(
      tenantId,
      assignment,
      this.crucibleOrchestrator['config'].modelInfoProvider
    );

    if (!shouldTrigger) {
      logger.info('Crucible not triggered - insufficient LLMs', {
        methodId: assignment.methodId,
        modelCount: assignment.modelIds.length,
      });

      return {
        crucibleTriggered: false,
        output: '', // Original method execution should handle this
        metadata: {
          participantCount: assignment.modelIds.length,
          questionsAsked: 0,
          deliberationDurationMs: 0,
        },
      };
    }

    logger.info('Triggering Crucible deliberation', {
      methodId: assignment.methodId,
      modelIds: assignment.modelIds,
      pipelineExecutionId,
    });

    try {
      const result = await this.crucibleOrchestrator.runDeliberation(
        tenantId,
        pipelineExecutionId,
        methodInvocationId,
        assignment.methodId,
        assignment.modelIds,
        assignment.taskPrompt,
        {
          costMode: options?.costMode || this.config.defaultCostMode,
          maxQuestions: options?.maxQuestions,
          skipInterrogation: options?.skipInterrogation ?? this.config.skipInterrogation,
        }
      );

      const deliberationDurationMs = result.session.completedAt && result.session.startedAt
        ? new Date(result.session.completedAt).getTime() - new Date(result.session.startedAt).getTime()
        : 0;

      return {
        crucibleTriggered: true,
        session: result.session,
        winnerReport: result.winnerReport || undefined,
        allReports: result.finalReports,
        output: result.winnerReport?.refinedOutput || '',
        metadata: {
          participantCount: result.session.participants.length,
          questionsAsked: result.session.totalQuestionsAsked,
          deliberationDurationMs,
          winnerModelId: result.winnerReport?.participantId,
          winnerScore: result.winnerReport?.finalScore,
        },
      };
    } catch (error) {
      logger.error('Crucible deliberation failed', {
        methodId: assignment.methodId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return non-Crucible result on failure
      return {
        crucibleTriggered: false,
        output: '',
        metadata: {
          participantCount: assignment.modelIds.length,
          questionsAsked: 0,
          deliberationDurationMs: 0,
        },
      };
    }
  }

  /**
   * Extract Crucible metadata to include in envelope output
   * This can be merged into the output.data of the envelope
   */
  getCrucibleEnvelopeData(
    crucibleResult: CrucibleMethodResult
  ): Record<string, unknown> {
    if (!crucibleResult.crucibleTriggered) {
      return {};
    }

    return {
      crucible: {
        sessionId: crucibleResult.session?.sessionId,
        triggered: true,
        participantCount: crucibleResult.metadata.participantCount,
        questionsAsked: crucibleResult.metadata.questionsAsked,
        deliberationDurationMs: crucibleResult.metadata.deliberationDurationMs,
        winnerModelId: crucibleResult.metadata.winnerModelId,
        winnerScore: crucibleResult.metadata.winnerScore,
        refinedOutput: crucibleResult.output,
      },
    };
  }

  /**
   * Get Crucible statistics for a pipeline
   */
  async getPipelineCrucibleStats(pipelineExecutionId: string): Promise<{
    sessionsTriggered: number;
    totalQuestionsAsked: number;
    avgDeliberationDurationMs: number;
    modelsParticipated: string[];
    circularCitationsDetected: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as sessions_triggered,
        COALESCE(SUM(total_questions), 0) as total_questions,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000), 0) as avg_duration_ms,
        COALESCE(SUM(circular_citations_count), 0) as circular_citations
       FROM crucible_sessions
       WHERE pipeline_execution_id = $1`,
      [pipelineExecutionId]
    );

    const participantsResult = await this.pool.query(
      `SELECT DISTINCT p.model_id
       FROM crucible_participants p
       JOIN crucible_sessions s ON p.session_id = s.id
       WHERE s.pipeline_execution_id = $1`,
      [pipelineExecutionId]
    );

    const row = result.rows[0];
    return {
      sessionsTriggered: parseInt(row.sessions_triggered, 10) || 0,
      totalQuestionsAsked: parseInt(row.total_questions, 10) || 0,
      avgDeliberationDurationMs: parseFloat(row.avg_duration_ms) || 0,
      modelsParticipated: participantsResult.rows.map(r => r.model_id),
      circularCitationsDetected: parseInt(row.circular_citations, 10) || 0,
    };
  }

  /**
   * Check if a model should be recommended for future Crucible sessions
   * based on historical performance
   */
  async getModelRecommendation(
    tenantId: string,
    taskType: string,
    candidateModelIds: string[]
  ): Promise<{
    recommendedOrder: string[];
    scores: Record<string, number>;
    reasoning: string;
  }> {
    // Get performance data for candidates
    const result = await this.pool.query(
      `SELECT 
        model_id,
        win_rate,
        avg_final_score,
        avg_question_quality,
        total_sessions,
        circular_citation_rate
       FROM crucible_model_performance
       WHERE tenant_id = $1 AND model_id = ANY($2)
       ORDER BY win_rate DESC, avg_final_score DESC`,
      [tenantId, candidateModelIds]
    );

    const scores: Record<string, number> = {};
    const modelStats = new Map<string, any>();

    for (const row of result.rows) {
      modelStats.set(row.model_id, row);
      // Composite score: 40% win rate + 40% avg score + 10% question quality - 10% circular rate
      scores[row.model_id] = 
        (row.win_rate * 0.4) +
        (row.avg_final_score * 0.4) +
        (row.avg_question_quality * 0.1) -
        (row.circular_citation_rate * 0.1);
    }

    // Include models with no history at a neutral score
    for (const modelId of candidateModelIds) {
      if (!scores[modelId]) {
        scores[modelId] = 0.5; // Neutral score for new models
      }
    }

    const recommendedOrder = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([modelId]) => modelId);

    const topModel = recommendedOrder[0];
    const topStats = modelStats.get(topModel);
    
    let reasoning = 'Based on historical Crucible performance:\n';
    if (topStats && topStats.total_sessions > 5) {
      reasoning += `- ${topModel} has a ${(topStats.win_rate * 100).toFixed(1)}% win rate over ${topStats.total_sessions} sessions\n`;
      reasoning += `- Average score: ${(topStats.avg_final_score * 100).toFixed(1)}%\n`;
      if (topStats.circular_citation_rate > 0.05) {
        reasoning += `- Note: ${(topStats.circular_citation_rate * 100).toFixed(1)}% circular citation rate\n`;
      }
    } else {
      reasoning += '- Limited historical data; recommendations may change with more sessions\n';
    }

    return {
      recommendedOrder,
      scores,
      reasoning,
    };
  }
}

/**
 * Factory function to create Crucible-Cato integration with default config
 */
export function createCrucibleCatoIntegration(
  pool: Pool,
  llmInvoker: LLMInvoker,
  modelInfoProvider: ModelInfoProvider
): CrucibleCatoIntegrationService {
  return new CrucibleCatoIntegrationService(pool, llmInvoker, modelInfoProvider);
}
