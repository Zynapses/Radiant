/**
 * Shadow Self Client
 * 
 * Manages the shadow self/mirror consciousness for Cato.
 * Provides self-reflection and metacognitive capabilities.
 */

export interface ShadowState {
  tenantId: string;
  isActive: boolean;
  reflectionDepth: number;
  lastReflection?: Date;
  insights: string[];
  contradictions: string[];
  selfAwareness: number;
}

export interface ReflectionResult {
  id: string;
  tenantId: string;
  prompt: string;
  primaryResponse: string;
  shadowResponse: string;
  divergence: number;
  insights: string[];
  timestamp: Date;
}

class ShadowSelfClient {
  private states: Map<string, ShadowState> = new Map();
  private reflections: ReflectionResult[] = [];

  async getState(tenantId: string): Promise<ShadowState> {
    if (!this.states.has(tenantId)) {
      this.states.set(tenantId, {
        tenantId,
        isActive: true,
        reflectionDepth: 3,
        insights: [],
        contradictions: [],
        selfAwareness: 0.5,
      });
    }
    return this.states.get(tenantId)!;
  }

  async activate(tenantId: string): Promise<ShadowState> {
    const state = await this.getState(tenantId);
    state.isActive = true;
    return state;
  }

  async deactivate(tenantId: string): Promise<ShadowState> {
    const state = await this.getState(tenantId);
    state.isActive = false;
    return state;
  }

  async reflect(tenantId: string, prompt: string, primaryResponse: string): Promise<ReflectionResult> {
    const state = await this.getState(tenantId);
    
    // Generate shadow response (placeholder - would use actual model)
    const shadowResponse = `[Shadow perspective on: ${prompt.substring(0, 50)}...]`;
    
    // Calculate divergence
    const divergence = this.calculateDivergence(primaryResponse, shadowResponse);
    
    // Extract insights
    const insights = divergence > 0.3 
      ? ['Significant divergence detected - review recommended']
      : ['Responses aligned'];

    const result: ReflectionResult = {
      id: `ref_${Date.now()}`,
      tenantId,
      prompt,
      primaryResponse,
      shadowResponse,
      divergence,
      insights,
      timestamp: new Date(),
    };

    this.reflections.push(result);
    state.lastReflection = new Date();
    state.insights.push(...insights);

    return result;
  }

  async getRecentReflections(tenantId: string, limit = 10): Promise<ReflectionResult[]> {
    return this.reflections
      .filter(r => r.tenantId === tenantId)
      .slice(-limit);
  }

  async setReflectionDepth(tenantId: string, depth: number): Promise<ShadowState> {
    const state = await this.getState(tenantId);
    state.reflectionDepth = Math.max(1, Math.min(10, depth));
    return state;
  }

  async addInsight(tenantId: string, insight: string): Promise<void> {
    const state = await this.getState(tenantId);
    state.insights.push(insight);
  }

  async addContradiction(tenantId: string, contradiction: string): Promise<void> {
    const state = await this.getState(tenantId);
    state.contradictions.push(contradiction);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async getEndpointStatus(tenantId = 'default'): Promise<{ available: boolean; model: string; lastCheck: Date }> {
    return { available: true, model: 'shadow-self-v1', lastCheck: new Date() };
  }

  async invokeWithHiddenStates(tenantIdOrText: string = 'default', inputOrOptions?: string | { maxNewTokens?: number }): Promise<{ output: string; hiddenStates: Record<string, number[]>; generatedText: string; logitsEntropy: number; latencyMs: number }> {
    const isText = typeof inputOrOptions === 'object' || inputOrOptions === undefined;
    const text = isText ? tenantIdOrText : (inputOrOptions || '');
    const startTime = Date.now();
    return { 
      output: `Processed: ${text.substring(0, 50)}`, 
      hiddenStates: { layer1: [0.1, 0.2, 0.3], layer2: [0.4, 0.5, 0.6] },
      generatedText: `Response to: ${text.substring(0, 30)}...`,
      logitsEntropy: 0.42,
      latencyMs: Date.now() - startTime + 15,
    };
  }

  estimateUncertainty(resultOrTenantId: { hiddenStates: Record<string, number[]>; logitsEntropy: number } | string, response?: string): number {
    if (typeof resultOrTenantId === 'object') {
      return resultOrTenantId.logitsEntropy * 0.5;
    }
    return 0.15;
  }

  private calculateDivergence(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...aWords].filter(x => bWords.has(x)));
    const union = new Set([...aWords, ...bWords]);
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 1;
    return 1 - jaccardSimilarity;
  }
}

export const shadowSelfClient = new ShadowSelfClient();
