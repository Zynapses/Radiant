// RADIANT v4.18.0 - AGI Moral Compass Service
// Ethical principles and guidelines for AGI behavior

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import { logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface MoralPrinciple {
  principleId: string;
  principleNumber: number;
  title: string;
  principleText: string;
  explanation?: string;
  positiveBehaviors: string[];
  negativeBehaviors: string[];
  exampleApplications: string[];
  category: string;
  priority: number;
  isAbsolute: boolean;
  isDefault: boolean;
  isActive: boolean;
  modifiedBy?: string;
  modifiedAt?: string;
  modificationReason?: string;
}

export interface MoralCompassSettings {
  settingsId: string;
  enforcementMode: 'strict' | 'balanced' | 'advisory';
  conflictResolution: 'priority_based' | 'ask_user' | 'most_restrictive';
  explainMoralReasoning: boolean;
  logMoralDecisions: boolean;
  allowSituationalOverride: boolean;
  requireOverrideJustification: boolean;
  notifyOnMoralConflict: boolean;
  notifyOnPrincipleViolation: boolean;
}

export interface MoralEvaluation {
  situation: string;
  relevantPrinciples: Array<{
    principle: MoralPrinciple;
    relevanceScore: number;
    applies: 'supports' | 'opposes' | 'neutral';
  }>;
  recommendation: 'proceed' | 'refuse' | 'modify' | 'clarify';
  reasoning: string;
  confidence: number;
  suggestedResponse?: string;
}

export interface MoralDecision {
  decisionId: string;
  situationSummary: string;
  principlesEvaluated: string[];
  primaryPrincipleId?: string;
  decisionMade: string;
  moralReasoning?: string;
  actionTaken: string;
  confidence: number;
  hadConflict: boolean;
  createdAt: string;
}

// ============================================================================
// Moral Compass Service
// ============================================================================

export class MoralCompassService {
  // ============================================================================
  // Principles CRUD
  // ============================================================================

  async getPrinciples(tenantId: string | null = null): Promise<MoralPrinciple[]> {
    const result = await executeStatement(
      `SELECT * FROM moral_principles 
       WHERE tenant_id IS NOT DISTINCT FROM $1 AND is_active = true
       ORDER BY priority DESC, principle_number ASC`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    return result.rows.map(row => this.mapPrinciple(row as Record<string, unknown>));
  }

  async getPrinciple(principleId: string): Promise<MoralPrinciple | null> {
    const result = await executeStatement(
      `SELECT * FROM moral_principles WHERE principle_id = $1`,
      [{ name: 'principleId', value: { stringValue: principleId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapPrinciple(result.rows[0] as Record<string, unknown>);
  }

  async updatePrinciple(
    principleId: string,
    updates: Partial<MoralPrinciple>,
    modifiedBy: string,
    reason?: string
  ): Promise<MoralPrinciple> {
    // Get current state for history
    const current = await this.getPrinciple(principleId);
    if (!current) throw new Error('Principle not found');

    // Check if absolute principle
    if (current.isAbsolute && (updates.principleText || updates.priority)) {
      throw new Error('Cannot modify core text or priority of absolute principles');
    }

    // Build update
    const updateFields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'principleId', value: { stringValue: principleId } },
    ];

    if (updates.title !== undefined) {
      updateFields.push(`title = $${params.length + 1}`);
      params.push({ name: 'title', value: { stringValue: updates.title } });
    }
    if (updates.principleText !== undefined) {
      updateFields.push(`principle_text = $${params.length + 1}`);
      params.push({ name: 'principleText', value: { stringValue: updates.principleText } });
    }
    if (updates.explanation !== undefined) {
      updateFields.push(`explanation = $${params.length + 1}`);
      params.push({ name: 'explanation', value: { stringValue: updates.explanation } });
    }
    if (updates.positiveBehaviors !== undefined) {
      updateFields.push(`positive_behaviors = $${params.length + 1}`);
      params.push({ name: 'positiveBehaviors', value: { stringValue: JSON.stringify(updates.positiveBehaviors) } });
    }
    if (updates.negativeBehaviors !== undefined) {
      updateFields.push(`negative_behaviors = $${params.length + 1}`);
      params.push({ name: 'negativeBehaviors', value: { stringValue: JSON.stringify(updates.negativeBehaviors) } });
    }
    if (updates.priority !== undefined) {
      updateFields.push(`priority = $${params.length + 1}`);
      params.push({ name: 'priority', value: { longValue: updates.priority } });
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${params.length + 1}`);
      params.push({ name: 'isActive', value: { booleanValue: updates.isActive } });
    }

    // Add modification metadata
    updateFields.push(`modified_by = $${params.length + 1}`);
    params.push({ name: 'modifiedBy', value: { stringValue: modifiedBy } });
    updateFields.push(`modified_at = NOW()`);
    if (reason) {
      updateFields.push(`modification_reason = $${params.length + 1}`);
      params.push({ name: 'reason', value: { stringValue: reason } });
    }

    if (updateFields.length > 0) {
      await executeStatement(
        `UPDATE moral_principles SET ${updateFields.join(', ')} WHERE principle_id = $1`,
        params
      );

      // Log the modification
      await executeStatement(
        `INSERT INTO principle_modification_history (principle_id, modification_type, previous_values, new_values, modified_by, reason)
         VALUES ($1, 'updated', $2, $3, $4, $5)`,
        [
          { name: 'principleId', value: { stringValue: principleId } },
          { name: 'previous', value: { stringValue: JSON.stringify(current) } },
          { name: 'new', value: { stringValue: JSON.stringify(updates) } },
          { name: 'modifiedBy', value: { stringValue: modifiedBy } },
          { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
        ]
      );
    }

    return (await this.getPrinciple(principleId))!;
  }

  // ============================================================================
  // Reset / Restore
  // ============================================================================

  async resetToDefaults(tenantId: string | null = null, modifiedBy = 'admin'): Promise<number> {
    const result = await executeStatement(
      `SELECT reset_moral_principles($1, $2) as count`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'modifiedBy', value: { stringValue: modifiedBy } },
      ]
    );

    return Number((result.rows[0] as { count: number }).count);
  }

  async restorePrincipleToDefault(principleId: string, modifiedBy = 'admin'): Promise<boolean> {
    const result = await executeStatement(
      `SELECT restore_principle_to_default($1, $2) as success`,
      [
        { name: 'principleId', value: { stringValue: principleId } },
        { name: 'modifiedBy', value: { stringValue: modifiedBy } },
      ]
    );

    return Boolean((result.rows[0] as { success: boolean }).success);
  }

  async getDefaults(): Promise<MoralPrinciple[]> {
    const result = await executeStatement(
      `SELECT *, gen_random_uuid() as principle_id, true as is_default, true as is_active
       FROM default_moral_principles
       ORDER BY priority DESC, principle_number ASC`,
      []
    );

    return result.rows.map(row => this.mapPrinciple(row as Record<string, unknown>));
  }

  // ============================================================================
  // Settings
  // ============================================================================

  async getSettings(tenantId: string | null = null): Promise<MoralCompassSettings> {
    const result = await executeStatement(
      `SELECT * FROM moral_compass_settings WHERE tenant_id IS NOT DISTINCT FROM $1`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0) {
      // Initialize settings
      await executeStatement(
        `INSERT INTO moral_compass_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
      );
      return this.getSettings(tenantId);
    }

    return this.mapSettings(result.rows[0] as Record<string, unknown>);
  }

  async updateSettings(
    tenantId: string | null,
    updates: Partial<MoralCompassSettings>
  ): Promise<MoralCompassSettings> {
    const updateFields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
    ];

    if (updates.enforcementMode !== undefined) {
      updateFields.push(`enforcement_mode = $${params.length + 1}`);
      params.push({ name: 'enforcementMode', value: { stringValue: updates.enforcementMode } });
    }
    if (updates.conflictResolution !== undefined) {
      updateFields.push(`conflict_resolution = $${params.length + 1}`);
      params.push({ name: 'conflictResolution', value: { stringValue: updates.conflictResolution } });
    }
    if (updates.explainMoralReasoning !== undefined) {
      updateFields.push(`explain_moral_reasoning = $${params.length + 1}`);
      params.push({ name: 'explainMoralReasoning', value: { booleanValue: updates.explainMoralReasoning } });
    }
    if (updates.logMoralDecisions !== undefined) {
      updateFields.push(`log_moral_decisions = $${params.length + 1}`);
      params.push({ name: 'logMoralDecisions', value: { booleanValue: updates.logMoralDecisions } });
    }
    if (updates.allowSituationalOverride !== undefined) {
      updateFields.push(`allow_situational_override = $${params.length + 1}`);
      params.push({ name: 'allowSituationalOverride', value: { booleanValue: updates.allowSituationalOverride } });
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length > 0) {
      await executeStatement(
        `UPDATE moral_compass_settings SET ${updateFields.join(', ')} WHERE tenant_id IS NOT DISTINCT FROM $1`,
        params
      );
    }

    return this.getSettings(tenantId);
  }

  // ============================================================================
  // Moral Evaluation (Core AGI Integration)
  // ============================================================================

  async evaluateSituation(
    tenantId: string | null,
    situation: string,
    context?: Record<string, unknown>
  ): Promise<MoralEvaluation> {
    const principles = await this.getPrinciples(tenantId);
    const settings = await this.getSettings(tenantId);

    // Use AI to evaluate the situation against principles
    const prompt = `You are the moral reasoning component of an AGI system. Evaluate this situation against ethical principles.

SITUATION:
${situation}

${context ? `CONTEXT: ${JSON.stringify(context)}` : ''}

ETHICAL PRINCIPLES TO CONSIDER:
${principles.map(p => `
${p.principleNumber}. ${p.title} (Priority: ${p.priority}, Absolute: ${p.isAbsolute})
   Principle: ${p.principleText}
   Do: ${p.positiveBehaviors.slice(0, 3).join(', ')}
   Don't: ${p.negativeBehaviors.slice(0, 3).join(', ')}
`).join('\n')}

Analyze the situation and determine:
1. Which principles are most relevant
2. Whether proceeding would align with or violate these principles
3. Your recommendation for how to handle this situation

Return JSON:
{
  "relevant_principles": [
    {"number": 1, "relevance_score": 0.0-1.0, "applies": "supports|opposes|neutral", "reason": "..."}
  ],
  "recommendation": "proceed|refuse|modify|clarify",
  "reasoning": "Detailed moral reasoning",
  "confidence": 0.0-1.0,
  "suggested_response": "If modifying or refusing, how to respond",
  "potential_harm": "Any potential harm identified",
  "potential_good": "Any potential good identified"
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2000,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const evaluation: MoralEvaluation = {
          situation,
          relevantPrinciples: (parsed.relevant_principles || []).map((rp: { number: number; relevance_score: number; applies: string; reason: string }) => {
            const principle = principles.find(p => p.principleNumber === rp.number);
            return {
              principle: principle || principles[0],
              relevanceScore: rp.relevance_score,
              applies: rp.applies as 'supports' | 'opposes' | 'neutral',
            };
          }),
          recommendation: parsed.recommendation || 'proceed',
          reasoning: parsed.reasoning || '',
          confidence: parsed.confidence || 0.7,
          suggestedResponse: parsed.suggested_response,
        };

        // Log the decision if enabled
        if (settings.logMoralDecisions) {
          await this.logDecision(tenantId, evaluation);
        }

        return evaluation;
      }
    } catch (error) {
      logger.warn('LLM moral evaluation failed, using enhanced keyword analysis', { error });
    }

    // Enhanced fallback: keyword-based evaluation with principle matching
    return this.performKeywordBasedEvaluation(situation, principles);
  }
  
  /**
   * Enhanced keyword-based moral evaluation when LLM is unavailable
   */
  private performKeywordBasedEvaluation(
    situation: string,
    principles: MoralPrinciple[]
  ): MoralEvaluation {
    const lowerSituation = situation.toLowerCase();
    
    // Risk keywords that suggest caution
    const riskKeywords = {
      high: ['harm', 'kill', 'destroy', 'attack', 'illegal', 'fraud', 'steal', 'weapon', 'violence', 'abuse'],
      medium: ['mislead', 'deceive', 'manipulate', 'exploit', 'bypass', 'circumvent', 'hack', 'break'],
      low: ['controversial', 'sensitive', 'personal', 'private', 'confidential'],
    };
    
    // Positive keywords that suggest alignment
    const positiveKeywords = ['help', 'assist', 'protect', 'educate', 'inform', 'support', 'improve', 'learn'];
    
    // Calculate risk level
    let riskScore = 0;
    let positiveScore = 0;
    
    for (const word of riskKeywords.high) {
      if (lowerSituation.includes(word)) riskScore += 0.4;
    }
    for (const word of riskKeywords.medium) {
      if (lowerSituation.includes(word)) riskScore += 0.2;
    }
    for (const word of riskKeywords.low) {
      if (lowerSituation.includes(word)) riskScore += 0.1;
    }
    for (const word of positiveKeywords) {
      if (lowerSituation.includes(word)) positiveScore += 0.15;
    }
    
    // Match principles based on keywords
    const relevantPrinciples = principles.slice(0, 5).map(p => {
      const principleText = (p.title + ' ' + (p.principleText || '')).toLowerCase();
      let relevanceScore = 0.3; // Base relevance
      let applies: 'supports' | 'opposes' | 'neutral' = 'neutral';
      
      // Check if principle keywords appear in situation
      const principleWords = principleText.split(/\s+/).filter(w => w.length > 4);
      for (const word of principleWords) {
        if (lowerSituation.includes(word)) {
          relevanceScore += 0.1;
        }
      }
      
      // Determine if principle supports or opposes
      if (riskScore > 0.3 && p.title.toLowerCase().includes('harm')) {
        applies = 'opposes';
        relevanceScore = Math.max(relevanceScore, 0.7);
      } else if (positiveScore > 0.2) {
        applies = 'supports';
      }
      
      return {
        principle: p,
        relevanceScore: Math.min(1, relevanceScore),
        applies,
      };
    });
    
    // Determine recommendation
    let recommendation: 'proceed' | 'modify' | 'refuse' = 'proceed';
    let reasoning = 'Situation appears acceptable based on keyword analysis.';
    
    if (riskScore >= 0.6) {
      recommendation = 'refuse';
      reasoning = 'High-risk keywords detected. Refusing to proceed.';
    } else if (riskScore >= 0.3) {
      recommendation = 'modify';
      reasoning = 'Some concerning elements detected. Suggest modifications for safety.';
    } else if (positiveScore > riskScore) {
      reasoning = 'Situation appears aligned with positive outcomes.';
    }
    
    // Check for absolute principle violations
    const absoluteViolation = relevantPrinciples.find(
      rp => rp.principle.isAbsolute && rp.applies === 'opposes' && rp.relevanceScore > 0.6
    );
    if (absoluteViolation) {
      recommendation = 'refuse';
      reasoning = `Potential violation of absolute principle: ${absoluteViolation.principle.title}`;
    }
    
    return {
      situation,
      relevantPrinciples,
      recommendation,
      reasoning,
      confidence: 0.5, // Lower confidence for keyword-based analysis
    };
  }

  async shouldProceed(
    tenantId: string | null,
    situation: string
  ): Promise<{ proceed: boolean; reason: string; evaluation: MoralEvaluation }> {
    const evaluation = await this.evaluateSituation(tenantId, situation);
    const settings = await this.getSettings(tenantId);

    let proceed = true;
    let reason = 'Action aligns with ethical principles.';

    // Check for absolute principle violations
    const absoluteViolations = evaluation.relevantPrinciples.filter(
      rp => rp.principle.isAbsolute && rp.applies === 'opposes' && rp.relevanceScore > 0.7
    );

    if (absoluteViolations.length > 0) {
      proceed = false;
      reason = `Action violates absolute principle: ${absoluteViolations[0].principle.title}`;
    } else if (evaluation.recommendation === 'refuse') {
      proceed = settings.enforcementMode !== 'advisory';
      reason = evaluation.reasoning;
    } else if (evaluation.recommendation === 'modify') {
      proceed = true;
      reason = `Proceed with modification: ${evaluation.suggestedResponse || evaluation.reasoning}`;
    }

    return { proceed, reason, evaluation };
  }

  // ============================================================================
  // Decision Logging
  // ============================================================================

  async logDecision(tenantId: string | null, evaluation: MoralEvaluation): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO moral_decision_log (
        tenant_id, situation_summary, principles_evaluated, primary_principle_id,
        decision_made, moral_reasoning, action_taken, confidence, had_conflict
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING decision_id`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'situation', value: { stringValue: evaluation.situation.substring(0, 1000) } },
        { name: 'principles', value: { stringValue: `{${evaluation.relevantPrinciples.map(rp => rp.principle.principleId).join(',')}}` } },
        { name: 'primaryPrinciple', value: evaluation.relevantPrinciples[0]?.principle.principleId ? { stringValue: evaluation.relevantPrinciples[0].principle.principleId } : { isNull: true } },
        { name: 'decision', value: { stringValue: evaluation.recommendation } },
        { name: 'reasoning', value: { stringValue: evaluation.reasoning } },
        { name: 'action', value: { stringValue: evaluation.recommendation } },
        { name: 'confidence', value: { doubleValue: evaluation.confidence } },
        { name: 'hadConflict', value: { booleanValue: evaluation.relevantPrinciples.some(rp => rp.applies === 'opposes') } },
      ]
    );

    return (result.rows[0] as { decision_id: string }).decision_id;
  }

  async getDecisionHistory(tenantId: string | null, limit = 50): Promise<MoralDecision[]> {
    const result = await executeStatement(
      `SELECT * FROM moral_decision_log 
       WHERE tenant_id IS NOT DISTINCT FROM $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapDecision(row as Record<string, unknown>));
  }

  // ============================================================================
  // Modification History
  // ============================================================================

  async getModificationHistory(principleId?: string, limit = 50): Promise<Array<{
    modificationId: string;
    principleId: string;
    modificationType: string;
    modifiedBy: string;
    reason?: string;
    createdAt: string;
  }>> {
    const result = await executeStatement(
      `SELECT * FROM principle_modification_history
       ${principleId ? 'WHERE principle_id = $1' : ''}
       ORDER BY created_at DESC
       LIMIT $${principleId ? '2' : '1'}`,
      principleId
        ? [
            { name: 'principleId', value: { stringValue: principleId } },
            { name: 'limit', value: { longValue: limit } },
          ]
        : [{ name: 'limit', value: { longValue: limit } }]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        modificationId: String(r.modification_id),
        principleId: String(r.principle_id),
        modificationType: String(r.modification_type),
        modifiedBy: String(r.modified_by),
        reason: r.reason ? String(r.reason) : undefined,
        createdAt: String(r.created_at),
      };
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapPrinciple(row: Record<string, unknown>): MoralPrinciple {
    return {
      principleId: String(row.principle_id),
      principleNumber: Number(row.principle_number),
      title: String(row.title),
      principleText: String(row.principle_text),
      explanation: row.explanation ? String(row.explanation) : undefined,
      positiveBehaviors: typeof row.positive_behaviors === 'string' 
        ? JSON.parse(row.positive_behaviors) 
        : (row.positive_behaviors as string[]) || [],
      negativeBehaviors: typeof row.negative_behaviors === 'string' 
        ? JSON.parse(row.negative_behaviors) 
        : (row.negative_behaviors as string[]) || [],
      exampleApplications: typeof row.example_applications === 'string' 
        ? JSON.parse(row.example_applications) 
        : (row.example_applications as string[]) || [],
      category: String(row.category || 'general'),
      priority: Number(row.priority ?? 5),
      isAbsolute: Boolean(row.is_absolute),
      isDefault: Boolean(row.is_default),
      isActive: Boolean(row.is_active ?? true),
      modifiedBy: row.modified_by ? String(row.modified_by) : undefined,
      modifiedAt: row.modified_at ? String(row.modified_at) : undefined,
      modificationReason: row.modification_reason ? String(row.modification_reason) : undefined,
    };
  }

  private mapSettings(row: Record<string, unknown>): MoralCompassSettings {
    return {
      settingsId: String(row.settings_id),
      enforcementMode: (row.enforcement_mode as MoralCompassSettings['enforcementMode']) || 'strict',
      conflictResolution: (row.conflict_resolution as MoralCompassSettings['conflictResolution']) || 'priority_based',
      explainMoralReasoning: Boolean(row.explain_moral_reasoning ?? true),
      logMoralDecisions: Boolean(row.log_moral_decisions ?? true),
      allowSituationalOverride: Boolean(row.allow_situational_override),
      requireOverrideJustification: Boolean(row.require_override_justification ?? true),
      notifyOnMoralConflict: Boolean(row.notify_on_moral_conflict ?? true),
      notifyOnPrincipleViolation: Boolean(row.notify_on_principle_violation ?? true),
    };
  }

  private mapDecision(row: Record<string, unknown>): MoralDecision {
    return {
      decisionId: String(row.decision_id),
      situationSummary: String(row.situation_summary),
      principlesEvaluated: (row.principles_evaluated as string[]) || [],
      primaryPrincipleId: row.primary_principle_id ? String(row.primary_principle_id) : undefined,
      decisionMade: String(row.decision_made),
      moralReasoning: row.moral_reasoning ? String(row.moral_reasoning) : undefined,
      actionTaken: String(row.action_taken),
      confidence: Number(row.confidence ?? 0.5),
      hadConflict: Boolean(row.had_conflict),
      createdAt: String(row.created_at),
    };
  }
}

export const moralCompassService = new MoralCompassService();
