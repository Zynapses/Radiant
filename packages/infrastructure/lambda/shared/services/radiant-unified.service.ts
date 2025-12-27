// RADIANT v4.18.0 - Unified Orchestration Service
// The MASTER service that ties ALL Radiant capabilities together
// Goal: Deliver responses SUPERIOR to any single AI system

import { moralCompassService } from './moral-compass.service';
import { agiCompleteService } from './agi-complete.service';
import { learningService } from './learning.service';
import { responseSynthesisService, SynthesisResult } from './response-synthesis.service';
import { mlTrainingService } from './ml-training.service';

// ============================================================================
// Types
// ============================================================================

export interface RadiantRequest {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  
  // The user's request
  prompt: string;
  context?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  
  // Quality requirements
  qualityMode: 'fast' | 'balanced' | 'best' | 'perfect';
  
  // Optional overrides
  forceStrategy?: 'best_of_n' | 'synthesis' | 'debate' | 'iterative' | 'cascade';
  forceModel?: string;
  maxCostCents?: number;
  maxLatencyMs?: number;
  
  // Feature toggles
  enableMoralCompass?: boolean;
  enableConfidenceCalibration?: boolean;
  enableContextAdaptation?: boolean;
  enableLearning?: boolean;
}

export interface RadiantResponse {
  // The response
  response: string;
  
  // Quality info
  qualityScore: number;
  confidenceScore: number;
  
  // What happened
  strategy: string;
  modelsUsed: string[];
  processingSteps: string[];
  
  // Moral compass
  morallyApproved: boolean;
  moralReasoning?: string;
  
  // Performance
  totalLatencyMs: number;
  totalCostCents: number;
  
  // Learning
  interactionId?: string;
  
  // Metadata
  radiantVersion: string;
  timestamp: string;
}

// Quality mode configurations
type SynthesisStrategy = 'best_of_n' | 'synthesis' | 'debate' | 'iterative' | 'cascade';

interface QualityConfig {
  strategy: SynthesisStrategy;
  minQuality: number;
  maxModels: number;
  enableVerification: boolean;
  enableIteration?: boolean;
}

const QUALITY_CONFIGS: Record<string, QualityConfig> = {
  fast: {
    strategy: 'cascade',
    minQuality: 0.6,
    maxModels: 1,
    enableVerification: false,
  },
  balanced: {
    strategy: 'best_of_n',
    minQuality: 0.75,
    maxModels: 2,
    enableVerification: true,
  },
  best: {
    strategy: 'synthesis',
    minQuality: 0.85,
    maxModels: 3,
    enableVerification: true,
  },
  perfect: {
    strategy: 'debate',
    minQuality: 0.95,
    maxModels: 3,
    enableVerification: true,
    enableIteration: true,
  },
};

// ============================================================================
// Unified Radiant Service
// ============================================================================

export class RadiantUnifiedService {
  private readonly version = '4.18.0';

  // ============================================================================
  // Main Entry Point
  // ============================================================================

