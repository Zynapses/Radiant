/**
 * Scout Persona → HITL Orchestration Integration
 * 
 * Bridges Cato's Scout persona (epistemic uncertainty mode) to the enhanced
 * HITL Orchestration system. When Scout detects uncertain aspects, this service
 * generates VOI-filtered clarification questions through the HITL pipeline.
 * 
 * FLOW:
 * 1. Scout persona activates due to epistemic uncertainty
 * 2. ScoutHITLIntegration generates prioritized clarification questions
 * 3. Questions are filtered through VOI scoring
 * 4. High-VOI questions go to HITL, low-VOI get assumptions
 * 5. Responses reduce uncertainty, allowing Scout to proceed
 * 
 * @see PROMPT-37 HITL Orchestration Enhancements
 * @see Cato Persona Service (Scout mood)
 */

import { PersonaService } from './persona.service';
import { VOIService, VOIDecision } from '../hitl-orchestration/voi.service';
import { MCPElicitationService, AskUserRequest, AskUserResponse } from '../hitl-orchestration/mcp-elicitation.service';
import { query } from '../database';

// ============================================================================
// TYPES
// ============================================================================

export type Domain = 'medical' | 'financial' | 'legal' | 'bioinformatics' | 'general';

export interface UncertaintyState {
  epistemicUncertainty: number;  // 0-1 scale
  uncertainAspects: string[];    // e.g., ['safety', 'compliance', 'cost']
  proposedAction: string;        // What the agent wants to do
  domain: Domain;
  sessionId: string;
  userId: string;
}

export interface ClarificationResponse {
  aspect: string;
  question: string;
  response: unknown;
  status: 'answered' | 'skipped' | 'expired' | 'cached';
  assumptionMade?: string;
  voiScore: number;
}

export interface ClarificationResult {
  questionsAsked: ClarificationResponse[];
  assumedAspects: Array<{ aspect: string; assumption: string }>;
  remainingUncertainty: number;
  proceedRecommendation: 'proceed' | 'wait' | 'abort';
}

export interface AspectImpactConfig {
  baseImpact: number;
  domainBoosts: Domain[];
}

interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// ASPECT CONFIGURATION
// ============================================================================

/**
 * Impact scores for different uncertainty aspects.
 * Higher impact = more likely to ask the user.
 */
const ASPECT_IMPACTS: Record<string, AspectImpactConfig> = {
  safety: { baseImpact: 0.95, domainBoosts: ['medical', 'bioinformatics'] },
  compliance: { baseImpact: 0.90, domainBoosts: ['medical', 'financial', 'legal'] },
  irreversible: { baseImpact: 0.85, domainBoosts: [] },
  cost: { baseImpact: 0.70, domainBoosts: ['financial'] },
  user_preference: { baseImpact: 0.60, domainBoosts: [] },
  technical_requirement: { baseImpact: 0.50, domainBoosts: ['bioinformatics'] },
  style: { baseImpact: 0.30, domainBoosts: [] },
  formatting: { baseImpact: 0.20, domainBoosts: [] },
  minor_detail: { baseImpact: 0.10, domainBoosts: [] },
};

/**
 * Question templates by aspect type
 */
const QUESTION_TEMPLATES: Record<string, (action: string) => string> = {
  safety: (action) =>
    `Before proceeding with "${action}", I need to verify: Are there any safety considerations I should be aware of?`,
  compliance: (action) =>
    `To ensure compliance, does "${action}" require any specific approvals or certifications?`,
  cost: (action) =>
    `"${action}" may have cost implications. What budget constraints should I consider?`,
  user_preference: (action) =>
    `For "${action}", do you have a preference for how this should be handled?`,
  technical_requirement: (action) =>
    `I need clarification on the technical requirements for "${action}". Can you specify?`,
  irreversible: (action) =>
    `"${action}" cannot be easily undone. Are you sure you want to proceed?`,
  style: (action) =>
    `For "${action}", should I use any particular style or format?`,
  formatting: (action) =>
    `How would you like the output formatted for "${action}"?`,
  minor_detail: (action) =>
    `A small clarification about "${action}": `,
};

