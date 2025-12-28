/**
 * RADIANT v4.18.0 - Delight Orchestration Integration Service
 * Connects AGI Brain Planner with Delight System for contextual personality
 */

import { delightService, type OrchestrationDelightContext, type DelightMessageResponse, type TimeContext } from './delight.service';
import type { AGIBrainPlan, PlanStep, OrchestrationMode, StepType } from './agi-brain-planner.service';
import { enhancedLogger } from '../logging/enhanced-logger';

const logger = enhancedLogger;

// ============================================================================
// Types
// ============================================================================

export interface DelightWorkflowEvent {
  eventType: 'step_start' | 'step_complete' | 'plan_start' | 'plan_complete' | 'model_selected' | 'domain_detected' | 'consensus_reached' | 'disagreement' | 'thinking';
  plan: AGIBrainPlan;
  step?: PlanStep;
  metadata?: Record<string, unknown>;
}

export interface WorkflowDelightResponse {
  messages: DelightMessageResponse[];
  achievements?: Array<{ id: string; name: string; celebrationMessage: string }>;
  soundEffect?: string;
}

// Step type to trigger type mapping
const STEP_TRIGGER_MAP: Record<StepType, string> = {
  analyze: 'complexity_signals',
  detect_domain: 'domain_loading',
  select_model: 'model_dynamics',
  prepare_context: 'complexity_signals',
  ethics_check: 'complexity_signals',
  generate: 'model_dynamics',
  synthesize: 'synthesis_quality',
  verify: 'model_dynamics',
  refine: 'complexity_signals',
  calibrate: 'model_dynamics',
  reflect: 'synthesis_quality',
};

// Orchestration mode to domain family mapping
const MODE_DOMAIN_MAP: Record<OrchestrationMode, string> = {
  thinking: 'reasoning',
  extended_thinking: 'philosophy',
  coding: 'programming',
  creative: 'creative',
  research: 'research',
  analysis: 'analysis',
  multi_model: 'general',
  chain_of_thought: 'reasoning',
  self_consistency: 'verification',
};

// Step-specific messages
const STEP_MESSAGES: Record<StepType, string[]> = {
  analyze: [
    'Parsing your request...',
    'Understanding the nuances...',
    'Examining the structure...',
  ],
  detect_domain: [
    'Identifying the knowledge domain...',
    'Routing to the right expertise...',
    'Matching domain proficiencies...',
  ],
  select_model: [
    'Selecting the best model...',
    'Assembling the dream team...',
    'Matching model strengths...',
  ],
  prepare_context: [
    'Loading relevant context...',
    'Gathering background knowledge...',
    'Preparing the knowledge base...',
  ],
  ethics_check: [
    'Evaluating ethical considerations...',
    'Checking moral compass...',
    'Ensuring responsible response...',
  ],
  generate: [
    'Generating response...',
    'Crafting the answer...',
    'Synthesizing insights...',
  ],
  synthesize: [
    'Synthesizing multiple perspectives...',
    'Merging model outputs...',
    'Building consensus...',
  ],
  verify: [
    'Verifying accuracy...',
    'Cross-checking facts...',
    'Validating the response...',
  ],
  refine: [
    'Refining the response...',
    'Polishing the output...',
    'Fine-tuning details...',
  ],
  calibrate: [
    'Calibrating confidence...',
    'Assessing certainty...',
    'Adjusting confidence levels...',
  ],
  reflect: [
    'Reflecting on quality...',
    'Self-evaluation in progress...',
    'Metacognition active...',
  ],
};

// Mode-specific loading messages
const MODE_MESSAGES: Record<OrchestrationMode, string[]> = {
  thinking: [
    'Standard reasoning engaged...',
    'Thinking through the problem...',
  ],
  extended_thinking: [
    'Deep thinking mode activated...',
    'Taking time for thorough analysis...',
    'Extended reasoning in progress...',
  ],
  coding: [
    'Code generation mode engaged...',
    'Compiling the solution...',
    'Debugging approach in progress...',
  ],
  creative: [
    'Creative mode unleashed...',
    'Imagination flowing...',
    'Artistic neurons firing...',
  ],
  research: [
    'Research synthesis mode...',
    'Gathering scholarly insights...',
    'Academic analysis engaged...',
  ],
  analysis: [
    'Quantitative analysis mode...',
    'Crunching the numbers...',
    'Statistical engines running...',
  ],
  multi_model: [
    'Consulting multiple models...',
    'Ensemble thinking engaged...',
    'Gathering diverse perspectives...',
  ],
  chain_of_thought: [
    'Chain of thought reasoning...',
    'Step-by-step logic engaged...',
    'Breaking down the reasoning...',
  ],
  self_consistency: [
    'Running multiple samples...',
    'Consistency checking...',
    'Validating across approaches...',
  ],
};

