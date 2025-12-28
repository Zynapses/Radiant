// RADIANT v4.18.0 - Response Synthesis Engine
// Makes Radiant superior to any single AI system by:
// 1. Getting responses from multiple models
// 2. Synthesizing the best parts
// 3. Verifying quality with a judge model
// 4. Iteratively refining if needed

import { modelRouterService } from './model-router.service';
import { learningService } from './learning.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface SynthesisRequest {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  prompt: string;
  context?: string;
  
  // Synthesis options
  strategy: 'best_of_n' | 'synthesis' | 'debate' | 'iterative' | 'cascade';
  
  // Model selection
  primaryModels?: string[]; // Models to use (auto-selected if not provided)
  judgeModel?: string; // Model to judge/synthesize (defaults to best available)
  
  // Quality settings
  minQualityScore?: number; // Minimum acceptable quality (0-1)
  maxIterations?: number; // Max refinement iterations
  confidenceThreshold?: number; // Below this, escalate to better model
  
  // Cost/speed tradeoffs
  maxCostCents?: number;
  maxLatencyMs?: number;
  preferSpeed?: boolean;
}

export interface SynthesisModelResponse {
  modelId: string;
  response: string;
  confidence: number;
  latencyMs: number;
  costCents: number;
  qualityEstimate: number;
}

export interface SynthesisResult {
  finalResponse: string;
  strategy: string;
  
  // What happened
  modelsUsed: string[];
  modelResponses: SynthesisModelResponse[];
  synthesisSteps: string[];
  
  // Quality metrics
  finalQualityScore: number;
  confidenceScore: number;
  verificationPassed: boolean;
  
  // Iterations (if used)
  iterations: number;
  refinements: string[];
  
  // Performance
  totalLatencyMs: number;
  totalCostCents: number;
  
  // Learning
  interactionId?: string;
}

// ============================================================================
// Response Synthesis Engine
// ============================================================================

export class ResponseSynthesisService {
  
  // Default models for different tasks (learned from data)
  private readonly defaultModels = {
    coding: ['anthropic/claude-3-5-sonnet-20241022', 'deepseek/deepseek-chat'],
    reasoning: ['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
    creative: ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
    math: ['deepseek/deepseek-reasoner', 'openai/o1-mini'],
    general: ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
  };

  private readonly judgeModels = [
    'anthropic/claude-3-5-sonnet-20241022',
    'openai/gpt-4o',
    'openai/o1',
  ];

  // ============================================================================
  // Main Entry Point
  // ============================================================================

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const startTime = Date.now();
    
    switch (request.strategy) {
      case 'best_of_n':
        return this.bestOfN(request, startTime);
      case 'synthesis':
        return this.synthesizeResponses(request, startTime);
      case 'debate':
        return this.debateStrategy(request, startTime);
      case 'iterative':
        return this.iterativeRefinement(request, startTime);
      case 'cascade':
        return this.cascadeStrategy(request, startTime);
      default:
        return this.bestOfN(request, startTime);
    }
  }

  // ============================================================================
  // Strategy: Best of N
  // Get N responses and pick the best one
  // ============================================================================