/**
 * Default assumptions when skipping questions
 */
const DEFAULT_ASSUMPTIONS: Record<string, string> = {
  style: 'Using standard formatting and style conventions',
  formatting: 'Applying default formatting rules',
  minor_detail: 'Proceeding with reasonable defaults for minor details',
  user_preference: 'Using commonly preferred approach',
  technical_requirement: 'Following standard technical practices',
  cost: 'Proceeding with cost-efficient approach',
  safety: 'Applying maximum safety precautions',
  compliance: 'Following strictest applicable compliance requirements',
  irreversible: 'Proceeding with caution and creating recovery point',
};

// ============================================================================
// SERVICE
// ============================================================================

export class ScoutHITLIntegration {
  constructor(
    private readonly personaService: PersonaService,
    private readonly voiService: VOIService,
    private readonly mcpElicitation: MCPElicitationService,
    private readonly logger: Logger
  ) {}

  /**
   * Generate clarification questions based on Scout's epistemic state.
   * 
   * This is the main entry point when Cato switches to Scout persona
   * due to epistemic uncertainty.
   */
  async generateClarificationQuestions(
    tenantId: string,
    state: UncertaintyState
  ): Promise<ClarificationResult> {
    this.logger.info('Scout generating clarification questions', {
      sessionId: state.sessionId,
      epistemicUncertainty: state.epistemicUncertainty,
      uncertainAspects: state.uncertainAspects,
      domain: state.domain,
    });

    // Verify Scout persona is active
    const currentPersona = await this.personaService.getEffectivePersona(
      state.sessionId,
      state.userId,
      tenantId
    );

    if (currentPersona.name !== 'scout') {
      this.logger.warn('Scout clarification requested but Scout persona not active', {
        currentPersona: currentPersona.name,
        sessionId: state.sessionId,
      });
    }

    // Get questions asked count for two-question rule
    const questionsAskedCount = await this.getSessionQuestionCount(
      tenantId,
      state.sessionId
    );

    // Prioritize aspects by impact for this domain
    const prioritizedAspects = this.prioritizeAspects(
      state.uncertainAspects,
      state.domain
    );

    // Generate questions for prioritized aspects
    const questionsAsked: ClarificationResponse[] = [];
    const assumedAspects: Array<{ aspect: string; assumption: string }> = [];

    for (const aspect of prioritizedAspects) {
      // Calculate VOI for this aspect
      const voiComponents = {
        impact: this.getAspectImpact(aspect, state.domain),
        uncertainty: state.epistemicUncertainty,
        reversibility: aspect === 'irreversible' ? 0.1 : 0.5,
      };

      const voiScore = await this.voiService.calculateVOI(
        voiComponents,
        state.domain
      );

      const voiDecision = await this.voiService.getDecision(
        voiScore,
        state.domain,
        questionsAskedCount + questionsAsked.length
      );

      this.logger.info('VOI decision for aspect', {
        aspect,
        voiScore,
        voiDecision,
        questionsAskedSoFar: questionsAsked.length,
      });

      // Handle VOI decision
      if (voiDecision === 'skip_question' || voiDecision === 'proceed_with_assumption') {
        // Generate assumption instead of asking
        const assumption = this.generateAssumption(aspect, state.domain);
        assumedAspects.push({ aspect, assumption });

        // Log the assumption
        await this.logAssumption(tenantId, state.sessionId, aspect, assumption);
      } else {
        // Generate and ask the question
        const question = this.generateQuestionForAspect(
          aspect,
          state.proposedAction,
          state.domain,
          state.epistemicUncertainty
        );

        try {
          const response = await this.mcpElicitation.askUser(
            { ...question, sessionId: state.sessionId },
            tenantId
          );

          questionsAsked.push({
            aspect,
            question: question.question,
            response: response.value,
            status: response.status as ClarificationResponse['status'],
            assumptionMade: response.assumptionMade,
            voiScore,
          });
        } catch (error) {
          this.logger.error('Failed to ask clarification question', {
            aspect,
            error: error instanceof Error ? error.message : String(error),
          });

          // Fall back to assumption
          const assumption = this.generateAssumption(aspect, state.domain);
          assumedAspects.push({ aspect, assumption });
        }
      }
    }

    // Calculate remaining uncertainty
    const remainingUncertainty = this.calculateRemainingUncertainty(
      state.epistemicUncertainty,
      questionsAsked
    );

    // Determine proceed recommendation
    const proceedRecommendation = this.getProceedRecommendation(
      remainingUncertainty,
      state.domain,
      questionsAsked,
      assumedAspects
    );

    const result: ClarificationResult = {
      questionsAsked,
      assumedAspects,
      remainingUncertainty,
      proceedRecommendation,
    };

    // Log the clarification session
    await this.logClarificationSession(tenantId, state, result);

    this.logger.info('Scout clarification complete', {
      sessionId: state.sessionId,
      questionsAsked: questionsAsked.length,
      assumedAspects: assumedAspects.length,
      remainingUncertainty,
      proceedRecommendation,
    });

    return result;
  }

