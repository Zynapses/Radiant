/**
 * RADIANT Safety Matrix Service
 * Entity-Action Contraindication Grid Management
 */

import { executeStatement, stringParam, doubleParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'safety/matrix',
  category: 'infrastructure',
  sourceType: 'application',
});
import type {
  SafetyEntity,
  SafetyAction,
  Contraindication,
  ContraindicationSeverity,
  EntityCategory,
  ActionCategory,
  SafetyMatrixGrid,
  SafetyMatrixRow,
  SafetyMatrixCell,
  SafetyMatrixDashboard,
  ContraindicationCheckRequest,
  ContraindicationCheckResult,
  ListEntitiesRequest,
  ListEntitiesResponse,
  CreateEntityRequest,
  CreateActionRequest,
  CreateContraindicationRequest,
  UpdateContraindicationRequest,
  ReviewContraindicationRequest,
  GetMatrixGridRequest,
} from '@radiant/shared';

// =============================================================================
// Safety Matrix Service
// =============================================================================

class SafetyMatrixService {
  // ===========================================================================
  // Dashboard
  // ===========================================================================

  async getDashboard(tenantId: string): Promise<SafetyMatrixDashboard> {
    try {
      const [
        entityCount,
        actionCount,
        contraindicationCount,
        pendingCount,
        byDomain,
        bySeverity,
        recentContraindications,
        pendingReviewItems,
        topEntities,
      ] = await Promise.all([
        this.countEntities(tenantId),
        this.countActions(tenantId),
        this.countContraindications(tenantId),
        this.countContraindications(tenantId, 'pending_review'),
        this.getContraindicationsByDomain(tenantId),
        this.getContraindicationsBySeverity(tenantId),
        this.getRecentContraindications(tenantId, 10),
        this.getPendingReviewItems(tenantId, 10),
        this.getTopEntities(tenantId, 10),
      ]);

      return {
        summary: {
          totalEntities: entityCount,
          totalActions: actionCount,
          totalContraindications: contraindicationCount,
          pendingReview: pendingCount,
          byDomain,
          bySeverity,
        },
        recentContraindications,
        pendingReviewItems,
        topEntities,
      };
    } catch (error) {
      logger.error('Failed to get safety matrix dashboard', { error, tenantId });
      throw error;
    }
  }

  // ===========================================================================
  // Entities
  // ===========================================================================

  async listEntities(request: ListEntitiesRequest): Promise<ListEntitiesResponse> {
    try {
      let query = `
        SELECT * FROM safety_entities 
        WHERE tenant_id = :tenant_id AND domain_id = :domain_id
      `;
      const params = [
        stringParam('tenant_id', request.tenantId),
        stringParam('domain_id', request.domainId),
      ];

      if (request.category) {
        query += ` AND category = :category`;
        params.push(stringParam('category', request.category));
      }

      if (request.search) {
        query += ` AND (name ILIKE :search OR description ILIKE :search)`;
        params.push(stringParam('search', `%${request.search}%`));
      }

      query += ` ORDER BY name LIMIT ${request.limit || 100} OFFSET ${request.offset || 0}`;

      const result = await executeStatement(query, params);
      const entities = (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToEntity(row));

      return { entities, total: entities.length };
    } catch (error) {
      logger.error('Failed to list entities', { error });
      throw error;
    }
  }

