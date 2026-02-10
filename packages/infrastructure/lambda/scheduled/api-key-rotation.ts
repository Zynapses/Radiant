/**
 * API Key Auto-Rotation Lambda
 *
 * Runs daily to handle tenant API key expiry and rotation:
 * - Keys expiring within GRACE_PERIOD_DAYS: auto-generate replacement, notify tenant
 * - Expired keys: mark inactive, notify tenant
 * - Tracks rotation lineage via replaced_by_key_id
 *
 * @version 1.0.0
 * @since RADIANT v4.18.0
 */

import { randomBytes, createHash } from 'crypto';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { getDbPool } from '../shared/db/centralized-pool';

const sns = new SNSClient({});
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || '';
const GRACE_PERIOD_DAYS = parseInt(process.env.GRACE_PERIOD_DAYS || '14', 10);
const DEFAULT_EXPIRY_DAYS = parseInt(process.env.DEFAULT_EXPIRY_DAYS || '90', 10);

interface ExpiringKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  interface_type: string;
  allowed_endpoints: string[] | null;
  denied_endpoints: string[] | null;
  rate_limit_per_minute: number | null;
  rate_limit_per_hour: number | null;
  rate_limit_per_day: number | null;
  expires_at: string;
  days_until_expiry: number;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_by_app: string | null;
}

interface RotationResult {
  keysRotated: number;
  keysExpired: number;
  keysNotified: number;
  errors: string[];
}

function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const keyBytes = randomBytes(32);
  const raw = `rad_${keyBytes.toString('base64url')}`;
  const prefix = raw.substring(0, 12);
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, prefix, hash };
}

export async function handler(): Promise<RotationResult> {
  const pool = await getDbPool();
  const result: RotationResult = {
    keysRotated: 0,
    keysExpired: 0,
    keysNotified: 0,
    errors: [],
  };

  try {
    // 1. Find keys expiring within the grace period that haven't been rotated yet
    const expiringKeys = await pool.query<ExpiringKey>(`
      SELECT
        ak.id, ak.tenant_id, ak.name, ak.key_prefix,
        ak.scopes, ak.interface_type,
        ak.allowed_endpoints, ak.denied_endpoints,
        ak.rate_limit_per_minute, ak.rate_limit_per_hour, ak.rate_limit_per_day,
        ak.expires_at, ak.metadata, ak.created_by, ak.created_by_app,
        EXTRACT(DAY FROM ak.expires_at - NOW())::int AS days_until_expiry
      FROM api_keys ak
      WHERE ak.is_active = true
        AND ak.expires_at IS NOT NULL
        AND ak.expires_at <= NOW() + INTERVAL '${GRACE_PERIOD_DAYS} days'
        AND ak.expires_at > NOW()
        AND NOT EXISTS (
          SELECT 1 FROM api_keys successor
          WHERE successor.metadata->>'replaces_key_id' = ak.id::text
            AND successor.is_active = true
        )
      ORDER BY ak.expires_at ASC
    `);

    for (const key of expiringKeys.rows) {
      try {
        const newKey = generateApiKey();
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + DEFAULT_EXPIRY_DAYS);

        // Create successor key with same permissions
        await pool.query(
          `INSERT INTO api_keys (
            tenant_id, name, key_prefix, key_hash,
            interface_type, scopes, allowed_endpoints, denied_endpoints,
            rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
            is_active, expires_at,
            created_by, created_by_app,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $13, 'system', $14)`,
          [
            key.tenant_id,
            `${key.name} (auto-rotated)`,
            newKey.prefix,
            newKey.hash,
            key.interface_type,
            key.scopes,
            key.allowed_endpoints,
            key.denied_endpoints,
            key.rate_limit_per_minute,
            key.rate_limit_per_hour,
            key.rate_limit_per_day,
            newExpiresAt.toISOString(),
            key.created_by,
            JSON.stringify({
              ...key.metadata,
              replaces_key_id: key.id,
              rotation_type: 'auto',
              rotated_at: new Date().toISOString(),
            }),
          ]
        );

        // Log rotation event
        await pool.query(
          `INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
           VALUES ($1, $2, 'updated', $3::jsonb)`,
          [key.tenant_id, key.id, JSON.stringify({
            action: 'auto_rotation',
            new_key_prefix: newKey.prefix,
            days_until_expiry: key.days_until_expiry,
            new_expires_at: newExpiresAt.toISOString(),
          })]
        );

        result.keysRotated++;

        // Notify tenant about the new key
        await publishNotification('KEY_AUTO_ROTATED', {
          tenantId: key.tenant_id,
          oldKeyPrefix: key.key_prefix,
          newKeyPrefix: newKey.prefix,
          oldKeyName: key.name,
          expiresAt: key.expires_at,
          newExpiresAt: newExpiresAt.toISOString(),
          daysUntilOldExpiry: key.days_until_expiry,
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Rotate key ${key.id}: ${msg}`);
      }
    }

    // 2. Find and disable expired keys
    const expiredResult = await pool.query(`
      UPDATE api_keys
      SET is_active = false,
          revoked_at = NOW(),
          revoked_reason = 'expired',
          updated_at = NOW()
      WHERE is_active = true
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
      RETURNING id, tenant_id, key_prefix, name
    `);

    for (const expired of expiredResult.rows) {
      result.keysExpired++;

      await pool.query(
        `INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
         VALUES ($1, $2, 'expired', $3::jsonb)`,
        [expired.tenant_id, expired.id, JSON.stringify({
          reason: 'expiry_reached',
          expired_at: new Date().toISOString(),
        })]
      );

      await publishNotification('KEY_EXPIRED', {
        tenantId: expired.tenant_id,
        keyPrefix: expired.key_prefix,
        keyName: expired.name,
      });
    }

    // 3. Notify about keys expiring soon (but not yet in rotation window)
    const soonExpiringKeys = await pool.query(`
      SELECT id, tenant_id, key_prefix, name,
        EXTRACT(DAY FROM expires_at - NOW())::int AS days_until_expiry
      FROM api_keys
      WHERE is_active = true
        AND expires_at IS NOT NULL
        AND expires_at > NOW() + INTERVAL '${GRACE_PERIOD_DAYS} days'
        AND expires_at <= NOW() + INTERVAL '${GRACE_PERIOD_DAYS + 7} days'
    `);

    for (const key of soonExpiringKeys.rows) {
      result.keysNotified++;
      await publishNotification('KEY_EXPIRY_UPCOMING', {
        tenantId: key.tenant_id,
        keyPrefix: key.key_prefix,
        keyName: key.name,
        daysUntilExpiry: key.days_until_expiry,
      });
    }

    // Publish summary if any activity
    if (result.keysRotated > 0 || result.keysExpired > 0) {
      await publishNotification('ROTATION_SUMMARY', result);
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    return result;
  }
}

async function publishNotification(type: string, data: Record<string, unknown>): Promise<void> {
  if (!ALERT_TOPIC_ARN) return;

  await sns.send(new PublishCommand({
    TopicArn: ALERT_TOPIC_ARN,
    Subject: `[RADIANT Security] ${type}`,
    Message: JSON.stringify({ type, ...data, timestamp: new Date().toISOString() }, null, 2),
    MessageAttributes: {
      EventType: { DataType: 'String', StringValue: type },
    },
  }));
}
