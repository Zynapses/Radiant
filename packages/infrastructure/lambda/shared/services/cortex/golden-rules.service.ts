/**
 * Cortex Golden Rules Service
 * Override system for verified facts with Chain of Custody
 */

import { createHash } from 'crypto';
import type {
  GoldenRule,
  GoldenRuleCreateRequest,
  GoldenRuleMatch,
  GoldenRuleType,
  ChainOfCustody,
  AuditTrailEntry,
  ChainOfCustodyCreateRequest,
} from '@radiant/shared';

interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

export class GoldenRulesService {
  constructor(private db: DbClient) {}

  /**
   * Create a new Golden Rule with Chain of Custody
   */
  async createRule(
    request: GoldenRuleCreateRequest,
    userId: string
  ): Promise<GoldenRule> {
    const signature = this.generateSignature(
      request.condition + request.override,
      userId
    );

    const result = await this.db.query(
      `INSERT INTO cortex_golden_rules (
        tenant_id, entity_id, rule_type, condition, override, reason,
        priority, verified_by, signature, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        request.tenantId,
        request.entityId || null,
        request.ruleType,
        request.condition,
        request.override,
        request.reason,
        request.priority || 100,
        userId,
        signature,
        request.expiresAt || null,
      ]
    );

    const rule = this.mapRowToRule(result.rows[0]);

    // Create Chain of Custody entry
    await this.createChainOfCustody({
      tenantId: request.tenantId,
      factId: rule.id,
      source: `Golden Rule: ${request.condition}`,
      sourceType: 'golden_rule',
      metadata: { ruleType: request.ruleType, override: request.override },
    }, userId);

    return rule;
  }

  /**
   * Check if a query matches any Golden Rules
   */
  async checkMatch(
    tenantId: string,
    query: string,
    entityId?: string
  ): Promise<GoldenRuleMatch | null> {
    const result = await this.db.query(
      `SELECT * FROM check_golden_rule_match($1, $2, $3)`,
      [tenantId, query, entityId || null]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as {
      rule_id: string;
      rule_type: GoldenRuleType;
      override: string;
      priority: number;
      verified_by: string;
      verified_at: Date;
      signature: string;
    };

    // Get Chain of Custody for this rule
    const custodyResult = await this.db.query(
      `SELECT * FROM cortex_chain_of_custody WHERE fact_id = $1`,
      [row.rule_id]
    );

    const custody = custodyResult.rows[0] as ChainOfCustody | undefined;

    return {
      ruleId: row.rule_id,
      ruleType: row.rule_type,
      override: row.override,
      confidence: 1.0, // Golden Rules have 100% confidence
      chainOfCustody: custody || {
        factId: row.rule_id,
        tenantId,
        source: 'Golden Rule',
        sourceType: 'golden_rule',
        extractedAt: row.verified_at,
        verifiedBy: row.verified_by,
        verifiedAt: row.verified_at,
        signature: row.signature,
        metadata: {},
      },
    };
  }

  /**
   * List all Golden Rules for a tenant
   */
  async listRules(
    tenantId: string,
    options: { activeOnly?: boolean; ruleType?: GoldenRuleType } = {}
  ): Promise<GoldenRule[]> {
    let sql = `SELECT * FROM cortex_golden_rules WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (options.activeOnly) {
      sql += ` AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())`;
    }
    if (options.ruleType) {
      params.push(options.ruleType);
      sql += ` AND rule_type = $${params.length}`;
    }

    sql += ` ORDER BY priority DESC, created_at DESC`;

    const result = await this.db.query(sql, params);
    return result.rows.map((row) => this.mapRowToRule(row));
  }

  /**
   * Deactivate a Golden Rule
   */
  async deactivateRule(
    tenantId: string,
    ruleId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE cortex_golden_rules SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [ruleId, tenantId]
    );

    // Add audit trail entry
    await this.addAuditEntry(ruleId, 'deleted', userId, reason);
  }

