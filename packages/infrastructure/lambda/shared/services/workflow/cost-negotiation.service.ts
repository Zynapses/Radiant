/**
 * Cost Negotiation Service
 * RADIANT v5.53.0
 * 
 * Implements Gemini's "Cost Negotiation" recommendation for the Economic Governor.
 * 
 * MITIGATION: Avoids distributed agent micro-ledger complexity. Instead:
 * 1. Centralized budget allocation at workflow level
 * 2. Simple bid/ask negotiation for model selection
 * 3. Quality-cost tradeoff curves per model
 * 4. Workflow-level budget constraints with step allocation
 * 
 * NOT implementing: Agent-level ledgers, cryptocurrency-style settlement,
 * complex multi-agent auctions.
 */

import { v4 as uuidv4 } from 'uuid';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';

// =============================================================================
// Types
// =============================================================================

export interface ModelBid {
  modelId: string;
  estimatedCostCents: number;
  estimatedQuality: number;     // 0-1 scale
  estimatedLatencyMs: number;
  capabilities: string[];
  constraints?: {
    maxTokens?: number;
    contextWindow?: number;
  };
}

export interface BudgetAllocation {
  allocationId: string;
  workflowId: string;
  totalBudgetCents: number;
  remainingBudgetCents: number;
  allocatedSteps: Record<string, number>; // stepId -> allocated cents
  spentCents: number;
  createdAt: string;
  expiresAt?: string;
}

export interface NegotiationRequest {
  workflowId: string;
  stepId: string;
  taskDescription: string;
  requiredCapabilities: string[];
  qualityTarget: number;        // 0-1: minimum acceptable quality
  latencyTargetMs?: number;
  preferCheaper?: boolean;
}

export interface NegotiationResult {
  success: boolean;
  selectedModel: ModelBid | null;
  allocatedBudgetCents: number;
  negotiationRounds: number;
  alternatives: ModelBid[];
  reasoning: string;
  tradeoffAnalysis?: {
    qualityVsCost: number;     // Higher = better value
    speedVsCost: number;
    recommendation: 'accept' | 'consider_alternatives' | 'reject';
  };
}

export interface QualityCostCurve {
  modelId: string;
  dataPoints: Array<{
    taskType: string;
    costCents: number;
    qualityScore: number;
    sampleSize: number;
  }>;
  regressionCoefficients?: {
    slope: number;
    intercept: number;
    r2: number;
  };
}

// =============================================================================
// Model Cost Registry
// =============================================================================

const MODEL_REGISTRY: Record<string, {
  costPer1kInput: number;
  costPer1kOutput: number;
  qualityScore: number;
  latencyMs: number;
  capabilities: string[];
  contextWindow: number;
}> = {
  'anthropic/claude-3-5-sonnet-20241022': {
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    qualityScore: 0.92,
    latencyMs: 800,
    capabilities: ['reasoning', 'coding', 'analysis', 'creative', 'vision'],
    contextWindow: 200000,
  },
  'anthropic/claude-3-5-haiku-20241022': {
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    qualityScore: 0.78,
    latencyMs: 300,
    capabilities: ['reasoning', 'coding', 'analysis'],
    contextWindow: 200000,
  },
  'anthropic/claude-3-opus-20240229': {
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    qualityScore: 0.95,
    latencyMs: 1500,
    capabilities: ['reasoning', 'coding', 'analysis', 'creative', 'vision', 'complex'],
    contextWindow: 200000,
  },
  'openai/gpt-4o': {
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    qualityScore: 0.90,
    latencyMs: 600,
    capabilities: ['reasoning', 'coding', 'analysis', 'creative', 'vision'],
    contextWindow: 128000,
  },
  'openai/gpt-4o-mini': {
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    qualityScore: 0.72,
    latencyMs: 200,
    capabilities: ['reasoning', 'coding', 'analysis'],
    contextWindow: 128000,
  },
  'meta/llama-3.1-70b': {
    costPer1kInput: 0.0009,
    costPer1kOutput: 0.0009,
    qualityScore: 0.82,
    latencyMs: 400,
    capabilities: ['reasoning', 'coding', 'analysis'],
    contextWindow: 128000,
  },
  'meta/llama-3.1-8b': {
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0001,
    qualityScore: 0.65,
    latencyMs: 150,
    capabilities: ['reasoning', 'basic'],
    contextWindow: 128000,
  },
};

