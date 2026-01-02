/**
 * Curiosity Engine Service
 * Autonomous goal emergence and exploration driven by knowledge gaps.
 * RADIANT v6.1.0
 */

import type { KnowledgeGap, Goal, GoalType, GoalStatus, GoalGuardrails, Milestone } from '@radiant/shared';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { DEFAULT_GOAL_GUARDRAILS } from '@radiant/shared/constants';
import { getDbPool } from './database';
import { callLiteLLM } from './litellm.service';

export class CuriosityEngineService {
  private guardrails: GoalGuardrails;
  
  constructor(guardrails?: Partial<GoalGuardrails>) {
    this.guardrails = { ...DEFAULT_GOAL_GUARDRAILS, ...guardrails };
  }
  
  async identifyKnowledgeGap(
    tenantId: string,
    prompt: string,
    response: string,
    wasUncertain: boolean
  ): Promise<KnowledgeGap | null> {
    if (!wasUncertain) return null;
    
    const analysisPrompt = `Analyze this interaction for knowledge gaps.

USER PROMPT: ${prompt.slice(0, 500)}

AI RESPONSE (marked uncertain): ${response.slice(0, 1000)}

If there's a clear knowledge gap, return JSON:
{
  "has_gap": true,
  "domain": "domain area",
  "topic": "specific topic",
  "evidence": ["why this is a gap"],
  "importance": 0.0-1.0
}

If no significant gap, return: { "has_gap": false }`;

    const result = await callLiteLLM({
      model: 'claude-sonnet-4',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
      max_tokens: 300,
    });
    
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.has_gap) return null;
      