  /**
   * Prioritize uncertain aspects by impact score for the given domain.
   */
  private prioritizeAspects(aspects: string[], domain: Domain): string[] {
    return [...aspects].sort((a, b) => {
      const impactA = this.getAspectImpact(a, domain);
      const impactB = this.getAspectImpact(b, domain);
      return impactB - impactA;
    });
  }

  /**
   * Get impact score for an aspect, with domain-specific boosts.
   */
  private getAspectImpact(aspect: string, domain: Domain): number {
    const config = ASPECT_IMPACTS[aspect];
    if (!config) {
      return 0.5; // Default for unknown aspects
    }

    let impact = config.baseImpact;

    // Apply domain boost (20% increase)
    if (config.domainBoosts.includes(domain)) {
      impact = Math.min(1.0, impact * 1.2);
    }

    return impact;
  }

  /**
   * Generate an AskUserRequest for a specific uncertain aspect.
   */
  private generateQuestionForAspect(
    aspect: string,
    proposedAction: string,
    domain: Domain,
    uncertainty: number
  ): Omit<AskUserRequest, 'sessionId'> {
    const template = QUESTION_TEMPLATES[aspect] ?? 
      ((action: string) => `I need more information about "${aspect}" for "${action}". Can you clarify?`);

    // Determine question type based on aspect
    let questionType: AskUserRequest['questionType'] = 'free_text';
    if (aspect === 'irreversible' || aspect === 'safety') {
      questionType = 'confirmation';
    } else if (aspect === 'user_preference') {
      questionType = 'free_text';
    }

    // Determine urgency based on aspect and domain
    let urgency: AskUserRequest['urgency'] = 'normal';
    if (aspect === 'safety' || aspect === 'irreversible') {
      urgency = 'blocking';
    } else if (domain === 'medical' || domain === 'financial') {
      if (aspect === 'compliance') {
        urgency = 'blocking';
      } else {
        urgency = 'high';
      }
    }

    return {
      requestId: `scout-${Date.now()}-${aspect}`,
      question: template(proposedAction),
      questionType,
      urgency,
      domain,
      voiComponents: {
        impact: this.getAspectImpact(aspect, domain),
        uncertainty,
        reversibility: aspect === 'irreversible' ? 0.1 : 0.5,
      },
      agentReasoning: `Scout persona clarification for uncertain aspect: ${aspect}`,
      context: {
        relatedArtifacts: [proposedAction],
        agentState: { persona: 'scout', aspect },
      },
    };
  }

  /**
   * Generate an assumption statement for a skipped aspect.
   */
  private generateAssumption(aspect: string, domain: Domain): string {
    const baseAssumption = DEFAULT_ASSUMPTIONS[aspect] ?? 
      `Proceeding with standard approach for ${aspect}`;

    // Add domain-specific context if relevant
    if (domain === 'medical' && (aspect === 'safety' || aspect === 'compliance')) {
      return `${baseAssumption} (HIPAA-compliant)`;
    }
    if (domain === 'financial' && aspect === 'compliance') {
      return `${baseAssumption} (SOC2/PCI-compliant)`;
    }

    return baseAssumption;
  }

