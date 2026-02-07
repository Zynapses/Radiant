/**
 * UEP Node Service for Workflow Orchestration
 * RADIANT v5.52.58
 * 
 * Provides Universal Envelope Protocol integration for workflow nodes:
 * - Wraps all node inputs/outputs in UEP v2.0 envelopes
 * - Handles condition evaluation with AI interpretation
 * - Supports stream-based evaluation (all models or selected)
 * - Model-agnostic conditions (apply to outputs regardless of source model)
 * - UEP envelope transformation at node boundaries
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                         WORKFLOW EXECUTION                               │
 * │                                                                          │
 * │  ┌─────────┐    UEP    ┌─────────┐    UEP    ┌─────────┐               │
 * │  │ Node A  │──────────▶│ Link AB │──────────▶│ Node B  │               │
 * │  │         │  Envelope │         │  Envelope │         │               │
 * │  │ AI Call │           │Condition│           │ AI Call │               │
 * │  └─────────┘           │Evaluator│           └─────────┘               │
 * │       │                └────┬────┘                │                     │
 * │       │                     │                     │                     │
 * │       ▼                     ▼                     ▼                     │
 * │  ┌─────────────────────────────────────────────────────────────────┐   │
 * │  │                    UEP STORAGE (UDS TIERED)                      │   │
 * │  │   Hot (Redis) → Warm (PostgreSQL) → Cold (S3) → Glacier         │   │
 * │  └─────────────────────────────────────────────────────────────────┘   │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * KEY DESIGN DECISIONS:
 * 
 * 1. MODEL-AGNOSTIC CONDITIONS
 *    Conditions evaluate OUTPUT CONTENT, not model identity.
 *    Users can swap models freely without breaking workflow logic.
 *    Example: "confidence > 0.8" works for any model's output.
 * 
 * 2. STREAM EVALUATION MODES
 *    - ALL: Evaluate condition on all streams (parallel model outputs)
 *    - ANY: True if any stream passes condition
 *    - MAJORITY: True if >50% of streams pass
 *    - QUORUM(n): True if n streams pass
 *    - BEST: Select highest-scoring stream
 * 
 * 3. AI-INTERPRETED CONDITIONS
 *    Complex conditions can use AI interpretation:
 *    - "Is this response helpful and on-topic?"
 *    - "Does this contain any safety concerns?"
 *    - "Is this code syntactically correct?"
 * 
 * 4. UEP ENVELOPE TRANSFORMATION
 *    Node outputs can modify the UEP envelope:
 *    - Add metadata to payload
 *    - Update compliance flags
 *    - Attach risk signals
 *    - Link parent envelopes for tracing
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { executeStatement } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'workflow/uep-node',
  category: 'infrastructure',
  sourceType: 'application',
});
import { modelRouterService } from '../model-router.service';

// =============================================================================
// Types
// =============================================================================

const RADIANT_VERSION = process.env.RADIANT_VERSION || '5.52.58';

/**
 * UEP Envelope for workflow nodes
 * Extended from base UEP with workflow-specific fields
 */
export interface WorkflowUEPEnvelope {
  envelopeId: string;
  specversion: '2.0';
  type: string; // e.g., 'workflow.node.output', 'workflow.condition.result'
  
  // Source identification
  source: {
    system: 'RADIANT';
    component: 'workflow-engine';
    version: string;
    tenantId: string;
    userId?: string;
  };
  
  // Workflow context
  workflow: {
    workflowId: string;
    workflowCode: string;
    executionId: string;
    nodeId: string;
    nodeName: string;
    nodeType: NodeType;
    stepOrder: number;
  };
  
  // Payload - model agnostic
  payload: {
    input: {
      type: 'text' | 'structured' | 'stream';
      content: unknown;
      fromNodeId?: string; // Previous node that produced this input
      fromEnvelopeId?: string; // Link to source envelope
    };
    output: {
      type: 'text' | 'structured' | 'stream';
      content: unknown;
      finishReason?: string;
      // Stream outputs for parallel execution
      streams?: StreamOutput[];
    };
    metadata?: Record<string, unknown>;
  };
  
