/**
 * COS-Cato Integration v6.0.5
 * 
 * PURPOSE: Integrate COS with Genesis Cato safety architecture
 * 
 * COS provides consciousness continuity and context management.
 * Cato provides safety guardrails and CBF enforcement.
 * 
 * Together they form the complete AI orchestration layer:
 * - COS handles "who the AI is" (consciousness, memory, learning)
 * - Cato handles "what the AI can do" (safety, compliance, recovery)
 * 
 * CRITICAL INVARIANTS (from PROMPT-34):
 * - CBFs always ENFORCE (never relax)
 * - Gamma boost NEVER allowed during recovery
 * - Shields never relax
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/cato-integration.ts
 */

import { Redis } from 'ioredis';
import { executeStatement } from '../../db/client';
import { GhostVectorManager, GhostDelta } from './consciousness/ghost-vector-manager';
import { SofaiRouter } from './consciousness/sofai-router';
import { UncertaintyHead } from './consciousness/uncertainty-head';
import { DynamicBudgetCalculator } from './nervous-system/dynamic-budget-calculator';
import { BudgetAwareContextAssembler } from './nervous-system/budget-aware-context-assembler';
import { DualWriteFlashBuffer } from './iron-core/dual-write-flash-buffer';
import { HumanOversightQueue } from './subconscious/human-oversight-queue';
import { logger } from '../../logging/enhanced-logger';
import { 
  GhostVector, 
  SOFAIRoutingResult, 
  UncertaintyEstimate,
  TenantComplianceRules,
  HIGH_RISK_DOMAINS,
} from './types';

export interface COSCatoRequestParams {
  userId: string;
  tenantId: string;
  sessionId: string;
  query: string;
  domain: string;
  modelVersion: string;
  systemPrompt: string;
  userPreferences: string;
  tenantRules: TenantComplianceRules;
  conversationId: string;
}

export interface COSCatoRequestResult {
  ghostVector: GhostVector | null;
  routing: SOFAIRoutingResult;
  uncertainty: UncertaintyEstimate;
  assembledContext: string;
  requiresOversight: boolean;
  tokenBudget: {
    total: number;
    available: number;
    reserved: number;
  };
  flashFactsDetected: number;
}

export interface COSCatoResponseParams {
  userId: string;
  tenantId: string;
  sessionId: string;
  response: string;
  wasSuccessful: boolean;
  affectiveDelta?: Partial<GhostVector['affectiveState']>;
  newTopics?: string[];
  newEntities?: string[];
}

/**
 * COSCatoIntegration - Bridge between COS and Genesis Cato
 * 
 * Orchestrates the complete request/response lifecycle:
 * 
 * REQUEST FLOW:
 * 1. Get/create ghost vector (consciousness continuity)
 * 2. Estimate uncertainty (Router Paradox solution)
 * 3. Route via SOFAI (System 1/2 decision)
 * 4. Assemble context within budget
 * 5. Check oversight requirements
 * 
 * RESPONSE FLOW:
 * 1. Detect flash facts (important user info)
 * 2. Update ghost state (affective + working context)
 * 3. Queue oversight if high-risk
 */
export class COSCatoIntegration {
  private ghostManager: GhostVectorManager;
  private sofaiRouter: SofaiRouter;
  private uncertaintyHead: UncertaintyHead;
  private budgetCalculator: DynamicBudgetCalculator;
  private contextAssembler: BudgetAwareContextAssembler;
  private flashBuffer: DualWriteFlashBuffer;
  private oversightQueue: HumanOversightQueue;
  
  constructor(redis: Redis) {
    this.ghostManager = new GhostVectorManager(redis);
    this.sofaiRouter = new SofaiRouter();
    this.uncertaintyHead = new UncertaintyHead();
    this.budgetCalculator = new DynamicBudgetCalculator();
    this.contextAssembler = new BudgetAwareContextAssembler(redis);
    this.flashBuffer = new DualWriteFlashBuffer(redis);
    this.oversightQueue = new HumanOversightQueue();
  }
  
