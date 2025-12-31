/**
 * RADIANT v4.18.56 - Learning Snapshots Scheduled Lambda
 * Creates daily snapshots of learning state for fast recovery
 * Schedule: Daily at 3:00 AM UTC
 */

import { ScheduledEvent } from 'aws-lambda';
import { Pool } from 'pg';
import { LearningInfluenceService } from '../shared/services/learning-influence.service';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const learningService = new LearningInfluenceService(pool);

interface SnapshotResult {
  scopeType: 'user' | 'tenant' | 'global';
  scopeId?: string;
  snapshotId: string;
  success: boolean;
  error?: string;
}

export const handler = async (event: ScheduledEvent): Promise<{
  statusCode: number;
  body: string;
}> => {
  console.log('Learning Snapshots Lambda triggered', { time: event.time });

  const results: SnapshotResult[] = [];
  let globalSnapshotId: string | undefined;

  try {
    // 1. Create global snapshot first
    console.log('Creating global learning snapshot...');
    try {
      globalSnapshotId = await learningService.createSnapshot('global');
      results.push({
        scopeType: 'global',
        snapshotId: globalSnapshotId,
        success: true,
      });
      console.log('Global snapshot created:', globalSnapshotId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        scopeType: 'global',
        snapshotId: '',
        success: false,
        error: errorMessage,
      });
      console.error('Failed to create global snapshot:', errorMessage);
    }

    // 2. Get all active tenants with learning data
    const tenantsResult = await pool.query(`
      SELECT DISTINCT t.id as tenant_id, t.name as tenant_name
      FROM tenants t
      WHERE t.status = 'active'
      AND (
        EXISTS (SELECT 1 FROM tenant_aggregate_learning tal WHERE tal.tenant_id = t.id)
        OR EXISTS (SELECT 1 FROM user_learned_preferences ulp WHERE ulp.tenant_id = t.id)
        OR EXISTS (SELECT 1 FROM user_rules ur WHERE ur.tenant_id = t.id)
      )
      LIMIT 1000
    `);

    console.log(`Found ${tenantsResult.rows.length} tenants with learning data`);

    // 3. Create tenant snapshots
    for (const row of tenantsResult.rows) {
      const tenantId = row.tenant_id as string;
      const tenantName = row.tenant_name as string;

      try {
        const snapshotId = await learningService.createSnapshot('tenant', tenantId, tenantId);
        results.push({
          scopeType: 'tenant',
          scopeId: tenantId,
          snapshotId,
          success: true,
        });
        console.log(`Tenant snapshot created for ${tenantName}:`, snapshotId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          scopeType: 'tenant',
          scopeId: tenantId,
          snapshotId: '',
          success: false,
          error: errorMessage,
        });
        console.error(`Failed to create snapshot for tenant ${tenantName}:`, errorMessage);
      }
    }

    // 4. Cleanup old snapshots (keep last 30 days)
    const cleanupResult = await pool.query(`
      DELETE FROM learning_snapshots
      WHERE snapshot_timestamp < NOW() - INTERVAL '30 days'
      AND is_current = false
      RETURNING id
    `);
    console.log(`Cleaned up ${cleanupResult.rowCount} old snapshots`);

    // 5. Refresh materialized views for metrics
    await pool.query('SELECT refresh_tenant_daily_metrics()');
    console.log('Refreshed tenant daily metrics view');

    // 6. Log snapshot run
    await pool.query(`
      INSERT INTO system_logs (
        log_level, log_source, log_category, message, data
      ) VALUES (
        'info', 'learning-snapshots-lambda', 'scheduled_job',
        'Daily learning snapshots completed',
        $1
      )
    `, [JSON.stringify({
      totalSnapshots: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      globalSnapshotId,
      cleanedUp: cleanupResult.rowCount,
    })]);

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      globalSnapshotId,
      cleanedUp: cleanupResult.rowCount,
    };

    console.log('Snapshot job completed:', summary);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Learning snapshots created successfully',
        summary,
        results,
      }),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Learning snapshots job failed:', errorMessage);

    // Log failure
    await pool.query(`
      INSERT INTO system_logs (
        log_level, log_source, log_category, message, data
      ) VALUES (
        'error', 'learning-snapshots-lambda', 'scheduled_job',
        'Daily learning snapshots failed',
        $1
      )
    `, [JSON.stringify({ error: errorMessage, results })]).catch(() => {});

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        results,
      }),
    };
  }
};