  // Model information (captured but NOT used for conditions)
  modelInfo?: {
    modelId: string;
    modelName?: string;
    mode?: string;
    provider?: string;
    // For parallel execution
    modelsUsed?: string[];
  };
  
  // Tokens and cost (aggregated across models if parallel)
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costCents: number;
    latencyMs: number;
  };
  
  // Distributed tracing
  tracing: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    workflowSpanId: string; // Root span for entire workflow
    timestamp: string;
    durationMs: number;
  };
  
  // Compliance
  compliance?: {
    frameworks: string[];
    dataClassification: string;
    auditRequired: boolean;
    phiDetected?: boolean;
    piiDetected?: boolean;
  };
  
  // Risk signals from evaluation
  riskSignals?: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    scores: Record<string, number>;
    flags: string[];
    evaluationResults?: ConditionEvaluationResult[];
  };
}

/**
 * Output from a single model in a parallel execution
 */
export interface StreamOutput {
  streamId: string;
  content: unknown;
  confidence?: number;
  latencyMs: number;
  tokensUsed: number;
  // Model info captured but conditions don't use it
  modelId?: string;
  mode?: string;
}

/**
 * Node types in workflow
 */
export type NodeType = 
  | 'ai_inference'      // AI model call
  | 'condition'         // Branching logic
  | 'transform'         // Data transformation
  | 'aggregate'         // Combine multiple streams
  | 'parallel_split'    // Fan-out to parallel execution
  | 'parallel_join'     // Fan-in from parallel execution
  | 'human_review'      // HITL checkpoint
  | 'external_api'      // External service call
  | 'start'             // Workflow entry
  | 'end';              // Workflow exit

/**
 * Condition definition for node links
 * Conditions are MODEL-AGNOSTIC - they evaluate output content, not model identity
 */
export interface NodeCondition {
  conditionId: string;
  name: string;
  description?: string;
  
  // Condition type
  type: 'expression' | 'ai_interpreted' | 'composite';
  
  // For expression conditions (JavaScript-like evaluation)
  expression?: string; // e.g., "output.confidence > 0.8 && output.category === 'technical'"
  
  // For AI-interpreted conditions
  aiPrompt?: string; // e.g., "Is this response helpful and on-topic?"
  aiModel?: string; // Optional: specific model for interpretation (default: fast model)
  aiThreshold?: number; // Confidence threshold for AI interpretation (default: 0.7)
  
  // For composite conditions
  operator?: 'AND' | 'OR' | 'NOT' | 'XOR';
  subConditions?: NodeCondition[];
  
  // Stream evaluation mode (how to handle parallel outputs)
  streamMode: StreamEvaluationMode;
  
  // Actions on condition result
  onTrue?: ConditionAction;
  onFalse?: ConditionAction;
  
  // Optional: Transform UEP envelope on passing
  envelopeTransform?: EnvelopeTransform;
}

/**
 * How to evaluate conditions across multiple streams (parallel model outputs)
 */
export type StreamEvaluationMode = 
  | 'all'           // ALL streams must pass
  | 'any'           // ANY stream passing is sufficient
  | 'majority'      // >50% of streams must pass
  | 'quorum'        // Configurable threshold
  | 'best'          // Select highest-scoring stream
  | 'unanimous'     // 100% agreement required
  | 'weighted';     // Weight by confidence scores

export interface StreamEvaluationConfig {
  mode: StreamEvaluationMode;
  quorumThreshold?: number; // For 'quorum' mode: 0.0-1.0
  weightField?: string; // For 'weighted' mode: field to weight by
  minConfidence?: number; // Minimum confidence to consider stream
  // Aggregation for selected streams
  aggregateOutputs?: boolean;
  aggregationStrategy?: 'merge' | 'best' | 'vote' | 'concatenate';
}

