import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { executeStatement } from '../db/client';

type StorageType = 's3' | 'database' | 'backup' | 'embeddings';
type StorageEventType = 'upload' | 'delete' | 'archive' | 'restore' | 'expire' | 'quota_warning' | 'quota_exceeded';

interface StorageUsage {
  storageType: StorageType;
  bytesUsed: number;
  bytesQuota: number | null;
  pricePerGbCents: number;
  includedGb: number;
  totalCostCents: number;
  isOverQuota: boolean;
}

export class StorageBillingService {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({});
  }

  async getStorageUsage(tenantId: string): Promise<StorageUsage[]> {
    const result = await executeStatement(
      `SELECT 
         su.storage_type,
         su.bytes_used,
         su.bytes_quota,
         sp.price_per_gb_cents,
         sp.included_gb,
         su.is_over_quota,
         CASE 
           WHEN su.bytes_used <= sp.included_gb * 1073741824 THEN 0
           ELSE CEIL((su.bytes_used - sp.included_gb * 1073741824) / 1073741824.0) * sp.price_per_gb_cents
         END as total_cost_cents
       FROM storage_usage su
       JOIN subscriptions s ON s.tenant_id = su.tenant_id AND s.status = 'active'
       JOIN storage_pricing sp ON sp.tier_id = s.tier_id AND sp.storage_type = su.storage_type
       WHERE su.tenant_id = $1 AND sp.is_active = TRUE AND su.period_end > NOW()`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        storageType: r.storage_type as StorageType,
        bytesUsed: parseInt(String(r.bytes_used), 10),
        bytesQuota: r.bytes_quota ? parseInt(String(r.bytes_quota), 10) : null,
        pricePerGbCents: parseInt(String(r.price_per_gb_cents), 10),
        includedGb: Number(r.included_gb),
        totalCostCents: parseInt(String(r.total_cost_cents), 10),
        isOverQuota: Boolean(r.is_over_quota),
      };
    });
  }

  async recordStorageEvent(
    tenantId: string,
    userId: string | null,
    eventType: StorageEventType,
    storageType: StorageType,
    bytesDelta: number,
    resourceId?: string,
    resourcePath?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO storage_events 
       (tenant_id, user_id, event_type, storage_type, bytes_delta, resource_id, resource_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: userId ? { stringValue: userId } : { isNull: true } },
        { name: 'eventType', value: { stringValue: eventType } },
        { name: 'storageType', value: { stringValue: storageType } },
        { name: 'bytesDelta', value: { longValue: bytesDelta } },
        { name: 'resourceId', value: resourceId ? { stringValue: resourceId } : { isNull: true } },
        { name: 'resourcePath', value: resourcePath ? { stringValue: resourcePath } : { isNull: true } },
      ]
    );

    await this.updateStorageUsage(tenantId, storageType, bytesDelta);
  }

  async calculateS3Usage(tenantId: string): Promise<number> {
    let totalBytes = 0;
    let continuationToken: string | undefined;

    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) return 0;

    do {
      const response = await this.s3.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `tenants/${tenantId}/`,
        ContinuationToken: continuationToken,
      }));

      if (response.Contents) {
        for (const object of response.Contents) {
          totalBytes += object.Size || 0;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return totalBytes;
  }

  async syncS3Usage(tenantId: string): Promise<void> {
    const bytesUsed = await this.calculateS3Usage(tenantId);
    
    await this.ensureStorageUsageRecord(tenantId, 's3');
    
    await executeStatement(
      `UPDATE storage_usage 
       SET bytes_used = $2, updated_at = NOW()
       WHERE tenant_id = $1 AND storage_type = 's3' AND period_end > NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'bytesUsed', value: { longValue: bytesUsed } },
      ]
    );

    await this.checkQuotaAlerts(tenantId, 's3');
  }

  async getStoragePricing(tierId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM storage_pricing WHERE tier_id = $1 AND is_active = true`,
      [{ name: 'tierId', value: { stringValue: tierId } }]
    );
    return result.rows;
  }

  async getStorageEvents(tenantId: string, limit: number = 50): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM storage_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT ${limit}`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return result.rows;
  }

  private async updateStorageUsage(tenantId: string, storageType: StorageType, bytesDelta: number): Promise<void> {
    await this.ensureStorageUsageRecord(tenantId, storageType);

    await executeStatement(
      `UPDATE storage_usage 
       SET bytes_used = GREATEST(0, bytes_used + $3), updated_at = NOW()
       WHERE tenant_id = $1 AND storage_type = $2 AND period_end > NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'storageType', value: { stringValue: storageType } },
        { name: 'bytesDelta', value: { longValue: bytesDelta } },
      ]
    );

    await this.checkQuotaAlerts(tenantId, storageType);
  }

  private async ensureStorageUsageRecord(tenantId: string, storageType: StorageType): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    await executeStatement(
      `INSERT INTO storage_usage (tenant_id, storage_type, period_start, period_end, price_per_gb_cents)
       SELECT $1, $2, $3, $4, COALESCE(
         (SELECT sp.price_per_gb_cents FROM storage_pricing sp 
          JOIN subscriptions s ON s.tier_id = sp.tier_id AND s.tenant_id = $1 AND s.status = 'active'
          WHERE sp.storage_type = $2 AND sp.is_active = TRUE LIMIT 1), 10)
       ON CONFLICT (tenant_id, storage_type, period_start) DO NOTHING`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'storageType', value: { stringValue: storageType } },
        { name: 'periodStart', value: { stringValue: periodStart.toISOString() } },
        { name: 'periodEnd', value: { stringValue: periodEnd.toISOString() } },
      ]
    );
  }

  private async checkQuotaAlerts(tenantId: string, storageType: StorageType): Promise<void> {
    const result = await executeStatement(
      `SELECT su.bytes_used, su.bytes_quota, su.quota_warning_sent, su.quota_exceeded_sent
       FROM storage_usage su
       WHERE su.tenant_id = $1 AND su.storage_type = $2 AND su.period_end > NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'storageType', value: { stringValue: storageType } },
      ]
    );

    if (result.rows.length === 0) return;

    const r = result.rows[0] as Record<string, unknown>;
    const bytesUsed = parseInt(String(r.bytes_used), 10);
    const bytesQuota = r.bytes_quota ? parseInt(String(r.bytes_quota), 10) : null;

    if (!bytesQuota) return;

    const usagePercent = bytesUsed / bytesQuota;

    if (usagePercent >= 1 && !r.quota_exceeded_sent) {
      await executeStatement(
        `UPDATE storage_usage SET is_over_quota = true, quota_exceeded_sent = true WHERE tenant_id = $1 AND storage_type = $2 AND period_end > NOW()`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'storageType', value: { stringValue: storageType } },
        ]
      );
      await this.recordStorageEvent(tenantId, null, 'quota_exceeded', storageType, 0);
    } else if (usagePercent >= 0.8 && !r.quota_warning_sent) {
      await executeStatement(
        `UPDATE storage_usage SET quota_warning_sent = true WHERE tenant_id = $1 AND storage_type = $2 AND period_end > NOW()`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'storageType', value: { stringValue: storageType } },
        ]
      );
      await this.recordStorageEvent(tenantId, null, 'quota_warning', storageType, 0);
    }
  }
}

export const storageBillingService = new StorageBillingService();
