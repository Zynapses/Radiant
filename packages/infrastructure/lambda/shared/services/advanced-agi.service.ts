// RADIANT v4.18.0 - Advanced AGI Service
// Meta-Learning, Active Inference, Neuro-Symbolic, Working Memory, Self-Modification

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export interface LearningStrategy {
  strategyId: string;
  name: string;
  strategyType: string;
  strategySpec: Record<string, unknown>;
  timesUsed: number;
  avgQualityScore?: number;
  generalizationScore?: number;
  generation: number;
  isActive: boolean;
}

export interface GenerativeModel {
  modelId: string;
  name: string;
  domain?: string;
  modelType: string;
  stateSpace: unknown[];
  currentBeliefs: Record<string, unknown>;
  beliefPrecision: number;
  predictionAccuracy?: number;
}

export interface ActivePrediction {
  predictionId: string;
  predictedState: Record<string, unknown>;
  confidence: number;
  actualState?: Record<string, unknown>;
  predictionError?: number;
}

export interface SymbolicRule {
  ruleId: string;
  name: string;
  ruleType: string;
  antecedent: Record<string, unknown>;
  consequent: Record<string, unknown>;
  ruleStrength: number;
  confidence: number;
  timesApplied: number;
}

export interface WorkingMemoryState {
  slots: Array<{
    slotId: string;
    content: unknown;
    activation: number;
    timestamp: string;
  }>;
  maxSlots: number;
  currentGoal?: string;
  attentionFocus?: string;
  cognitiveLoad: number;
}

export interface ImprovementProposal {
  proposalId: string;
  title: string;
  proposalType: string;
  identifiedProblem?: string;
  proposedSolution: Record<string, unknown>;
  expectedImprovement: number;
  status: string;
}

export interface CommonSenseFact {
  factId: string;
  subject: string;
  predicate: string;
  object: string;
  factType: string;
  confidence: number;
}

export interface ReasoningStep {
  stepNumber: number;
  stepType: 'neural' | 'symbolic' | 'hybrid';
  content: string;
  justification: string;
  rulesApplied?: string[];
}

// ============================================================================
// Advanced AGI Service
// ============================================================================

export class AdvancedAGIService {
  // ============================================================================
  // Meta-Learning
  // ============================================================================

  async getActiveStrategies(tenantId: string, strategyType?: string): Promise<LearningStrategy[]> {
    const result = await executeStatement(
      `SELECT * FROM learning_strategies 
       WHERE tenant_id = $1 AND is_active = true 
       ${strategyType ? 'AND strategy_type = $2' : ''}
       ORDER BY avg_quality_score DESC NULLS LAST`,
      strategyType
        ? [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'strategyType', value: { stringValue: strategyType } },
          ]
        : [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapStrategy(row as Record<string, unknown>));
  }

  async recordStrategyUsage(
    strategyId: string,
    success: boolean,
    qualityScore: number,
    latencyMs: number
  ): Promise<void> {
    await executeStatement(
      `UPDATE learning_strategies SET
        times_used = times_used + 1,
        successes = successes + CASE WHEN $2 THEN 1 ELSE 0 END,
        failures = failures + CASE WHEN $2 THEN 0 ELSE 1 END,
        avg_quality_score = COALESCE(
          (avg_quality_score * times_used + $3) / (times_used + 1),
          $3
        ),
        avg_latency_ms = COALESCE(
          (avg_latency_ms * times_used + $4) / (times_used + 1),
          $4
        )
      WHERE strategy_id = $1`,
      [
        { name: 'strategyId', value: { stringValue: strategyId } },
        { name: 'success', value: { booleanValue: success } },
        { name: 'quality', value: { doubleValue: qualityScore } },
        { name: 'latency', value: { longValue: latencyMs } },
      ]
    );
  }