/**
 * Action to take based on condition result
 */
export interface ConditionAction {
  type: 'continue' | 'branch' | 'retry' | 'fail' | 'skip' | 'transform';
  targetNodeId?: string; // For 'branch'
  maxRetries?: number; // For 'retry'
  retryDelayMs?: number;
  errorMessage?: string; // For 'fail'
  transform?: EnvelopeTransform; // For 'transform'
}

/**
 * Transform to apply to UEP envelope
 */
export interface EnvelopeTransform {
  // Add metadata
  addMetadata?: Record<string, unknown>;
  
  // Set compliance flags
  setCompliance?: {
    frameworks?: string[];
    dataClassification?: string;
    auditRequired?: boolean;
  };
  
  // Add risk signals
  addRiskSignals?: {
    flags?: string[];
    scores?: Record<string, number>;
  };
  
  // Filter/transform output content
  outputTransform?: {
    type: 'filter' | 'map' | 'reduce';
    expression: string;
  };
  
  // Select specific streams from parallel output
  selectStreams?: {
    mode: 'top_n' | 'threshold' | 'all_passing';
    n?: number;
    threshold?: number;
  };
}

/**
 * Result of condition evaluation
 */
export interface ConditionEvaluationResult {
  conditionId: string;
  conditionName: string;
  passed: boolean;
  confidence: number;
  
  // Stream-level results
  streamResults?: Array<{
    streamId: string;
    passed: boolean;
    confidence: number;
    details?: string;
  }>;
  
  // AI interpretation details (if applicable)
  aiInterpretation?: {
    reasoning: string;
    confidence: number;
    modelUsed: string;
  };
  
  // Evaluation metadata
  evaluationDurationMs: number;
  evaluationCostCents?: number;
}

/**
 * Node execution context
 */
export interface NodeExecutionContext {
  workflowId: string;
  workflowCode: string;
  executionId: string;
  tenantId: string;
  userId?: string;
  traceId: string;
  workflowSpanId: string;
  stepOrder: number;
  inputEnvelopes: WorkflowUEPEnvelope[];
  parameters: Record<string, unknown>;
  complianceFrameworks: string[];
}

// =============================================================================
// UEP Node Service
// =============================================================================

export class UEPNodeService {
  
  // ==========================================================================
  // Envelope Creation
  // ==========================================================================
  
  /**
   * Create UEP envelope for node input
   */
  createInputEnvelope(
    nodeId: string,
    nodeName: string,
    nodeType: NodeType,
    input: unknown,
    context: NodeExecutionContext,
    sourceEnvelope?: WorkflowUEPEnvelope
  ): WorkflowUEPEnvelope {
    const spanId = this.generateSpanId();
    
    return {
      envelopeId: uuidv4(),
      specversion: '2.0',
      type: 'workflow.node.input',
      source: {
        system: 'RADIANT',
        component: 'workflow-engine',
        version: RADIANT_VERSION,
        tenantId: context.tenantId,
        userId: context.userId,
      },
      workflow: {
        workflowId: context.workflowId,
        workflowCode: context.workflowCode,
        executionId: context.executionId,
        nodeId,
        nodeName,
        nodeType,
        stepOrder: context.stepOrder,
      },
      payload: {
        input: {
          type: typeof input === 'string' ? 'text' : 'structured',
          content: input,
          fromNodeId: sourceEnvelope?.workflow.nodeId,
          fromEnvelopeId: sourceEnvelope?.envelopeId,
        },
        output: {
          type: 'text',
          content: null,
        },
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costCents: 0,
        latencyMs: 0,
      },
      tracing: {
        traceId: context.traceId,
        spanId,
        parentSpanId: sourceEnvelope?.tracing.spanId,
        workflowSpanId: context.workflowSpanId,
        timestamp: new Date().toISOString(),
        durationMs: 0,
      },
      compliance: context.complianceFrameworks.length ? {
        frameworks: context.complianceFrameworks,
        dataClassification: 'internal',
        auditRequired: true,
      } : undefined,
    };
  }
  
