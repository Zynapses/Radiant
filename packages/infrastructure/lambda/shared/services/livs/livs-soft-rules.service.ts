/**
 * LIVS Soft Rules Service
 * 
 * Manages configurable integrity rules that can be customized by:
 * - System (RADIANT platform defaults)
 * - Tenant Admin (per-tenant overrides)
 * - User (personal preferences)
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  LIVSSoftRule,
  CreateLIVSSoftRuleRequest,
  LIVSSoftRuleConditions,
  LIVSSoftRuleActions,
  SoftRuleCreatorType,
  LIVSQueryType,
  LIVSUserTier
} from '@radiant/shared';

export interface LIVSSoftRulesServiceDeps {
  pool: Pool;
}

export interface RuleMatchContext {
  domain?: string;
  modelId?: string;
  queryType?: LIVSQueryType;
  confidence?: number;
  userTier?: LIVSUserTier;
  tokenCount?: number;
  keywords?: string[];
}

export class LIVSSoftRulesService {
  private pool: Pool;

  constructor(deps: LIVSSoftRulesServiceDeps) {
    this.pool = deps.pool;
  }

  /**
   * Get all soft rules for a tenant
   */
  async getRules(
    tenantId: string,
    options?: { activeOnly?: boolean }
  ): Promise<LIVSSoftRule[]> {
    let query = `SELECT * FROM livs_soft_rules WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (options?.activeOnly) {
      query += ` AND active = true`;
    }

    query += ` ORDER BY priority DESC, created_at ASC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapRowToRule);
  }

  /**
   * Get a single rule by ID
   */
  async getRule(tenantId: string, ruleId: string): Promise<LIVSSoftRule | null> {
    const result = await this.pool.query(
      `SELECT * FROM livs_soft_rules WHERE tenant_id = $1 AND id = $2`,
      [tenantId, ruleId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToRule(result.rows[0]);
  }

  /**
   * Create a new soft rule
   */
  async createRule(
    tenantId: string,
    request: CreateLIVSSoftRuleRequest,
    createdByType: SoftRuleCreatorType,
    createdBy?: string
  ): Promise<LIVSSoftRule> {
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO livs_soft_rules (
        id, tenant_id, name, description, conditions, actions,
        priority, created_by_type, created_by, active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        tenantId,
        request.name,
        request.description,
        JSON.stringify(request.conditions),
        JSON.stringify(request.actions),
        request.priority ?? 0,
        createdByType,
        createdBy,
        request.active ?? true,
        now,
        now
      ]
    );

    return {
      id,
      tenantId,
      name: request.name,
      description: request.description,
      conditions: request.conditions,
      actions: request.actions,
      priority: request.priority ?? 0,
      createdByType,
      createdBy,
      active: request.active ?? true,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Update an existing soft rule
   */
  async updateRule(
    tenantId: string,
    ruleId: string,
    updates: Partial<CreateLIVSSoftRuleRequest>
  ): Promise<LIVSSoftRule | null> {
    const existing = await this.getRule(tenantId, ruleId);
    if (!existing) {
      return null;
    }

    const updateFields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }
    if (updates.conditions !== undefined) {
      updateFields.push(`conditions = $${paramIndex++}`);
      params.push(JSON.stringify(updates.conditions));
    }
    if (updates.actions !== undefined) {
      updateFields.push(`actions = $${paramIndex++}`);
      params.push(JSON.stringify(updates.actions));
    }
    if (updates.priority !== undefined) {
      updateFields.push(`priority = $${paramIndex++}`);
      params.push(updates.priority);
    }
    if (updates.active !== undefined) {
      updateFields.push(`active = $${paramIndex++}`);
      params.push(updates.active);
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());

    params.push(tenantId, ruleId);

    await this.pool.query(
      `UPDATE livs_soft_rules SET ${updateFields.join(', ')}
       WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex}`,
      params
    );

    return this.getRule(tenantId, ruleId);
  }

  /**
   * Delete a soft rule
   */
  async deleteRule(tenantId: string, ruleId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM livs_soft_rules WHERE tenant_id = $1 AND id = $2`,
      [tenantId, ruleId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get matching rules for a given context
   * Rules are returned sorted by priority (highest first)
   */
  async getMatchingRules(
    tenantId: string,
    context: RuleMatchContext
  ): Promise<LIVSSoftRule[]> {
    const rules = await this.getRules(tenantId, { activeOnly: true });
    return rules.filter(rule => this.matchesConditions(rule.conditions, context));
  }

  /**
   * Check if conditions match the context
   */
  private matchesConditions(
    conditions: LIVSSoftRuleConditions,
    context: RuleMatchContext
  ): boolean {
    // Check domain match
    if (conditions.domains && conditions.domains.length > 0) {
      if (!context.domain || !conditions.domains.includes(context.domain)) {
        return false;
      }
    }

    // Check model match
    if (conditions.models && conditions.models.length > 0) {
      if (!context.modelId || !conditions.models.includes(context.modelId)) {
        return false;
      }
    }

    // Check query type match
    if (conditions.queryTypes && conditions.queryTypes.length > 0) {
      if (!context.queryType || !conditions.queryTypes.includes(context.queryType)) {
        return false;
      }
    }

    // Check confidence range
    if (conditions.confidenceRange) {
      const [min, max] = conditions.confidenceRange;
      if (context.confidence !== undefined) {
        if (context.confidence < min || context.confidence > max) {
          return false;
        }
      }
    }

    // Check user tier
    if (conditions.userTiers && conditions.userTiers.length > 0) {
      if (!context.userTier || !conditions.userTiers.includes(context.userTier)) {
        return false;
      }
    }

    // Check minimum tokens
    if (conditions.minTokens !== undefined) {
      if (context.tokenCount === undefined || context.tokenCount < conditions.minTokens) {
        return false;
      }
    }

    // Check keywords
    if (conditions.keywords && conditions.keywords.length > 0) {
      if (!context.keywords || !conditions.keywords.some(k => context.keywords?.includes(k))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply actions from matching rules
   * Returns merged actions (later rules override earlier ones based on priority)
   */
  async applyRules(
    tenantId: string,
    context: RuleMatchContext
  ): Promise<LIVSSoftRuleActions> {
    const matchingRules = await this.getMatchingRules(tenantId, context);
    
    // Merge actions from all matching rules (lower priority first, so higher priority overrides)
    const sortedRules = [...matchingRules].sort((a, b) => a.priority - b.priority);
    
    let mergedActions: LIVSSoftRuleActions = {};
    for (const rule of sortedRules) {
      mergedActions = { ...mergedActions, ...rule.actions };
    }

    return mergedActions;
  }

  /**
   * Get system default rules
   */
  async getSystemRules(tenantId: string): Promise<LIVSSoftRule[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_soft_rules 
       WHERE tenant_id = $1 AND created_by_type = 'system'
       ORDER BY priority DESC`,
      [tenantId]
    );

    return result.rows.map(this.mapRowToRule);
  }

  /**
   * Get tenant admin rules
   */
  async getTenantRules(tenantId: string): Promise<LIVSSoftRule[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_soft_rules 
       WHERE tenant_id = $1 AND created_by_type = 'tenant_admin'
       ORDER BY priority DESC`,
      [tenantId]
    );

    return result.rows.map(this.mapRowToRule);
  }

  /**
   * Get user-created rules
   */
  async getUserRules(tenantId: string, userId: string): Promise<LIVSSoftRule[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_soft_rules 
       WHERE tenant_id = $1 AND created_by_type = 'user' AND created_by = $2
       ORDER BY priority DESC`,
      [tenantId, userId]
    );

    return result.rows.map(this.mapRowToRule);
  }

  /**
   * Toggle rule active status
   */
  async toggleRule(tenantId: string, ruleId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE livs_soft_rules 
       SET active = NOT active, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2
       RETURNING active`,
      [tenantId, ruleId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].active;
  }

  /**
   * Bulk enable/disable rules
   */
  async bulkSetActive(tenantId: string, ruleIds: string[], active: boolean): Promise<number> {
    const result = await this.pool.query(
      `UPDATE livs_soft_rules 
       SET active = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND id = ANY($2)`,
      [tenantId, ruleIds, active]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Map database row to LIVSSoftRule
   */
  private mapRowToRule(row: Record<string, unknown>): LIVSSoftRule {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      conditions: row.conditions as LIVSSoftRuleConditions,
      actions: row.actions as LIVSSoftRuleActions,
      priority: row.priority as number,
      createdByType: row.created_by_type as SoftRuleCreatorType,
      createdBy: row.created_by as string | undefined,
      active: row.active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string)
    };
  }
}