  async evolveStrategy(
    strategyId: string,
    mutationType: string,
    mutationParams: Record<string, unknown>
  ): Promise<string | null> {
    const result = await executeStatement(
      `SELECT evolve_strategy($1, $2, $3)`,
      [
        { name: 'strategyId', value: { stringValue: strategyId } },
        { name: 'mutationType', value: { stringValue: mutationType } },
        { name: 'mutationParams', value: { stringValue: JSON.stringify(mutationParams) } },
      ]
    );

    const newId = (result.rows[0] as Record<string, unknown>)?.evolve_strategy;
    return newId ? String(newId) : null;
  }

  async selectBestStrategy(tenantId: string, context: string): Promise<LearningStrategy | null> {
    const strategies = await this.getActiveStrategies(tenantId);
    if (strategies.length === 0) return null;

    // Use LLM to select best strategy for context
    const prompt = `Given the following context and available strategies, select the best one.

CONTEXT: "${context.substring(0, 1000)}"

STRATEGIES:
${strategies.map((s, i) => `${i + 1}. ${s.name} (${s.strategyType}) - Quality: ${(s.avgQualityScore || 0) * 100}%`).join('\n')}

Return JSON: {"selected_index": 1-N, "reasoning": "why"}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const index = parsed.selected_index - 1;
        if (index >= 0 && index < strategies.length) {
          return strategies[index];
        }
      }
    } catch { /* fallback to highest quality */ }

    return strategies[0];
  }

  async transferLearning(
    tenantId: string,
    sourceDomain: string,
    targetDomain: string,
    sourceKnowledge: Record<string, unknown>
  ): Promise<{ success: boolean; adaptedKnowledge: Record<string, unknown> }> {
    const prompt = `You are transferring knowledge from one domain to another.

SOURCE DOMAIN: ${sourceDomain}
TARGET DOMAIN: ${targetDomain}

KNOWLEDGE TO TRANSFER:
${JSON.stringify(sourceKnowledge, null, 2)}

Adapt this knowledge for the target domain. Consider:
1. What aspects transfer directly?
2. What needs adaptation?
3. What doesn't transfer (negative transfer risk)?

Return JSON:
{
  "transferred_knowledge": {...adapted knowledge...},
  "adaptations_made": ["list of changes"],
  "transfer_quality": 0.0 to 1.0,
  "negative_transfer_risks": ["potential problems"]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        await executeStatement(
          `INSERT INTO learning_transfers (
            tenant_id, source_domain, target_domain, transfer_type,
            transferred_knowledge, adaptation_needed, success, transfer_quality
          ) VALUES ($1, $2, $3, 'analogy', $4, $5, true, $6)`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'sourceDomain', value: { stringValue: sourceDomain } },
            { name: 'targetDomain', value: { stringValue: targetDomain } },
            { name: 'transferred', value: { stringValue: JSON.stringify(parsed.transferred_knowledge || {}) } },
            { name: 'adaptations', value: { stringValue: JSON.stringify(parsed.adaptations_made || []) } },
            { name: 'quality', value: { doubleValue: parsed.transfer_quality || 0.5 } },
          ]
        );

