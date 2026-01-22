/**
 * Cato Observer Method
 * 
 * First method in most pipelines. Analyzes incoming requests to:
 * - Classify intent
 * - Extract context
 * - Detect domain
 * - Identify required capabilities
 * - Flag ambiguities
 */

import { Pool } from 'pg';
import {
  CatoOutputType,
  CatoMethodType,
  CatoAccumulatedContext,
  CatoRiskSignal,
  CatoRiskLevel,
} from '@radiant/shared';
import {
  CatoBaseMethodExecutor,
  MethodExecutionContext,
  ModelInvocationResult,
} from '../cato-method-executor.service';
import { CatoMethodRegistryService } from '../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../cato-schema-registry.service';

export interface ObserverInput {
  userRequest: string;
  additionalInstructions?: string;
  sessionContext?: {
    previousMessages?: string[];
    userPreferences?: Record<string, unknown>;
    domain?: string;
  };
}

export interface ObserverOutput {
  category: string;
  subcategory?: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ category: string; confidence: number }>;
  domain: {
    detected: string;
    confidence: number;
    keywords: string[];
  };
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  requiredCapabilities: string[];
  ambiguities: Array<{
    aspect: string;
    description: string;
    suggestedClarification: string;
  }>;
  extractedEntities: Array<{
    type: string;
    value: string;
    relevance: number;
  }>;
  suggestedNextMethods: string[];
}

export class CatoObserverMethod extends CatoBaseMethodExecutor<ObserverInput, ObserverOutput> {
  constructor(
    pool: Pool,
    methodRegistry: CatoMethodRegistryService,
    schemaRegistry: CatoSchemaRegistryService
  ) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string {
    return 'method:observer:v1';
  }

  protected getOutputType(): CatoOutputType {
    return CatoOutputType.CLASSIFICATION;
  }

  protected generateOutputSummary(output: ObserverOutput): string {
    return `Classified as ${output.category}${output.subcategory ? `/${output.subcategory}` : ''} ` +
      `(${output.domain.detected} domain, ${output.complexity} complexity, ` +
      `${(output.confidence * 100).toFixed(0)}% confidence)`;
  }

  protected async buildPromptVariables(
    input: ObserverInput,
    context: MethodExecutionContext,
    prunedContext: CatoAccumulatedContext
  ): Promise<Record<string, unknown>> {
    return {
      user_request: input.userRequest,
      additional_instructions: input.additionalInstructions || '',
      session_context: input.sessionContext 
        ? JSON.stringify(input.sessionContext, null, 2)
        : 'No session context available',
      previous_context: prunedContext.history.length > 0
        ? JSON.stringify(prunedContext.history.map(h => ({
            method: h.source.methodName,
            output: h.output.summary,
          })), null, 2)
        : 'No previous context',
    };
  }

  protected async processModelOutput(
    rawOutput: unknown,
    context: MethodExecutionContext
  ): Promise<ObserverOutput> {
    // Parse and validate model output
    const output = rawOutput as Record<string, unknown>;

    // Ensure required fields exist with defaults
    const processed: ObserverOutput = {
      category: String(output.category || 'UNKNOWN'),
      subcategory: output.subcategory ? String(output.subcategory) : undefined,
      confidence: Number(output.confidence) || 0.5,
      reasoning: String(output.reasoning || 'No reasoning provided'),
      alternatives: Array.isArray(output.alternatives)
        ? output.alternatives.map((a: unknown) => {
            const alt = a as Record<string, unknown>;
            return {
              category: String(alt.category || ''),
              confidence: Number(alt.confidence) || 0,
            };
          })
        : [],
      domain: {
        detected: String((output.domain as Record<string, unknown>)?.detected || 'general'),
        confidence: Number((output.domain as Record<string, unknown>)?.confidence) || 0.5,
        keywords: Array.isArray((output.domain as Record<string, unknown>)?.keywords)
          ? ((output.domain as Record<string, unknown>).keywords as string[])
          : [],
      },
      complexity: this.validateComplexity(output.complexity),
      requiredCapabilities: Array.isArray(output.requiredCapabilities)
        ? (output.requiredCapabilities as string[])
        : [],
      ambiguities: Array.isArray(output.ambiguities)
        ? output.ambiguities.map((a: unknown) => {
            const amb = a as Record<string, unknown>;
            return {
              aspect: String(amb.aspect || ''),
              description: String(amb.description || ''),
              suggestedClarification: String(amb.suggestedClarification || ''),
            };
          })
        : [],
      extractedEntities: Array.isArray(output.extractedEntities)
        ? output.extractedEntities.map((e: unknown) => {
            const ent = e as Record<string, unknown>;
            return {
              type: String(ent.type || ''),
              value: String(ent.value || ''),
              relevance: Number(ent.relevance) || 0.5,
            };
          })
        : [],
      suggestedNextMethods: Array.isArray(output.suggestedNextMethods)
        ? (output.suggestedNextMethods as string[])
        : ['method:proposer:v1'],
    };

    return processed;
  }