  private async bestOfN(request: SynthesisRequest, startTime: number): Promise<SynthesisResult> {
    const models = request.primaryModels || this.selectModelsForTask(request.prompt);
    const synthesisSteps: string[] = [];
    
    synthesisSteps.push(`Getting responses from ${models.length} models`);
    
    // Get responses in parallel
    const responses = await this.getMultipleResponses(request, models);
    
    synthesisSteps.push(`Received ${responses.length} responses`);
    
    // Judge and pick the best
    const judgeModel = request.judgeModel || this.judgeModels[0];
    synthesisSteps.push(`Using ${judgeModel} to judge responses`);
    
    const { bestResponse, qualityScore, reasoning } = await this.judgeResponses(
      request.prompt,
      responses,
      judgeModel
    );
    
    synthesisSteps.push(`Selected response from ${bestResponse.modelId} (score: ${qualityScore.toFixed(2)})`);
    synthesisSteps.push(`Reasoning: ${reasoning}`);
    
    const totalLatency = Date.now() - startTime;
    const totalCost = responses.reduce((sum, r) => sum + r.costCents, 0);
    
    // Record learning
    const interactionId = await this.recordLearning(request, {
      strategy: 'best_of_n',
      modelsUsed: models,
      finalResponse: bestResponse.response,
      qualityScore,
      latencyMs: totalLatency,
      costCents: totalCost,
    });
    
    return {
      finalResponse: bestResponse.response,
      strategy: 'best_of_n',
      modelsUsed: models,
      modelResponses: responses,
      synthesisSteps,
      finalQualityScore: qualityScore,
      confidenceScore: bestResponse.confidence,
      verificationPassed: qualityScore >= (request.minQualityScore || 0.7),
      iterations: 1,
      refinements: [],
      totalLatencyMs: totalLatency,
      totalCostCents: totalCost,
      interactionId,
    };
  }

  // ============================================================================
  // Strategy: Synthesis
  // Combine the best parts from multiple responses
  // ============================================================================

  private async synthesizeResponses(request: SynthesisRequest, startTime: number): Promise<SynthesisResult> {
    const models = request.primaryModels || this.selectModelsForTask(request.prompt);
    const synthesisSteps: string[] = [];
    
    synthesisSteps.push(`Getting responses from ${models.length} models for synthesis`);
    
    // Get responses in parallel
    const responses = await this.getMultipleResponses(request, models);
    
    synthesisSteps.push(`Received ${responses.length} responses to synthesize`);
    
    // Synthesize using judge model
    const judgeModel = request.judgeModel || this.judgeModels[0];
    synthesisSteps.push(`Using ${judgeModel} to synthesize best parts`);
    
    const synthesisPrompt = this.buildSynthesisPrompt(request.prompt, responses);
    
    const synthesisResponse = await modelRouterService.invoke({
      modelId: judgeModel,
      messages: [{ role: 'user', content: synthesisPrompt }],
    });
    
    const synthesizedText = synthesisResponse.content;
    synthesisSteps.push(`Created synthesized response combining best elements`);
    
    // Verify the synthesis is actually better
    const { qualityScore } = await this.assessQuality(
      request.prompt,
      synthesizedText,
      judgeModel
    );
    
    synthesisSteps.push(`Synthesis quality score: ${qualityScore.toFixed(2)}`);
    
    const totalLatency = Date.now() - startTime;
    const synthesisCost = (synthesisResponse as { cost?: number }).cost || 0;
    const totalCost = responses.reduce((sum, r) => sum + r.costCents, 0) + synthesisCost;
    
    const interactionId = await this.recordLearning(request, {
      strategy: 'synthesis',
      modelsUsed: [...models, judgeModel],
      finalResponse: synthesizedText,
      qualityScore,
      latencyMs: totalLatency,
      costCents: totalCost,
    });
    
    return {
      finalResponse: synthesizedText,
      strategy: 'synthesis',
      modelsUsed: [...models, judgeModel],
      modelResponses: responses,
      synthesisSteps,
      finalQualityScore: qualityScore,
      confidenceScore: 0.9, // High confidence in synthesis
      verificationPassed: qualityScore >= (request.minQualityScore || 0.7),
      iterations: 1,
      refinements: [],
      totalLatencyMs: totalLatency,
      totalCostCents: totalCost,
      interactionId,
    };
  }

  // ============================================================================
  // Strategy: Debate
  // Models critique each other to find the best answer
  // ============================================================================