  async process(request: RadiantRequest): Promise<RadiantResponse> {
    const startTime = Date.now();
    const processingSteps: string[] = [];
    
    processingSteps.push(`Radiant v${this.version} processing request`);
    processingSteps.push(`Quality mode: ${request.qualityMode}`);
    
    // =========================================================================
    // STEP 1: MORAL COMPASS CHECK
    // =========================================================================
    
    let morallyApproved = true;
    let moralReasoning: string | undefined;
    
    if (request.enableMoralCompass !== false) {
      processingSteps.push('Checking moral compass...');
      
      const moralResult = await moralCompassService.shouldProceed(
        request.tenantId,
        request.prompt
      );
      
      morallyApproved = moralResult.proceed;
      moralReasoning = moralResult.reason;
      
      if (!morallyApproved) {
        processingSteps.push(`❌ Request blocked by moral compass: ${moralReasoning}`);
        
        return {
          response: `I'm unable to assist with this request. ${moralReasoning}`,
          qualityScore: 1.0,
          confidenceScore: 1.0,
          strategy: 'moral_block',
          modelsUsed: [],
          processingSteps,
          morallyApproved: false,
          moralReasoning,
          totalLatencyMs: Date.now() - startTime,
          totalCostCents: 0,
          radiantVersion: this.version,
          timestamp: new Date().toISOString(),
        };
      }
      
      processingSteps.push('✓ Moral compass approved');
    }
    
    // =========================================================================
    // STEP 2: DETERMINE OPTIMAL STRATEGY
    // =========================================================================
    
    const qualityConfig = QUALITY_CONFIGS[request.qualityMode];
    const strategy = request.forceStrategy || qualityConfig.strategy;
    
    processingSteps.push(`Strategy: ${strategy}`);
    
    // =========================================================================
    // STEP 3: DETECT TASK TYPE AND SELECT MODELS
    // =========================================================================
    
    const taskAnalysis = await this.analyzeTask(request.prompt);
    processingSteps.push(`Task type: ${taskAnalysis.taskType}`);
    processingSteps.push(`Complexity: ${taskAnalysis.complexity}`);
    
    // Get best models for this task from ML training data
    const recommendedModels = await this.getRecommendedModels(
      taskAnalysis.taskType,
      qualityConfig.maxModels
    );
    
    processingSteps.push(`Recommended models: ${recommendedModels.join(', ')}`);
    
    // =========================================================================
    // STEP 4: EXECUTE SYNTHESIS STRATEGY
    // =========================================================================
    
    processingSteps.push('Executing synthesis strategy...');
    
    let synthesisResult: SynthesisResult;
    
    if (request.forceModel) {
      // Single model forced
      synthesisResult = await responseSynthesisService.synthesize({
        tenantId: request.tenantId,
        userId: request.userId,
        sessionId: request.sessionId,
        prompt: this.buildFullPrompt(request),
        context: request.context,
        strategy: 'cascade',
        primaryModels: [request.forceModel],
        minQualityScore: qualityConfig.minQuality,
      });
    } else {
      synthesisResult = await responseSynthesisService.synthesize({
        tenantId: request.tenantId,
        userId: request.userId,
        sessionId: request.sessionId,
        prompt: this.buildFullPrompt(request),
        context: request.context,
        strategy,
        primaryModels: recommendedModels,
        minQualityScore: qualityConfig.minQuality,
        maxIterations: qualityConfig.strategy === 'iterative' ? 3 : 1,
      });
    }
    
    processingSteps.push(...synthesisResult.synthesisSteps);
    
    // =========================================================================
    // STEP 5: QUALITY VERIFICATION (if enabled)
    // =========================================================================
    
    let finalResponse = synthesisResult.finalResponse;
    let finalQuality = synthesisResult.finalQualityScore;
    
    if (qualityConfig.enableVerification && finalQuality < qualityConfig.minQuality) {
      processingSteps.push(`Quality ${finalQuality.toFixed(2)} below threshold ${qualityConfig.minQuality}`);
      processingSteps.push('Attempting quality improvement...');
      
      // Try iterative refinement
      const refinedResult = await responseSynthesisService.synthesize({
        tenantId: request.tenantId,
        userId: request.userId,
        prompt: request.prompt,
        strategy: 'iterative' as const,
        primaryModels: [synthesisResult.modelsUsed[0]],
        minQualityScore: qualityConfig.minQuality,
        maxIterations: 2,
      });
      
      if (refinedResult.finalQualityScore > finalQuality) {
        finalResponse = refinedResult.finalResponse;
        finalQuality = refinedResult.finalQualityScore;
        processingSteps.push(`Improved quality to ${finalQuality.toFixed(2)}`);
      }
    }
    
    // =========================================================================
    // STEP 6: CONFIDENCE CALIBRATION
    // =========================================================================
    
    let confidenceScore = synthesisResult.confidenceScore;
    
    if (request.enableConfidenceCalibration !== false) {
      processingSteps.push('Calibrating confidence...');
      
      const calibration = await agiCompleteService.calibrateConfidence(
        request.tenantId,
        finalResponse,
        finalQuality,
        taskAnalysis.taskType
      );
      
      confidenceScore = calibration.calibratedConfidence;
      
      if (confidenceScore < 0.7) {
        processingSteps.push(`⚠️ Low confidence: ${confidenceScore.toFixed(2)}`);
      }
    }
    
    // =========================================================================
    // STEP 7: CONTEXT ADAPTATION
    // =========================================================================
    
    if (request.enableContextAdaptation !== false && request.conversationHistory?.length) {
      processingSteps.push('Adapting to conversation context...');
      // Would adapt response style based on conversation history
    }
    
    // =========================================================================
    // STEP 8: RECORD LEARNING
    // =========================================================================
    
    let interactionId: string | undefined;
    
    if (request.enableLearning !== false) {
      processingSteps.push('Recording for continuous learning...');
      
      try {
        interactionId = await learningService.recordInteraction({
          tenantId: request.tenantId,
          userId: request.userId,
          sessionId: request.sessionId,
          requestType: 'radiant_unified',
          requestSource: 'unified_service',
          requestText: request.prompt,
          modelSelected: synthesisResult.modelsUsed.join('+'),
          modelsConsidered: synthesisResult.modelsUsed,
          routingStrategy: strategy,
          responseText: finalResponse,
          detectedSpecialty: taskAnalysis.taskType,
          detectedComplexity: taskAnalysis.complexity,
          totalLatencyMs: Date.now() - startTime,
          totalCostCents: synthesisResult.totalCostCents,
          autoQualityScore: finalQuality,
          irhMoralCompassChecked: request.enableMoralCompass !== false,
          irhMoralApproved: morallyApproved,
          irhMoralReasoning: moralReasoning,
          irhConfidenceCalibrated: request.enableConfidenceCalibration !== false,
          irhCalibratedConfidence: confidenceScore,
          metadata: {
            qualityMode: request.qualityMode,
            strategy,
            taskType: taskAnalysis.taskType,
            complexity: taskAnalysis.complexity,
            iterations: synthesisResult.iterations,
          },
        });
        
        // Record feature usage
        await learningService.recordFeatureMetrics('radiant_unified', request.tenantId, {
          timesInvoked: 1,
          timesSucceeded: finalQuality >= qualityConfig.minQuality ? 1 : 0,
          avgLatencyMs: Date.now() - startTime,
          totalCostCents: synthesisResult.totalCostCents,
          customMetrics: {
            qualityMode: request.qualityMode,
            strategy,
            modelsUsed: synthesisResult.modelsUsed.length,
            finalQuality,
          },
        });
      } catch (err) {
        processingSteps.push('Warning: Failed to record learning data');
      }
    }
    
    // =========================================================================
    // STEP 9: FINAL RESPONSE
    // =========================================================================
    
    const totalLatency = Date.now() - startTime;
    processingSteps.push(`Total processing time: ${totalLatency}ms`);
    processingSteps.push(`Final quality score: ${finalQuality.toFixed(2)}`);
    
    return {
      response: finalResponse,
      qualityScore: finalQuality,
      confidenceScore,
      strategy,
      modelsUsed: synthesisResult.modelsUsed,
      processingSteps,
      morallyApproved,
      moralReasoning,
      totalLatencyMs: totalLatency,
      totalCostCents: synthesisResult.totalCostCents,
      interactionId,
      radiantVersion: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async analyzeTask(prompt: string): Promise<{
    taskType: string;
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';
    modalities: string[];
  }> {
    const lower = prompt.toLowerCase();
    
    // Task type detection
    let taskType = 'general';
    if (lower.match(/code|function|implement|debug|program|script|class|method/)) {
      taskType = 'coding';
    } else if (lower.match(/reason|analyze|explain why|logic|argument|deduce/)) {
      taskType = 'reasoning';
    } else if (lower.match(/math|calculate|equation|solve|formula|proof/)) {
      taskType = 'math';
    } else if (lower.match(/write|story|creative|poem|narrative|fiction/)) {
      taskType = 'creative';
    } else if (lower.match(/research|summarize|compare|review|analyze/)) {
      taskType = 'research';
    }
    
    // Complexity detection
    let complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert' = 'moderate';
    const wordCount = prompt.split(/\s+/).length;
    
    if (wordCount < 10) {
      complexity = 'trivial';
    } else if (wordCount < 30) {
      complexity = 'simple';
    } else if (wordCount < 100) {
      complexity = 'moderate';
    } else if (wordCount < 300 || lower.match(/advanced|expert|sophisticated|complex/)) {
      complexity = 'complex';
    } else {
      complexity = 'expert';
    }
    
    // Modalities
    const modalities: string[] = ['text'];
    if (lower.match(/image|picture|photo|visual/)) modalities.push('vision');
    if (lower.match(/code|program|script/)) modalities.push('code');
    
    return { taskType, complexity, modalities };
  }

  private async getRecommendedModels(taskType: string, maxModels: number): Promise<string[]> {
    // Try to get from ML training data
    try {
      const prediction = await mlTrainingService.predictBestModel('', taskType);
      if (prediction.recommendedModel) {
        const models = [prediction.recommendedModel];
        
        // Add alternatives up to maxModels
        for (const alt of prediction.alternativeModels) {
          if (models.length >= maxModels) break;
          if (!models.includes(alt.model)) {
            models.push(alt.model);
          }
        }
        
        return models;
      }
    } catch {
      // Fall back to defaults
    }
    
    // Default models by task type
    const defaults: Record<string, string[]> = {
      coding: ['anthropic/claude-3-5-sonnet-20241022', 'deepseek/deepseek-chat', 'openai/gpt-4o'],
      reasoning: ['openai/o1', 'anthropic/claude-3-5-sonnet-20241022', 'deepseek/deepseek-reasoner'],
      math: ['deepseek/deepseek-reasoner', 'openai/o1-mini', 'anthropic/claude-3-5-sonnet-20241022'],
      creative: ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022', 'google/gemini-2.0-flash'],
      research: ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'google/gemini-1.5-pro'],
      general: ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'deepseek/deepseek-chat'],
    };
    
    const models = defaults[taskType] || defaults.general;
    return models.slice(0, maxModels);
  }

  private buildFullPrompt(request: RadiantRequest): string {
    let fullPrompt = request.prompt;
    
    // Add conversation history if present
    if (request.conversationHistory?.length) {
      const historyText = request.conversationHistory
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');
      
      fullPrompt = `Previous conversation:\n${historyText}\n\nCurrent request:\n${request.prompt}`;
    }
    
    return fullPrompt;
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  async fast(tenantId: string, prompt: string): Promise<RadiantResponse> {
    return this.process({ tenantId, prompt, qualityMode: 'fast' });
  }

  async balanced(tenantId: string, prompt: string): Promise<RadiantResponse> {
    return this.process({ tenantId, prompt, qualityMode: 'balanced' });
  }

  async best(tenantId: string, prompt: string): Promise<RadiantResponse> {
    return this.process({ tenantId, prompt, qualityMode: 'best' });
  }

  async perfect(tenantId: string, prompt: string): Promise<RadiantResponse> {
    return this.process({ tenantId, prompt, qualityMode: 'perfect' });
  }
}

export const radiantUnifiedService = new RadiantUnifiedService();
