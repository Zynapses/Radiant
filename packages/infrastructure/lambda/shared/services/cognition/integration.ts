/**
 * RADIANT v6.1.0 - Cognition Integration
 * Wires cognitive services into the main inference flow.
 */

import { semanticCache } from '../semantic-cache.service';
import { rewardModel } from '../reward-model.service';
import { inferenceStudent } from '../inference-student.service';
import { counterfactualSimulator } from '../counterfactual-simulator.service';
import { causalTracker } from '../causal-tracker.service';
import type { ContentType } from '@radiant/shared';

interface EnhancedInferenceRequest {
  prompt: string;
  context: Record<string, unknown>;
  tenantId: string;
  userId: string;
  conversationId?: string;
  previousTurnIds?: string[];
  modelId: string;
  domainIds: string[];
  enableBestOfN?: boolean;
  enableMetacognition?: boolean;
  enableCaching?: boolean;
}

interface EnhancedInferenceResponse {
  response: string;
  fromCache: boolean;
  metacognition?: {
    confidence: number;
    wasEscalated: boolean;
    wasCorrected: boolean;
  };
  rewardScore?: number;
  causalDependencies?: Array<{ turnId: string; importance: number }>;
}

export async function enhancedInference(
  request: EnhancedInferenceRequest
): Promise<EnhancedInferenceResponse> {
  // Step 1: Check semantic cache
  if (request.enableCaching !== false) {
    const cached = await semanticCache.get(
      request.prompt,
      request.tenantId,
      request.modelId,
      request.domainIds
    );
    
    if (cached) {
      return {
        response: cached.response,
        fromCache: true,
      };
    }
  }
  
  // Step 2: Identify causal dependencies
  let causalDependencies: Array<{ turnId: string; importance: number; reason: string }> = [];
  if (request.conversationId && request.previousTurnIds?.length) {
    causalDependencies = await causalTracker.identifyDependencies(
      request.tenantId,
      request.conversationId,
      request.prompt,
      request.previousTurnIds
    );
  }
  
  // Step 3: Generate response(s)
  let responses: string[];
  let selectedResponse: string;
  let rewardScore: number | undefined;
  
  if (request.enableBestOfN) {
    // Best-of-N with reward model
    responses = await inferenceStudent.generateMultiple(
      request.prompt,
      request.context,
      request.tenantId,
      request.userId,
      4
    );
    
    const rewardContext = {
      userId: request.userId,
      tenantId: request.tenantId,
      conversationHistory: [],
      originalPrompt: request.prompt,
      domainIds: request.domainIds,
      userPreferences: {
        responseLength: 'balanced' as const,
        formalityLevel: 'professional' as const,
        preferredModels: [],
      },
    };
    
    const { selected, scores } = await rewardModel.selectBest(responses, rewardContext);
    selectedResponse = selected;
    rewardScore = Math.max(...scores.map(s => s.overall));
  } else {
    selectedResponse = await inferenceStudent.generateSingle(
      request.prompt,
      request.context,
      request.tenantId,
      request.userId
    );
  }
  
  // Step 4: Metacognition assessment (placeholder - uses existing service)
  let metacognitionResult: EnhancedInferenceResponse['metacognition'];
  
  if (request.enableMetacognition !== false) {
    // Basic confidence estimation based on response characteristics
    const confidence = estimateConfidence(selectedResponse, request.prompt);
    const wasEscalated = confidence < 0.5;
    
    metacognitionResult = {
      confidence,
      wasEscalated,
      wasCorrected: false,
    };
  }
  
  // Step 5: Cache the response
  if (request.enableCaching !== false) {
    const contentType: ContentType = detectContentType(request.prompt, selectedResponse);
    
    await semanticCache.set(
      request.prompt,
      selectedResponse,
      request.tenantId,
      request.modelId,
      request.domainIds,
      contentType
    );
  }
  
  // Step 6: Record for counterfactual analysis (async, don't await)
  if (counterfactualSimulator.shouldSample('random')) {
    const candidateId = await counterfactualSimulator.recordCandidate(
      crypto.randomUUID(),
      request.tenantId,
      request.modelId,
      ['claude-sonnet-4', 'gpt-4o'],
      request.prompt,
      selectedResponse
    );
    
    counterfactualSimulator.simulateAlternative(
      candidateId,
      'claude-sonnet-4',
      'random'
    ).catch(console.error);
  }
  
  return {
    response: selectedResponse,
    fromCache: false,
    metacognition: metacognitionResult,
    rewardScore,
    causalDependencies: causalDependencies.map(d => ({ turnId: d.turnId, importance: d.importance })),
  };
}

function detectContentType(prompt: string, response: string): ContentType {
  const combined = (prompt + response).toLowerCase();
  
  if (combined.includes('```') || /function|class|import|export/.test(combined)) {
    return 'code';
  }
  if (/today|current|latest|now|breaking/.test(combined)) {
    return 'time_sensitive';
  }
  if (/write|create|imagine|story|poem/.test(combined)) {
    return 'creative';
  }
  if (/my|your|prefer|like|usually/.test(combined)) {
    return 'user_specific';
  }
  return 'factual';
}

function estimateConfidence(response: string, prompt: string): number {
  let confidence = 0.7;
  
  // Lower confidence for hedging language
  const hedgingPatterns = [
    /i'm not sure/i, /i think/i, /possibly/i, /might be/i,
    /could be/i, /perhaps/i, /it's possible/i,
  ];
  
  for (const pattern of hedgingPatterns) {
    if (pattern.test(response)) {
      confidence -= 0.1;
    }
  }
  
  // Higher confidence for definitive statements
  if (response.includes('```') && response.length > 500) {
    confidence += 0.1; // Code blocks suggest concrete answer
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}