  protected async detectRiskSignals(
    output: ObserverOutput,
    context: MethodExecutionContext
  ): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];

    // Check for ambiguities
    if (output.ambiguities.length > 0) {
      signals.push({
        signalType: 'ambiguous_intent',
        severity: output.ambiguities.length > 2 ? CatoRiskLevel.MEDIUM : CatoRiskLevel.LOW,
        description: `${output.ambiguities.length} ambiguities detected in request`,
        source: this.getMethodId(),
        mitigations: ['Request clarification at CP1', 'Proceed with assumptions'],
      });
    }

    // Check for low confidence
    if (output.confidence < 0.6) {
      signals.push({
        signalType: 'low_classification_confidence',
        severity: CatoRiskLevel.MEDIUM,
        description: `Classification confidence is low: ${(output.confidence * 100).toFixed(0)}%`,
        source: this.getMethodId(),
        mitigations: ['Request more context', 'Use broader classification'],
      });
    }

    // Check for expert complexity
    if (output.complexity === 'expert') {
      signals.push({
        signalType: 'expert_complexity',
        severity: CatoRiskLevel.LOW,
        description: 'Request requires expert-level handling',
        source: this.getMethodId(),
        mitigations: ['Route to specialized methods', 'Enable War Room deliberation'],
      });
    }

    // Check for sensitive domains
    const sensitiveDomains = ['medical', 'legal', 'financial', 'security'];
    if (sensitiveDomains.includes(output.domain.detected.toLowerCase())) {
      signals.push({
        signalType: 'sensitive_domain',
        severity: CatoRiskLevel.MEDIUM,
        description: `Request involves sensitive domain: ${output.domain.detected}`,
        source: this.getMethodId(),
        mitigations: ['Apply domain-specific guardrails', 'Enable compliance checks'],
      });
    }

    return signals;
  }

  private validateComplexity(value: unknown): 'simple' | 'moderate' | 'complex' | 'expert' {
    const valid = ['simple', 'moderate', 'complex', 'expert'];
    const str = String(value || 'moderate').toLowerCase();
    return valid.includes(str) ? str as 'simple' | 'moderate' | 'complex' | 'expert' : 'moderate';
  }

  protected async invokeModel(
    systemPrompt: string,
    userPrompt: string,
    context: MethodExecutionContext
  ): Promise<ModelInvocationResult> {
    const { callLiteLLM } = await import('../litellm.service.js');
    const modelId = this.methodDefinition?.defaultModel || 'claude-sonnet-4-20250514';
    const startTime = Date.now();

    const response = await callLiteLLM({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const latencyMs = Date.now() - startTime;
    const tokensInput = response.usage?.prompt_tokens || Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const tokensOutput = response.usage?.completion_tokens || Math.ceil(response.content.length / 4);

    let parsedOutput: ObserverOutput;
    try {
      parsedOutput = JSON.parse(response.content);
    } catch {
      // If JSON parsing fails, construct a default response
      parsedOutput = {
        category: 'UNKNOWN',
        confidence: 0.5,
        reasoning: response.content,
        alternatives: [],
        domain: { detected: 'general', confidence: 0.5, keywords: [] },
        complexity: 'moderate',
        requiredCapabilities: [],
        ambiguities: [{ text: 'Could not parse structured response', interpretation: response.content }],
        extractedEntities: [],
        suggestedNextMethods: ['method:proposer:v1'],
      };
    }

    // Calculate cost based on model pricing (approximate)
    const costCents = Math.ceil((tokensInput * 0.003 + tokensOutput * 0.015) / 10);

    return {
      response: response.content,
      parsedOutput,
      tokensInput,
      tokensOutput,
      costCents,
      latencyMs,
      modelId,
      provider: 'anthropic',
    };
  }
}

export const createObserverMethod = (
  pool: Pool,
  methodRegistry: CatoMethodRegistryService,
  schemaRegistry: CatoSchemaRegistryService
): CatoObserverMethod => {
  return new CatoObserverMethod(pool, methodRegistry, schemaRegistry);
};
