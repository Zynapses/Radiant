// RADIANT v4.18.0 - Metacognition Service
// AGI Enhancement Phase 3: Self-awareness, confidence monitoring, error detection, and self-improvement

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import { episodicMemoryService } from './episodic-memory.service';

// ============================================================================
// Types
// ============================================================================

export type ErrorType = 'factual' | 'logical' | 'consistency' | 'hallucination' | 'incomplete' | 'misunderstanding';
export type ErrorSeverity = 'critical' | 'major' | 'minor' | 'trivial';
export type KnowledgeLevel = 'expert' | 'proficient' | 'familiar' | 'limited' | 'unknown';
export type ImprovementStatus = 'identified' | 'planning' | 'in_progress' | 'completed' | 'abandoned';

export interface ConfidenceAssessment {
  assessmentId: string;
  subjectType: string;
  subjectContent: string;
  overallConfidence: number;
  confidenceFactors: ConfidenceFactors;
  knownUnknowns: string[];
  potentialErrors: string[];
  assumptions: string[];
  predictedAccuracy?: number;
  actualAccuracy?: number;
}

export interface ConfidenceFactors {
  knowledge: number;      // Do I have relevant knowledge?
  reasoning: number;      // Is my reasoning sound?
  evidence: number;       // Do I have supporting evidence?
  consistency: number;    // Is this consistent with other information?
  specificity: number;    // How specific vs vague is this?
}

export interface DetectedError {
  errorId: string;
  errorType: ErrorType;
  severity: ErrorSeverity;
  sourceType: string;
  sourceContent: string;
  errorDescription: string;
  errorLocation?: string;
  errorEvidence: Record<string, unknown>;
  correctionProposed?: string;
  correctionApplied: boolean;
  resolutionStatus: string;
}

export interface KnowledgeBoundary {
  boundaryId: string;
  domain: string;
  topic: string;
  knowledgeLevel: KnowledgeLevel;
  confidenceInAssessment: number;
  evidenceForLevel: Record<string, unknown>;
  lastDemonstrated?: Date;
}

export interface StrategyPerformance {
  strategyType: string;
  strategyName: string;
  timesUsed: number;
  timesSuccessful: number;
  successRate: number;
  avgConfidence: number;
  avgLatencyMs: number;
}

export interface SelfReflection {
  reflectionId: string;
  triggerType: string;
  reflectionFocus: string;
  thoughtProcess: string;
  insights: ReflectionInsight[];
  patternsNoticed: string[];
  performanceRating: number;
  areasForImprovement: string[];
}

export interface ReflectionInsight {
  insight: string;
  confidence: number;
  actionable: boolean;
}

export interface MetacognitiveSettings {
  confidenceMonitoringEnabled: boolean;
  errorDetectionEnabled: boolean;
  selfReflectionEnabled: boolean;
  strategyOptimizationEnabled: boolean;
  knowledgeBoundaryTracking: boolean;
  lowConfidenceThreshold: number;
  highConfidenceThreshold: number;
  admitUncertaintyThreshold: number;
  uncertaintyEscalationEnabled: boolean;
}

export interface ThoughtWithConfidence {
  thought: string;
  confidence: ConfidenceAssessment;
  shouldAdmitUncertainty: boolean;
  suggestedCaveats: string[];
}

// ============================================================================
// Metacognition Service
// ============================================================================

export class MetacognitionService {
  // ============================================================================
  // Confidence Assessment
  // ============================================================================