  /**
   * Calculate remaining uncertainty after clarifications.
   */
  private calculateRemainingUncertainty(
    initialUncertainty: number,
    responses: ClarificationResponse[]
  ): number {
    const answeredCount = responses.filter(r => r.status === 'answered').length;
    
    if (responses.length === 0) {
      return initialUncertainty;
    }

    // Each answered question reduces uncertainty by ~30%
    // Higher VOI answers reduce more uncertainty
    let reduction = 0;
    for (const response of responses) {
      if (response.status === 'answered') {
        reduction += 0.3 * response.voiScore;
      }
    }

    return Math.max(0, initialUncertainty * (1 - reduction));
  }

  /**
   * Determine whether to proceed, wait, or abort based on remaining uncertainty.
   */
  private getProceedRecommendation(
    remainingUncertainty: number,
    domain: Domain,
    questionsAsked: ClarificationResponse[],
    assumedAspects: Array<{ aspect: string; assumption: string }>
  ): 'proceed' | 'wait' | 'abort' {
    // Domain-specific thresholds
    const thresholds: Record<Domain, { proceed: number; abort: number }> = {
      medical: { proceed: 0.2, abort: 0.8 },
      financial: { proceed: 0.25, abort: 0.75 },
      legal: { proceed: 0.25, abort: 0.75 },
      bioinformatics: { proceed: 0.35, abort: 0.7 },
      general: { proceed: 0.4, abort: 0.8 },
    };

    const threshold = thresholds[domain] || thresholds.general;

    // Check for blocking unanswered questions
    const hasBlockingUnanswered = questionsAsked.some(
      q => q.status !== 'answered' && q.voiScore > 0.7
    );

    if (hasBlockingUnanswered) {
      return 'wait';
    }

    // Check for critical assumptions in high-stakes domains
    if (domain === 'medical' || domain === 'financial') {
      const hasCriticalAssumption = assumedAspects.some(
        a => a.aspect === 'safety' || a.aspect === 'compliance'
      );
      if (hasCriticalAssumption && remainingUncertainty > 0.3) {
        return 'wait';
      }
    }

    if (remainingUncertainty <= threshold.proceed) {
      return 'proceed';
    }
    if (remainingUncertainty >= threshold.abort) {
      return 'abort';
    }

    return 'wait';
  }

  /**
   * Get count of questions already asked in this session.
   */
  private async getSessionQuestionCount(
    tenantId: string,
    sessionId: string
  ): Promise<number> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count FROM hitl_questions 
         WHERE tenant_id = $1 AND session_id = $2 
         AND status IN ('answered', 'presented', 'pending')`,
        [tenantId, sessionId]
      );
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
   * Log an assumption made by Scout.
   */
  private async logAssumption(
    tenantId: string,
    sessionId: string,
    aspect: string,
    assumption: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO hitl_abstention_events 
         (tenant_id, session_id, aspect, assumption_made, source, created_at)
         VALUES ($1, $2, $3, $4, 'scout_voi_filter', NOW())`,
        [tenantId, sessionId, aspect, assumption]
      );
    } catch (error) {
      this.logger.warn('Failed to log Scout assumption', {
        error: error instanceof Error ? error.message : String(error),
        aspect,
      });
    }
  }

  /**
   * Log the complete clarification session.
   */
  private async logClarificationSession(
    tenantId: string,
    state: UncertaintyState,
    result: ClarificationResult
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO hitl_voi_decisions 
         (tenant_id, session_id, domain, initial_uncertainty, 
          aspects_evaluated, questions_asked, assumptions_made,
          remaining_uncertainty, recommendation, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          tenantId,
          state.sessionId,
          state.domain,
          state.epistemicUncertainty,
          JSON.stringify(state.uncertainAspects),
          result.questionsAsked.length,
          result.assumedAspects.length,
          result.remainingUncertainty,
          result.proceedRecommendation,
        ]
      );
    } catch (error) {
      this.logger.warn('Failed to log clarification session', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createScoutHITLIntegration(
  personaService: PersonaService,
  voiService: VOIService,
  mcpElicitation: MCPElicitationService,
  logger: Logger
): ScoutHITLIntegration {
  return new ScoutHITLIntegration(personaService, voiService, mcpElicitation, logger);
}
