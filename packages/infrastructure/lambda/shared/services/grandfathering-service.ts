import { executeStatement, toSqlParams } from '../db/client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

export type GrandfatherStatus = 'active' | 'opted_out' | 'migrated' | 'expired';
export type PlanChangeType = 'price_increase' | 'price_decrease' | 'feature_add' | 'feature_remove' | 'limit_increase' | 'limit_decrease' | 'credit_change' | 'terms_change';

export interface PlanVersion {
  id: string;
  tierId: string;
  versionNumber: number;
  displayName: string;
  description?: string;
  priceMonthly: number;
  priceAnnual: number;
  pricePerUser: boolean;
  includedCreditsPerUser: number;
  features: Record<string, unknown>;
  rateLimits: Record<string, unknown>;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  changeReason?: string;
  changedBy?: string;
  createdAt: Date;
}

export interface GrandfatheredSubscription {
  id: string;
  subscriptionId: string;
  planVersionId: string;
  lockedPriceMonthly: number;
  lockedPriceAnnual: number;
  lockedFeatures: Record<string, unknown>;
  lockedRateLimits: Record<string, unknown>;
  lockedCreditsPerUser: number;
  status: GrandfatherStatus;
  migrationOffered: boolean;
  migrationOfferDate?: Date;
  migrationIncentive?: Record<string, unknown>;
  migrationResponse?: string;
  migrationResponseDate?: Date;
  grandfatheredAt: Date;
  grandfatheredReason?: string;
}

export interface EffectivePlan {
  tierId: string;
  versionNumber: number;
  priceMonthly: number;
  priceAnnual: number;
  features: Record<string, unknown>;
  rateLimits: Record<string, unknown>;
  creditsPerUser: number;
  isGrandfathered: boolean;
}

export interface MigrationOffer {
  subscriptionId: string;
  currentPlanVersion: string;
  newPlanVersion: string;
  incentive: {
    creditBonus?: number;
    discountPercent?: number;
    freeMonths?: number;
    additionalFeatures?: string[];
  };
  expiresAt: Date;
}