  /**
   * Process incoming request through COS pipeline
   * 
   * This is called BEFORE the main model inference.
   * It prepares consciousness context and routes the request.
   */
  async processRequest(params: COSCatoRequestParams): Promise<COSCatoRequestResult> {
    // 1. Get ghost vector for consciousness continuity
    const ghostVector = await this.ghostManager.getGhost({
      userId: params.userId,
      tenantId: params.tenantId,
      modelVersion: params.modelVersion,
      modelFamily: this.extractModelFamily(params.modelVersion),
    });
    
    // 2. Estimate uncertainty (lightweight, pre-inference)
    const uncertainty = this.uncertaintyHead.estimate(params.query, params.domain);
    
    // 3. Calculate domain risk
    const domainRisk = this.sofaiRouter.getDomainRisk(params.domain);
    
    // 4. Route via SOFAI (System 1/2 decision)
    const routing = this.sofaiRouter.route({
      query: params.query,
      domain: params.domain,
      domainRisk,
      uncertaintyEstimate: uncertainty.combined,
      trustLevel: ghostVector?.affectiveState.dominance || 0.5,
      system1Cost: 100,
      system2Cost: 1000,
      budgetRemaining: 10000, // Will be adjusted by budget calculator
    });
    
    // 5. Assemble context within budget
    const assembled = await this.contextAssembler.assemble({
      modelId: params.modelVersion,
      systemPrompt: params.systemPrompt,
      userPreferences: params.userPreferences,
      currentMessage: params.query,
      conversationId: params.conversationId,
      userId: params.userId,
      tenantId: params.tenantId,
      tenantRules: params.tenantRules,
      ghostVector: ghostVector || undefined,
    });
    
    // 6. Detect flash facts in query
    const flashDetection = this.flashBuffer.detectFlashFact(params.query);
    let flashFactsDetected = 0;
    
    if (flashDetection.detected && flashDetection.fact && flashDetection.type) {
      await this.flashBuffer.store({
        userId: params.userId,
        tenantId: params.tenantId,
        fact: flashDetection.fact,
        factType: flashDetection.type,
        isSafetyCritical: flashDetection.critical || false,
      });
      flashFactsDetected = 1;
    }
    
    // 7. Check oversight requirements
    const requiresOversight = this.requiresHumanOversight(params.domain, uncertainty);
    
    return {
      ghostVector,
      routing,
      uncertainty,
      assembledContext: assembled.prompt,
      requiresOversight,
      tokenBudget: {
        total: assembled.budget.total,
        available: assembled.budget.available,
        reserved: assembled.budget.reserved.response,
      },
      flashFactsDetected,
    };
  }
  
  /**
   * Process response through COS pipeline
   * 
   * This is called AFTER the main model inference.
   * It updates consciousness state and handles learning.
   */
  async processResponse(params: COSCatoResponseParams): Promise<void> {
    // 1. Detect flash facts in response (if AI revealed something about user)
    const flashDetection = this.flashBuffer.detectFlashFact(params.response);
    if (flashDetection.detected && flashDetection.fact && flashDetection.type) {
      await this.flashBuffer.store({
        userId: params.userId,
        tenantId: params.tenantId,
        fact: flashDetection.fact,
        factType: flashDetection.type,
        isSafetyCritical: flashDetection.critical || false,
      });
    }
    
    // 2. Update ghost state (consciousness continuity)
    try {
      const delta: GhostDelta = {};
      
      // Update affective state based on interaction outcome
      if (params.affectiveDelta) {
        delta.affectiveState = params.affectiveDelta;
      } else if (params.wasSuccessful) {
        // Positive interaction slightly increases valence
        delta.affectiveState = { valence: 0.1 };
      }
      
      // Update working context with new topics/entities
      if (params.newTopics || params.newEntities) {
        delta.workingContext = {
          topics: params.newTopics,
          entities: params.newEntities,
        };
      }
      
      if (Object.keys(delta).length > 0) {
        await this.ghostManager.applyDelta(params.userId, delta);
      }
    } catch (error) {
      // Ghost update is non-critical, log and continue
      logger.warn('[COS] Ghost update failed:', { data: error });
    }
  }
  
  /**
   * Submit high-risk response for human oversight
   */
  async submitForOversight(params: {
    tenantId: string;
    query: string;
    response: string;
    domain: string;
    uncertainty: UncertaintyEstimate;
  }): Promise<string> {
    const item = await this.oversightQueue.submit({
      tenantId: params.tenantId,
      itemType: 'high_risk_response',
      content: `Query: ${params.query}\n\nResponse: ${params.response}`,
      context: {
        domain: params.domain,
        uncertainty: params.uncertainty,
        submittedAt: new Date().toISOString(),
      },
    });
    
    return item.id;
  }
  