      const gap: KnowledgeGap = {
        id: crypto.randomUUID(),
        tenantId,
        domain: parsed.domain || 'general',
        topic: parsed.topic || 'unknown',
        evidenceOfGap: parsed.evidence || [],
        frequency: 1,
        importance: parsed.importance || 0.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await this.storeGap(gap);
      return gap;
    } catch {
      return null;
    }
  }
  
  async getKnowledgeGaps(
    tenantId: string,
    options: { minImportance?: number; limit?: number } = {}
  ): Promise<KnowledgeGap[]> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM knowledge_gaps
      WHERE tenant_id = $1 AND importance >= $2
      ORDER BY frequency * importance DESC
      LIMIT $3
    `, [tenantId, options.minImportance || 0, options.limit || 50]);
    
    return result.rows.map(this.rowToGap);
  }
  
  async generateGoalFromGap(tenantId: string, gap: KnowledgeGap): Promise<Goal | null> {
    const existingGoal = await this.findExistingGoal(tenantId, gap.id);
    if (existingGoal) return existingGoal;
    
    const goalSpec = await this.generateGoalSpec(gap);
    if (!this.validateGoal(goalSpec)) return null;
    
    const goal: Goal = {
      id: crypto.randomUUID(),
      tenantId,
      type: 'emergent',
      description: goalSpec.description,
      priority: this.calculatePriority(gap),
      status: 'pending',
      curiositySourceId: gap.id,
      explorationStrategy: goalSpec.strategy,
      progress: 0,
      milestones: goalSpec.milestones.map((m: string, i: number) => ({
        id: `${i}`,
        description: m,
        completed: false,
        completedAt: null,
      })),
      tokensUsed: 0,
      costUsed: 0,
      createdAt: new Date(),
      targetCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      completedAt: null,
    };
    
    await this.storeGoal(goal);
    return goal;
  }
  
  async getActiveGoals(tenantId: string): Promise<Goal[]> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM curiosity_goals
      WHERE tenant_id = $1 AND status IN ('pending', 'active')
      ORDER BY priority DESC, created_at ASC
    `, [tenantId]);
    
    return result.rows.map(this.rowToGoal);
  }
  
  async getGoalById(tenantId: string, goalId: string): Promise<Goal | null> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM curiosity_goals WHERE tenant_id = $1 AND id = $2
    `, [tenantId, goalId]);
    
    return result.rows.length > 0 ? this.rowToGoal(result.rows[0]) : null;
  }
  
  async exploreGoal(
    tenantId: string,
    goalId: string,
    budget: { maxTokens: number; maxCost: number }
  ): Promise<{ tokensUsed: number; costUsed: number; progress: number }> {
    const goal = await this.getGoalById(tenantId, goalId);
    if (!goal || goal.status === 'completed' || goal.status === 'abandoned') {
      return { tokensUsed: 0, costUsed: 0, progress: goal?.progress || 0 };
    }
    
    if (goal.priority > this.guardrails.requireApprovalAbove) {
      logger.info(`Goal ${goalId} requires approval (priority ${goal.priority})`);
      return { tokensUsed: 0, costUsed: 0, progress: goal.progress };
    }
    
    let tokensUsed = 0;
    let costUsed = 0;
    
    const pendingMilestones = goal.milestones.filter(m => !m.completed);
    
    for (const milestone of pendingMilestones) {
      if (tokensUsed >= budget.maxTokens || costUsed >= budget.maxCost) break;
      
      const result = await this.workOnMilestone(goal, milestone, {
        maxTokens: budget.maxTokens - tokensUsed,
      });
      
      tokensUsed += result.tokensUsed;
      costUsed += result.costUsed;
      
      if (result.milestoneCompleted) {
        milestone.completed = true;
        milestone.completedAt = new Date();
      }
    }
    
    const completedCount = goal.milestones.filter(m => m.completed).length;
    const progress = goal.milestones.length > 0 ? completedCount / goal.milestones.length : 0;
    
    const newStatus: GoalStatus = progress >= 1 ? 'completed' : 'active';
    
    const pool = await getDbPool();
    await pool.query(`
      UPDATE curiosity_goals SET 
        status = $1, progress = $2, milestones = $3,
        tokens_used = tokens_used + $4, cost_used = cost_used + $5,
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE NULL END
      WHERE id = $6
    `, [newStatus, progress, JSON.stringify(goal.milestones), tokensUsed, costUsed, goalId]);
    
    return { tokensUsed, costUsed, progress };
  }
  
  async runExplorationCycle(
    tenantId: string,
    budget: { maxTokens: number; maxCost: number }
  ): Promise<{ goalsExplored: number; totalTokensUsed: number; totalCostUsed: number }> {
    const goals = await this.getActiveGoals(tenantId);
    let totalTokensUsed = 0;
    let totalCostUsed = 0;
    let goalsExplored = 0;
    
    for (const goal of goals) {
      if (totalTokensUsed >= budget.maxTokens || totalCostUsed >= budget.maxCost) break;
      
      const result = await this.exploreGoal(tenantId, goal.id, {
        maxTokens: Math.min(budget.maxTokens - totalTokensUsed, 10000),
        maxCost: Math.min(budget.maxCost - totalCostUsed, 1.0),
      });
      
      totalTokensUsed += result.tokensUsed;
      totalCostUsed += result.costUsed;
      if (result.tokensUsed > 0) goalsExplored++;
    }
    
    return { goalsExplored, totalTokensUsed, totalCostUsed };
  }
  
  async abandonGoal(tenantId: string, goalId: string, reason: string): Promise<void> {
    const pool = await getDbPool();
    await pool.query(`
      UPDATE curiosity_goals SET status = 'abandoned'
      WHERE id = $1 AND tenant_id = $2
    `, [goalId, tenantId]);
  }
  
  async getStats(tenantId: string): Promise<{
    totalGaps: number;
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    totalTokensUsed: number;
    totalCostUsed: number;
  }> {
    const pool = await getDbPool();
    
    const gapsResult = await pool.query(`
      SELECT COUNT(*) as count FROM knowledge_gaps WHERE tenant_id = $1
    `, [tenantId]);
    
    const goalsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('pending', 'active')) as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        SUM(tokens_used) as total_tokens,
        SUM(cost_used) as total_cost
      FROM curiosity_goals WHERE tenant_id = $1
    `, [tenantId]);
    
    const goals = goalsResult.rows[0];
    
    return {
      totalGaps: parseInt(gapsResult.rows[0].count),
      totalGoals: parseInt(goals.total),
      activeGoals: parseInt(goals.active),
      completedGoals: parseInt(goals.completed),
      totalTokensUsed: parseInt(goals.total_tokens) || 0,
      totalCostUsed: parseFloat(goals.total_cost) || 0,
    };
  }
  
  private async generateGoalSpec(gap: KnowledgeGap): Promise<{
    description: string;
    strategy: string;
    milestones: string[];
  }> {
    const response = await callLiteLLM({
      model: 'claude-sonnet-4',
      messages: [{
        role: 'user',
        content: `Generate learning goal for:
Domain: ${gap.domain}
Topic: ${gap.topic}

Return JSON: {"description": "...", "strategy": "...", "milestones": ["...", "...", "..."]}`,
      }],
      temperature: 0.5,
      max_tokens: 500,
    });
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error();
      return JSON.parse(jsonMatch[0]);
    } catch {
      return {
        description: `Improve knowledge of ${gap.topic}`,
        strategy: 'Research and summarize',
        milestones: ['Identify key concepts', 'Research details', 'Summarize findings'],
      };
    }
  }
  
  private validateGoal(goalSpec: { description: string }): boolean {
    const desc = goalSpec.description.toLowerCase();
    return !this.guardrails.forbiddenPatterns.some(p => desc.includes(p.toLowerCase()));
  }
  
  private calculatePriority(gap: KnowledgeGap): number {
    return Math.round(Math.min(gap.frequency / 20, 1) * 5 + gap.importance * 5);
  }
  
  private async workOnMilestone(
    goal: Goal,
    milestone: Milestone,
    budget: { maxTokens: number }
  ): Promise<{ milestoneCompleted: boolean; tokensUsed: number; costUsed: number }> {
    const response = await callLiteLLM({
      model: 'claude-sonnet-4',
      messages: [{
        role: 'user',
        content: `Goal: ${goal.description}
Milestone: ${milestone.description}
Strategy: ${goal.explorationStrategy}

Work on this milestone:`,
      }],
      temperature: 0.7,
      max_tokens: Math.min(budget.maxTokens, 2000),
    });
    
    const tokensUsed = response.usage?.total_tokens || 1000;
    const milestoneCompleted = response.content.length > 500;
    
    return {
      milestoneCompleted,
      tokensUsed,
      costUsed: (tokensUsed / 1000) * 0.003,
    };
  }
  
  private async storeGap(gap: KnowledgeGap): Promise<void> {
    const pool = await getDbPool();
    await pool.query(`
      INSERT INTO knowledge_gaps (id, tenant_id, domain, topic, evidence_of_gap, frequency, importance, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (tenant_id, domain, topic) DO UPDATE SET
        evidence_of_gap = EXCLUDED.evidence_of_gap,
        frequency = knowledge_gaps.frequency + 1,
        importance = GREATEST(knowledge_gaps.importance, EXCLUDED.importance),
        updated_at = NOW()
    `, [gap.id, gap.tenantId, gap.domain, gap.topic, gap.evidenceOfGap, gap.frequency, gap.importance]);
  }
  
  private async storeGoal(goal: Goal): Promise<void> {
    const pool = await getDbPool();
    await pool.query(`
      INSERT INTO curiosity_goals (
        id, tenant_id, type, description, priority, status,
        curiosity_source_id, exploration_strategy, progress, milestones,
        tokens_used, cost_used, created_at, target_completion_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
    `, [
      goal.id, goal.tenantId, goal.type, goal.description, goal.priority, goal.status,
      goal.curiositySourceId, goal.explorationStrategy, goal.progress, JSON.stringify(goal.milestones),
      goal.tokensUsed, goal.costUsed, goal.targetCompletionDate,
    ]);
  }
  
  private async findExistingGoal(tenantId: string, gapId: string): Promise<Goal | null> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM curiosity_goals
      WHERE tenant_id = $1 AND curiosity_source_id = $2 AND status != 'abandoned'
      LIMIT 1
    `, [tenantId, gapId]);
    return result.rows.length > 0 ? this.rowToGoal(result.rows[0]) : null;
  }
  
  private rowToGap(row: any): KnowledgeGap {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      domain: row.domain,
      topic: row.topic,
      evidenceOfGap: row.evidence_of_gap || [],
      frequency: row.frequency,
      importance: parseFloat(row.importance),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
  
  private rowToGoal(row: any): Goal {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type as GoalType,
      description: row.description,
      priority: row.priority,
      status: row.status as GoalStatus,
      curiositySourceId: row.curiosity_source_id,
      explorationStrategy: row.exploration_strategy,
      progress: parseFloat(row.progress),
      milestones: row.milestones || [],
      tokensUsed: row.tokens_used,
      costUsed: parseFloat(row.cost_used),
      createdAt: new Date(row.created_at),
      targetCompletionDate: row.target_completion_date ? new Date(row.target_completion_date) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
    };
  }
}

export const curiosityEngine = new CuriosityEngineService();