export class GrandfatheringService {
  async createPlanVersion(
    tierId: string,
    version: Omit<PlanVersion, 'id' | 'tierId' | 'versionNumber' | 'createdAt'>
  ): Promise<string> {
    const versionResult = await executeStatement(
      `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version 
       FROM subscription_plan_versions WHERE tier_id = $1`,
      [{ name: 'tierId', value: { stringValue: tierId } }]
    );
    const nextVersion = Number((versionResult.rows[0] as Record<string, unknown>)?.next_version || 1);

    const result = await executeStatement(
      `INSERT INTO subscription_plan_versions (
         tier_id, version_number, display_name, description,
         price_monthly_cents, price_annual_cents, price_per_user,
         included_credits_per_user, features, rate_limits,
         effective_from, effective_until, change_reason, changed_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14)
       RETURNING id`,
      [
        { name: 'tierId', value: { stringValue: tierId } },
        { name: 'versionNumber', value: { longValue: nextVersion } },
        { name: 'displayName', value: { stringValue: version.displayName } },
        { name: 'description', value: version.description ? { stringValue: version.description } : { isNull: true } },
        { name: 'priceMonthly', value: { longValue: version.priceMonthly } },
        { name: 'priceAnnual', value: { longValue: version.priceAnnual } },
        { name: 'pricePerUser', value: { booleanValue: version.pricePerUser } },
        { name: 'creditsPerUser', value: { doubleValue: version.includedCreditsPerUser } },
        { name: 'features', value: { stringValue: JSON.stringify(version.features) } },
        { name: 'rateLimits', value: { stringValue: JSON.stringify(version.rateLimits) } },
        { name: 'effectiveFrom', value: { stringValue: version.effectiveFrom.toISOString() } },
        { name: 'effectiveUntil', value: version.effectiveUntil ? { stringValue: version.effectiveUntil.toISOString() } : { isNull: true } },
        { name: 'changeReason', value: version.changeReason ? { stringValue: version.changeReason } : { isNull: true } },
        { name: 'changedBy', value: version.changedBy ? { stringValue: version.changedBy } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getPlanVersions(tierId: string): Promise<PlanVersion[]> {
    const result = await executeStatement(
      `SELECT * FROM subscription_plan_versions 
       WHERE tier_id = $1 
       ORDER BY version_number DESC`,
      [{ name: 'tierId', value: { stringValue: tierId } }]
    );

    return result.rows as unknown as PlanVersion[];
  }

  async getCurrentPlanVersion(tierId: string): Promise<PlanVersion | null> {
    const result = await executeStatement(
      `SELECT * FROM subscription_plan_versions 
       WHERE tier_id = $1 
         AND effective_from <= NOW()
         AND (effective_until IS NULL OR effective_until > NOW())
       ORDER BY version_number DESC
       LIMIT 1`,
      [{ name: 'tierId', value: { stringValue: tierId } }]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as PlanVersion) : null;
  }

  async grandfatherSubscription(
    subscriptionId: string,
    planVersionId: string,
    reason?: string
  ): Promise<string> {
    const planVersion = await this.getPlanVersionById(planVersionId);
    if (!planVersion) throw new Error('Plan version not found');

    const result = await executeStatement(
      `INSERT INTO grandfathered_subscriptions (
         subscription_id, plan_version_id,
         locked_price_monthly_cents, locked_price_annual_cents,
         locked_features, locked_rate_limits, locked_credits_per_user,
         grandfathered_reason
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
       ON CONFLICT (subscription_id) DO UPDATE SET
         plan_version_id = EXCLUDED.plan_version_id,
         locked_price_monthly_cents = EXCLUDED.locked_price_monthly_cents,
         locked_price_annual_cents = EXCLUDED.locked_price_annual_cents,
         locked_features = EXCLUDED.locked_features,
         locked_rate_limits = EXCLUDED.locked_rate_limits,
         locked_credits_per_user = EXCLUDED.locked_credits_per_user,
         status = 'active',
         updated_at = NOW()
       RETURNING id`,
      [
        { name: 'subscriptionId', value: { stringValue: subscriptionId } },
        { name: 'planVersionId', value: { stringValue: planVersionId } },
        { name: 'priceMonthly', value: { longValue: planVersion.priceMonthly } },
        { name: 'priceAnnual', value: { longValue: planVersion.priceAnnual } },
        { name: 'features', value: { stringValue: JSON.stringify(planVersion.features) } },
        { name: 'rateLimits', value: { stringValue: JSON.stringify(planVersion.rateLimits) } },
        { name: 'creditsPerUser', value: { doubleValue: planVersion.includedCreditsPerUser } },
        { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getEffectivePlan(subscriptionId: string): Promise<EffectivePlan | null> {
    const result = await executeStatement(
      `SELECT * FROM get_effective_plan($1)`,
      [{ name: 'subscriptionId', value: { stringValue: subscriptionId } }]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      tierId: String(row.tier_id || ''),
      versionNumber: Number(row.version_number || 0),
      priceMonthly: Number(row.price_monthly_cents || 0),
      priceAnnual: Number(row.price_annual_cents || 0),
      features: (row.features as Record<string, unknown>) || {},
      rateLimits: (row.rate_limits as Record<string, unknown>) || {},
      creditsPerUser: Number(row.credits_per_user || 0),
      isGrandfathered: Boolean(row.is_grandfathered),
    };
  }

  async getGrandfatheredSubscription(subscriptionId: string): Promise<GrandfatheredSubscription | null> {
    const result = await executeStatement(
      `SELECT * FROM grandfathered_subscriptions WHERE subscription_id = $1 AND status = 'active'`,
      [{ name: 'subscriptionId', value: { stringValue: subscriptionId } }]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as GrandfatheredSubscription) : null;
  }

  async offerMigration(
    subscriptionId: string,
    incentive: MigrationOffer['incentive'],
    expiresInDays: number = 30
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await executeStatement(
      `UPDATE grandfathered_subscriptions 
       SET migration_offered = true,
           migration_offer_date = NOW(),
           migration_incentive = $2::jsonb,
           updated_at = NOW()
       WHERE subscription_id = $1`,
      [
        { name: 'subscriptionId', value: { stringValue: subscriptionId } },
        { name: 'incentive', value: { stringValue: JSON.stringify({ ...incentive, expiresAt }) } },
      ]
    );
  }

  async respondToMigration(
    subscriptionId: string,
    response: 'accept' | 'decline' | 'later'
  ): Promise<void> {
    await executeStatement(
      `UPDATE grandfathered_subscriptions 
       SET migration_response = $2,
           migration_response_date = NOW(),
           status = CASE WHEN $2 = 'accept' THEN 'migrated' ELSE status END,
           updated_at = NOW()
       WHERE subscription_id = $1`,
      [
        { name: 'subscriptionId', value: { stringValue: subscriptionId } },
        { name: 'response', value: { stringValue: response } },
      ]
    );
  }

  async logPlanChange(
    tierId: string,
    oldVersionId: string | null,
    newVersionId: string,
    changeType: PlanChangeType,
    changeSummary: string,
    changedBy: string,
    approvedBy?: string
  ): Promise<void> {
    const affectedResult = await executeStatement(
      `SELECT COUNT(*) as count FROM subscriptions WHERE tier_id = $1 AND status = 'active'`,
      [{ name: 'tierId', value: { stringValue: tierId } }]
    );
    const affectedSubscribers = Number((affectedResult.rows[0] as Record<string, unknown>)?.count || 0);

    const grandfatheredResult = await executeStatement(
      `SELECT COUNT(*) as count FROM grandfathered_subscriptions gs
       JOIN subscriptions s ON gs.subscription_id = s.id
       WHERE s.tier_id = $1 AND gs.status = 'active'`,
      [{ name: 'tierId', value: { stringValue: tierId } }]
    );
    const grandfatheredCount = Number((grandfatheredResult.rows[0] as Record<string, unknown>)?.count || 0);

    await executeStatement(
      `INSERT INTO plan_change_audit (
         tier_id, old_version_id, new_version_id, change_type,
         change_summary, affected_subscribers, grandfathered_count,
         changed_by, approved_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        { name: 'tierId', value: { stringValue: tierId } },
        { name: 'oldVersionId', value: oldVersionId ? { stringValue: oldVersionId } : { isNull: true } },
        { name: 'newVersionId', value: { stringValue: newVersionId } },
        { name: 'changeType', value: { stringValue: changeType } },
        { name: 'changeSummary', value: { stringValue: changeSummary } },
        { name: 'affectedSubscribers', value: { longValue: affectedSubscribers } },
        { name: 'grandfatheredCount', value: { longValue: grandfatheredCount } },
        { name: 'changedBy', value: { stringValue: changedBy } },
        { name: 'approvedBy', value: approvedBy ? { stringValue: approvedBy } : { isNull: true } },
      ]
    );
  }

  async getChangeAudit(tierId?: string, limit: number = 50): Promise<Array<Record<string, unknown>>> {
    let sql = `SELECT * FROM plan_change_audit`;
    const params: SqlParameter[] = [];

    if (tierId) {
      sql += ` WHERE tier_id = $1`;
      params.push({ name: 'tierId', value: { stringValue: tierId } });
    }

    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const result = await executeStatement(sql, params);
    return result.rows as Array<Record<string, unknown>>;
  }

  async bulkGrandfatherOnPriceIncrease(
    tierId: string,
    oldVersionId: string,
    reason: string
  ): Promise<number> {
    const result = await executeStatement(
      `INSERT INTO grandfathered_subscriptions (
         subscription_id, plan_version_id,
         locked_price_monthly_cents, locked_price_annual_cents,
         locked_features, locked_rate_limits, locked_credits_per_user,
         grandfathered_reason
       )
       SELECT 
         s.id, $2,
         pv.price_monthly_cents, pv.price_annual_cents,
         pv.features, pv.rate_limits, pv.included_credits_per_user,
         $3
       FROM subscriptions s
       JOIN subscription_plan_versions pv ON pv.id = $2
       WHERE s.tier_id = $1 AND s.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM grandfathered_subscriptions gs 
           WHERE gs.subscription_id = s.id AND gs.status = 'active'
         )
       RETURNING id`,
      [
        { name: 'tierId', value: { stringValue: tierId } },
        { name: 'versionId', value: { stringValue: oldVersionId } },
        { name: 'reason', value: { stringValue: reason } },
      ]
    );

    return result.rows.length;
  }

  async getGrandfatheringStats(): Promise<{
    totalGrandfathered: number;
    byTier: Record<string, number>;
    pendingMigrations: number;
    migratedThisMonth: number;
  }> {
    const totalResult = await executeStatement(
      `SELECT COUNT(*) as count FROM grandfathered_subscriptions WHERE status = 'active'`,
      []
    );

    const byTierResult = await executeStatement(
      `SELECT s.tier_id, COUNT(*) as count 
       FROM grandfathered_subscriptions gs
       JOIN subscriptions s ON gs.subscription_id = s.id
       WHERE gs.status = 'active'
       GROUP BY s.tier_id`,
      []
    );

    const pendingResult = await executeStatement(
      `SELECT COUNT(*) as count FROM grandfathered_subscriptions 
       WHERE status = 'active' AND migration_offered = true AND migration_response IS NULL`,
      []
    );

    const migratedResult = await executeStatement(
      `SELECT COUNT(*) as count FROM grandfathered_subscriptions 
       WHERE status = 'migrated' AND migration_response_date >= NOW() - INTERVAL '30 days'`,
      []
    );

    const byTier: Record<string, number> = {};
    for (const row of byTierResult.rows as Array<{ tier_id: string; count: number }>) {
      byTier[row.tier_id] = Number(row.count);
    }

    return {
      totalGrandfathered: Number((totalResult.rows[0] as Record<string, unknown>)?.count || 0),
      byTier,
      pendingMigrations: Number((pendingResult.rows[0] as Record<string, unknown>)?.count || 0),
      migratedThisMonth: Number((migratedResult.rows[0] as Record<string, unknown>)?.count || 0),
    };
  }

  private async getPlanVersionById(versionId: string): Promise<PlanVersion | null> {
    const result = await executeStatement(
      `SELECT * FROM subscription_plan_versions WHERE id = $1`,
      [{ name: 'versionId', value: { stringValue: versionId } }]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as PlanVersion) : null;
  }
}

export const grandfatheringService = new GrandfatheringService();