  async getEntity(tenantId: string, entityId: string): Promise<SafetyEntity | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM safety_entities WHERE tenant_id = :tenant_id AND id = :id`,
        [stringParam('tenant_id', tenantId), stringParam('id', entityId)]
      );
      if (!result.rows?.length) return null;
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get entity', { error });
      return null;
    }
  }

  async createEntity(tenantId: string, userId: string, request: CreateEntityRequest): Promise<SafetyEntity> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeStatement(
      `INSERT INTO safety_entities (
        id, tenant_id, domain_id, name, description, category, subcategory,
        external_ids, tags, risk_level, contraindication_count,
        created_at, updated_at, created_by, verified
      ) VALUES (
        :id, :tenant_id, :domain_id, :name, :description, :category, :subcategory,
        :external_ids, :tags, :risk_level, 0,
        :created_at, :updated_at, :created_by, false
      )`,
      [
        stringParam('id', id),
        stringParam('tenant_id', tenantId),
        stringParam('domain_id', request.domainId),
        stringParam('name', request.name),
        stringParam('description', request.description || ''),
        stringParam('category', request.category),
        stringParam('subcategory', request.subcategory || ''),
        stringParam('external_ids', JSON.stringify(request.externalIds || {})),
        stringParam('tags', JSON.stringify(request.tags || [])),
        stringParam('risk_level', request.riskLevel || 'medium'),
        stringParam('created_at', now),
        stringParam('updated_at', now),
        stringParam('created_by', userId),
      ]
    );

    logger.info('Entity created', { id, tenantId, name: request.name });
    return (await this.getEntity(tenantId, id))!;
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  async listActions(tenantId: string, domainId: string): Promise<SafetyAction[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM safety_actions 
         WHERE tenant_id = :tenant_id AND domain_id = :domain_id
         ORDER BY name`,
        [stringParam('tenant_id', tenantId), stringParam('domain_id', domainId)]
      );
      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToAction(row));
    } catch (error) {
      logger.error('Failed to list actions', { error });
      return [];
    }
  }

  async createAction(tenantId: string, userId: string, request: CreateActionRequest): Promise<SafetyAction> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeStatement(
      `INSERT INTO safety_actions (
        id, tenant_id, domain_id, name, description, category,
        verb_present, verb_past, verb_gerund, tags, requires_confirmation,
        contraindication_count, created_at, updated_at, created_by
      ) VALUES (
        :id, :tenant_id, :domain_id, :name, :description, :category,
        :verb_present, :verb_past, :verb_gerund, :tags, :requires_confirmation,
        0, :created_at, :updated_at, :created_by
      )`,
      [
        stringParam('id', id),
        stringParam('tenant_id', tenantId),
        stringParam('domain_id', request.domainId),
        stringParam('name', request.name),
        stringParam('description', request.description || ''),
        stringParam('category', request.category),
        stringParam('verb_present', request.verbPresent),
        stringParam('verb_past', request.verbPast),
        stringParam('verb_gerund', request.verbGerund),
        stringParam('tags', JSON.stringify(request.tags || [])),
        boolParam('requires_confirmation', request.requiresConfirmation || false),
        stringParam('created_at', now),
        stringParam('updated_at', now),
        stringParam('created_by', userId),
      ]
    );

    logger.info('Action created', { id, tenantId, name: request.name });
    const result = await executeStatement(
      `SELECT * FROM safety_actions WHERE id = :id`,
      [stringParam('id', id)]
    );
    return this.mapRowToAction(result.rows![0]);
  }

  // ===========================================================================
  // Contraindications
  // ===========================================================================

  async listContraindications(
    tenantId: string,
    domainId: string,
    options: { entityId?: string; actionId?: string; status?: string; limit?: number } = {}
  ): Promise<Contraindication[]> {
    try {
      let query = `
        SELECT c.*, e.name as entity_name, a.name as action_name, e2.name as second_entity_name
        FROM contraindications c
        LEFT JOIN safety_entities e ON c.entity_id = e.id
        LEFT JOIN safety_actions a ON c.action_id = a.id
        LEFT JOIN safety_entities e2 ON c.second_entity_id = e2.id
        WHERE c.tenant_id = :tenant_id AND c.domain_id = :domain_id
      `;
      const params = [
        stringParam('tenant_id', tenantId),
        stringParam('domain_id', domainId),
      ];

      if (options.entityId) {
        query += ` AND c.entity_id = :entity_id`;
        params.push(stringParam('entity_id', options.entityId));
      }

      if (options.actionId) {
        query += ` AND c.action_id = :action_id`;
        params.push(stringParam('action_id', options.actionId));
      }

      if (options.status) {
        query += ` AND c.status = :status`;
        params.push(stringParam('status', options.status));
      }

      query += ` ORDER BY c.created_at DESC LIMIT ${options.limit || 100}`;

      const result = await executeStatement(query, params);
      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToContraindication(row));
    } catch (error) {
      logger.error('Failed to list contraindications', { error });
      return [];
    }
  }

  async createContraindication(
    tenantId: string,
    userId: string,
    request: CreateContraindicationRequest
  ): Promise<Contraindication> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeStatement(
      `INSERT INTO contraindications (
        id, tenant_id, domain_id, entity_id, action_id, second_entity_id,
        severity, reason, clinical_evidence, regulatory_reference,
        conditions, exceptions, alternatives,
        allow_override, override_requires, status,
        created_at, updated_at, created_by
      ) VALUES (
        :id, :tenant_id, :domain_id, :entity_id, :action_id, :second_entity_id,
        :severity, :reason, :clinical_evidence, :regulatory_reference,
        :conditions, :exceptions, :alternatives,
        :allow_override, :override_requires, 'active',
        :created_at, :updated_at, :created_by
      )`,
      [
        stringParam('id', id),
        stringParam('tenant_id', tenantId),
        stringParam('domain_id', request.domainId),
        stringParam('entity_id', request.entityId),
        stringParam('action_id', request.actionId),
        stringParam('second_entity_id', request.secondEntityId || ''),
        stringParam('severity', request.severity),
        stringParam('reason', request.reason),
        stringParam('clinical_evidence', request.clinicalEvidence || ''),
        stringParam('regulatory_reference', request.regulatoryReference || ''),
        stringParam('conditions', JSON.stringify(request.conditions || [])),
        stringParam('exceptions', JSON.stringify(request.exceptions || [])),
        stringParam('alternatives', JSON.stringify(request.alternatives || [])),
        boolParam('allow_override', request.allowOverride ?? false),
        stringParam('override_requires', request.overrideRequires || 'none'),
        stringParam('created_at', now),
        stringParam('updated_at', now),
        stringParam('created_by', userId),
      ]
    );

    // Update contraindication counts
    await this.updateContraindicationCounts(tenantId, request.entityId, request.actionId);

    logger.info('Contraindication created', { id, tenantId, severity: request.severity });

    const contraindications = await this.listContraindications(tenantId, request.domainId, { limit: 1 });
    return contraindications[0];
  }

  async updateContraindication(
    tenantId: string,
    contraindicationId: string,
    request: UpdateContraindicationRequest
  ): Promise<Contraindication> {
    const updates: string[] = [];
    const params = [stringParam('id', contraindicationId), stringParam('tenant_id', tenantId)];

    if (request.severity !== undefined) {
      updates.push('severity = :severity');
      params.push(stringParam('severity', request.severity));
    }

    if (request.reason !== undefined) {
      updates.push('reason = :reason');
      params.push(stringParam('reason', request.reason));
    }

    if (request.status !== undefined) {
      updates.push('status = :status');
      params.push(stringParam('status', request.status));
    }

    updates.push('updated_at = NOW()');

    await executeStatement(
      `UPDATE contraindications SET ${updates.join(', ')} 
       WHERE id = :id AND tenant_id = :tenant_id`,
      params
    );

    const contraindications = await this.listContraindications(tenantId, '', { limit: 1 });
    return contraindications[0];
  }

  async reviewContraindication(
    tenantId: string,
    contraindicationId: string,
    userId: string,
    request: ReviewContraindicationRequest
  ): Promise<void> {
    await executeStatement(
      `UPDATE contraindications 
       SET status = :status, reviewed_at = NOW(), reviewed_by = :user, review_notes = :notes
       WHERE id = :id AND tenant_id = :tenant_id`,
      [
        stringParam('id', contraindicationId),
        stringParam('tenant_id', tenantId),
        stringParam('status', request.approved ? 'active' : 'rejected'),
        stringParam('user', userId),
        stringParam('notes', request.notes || ''),
      ]
    );

    logger.info('Contraindication reviewed', { contraindicationId, approved: request.approved });
  }

  // ===========================================================================
  // Contraindication Checking
  // ===========================================================================

  async checkContraindication(request: ContraindicationCheckRequest): Promise<ContraindicationCheckResult> {
    try {
      const contraindications = await this.listContraindications(
        request.tenantId,
        request.domainId,
        {
          entityId: request.entityId,
          actionId: request.actionId,
          status: 'active',
        }
      );

      if (contraindications.length === 0) {
        return {
          hasContraindication: false,
          contraindications: [],
          severity: null,
          canOverride: true,
        };
      }

      // Find the most severe contraindication
      const severityOrder: ContraindicationSeverity[] = ['absolute', 'relative', 'caution', 'monitor'];
      const sorted = contraindications.sort(
        (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
      );

      const mostSevere = sorted[0];
      const alternatives = request.includeAlternatives
        ? mostSevere.alternatives?.map(alt => ({
            type: 'entity' as const,
            id: alt,
            name: alt,
            reason: 'Suggested alternative',
          }))
        : undefined;

      return {
        hasContraindication: true,
        contraindications,
        severity: mostSevere.severity,
        message: this.formatContraindicationMessage(mostSevere),
        alternatives,
        canOverride: mostSevere.allowOverride,
        overrideRequirements: mostSevere.overrideRequires,
      };
    } catch (error) {
      logger.error('Failed to check contraindication', { error, request });
      return {
        hasContraindication: false,
        contraindications: [],
        severity: null,
        canOverride: true,
      };
    }
  }

  // ===========================================================================
  // Matrix Grid
  // ===========================================================================

  async getMatrixGrid(request: GetMatrixGridRequest): Promise<SafetyMatrixGrid> {
    try {
      const [entities, actions, contraindications] = await Promise.all([
        this.listEntities({
          tenantId: request.tenantId,
          domainId: request.domainId,
          category: request.entityCategory,
          limit: request.entityLimit || 50,
        }),
        this.listActions(request.tenantId, request.domainId),
        this.listContraindications(request.tenantId, request.domainId),
      ]);

      // Build contraindication lookup
      const contraindicationMap = new Map<string, Contraindication>();
      for (const c of contraindications) {
        const key = `${c.entityId}:${c.actionId}`;
        contraindicationMap.set(key, c);
      }

      // Build grid rows
      const rows: SafetyMatrixRow[] = entities.entities.map(entity => {
        const cells: SafetyMatrixCell[] = actions.map(action => {
          const key = `${entity.id}:${action.id}`;
          const contraindication = contraindicationMap.get(key);
          return {
            entityId: entity.id,
            actionId: action.id,
            contraindication,
            severity: contraindication?.severity,
            hasContraindication: !!contraindication,
          };
        });
        return { entity, cells };
      });

      return {
        domainId: request.domainId,
        domainName: request.domainId,
        entities: entities.entities,
        actions,
        rows,
        totalContraindications: contraindications.length,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get matrix grid', { error });
      throw error;
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private formatContraindicationMessage(c: Contraindication): string {
    const severityText = {
      absolute: 'CONTRAINDICATED',
      relative: 'USUALLY AVOID',
      caution: 'USE WITH CAUTION',
      monitor: 'MONITOR CLOSELY',
    };
    return `${severityText[c.severity]}: ${c.reason}`;
  }

  private async updateContraindicationCounts(tenantId: string, entityId: string, actionId: string): Promise<void> {
    await executeStatement(
      `UPDATE safety_entities 
       SET contraindication_count = (
         SELECT COUNT(*) FROM contraindications WHERE entity_id = :entity_id AND status = 'active'
       )
       WHERE id = :entity_id`,
      [stringParam('entity_id', entityId)]
    );

    await executeStatement(
      `UPDATE safety_actions 
       SET contraindication_count = (
         SELECT COUNT(*) FROM contraindications WHERE action_id = :action_id AND status = 'active'
       )
       WHERE id = :action_id`,
      [stringParam('action_id', actionId)]
    );
  }

  private async countEntities(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM safety_entities WHERE tenant_id = :tenant_id`,
      [stringParam('tenant_id', tenantId)]
    );
    return Number(result.rows?.[0]?.count) || 0;
  }

  private async countActions(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM safety_actions WHERE tenant_id = :tenant_id`,
      [stringParam('tenant_id', tenantId)]
    );
    return Number(result.rows?.[0]?.count) || 0;
  }

  private async countContraindications(tenantId: string, status?: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM contraindications 
       WHERE tenant_id = :tenant_id ${status ? 'AND status = :status' : ''}`,
      [stringParam('tenant_id', tenantId), ...(status ? [stringParam('status', status)] : [])]
    );
    return Number(result.rows?.[0]?.count) || 0;
  }

  private async getContraindicationsByDomain(tenantId: string): Promise<Array<{ domainId: string; domainName: string; entityCount: number; actionCount: number; contraindicationCount: number }>> {
    const result = await executeStatement(
      `SELECT domain_id, COUNT(*) as count 
       FROM contraindications WHERE tenant_id = :tenant_id 
       GROUP BY domain_id`,
      [stringParam('tenant_id', tenantId)]
    );
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      domainId: String(row.domain_id),
      domainName: String(row.domain_id),
      entityCount: 0,
      actionCount: 0,
      contraindicationCount: Number(row.count) || 0,
    }));
  }

  private async getContraindicationsBySeverity(tenantId: string): Promise<Record<ContraindicationSeverity, number>> {
    const result = await executeStatement(
      `SELECT severity, COUNT(*) as count 
       FROM contraindications WHERE tenant_id = :tenant_id AND status = 'active'
       GROUP BY severity`,
      [stringParam('tenant_id', tenantId)]
    );
    const bySeverity: Record<ContraindicationSeverity, number> = {
      absolute: 0,
      relative: 0,
      caution: 0,
      monitor: 0,
    };
    for (const row of result.rows || []) {
      const severity = row.severity as ContraindicationSeverity;
      bySeverity[severity] = Number(row.count) || 0;
    }
    return bySeverity;
  }

  private async getRecentContraindications(tenantId: string, limit: number): Promise<Contraindication[]> {
    return this.listContraindications(tenantId, '', { limit });
  }

  private async getPendingReviewItems(tenantId: string, limit: number): Promise<Contraindication[]> {
    return this.listContraindications(tenantId, '', { status: 'pending_review', limit });
  }

  private async getTopEntities(tenantId: string, limit: number): Promise<Array<{ entity: SafetyEntity; contraindicationCount: number }>> {
    const result = await executeStatement(
      `SELECT * FROM safety_entities 
       WHERE tenant_id = :tenant_id 
       ORDER BY contraindication_count DESC LIMIT ${limit}`,
      [stringParam('tenant_id', tenantId)]
    );
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      entity: this.mapRowToEntity(row),
      contraindicationCount: Number(row.contraindication_count) || 0,
    }));
  }

  // Mapping functions
  private mapRowToEntity(row: Record<string, unknown>): SafetyEntity {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      domainId: String(row.domain_id || ''),
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      category: (row.category as EntityCategory) || 'custom',
      subcategory: row.subcategory ? String(row.subcategory) : undefined,
      externalIds: row.external_ids ? JSON.parse(String(row.external_ids)) : undefined,
      tags: row.tags ? JSON.parse(String(row.tags)) : [],
      riskLevel: (row.risk_level as SafetyEntity['riskLevel']) || 'medium',
      contraindicationCount: Number(row.contraindication_count) || 0,
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
      createdBy: String(row.created_by || ''),
      verified: Boolean(row.verified),
      verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
      verifiedBy: row.verified_by ? String(row.verified_by) : undefined,
    };
  }

  private mapRowToAction(row: Record<string, unknown>): SafetyAction {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      domainId: String(row.domain_id || ''),
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      category: (row.category as ActionCategory) || 'custom',
      verbPresent: String(row.verb_present || ''),
      verbPast: String(row.verb_past || ''),
      verbGerund: String(row.verb_gerund || ''),
      tags: row.tags ? JSON.parse(String(row.tags)) : [],
      requiresConfirmation: Boolean(row.requires_confirmation),
      contraindicationCount: Number(row.contraindication_count) || 0,
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
      createdBy: String(row.created_by || ''),
    };
  }

  private mapRowToContraindication(row: Record<string, unknown>): Contraindication {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      domainId: String(row.domain_id || ''),
      entityId: String(row.entity_id || ''),
      actionId: String(row.action_id || ''),
      secondEntityId: row.second_entity_id ? String(row.second_entity_id) : undefined,
      severity: (row.severity as ContraindicationSeverity) || 'caution',
      reason: String(row.reason || ''),
      clinicalEvidence: row.clinical_evidence ? String(row.clinical_evidence) : undefined,
      regulatoryReference: row.regulatory_reference ? String(row.regulatory_reference) : undefined,
      conditions: row.conditions ? JSON.parse(String(row.conditions)) : undefined,
      exceptions: row.exceptions ? JSON.parse(String(row.exceptions)) : undefined,
      alternatives: row.alternatives ? JSON.parse(String(row.alternatives)) : undefined,
      allowOverride: Boolean(row.allow_override),
      overrideRequires: row.override_requires as Contraindication['overrideRequires'],
      mlConfidence: row.ml_confidence ? Number(row.ml_confidence) : undefined,
      mlModelVersion: row.ml_model_version ? String(row.ml_model_version) : undefined,
      status: (row.status as Contraindication['status']) || 'active',
      effectiveDate: row.effective_date ? String(row.effective_date) : undefined,
      expirationDate: row.expiration_date ? String(row.expiration_date) : undefined,
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
      createdBy: String(row.created_by || ''),
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
      reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
      reviewNotes: row.review_notes ? String(row.review_notes) : undefined,
      entityName: row.entity_name ? String(row.entity_name) : undefined,
      actionName: row.action_name ? String(row.action_name) : undefined,
      secondEntityName: row.second_entity_name ? String(row.second_entity_name) : undefined,
    };
  }
}

export const safetyMatrixService = new SafetyMatrixService();