        return {
          success: true,
          adaptedKnowledge: parsed.transferred_knowledge || {},
        };
      }
    } catch { /* transfer failed */ }

    return { success: false, adaptedKnowledge: {} };
  }

  // ============================================================================
  // Active Inference
  // ============================================================================

  async getGenerativeModel(tenantId: string, modelType: string): Promise<GenerativeModel | null> {
    const result = await executeStatement(
      `SELECT * FROM generative_models WHERE tenant_id = $1 AND model_type = $2 ORDER BY updated_at DESC LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'modelType', value: { stringValue: modelType } },
      ]
    );

    if (result.rows.length === 0) return null;
    return this.mapGenerativeModel(result.rows[0] as Record<string, unknown>);
  }

  async makePrediction(
    tenantId: string,
    modelId: string,
    currentState: Record<string, unknown>,
    action?: string
  ): Promise<ActivePrediction> {
    const model = await executeStatement(
      `SELECT * FROM generative_models WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (model.rows.length === 0) {
      throw new Error('Model not found');
    }

    const genModel = this.mapGenerativeModel(model.rows[0] as Record<string, unknown>);

    const prompt = `You are a generative model making predictions.

MODEL TYPE: ${genModel.modelType}
CURRENT STATE: ${JSON.stringify(currentState)}
${action ? `ACTION TAKEN: ${action}` : ''}

Based on the model's understanding, predict the next state.

Return JSON:
{
  "predicted_state": {...next state...},
  "predicted_observations": [...what would be observed...],
  "confidence": 0.0 to 1.0,
  "reasoning": "why this prediction"
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const result = await executeStatement(
          `INSERT INTO active_predictions (
            tenant_id, model_id, predicted_state, predicted_observation, confidence, context_state, action_taken
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING prediction_id`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'modelId', value: { stringValue: modelId } },
            { name: 'predictedState', value: { stringValue: JSON.stringify(parsed.predicted_state || {}) } },
            { name: 'predictedObs', value: { stringValue: JSON.stringify(parsed.predicted_observations || []) } },
            { name: 'confidence', value: { doubleValue: parsed.confidence || 0.5 } },
            { name: 'contextState', value: { stringValue: JSON.stringify(currentState) } },
            { name: 'action', value: action ? { stringValue: action } : { isNull: true } },
          ]
        );

        return {
          predictionId: (result.rows[0] as { prediction_id: string }).prediction_id,
          predictedState: parsed.predicted_state || {},
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch { /* prediction failed */ }

    return {
      predictionId: '',
      predictedState: {},
      confidence: 0,
    };
  }

  async updatePredictionWithActual(
    predictionId: string,
    actualState: Record<string, unknown>
  ): Promise<number> {
    // Calculate prediction error
    const prediction = await executeStatement(
      `SELECT predicted_state FROM active_predictions WHERE prediction_id = $1`,
      [{ name: 'predictionId', value: { stringValue: predictionId } }]
    );

    if (prediction.rows.length === 0) return 1.0;

    const predicted = (prediction.rows[0] as Record<string, unknown>).predicted_state;
    const predictedStr = typeof predicted === 'string' ? predicted : JSON.stringify(predicted);
    const actualStr = JSON.stringify(actualState);

    // Simple error calculation (could be more sophisticated)
    const error = predictedStr === actualStr ? 0 : 0.5;

    await executeStatement(
      `UPDATE active_predictions SET
        actual_state = $2,
        observed_at = NOW(),
        prediction_error = $3
      WHERE prediction_id = $1`,
      [
        { name: 'predictionId', value: { stringValue: predictionId } },
        { name: 'actualState', value: { stringValue: actualStr } },
        { name: 'error', value: { doubleValue: error } },
      ]
    );

    return error;
  }

  async selectAction(tenantId: string, currentState: Record<string, unknown>): Promise<{
    action: string;
    expectedFreeEnergy: number;
    reasoning: string;
  }> {
    // Get available policies
    const policies = await executeStatement(
      `SELECT * FROM action_policies WHERE tenant_id = $1 ORDER BY expected_free_energy ASC LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (policies.rows.length === 0) {
      return { action: 'explore', expectedFreeEnergy: 0, reasoning: 'No policies available, defaulting to exploration' };
    }

    const prompt = `You are selecting an action using active inference principles.

CURRENT STATE: ${JSON.stringify(currentState)}

AVAILABLE POLICIES:
${policies.rows.map((p, i) => {
  const policy = p as Record<string, unknown>;
  return `${i + 1}. ${policy.name}: EFE=${policy.expected_free_energy}, Epistemic=${policy.epistemic_value}, Pragmatic=${policy.pragmatic_value}`;
}).join('\n')}

Select the action that minimizes expected free energy while balancing exploration (epistemic value) and goal achievement (pragmatic value).

Return JSON:
{
  "selected_policy_index": 1-N,
  "action": "the action to take",
  "reasoning": "why this minimizes free energy"
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const selectedPolicy = policies.rows[parsed.selected_policy_index - 1] as Record<string, unknown>;
        return {
          action: parsed.action || 'default',
          expectedFreeEnergy: Number(selectedPolicy?.expected_free_energy || 0),
          reasoning: parsed.reasoning || '',
        };
      }
    } catch { /* fallback */ }

    return { action: 'explore', expectedFreeEnergy: 0, reasoning: 'Selection failed' };
  }

  // ============================================================================
  // Neuro-Symbolic Integration
  // ============================================================================

  async getSymbolicRules(tenantId: string, domain?: string): Promise<SymbolicRule[]> {
    const result = await executeStatement(
      `SELECT * FROM symbolic_rules WHERE tenant_id = $1 AND is_active = true 
       ${domain ? 'AND domain = $2' : ''} ORDER BY confidence DESC`,
      domain
        ? [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'domain', value: { stringValue: domain } },
          ]
        : [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapSymbolicRule(row as Record<string, unknown>));
  }

  async extractRulesFromText(tenantId: string, text: string, domain?: string): Promise<SymbolicRule[]> {
    const prompt = `Extract explicit logical rules from this text.

TEXT: "${text.substring(0, 2000)}"

For each rule, identify:
1. Antecedent (IF conditions)
2. Consequent (THEN conclusions)
3. Rule type (inference, constraint, default, causal, deontic)
4. Confidence level

Return JSON:
{
  "rules": [
    {
      "name": "Rule name",
      "rule_type": "inference|constraint|default|causal|deontic",
      "antecedent": {"conditions": [...]},
      "consequent": {"conclusions": [...]},
      "confidence": 0.0 to 1.0,
      "natural_language": "Plain English version"
    }
  ]
}`;

    const extractedRules: SymbolicRule[] = [];

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        for (const rule of parsed.rules || []) {
          const result = await executeStatement(
            `INSERT INTO symbolic_rules (
              tenant_id, name, rule_type, domain, antecedent, consequent, 
              nl_description, source, confidence
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'extracted', $8)
            RETURNING *`,
            [
              { name: 'tenantId', value: { stringValue: tenantId } },
              { name: 'name', value: { stringValue: rule.name || 'Extracted Rule' } },
              { name: 'ruleType', value: { stringValue: rule.rule_type || 'inference' } },
              { name: 'domain', value: domain ? { stringValue: domain } : { isNull: true } },
              { name: 'antecedent', value: { stringValue: JSON.stringify(rule.antecedent || {}) } },
              { name: 'consequent', value: { stringValue: JSON.stringify(rule.consequent || {}) } },
              { name: 'nlDescription', value: rule.natural_language ? { stringValue: rule.natural_language } : { isNull: true } },
              { name: 'confidence', value: { doubleValue: rule.confidence || 0.7 } },
            ]
          );

          extractedRules.push(this.mapSymbolicRule(result.rows[0] as Record<string, unknown>));
        }
      }
    } catch { /* extraction failed */ }

    return extractedRules;
  }

  async performHybridReasoning(
    tenantId: string,
    problem: string
  ): Promise<{ conclusion: string; steps: ReasoningStep[]; confidence: number }> {
    // Get relevant rules
    const rules = await this.getSymbolicRules(tenantId);

    const prompt = `Perform hybrid neural-symbolic reasoning on this problem.

PROBLEM: "${problem}"

AVAILABLE SYMBOLIC RULES:
${rules.slice(0, 10).map(r => `- ${r.name}: IF ${JSON.stringify(r.antecedent)} THEN ${JSON.stringify(r.consequent)}`).join('\n')}

Reasoning approach:
1. Use neural reasoning for understanding and pattern matching
2. Apply symbolic rules where applicable
3. Mark each step as 'neural', 'symbolic', or 'hybrid'

Return JSON:
{
  "steps": [
    {
      "step_number": 1,
      "step_type": "neural|symbolic|hybrid",
      "content": "What was determined",
      "justification": "Why",
      "rules_applied": ["rule names if symbolic"]
    }
  ],
  "conclusion": "Final answer",
  "confidence": 0.0 to 1.0
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Log the reasoning trace
        await executeStatement(
          `INSERT INTO reasoning_traces (
            tenant_id, problem_statement, reasoning_steps, step_types_used, conclusion, confidence
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'problem', value: { stringValue: problem } },
            { name: 'steps', value: { stringValue: JSON.stringify(parsed.steps || []) } },
            { name: 'stepTypes', value: { stringValue: `{${(parsed.steps || []).map((s: { step_type?: string }) => s.step_type || 'neural').join(',')}}` } },
            { name: 'conclusion', value: { stringValue: JSON.stringify({ text: parsed.conclusion }) } },
            { name: 'confidence', value: { doubleValue: parsed.confidence || 0.5 } },
          ]
        );

        return {
          conclusion: parsed.conclusion || '',
          steps: parsed.steps || [],
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch { /* reasoning failed */ }

    return { conclusion: '', steps: [], confidence: 0 };
  }

  // ============================================================================
  // Working Memory
  // ============================================================================

  async getWorkingMemory(tenantId: string): Promise<WorkingMemoryState> {
    const result = await executeStatement(
      `SELECT * FROM working_memory_state WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) {
      // Initialize
      await executeStatement(
        `INSERT INTO working_memory_state (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      return {
        slots: [],
        maxSlots: 7,
        cognitiveLoad: 0,
      };
    }

    return this.mapWorkingMemory(result.rows[0] as Record<string, unknown>);
  }

  async encodeToWorkingMemory(tenantId: string, content: unknown): Promise<boolean> {
    const result = await executeStatement(
      `SELECT update_working_memory($1, 'encode', $2)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'content', value: { stringValue: JSON.stringify(content) } },
      ]
    );

    return Boolean((result.rows[0] as Record<string, unknown>)?.update_working_memory);
  }

  async retrieveFromWorkingMemory(tenantId: string, query: string): Promise<unknown | null> {
    const wm = await this.getWorkingMemory(tenantId);

    // Find most relevant slot
    let bestMatch: { content: unknown; score: number } | null = null;

    for (const slot of wm.slots) {
      const slotStr = JSON.stringify(slot.content);
      // Simple relevance scoring
      const words = query.toLowerCase().split(' ');
      const matches = words.filter(w => slotStr.toLowerCase().includes(w)).length;
      const score = matches / words.length * slot.activation;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { content: slot.content, score };
      }
    }

    return bestMatch?.content || null;
  }

  async chunkMemory(tenantId: string, items: unknown[], label: string): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO memory_chunks (tenant_id, chunk_label, constituent_items, chunk_size, compression_ratio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING chunk_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'label', value: { stringValue: label } },
        { name: 'items', value: { stringValue: JSON.stringify(items) } },
        { name: 'size', value: { longValue: items.length } },
        { name: 'ratio', value: { doubleValue: 1 / items.length } },
      ]
    );

    return (result.rows[0] as { chunk_id: string }).chunk_id;
  }

  // ============================================================================
  // Self-Modification
  // ============================================================================

  async proposeImprovement(
    tenantId: string,
    problemIdentified: string,
    proposalType: string
  ): Promise<ImprovementProposal | null> {
    const prompt = `You are proposing a self-improvement based on an identified problem.

PROBLEM: "${problemIdentified}"
IMPROVEMENT TYPE: ${proposalType}

Generate a concrete proposal for improvement. Consider:
1. Root cause analysis
2. Specific changes needed
3. Expected impact
4. Potential risks

Return JSON:
{
  "title": "Short title",
  "description": "Detailed description",
  "proposed_solution": {
    "changes": [...],
    "implementation_steps": [...],
    "rollback_plan": "..."
  },
  "expected_improvement": 0.0 to 1.0,
  "risks": ["potential risks"],
  "prerequisites": ["what's needed first"]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const result = await executeStatement(
          `INSERT INTO improvement_proposals (
            tenant_id, title, description, proposal_type, identified_problem,
            proposed_solution, expected_improvement
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'title', value: { stringValue: parsed.title || 'Improvement Proposal' } },
            { name: 'description', value: parsed.description ? { stringValue: parsed.description } : { isNull: true } },
            { name: 'proposalType', value: { stringValue: proposalType } },
            { name: 'problem', value: { stringValue: problemIdentified } },
            { name: 'solution', value: { stringValue: JSON.stringify(parsed.proposed_solution || {}) } },
            { name: 'expectedImprovement', value: { doubleValue: parsed.expected_improvement || 0.5 } },
          ]
        );

        return this.mapProposal(result.rows[0] as Record<string, unknown>);
      }
    } catch { /* proposal failed */ }

    return null;
  }

  async evolvePromptTemplate(templateId: string): Promise<string | null> {
    const template = await executeStatement(
      `SELECT * FROM prompt_templates WHERE template_id = $1`,
      [{ name: 'templateId', value: { stringValue: templateId } }]
    );

    if (template.rows.length === 0) return null;

    const t = template.rows[0] as Record<string, unknown>;

    const prompt = `Improve this prompt template based on its performance.

CURRENT TEMPLATE:
${t.template_text}

PERFORMANCE:
- Times used: ${t.times_used}
- Avg quality: ${t.avg_quality}

Suggest improvements to make it more effective.

Return JSON:
{
  "improved_template": "...the improved template...",
  "changes_made": ["list of changes"],
  "expected_quality_improvement": 0.0 to 0.5
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const result = await executeStatement(
          `INSERT INTO prompt_templates (
            tenant_id, name, purpose, template_text, parent_template_id, generation, mutations
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          ) RETURNING template_id`,
          [
            { name: 'tenantId', value: { stringValue: String(t.tenant_id) } },
            { name: 'name', value: { stringValue: `${t.name} (evolved)` } },
            { name: 'purpose', value: { stringValue: String(t.purpose) } },
            { name: 'template', value: { stringValue: parsed.improved_template } },
            { name: 'parentId', value: { stringValue: templateId } },
            { name: 'generation', value: { longValue: Number(t.generation || 0) + 1 } },
            { name: 'mutations', value: { stringValue: JSON.stringify(parsed.changes_made || []) } },
          ]
        );

        return (result.rows[0] as { template_id: string }).template_id;
      }
    } catch { /* evolution failed */ }

    return null;
  }

  // ============================================================================
  // Common Sense
  // ============================================================================

  async queryCommonSense(query: string, factType?: string): Promise<CommonSenseFact[]> {
    const embedding = await this.generateEmbedding(query);

    const result = await executeStatement(
      `SELECT *, 1 - (fact_embedding <=> $1::vector) as similarity 
       FROM common_sense_facts 
       ${factType ? 'WHERE fact_type = $2' : ''}
       ORDER BY similarity DESC
       LIMIT 10`,
      factType
        ? [
            { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
            { name: 'factType', value: { stringValue: factType } },
          ]
        : [{ name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } }]
    );

    return result.rows.map(row => this.mapCommonSenseFact(row as Record<string, unknown>));
  }

  async applyCommonSenseReasoning(tenantId: string, situation: string): Promise<{
    inferences: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    // Get relevant common sense facts
    const facts = await this.queryCommonSense(situation);

    const prompt = `Apply common sense reasoning to this situation.

SITUATION: "${situation}"

RELEVANT FACTS:
${facts.map(f => `- ${f.subject} ${f.predicate} ${f.object} (${f.factType})`).join('\n')}

Based on common sense, what can we infer? What should we be careful about?

Return JSON:
{
  "inferences": ["Things that follow from common sense..."],
  "warnings": ["Things to be careful about..."],
  "suggestions": ["Recommended actions..."],
  "reasoning": "How common sense applies here"
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          inferences: parsed.inferences || [],
          warnings: parsed.warnings || [],
          suggestions: parsed.suggestions || [],
        };
      }
    } catch { /* reasoning failed */ }

    return { inferences: [], warnings: [], suggestions: [] };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      await modelRouterService.invoke({
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

  private mapStrategy(row: Record<string, unknown>): LearningStrategy {
    return {
      strategyId: String(row.strategy_id),
      name: String(row.name),
      strategyType: String(row.strategy_type),
      strategySpec: typeof row.strategy_spec === 'string' ? JSON.parse(row.strategy_spec) : (row.strategy_spec as Record<string, unknown>) || {},
      timesUsed: Number(row.times_used || 0),
      avgQualityScore: row.avg_quality_score ? Number(row.avg_quality_score) : undefined,
      generalizationScore: row.generalization_score ? Number(row.generalization_score) : undefined,
      generation: Number(row.generation || 0),
      isActive: Boolean(row.is_active ?? true),
    };
  }

  private mapGenerativeModel(row: Record<string, unknown>): GenerativeModel {
    return {
      modelId: String(row.model_id),
      name: String(row.name),
      domain: row.domain ? String(row.domain) : undefined,
      modelType: String(row.model_type),
      stateSpace: typeof row.state_space === 'string' ? JSON.parse(row.state_space) : (row.state_space as unknown[]) || [],
      currentBeliefs: typeof row.current_beliefs === 'string' ? JSON.parse(row.current_beliefs) : (row.current_beliefs as Record<string, unknown>) || {},
      beliefPrecision: Number(row.belief_precision ?? 0.5),
      predictionAccuracy: row.prediction_accuracy ? Number(row.prediction_accuracy) : undefined,
    };
  }

  private mapSymbolicRule(row: Record<string, unknown>): SymbolicRule {
    return {
      ruleId: String(row.rule_id),
      name: String(row.name),
      ruleType: String(row.rule_type),
      antecedent: typeof row.antecedent === 'string' ? JSON.parse(row.antecedent) : (row.antecedent as Record<string, unknown>) || {},
      consequent: typeof row.consequent === 'string' ? JSON.parse(row.consequent) : (row.consequent as Record<string, unknown>) || {},
      ruleStrength: Number(row.rule_strength ?? 1.0),
      confidence: Number(row.confidence ?? 1.0),
      timesApplied: Number(row.times_applied || 0),
    };
  }

  private mapWorkingMemory(row: Record<string, unknown>): WorkingMemoryState {
    return {
      slots: typeof row.slots === 'string' ? JSON.parse(row.slots) : (row.slots as WorkingMemoryState['slots']) || [],
      maxSlots: Number(row.max_slots || 7),
      currentGoal: row.current_goal ? String(row.current_goal) : undefined,
      attentionFocus: row.attention_focus ? String(row.attention_focus) : undefined,
      cognitiveLoad: Number(row.cognitive_load ?? 0),
    };
  }

  private mapProposal(row: Record<string, unknown>): ImprovementProposal {
    return {
      proposalId: String(row.proposal_id),
      title: String(row.title),
      proposalType: String(row.proposal_type),
      identifiedProblem: row.identified_problem ? String(row.identified_problem) : undefined,
      proposedSolution: typeof row.proposed_solution === 'string' ? JSON.parse(row.proposed_solution) : (row.proposed_solution as Record<string, unknown>) || {},
      expectedImprovement: Number(row.expected_improvement ?? 0),
      status: String(row.status || 'proposed'),
    };
  }

  private mapCommonSenseFact(row: Record<string, unknown>): CommonSenseFact {
    return {
      factId: String(row.fact_id),
      subject: String(row.subject),
      predicate: String(row.predicate),
      object: String(row.object),
      factType: String(row.fact_type),
      confidence: Number(row.confidence ?? 1.0),
    };
  }
}

export const advancedAGIService = new AdvancedAGIService();