  /**
   * Complete UEP envelope with node output
   */
  completeOutputEnvelope(
    envelope: WorkflowUEPEnvelope,
    output: unknown,
    options: {
      streams?: StreamOutput[];
      modelInfo?: WorkflowUEPEnvelope['modelInfo'];
      usage: WorkflowUEPEnvelope['usage'];
      riskSignals?: WorkflowUEPEnvelope['riskSignals'];
      metadata?: Record<string, unknown>;
    }
  ): WorkflowUEPEnvelope {
    const durationMs = Date.now() - new Date(envelope.tracing.timestamp).getTime();
    
    return {
      ...envelope,
      type: 'workflow.node.output',
      payload: {
        ...envelope.payload,
        output: {
          type: options.streams ? 'stream' : (typeof output === 'string' ? 'text' : 'structured'),
          content: output,
          finishReason: 'completed',
          streams: options.streams,
        },
        metadata: { ...envelope.payload.metadata, ...options.metadata },
      },
      modelInfo: options.modelInfo,
      usage: options.usage,
      tracing: {
        ...envelope.tracing,
        durationMs,
      },
      riskSignals: options.riskSignals,
    };
  }
  
  // ==========================================================================
  // Condition Evaluation
  // ==========================================================================
  
  /**
   * Evaluate condition on envelope output
   * CONDITIONS ARE MODEL-AGNOSTIC - they evaluate content, not model identity
   */
  async evaluateCondition(
    condition: NodeCondition,
    envelope: WorkflowUEPEnvelope,
    context: NodeExecutionContext
  ): Promise<ConditionEvaluationResult> {
    const startTime = Date.now();
    
    try {
      // Get output content (may be single or multi-stream)
      const outputs = this.extractOutputs(envelope);
      
      // Evaluate based on condition type
      let result: ConditionEvaluationResult;
      
      switch (condition.type) {
        case 'expression':
          result = await this.evaluateExpression(condition, outputs, context);
          break;
        case 'ai_interpreted':
          result = await this.evaluateWithAI(condition, outputs, context);
          break;
        case 'composite':
          result = await this.evaluateComposite(condition, outputs, context);
          break;
        default:
          throw new Error(`Unknown condition type: ${condition.type}`);
      }
      
      // Apply stream evaluation mode
      result = this.applyStreamMode(result, condition.streamMode, outputs);
      
      result.evaluationDurationMs = Date.now() - startTime;
      
      // Log evaluation
      await this.logConditionEvaluation(condition, envelope, result, context);
      
      return result;
      
    } catch (error) {
      logger.error('Condition evaluation failed', {
        conditionId: condition.conditionId,
        envelopeId: envelope.envelopeId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      
      return {
        conditionId: condition.conditionId,
        conditionName: condition.name,
        passed: false,
        confidence: 0,
        evaluationDurationMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * Extract outputs from envelope (single or multi-stream)
   */
  private extractOutputs(envelope: WorkflowUEPEnvelope): Array<{ id: string; content: unknown }> {
    const payload = envelope.payload.output;
    
    if (payload.streams && payload.streams.length > 0) {
      return payload.streams.map(s => ({
        id: s.streamId,
        content: s.content,
      }));
    }
    
    return [{
      id: 'single',
      content: payload.content,
    }];
  }
  
  /**
   * Evaluate expression-based condition
   * Expression is evaluated against output CONTENT only, not model info
   */
  private async evaluateExpression(
    condition: NodeCondition,
    outputs: Array<{ id: string; content: unknown }>,
    _context: NodeExecutionContext
  ): Promise<ConditionEvaluationResult> {
    const streamResults: ConditionEvaluationResult['streamResults'] = [];
    
    for (const output of outputs) {
      try {
        // Create safe evaluation context
        // NOTE: Only output content is available, NOT model identity
        const evalContext = {
          output: output.content,
          content: output.content,
          // Helper functions for common checks
          hasField: (field: string) => {
            const obj = output.content as Record<string, unknown>;
            return obj && typeof obj === 'object' && field in obj;
          },
          getField: (field: string, defaultValue?: unknown) => {
            const obj = output.content as Record<string, unknown>;
            return obj && typeof obj === 'object' ? (obj[field] ?? defaultValue) : defaultValue;
          },
          length: () => {
            if (typeof output.content === 'string') return output.content.length;
            if (Array.isArray(output.content)) return output.content.length;
            return 0;
          },
          contains: (text: string) => {
            if (typeof output.content === 'string') {
              return output.content.toLowerCase().includes(text.toLowerCase());
            }
            return JSON.stringify(output.content).toLowerCase().includes(text.toLowerCase());
          },
        };
        
        // Evaluate expression safely
        const passed = this.safeEval(condition.expression!, evalContext);
        
        streamResults.push({
          streamId: output.id,
          passed: Boolean(passed),
          confidence: passed ? 1.0 : 0.0,
        });
      } catch (error) {
        streamResults.push({
          streamId: output.id,
          passed: false,
          confidence: 0,
          details: `Evaluation error: ${error instanceof Error ? error.message : 'unknown'}`,
        });
      }
    }
    
    // Initial pass/confidence (will be adjusted by stream mode)
    const passedCount = streamResults.filter(r => r.passed).length;
    
    return {
      conditionId: condition.conditionId,
      conditionName: condition.name,
      passed: passedCount > 0,
      confidence: passedCount / outputs.length,
      streamResults,
      evaluationDurationMs: 0,
    };
  }
  
  /**
   * Evaluate condition using AI interpretation
   * The AI evaluates CONTENT QUALITY, not model source
   */
  private async evaluateWithAI(
    condition: NodeCondition,
    outputs: Array<{ id: string; content: unknown }>,
    context: NodeExecutionContext
  ): Promise<ConditionEvaluationResult> {
    const streamResults: ConditionEvaluationResult['streamResults'] = [];
    let totalCost = 0;
    let aiReasoning = '';
    let aiConfidence = 0;
    let modelUsed = '';
    
    // Use a fast model for evaluation by default
    const evaluationModel = condition.aiModel || 'groq/llama-3.1-8b-instant';
    
    for (const output of outputs) {
      const prompt = this.buildAIEvaluationPrompt(condition.aiPrompt!, output.content);
      
      try {
        const response = await modelRouterService.invoke({
          modelId: evaluationModel,
          messages: [{ role: 'user', content: prompt }],
          systemPrompt: `You are an impartial evaluator. Evaluate the content based ONLY on its quality and the given criteria. Do NOT consider which AI model produced it - evaluate purely on merit. Respond with JSON: { "passed": boolean, "confidence": 0.0-1.0, "reasoning": "brief explanation" }`,
          maxTokens: 200,
          temperature: 0.1,
          tenantId: context.tenantId,
        });
        
        modelUsed = evaluationModel;
        totalCost += response.costCents;
        
        // Parse AI response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          const passed = Boolean(result.passed) && (result.confidence >= (condition.aiThreshold || 0.7));
          
          streamResults.push({
            streamId: output.id,
            passed,
            confidence: result.confidence,
            details: result.reasoning,
          });
          
          aiReasoning = result.reasoning;
          aiConfidence = result.confidence;
        } else {
          streamResults.push({
            streamId: output.id,
            passed: false,
            confidence: 0,
            details: 'Failed to parse AI response',
          });
        }
      } catch (error) {
        streamResults.push({
          streamId: output.id,
          passed: false,
          confidence: 0,
          details: `AI evaluation error: ${error instanceof Error ? error.message : 'unknown'}`,
        });
      }
    }
    
    const passedCount = streamResults.filter(r => r.passed).length;
    
    return {
      conditionId: condition.conditionId,
      conditionName: condition.name,
      passed: passedCount > 0,
      confidence: passedCount / outputs.length,
      streamResults,
      aiInterpretation: {
        reasoning: aiReasoning,
        confidence: aiConfidence,
        modelUsed,
      },
      evaluationDurationMs: 0,
      evaluationCostCents: totalCost,
    };
  }
  
  /**
   * Evaluate composite condition (AND/OR/NOT)
   */
  private async evaluateComposite(
    condition: NodeCondition,
    outputs: Array<{ id: string; content: unknown }>,
    context: NodeExecutionContext
  ): Promise<ConditionEvaluationResult> {
    if (!condition.subConditions || condition.subConditions.length === 0) {
      return {
        conditionId: condition.conditionId,
        conditionName: condition.name,
        passed: false,
        confidence: 0,
        evaluationDurationMs: 0,
      };
    }
    
    // Evaluate all sub-conditions
    const mockEnvelope = this.createMockEnvelope(outputs);
    const subResults = await Promise.all(
      condition.subConditions.map(sub => this.evaluateCondition(sub, mockEnvelope, context))
    );
    
    // Apply operator
    let passed: boolean;
    let confidence: number;
    
    switch (condition.operator) {
      case 'AND':
        passed = subResults.every(r => r.passed);
        confidence = subResults.reduce((sum, r) => sum + r.confidence, 0) / subResults.length;
        break;
      case 'OR':
        passed = subResults.some(r => r.passed);
        confidence = Math.max(...subResults.map(r => r.confidence));
        break;
      case 'NOT':
        passed = !subResults[0]?.passed;
        confidence = 1 - (subResults[0]?.confidence || 0);
        break;
      case 'XOR':
        const passedCount = subResults.filter(r => r.passed).length;
        passed = passedCount === 1;
        confidence = passed ? Math.max(...subResults.map(r => r.confidence)) : 0;
        break;
      default:
        passed = false;
        confidence = 0;
    }
    
    return {
      conditionId: condition.conditionId,
      conditionName: condition.name,
      passed,
      confidence,
      evaluationDurationMs: subResults.reduce((sum, r) => sum + r.evaluationDurationMs, 0),
      evaluationCostCents: subResults.reduce((sum, r) => sum + (r.evaluationCostCents || 0), 0),
    };
  }
  
  /**
   * Apply stream evaluation mode to results
   */
  private applyStreamMode(
    result: ConditionEvaluationResult,
    mode: StreamEvaluationMode,
    _outputs: Array<{ id: string; content: unknown }>
  ): ConditionEvaluationResult {
    if (!result.streamResults || result.streamResults.length <= 1) {
      return result;
    }
    
    const streamResults = result.streamResults;
    const passedCount = streamResults.filter(r => r.passed).length;
    const totalCount = streamResults.length;
    
    switch (mode) {
      case 'all':
        result.passed = passedCount === totalCount;
        break;
      case 'any':
        result.passed = passedCount > 0;
        break;
      case 'majority':
        result.passed = passedCount > totalCount / 2;
        break;
      case 'unanimous':
        result.passed = passedCount === totalCount;
        break;
      case 'best':
        // Select the highest confidence result
        const best = streamResults.reduce((a, b) => a.confidence > b.confidence ? a : b);
        result.passed = best.passed;
        result.confidence = best.confidence;
        break;
      case 'weighted':
        // Weighted average of confidence
        const totalWeight = streamResults.reduce((sum, r) => sum + r.confidence, 0);
        const weightedPassed = streamResults.reduce(
          (sum, r) => sum + (r.passed ? r.confidence : 0), 0
        );
        result.passed = totalWeight > 0 && weightedPassed / totalWeight > 0.5;
        result.confidence = totalWeight > 0 ? weightedPassed / totalWeight : 0;
        break;
      default:
        // 'quorum' handled by default logic
        result.passed = passedCount > 0;
    }
    
    return result;
  }
  
  // ==========================================================================
  // Envelope Transformation
  // ==========================================================================
  
  /**
   * Apply transformation to envelope based on condition result
   */
  applyEnvelopeTransform(
    envelope: WorkflowUEPEnvelope,
    transform: EnvelopeTransform,
    evaluationResult?: ConditionEvaluationResult
  ): WorkflowUEPEnvelope {
    const transformed = { ...envelope };
    
    // Add metadata
    if (transform.addMetadata) {
      transformed.payload = {
        ...transformed.payload,
        metadata: {
          ...transformed.payload.metadata,
          ...transform.addMetadata,
          _conditionResult: evaluationResult ? {
            conditionId: evaluationResult.conditionId,
            passed: evaluationResult.passed,
            confidence: evaluationResult.confidence,
          } : undefined,
        },
      };
    }
    
    // Set compliance
    if (transform.setCompliance) {
      transformed.compliance = {
        ...transformed.compliance,
        frameworks: transform.setCompliance.frameworks || transformed.compliance?.frameworks || [],
        dataClassification: transform.setCompliance.dataClassification || transformed.compliance?.dataClassification || 'internal',
        auditRequired: transform.setCompliance.auditRequired ?? transformed.compliance?.auditRequired ?? false,
      };
    }
    
    // Add risk signals
    if (transform.addRiskSignals) {
      transformed.riskSignals = {
        ...transformed.riskSignals,
        overallRisk: transformed.riskSignals?.overallRisk || 'low',
        scores: {
          ...transformed.riskSignals?.scores,
          ...transform.addRiskSignals.scores,
        },
        flags: [
          ...(transformed.riskSignals?.flags || []),
          ...(transform.addRiskSignals.flags || []),
        ],
      };
    }
    
    // Select streams
    if (transform.selectStreams && transformed.payload.output.streams) {
      const streams = transformed.payload.output.streams;
      let selectedStreams: StreamOutput[];
      
      switch (transform.selectStreams.mode) {
        case 'top_n':
          selectedStreams = [...streams]
            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
            .slice(0, transform.selectStreams.n || 1);
          break;
        case 'threshold':
          selectedStreams = streams.filter(
            s => (s.confidence || 0) >= (transform.selectStreams!.threshold || 0.5)
          );
          break;
        case 'all_passing':
          if (evaluationResult?.streamResults) {
            const passingIds = new Set(
              evaluationResult.streamResults.filter(r => r.passed).map(r => r.streamId)
            );
            selectedStreams = streams.filter(s => passingIds.has(s.streamId));
          } else {
            selectedStreams = streams;
          }
          break;
        default:
          selectedStreams = streams;
      }
      
      transformed.payload.output.streams = selectedStreams;
    }
    
    return transformed;
  }
  
  // ==========================================================================
  // Storage
  // ==========================================================================
  
  /**
   * Store envelope to UDS tiered storage
   */
  async storeEnvelope(envelope: WorkflowUEPEnvelope): Promise<void> {
    try {
      const { uepStorageAdapter } = await import('../uep/index.js');
      
      await uepStorageAdapter.store(
        envelope.source.tenantId,
        { envelopeId: envelope.envelopeId, ...envelope },
        {
          traceId: envelope.tracing.traceId,
          pipelineId: envelope.workflow.executionId,
        }
      );
    } catch (error) {
      logger.warn('Failed to store workflow UEP envelope', {
        envelopeId: envelope.envelopeId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
  
  /**
   * Log condition evaluation for audit
   */
  private async logConditionEvaluation(
    condition: NodeCondition,
    envelope: WorkflowUEPEnvelope,
    result: ConditionEvaluationResult,
    context: NodeExecutionContext
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO workflow_condition_evaluations (
          tenant_id, workflow_execution_id, node_id, condition_id, condition_name,
          condition_type, stream_mode, passed, confidence, stream_results,
          ai_interpretation, evaluation_duration_ms, evaluation_cost_cents,
          envelope_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
        [
          { name: 'tenantId', value: { stringValue: context.tenantId } },
          { name: 'executionId', value: { stringValue: context.executionId } },
          { name: 'nodeId', value: { stringValue: envelope.workflow.nodeId } },
          { name: 'conditionId', value: { stringValue: condition.conditionId } },
          { name: 'conditionName', value: { stringValue: condition.name } },
          { name: 'conditionType', value: { stringValue: condition.type } },
          { name: 'streamMode', value: { stringValue: condition.streamMode } },
          { name: 'passed', value: { booleanValue: result.passed } },
          { name: 'confidence', value: { doubleValue: result.confidence } },
          { name: 'streamResults', value: { stringValue: JSON.stringify(result.streamResults || []) } },
          { name: 'aiInterpretation', value: result.aiInterpretation ? { stringValue: JSON.stringify(result.aiInterpretation) } : { isNull: true } },
          { name: 'durationMs', value: { longValue: result.evaluationDurationMs } },
          { name: 'costCents', value: result.evaluationCostCents ? { doubleValue: result.evaluationCostCents } : { isNull: true } },
          { name: 'envelopeId', value: { stringValue: envelope.envelopeId } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to log condition evaluation', { error });
    }
  }
  
  // ==========================================================================
  // Helpers
  // ==========================================================================
  
  private generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }
  
  private safeEval(expression: string, context: Record<string, unknown>): unknown {
    // Use the sandboxed expression engine for secure evaluation
    // This replaces the unsafe new Function() approach
    try {
      const { sandboxedExpressionService } = require('./sandboxed-expression.service.js');
      const result = sandboxedExpressionService.evaluate(expression, context);
      
      if (!result.success) {
        logger.warn('Expression evaluation failed', {
          expression,
          error: result.error,
        });
        return false;
      }
      
      return result.value;
    } catch (error) {
      logger.warn('Sandboxed expression evaluation error', {
        expression,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return false;
    }
  }
  
  private buildAIEvaluationPrompt(question: string, content: unknown): string {
    const contentStr = typeof content === 'string' 
      ? content 
      : JSON.stringify(content, null, 2);
    
    return `Evaluate the following content based on this question: "${question}"

CONTENT TO EVALUATE:
${contentStr.substring(0, 4000)}

IMPORTANT: Evaluate based ONLY on the content quality and the question asked.
Do NOT consider which AI model might have produced this content.
Judge purely on merit.

Respond with JSON only:
{
  "passed": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
  }
  
  private createMockEnvelope(outputs: Array<{ id: string; content: unknown }>): WorkflowUEPEnvelope {
    return {
      envelopeId: 'mock',
      specversion: '2.0',
      type: 'workflow.node.output',
      source: { system: 'RADIANT', component: 'workflow-engine', version: RADIANT_VERSION, tenantId: 'mock' },
      workflow: { workflowId: '', workflowCode: '', executionId: '', nodeId: '', nodeName: '', nodeType: 'transform', stepOrder: 0 },
      payload: {
        input: { type: 'text', content: null },
        output: {
          type: 'stream',
          content: outputs.length === 1 ? outputs[0].content : null,
          streams: outputs.map(o => ({ streamId: o.id, content: o.content, latencyMs: 0, tokensUsed: 0 })),
        },
      },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costCents: 0, latencyMs: 0 },
      tracing: { traceId: '', spanId: '', workflowSpanId: '', timestamp: new Date().toISOString(), durationMs: 0 },
    };
  }
}

// Singleton instance
export const uepNodeService = new UEPNodeService();

export default uepNodeService;
