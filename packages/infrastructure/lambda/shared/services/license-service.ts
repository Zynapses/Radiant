import { executeStatement, toSqlParams } from '../db/client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

export type LicenseType = 'proprietary' | 'open-source' | 'commercial' | 'research-only' | 'custom';
export type ComplianceStatus = 'compliant' | 'review-needed' | 'non-compliant' | 'expired' | 'pending';

export interface ModelLicense {
  id: string;
  modelId: string;
  licenseName: string;
  licenseType: LicenseType;
  licenseUrl?: string;
  commercialUseAllowed: boolean;
  modificationAllowed: boolean;
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  restrictedUseCases: string[];
  expiresAt?: Date;
  complianceStatus: ComplianceStatus;
  complianceNotes?: string;
  lastReviewedAt?: Date;
  lastReviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LicenseAuditLog {
  id: string;
  modelId: string;
  action: string;
  previousStatus?: ComplianceStatus;
  newStatus: ComplianceStatus;
  changedBy: string;
  reason?: string;
  createdAt: Date;
}

export interface LicenseSummary {
  totalModels: number;
  commercialOk: number;
  reviewNeeded: number;
  nonCompliant: number;
  expiringIn30Days: number;
  expiredCount: number;
}

export class LicenseService {
  async getModelLicense(modelId: string): Promise<ModelLicense | null> {
    const result = await executeStatement(
      `SELECT * FROM model_licenses WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as ModelLicense) : null;
  }

  async getAllLicenses(tenantId: string): Promise<ModelLicense[]> {
    const result = await executeStatement(
      `SELECT ml.*, m.display_name as model_name, m.provider
       FROM model_licenses ml
       JOIN models m ON ml.model_id = m.model_id
       ORDER BY ml.compliance_status, ml.expires_at ASC NULLS LAST`,
      []
    );

    return result.rows as unknown as ModelLicense[];
  }

  async getLicensesByStatus(status: ComplianceStatus): Promise<ModelLicense[]> {
    const result = await executeStatement(
      `SELECT ml.*, m.display_name as model_name, m.provider
       FROM model_licenses ml
       JOIN models m ON ml.model_id = m.model_id
       WHERE ml.compliance_status = $1
       ORDER BY ml.expires_at ASC NULLS LAST`,
      [{ name: 'status', value: { stringValue: status } }]
    );

    return result.rows as unknown as ModelLicense[];
  }

  async createLicense(license: Omit<ModelLicense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO model_licenses (
         model_id, license_name, license_type, license_url,
         commercial_use_allowed, modification_allowed, redistribution_allowed,
         attribution_required, restricted_use_cases, expires_at,
         compliance_status, compliance_notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
       RETURNING id`,
      [
        { name: 'modelId', value: { stringValue: license.modelId } },
        { name: 'licenseName', value: { stringValue: license.licenseName } },
        { name: 'licenseType', value: { stringValue: license.licenseType } },
        { name: 'licenseUrl', value: license.licenseUrl ? { stringValue: license.licenseUrl } : { isNull: true } },
        { name: 'commercialUse', value: { booleanValue: license.commercialUseAllowed } },
        { name: 'modification', value: { booleanValue: license.modificationAllowed } },
        { name: 'redistribution', value: { booleanValue: license.redistributionAllowed } },
        { name: 'attribution', value: { booleanValue: license.attributionRequired } },
        { name: 'restrictedUseCases', value: { stringValue: JSON.stringify(license.restrictedUseCases || []) } },
        { name: 'expiresAt', value: license.expiresAt ? { stringValue: license.expiresAt.toISOString() } : { isNull: true } },
        { name: 'complianceStatus', value: { stringValue: license.complianceStatus } },
        { name: 'complianceNotes', value: license.complianceNotes ? { stringValue: license.complianceNotes } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async updateLicense(
    modelId: string,
    updates: Partial<ModelLicense>,
    updatedBy: string
  ): Promise<void> {
    const existing = await this.getModelLicense(modelId);
    if (!existing) throw new Error('License not found');

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: SqlParameter[] = [
      { name: 'modelId', value: { stringValue: modelId } },
    ];
    let paramIndex = 2;

    if (updates.licenseName !== undefined) {
      setClauses.push(`license_name = $${paramIndex++}`);
      params.push({ name: 'licenseName', value: { stringValue: updates.licenseName } });
    }
    if (updates.licenseType !== undefined) {
      setClauses.push(`license_type = $${paramIndex++}`);
      params.push({ name: 'licenseType', value: { stringValue: updates.licenseType } });
    }
    if (updates.commercialUseAllowed !== undefined) {
      setClauses.push(`commercial_use_allowed = $${paramIndex++}`);
      params.push({ name: 'commercialUse', value: { booleanValue: updates.commercialUseAllowed } });
    }
    if (updates.complianceStatus !== undefined) {
      setClauses.push(`compliance_status = $${paramIndex++}`);
      params.push({ name: 'complianceStatus', value: { stringValue: updates.complianceStatus } });

      await this.logAuditEntry(modelId, 'status_change', existing.complianceStatus, updates.complianceStatus, updatedBy);
    }
    if (updates.complianceNotes !== undefined) {
      setClauses.push(`compliance_notes = $${paramIndex++}`);
      params.push({ name: 'complianceNotes', value: { stringValue: updates.complianceNotes } });
    }
    if (updates.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      params.push({ name: 'expiresAt', value: { stringValue: updates.expiresAt.toISOString() } });
    }

    await executeStatement(
      `UPDATE model_licenses SET ${setClauses.join(', ')} WHERE model_id = $1`,
      params
    );
  }

  async markAsReviewed(modelId: string, reviewedBy: string, notes?: string): Promise<void> {
    await executeStatement(
      `UPDATE model_licenses 
       SET last_reviewed_at = NOW(), last_reviewed_by = $2, compliance_notes = COALESCE($3, compliance_notes), updated_at = NOW()
       WHERE model_id = $1`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'reviewedBy', value: { stringValue: reviewedBy } },
        { name: 'notes', value: notes ? { stringValue: notes } : { isNull: true } },
      ]
    );

    await this.logAuditEntry(modelId, 'review', undefined, 'compliant', reviewedBy, notes);
  }

  async getLicenseSummary(): Promise<LicenseSummary> {
    const result = await executeStatement(
      `SELECT 
         COUNT(*) as total_models,
         COUNT(*) FILTER (WHERE commercial_use_allowed = true AND compliance_status = 'compliant') as commercial_ok,
         COUNT(*) FILTER (WHERE compliance_status = 'review-needed') as review_needed,
         COUNT(*) FILTER (WHERE compliance_status = 'non-compliant') as non_compliant,
         COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= NOW() + INTERVAL '30 days' AND expires_at > NOW()) as expiring_in_30_days,
         COUNT(*) FILTER (WHERE compliance_status = 'expired' OR (expires_at IS NOT NULL AND expires_at <= NOW())) as expired_count
       FROM model_licenses`,
      []
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      totalModels: Number(row.total_models || 0),
      commercialOk: Number(row.commercial_ok || 0),
      reviewNeeded: Number(row.review_needed || 0),
      nonCompliant: Number(row.non_compliant || 0),
      expiringIn30Days: Number(row.expiring_in_30_days || 0),
      expiredCount: Number(row.expired_count || 0),
    };
  }

  async getExpiringLicenses(daysAhead: number = 30): Promise<ModelLicense[]> {
    const result = await executeStatement(
      `SELECT ml.*, m.display_name as model_name, m.provider
       FROM model_licenses ml
       JOIN models m ON ml.model_id = m.model_id
       WHERE ml.expires_at IS NOT NULL 
         AND ml.expires_at > NOW()
         AND ml.expires_at <= NOW() + ($1 || ' days')::INTERVAL
       ORDER BY ml.expires_at ASC`,
      [{ name: 'days', value: { longValue: daysAhead } }]
    );

    return result.rows as unknown as ModelLicense[];
  }

  async checkExpiredLicenses(): Promise<number> {
    const result = await executeStatement(
      `UPDATE model_licenses 
       SET compliance_status = 'expired', updated_at = NOW()
       WHERE expires_at IS NOT NULL AND expires_at <= NOW() AND compliance_status != 'expired'
       RETURNING model_id`,
      []
    );

    return result.rows.length;
  }

  async getAuditLog(modelId?: string, limit: number = 50): Promise<LicenseAuditLog[]> {
    let sql = `SELECT * FROM license_audit_log`;
    const params: SqlParameter[] = [];

    if (modelId) {
      sql += ` WHERE model_id = $1`;
      params.push({ name: 'modelId', value: { stringValue: modelId } });
    }

    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const result = await executeStatement(sql, params);
    return result.rows as unknown as LicenseAuditLog[];
  }

  async validateCommercialUse(modelId: string): Promise<{ allowed: boolean; reason?: string }> {
    const license = await this.getModelLicense(modelId);

    if (!license) {
      return { allowed: false, reason: 'No license information found for this model' };
    }

    if (license.complianceStatus === 'expired') {
      return { allowed: false, reason: 'License has expired' };
    }

    if (license.complianceStatus === 'non-compliant') {
      return { allowed: false, reason: 'Model is marked as non-compliant' };
    }

    if (!license.commercialUseAllowed) {
      return { allowed: false, reason: 'Commercial use is not allowed under this license' };
    }

    if (license.expiresAt && new Date(license.expiresAt) <= new Date()) {
      return { allowed: false, reason: 'License has expired' };
    }

    return { allowed: true };
  }

  async bulkUpdateStatus(
    modelIds: string[],
    newStatus: ComplianceStatus,
    updatedBy: string,
    reason?: string
  ): Promise<number> {
    let updatedCount = 0;

    for (const modelId of modelIds) {
      const existing = await this.getModelLicense(modelId);
      if (existing && existing.complianceStatus !== newStatus) {
        await executeStatement(
          `UPDATE model_licenses SET compliance_status = $2, updated_at = NOW() WHERE model_id = $1`,
          [
            { name: 'modelId', value: { stringValue: modelId } },
            { name: 'status', value: { stringValue: newStatus } },
          ]
        );

        await this.logAuditEntry(modelId, 'bulk_status_change', existing.complianceStatus, newStatus, updatedBy, reason);
        updatedCount++;
      }
    }

    return updatedCount;
  }

  private async logAuditEntry(
    modelId: string,
    action: string,
    previousStatus: ComplianceStatus | undefined,
    newStatus: ComplianceStatus,
    changedBy: string,
    reason?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO license_audit_log (model_id, action, previous_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'action', value: { stringValue: action } },
        { name: 'previousStatus', value: previousStatus ? { stringValue: previousStatus } : { isNull: true } },
        { name: 'newStatus', value: { stringValue: newStatus } },
        { name: 'changedBy', value: { stringValue: changedBy } },
        { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
      ]
    );
  }
}

export const licenseService = new LicenseService();