// ============================================================================
// Service Implementation
// ============================================================================

class DelightOrchestrationService {
  private sessionStartTimes: Map<string, number> = new Map();
  private previousDomains: Map<string, string> = new Map();

  /**
   * Get delight messages for a workflow event
   */
  async getDelightForEvent(
    event: DelightWorkflowEvent,
    userId: string,
    tenantId: string
  ): Promise<WorkflowDelightResponse> {
    try {
      const context = this.buildOrchestrationContext(event, userId);
      const messages = await delightService.getMessagesForOrchestration(context, userId, tenantId);

      // Add step-specific message if applicable
      if (event.step && event.eventType === 'step_start') {
        const stepMessage = await this.getStepMessage(event, userId, tenantId);
        if (stepMessage) {
          messages.unshift(stepMessage);
        }
      }

      // Add mode-specific message at plan start
      if (event.eventType === 'plan_start') {
        const modeMessage = await this.getModeMessage(event, userId, tenantId);
        if (modeMessage) {
          messages.unshift(modeMessage);
        }
      }

      // Check for achievements on plan completion
      let achievements: Array<{ id: string; name: string; celebrationMessage: string }> | undefined;
      if (event.eventType === 'plan_complete') {
        achievements = await this.checkAchievements(event, userId, tenantId);
      }

      // Get appropriate sound effect
      const soundEffect = this.getSoundForEvent(event);

      return {
        messages,
        achievements,
        soundEffect,
      };
    } catch (error) {
      logger.error('Failed to get delight for event', { error, eventType: event.eventType });
      return { messages: [] };
    }
  }

  /**
   * Build orchestration context from workflow event
   */
  private buildOrchestrationContext(event: DelightWorkflowEvent, userId: string): OrchestrationDelightContext {
    const plan = event.plan;
    const sessionId = plan.sessionId || plan.planId;

    // Track session start time
    if (!this.sessionStartTimes.has(sessionId)) {
      this.sessionStartTimes.set(sessionId, Date.now());
    }
    const sessionDuration = (Date.now() - this.sessionStartTimes.get(sessionId)!) / 60000;

    // Determine current phase based on event type
    let currentPhase: 'pre_execution' | 'during_execution' | 'post_execution';
    if (event.eventType === 'plan_start') {
      currentPhase = 'pre_execution';
    } else if (event.eventType === 'plan_complete') {
      currentPhase = 'post_execution';
    } else {
      currentPhase = 'during_execution';
    }

    // Get domain info
    const currentDomain = plan.domainDetection?.domainName || MODE_DOMAIN_MAP[plan.orchestrationMode];
    const previousDomain = this.previousDomains.get(userId);
    const isDomainSwitch = previousDomain !== undefined && previousDomain !== currentDomain;
    
    if (currentDomain) {
      this.previousDomains.set(userId, currentDomain);
    }

    // Determine time of day
    const hour = new Date().getHours();
    let timeOfDay: TimeContext;
    if (hour >= 0 && hour < 6) timeOfDay = 'night';
    else if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    // Check for long session
    if (sessionDuration > 120) timeOfDay = 'long_session';

    return {
      sessionId,
      currentPhase,
      domainInfo: {
        currentDomain,
        previousDomain: previousDomain || null,
        isDomainSwitch,
      },
      modelInfo: {
        activeModels: [plan.primaryModel.modelId, ...plan.fallbackModels.map(m => m.modelId)],
        consensusLevel: this.getConsensusLevel(event),
        leadingModel: plan.primaryModel.modelName,
      },
      timeInfo: {
        sessionDurationMinutes: Math.round(sessionDuration),
        timeOfDay,
        isWeekend: [0, 6].includes(new Date().getDay()),
      },
      queryInfo: {
        complexity: plan.promptAnalysis.complexity === 'expert' ? 'complex' : plan.promptAnalysis.complexity,
        isMultiPart: plan.promptAnalysis.requiresMultiStep,
        isNovel: plan.steps.length > 5,
      },
    };
  }