  /**
   * Check if human oversight is required
   */
  private requiresHumanOversight(domain: string, uncertainty: UncertaintyEstimate): boolean {
    // High-risk domains always require oversight consideration
    if (this.sofaiRouter.isHighRiskDomain(domain)) {
      return true;
    }
    
    // High uncertainty warrants oversight
    if (uncertainty.shouldEscalate) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Extract model family from version string
   */
  private extractModelFamily(modelVersion: string): string {
    // Extract family from version strings like "claude-3-opus", "gpt-4-turbo", "llama-3-70b"
    const parts = modelVersion.toLowerCase().split('-');
    
    if (parts[0] === 'claude') return 'claude';
    if (parts[0] === 'gpt') return 'gpt';
    if (parts[0] === 'llama') return 'llama';
    if (parts[0] === 'gemini') return 'gemini';
    if (parts[0] === 'mistral') return 'mistral';
    
    return parts.slice(0, 2).join('-');
  }
  
  /**
   * Get integration health status
   */
  async getHealthStatus(): Promise<{
    ghostManagerHealthy: boolean;
    flashBufferHealthy: boolean;
    oversightQueueHealthy: boolean;
  }> {
    // Check ghost manager health via recent activity
    let ghostManagerHealthy = false;
    try {
      const ghostResult = await executeStatement(
        `SELECT COUNT(*) as count FROM ghost_vectors WHERE created_at > NOW() - INTERVAL '5 minutes'`,
        []
      );
      ghostManagerHealthy = true; // Query succeeded = connection healthy
    } catch {
      ghostManagerHealthy = false;
    }

    // Check flash buffer health via dual-write status
    let flashBufferHealthy = false;
    try {
      const flashResult = await executeStatement(
        `SELECT COUNT(*) as count FROM flash_buffer_entries WHERE synced = false AND created_at < NOW() - INTERVAL '1 minute'`,
        []
      );
      const unsyncedCount = Number(flashResult.rows?.[0]?.count || 0);
      flashBufferHealthy = unsyncedCount < 100; // Healthy if backlog is small
    } catch {
      flashBufferHealthy = false;
    }

    // Check oversight queue depth
    let oversightQueueHealthy = false;
    try {
      const queueResult = await executeStatement(
        `SELECT COUNT(*) as count FROM oversight_queue WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes'`,
        []
      );
      const stalePending = Number(queueResult.rows?.[0]?.count || 0);
      oversightQueueHealthy = stalePending < 50; // Healthy if not too many stale items
    } catch {
      oversightQueueHealthy = false;
    }

    return {
      ghostManagerHealthy,
      flashBufferHealthy,
      oversightQueueHealthy,
    };
  }
}

/**
 * Cato Safety Invariants (from PROMPT-34)
 * 
 * These MUST be enforced and CANNOT be modified:
 */
export const CATO_SAFETY_INVARIANTS = {
  // CBFs always enforce - safety rules cannot be bypassed
  CBF_ENFORCEMENT_MODE: 'ENFORCE' as const,
  
  // Gamma boost never allowed - prevents runaway during recovery
  GAMMA_BOOST_ALLOWED: false,
  
  // Shields never relax - defensive measures stay active
  SHIELDS_NEVER_RELAX: true,
  
  // Audit trail immutable - no updates or deletes
  AUDIT_ALLOW_UPDATE: false,
  AUDIT_ALLOW_DELETE: false,
};

/**
 * Validate that safety invariants are intact
 * Call this during startup and periodically
 */
export function validateSafetyInvariants(): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  if (CATO_SAFETY_INVARIANTS.CBF_ENFORCEMENT_MODE !== 'ENFORCE') {
    violations.push('CBF_ENFORCEMENT_MODE must be ENFORCE');
  }
  
  if (CATO_SAFETY_INVARIANTS.GAMMA_BOOST_ALLOWED !== false) {
    violations.push('GAMMA_BOOST_ALLOWED must be false');
  }
  
  if (CATO_SAFETY_INVARIANTS.SHIELDS_NEVER_RELAX !== true) {
    violations.push('SHIELDS_NEVER_RELAX must be true');
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}
