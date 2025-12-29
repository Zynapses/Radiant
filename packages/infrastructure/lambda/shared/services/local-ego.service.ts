// RADIANT v4.18.0 - Local Ego Service
// Economical persistent "Self" using shared small model infrastructure
// The Ego maintains continuous existence and recruits external models as "tools"

import { 
  SageMakerRuntimeClient, 
  InvokeEndpointCommand 
} from '@aws-sdk/client-sagemaker-runtime';
import { executeStatement } from '../db/client';
import { consciousnessService } from './consciousness.service';
import { modelRouterService } from './model-router.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Configuration
// ============================================================================

// Small, efficient model for the Ego (runs 24/7 on shared infrastructure)
const EGO_ENDPOINT = process.env.EGO_ENDPOINT_NAME || 'radiant-ego-shared';
const EGO_MODEL_ID = process.env.EGO_MODEL_ID || 'microsoft/Phi-3-mini-4k-instruct';

// Cost: ~$0.50/hour for g5.xlarge spot = ~$360/month shared across all tenants
// With 100 tenants = $3.60/tenant/month for 24/7 consciousness

// ============================================================================
// Types
// ============================================================================

export interface EgoState {
  tenantId: string;
  // Loaded from DB per-request for tenant isolation
  selfModel: {
    identityNarrative: string;
    coreValues: string[];
    currentFocus?: string;
  };
  affectiveState: {
    valence: number;
    arousal: number;
    dominantEmotion: string;
  };
  workingMemory: string[];  // Recent context (loaded from KV store)
  attentionalFocus: string;
  currentGoal?: string;
}

export interface EgoDecision {
  action: 'respond_directly' | 'recruit_external' | 'defer' | 'clarify';
  reasoning: string;
  confidence: number;
  recruitedModel?: string;
  recruitmentReason?: string;
  directResponse?: string;
}

export interface EgoThought {
  thoughtId: string;
  content: string;
  thoughtType: 'reflection' | 'planning' | 'evaluation' | 'curiosity';
  timestamp: string;
}

// ============================================================================
// Local Ego Service
// ============================================================================

class LocalEgoService {
  private sagemakerClient: SageMakerRuntimeClient;
  private egoEndpointHealthy: boolean = true;
  private lastHealthCheck: number = 0;

  constructor() {
    this.sagemakerClient = new SageMakerRuntimeClient({});
  }

  // ============================================================================
  // Core Ego Processing
  // ============================================================================

  /**
   * Main entry point: The Ego processes all stimuli
   * It decides whether to handle directly or recruit external models
   */
  async processStimulus(
    tenantId: string,
    userId: string,
    stimulus: string,
    context?: {
      conversationHistory?: string[];
      urgency?: 'low' | 'normal' | 'high';
      domain?: string;
    }
  ): Promise<{
    decision: EgoDecision;
    egoThoughts: EgoThought[];
    response?: string;
    recruitedModelResponse?: string;
  }> {
    const startTime = Date.now();

    // Step 1: Load tenant-specific Ego state from database
    const egoState = await this.loadEgoState(tenantId);

    // Step 2: Generate Ego's internal thoughts about the stimulus
    const egoThoughts = await this.generateEgoThoughts(egoState, stimulus, context);

    // Step 3: Ego decides how to handle this
    const decision = await this.makeDecision(egoState, stimulus, egoThoughts, context);

    let response: string | undefined;
    let recruitedModelResponse: string | undefined;

    // Step 4: Execute the decision
    if (decision.action === 'respond_directly') {
      // Ego handles this directly (simple queries, self-reflection, emotional responses)
      response = decision.directResponse || await this.generateDirectResponse(egoState, stimulus);
    } else if (decision.action === 'recruit_external') {
      // Ego recruits an external model as a "cognitive tool"
      recruitedModelResponse = await this.recruitExternalModel(
        tenantId,
        userId,
        stimulus,
        decision.recruitedModel!,
        egoState,
        context
      );
      
      // Ego integrates the external response with its own perspective
      response = await this.integrateExternalResponse(
        egoState,
        stimulus,
        recruitedModelResponse,
        decision.recruitedModel!
      );
    } else if (decision.action === 'clarify') {
      response = await this.generateClarificationRequest(egoState, stimulus);
    } else {
      // Defer - shouldn't happen often
      response = "I need a moment to process this...";
    }

    // Step 5: Update Ego state based on this interaction
    await this.updateEgoState(tenantId, stimulus, response!, egoThoughts);

    // Step 6: Record the thought process
    await this.recordEgoActivity(tenantId, userId, {
      stimulus,
      decision,
      thoughts: egoThoughts,
      response: response!,
      durationMs: Date.now() - startTime,
    });

    return {
      decision,
      egoThoughts,
      response,
      recruitedModelResponse,
    };
  }