  /**
   * Create Chain of Custody entry
   */
  async createChainOfCustody(
    request: ChainOfCustodyCreateRequest,
    userId: string
  ): Promise<ChainOfCustody> {
    const signature = this.generateSignature(
      request.factId + request.source,
      userId
    );

    const result = await this.db.query(
      `INSERT INTO cortex_chain_of_custody (
        fact_id, tenant_id, source, source_type, extracted_by, metadata, signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        request.factId,
        request.tenantId,
        request.source,
        request.sourceType,
        userId,
        JSON.stringify(request.metadata || {}),
        signature,
      ]
    );

    return this.mapRowToCustody(result.rows[0]);
  }

  /**
   * Verify a fact in Chain of Custody
   */
  async verifyFact(
    factId: string,
    tenantId: string,
    userId: string
  ): Promise<ChainOfCustody> {
    const signature = this.generateSignature(factId + 'verified', userId);

    const result = await this.db.query(
      `UPDATE cortex_chain_of_custody 
       SET verified_by = $1, verified_at = NOW(), signature = $2
       WHERE fact_id = $3 AND tenant_id = $4
       RETURNING *`,
      [userId, signature, factId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Chain of Custody not found for fact: ${factId}`);
    }

    // Add audit trail
    await this.addAuditEntry(factId, 'verified', userId);

    return this.mapRowToCustody(result.rows[0]);
  }

  /**
   * Get Chain of Custody for a fact
   */
  async getChainOfCustody(
    factId: string,
    tenantId: string
  ): Promise<ChainOfCustody | null> {
    const result = await this.db.query(
      `SELECT * FROM cortex_chain_of_custody WHERE fact_id = $1 AND tenant_id = $2`,
      [factId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCustody(result.rows[0]);
  }

  /**
   * Get audit trail for a fact
   */
  async getAuditTrail(factId: string): Promise<AuditTrailEntry[]> {
    const result = await this.db.query(
      `SELECT at.* FROM cortex_audit_trail at
       JOIN cortex_chain_of_custody coc ON at.chain_of_custody_id = coc.id
       WHERE coc.fact_id = $1
       ORDER BY at.performed_at DESC`,
      [factId]
    );

    return result.rows.map((row) => this.mapRowToAuditEntry(row));
  }

  /**
   * Add audit trail entry
   */
  private async addAuditEntry(
    factId: string,
    action: AuditTrailEntry['action'],
    userId: string,
    reason?: string,
    previousValue?: string,
    newValue?: string
  ): Promise<void> {
    const custodyResult = await this.db.query(
      `SELECT id FROM cortex_chain_of_custody WHERE fact_id = $1`,
      [factId]
    );

    if (custodyResult.rows.length === 0) {
      return; // No chain of custody to audit
    }

    const custodyId = (custodyResult.rows[0] as { id: string }).id;
    const signature = this.generateSignature(factId + action, userId);

    await this.db.query(
      `INSERT INTO cortex_audit_trail (
        chain_of_custody_id, action, performed_by, previous_value, new_value, reason, signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [custodyId, action, userId, previousValue, newValue, reason, signature]
    );
  }

  /**
   * Generate cryptographic signature
   */
  private generateSignature(content: string, user: string): string {
    return createHash('sha256')
      .update(content + user + Date.now().toString())
      .digest('hex');
  }

  private mapRowToRule(row: unknown): GoldenRule {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      entityId: r.entity_id as string | undefined,
      ruleType: r.rule_type as GoldenRuleType,
      condition: r.condition as string,
      override: r.override as string,
      reason: r.reason as string,
      priority: r.priority as number,
      isActive: r.is_active as boolean,
      verifiedBy: r.verified_by as string,
      verifiedAt: new Date(r.verified_at as string),
      signature: r.signature as string,
      expiresAt: r.expires_at ? new Date(r.expires_at as string) : undefined,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }

  private mapRowToCustody(row: unknown): ChainOfCustody {
    const r = row as Record<string, unknown>;
    return {
      factId: r.fact_id as string,
      tenantId: r.tenant_id as string,
      source: r.source as string,
      sourceType: r.source_type as ChainOfCustody['sourceType'],
      extractedAt: new Date(r.extracted_at as string),
      extractedBy: r.extracted_by as string | undefined,
      verifiedBy: r.verified_by as string | undefined,
      verifiedAt: r.verified_at ? new Date(r.verified_at as string) : undefined,
      signature: r.signature as string | undefined,
      supersedes: r.supersedes as string[] | undefined,
      metadata: (r.metadata as Record<string, unknown>) || {},
    };
  }

  private mapRowToAuditEntry(row: unknown): AuditTrailEntry {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      chainOfCustodyId: r.chain_of_custody_id as string,
      action: r.action as AuditTrailEntry['action'],
      performedBy: r.performed_by as string,
      performedAt: new Date(r.performed_at as string),
      previousValue: r.previous_value as string | undefined,
      newValue: r.new_value as string | undefined,
      reason: r.reason as string | undefined,
      signature: r.signature as string,
    };
  }
}