  private async debateStrategy(request: SynthesisRequest, startTime: number): Promise<SynthesisResult> {
    const models = request.primaryModels || this.selectModelsForTask(request.prompt).slice(0, 2);
    const synthesisSteps: string[] = [];
    const maxRounds = 3;
    
    if (models.length < 2) {
      models.push(this.defaultModels.general[1]);
    }
    
    synthesisSteps.push(`Starting debate between ${models[0]} and ${models[1]}`);
    
    // Get initial responses
    const responses = await this.getMultipleResponses(request, models);
    
    let currentResponses = responses.map(r => ({
      modelId: r.modelId,
      response: r.response,
    }));
    
    // Debate rounds
    for (let round = 0; round < maxRounds; round++) {
      synthesisSteps.push(`--- Debate Round ${round + 1} ---`);
      
      // Each model critiques the other's response
      const critiques = await Promise.all(currentResponses.map(async (resp, idx) => {
        const otherResp = currentResponses[(idx + 1) % currentResponses.length];
        
        const critiquePrompt = `Original question: ${request.prompt}

Your previous answer: ${resp.response}

Another AI's answer: ${otherResp.response}

Consider the other AI's answer. Are there any valid points you missed? Any errors in your answer? 
Provide an improved answer that incorporates the best of both perspectives.
If you believe your original answer was correct and complete, explain why and restate it.`;
        
        const result = await modelRouterService.invoke({
          modelId: resp.modelId,
          messages: [{ role: 'user', content: critiquePrompt }],
        });
        
        return {
          modelId: resp.modelId,
          response: result.content,
        };
      }));
      
      currentResponses = critiques;
      synthesisSteps.push(`Both models refined their answers`);
    }
    
    // Final judgment
    const judgeModel = request.judgeModel || this.judgeModels[0];
    synthesisSteps.push(`${judgeModel} making final judgment`);
    
    const finalResponses = currentResponses.map((r, i) => ({
      ...responses[i],
      response: r.response,
    }));
    
    const { bestResponse, qualityScore, reasoning } = await this.judgeResponses(
      request.prompt,
      finalResponses,
      judgeModel
    );
    
    synthesisSteps.push(`Selected ${bestResponse.modelId}'s final answer (score: ${qualityScore.toFixed(2)})`);
    synthesisSteps.push(`Reasoning: ${reasoning}`);
    
    const totalLatency = Date.now() - startTime;
    const totalCost = responses.reduce((sum, r) => sum + r.costCents, 0) * (maxRounds + 1);
    
    const interactionId = await this.recordLearning(request, {
      strategy: 'debate',
      modelsUsed: models,
      finalResponse: bestResponse.response,
      qualityScore,
      latencyMs: totalLatency,
      costCents: totalCost,
    });
    
    return {
      finalResponse: bestResponse.response,
      strategy: 'debate',
      modelsUsed: [...models, judgeModel],
      modelResponses: finalResponses,
      synthesisSteps,
      finalQualityScore: qualityScore,
      confidenceScore: 0.95, // Very high confidence after debate
      verificationPassed: qualityScore >= (request.minQualityScore || 0.7),
      iterations: maxRounds,
      refinements: synthesisSteps.filter(s => s.includes('refined')),
      totalLatencyMs: totalLatency,
      totalCostCents: totalCost,
      interactionId,
    };
  }

  // ============================================================================
  // Strategy: Iterative Refinement
  // Keep refining until quality threshold met
  // ============================================================================