// =============================================================================
// Cost Negotiation Service
// =============================================================================

class CostNegotiationService {
  private budgetAllocations = new Map<string, BudgetAllocation>();
  private qualityCurves = new Map<string, QualityCostCurve>();
  
  // ==========================================================================
  // Budget Management
  // ==========================================================================
  
  /**
   * Create a budget allocation for a workflow
   */
  createBudgetAllocation(
    workflowId: string,
    totalBudgetCents: number,
    expiresInMs?: number
  ): BudgetAllocation {
    const allocation: BudgetAllocation = {
      allocationId: uuidv4(),
      workflowId,
      totalBudgetCents,
      remainingBudgetCents: totalBudgetCents,
      allocatedSteps: {},
      spentCents: 0,
      createdAt: new Date().toISOString(),
      expiresAt: expiresInMs 
        ? new Date(Date.now() + expiresInMs).toISOString() 
        : undefined,
    };
    
    this.budgetAllocations.set(workflowId, allocation);
    
    logger.info('Budget allocation created', {
      workflowId,
      totalBudgetCents,
      allocationId: allocation.allocationId,
    });
    
    return allocation;
  }
  
  /**
   * Get remaining budget for a workflow
   */
  getRemainingBudget(workflowId: string): number {
    const allocation = this.budgetAllocations.get(workflowId);
    if (!allocation) return 0;
    
    // Check expiration
    if (allocation.expiresAt && new Date(allocation.expiresAt) < new Date()) {
      return 0;
    }
    
    return allocation.remainingBudgetCents;
  }
  
  /**
   * Record spending against budget
   */
  recordSpending(workflowId: string, stepId: string, amountCents: number): boolean {
    const allocation = this.budgetAllocations.get(workflowId);
    if (!allocation) {
      logger.warn('No budget allocation found', { workflowId });
      return false;
    }
    
    if (allocation.remainingBudgetCents < amountCents) {
      logger.warn('Insufficient budget', {
        workflowId,
        stepId,
        requested: amountCents,
        remaining: allocation.remainingBudgetCents,
      });
      return false;
    }
    
    allocation.remainingBudgetCents -= amountCents;
    allocation.spentCents += amountCents;
    allocation.allocatedSteps[stepId] = (allocation.allocatedSteps[stepId] || 0) + amountCents;
    
    return true;
  }
  
  // ==========================================================================
  // Model Bidding
  // ==========================================================================
  
  /**
   * Generate bids from available models for a task
   */
  generateBids(
    taskDescription: string,
    requiredCapabilities: string[],
    estimatedInputTokens: number = 500,
    estimatedOutputTokens: number = 1000
  ): ModelBid[] {
    const bids: ModelBid[] = [];
    
    for (const [modelId, model] of Object.entries(MODEL_REGISTRY)) {
      // Check if model has required capabilities
      const hasCapabilities = requiredCapabilities.every(cap =>
        model.capabilities.some(mc => mc.toLowerCase().includes(cap.toLowerCase()))
      );
      
      if (!hasCapabilities && requiredCapabilities.length > 0) continue;
      
      // Calculate estimated cost
      const inputCost = (estimatedInputTokens / 1000) * model.costPer1kInput;
      const outputCost = (estimatedOutputTokens / 1000) * model.costPer1kOutput;
      const totalCostCents = (inputCost + outputCost) * 100;
      
      bids.push({
        modelId,
        estimatedCostCents: Math.round(totalCostCents * 100) / 100,
        estimatedQuality: model.qualityScore,
        estimatedLatencyMs: model.latencyMs,
        capabilities: model.capabilities,
        constraints: {
          contextWindow: model.contextWindow,
        },
      });
    }
    
    // Sort by value (quality/cost ratio)
    return bids.sort((a, b) => {
      const valueA = a.estimatedQuality / (a.estimatedCostCents || 0.01);
      const valueB = b.estimatedQuality / (b.estimatedCostCents || 0.01);
      return valueB - valueA;
    });
  }
  
  // ==========================================================================
  // Negotiation
  // ==========================================================================
  