  async assessConfidence(
    tenantId: string,
    content: string,
    subjectType: string,
    context?: { sessionId?: string; userId?: string }
  ): Promise<ConfidenceAssessment> {
    const prompt = `Analyze the following content and assess your confidence in its accuracy and quality.

CONTENT TO ASSESS:
"""
${content.substring(0, 3000)}
"""

Provide a detailed confidence assessment. Consider:
1. How well do you know this domain/topic?
2. Is the reasoning sound and logical?
3. What evidence supports this?
4. Is this consistent with known facts?
5. How specific vs vague is this response?

Return JSON:
{
  "overall_confidence": 0.0-1.0,
  "confidence_factors": {
    "knowledge": 0.0-1.0,
    "reasoning": 0.0-1.0,
    "evidence": 0.0-1.0,
    "consistency": 0.0-1.0,
    "specificity": 0.0-1.0
  },
  "known_unknowns": ["things you know you don't know"],
  "potential_errors": ["possible error types"],
  "assumptions": ["assumptions made"]
}`;

    const response = await this.invokeModel(prompt);
    let assessment: Partial<ConfidenceAssessment> = {
      overallConfidence: 0.5,
      confidenceFactors: { knowledge: 0.5, reasoning: 0.5, evidence: 0.5, consistency: 0.5, specificity: 0.5 },
      knownUnknowns: [],
      potentialErrors: [],
      assumptions: [],
    };

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        assessment = {
          overallConfidence: parsed.overall_confidence || 0.5,
          confidenceFactors: {
            knowledge: parsed.confidence_factors?.knowledge || 0.5,
            reasoning: parsed.confidence_factors?.reasoning || 0.5,
            evidence: parsed.confidence_factors?.evidence || 0.5,
            consistency: parsed.confidence_factors?.consistency || 0.5,
            specificity: parsed.confidence_factors?.specificity || 0.5,
          },
          knownUnknowns: parsed.known_unknowns || [],
          potentialErrors: parsed.potential_errors || [],
          assumptions: parsed.assumptions || [],
        };
      }
    } catch { /* use defaults */ }

    // Store assessment
    const result = await executeStatement(
      `INSERT INTO confidence_assessments (
        tenant_id, session_id, user_id, subject_type, subject_content,
        overall_confidence, confidence_factors, known_unknowns, potential_errors, assumptions,
        predicted_accuracy, assessment_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $6, 'self_eval')
      RETURNING assessment_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'sessionId', value: context?.sessionId ? { stringValue: context.sessionId } : { isNull: true } },
        { name: 'userId', value: context?.userId ? { stringValue: context.userId } : { isNull: true } },
        { name: 'subjectType', value: { stringValue: subjectType } },
        { name: 'subjectContent', value: { stringValue: content.substring(0, 10000) } },
        { name: 'confidence', value: { doubleValue: assessment.overallConfidence! } },
        { name: 'factors', value: { stringValue: JSON.stringify(assessment.confidenceFactors) } },
        { name: 'unknowns', value: { stringValue: JSON.stringify(assessment.knownUnknowns) } },
        { name: 'errors', value: { stringValue: JSON.stringify(assessment.potentialErrors) } },
        { name: 'assumptions', value: { stringValue: JSON.stringify(assessment.assumptions) } },
      ]
    );

    return {
      assessmentId: (result.rows[0] as { assessment_id: string }).assessment_id,
      subjectType,
      subjectContent: content,
      ...assessment as Required<Pick<ConfidenceAssessment, 'overallConfidence' | 'confidenceFactors' | 'knownUnknowns' | 'potentialErrors' | 'assumptions'>>,
    };
  }

  async shouldAdmitUncertainty(tenantId: string, confidence: number): Promise<{ shouldAdmit: boolean; threshold: number }> {
    const settings = await this.getSettings(tenantId);
    return {
      shouldAdmit: confidence < settings.admitUncertaintyThreshold,
      threshold: settings.admitUncertaintyThreshold,
    };
  }

  async generateUncertaintyResponse(content: string, confidence: ConfidenceAssessment): Promise<ThoughtWithConfidence> {
    const shouldAdmit = confidence.overallConfidence < 0.3;
    const suggestedCaveats: string[] = [];

    if (confidence.confidenceFactors.knowledge < 0.5) {
      suggestedCaveats.push('I have limited knowledge in this specific area');
    }
    if (confidence.confidenceFactors.evidence < 0.5) {
      suggestedCaveats.push('I don\'t have strong evidence to support this');
    }
    if (confidence.knownUnknowns.length > 0) {
      suggestedCaveats.push(`There are aspects I\'m uncertain about: ${confidence.knownUnknowns.slice(0, 2).join(', ')}`);
    }
    if (confidence.assumptions.length > 0) {
      suggestedCaveats.push(`This assumes: ${confidence.assumptions.slice(0, 2).join(', ')}`);
    }

    return {
      thought: content,
      confidence,
      shouldAdmitUncertainty: shouldAdmit,
      suggestedCaveats,
    };
  }

  // ============================================================================
  // Error Detection
  // ============================================================================

  async detectErrors(
    tenantId: string,
    content: string,
    sourceType: string,
    context?: { sessionId?: string; expectedPattern?: string }
  ): Promise<DetectedError[]> {
    const prompt = `Analyze the following content for potential errors.

CONTENT TO CHECK:
"""
${content.substring(0, 3000)}
"""

${context?.expectedPattern ? `EXPECTED PATTERN: ${context.expectedPattern}` : ''}

Look for:
1. Factual errors - incorrect information
2. Logical errors - flawed reasoning, contradictions
3. Consistency errors - conflicts with context
4. Hallucinations - made-up information without basis
5. Incomplete responses - missing important information
6. Misunderstandings - misinterpreting the question/task

Return JSON array (empty if no errors found):
[
  {
    "error_type": "factual|logical|consistency|hallucination|incomplete|misunderstanding",
    "severity": "critical|major|minor|trivial",
    "description": "what the error is",
    "location": "where in the content",
    "evidence": {"why": "this is an error"},
    "correction": "proposed fix"
  }
]`;

    const response = await this.invokeModel(prompt);
    const errors: DetectedError[] = [];

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          error_type: ErrorType;
          severity: ErrorSeverity;
          description: string;
          location?: string;
          evidence?: Record<string, unknown>;
          correction?: string;
        }>;

        for (const error of parsed) {
          const result = await executeStatement(
            `INSERT INTO detected_errors (
              tenant_id, session_id, error_type, severity, source_type, source_content,
              error_description, error_location, error_evidence, correction_proposed, detection_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'self_check')
            RETURNING error_id`,
            [
              { name: 'tenantId', value: { stringValue: tenantId } },
              { name: 'sessionId', value: context?.sessionId ? { stringValue: context.sessionId } : { isNull: true } },
              { name: 'errorType', value: { stringValue: error.error_type } },
              { name: 'severity', value: { stringValue: error.severity } },
              { name: 'sourceType', value: { stringValue: sourceType } },
              { name: 'sourceContent', value: { stringValue: content.substring(0, 5000) } },
              { name: 'description', value: { stringValue: error.description } },
              { name: 'location', value: error.location ? { stringValue: error.location } : { isNull: true } },
              { name: 'evidence', value: { stringValue: JSON.stringify(error.evidence || {}) } },
              { name: 'correction', value: error.correction ? { stringValue: error.correction } : { isNull: true } },
            ]
          );

          errors.push({
            errorId: (result.rows[0] as { error_id: string }).error_id,
            errorType: error.error_type,
            severity: error.severity,
            sourceType,
            sourceContent: content,
            errorDescription: error.description,
            errorLocation: error.location,
            errorEvidence: error.evidence || {},
            correctionProposed: error.correction,
            correctionApplied: false,
            resolutionStatus: 'detected',
          });
        }
      }
    } catch { /* no errors found or parsing failed */ }

    return errors;
  }

  async applyCorrection(tenantId: string, errorId: string, correction: string): Promise<void> {
    await executeStatement(
      `UPDATE detected_errors SET
        correction_proposed = $2,
        correction_applied = true,
        resolution_status = 'corrected',
        resolved_at = NOW()
      WHERE error_id = $1`,
      [
        { name: 'errorId', value: { stringValue: errorId } },
        { name: 'correction', value: { stringValue: correction } },
      ]
    );
  }

  async getUnresolvedErrors(tenantId: string, minSeverity: ErrorSeverity = 'minor'): Promise<DetectedError[]> {
    const severityOrder = { critical: 0, major: 1, minor: 2, trivial: 3 };
    const minLevel = severityOrder[minSeverity];

    const result = await executeStatement(
      `SELECT * FROM detected_errors 
       WHERE tenant_id = $1 AND resolution_status NOT IN ('corrected', 'dismissed')
       ORDER BY 
         CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT 50`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows
      .map((row) => this.mapDetectedError(row as Record<string, unknown>))
      .filter((e) => severityOrder[e.severity] <= minLevel);
  }

  // ============================================================================
  // Knowledge Boundary Tracking
  // ============================================================================

  async assessKnowledgeBoundary(
    tenantId: string,
    topic: string,
    domain?: string
  ): Promise<KnowledgeBoundary> {
    const topicEmbedding = await this.generateEmbedding(topic);

    // Check if we have an existing assessment
    const existing = await executeStatement(
      `SELECT * FROM knowledge_boundaries
       WHERE tenant_id = $1 AND LOWER(topic) = LOWER($2) AND is_active = true
       LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'topic', value: { stringValue: topic } },
      ]
    );

    if (existing.rows.length > 0) {
      return this.mapKnowledgeBoundary(existing.rows[0] as Record<string, unknown>);
    }

    // Assess knowledge level for new topic
    const prompt = `Assess your knowledge level on this topic.

TOPIC: ${topic}
${domain ? `DOMAIN: ${domain}` : ''}

Consider:
1. How much do you know about this specific topic?
2. How confident are you in that knowledge?
3. What evidence supports your knowledge level?

Return JSON:
{
  "knowledge_level": "expert|proficient|familiar|limited|unknown",
  "confidence_in_assessment": 0.0-1.0,
  "evidence": {
    "training_data_coverage": "high|medium|low|none",
    "recency": "current|recent|dated|unknown",
    "depth": "comprehensive|moderate|superficial|none"
  },
  "reasoning": "why you assessed this level"
}`;

    const response = await this.invokeModel(prompt);
    let assessment = {
      knowledge_level: 'limited' as KnowledgeLevel,
      confidence_in_assessment: 0.5,
      evidence: {},
    };

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        assessment = {
          knowledge_level: parsed.knowledge_level || 'limited',
          confidence_in_assessment: parsed.confidence_in_assessment || 0.5,
          evidence: parsed.evidence || {},
        };
      }
    } catch { /* use defaults */ }

    const result = await executeStatement(
      `INSERT INTO knowledge_boundaries (
        tenant_id, domain, topic, topic_embedding, knowledge_level, 
        confidence_in_assessment, evidence_for_level
      ) VALUES ($1, $2, $3, $4::vector, $5, $6, $7)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'domain', value: { stringValue: domain || 'general' } },
        { name: 'topic', value: { stringValue: topic } },
        { name: 'embedding', value: { stringValue: `[${topicEmbedding.join(',')}]` } },
        { name: 'level', value: { stringValue: assessment.knowledge_level } },
        { name: 'confidence', value: { doubleValue: assessment.confidence_in_assessment } },
        { name: 'evidence', value: { stringValue: JSON.stringify(assessment.evidence) } },
      ]
    );

    return this.mapKnowledgeBoundary(result.rows[0] as Record<string, unknown>);
  }

  async findSimilarKnowledgeAreas(tenantId: string, topic: string, limit = 5): Promise<KnowledgeBoundary[]> {
    const embedding = await this.generateEmbedding(topic);

    const result = await executeStatement(
      `SELECT *, 1 - (topic_embedding <=> $2::vector) as similarity
       FROM knowledge_boundaries
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY topic_embedding <=> $2::vector
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map((row) => this.mapKnowledgeBoundary(row as Record<string, unknown>));
  }

  // ============================================================================
  // Strategy Selection & Optimization
  // ============================================================================

  async selectStrategy(
    tenantId: string,
    taskType: string,
    taskComplexity: string,
    constraints?: { maxLatencyMs?: number; maxCost?: number }
  ): Promise<{ strategy: StrategyPerformance; reasoning: string }> {
    // Get historical performance data
    const result = await executeStatement(
      `SELECT * FROM strategy_performance
       WHERE tenant_id = $1 AND task_type = $2 AND is_active = true
       ORDER BY (times_successful::DECIMAL / NULLIF(times_used, 0)) DESC, avg_latency_ms ASC
       LIMIT 10`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'taskType', value: { stringValue: taskType } },
      ]
    );

    const strategies = result.rows.map((row) => this.mapStrategyPerformance(row as Record<string, unknown>));

    if (strategies.length === 0) {
      // Return default strategy
      return {
        strategy: {
          strategyType: 'default',
          strategyName: 'standard_processing',
          timesUsed: 0,
          timesSuccessful: 0,
          successRate: 0,
          avgConfidence: 0.5,
          avgLatencyMs: 1000,
        },
        reasoning: 'No historical data available, using default strategy',
      };
    }

    // Filter by constraints
    let candidates = strategies;
    if (constraints?.maxLatencyMs) {
      candidates = candidates.filter((s) => s.avgLatencyMs <= constraints.maxLatencyMs!);
    }

    // Select best strategy
    const best = candidates[0] || strategies[0];

    return {
      strategy: best,
      reasoning: `Selected ${best.strategyName} based on ${(best.successRate * 100).toFixed(0)}% success rate over ${best.timesUsed} uses`,
    };
  }

  async recordStrategyOutcome(
    tenantId: string,
    strategyType: string,
    strategyName: string,
    taskType: string,
    success: boolean,
    confidence: number,
    latencyMs: number
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO strategy_performance (
        tenant_id, strategy_type, strategy_name, task_type, times_used, times_successful,
        avg_confidence, avg_latency_ms
      ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
      ON CONFLICT ON CONSTRAINT unique_strategy_per_tenant DO UPDATE SET
        times_used = strategy_performance.times_used + 1,
        times_successful = strategy_performance.times_successful + $5,
        avg_confidence = (strategy_performance.avg_confidence * strategy_performance.times_used + $6) / (strategy_performance.times_used + 1),
        avg_latency_ms = (strategy_performance.avg_latency_ms * strategy_performance.times_used + $7) / (strategy_performance.times_used + 1),
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'strategyType', value: { stringValue: strategyType } },
        { name: 'strategyName', value: { stringValue: strategyName } },
        { name: 'taskType', value: { stringValue: taskType } },
        { name: 'success', value: { longValue: success ? 1 : 0 } },
        { name: 'confidence', value: { doubleValue: confidence } },
        { name: 'latencyMs', value: { doubleValue: latencyMs } },
      ]
    );
  }

  // ============================================================================
  // Self-Reflection
  // ============================================================================

  async performReflection(
    tenantId: string,
    focus: string,
    context: {
      sessionId?: string;
      triggerType: string;
      recentOutputs?: string[];
      recentErrors?: DetectedError[];
    }
  ): Promise<SelfReflection> {
    const prompt = `Perform a self-reflection on your recent performance.

REFLECTION FOCUS: ${focus}
TRIGGER: ${context.triggerType}

${context.recentOutputs?.length ? `RECENT OUTPUTS:\n${context.recentOutputs.slice(0, 3).map((o, i) => `${i + 1}. ${o.substring(0, 500)}`).join('\n')}` : ''}

${context.recentErrors?.length ? `RECENT ERRORS:\n${context.recentErrors.map((e) => `- ${e.errorType}: ${e.errorDescription}`).join('\n')}` : ''}

Reflect on:
1. What went well?
2. What could be improved?
3. Are there patterns in errors or successes?
4. What insights can you derive?
5. Rate your overall performance (0-1)

Return JSON:
{
  "thought_process": "your reflection narrative",
  "insights": [{"insight": "...", "confidence": 0.0-1.0, "actionable": true/false}],
  "patterns_noticed": ["pattern1", "pattern2"],
  "performance_rating": 0.0-1.0,
  "areas_for_improvement": ["area1", "area2"]
}`;

    const response = await this.invokeModel(prompt);
    let reflection = {
      thought_process: 'Unable to complete reflection',
      insights: [] as ReflectionInsight[],
      patterns_noticed: [] as string[],
      performance_rating: 0.5,
      areas_for_improvement: [] as string[],
    };

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reflection = {
          thought_process: parsed.thought_process || '',
          insights: (parsed.insights || []).map((i: { insight: string; confidence: number; actionable: boolean }) => ({
            insight: i.insight,
            confidence: i.confidence || 0.5,
            actionable: i.actionable ?? false,
          })),
          patterns_noticed: parsed.patterns_noticed || [],
          performance_rating: parsed.performance_rating || 0.5,
          areas_for_improvement: parsed.areas_for_improvement || [],
        };
      }
    } catch { /* use defaults */ }

    // Store reflection
    const result = await executeStatement(
      `INSERT INTO reflection_log (
        tenant_id, session_id, trigger_type, reflection_focus, thought_process,
        insights, patterns_noticed, performance_rating, areas_for_improvement
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING reflection_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'sessionId', value: context.sessionId ? { stringValue: context.sessionId } : { isNull: true } },
        { name: 'triggerType', value: { stringValue: context.triggerType } },
        { name: 'focus', value: { stringValue: focus } },
        { name: 'thoughtProcess', value: { stringValue: reflection.thought_process } },
        { name: 'insights', value: { stringValue: JSON.stringify(reflection.insights) } },
        { name: 'patterns', value: { stringValue: JSON.stringify(reflection.patterns_noticed) } },
        { name: 'rating', value: { doubleValue: reflection.performance_rating } },
        { name: 'improvements', value: { stringValue: `{${reflection.areas_for_improvement.join(',')}}` } },
      ]
    );

    // Create improvement plans for actionable insights
    for (const insight of reflection.insights.filter((i) => i.actionable)) {
      await this.createImprovementPlan(tenantId, 'insight', insight.insight, 'moderate');
    }

    // Store in episodic memory
    await episodicMemoryService.createMemory(
      tenantId,
      'system',
      `Self-reflection: ${reflection.thought_process.substring(0, 500)}`,
      'observation',
      { category: 'metacognition', tags: ['reflection', context.triggerType] }
    );

    return {
      reflectionId: (result.rows[0] as { reflection_id: string }).reflection_id,
      triggerType: context.triggerType,
      reflectionFocus: focus,
      thoughtProcess: reflection.thought_process,
      insights: reflection.insights,
      patternsNoticed: reflection.patterns_noticed,
      performanceRating: reflection.performance_rating,
      areasForImprovement: reflection.areas_for_improvement,
    };
  }

  async getRecentReflections(tenantId: string, limit = 10): Promise<SelfReflection[]> {
    const result = await executeStatement(
      `SELECT * FROM reflection_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map((row) => this.mapReflection(row as Record<string, unknown>));
  }

  // ============================================================================
  // Self-Improvement Planning
  // ============================================================================

  async createImprovementPlan(
    tenantId: string,
    weaknessType: string,
    description: string,
    severity: string
  ): Promise<string> {
    const prompt = `Create an improvement plan for this weakness.

WEAKNESS TYPE: ${weaknessType}
DESCRIPTION: ${description}
SEVERITY: ${severity}

Generate:
1. A clear improvement goal
2. A strategy to achieve it
3. Specific action items
4. Success criteria

Return JSON:
{
  "improvement_goal": "clear goal statement",
  "improvement_strategy": "how to achieve it",
  "action_items": [{"action": "...", "status": "pending"}],
  "success_criteria": {"metric": "target_value"}
}`;

    const response = await this.invokeModel(prompt);
    let plan = {
      improvement_goal: `Address ${weaknessType}: ${description}`,
      improvement_strategy: 'Monitor and improve over time',
      action_items: [] as Array<{ action: string; status: string }>,
      success_criteria: {},
    };

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        plan = {
          improvement_goal: parsed.improvement_goal || plan.improvement_goal,
          improvement_strategy: parsed.improvement_strategy || plan.improvement_strategy,
          action_items: parsed.action_items || [],
          success_criteria: parsed.success_criteria || {},
        };
      }
    } catch { /* use defaults */ }

    const result = await executeStatement(
      `INSERT INTO self_improvement_plans (
        tenant_id, weakness_type, weakness_description, severity,
        improvement_goal, improvement_strategy, action_items, success_criteria, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING plan_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'weaknessType', value: { stringValue: weaknessType } },
        { name: 'description', value: { stringValue: description } },
        { name: 'severity', value: { stringValue: severity } },
        { name: 'goal', value: { stringValue: plan.improvement_goal } },
        { name: 'strategy', value: { stringValue: plan.improvement_strategy } },
        { name: 'actionItems', value: { stringValue: JSON.stringify(plan.action_items) } },
        { name: 'criteria', value: { stringValue: JSON.stringify(plan.success_criteria) } },
        { name: 'priority', value: { longValue: severity === 'critical' ? 9 : severity === 'major' ? 7 : 5 } },
      ]
    );

    return (result.rows[0] as { plan_id: string }).plan_id;
  }

  async getActiveImprovementPlans(tenantId: string): Promise<Array<{
    planId: string;
    weaknessType: string;
    weaknessDescription: string;
    improvementGoal: string;
    status: ImprovementStatus;
    progressPercentage: number;
    priority: number;
  }>> {
    const result = await executeStatement(
      `SELECT * FROM self_improvement_plans
       WHERE tenant_id = $1 AND status NOT IN ('completed', 'abandoned')
       ORDER BY priority DESC, created_at DESC
       LIMIT 20`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        planId: String(r.plan_id),
        weaknessType: String(r.weakness_type),
        weaknessDescription: String(r.weakness_description),
        improvementGoal: String(r.improvement_goal),
        status: r.status as ImprovementStatus,
        progressPercentage: Number(r.progress_percentage || 0),
        priority: Number(r.priority || 5),
      };
    });
  }

  // ============================================================================
  // Settings Management
  // ============================================================================

  async getSettings(tenantId: string): Promise<MetacognitiveSettings> {
    const result = await executeStatement(
      `SELECT * FROM metacognitive_settings WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) {
      // Create default settings
      await executeStatement(
        `INSERT INTO metacognitive_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      return this.getDefaultSettings();
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      confidenceMonitoringEnabled: Boolean(row.confidence_monitoring_enabled ?? true),
      errorDetectionEnabled: Boolean(row.error_detection_enabled ?? true),
      selfReflectionEnabled: Boolean(row.self_reflection_enabled ?? true),
      strategyOptimizationEnabled: Boolean(row.strategy_optimization_enabled ?? true),
      knowledgeBoundaryTracking: Boolean(row.knowledge_boundary_tracking ?? true),
      lowConfidenceThreshold: Number(row.low_confidence_threshold ?? 0.5),
      highConfidenceThreshold: Number(row.high_confidence_threshold ?? 0.9),
      admitUncertaintyThreshold: Number(row.admit_uncertainty_threshold ?? 0.3),
      uncertaintyEscalationEnabled: Boolean(row.uncertainty_escalation_enabled ?? true),
    };
  }

  private getDefaultSettings(): MetacognitiveSettings {
    return {
      confidenceMonitoringEnabled: true,
      errorDetectionEnabled: true,
      selfReflectionEnabled: true,
      strategyOptimizationEnabled: true,
      knowledgeBoundaryTracking: true,
      lowConfidenceThreshold: 0.5,
      highConfidenceThreshold: 0.9,
      admitUncertaintyThreshold: 0.3,
      uncertaintyEscalationEnabled: true,
    };
  }

  async updateSettings(tenantId: string, updates: Partial<MetacognitiveSettings>): Promise<void> {
    const sets: string[] = [];
    const params: Array<{ name: string; value: { stringValue: string } | { doubleValue: number } | { booleanValue: boolean } }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];
    let i = 2;

    if (updates.confidenceMonitoringEnabled !== undefined) {
      sets.push(`confidence_monitoring_enabled = $${i++}`);
      params.push({ name: `p${i}`, value: { booleanValue: updates.confidenceMonitoringEnabled } });
    }
    if (updates.errorDetectionEnabled !== undefined) {
      sets.push(`error_detection_enabled = $${i++}`);
      params.push({ name: `p${i}`, value: { booleanValue: updates.errorDetectionEnabled } });
    }
    if (updates.lowConfidenceThreshold !== undefined) {
      sets.push(`low_confidence_threshold = $${i++}`);
      params.push({ name: `p${i}`, value: { doubleValue: updates.lowConfidenceThreshold } });
    }
    if (updates.admitUncertaintyThreshold !== undefined) {
      sets.push(`admit_uncertainty_threshold = $${i++}`);
      params.push({ name: `p${i}`, value: { doubleValue: updates.admitUncertaintyThreshold } });
    }

    if (sets.length > 0) {
      await executeStatement(
        `UPDATE metacognitive_settings SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`,
        params
      );
    }
  }

  // ============================================================================
  // Calibration
  // ============================================================================

  async updateCalibration(tenantId: string, assessmentId: string, actualAccuracy: number): Promise<void> {
    await executeStatement(
      `UPDATE confidence_assessments SET
        actual_accuracy = $2,
        calibration_error = predicted_accuracy - $2
      WHERE assessment_id = $1`,
      [
        { name: 'assessmentId', value: { stringValue: assessmentId } },
        { name: 'actualAccuracy', value: { doubleValue: actualAccuracy } },
      ]
    );
  }

  async getCalibrationScore(tenantId: string, days = 7): Promise<{
    brierScore: number;
    overconfidenceTendency: number;
    sampleSize: number;
  }> {
    const result = await executeStatement(
      `SELECT 
        AVG(POWER(predicted_accuracy - actual_accuracy, 2)) as brier_score,
        AVG(predicted_accuracy - actual_accuracy) as overconfidence,
        COUNT(*) as sample_size
       FROM confidence_assessments
       WHERE tenant_id = $1 
         AND actual_accuracy IS NOT NULL
         AND created_at > NOW() - INTERVAL '${days} days'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.rows[0] as { brier_score: number; overconfidence: number; sample_size: number } | undefined;
    return {
      brierScore: Number(row?.brier_score ?? 0),
      overconfidenceTendency: Number(row?.overconfidence ?? 0),
      sampleSize: Number(row?.sample_size ?? 0),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await modelRouterService.invoke({
        modelId: 'amazon/titan-embed-text',
        messages: [{ role: 'user', content: text.substring(0, 8000) }],
      });
      return new Array(1536).fill(0);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  private async invokeModel(prompt: string): Promise<string> {
    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    });
    return response.content;
  }

  private mapDetectedError(row: Record<string, unknown>): DetectedError {
    return {
      errorId: String(row.error_id),
      errorType: row.error_type as ErrorType,
      severity: row.severity as ErrorSeverity,
      sourceType: String(row.source_type),
      sourceContent: String(row.source_content),
      errorDescription: String(row.error_description),
      errorLocation: row.error_location ? String(row.error_location) : undefined,
      errorEvidence: typeof row.error_evidence === 'string' ? JSON.parse(row.error_evidence) : (row.error_evidence as Record<string, unknown>) || {},
      correctionProposed: row.correction_proposed ? String(row.correction_proposed) : undefined,
      correctionApplied: Boolean(row.correction_applied),
      resolutionStatus: String(row.resolution_status),
    };
  }

  private mapKnowledgeBoundary(row: Record<string, unknown>): KnowledgeBoundary {
    return {
      boundaryId: String(row.boundary_id),
      domain: String(row.domain),
      topic: String(row.topic),
      knowledgeLevel: row.knowledge_level as KnowledgeLevel,
      confidenceInAssessment: Number(row.confidence_in_assessment || 0.5),
      evidenceForLevel: typeof row.evidence_for_level === 'string' ? JSON.parse(row.evidence_for_level) : (row.evidence_for_level as Record<string, unknown>) || {},
      lastDemonstrated: row.last_demonstrated ? new Date(row.last_demonstrated as string) : undefined,
    };
  }

  private mapStrategyPerformance(row: Record<string, unknown>): StrategyPerformance {
    const timesUsed = Number(row.times_used || 0);
    const timesSuccessful = Number(row.times_successful || 0);
    return {
      strategyType: String(row.strategy_type),
      strategyName: String(row.strategy_name),
      timesUsed,
      timesSuccessful,
      successRate: timesUsed > 0 ? timesSuccessful / timesUsed : 0,
      avgConfidence: Number(row.avg_confidence || 0.5),
      avgLatencyMs: Number(row.avg_latency_ms || 1000),
    };
  }

  private mapReflection(row: Record<string, unknown>): SelfReflection {
    return {
      reflectionId: String(row.reflection_id),
      triggerType: String(row.trigger_type),
      reflectionFocus: String(row.reflection_focus),
      thoughtProcess: String(row.thought_process),
      insights: typeof row.insights === 'string' ? JSON.parse(row.insights) : (row.insights as ReflectionInsight[]) || [],
      patternsNoticed: typeof row.patterns_noticed === 'string' ? JSON.parse(row.patterns_noticed) : (row.patterns_noticed as string[]) || [],
      performanceRating: Number(row.performance_rating || 0.5),
      areasForImprovement: (row.areas_for_improvement as string[]) || [],
    };
  }
}

export const metacognitionService = new MetacognitionService();