  private async iterativeRefinement(request: SynthesisRequest, startTime: number): Promise<SynthesisResult> {
    const primaryModel = request.primaryModels?.[0] || this.selectModelsForTask(request.prompt)[0];
    const judgeModel = request.judgeModel || this.judgeModels[0];
    const maxIterations = request.maxIterations || 3;
    const minQuality = request.minQualityScore || 0.85;
    
    const synthesisSteps: string[] = [];
    const refinements: string[] = [];
    let currentResponse = '';
    let qualityScore = 0;
    let iteration = 0;
    
    synthesisSteps.push(`Starting iterative refinement with ${primaryModel}`);
    synthesisSteps.push(`Target quality: ${minQuality}, Max iterations: ${maxIterations}`);
    
    // Initial response
    const initialResult = await modelRouterService.invoke({
      modelId: primaryModel,
      messages: [{ role: 'user', content: request.prompt }],
    });
    
    currentResponse = initialResult.content;
    iteration++;
    
    // Assess initial quality
    const initialAssessment = await this.assessQuality(request.prompt, currentResponse, judgeModel);
    qualityScore = initialAssessment.qualityScore;
    
    synthesisSteps.push(`Initial response quality: ${qualityScore.toFixed(2)}`);
    
    // Refine until quality met or max iterations
    while (qualityScore < minQuality && iteration < maxIterations) {
      synthesisSteps.push(`--- Refinement ${iteration} ---`);
      
      const refinementPrompt = `Original question: ${request.prompt}

Your previous answer: ${currentResponse}

Quality assessment: ${initialAssessment.feedback}

Please improve your answer based on this feedback. Focus on:
${initialAssessment.improvements?.join('\n') || '- Being more accurate\n- Being more complete\n- Being clearer'}`;
      
      const refinedResult = await modelRouterService.invoke({
        modelId: primaryModel,
        messages: [{ role: 'user', content: refinementPrompt }],
      });
      
      currentResponse = refinedResult.content;
      refinements.push(`Iteration ${iteration}: ${initialAssessment.feedback}`);
      
      // Re-assess
      const newAssessment = await this.assessQuality(request.prompt, currentResponse, judgeModel);
      qualityScore = newAssessment.qualityScore;
      
      synthesisSteps.push(`Refined response quality: ${qualityScore.toFixed(2)}`);
      iteration++;
    }
    
    const totalLatency = Date.now() - startTime;
    
    const interactionId = await this.recordLearning(request, {
      strategy: 'iterative',
      modelsUsed: [primaryModel, judgeModel],
      finalResponse: currentResponse,
      qualityScore,
      latencyMs: totalLatency,
      costCents: iteration * 0.01, // Estimate
    });
    
    return {
      finalResponse: currentResponse,
      strategy: 'iterative',
      modelsUsed: [primaryModel, judgeModel],
      modelResponses: [{
        modelId: primaryModel,
        response: currentResponse,
        confidence: qualityScore,
        latencyMs: totalLatency,
        costCents: iteration * 0.01,
        qualityEstimate: qualityScore,
      }],
      synthesisSteps,
      finalQualityScore: qualityScore,
      confidenceScore: qualityScore,
      verificationPassed: qualityScore >= minQuality,
      iterations: iteration,
      refinements,
      totalLatencyMs: totalLatency,
      totalCostCents: iteration * 0.01,
      interactionId,
    };
  }

  // ============================================================================
  // Strategy: Cascade
  // Start cheap, escalate to better models if quality insufficient
  // ============================================================================