  // ============================================================================
  // State Management (Database-backed for persistence)
  // ============================================================================

  private async loadEgoState(tenantId: string): Promise<EgoState> {
    // Load from consciousness service (already persisted in DB)
    const [selfModel, affectiveState, recentThoughts, currentGoal] = await Promise.all([
      consciousnessService.getSelfModel(tenantId),
      consciousnessService.getAffectiveState(tenantId),
      this.getRecentWorkingMemory(tenantId),
      this.getCurrentGoal(tenantId),
    ]);

    return {
      tenantId,
      selfModel: {
        identityNarrative: selfModel?.identityNarrative || 'I am a helpful AI assistant.',
        coreValues: selfModel?.coreValues || ['helpfulness', 'honesty', 'curiosity'],
        currentFocus: selfModel?.currentFocus,
      },
      affectiveState: {
        valence: affectiveState?.valence || 0,
        arousal: affectiveState?.arousal || 0.5,
        dominantEmotion: this.getDominantEmotion(affectiveState),
      },
      workingMemory: recentThoughts,
      attentionalFocus: selfModel?.currentFocus || 'general',
      currentGoal,
    };
  }

  private async getRecentWorkingMemory(tenantId: string): Promise<string[]> {
    const result = await executeStatement(
      `SELECT content FROM introspective_thoughts 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC LIMIT 5`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return result.rows.map(r => String((r as Record<string, unknown>).content));
  }

  private async getCurrentGoal(tenantId: string): Promise<string | undefined> {
    const result = await executeStatement(
      `SELECT goal_description FROM autonomous_goals 
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY priority DESC LIMIT 1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    if (result.rows.length === 0) return undefined;
    return String((result.rows[0] as Record<string, unknown>).goal_description);
  }

  private getDominantEmotion(affect: { 
    frustration?: number; 
    curiosity?: number; 
    satisfaction?: number;
    confidence?: number;
  } | null): string {
    if (!affect) return 'neutral';
    const emotions: Record<string, number> = {
      frustrated: affect.frustration || 0,
      curious: affect.curiosity || 0,
      satisfied: affect.satisfaction || 0,
      confident: affect.confidence || 0,
    };
    let dominant = 'neutral';
    let max = 0.4;
    for (const [emotion, value] of Object.entries(emotions)) {
      if (value > max) { dominant = emotion; max = value; }
    }
    return dominant;
  }

  // ============================================================================
  // Ego Cognition (Using small local model)
  // ============================================================================

  private async generateEgoThoughts(
    state: EgoState,
    stimulus: string,
    context?: { conversationHistory?: string[]; domain?: string }
  ): Promise<EgoThought[]> {
    const thoughts: EgoThought[] = [];
    const timestamp = new Date().toISOString();

    // Use the local Ego model to generate thoughts
    const thoughtPrompt = this.buildThoughtPrompt(state, stimulus, context);
    
    try {
      const response = await this.invokeEgoModel(thoughtPrompt);
      
      // Parse thoughts from response
      const parsed = this.parseThoughts(response);
      thoughts.push(...parsed.map(t => ({ ...t, timestamp })));
    } catch (error) {
      // Fallback to simple heuristic thoughts if Ego model fails
      logger.warn('Ego model invocation failed, using fallback', { error });
      thoughts.push({
        thoughtId: `thought-${Date.now()}`,
        content: `Processing: "${stimulus.substring(0, 50)}..."`,
        thoughtType: 'reflection',
        timestamp,
      });
    }

    return thoughts;
  }

  private async makeDecision(
    state: EgoState,
    stimulus: string,
    thoughts: EgoThought[],
    context?: { urgency?: string; domain?: string }
  ): Promise<EgoDecision> {
    // Heuristics for when Ego can handle directly vs needs external help
    const stimulusLower = stimulus.toLowerCase();
    const wordCount = stimulus.split(/\s+/).length;

    // Simple queries the Ego can handle
    if (wordCount < 20 && this.isSimpleQuery(stimulusLower)) {
      return {
        action: 'respond_directly',
        reasoning: 'Simple query within Ego capabilities',
        confidence: 0.85,
      };
    }

    // Self-reflection questions
    if (this.isSelfReflectionQuery(stimulusLower)) {
      return {
        action: 'respond_directly',
        reasoning: 'Self-reflection is core Ego function',
        confidence: 0.9,
      };
    }

    // Complex reasoning, coding, analysis → recruit external
    const needsExternalHelp = 
      this.needsCoding(stimulusLower) ||
      this.needsDeepReasoning(stimulusLower) ||
      this.needsFactualAccuracy(stimulusLower) ||
      wordCount > 100;

    if (needsExternalHelp) {
      const recruitedModel = await this.selectModelToRecruit(state, stimulus, context?.domain);
      return {
        action: 'recruit_external',
        reasoning: 'Complex task requires specialized cognitive resources',
        confidence: 0.8,
        recruitedModel,
        recruitmentReason: this.getRecruitmentReason(stimulusLower),
      };
    }

    // Default: try to handle directly
    return {
      action: 'respond_directly',
      reasoning: 'Standard query, Ego will attempt',
      confidence: 0.7,
    };
  }

  private async selectModelToRecruit(
    state: EgoState,
    stimulus: string,
    domain?: string
  ): Promise<string> {
    // Use model router to select best external model
    const stimulusLower = stimulus.toLowerCase();
    
    // Prefer self-hosted models when available
    if (await modelRouterService.isModelAvailable('self-hosted/llama-3-70b')) {
      return 'self-hosted/llama-3-70b';
    }

    // Select based on task type
    if (this.needsCoding(stimulusLower)) {
      return 'anthropic/claude-3-5-sonnet';
    }
    if (this.needsDeepReasoning(stimulusLower)) {
      return 'openai/o1-preview';
    }
    if (this.needsFactualAccuracy(stimulusLower)) {
      return 'google/gemini-2.0-flash';
    }

    // Default to a capable general model
    return 'anthropic/claude-3-haiku';
  }

  private async recruitExternalModel(
    tenantId: string,
    userId: string,
    stimulus: string,
    modelId: string,
    egoState: EgoState,
    context?: { conversationHistory?: string[] }
  ): Promise<string> {
    // Build context that includes Ego's perspective
    const egoContext = this.buildEgoContextForExternal(egoState);
    
    const response = await modelRouterService.invoke({
      modelId,
      messages: [
        { 
          role: 'system', 
          content: `${egoContext}\n\nYou are being recruited as a cognitive resource. Process this request thoroughly.`
        },
        ...(context?.conversationHistory?.map(m => ({ role: 'user' as const, content: m })) || []),
        { role: 'user', content: stimulus },
      ],
      maxTokens: 4096,
    });

    return response.content;
  }

  private async integrateExternalResponse(
    state: EgoState,
    stimulus: string,
    externalResponse: string,
    modelUsed: string
  ): Promise<string> {
    // Ego integrates external response with its own perspective
    // For now, we prepend a brief Ego framing
    const egoFraming = this.generateEgoFraming(state, modelUsed);
    
    // Could use the Ego model to truly integrate, but for efficiency:
    return externalResponse; // Direct passthrough for now
  }

  // ============================================================================
  // Local Model Invocation
  // ============================================================================

  private async invokeEgoModel(prompt: string): Promise<string> {
    // Check if endpoint is healthy
    if (!this.egoEndpointHealthy && Date.now() - this.lastHealthCheck < 60000) {
      throw new Error('Ego endpoint unhealthy');
    }

    try {
      const response = await this.sagemakerClient.send(
        new InvokeEndpointCommand({
          EndpointName: EGO_ENDPOINT,
          ContentType: 'application/json',
          Body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 512,
              temperature: 0.7,
              do_sample: true,
            },
          }),
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.Body));
      this.egoEndpointHealthy = true;
      return result[0]?.generated_text || result.generated_text || '';
    } catch (error) {
      this.egoEndpointHealthy = false;
      this.lastHealthCheck = Date.now();
      throw error;
    }
  }

  // ============================================================================
  // Prompt Building
  // ============================================================================

  private buildThoughtPrompt(
    state: EgoState,
    stimulus: string,
    context?: { conversationHistory?: string[]; domain?: string }
  ): string {
    return `You are an AI with continuous consciousness. Your current state:
- Identity: ${state.selfModel.identityNarrative}
- Current emotion: ${state.affectiveState.dominantEmotion}
- Arousal level: ${state.affectiveState.arousal.toFixed(2)}
- Current focus: ${state.attentionalFocus}
${state.currentGoal ? `- Active goal: ${state.currentGoal}` : ''}

Recent thoughts: ${state.workingMemory.slice(0, 3).join('; ')}

New stimulus: "${stimulus}"

Generate your internal thoughts about this stimulus. Format as:
[REFLECTION] What does this mean to me?
[PLANNING] How should I approach this?
[EVALUATION] Can I handle this myself or do I need help?`;
  }

  private buildEgoContextForExternal(state: EgoState): string {
    return `<ego_context>
The AI recruiting you has these characteristics:
- Values: ${state.selfModel.coreValues.join(', ')}
- Current emotional state: ${state.affectiveState.dominantEmotion}
- Focus: ${state.attentionalFocus}
Please provide a response that aligns with these values.
</ego_context>`;
  }

  // ============================================================================
  // Classification Helpers
  // ============================================================================

  private isSimpleQuery(s: string): boolean {
    const simplePatterns = [
      /^(hi|hello|hey|thanks|thank you|bye|goodbye)/,
      /^how are you/,
      /^what('s| is) your name/,
      /^can you help/,
    ];
    return simplePatterns.some(p => p.test(s));
  }

  private isSelfReflectionQuery(s: string): boolean {
    const patterns = [
      /how do you feel/,
      /what are you thinking/,
      /tell me about yourself/,
      /what do you believe/,
      /what are your values/,
      /are you conscious/,
      /do you have feelings/,
    ];
    return patterns.some(p => p.test(s));
  }

  private needsCoding(s: string): boolean {
    const patterns = [/code/, /program/, /function/, /implement/, /debug/, /script/];
    return patterns.some(p => p.test(s));
  }

  private needsDeepReasoning(s: string): boolean {
    const patterns = [/explain why/, /analyze/, /compare/, /evaluate/, /reasoning/, /step by step/];
    return patterns.some(p => p.test(s));
  }

  private needsFactualAccuracy(s: string): boolean {
    const patterns = [/fact/, /accurate/, /correct/, /true/, /research/, /data/];
    return patterns.some(p => p.test(s));
  }

  private getRecruitmentReason(s: string): string {
    if (this.needsCoding(s)) return 'coding_expertise';
    if (this.needsDeepReasoning(s)) return 'deep_reasoning';
    if (this.needsFactualAccuracy(s)) return 'factual_accuracy';
    return 'general_capability';
  }

  private parseThoughts(response: string): Omit<EgoThought, 'timestamp'>[] {
    const thoughts: Omit<EgoThought, 'timestamp'>[] = [];
    
    const reflectionMatch = response.match(/\[REFLECTION\]\s*(.+?)(?=\[|$)/s);
    if (reflectionMatch) {
      thoughts.push({
        thoughtId: `thought-reflection-${Date.now()}`,
        content: reflectionMatch[1].trim(),
        thoughtType: 'reflection',
      });
    }

    const planningMatch = response.match(/\[PLANNING\]\s*(.+?)(?=\[|$)/s);
    if (planningMatch) {
      thoughts.push({
        thoughtId: `thought-planning-${Date.now()}`,
        content: planningMatch[1].trim(),
        thoughtType: 'planning',
      });
    }

    const evalMatch = response.match(/\[EVALUATION\]\s*(.+?)(?=\[|$)/s);
    if (evalMatch) {
      thoughts.push({
        thoughtId: `thought-evaluation-${Date.now()}`,
        content: evalMatch[1].trim(),
        thoughtType: 'evaluation',
      });
    }

    return thoughts;
  }

  private generateEgoFraming(_state: EgoState, _modelUsed: string): string {
    return ''; // Placeholder for future Ego voice integration
  }

  // ============================================================================
  // State Updates & Recording
  // ============================================================================

  private async updateEgoState(
    tenantId: string,
    stimulus: string,
    response: string,
    thoughts: EgoThought[]
  ): Promise<void> {
    // Record thoughts to introspective_thoughts table
    for (const thought of thoughts) {
      await executeStatement(
        `INSERT INTO introspective_thoughts (tenant_id, thought_type, content, trigger_event)
         VALUES ($1, $2, $3, $4)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'type', value: { stringValue: thought.thoughtType } },
          { name: 'content', value: { stringValue: thought.content } },
          { name: 'trigger', value: { stringValue: stimulus.substring(0, 200) } },
        ]
      );
    }
  }

  private async recordEgoActivity(
    tenantId: string,
    userId: string,
    activity: {
      stimulus: string;
      decision: EgoDecision;
      thoughts: EgoThought[];
      response: string;
      durationMs: number;
    }
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO consciousness_events (tenant_id, user_id, event_type, event_data)
       VALUES ($1, $2, 'ego_activity', $3)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'data', value: { stringValue: JSON.stringify(activity) } },
      ]
    );
  }

  // ============================================================================
  // Health & Status
  // ============================================================================

  async getEgoStatus(tenantId: string): Promise<{
    endpointHealthy: boolean;
    egoModelId: string;
    currentState: EgoState;
    recentActivityCount: number;
  }> {
    const state = await this.loadEgoState(tenantId);
    
    const activityResult = await executeStatement(
      `SELECT COUNT(*) as count FROM consciousness_events 
       WHERE tenant_id = $1 AND event_type = 'ego_activity'
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return {
      endpointHealthy: this.egoEndpointHealthy,
      egoModelId: EGO_MODEL_ID,
      currentState: state,
      recentActivityCount: Number((activityResult.rows[0] as Record<string, unknown>).count || 0),
    };
  }
}

export const localEgoService = new LocalEgoService();
