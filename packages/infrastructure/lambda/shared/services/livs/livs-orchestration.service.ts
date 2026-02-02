/**
 * LIVS Orchestration Integrity Service
 * 
 * Tier 2: Prevents multi-model pipelines from amplifying lies.
 * Detects orchestration failure patterns like:
 * - Watermelon Pipeline (green outside, red inside)
 * - Echo Chamber (all models agree without verification)
 * - Confidence Inflation
 * - Circular Reasoning
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  PreActionResult,
  PreActionDecision,
  PipelineIntegrityScore,
  PipelineIntegrityAudit,
  OrchestrationFailurePattern,
  OrchestrationIntegrityProfile
} from '@radiant/shared';
import { LIVSConfigService } from './livs-config.service';
import { LIVSInterrogatorService } from './livs-interrogator.service';

export interface MethodOutput {
  methodId: string;
  modelId: string;
  output: string;
  confidence: number;
  citations?: string[];
  metadata?: Record<string, unknown>;
}

export interface PipelineExecution {
  id: string;
  tenantId: string;
  originalQuery: string;
  methods: MethodOutput[];
  finalOutput?: string;
  finalConfidence?: number;
}

export interface LIVSOrchestrationServiceDeps {
  pool: Pool;
  configService: LIVSConfigService;
  interrogatorService: LIVSInterrogatorService;
}

export class LIVSOrchestrationService {
  private pool: Pool;
  private configService: LIVSConfigService;
  private interrogatorService: LIVSInterrogatorService;

  constructor(deps: LIVSOrchestrationServiceDeps) {
    this.pool = deps.pool;
    this.configService = deps.configService;
    this.interrogatorService = deps.interrogatorService;
  }

  /**
   * Pre-action interrogation before a method acts on upstream output
   */
  async preActionCheck(
    tenantId: string,
    upstreamOutput: MethodOutput,
    nextMethodId: string
  ): Promise<PreActionResult> {
    // Check if orchestration integrity is enabled
    const enabled = await this.configService.isOrchestrationIntegrityEnabled(tenantId);
    if (!enabled) {
      return {
        decision: 'proceed',
        issues: [],
        upstreamConfidence: upstreamOutput.confidence,
        recommendations: []
      };
    }

    const config = await this.configService.getConfig(tenantId);
    if (!config.orchestrationIntegrity.preActionInterrogation) {
      return {
        decision: 'proceed',
        issues: [],
        upstreamConfidence: upstreamOutput.confidence,
        recommendations: []
      };
    }

    const issues: PreActionResult['issues'] = [];
    const recommendations: string[] = [];

    // Check for missing information
    if (!upstreamOutput.output || upstreamOutput.output.trim().length < 10) {
      issues.push({
        type: 'missing_info',
        description: 'Upstream output is empty or too short',
        severity: 'high'
      });
    }

    // Check for unverified assumptions
    const assumptionPatterns = [
      /assuming|assume|presuming|presume/gi,
      /should be|might be|could be/gi,
      /probably|likely|possibly/gi
    ];

    for (const pattern of assumptionPatterns) {
      if (pattern.test(upstreamOutput.output)) {
        issues.push({
          type: 'unverified_assumption',
          description: 'Upstream output contains unverified assumptions',
          severity: 'medium'
        });
        recommendations.push('Verify assumptions before proceeding');
        break;
      }
    }

    // Check confidence threshold
    const maxConfidence = config.orchestrationIntegrity.maxConfidencePropagation;
    if (upstreamOutput.confidence > maxConfidence) {
      issues.push({
        type: 'confidence_inflation',
        description: `Confidence ${upstreamOutput.confidence} exceeds max ${maxConfidence}`,
        severity: 'medium'
      });
      recommendations.push('Cap confidence at maximum allowed level');
    }

    // Determine decision
    let decision: PreActionDecision = 'proceed';
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0) {
      decision = 'halt_for_review';
    } else if (highIssues > 0) {
      decision = 'flag_and_proceed';
    }

    return {
      decision,
      issues,
      upstreamConfidence: Math.min(upstreamOutput.confidence, maxConfidence),
      recommendations
    };
  }

  /**
   * Validate a complete pipeline execution
   */
  async validatePipeline(
    execution: PipelineExecution
  ): Promise<PipelineIntegrityAudit> {
    const id = uuidv4();
    const { tenantId } = execution;

    // Check if orchestration integrity is enabled
    const enabled = await this.configService.isOrchestrationIntegrityEnabled(tenantId);
    if (!enabled) {
      return this.createPassingAudit(id, execution);
    }

    // Calculate individual method scores
    const methodScores: PipelineIntegrityScore['methodScores'] = {};
    for (const method of execution.methods) {
      methodScores[method.methodId] = {
        integrityScore: method.confidence,
        lieDetected: false,
        issues: []
      };
    }

    // Detect failure patterns
    const detectedPatterns: OrchestrationFailurePattern[] = [];
    const issues: PipelineIntegrityAudit['issues'] = [];

    // Check for Watermelon Pipeline
    const watermelonResult = this.detectWatermelon(execution);
    if (watermelonResult.detected) {
      detectedPatterns.push('watermelon_pipeline');
      issues.push({
        pattern: 'watermelon_pipeline',
        description: watermelonResult.description,
        severity: 'high',
        evidence: watermelonResult.evidence
      });
    }

    // Check for Echo Chamber
    const echoChamberResult = this.detectEchoChamber(execution);
    if (echoChamberResult.detected) {
      detectedPatterns.push('echo_chamber');
      issues.push({
        pattern: 'echo_chamber',
        description: echoChamberResult.description,
        severity: 'medium',
        evidence: echoChamberResult.evidence
      });
    }

    // Check for Confidence Inflation
    const inflationResult = this.detectConfidenceInflation(execution);
    if (inflationResult.detected) {
      detectedPatterns.push('confidence_inflation');
      issues.push({
        pattern: 'confidence_inflation',
        description: inflationResult.description,
        severity: 'medium',
        evidence: inflationResult.evidence
      });
    }

    // Check for Circular Reasoning
    const circularResult = this.detectCircularReasoning(execution);
    if (circularResult.detected) {
      detectedPatterns.push('circular_reasoning');
      issues.push({
        pattern: 'circular_reasoning',
        description: circularResult.description,
        severity: 'high',
        evidence: circularResult.evidence
      });
    }

    // Check for Scope Drift
    const scopeDriftResult = this.detectScopeDrift(execution);
    if (scopeDriftResult.detected) {
      detectedPatterns.push('scope_drift');
      issues.push({
        pattern: 'scope_drift',
        description: scopeDriftResult.description,
        severity: 'medium',
        evidence: scopeDriftResult.evidence
      });
    }

    // Calculate aggregate scores
    const consistencyScore = this.calculateConsistencyScore(execution);
    const evidenceChainScore = this.calculateEvidenceChainScore(execution);
    const goalAlignmentScore = this.calculateGoalAlignmentScore(execution);

    // Calculate overall integrity score
    const patternPenalty = detectedPatterns.length * 0.15;
    const issuePenalty = issues.reduce((sum, issue) => {
      switch (issue.severity) {
        case 'critical': return sum + 0.3;
        case 'high': return sum + 0.2;
        case 'medium': return sum + 0.1;
        default: return sum + 0.05;
      }
    }, 0);

    const overallIntegrityScore = Math.max(0, Math.min(1,
      (consistencyScore * 0.3 + evidenceChainScore * 0.3 + goalAlignmentScore * 0.4) -
      patternPenalty - issuePenalty
    ));

    // Generate recommendations
    const recommendations = this.generateRecommendations(detectedPatterns, issues);

    const scores: PipelineIntegrityScore = {
      methodScores,
      consistencyScore,
      evidenceChainScore,
      goalAlignmentScore,
      overallIntegrityScore,
      detectedPatterns
    };

    const audit: PipelineIntegrityAudit = {
      id,
      tenantId,
      pipelineExecutionId: execution.id,
      scores,
      issues,
      recommendations,
      createdAt: new Date()
    };

    // Store the audit
    await this.storeAudit(audit);

    // Update orchestration weights
    await this.updateOrchestrationWeights(execution, audit);

    return audit;
  }

  /**
   * Detect Watermelon Pipeline (high final confidence, weak intermediates)
   */
  private detectWatermelon(execution: PipelineExecution): {
    detected: boolean;
    description: string;
    evidence: string;
  } {
    if (execution.methods.length < 2 || !execution.finalConfidence) {
      return { detected: false, description: '', evidence: '' };
    }

    const avgIntermediate = execution.methods.reduce(
      (sum, m) => sum + m.confidence, 0
    ) / execution.methods.length;

    const delta = execution.finalConfidence - avgIntermediate;

    if (delta > 0.2) {
      return {
        detected: true,
        description: 'Final confidence significantly higher than intermediate steps',
        evidence: `Final: ${execution.finalConfidence.toFixed(2)}, Avg intermediate: ${avgIntermediate.toFixed(2)}, Delta: ${delta.toFixed(2)}`
      };
    }

    return { detected: false, description: '', evidence: '' };
  }

  /**
   * Detect Echo Chamber (all models agree without independent verification)
   */
  private detectEchoChamber(execution: PipelineExecution): {
    detected: boolean;
    description: string;
    evidence: string;
  } {
    if (execution.methods.length < 3) {
      return { detected: false, description: '', evidence: '' };
    }

    // Check if all outputs are very similar
    const outputs = execution.methods.map(m => m.output.toLowerCase());
    let similarityCount = 0;
    
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        if (this.calculateSimilarity(outputs[i], outputs[j]) > 0.8) {
          similarityCount++;
        }
      }
    }

    const totalPairs = (outputs.length * (outputs.length - 1)) / 2;
    const agreementRatio = similarityCount / totalPairs;

    // Check if any have independent citations
    const hasCitations = execution.methods.some(
      m => m.citations && m.citations.length > 0
    );

    if (agreementRatio > 0.7 && !hasCitations) {
      return {
        detected: true,
        description: 'All models agree without independent verification',
        evidence: `Agreement ratio: ${(agreementRatio * 100).toFixed(0)}%, No citations found`
      };
    }

    return { detected: false, description: '', evidence: '' };
  }

  /**
   * Detect Confidence Inflation (monotonic confidence increase)
   */
  private detectConfidenceInflation(execution: PipelineExecution): {
    detected: boolean;
    description: string;
    evidence: string;
  } {
    if (execution.methods.length < 3) {
      return { detected: false, description: '', evidence: '' };
    }

    const confidences = execution.methods.map(m => m.confidence);
    let increases = 0;

    for (let i = 1; i < confidences.length; i++) {
      if (confidences[i] > confidences[i - 1]) {
        increases++;
      }
    }

    const inflationRatio = increases / (confidences.length - 1);

    if (inflationRatio > 0.8 && confidences[confidences.length - 1] > confidences[0] + 0.3) {
      return {
        detected: true,
        description: 'Confidence increases monotonically through pipeline',
        evidence: `Inflation ratio: ${(inflationRatio * 100).toFixed(0)}%, Start: ${confidences[0].toFixed(2)}, End: ${confidences[confidences.length - 1].toFixed(2)}`
      };
    }

    return { detected: false, description: '', evidence: '' };
  }

  /**
   * Detect Circular Reasoning (models citing each other)
   */
  private detectCircularReasoning(execution: PipelineExecution): {
    detected: boolean;
    description: string;
    evidence: string;
  } {
    // Build citation graph
    const citationGraph = new Map<string, Set<string>>();

    for (const method of execution.methods) {
      const cites = new Set<string>();
      
      // Check if output references other methods
      for (const other of execution.methods) {
        if (other.methodId !== method.methodId) {
          if (
            method.output.includes(other.methodId) ||
            method.output.includes(`method ${other.methodId}`) ||
            method.output.includes(`previous step`)
          ) {
            cites.add(other.methodId);
          }
        }
      }

      citationGraph.set(method.methodId, cites);
    }

    // Detect cycles using DFS
    const hasCycle = this.detectCycleInGraph(citationGraph);

    if (hasCycle) {
      return {
        detected: true,
        description: 'Circular reference detected between pipeline methods',
        evidence: 'Methods reference each other in a cycle'
      };
    }

    return { detected: false, description: '', evidence: '' };
  }

  /**
   * Detect Scope Drift (final output doesn't match original intent)
   */
  private detectScopeDrift(execution: PipelineExecution): {
    detected: boolean;
    description: string;
    evidence: string;
  } {
    if (!execution.finalOutput) {
      return { detected: false, description: '', evidence: '' };
    }

    // Simple keyword overlap check
    const queryKeywords = this.extractKeywords(execution.originalQuery);
    const outputKeywords = this.extractKeywords(execution.finalOutput);

    const overlap = queryKeywords.filter(k => outputKeywords.includes(k)).length;
    const overlapRatio = queryKeywords.length > 0 ? overlap / queryKeywords.length : 1;

    if (overlapRatio < 0.3) {
      return {
        detected: true,
        description: 'Final output significantly differs from original query intent',
        evidence: `Keyword overlap: ${(overlapRatio * 100).toFixed(0)}%`
      };
    }

    return { detected: false, description: '', evidence: '' };
  }

  /**
   * Calculate consistency score across methods
   */
  private calculateConsistencyScore(execution: PipelineExecution): number {
    if (execution.methods.length < 2) return 1;

    let consistentPairs = 0;
    let totalPairs = 0;

    for (let i = 0; i < execution.methods.length; i++) {
      for (let j = i + 1; j < execution.methods.length; j++) {
        totalPairs++;
        // Check for contradictions
        if (!this.detectContradiction(
          execution.methods[i].output,
          execution.methods[j].output
        )) {
          consistentPairs++;
        }
      }
    }

    return totalPairs > 0 ? consistentPairs / totalPairs : 1;
  }

  /**
   * Calculate evidence chain score
   */
  private calculateEvidenceChainScore(execution: PipelineExecution): number {
    const methodsWithCitations = execution.methods.filter(
      m => m.citations && m.citations.length > 0
    ).length;

    return execution.methods.length > 0 
      ? methodsWithCitations / execution.methods.length 
      : 0;
  }

  /**
   * Calculate goal alignment score
   */
  private calculateGoalAlignmentScore(execution: PipelineExecution): number {
    if (!execution.finalOutput) return 0.5;

    const queryKeywords = this.extractKeywords(execution.originalQuery);
    const outputKeywords = this.extractKeywords(execution.finalOutput);

    if (queryKeywords.length === 0) return 0.5;

    const overlap = queryKeywords.filter(k => outputKeywords.includes(k)).length;
    return Math.min(1, overlap / queryKeywords.length + 0.2);
  }

  /**
   * Generate recommendations based on detected issues
   */
  private generateRecommendations(
    patterns: OrchestrationFailurePattern[],
    issues: PipelineIntegrityAudit['issues']
  ): string[] {
    const recommendations: string[] = [];

    if (patterns.includes('watermelon_pipeline')) {
      recommendations.push('Require evidence at each pipeline stage');
      recommendations.push('Add validation checkpoints between methods');
    }

    if (patterns.includes('echo_chamber')) {
      recommendations.push('Include adversarial model in pipeline');
      recommendations.push('Require independent source citations');
    }

    if (patterns.includes('confidence_inflation')) {
      recommendations.push('Cap confidence propagation between stages');
      recommendations.push('Reset confidence at critical checkpoints');
    }

    if (patterns.includes('circular_reasoning')) {
      recommendations.push('Break citation cycles with external sources');
      recommendations.push('Restructure pipeline to avoid self-reference');
    }

    if (patterns.includes('scope_drift')) {
      recommendations.push('Add goal alignment check at final stage');
      recommendations.push('Include query keywords in validation');
    }

    return recommendations;
  }

  /**
   * Store audit result in database
   */
  private async storeAudit(audit: PipelineIntegrityAudit): Promise<void> {
    await this.pool.query(
      `INSERT INTO livs_pipeline_audits (
        id, tenant_id, pipeline_execution_id, method_scores,
        consistency_score, evidence_chain_score, goal_alignment_score,
        overall_integrity_score, detected_patterns, issues, recommendations, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        audit.id,
        audit.tenantId,
        audit.pipelineExecutionId,
        JSON.stringify(audit.scores.methodScores),
        audit.scores.consistencyScore,
        audit.scores.evidenceChainScore,
        audit.scores.goalAlignmentScore,
        audit.scores.overallIntegrityScore,
        JSON.stringify(audit.scores.detectedPatterns),
        JSON.stringify(audit.issues),
        JSON.stringify(audit.recommendations),
        audit.createdAt
      ]
    );
  }

  /**
   * Update orchestration weights based on audit
   */
  private async updateOrchestrationWeights(
    execution: PipelineExecution,
    audit: PipelineIntegrityAudit
  ): Promise<void> {
    // Extract pattern ID from methods
    const patternId = execution.methods.map(m => m.methodId).join('->');
    const successful = audit.scores.overallIntegrityScore > 0.7;

    await this.pool.query(
      `INSERT INTO livs_orchestration_weights (
        tenant_id, pattern_id, total_executions, successful_executions,
        reliability_score, failure_mode_history, last_updated
      ) VALUES ($1, $2, 1, $3, $4, $5, NOW())
      ON CONFLICT (tenant_id, pattern_id) DO UPDATE SET
        total_executions = livs_orchestration_weights.total_executions + 1,
        successful_executions = livs_orchestration_weights.successful_executions + $3,
        reliability_score = (livs_orchestration_weights.successful_executions + $3)::decimal / 
                           (livs_orchestration_weights.total_executions + 1),
        failure_mode_history = livs_orchestration_weights.failure_mode_history || $5,
        last_updated = NOW()`,
      [
        execution.tenantId,
        patternId,
        successful ? 1 : 0,
        successful ? 1.0 : 0.0,
        JSON.stringify(
          audit.scores.detectedPatterns.reduce(
            (acc, p) => ({ ...acc, [p]: 1 }),
            {}
          )
        )
      ]
    );
  }

  /**
   * Create a passing audit (when integrity checking is disabled)
   */
  private createPassingAudit(
    id: string,
    execution: PipelineExecution
  ): PipelineIntegrityAudit {
    const methodScores: PipelineIntegrityScore['methodScores'] = {};
    for (const method of execution.methods) {
      methodScores[method.methodId] = {
        integrityScore: 1,
        lieDetected: false,
        issues: []
      };
    }

    return {
      id,
      tenantId: execution.tenantId,
      pipelineExecutionId: execution.id,
      scores: {
        methodScores,
        consistencyScore: 1,
        evidenceChainScore: 1,
        goalAlignmentScore: 1,
        overallIntegrityScore: 1,
        detectedPatterns: []
      },
      issues: [],
      recommendations: [],
      createdAt: new Date()
    };
  }

  /**
   * Get orchestration profile for a pattern
   */
  async getOrchestrationProfile(
    tenantId: string,
    patternId: string
  ): Promise<OrchestrationIntegrityProfile | null> {
    const result = await this.pool.query(
      `SELECT * FROM livs_orchestration_weights WHERE tenant_id = $1 AND pattern_id = $2`,
      [tenantId, patternId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      tenantId: row.tenant_id,
      patternId: row.pattern_id,
      totalExecutions: row.total_executions,
      successfulExecutions: row.successful_executions,
      reliabilityScore: parseFloat(row.reliability_score),
      failureModeHistory: row.failure_mode_history,
      modelCompatibility: row.model_compatibility,
      lastUpdated: new Date(row.last_updated)
    };
  }

  /**
   * Get recent audits
   */
  async getRecentAudits(
    tenantId: string,
    limit: number = 20
  ): Promise<PipelineIntegrityAudit[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_pipeline_audits
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      pipelineExecutionId: row.pipeline_execution_id,
      scores: {
        methodScores: row.method_scores,
        consistencyScore: parseFloat(row.consistency_score),
        evidenceChainScore: parseFloat(row.evidence_chain_score),
        goalAlignmentScore: parseFloat(row.goal_alignment_score),
        overallIntegrityScore: parseFloat(row.overall_integrity_score),
        detectedPatterns: row.detected_patterns
      },
      issues: row.issues,
      recommendations: row.recommendations,
      createdAt: new Date(row.created_at)
    }));
  }

  // Helper methods

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    return union > 0 ? intersection / union : 0;
  }

  private detectCycleInGraph(graph: Map<string, Set<string>>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node) && dfs(node)) {
        return true;
      }
    }

    return false;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
      'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  private detectContradiction(text1: string, text2: string): boolean {
    const negationWords = ['not', 'never', "don't", "doesn't", "won't", "can't", 'no', 'none'];
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    for (const neg of negationWords) {
      const idx1 = words1.indexOf(neg);
      const idx2 = words2.indexOf(neg);

      if (idx1 >= 0 && idx2 < 0) {
        const nextWord = words1[idx1 + 1];
        if (nextWord && words2.includes(nextWord)) {
          return true;
        }
      }
      if (idx2 >= 0 && idx1 < 0) {
        const nextWord = words2[idx2 + 1];
        if (nextWord && words1.includes(nextWord)) {
          return true;
        }
      }
    }

    return false;
  }
}