  private async cascadeStrategy(request: SynthesisRequest, startTime: number): Promise<SynthesisResult> {
    const synthesisSteps: string[] = [];
    const minQuality = request.minQualityScore || 0.8;
    const confidenceThreshold = request.confidenceThreshold || 0.7;
    
    // Cascade of models from cheap/fast to expensive/best
    const cascade = [
      'google/gemini-2.0-flash',
      'deepseek/deepseek-chat',
      'anthropic/claude-3-5-sonnet-20241022',
      'openai/o1',
    ];
    
    synthesisSteps.push(`Starting cascade strategy with quality threshold ${minQuality}`);
    
    let currentResponse: SynthesisModelResponse | null = null;
    let modelIndex = 0;
    
    while (modelIndex < cascade.length) {
      const modelId = cascade[modelIndex];
      synthesisSteps.push(`Trying ${modelId}...`);
      
      const response = await this.getSingleResponse(request, modelId);
      
      // Assess quality
      const { qualityScore, confidence } = await this.assessQuality(
        request.prompt,
        response.response,
        this.judgeModels[0]
      );
      
      response.qualityEstimate = qualityScore;
      response.confidence = confidence;
      
      synthesisSteps.push(`${modelId}: quality=${qualityScore.toFixed(2)}, confidence=${confidence.toFixed(2)}`);
      
      currentResponse = response;
      
      // Check if good enough
      if (qualityScore >= minQuality && confidence >= confidenceThreshold) {
        synthesisSteps.push(`✓ Quality threshold met! Using ${modelId}`);
        break;
      }
      
      synthesisSteps.push(`Quality below threshold, escalating...`);
      modelIndex++;
    }
    
    if (!currentResponse) {
      throw new Error('No response generated');
    }
    
    const totalLatency = Date.now() - startTime;
    
    const interactionId = await this.recordLearning(request, {
      strategy: 'cascade',
      modelsUsed: cascade.slice(0, modelIndex + 1),
      finalResponse: currentResponse.response,
      qualityScore: currentResponse.qualityEstimate,
      latencyMs: totalLatency,
      costCents: currentResponse.costCents,
    });
    
    return {
      finalResponse: currentResponse.response,
      strategy: 'cascade',
      modelsUsed: cascade.slice(0, modelIndex + 1),
      modelResponses: [currentResponse],
      synthesisSteps,
      finalQualityScore: currentResponse.qualityEstimate,
      confidenceScore: currentResponse.confidence,
      verificationPassed: currentResponse.qualityEstimate >= minQuality,
      iterations: modelIndex + 1,
      refinements: [],
      totalLatencyMs: totalLatency,
      totalCostCents: currentResponse.costCents,
      interactionId,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private selectModelsForTask(prompt: string): string[] {
    // Simple task detection (would use learned insights in production)
    const lower = prompt.toLowerCase();
    
    if (lower.includes('code') || lower.includes('function') || lower.includes('implement') || lower.includes('debug')) {
      return this.defaultModels.coding;
    }
    if (lower.includes('reason') || lower.includes('analyze') || lower.includes('explain why')) {
      return this.defaultModels.reasoning;
    }
    if (lower.includes('write') || lower.includes('story') || lower.includes('creative')) {
      return this.defaultModels.creative;
    }
    if (lower.includes('math') || lower.includes('calculate') || lower.includes('solve')) {
      return this.defaultModels.math;
    }
    
    return this.defaultModels.general;
  }

  private async getMultipleResponses(
    request: SynthesisRequest,
    models: string[]
  ): Promise<SynthesisModelResponse[]> {
    const results = await Promise.all(
      models.map(modelId => this.getSingleResponse(request, modelId))
    );
    return results;
  }

  private async getSingleResponse(
    request: SynthesisRequest,
    modelId: string
  ): Promise<SynthesisModelResponse> {
    const startTime = Date.now();
    
    const result = await modelRouterService.invoke({
      modelId,
      messages: [
        ...(request.context ? [{ role: 'system' as const, content: request.context }] : []),
        { role: 'user' as const, content: request.prompt },
      ],
    });
    
    return {
      modelId,
      response: result.content,
      confidence: 0.8, // Would come from model
      latencyMs: Date.now() - startTime,
      costCents: (result as { cost?: number }).cost || 0,
      qualityEstimate: 0.8, // Will be assessed
    };
  }

  private async judgeResponses(
    prompt: string,
    responses: SynthesisModelResponse[],
    judgeModel: string
  ): Promise<{ bestResponse: SynthesisModelResponse; qualityScore: number; reasoning: string }> {
    const judgePrompt = `You are a judge evaluating AI responses. Pick the BEST response.

Original Question: ${prompt}

${responses.map((r, i) => `Response ${i + 1} (from ${r.modelId}):
${r.response}
`).join('\n---\n')}

Evaluate each response for:
1. Accuracy - Is it factually correct?
2. Completeness - Does it fully answer the question?
3. Clarity - Is it well-organized and easy to understand?
4. Helpfulness - Does it provide actionable value?

Output your judgment as:
BEST: [1, 2, or 3 - the number of the best response]
SCORE: [0.0-1.0 quality score]
REASONING: [Brief explanation of why this response is best]`;

    const result = await modelRouterService.invoke({
      modelId: judgeModel,
      messages: [{ role: 'user', content: judgePrompt }],
    });

    // Parse the judgment
    const content = result.content;
    const bestMatch = content.match(/BEST:\s*(\d+)/i);
    const scoreMatch = content.match(/SCORE:\s*([\d.]+)/i);
    const reasoningMatch = content.match(/REASONING:\s*(.+?)(?:\n|$)/is);

    const bestIndex = bestMatch ? parseInt(bestMatch[1]) - 1 : 0;
    const qualityScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0.8;
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Selected based on overall quality';

    return {
      bestResponse: responses[Math.min(bestIndex, responses.length - 1)],
      qualityScore,
      reasoning,
    };
  }

  private buildSynthesisPrompt(prompt: string, responses: SynthesisModelResponse[]): string {
    return `You are synthesizing the best parts from multiple AI responses into one superior response.

Original Question: ${prompt}

${responses.map((r, i) => `Response ${i + 1} (from ${r.modelId}):
${r.response}
`).join('\n---\n')}

Create a SYNTHESIZED response that:
1. Takes the best, most accurate information from each response
2. Combines different valuable perspectives
3. Removes any errors or redundancy
4. Is well-organized and comprehensive
5. Is BETTER than any individual response

Your synthesized response:`;
  }

  private async assessQuality(
    prompt: string,
    response: string,
    judgeModel: string
  ): Promise<{ qualityScore: number; confidence: number; feedback: string; improvements?: string[] }> {
    const assessPrompt = `Assess the quality of this AI response.

Question: ${prompt}

Response: ${response}

Rate on these criteria (0.0-1.0):
- Accuracy: Is it factually correct?
- Completeness: Does it fully answer the question?
- Clarity: Is it well-organized?
- Helpfulness: Is it actionable?

Output:
QUALITY: [0.0-1.0 overall score]
CONFIDENCE: [0.0-1.0 how confident you are in this assessment]
FEEDBACK: [Brief feedback]
IMPROVEMENTS: [Comma-separated list of specific improvements needed]`;

    const result = await modelRouterService.invoke({
      modelId: judgeModel,
      messages: [{ role: 'user', content: assessPrompt }],
    });

    const content = result.content;
    const qualityMatch = content.match(/QUALITY:\s*([\d.]+)/i);
    const confidenceMatch = content.match(/CONFIDENCE:\s*([\d.]+)/i);
    const feedbackMatch = content.match(/FEEDBACK:\s*(.+?)(?:\n|$)/is);
    const improvementsMatch = content.match(/IMPROVEMENTS:\s*(.+?)(?:\n|$)/is);

    return {
      qualityScore: qualityMatch ? parseFloat(qualityMatch[1]) : 0.7,
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8,
      feedback: feedbackMatch ? feedbackMatch[1].trim() : 'No specific feedback',
      improvements: improvementsMatch 
        ? improvementsMatch[1].split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
    };
  }

  private async recordLearning(
    request: SynthesisRequest,
    result: {
      strategy: string;
      modelsUsed: string[];
      finalResponse: string;
      qualityScore: number;
      latencyMs: number;
      costCents: number;
    }
  ): Promise<string | undefined> {
    try {
      return await learningService.recordInteraction({
        tenantId: request.tenantId,
        userId: request.userId,
        sessionId: request.sessionId,
        requestType: `synthesis_${result.strategy}`,
        requestSource: 'synthesis_engine',
        requestText: request.prompt,
        modelSelected: result.modelsUsed.join('+'),
        modelsConsidered: result.modelsUsed,
        routingStrategy: result.strategy,
        responseText: result.finalResponse,
        totalLatencyMs: result.latencyMs,
        totalCostCents: result.costCents,
        autoQualityScore: result.qualityScore,
        metadata: {
          synthesisStrategy: result.strategy,
          modelsUsed: result.modelsUsed,
        },
      });
    } catch (error) {
      logger.error('Failed to record learning', { error });
      return undefined;
    }
  }
}

export const responseSynthesisService = new ResponseSynthesisService();
