/**
 * Dormant API Key Audit Lambda
 *
 * Runs daily to detect and handle inactive tenant API keys:
 * - 30 days inactive: Flag as dormant, notify tenant admin
 * - 45 days inactive: Final warning notification
 * - 60 days inactive: Auto-disable key, notify tenant admin
 *
 * @version 1.0.0
 * @since RADIANT v4.18.0
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { getDbPool } from '../shared/db/centralized-pool';

const sns = new SNSClient({});
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || '';
const WARNING_DAYS_30 = parseInt(process.env.WARNING_DAYS_30 || '30', 10);
const WARNING_DAYS_45 = parseInt(process.env.WARNING_DAYS_45 || '45', 10);
const DISABLE_DAYS_60 = parseInt(process.env.DISABLE_DAYS_60 || '60', 10);

interface DormantKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  days_inactive: number;
}

interface AuditResult {
  keysWarned30: number;
  keysWarned45: number;
  keysDisabled: number;
  errors: string[];
}

export async function handler(): Promise<AuditResult> {
  const pool = await getDbPool();
  const result: AuditResult = {
    keysWarned30: 0,
    keysWarned45: 0,
    keysDisabled: 0,
    errors: [],
  };

  try {
    // Find keys inactive for 30+ days (that haven't been flagged yet)
    const dormantKeys = await pool.query<DormantKey>(`
      SELECT
        ak.id,
        ak.tenant_id,
        ak.name,
        ak.key_prefix,
        ak.last_used_at,
        ak.created_at,
        EXTRACT(DAY FROM NOW() - COALESCE(ak.last_used_at, ak.created_at))::int AS days_inactive
      FROM api_keys ak
      WHERE ak.is_active = true
        AND ak.revoked_at IS NULL
        AND COALESCE(ak.last_used_at, ak.created_at) < NOW() - INTERVAL '${WARNING_DAYS_30} days'
      ORDER BY days_inactive DESC
    `);

    for (const key of dormantKeys.rows) {
      try {
        if (key.days_inactive >= DISABLE_DAYS_60) {
          // Auto-disable after 60 days
          await pool.query(
            `UPDATE api_keys
             SET is_active = false,
                 revoked_at = NOW(),
                 revoked_reason = 'auto_disabled_dormant_60d',
                 metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                   'dormant_disabled_at', NOW()::text,
                   'days_inactive', $2
                 ),
                 updated_at = NOW()
             WHERE id = $1`,
            [key.id, key.days_inactive]
          );

          // Log to audit table
          await pool.query(
            `INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
             VALUES ($1, $2, 'expired', $3::jsonb)`,
            [key.tenant_id, key.id, JSON.stringify({
              reason: 'dormant_auto_disable',
              days_inactive: key.days_inactive,
              last_used_at: key.last_used_at,
            })]
          );

          result.keysDisabled++;

          await publishAlert('KEY_AUTO_DISABLED', key);

        } else if (key.days_inactive >= WARNING_DAYS_45) {
          // Final warning at 45 days
          const alreadyWarned = await pool.query(
            `SELECT 1 FROM api_key_audit_log
             WHERE key_id = $1 AND action = 'used' AND details->>'warning_level' = '45d'
             AND created_at > NOW() - INTERVAL '7 days'`,
            [key.id]
          );

          if (alreadyWarned.rows.length === 0) {
            await pool.query(
              `INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
               VALUES ($1, $2, 'used', $3::jsonb)`,
              [key.tenant_id, key.id, JSON.stringify({
                warning_level: '45d',
                days_inactive: key.days_inactive,
                message: 'Final warning: key will be auto-disabled at 60 days',
              })]
            );

            result.keysWarned45++;
            await publishAlert('KEY_FINAL_WARNING', key);
          }

        } else if (key.days_inactive >= WARNING_DAYS_30) {
          // First warning at 30 days
          const alreadyWarned = await pool.query(
            `SELECT 1 FROM api_key_audit_log
             WHERE key_id = $1 AND action = 'used' AND details->>'warning_level' = '30d'
             AND created_at > NOW() - INTERVAL '7 days'`,
            [key.id]
          );

          if (alreadyWarned.rows.length === 0) {
            await pool.query(
              `INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
               VALUES ($1, $2, 'used', $3::jsonb)`,
              [key.tenant_id, key.id, JSON.stringify({
                warning_level: '30d',
                days_inactive: key.days_inactive,
                message: 'Key flagged as dormant',
              })]
            );

            result.keysWarned30++;
            await publishAlert('KEY_DORMANT_WARNING', key);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Key ${key.id}: ${msg}`);
      }
    }

    // Publish summary
    if (result.keysWarned30 > 0 || result.keysWarned45 > 0 || result.keysDisabled > 0) {
      await publishSummary(result);
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    return result;
  }
}

async function publishAlert(type: string, key: DormantKey): Promise<void> {
  if (!ALERT_TOPIC_ARN) return;

  await sns.send(new PublishCommand({
    TopicArn: ALERT_TOPIC_ARN,
    Subject: `[RADIANT Security] ${type}: API Key ${key.key_prefix}...`,
    Message: JSON.stringify({
      type,
      keyId: key.id,
      keyPrefix: key.key_prefix,
      keyName: key.name,
      tenantId: key.tenant_id,
      daysInactive: key.days_inactive,
      lastUsedAt: key.last_used_at,
      timestamp: new Date().toISOString(),
    }, null, 2),
    MessageAttributes: {
      EventType: { DataType: 'String', StringValue: type },
      TenantId: { DataType: 'String', StringValue: key.tenant_id },
    },
  }));
}

async function publishSummary(result: AuditResult): Promise<void> {
  if (!ALERT_TOPIC_ARN) return;

  await sns.send(new PublishCommand({
    TopicArn: ALERT_TOPIC_ARN,
    Subject: '[RADIANT Security] Daily Dormant Key Audit Summary',
    Message: JSON.stringify({
      type: 'DORMANT_KEY_AUDIT_SUMMARY',
      keysWarned30Days: result.keysWarned30,
      keysWarned45Days: result.keysWarned45,
      keysAutoDisabled: result.keysDisabled,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    }, null, 2),
  }));
}