  /**
   * Negotiate model selection for a workflow step
   * 
   * This is the main API - balances quality, cost, and latency constraints
   */
  async negotiate(request: NegotiationRequest): Promise<NegotiationResult> {
    const startTime = Date.now();
    
    // Get available budget
    const remainingBudget = this.getRemainingBudget(request.workflowId);
    
    // Generate bids from all qualifying models
    const allBids = this.generateBids(
      request.taskDescription,
      request.requiredCapabilities
    );
    
    if (allBids.length === 0) {
      return {
        success: false,
        selectedModel: null,
        allocatedBudgetCents: 0,
        negotiationRounds: 1,
        alternatives: [],
        reasoning: 'No models available with required capabilities',
      };
    }
    
    // Filter by budget constraint
    const affordableBids = remainingBudget > 0
      ? allBids.filter(b => b.estimatedCostCents <= remainingBudget)
      : allBids; // No budget tracking = allow all
    
    if (affordableBids.length === 0) {
      return {
        success: false,
        selectedModel: null,
        allocatedBudgetCents: 0,
        negotiationRounds: 1,
        alternatives: allBids.slice(0, 3),
        reasoning: `Insufficient budget. Remaining: ${remainingBudget}¢, Cheapest option: ${allBids[allBids.length - 1]?.estimatedCostCents}¢`,
      };
    }
    
    // Filter by quality target
    const qualifyingBids = affordableBids.filter(b => 
      b.estimatedQuality >= request.qualityTarget
    );
    
    // Filter by latency target if specified
    let candidateBids = qualifyingBids;
    if (request.latencyTargetMs) {
      candidateBids = qualifyingBids.filter(b => 
        b.estimatedLatencyMs <= request.latencyTargetMs!
      );
      
      // If no bids meet latency, relax the constraint
      if (candidateBids.length === 0) {
        candidateBids = qualifyingBids;
      }
    }
    
    // If no bids meet quality target, find best available
    if (candidateBids.length === 0) {
      candidateBids = affordableBids;
    }
    
    // Select based on preference
    let selectedBid: ModelBid;
    if (request.preferCheaper) {
      // Sort by cost ascending
      candidateBids.sort((a, b) => a.estimatedCostCents - b.estimatedCostCents);
      selectedBid = candidateBids[0];
    } else {
      // Sort by quality descending
      candidateBids.sort((a, b) => b.estimatedQuality - a.estimatedQuality);
      selectedBid = candidateBids[0];
    }
    
    // Calculate tradeoff analysis
    const cheapestOption = allBids[allBids.length - 1];
    const qualityVsCost = selectedBid.estimatedQuality / (selectedBid.estimatedCostCents || 0.01);
    const speedVsCost = (1000 / selectedBid.estimatedLatencyMs) / (selectedBid.estimatedCostCents || 0.01);
    
    let recommendation: 'accept' | 'consider_alternatives' | 'reject' = 'accept';
    if (selectedBid.estimatedQuality < request.qualityTarget) {
      recommendation = 'consider_alternatives';
    }
    if (remainingBudget > 0 && selectedBid.estimatedCostCents > remainingBudget * 0.5) {
      recommendation = 'consider_alternatives';
    }
    
    // Record the spending if budget tracking is active
    if (remainingBudget > 0) {
      this.recordSpending(request.workflowId, request.stepId, selectedBid.estimatedCostCents);
    }
    
    const negotiationRounds = candidateBids.length > 1 ? 2 : 1;
    
    return {
      success: true,
      selectedModel: selectedBid,
      allocatedBudgetCents: selectedBid.estimatedCostCents,
      negotiationRounds,
      alternatives: candidateBids.slice(1, 4),
      reasoning: this.buildReasoning(selectedBid, request, candidateBids.length),
      tradeoffAnalysis: {
        qualityVsCost,
        speedVsCost,
        recommendation,
      },
    };
  }
  