  /**
   * Get a contextual message for a specific step
   */
  private async getStepMessage(
    event: DelightWorkflowEvent,
    userId: string,
    tenantId: string
  ): Promise<DelightMessageResponse | null> {
    if (!event.step) return null;

    const stepType = event.step.stepType;
    const messages = STEP_MESSAGES[stepType];
    
    if (!messages || messages.length === 0) return null;

    // Try to get from delight service first
    const triggerType = STEP_TRIGGER_MAP[stepType] as Parameters<typeof delightService.getDelightMessage>[1];
    const response = await delightService.getDelightMessage(
      'during_execution',
      triggerType,
      userId,
      tenantId
    );

    if (response.message) {
      return response;
    }

    // Fallback to hardcoded step message
    const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
    return {
      message: null,
      selectedText: selectedMessage,
    };
  }

  /**
   * Get a contextual message for the orchestration mode
   */
  private async getModeMessage(
    event: DelightWorkflowEvent,
    userId: string,
    tenantId: string
  ): Promise<DelightMessageResponse | null> {
    const mode = event.plan.orchestrationMode;
    const domainFamily = MODE_DOMAIN_MAP[mode];

    // Try to get from delight service
    const response = await delightService.getDelightMessage(
      'pre_execution',
      'domain_loading',
      userId,
      tenantId,
      { domainFamily }
    );

    if (response.message) {
      return response;
    }

    // Fallback to mode-specific message
    const messages = MODE_MESSAGES[mode];
    if (!messages || messages.length === 0) return null;

    const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
    return {
      message: null,
      selectedText: selectedMessage,
    };
  }

  /**
   * Check and record achievements after plan completion
   */
  private async checkAchievements(
    event: DelightWorkflowEvent,
    userId: string,
    tenantId: string
  ): Promise<Array<{ id: string; name: string; celebrationMessage: string }>> {
    const achievements: Array<{ id: string; name: string; celebrationMessage: string }> = [];

    try {
      // Record query completion
      const queryResult = await delightService.recordAchievementProgress(userId, tenantId, 'queries_count', 1);
      queryResult.justUnlocked.forEach(a => {
        achievements.push({
          id: a.id,
          name: a.name,
          celebrationMessage: a.celebrationMessage || `Achievement unlocked: ${a.name}!`,
        });
      });

      // Record domain exploration
      if (event.plan.domainDetection) {
        const domainResult = await delightService.recordAchievementProgress(userId, tenantId, 'domain_explorer', 1);
        domainResult.justUnlocked.forEach(a => {
          achievements.push({
            id: a.id,
            name: a.name,
            celebrationMessage: a.celebrationMessage || `Achievement unlocked: ${a.name}!`,
          });
        });
      }

      // Record complexity achievement for complex queries
      if (event.plan.promptAnalysis.complexity === 'complex' || event.plan.promptAnalysis.complexity === 'expert') {
        const complexityResult = await delightService.recordAchievementProgress(userId, tenantId, 'complexity', 1);
        complexityResult.justUnlocked.forEach(a => {
          achievements.push({
            id: a.id,
            name: a.name,
            celebrationMessage: a.celebrationMessage || `Achievement unlocked: ${a.name}!`,
          });
        });
      }

      // Record time spent (estimate 30 seconds per step)
      const minutesSpent = Math.ceil((event.plan.steps.length * 30) / 60);
      await delightService.recordAchievementProgress(userId, tenantId, 'time_spent', minutesSpent);

    } catch (error) {
      logger.debug('Failed to check achievements', { error });
    }

    return achievements;
  }

  /**
   * Get the appropriate sound effect for an event
   */
  private getSoundForEvent(event: DelightWorkflowEvent): string | undefined {
    switch (event.eventType) {
      case 'plan_start':
        return 'transition_whoosh';
      case 'plan_complete':
        return 'confirm_chime';
      case 'step_complete':
        return 'confirm_subtle';
      case 'consensus_reached':
        return 'consensus_ping';
      case 'model_selected':
        return 'confirm_subtle';
      default:
        return undefined;
    }
  }

  /**
   * Determine consensus level from event metadata
   */
  private getConsensusLevel(event: DelightWorkflowEvent): 'strong' | 'moderate' | 'divergent' {
    if (event.eventType === 'consensus_reached') return 'strong';
    if (event.eventType === 'disagreement') return 'divergent';
    
    // Default based on orchestration mode
    if (event.plan.orchestrationMode === 'multi_model') return 'moderate';
    if (event.plan.orchestrationMode === 'self_consistency') return 'strong';
    
    return 'moderate';
  }

  /**
   * Create contextual message based on current plan state
   */
  getContextualMessage(plan: AGIBrainPlan): string {
    const step = plan.steps[plan.currentStepIndex];
    if (!step) {
      return plan.status === 'completed' 
        ? 'Response complete!' 
        : 'Processing...';
    }

    // Get step-specific message
    const messages = STEP_MESSAGES[step.stepType];
    if (messages && messages.length > 0) {
      return messages[Math.floor(Math.random() * messages.length)];
    }

    // Fallback based on step type
    return step.description || `${step.title}...`;
  }

  /**
   * Get domain-aware loading message
   */
  getDomainLoadingMessage(plan: AGIBrainPlan): string {
    const domain = plan.domainDetection?.domainName?.toLowerCase();
    
    const domainMessages: Record<string, string[]> = {
      physics: ['Consulting the fundamental forces...', 'Collapsing the wave function...'],
      chemistry: ['Balancing the equations...', 'Analyzing molecular structure...'],
      biology: ['Sequencing the knowledge base...', 'Consulting the genetic library...'],
      medicine: ['Reviewing the differential...', 'Consulting clinical evidence...'],
      programming: ['Compiling the solution...', 'Debugging the approach...'],
      law: ['Reviewing case law...', 'Consulting legal precedent...'],
      finance: ['Crunching the numbers...', 'Running projections...'],
      philosophy: ['Contemplating the question...', 'Examining the premises...'],
      cooking: ['Gathering the ingredients...', 'Preheating the knowledge base...'],
      music: ['Tuning the harmonics...', 'Setting the tempo...'],
      art: ['Composing the palette...', 'Sketching the concept...'],
    };

    const messages = domain ? domainMessages[domain] : null;
    if (messages && messages.length > 0) {
      return messages[Math.floor(Math.random() * messages.length)];
    }

    // Generic message based on mode
    const modeMessages = MODE_MESSAGES[plan.orchestrationMode];
    if (modeMessages && modeMessages.length > 0) {
      return modeMessages[Math.floor(Math.random() * modeMessages.length)];
    }

    return 'Thinking...';
  }

  /**
   * Get model dynamics message based on consensus state
   */
  getModelDynamicsMessage(consensusLevel: 'strong' | 'moderate' | 'divergent'): string {
    const messages: Record<string, string[]> = {
      strong: [
        'Consensus forming...',
        'The models agree on this one.',
        'Strong agreement across the board.',
      ],
      moderate: [
        'Cross-checking perspectives...',
        'Balancing different viewpoints...',
        'Models discussing the approach...',
      ],
      divergent: [
        'The models are debating this one.',
        'Interesting disagreement emerging.',
        'Multiple perspectives at play.',
      ],
    };

    const options = messages[consensusLevel];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Get synthesis quality message
   */
  getSynthesisMessage(confidence: number): string {
    if (confidence >= 0.9) {
      return 'High confidence on this one.';
    } else if (confidence >= 0.7) {
      return 'Solid synthesis achieved.';
    } else if (confidence >= 0.5) {
      return 'Some nuance worth noting.';
    } else {
      return 'This is a complex area with varying perspectives.';
    }
  }

  /**
   * Clear session tracking for a user
   */
  clearSession(userId: string): void {
    this.previousDomains.delete(userId);
    // Note: Session times are keyed by sessionId, not userId
  }
}

export const delightOrchestrationService = new DelightOrchestrationService();
export { DelightOrchestrationService };