  /**
   * Quick negotiation - skip alternatives, just get best match
   */
  quickNegotiate(
    requiredCapabilities: string[],
    budgetCents?: number,
    qualityTarget: number = 0.7
  ): ModelBid | null {
    const bids = this.generateBids('', requiredCapabilities);
    
    let candidates = bids.filter(b => b.estimatedQuality >= qualityTarget);
    
    if (budgetCents !== undefined) {
      candidates = candidates.filter(b => b.estimatedCostCents <= budgetCents);
    }
    
    if (candidates.length === 0) {
      // Fallback to cheapest that meets quality
      candidates = bids.filter(b => b.estimatedQuality >= qualityTarget);
      if (candidates.length === 0) return bids[0] || null;
    }
    
    // Return best value
    return candidates[0] || null;
  }
  
  // ==========================================================================
  // Quality-Cost Curves
  // ==========================================================================
  
  /**
   * Record quality outcome for learning
   */
  recordQualityOutcome(
    modelId: string,
    taskType: string,
    costCents: number,
    qualityScore: number
  ): void {
    let curve = this.qualityCurves.get(modelId);
    
    if (!curve) {
      curve = {
        modelId,
        dataPoints: [],
      };
      this.qualityCurves.set(modelId, curve);
    }
    
    // Add data point
    curve.dataPoints.push({
      taskType,
      costCents,
      qualityScore,
      sampleSize: 1,
    });
    
    // Keep only last 100 data points per model
    if (curve.dataPoints.length > 100) {
      curve.dataPoints = curve.dataPoints.slice(-100);
    }
    
    // Update regression coefficients
    this.updateRegression(curve);
  }
  
  /**
   * Predict quality for a given cost
   */
  predictQuality(modelId: string, costCents: number): number {
    const curve = this.qualityCurves.get(modelId);
    
    if (!curve || !curve.regressionCoefficients) {
      // Use default from registry
      return MODEL_REGISTRY[modelId]?.qualityScore || 0.7;
    }
    
    const { slope, intercept } = curve.regressionCoefficients;
    const predicted = slope * costCents + intercept;
    
    return Math.max(0, Math.min(1, predicted));
  }
  
  private updateRegression(curve: QualityCostCurve): void {
    if (curve.dataPoints.length < 3) return;
    
    // Simple linear regression
    const n = curve.dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (const point of curve.dataPoints) {
      sumX += point.costCents;
      sumY += point.qualityScore;
      sumXY += point.costCents * point.qualityScore;
      sumX2 += point.costCents * point.costCents;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R²
    const meanY = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    for (const point of curve.dataPoints) {
      const predicted = slope * point.costCents + intercept;
      ssTotal += (point.qualityScore - meanY) ** 2;
      ssResidual += (point.qualityScore - predicted) ** 2;
    }
    const r2 = 1 - ssResidual / ssTotal;
    
    curve.regressionCoefficients = { slope, intercept, r2 };
  }
  
  // ==========================================================================
  // Utilities
  // ==========================================================================
  
  private buildReasoning(
    selected: ModelBid,
    request: NegotiationRequest,
    candidateCount: number
  ): string {
    const parts: string[] = [];
    
    parts.push(`Selected ${selected.modelId}`);
    parts.push(`Cost: ${selected.estimatedCostCents}¢`);
    parts.push(`Quality: ${(selected.estimatedQuality * 100).toFixed(0)}%`);
    parts.push(`Latency: ${selected.estimatedLatencyMs}ms`);
    
    if (request.qualityTarget > selected.estimatedQuality) {
      parts.push(`(Below quality target of ${(request.qualityTarget * 100).toFixed(0)}%)`);
    }
    
    parts.push(`From ${candidateCount} candidates`);
    
    return parts.join(' | ');
  }
  
  /**
   * Get budget summary for a workflow
   */
  getBudgetSummary(workflowId: string): {
    total: number;
    spent: number;
    remaining: number;
    stepBreakdown: Record<string, number>;
  } | null {
    const allocation = this.budgetAllocations.get(workflowId);
    if (!allocation) return null;
    
    return {
      total: allocation.totalBudgetCents,
      spent: allocation.spentCents,
      remaining: allocation.remainingBudgetCents,
      stepBreakdown: { ...allocation.allocatedSteps },
    };
  }
  
  /**
   * Clear budget allocation
   */
  clearBudget(workflowId: string): void {
    this.budgetAllocations.delete(workflowId);
  }
}

// Singleton export
export const costNegotiationService = new CostNegotiationService();

export default costNegotiationService;
